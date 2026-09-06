const express = require("express");
const pool = require("../db");
const { requireAisIngestKey } = require("../middleware/aisAuth");
const logger = require("../lib/logger");

const router = express.Router();

/*
 * POST /api/ais/positions
 *
 * Accepts a normalized GPS/AIS position report and stores it
 * in vessel_positions.
 *
 * Authentication:
 *   X-AIS-API-Key: <configured ingestion key>
 *
 * Expected JSON:
 * {
 *   "mmsi": "123456789",
 *   "latitude": 4.8123,
 *   "longitude": 4.9012,
 *   "speedKnots": 12.5,
 *   "headingDegrees": 118,
 *   "positionSource": "ais",
 *   "sourceDeviceId": "ais-provider-01",
 *   "sourceTimestamp": "2026-09-06T11:30:00Z"
 * }
 */
router.post("/positions", requireAisIngestKey, async (req, res) => {
  try {
    const {
      mmsi,
      latitude,
      longitude,
      speedKnots,
      headingDegrees,
      positionSource,
      sourceDeviceId,
      sourceTimestamp
    } = req.body || {};

    const normalizedMmsi = String(mmsi || "").trim();

    if (!normalizedMmsi) {
      return res.status(400).json({
        success: false,
        error: "mmsi is required"
      });
    }

    const normalizedLatitude = Number(latitude);
    const normalizedLongitude = Number(longitude);

    if (
      !Number.isFinite(normalizedLatitude) ||
      normalizedLatitude < -90 ||
      normalizedLatitude > 90
    ) {
      return res.status(400).json({
        success: false,
        error: "latitude must be a number between -90 and 90"
      });
    }

    if (
      !Number.isFinite(normalizedLongitude) ||
      normalizedLongitude < -180 ||
      normalizedLongitude > 180
    ) {
      return res.status(400).json({
        success: false,
        error: "longitude must be a number between -180 and 180"
      });
    }

    const normalizedSpeed =
      speedKnots === undefined || speedKnots === null || speedKnots === ""
        ? null
        : Number(speedKnots);

    if (
      normalizedSpeed !== null &&
      (!Number.isFinite(normalizedSpeed) || normalizedSpeed < 0)
    ) {
      return res.status(400).json({
        success: false,
        error: "speedKnots must be a non-negative number"
      });
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
      return res.status(400).json({
        success: false,
        error: "headingDegrees must be between 0 and less than 360"
      });
    }

    const normalizedSource = String(positionSource || "ais")
      .trim()
      .toLowerCase();

    if (!["gps", "ais"].includes(normalizedSource)) {
      return res.status(400).json({
        success: false,
        error: "positionSource must be gps or ais"
      });
    }

    const normalizedDeviceId =
      String(sourceDeviceId || "").trim() || null;

    let normalizedSourceTimestamp = null;

    if (sourceTimestamp !== undefined && sourceTimestamp !== null) {
      const timestampText = String(sourceTimestamp).trim();

      if (timestampText) {
        const parsedTimestamp = new Date(timestampText);

        if (Number.isNaN(parsedTimestamp.getTime())) {
          return res.status(400).json({
            success: false,
            error: "sourceTimestamp must be a valid date/time"
          });
        }

        normalizedSourceTimestamp = parsedTimestamp
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");
      }
    }

    const [vesselRows] = await pool.query(
      `
        SELECT id, vessel_code, name, status
        FROM vessels
        WHERE mmsi = ?
        LIMIT 1
      `,
      [normalizedMmsi]
    );

    if (vesselRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No vessel is registered with this MMSI"
      });
    }

    const vessel = vesselRows[0];

    if (vessel.status === "retired") {
      return res.status(409).json({
        success: false,
        error: "Cannot record a position for a retired vessel"
      });
    }

    const recordedAt = normalizedSourceTimestamp || new Date()
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

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
          source_timestamp,
          recorded_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        vessel.id,
        normalizedLatitude,
        normalizedLongitude,
        normalizedSpeed,
        normalizedHeading,
        normalizedSource,
        normalizedDeviceId,
        normalizedSourceTimestamp,
        recordedAt
      ]
    );

    logger.info({
      vesselId: Number(vessel.id),
      vesselCode: vessel.vessel_code,
      positionSource: normalizedSource,
      sourceDeviceId: normalizedDeviceId,
      positionId: Number(result.insertId)
    }, "AIS/GPS position recorded");

    res.status(201).json({
      success: true,
      message: "Position recorded successfully",
      data: {
        id: Number(result.insertId),
        vesselId: Number(vessel.id),
        vesselCode: vessel.vessel_code,
        vesselName: vessel.name,
        mmsi: normalizedMmsi,
        latitude: normalizedLatitude,
        longitude: normalizedLongitude,
        speedKnots: normalizedSpeed,
        headingDegrees: normalizedHeading,
        positionSource: normalizedSource,
        sourceDeviceId: normalizedDeviceId,
        sourceTimestamp: normalizedSourceTimestamp,
        recordedAt
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ err: error }, "AIS/GPS position ingestion error");

    res.status(500).json({
      success: false,
      error: "Unable to record AIS/GPS position"
    });
  }
});

module.exports = router;
