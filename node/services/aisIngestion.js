const pool = require("../db");
const logger = require("../lib/logger");
const metrics = require("../lib/metrics");

class AisIngestionError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "AisIngestionError";
    this.status = status;
  }
}

function normalizePositionPayload(body) {
  const {
    mmsi,
    latitude,
    longitude,
    speedKnots,
    headingDegrees,
    positionSource,
    sourceDeviceId,
    sourceEventId,
    sourceTimestamp
  } = body || {};

  const normalizedMmsi = String(mmsi || "").trim();

  if (!normalizedMmsi) {
    throw new AisIngestionError(400, "mmsi is required");
  }

  const normalizedLatitude = Number(latitude);
  const normalizedLongitude = Number(longitude);

  if (
    !Number.isFinite(normalizedLatitude) ||
    normalizedLatitude < -90 ||
    normalizedLatitude > 90
  ) {
    throw new AisIngestionError(
      400,
      "latitude must be a number between -90 and 90"
    );
  }

  if (
    !Number.isFinite(normalizedLongitude) ||
    normalizedLongitude < -180 ||
    normalizedLongitude > 180
  ) {
    throw new AisIngestionError(
      400,
      "longitude must be a number between -180 and 180"
    );
  }

  const normalizedSpeed =
    speedKnots === undefined || speedKnots === null || speedKnots === ""
      ? null
      : Number(speedKnots);

  if (
    normalizedSpeed !== null &&
    (!Number.isFinite(normalizedSpeed) || normalizedSpeed < 0)
  ) {
    throw new AisIngestionError(
      400,
      "speedKnots must be a non-negative number"
    );
  }

  const normalizedHeading =
    headingDegrees === undefined ||
    headingDegrees === null ||
    headingDegrees === ""
      ? null
      : Number(headingDegrees);

  if (
    normalizedHeading !== null &&
    (!Number.isFinite(normalizedHeading) ||
      normalizedHeading < 0 ||
      normalizedHeading >= 360)
  ) {
    throw new AisIngestionError(
      400,
      "headingDegrees must be between 0 and less than 360"
    );
  }

  const normalizedSource = String(positionSource || "ais")
    .trim()
    .toLowerCase();

  if (!["gps", "ais"].includes(normalizedSource)) {
    throw new AisIngestionError(
      400,
      "positionSource must be gps or ais"
    );
  }

  const normalizedDeviceId =
    String(sourceDeviceId || "").trim() || null;

  const normalizedSourceEventId =
    String(sourceEventId || "").trim() || null;

  if (normalizedSourceEventId && !normalizedDeviceId) {
    throw new AisIngestionError(
      400,
      "sourceDeviceId is required when sourceEventId is provided"
    );
  }

  if (normalizedSourceEventId && normalizedSourceEventId.length > 150) {
    throw new AisIngestionError(
      400,
      "sourceEventId must be 150 characters or fewer"
    );
  }

  let normalizedSourceTimestamp = null;

  if (sourceTimestamp !== undefined && sourceTimestamp !== null) {
    const timestampText = String(sourceTimestamp).trim();

    if (timestampText) {
      const parsedTimestamp = new Date(timestampText);

      if (Number.isNaN(parsedTimestamp.getTime())) {
        throw new AisIngestionError(
          400,
          "sourceTimestamp must be a valid date/time"
        );
      }

      normalizedSourceTimestamp = parsedTimestamp
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
    }
  }

  return {
    mmsi: normalizedMmsi,
    latitude: normalizedLatitude,
    longitude: normalizedLongitude,
    speedKnots: normalizedSpeed,
    headingDegrees: normalizedHeading,
    positionSource: normalizedSource,
    sourceDeviceId: normalizedDeviceId,
    sourceEventId: normalizedSourceEventId,
    sourceTimestamp: normalizedSourceTimestamp
  };
}

async function resolveVessel(mmsi) {
  const [vesselRows] = await pool.query(
    `
      SELECT id, vessel_code, name, status
      FROM vessels
      WHERE mmsi = ?
      LIMIT 1
    `,
    [mmsi]
  );

  if (vesselRows.length === 0) {
    throw new AisIngestionError(
      404,
      "No vessel is registered with this MMSI"
    );
  }

  const vessel = vesselRows[0];

  if (vessel.status === "retired") {
    throw new AisIngestionError(
      409,
      "Cannot record a position for a retired vessel"
    );
  }

  return vessel;
}

async function insertPosition(vessel, position) {
  const recordedAt =
    position.sourceTimestamp ||
    new Date().toISOString().slice(0, 19).replace("T", " ");

  try {
    const [result] = await pool.query(
      `
        INSERT INTO vessel_positions (
          vessel_id,
          latitude,
          longitude,
          speed_knots,
          heading_degrees,
          position_source,
          source_device_id,
          source_event_id,
          source_timestamp,
          recorded_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        vessel.id,
        position.latitude,
        position.longitude,
        position.speedKnots,
        position.headingDegrees,
        position.positionSource,
        position.sourceDeviceId,
        position.sourceEventId,
        position.sourceTimestamp,
        recordedAt
      ]
    );

    return {
      id: Number(result.insertId),
      recordedAt,
      duplicate: false
    };
  } catch (error) {
    if (
      error?.code === "ER_DUP_ENTRY" &&
      position.sourceDeviceId &&
      position.sourceEventId
    ) {
      const [existingRows] = await pool.query(
        `
          SELECT id
          FROM vessel_positions
          WHERE source_device_id = ?
            AND source_event_id = ?
          LIMIT 1
        `,
        [position.sourceDeviceId, position.sourceEventId]
      );

      if (existingRows.length > 0) {
        const existingPositionId = Number(existingRows[0].id);

        logger.info({
          vesselId: Number(vessel.id),
          vesselCode: vessel.vessel_code,
          positionSource: position.positionSource,
          sourceDeviceId: position.sourceDeviceId,
          sourceEventId: position.sourceEventId,
          positionId: existingPositionId
        }, "Duplicate AIS/GPS position ignored");

        return {
          id: existingPositionId,
          recordedAt,
          duplicate: true
        };
      }
    }

    throw error;
  }
}

async function ingestPosition(body) {
  metrics.increment("ais.ingestion.received");

  try {
    const position = normalizePositionPayload(body);
    const vessel = await resolveVessel(position.mmsi);
    const persisted = await insertPosition(vessel, position);

    if (persisted.duplicate) {
      metrics.increment("ais.ingestion.duplicates");
    } else {
      metrics.increment("ais.ingestion.accepted");
    }

    logger.info({
      vesselId: Number(vessel.id),
      vesselCode: vessel.vessel_code,
      positionSource: position.positionSource,
      sourceDeviceId: position.sourceDeviceId,
      sourceEventId: position.sourceEventId,
      positionId: persisted.id
    }, persisted.duplicate
      ? "AIS/GPS position already recorded"
      : "AIS/GPS position recorded");

    return {
      ...position,
      ...persisted,
      vesselId: Number(vessel.id),
      vesselCode: vessel.vessel_code,
      vesselName: vessel.name
    };
  } catch (error) {
    if (error instanceof AisIngestionError) {
      metrics.increment("ais.ingestion.rejected");
    } else {
      metrics.increment("ais.ingestion.errors");
    }

    throw error;
  }
}

module.exports = {
  AisIngestionError,
  normalizePositionPayload,
  resolveVessel,
  insertPosition,
  ingestPosition
};
