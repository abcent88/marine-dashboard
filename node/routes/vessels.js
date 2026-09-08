const express = require("express");
const pool = require("../db");
const { requireRole } = require("../middleware/auth");
const logger = require("../lib/logger");
const { validateVesselId, normalizeVesselInput, validateVesselInput, VESSEL_SELECT, serializeVessel } = require("./vessel-helpers");
const vesselRetireRouter = require("./vessel-retire");

const router = express.Router();

/*
 * GET /api/vessels
 *
 * Returns all non-retired vessels together with their home port.
 */
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      ${VESSEL_SELECT}
      WHERE v.status <> 'retired'
      ORDER BY v.id ASC
    `);

    const vessels = rows.map(serializeVessel);

    res.json({
      success: true,
      count: vessels.length,
      data: vessels,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ err: error }, "Vessels API error");

    res.status(500).json({
      success: false,
      error: "Unable to load vessels"
    });
  }
});


/*
 * POST /api/vessels
 *
 * Creates a new vessel.
 */
router.post("/", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const input = normalizeVesselInput(req.body || {});
    const validationError = validateVesselInput(input);

    if(validationError){
      return res.status(400).json({
        success: false,
        error: validationError
      });
    }

    const {
      normalizedCode,
      normalizedName,
      normalizedType,
      normalizedFlagCountry,
      normalizedImoNumber,
      normalizedCallSign,
      normalizedMmsi,
      normalizedStatus,
      normalizedHomePortId,
      normalizedCommissionedDate,
      normalizedCapacity
    } = input;

    if(normalizedHomePortId !== null){
      const [portRows] = await pool.query(
        "SELECT id FROM ports WHERE id = ? LIMIT 1",
        [normalizedHomePortId]
      );

      if(portRows.length === 0){
        return res.status(400).json({
          success: false,
          error: "Home port not found"
        });
      }
    }

    const [result] = await pool.query(`
      INSERT INTO vessels (
        vessel_code,
        name,
        vessel_type,
        flag_country,
        imo_number,
        call_sign,
        mmsi,
        capacity_tons,
        status,
        home_port_id,
        commissioned_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      normalizedCode,
      normalizedName,
      normalizedType,
      normalizedFlagCountry,
      normalizedImoNumber,
      normalizedCallSign,
      normalizedMmsi,
      normalizedCapacity,
      normalizedStatus,
      normalizedHomePortId,
      normalizedCommissionedDate
    ]);

    const [rows] = await pool.query(`
      SELECT
        v.id,
        v.vessel_code,
        v.name,
        v.vessel_type,
        v.flag_country,
        v.imo_number,
        v.call_sign,
        v.mmsi,
        v.capacity_tons,
        v.status,
        DATE_FORMAT(v.commissioned_date, '%Y-%m-%d') AS commissioned_date,
        v.created_at,
        v.updated_at,
        p.id AS home_port_id,
        p.name AS home_port_name,
        p.country AS home_port_country,
        p.code AS home_port_code
      FROM vessels v
      LEFT JOIN ports p
        ON p.id = v.home_port_id
      WHERE v.id = ?
      LIMIT 1
    `, [result.insertId]);

    const vessel = rows[0];

    res.status(201).json({
      success: true,
      message: "Vessel created successfully",
      data: {
        id: Number(vessel.id),
        vesselCode: vessel.vessel_code,
        name: vessel.name,
        vesselType: vessel.vessel_type,
        flagCountry: vessel.flag_country,
        imoNumber: vessel.imo_number,
        callSign: vessel.call_sign,
        mmsi: vessel.mmsi,
        capacityTons: Number(vessel.capacity_tons),
        status: vessel.status,
        commissionedDate: vessel.commissioned_date
        ? String(vessel.commissioned_date).slice(0, 10)
        : null,
        homePort: vessel.home_port_id
          ? {
              id: Number(vessel.home_port_id),
              name: vessel.home_port_name,
              country: vessel.home_port_country,
              code: vessel.home_port_code
            }
          : null,
        createdAt: vessel.created_at,
        updatedAt: vessel.updated_at
      }
    });

  } catch (error) {
    logger.error({ err: error }, "Create vessel API error");

    if(error && error.code === "ER_DUP_ENTRY"){
      return res.status(409).json({
        success: false,
        error: "Vessel code, IMO number, or MMSI already exists"
      });
    }

    res.status(500).json({
      success: false,
      error: "Unable to create vessel"
    });
  }
});

/*
 * PUT /api/vessels/:id
 *
 * Updates one vessel by database ID.
 */
router.put("/:id", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const vesselId = validateVesselId(req.params.id);

    if(!vesselId){
      return res.status(400).json({
        success: false,
        error: "Invalid vessel ID"
      });
    }

    const input = normalizeVesselInput(req.body || {}, { mode: "update" });
    const validationError = validateVesselInput(input);

    if(validationError){
      return res.status(400).json({
        success: false,
        error: validationError
      });
    }

    const {
      normalizedCode,
      normalizedName,
      normalizedType,
      normalizedFlagCountry,
      normalizedImoNumber,
      normalizedCallSign,
      normalizedMmsi,
      normalizedCapacity,
      normalizedStatus,
      normalizedHomePortId,
      normalizedCommissionedDate
    } = input;

    if(normalizedHomePortId !== null){
      const [portRows] = await pool.query(
        "SELECT id FROM ports WHERE id = ? LIMIT 1",
        [normalizedHomePortId]
      );

      if(portRows.length === 0){
        return res.status(400).json({
          success: false,
          error: "Home port not found"
        });
      }
    }

    const [existingRows] = await pool.query(
      "SELECT id FROM vessels WHERE id = ? LIMIT 1",
      [vesselId]
    );

    if(existingRows.length === 0){
      return res.status(404).json({
        success: false,
        error: "Vessel not found"
      });
    }

    await pool.query(`
      UPDATE vessels
      SET
        vessel_code = ?,
        name = ?,
        vessel_type = ?,
        flag_country = ?,
        imo_number = ?,
        call_sign = ?,
        mmsi = ?,
        capacity_tons = ?,
        status = ?,
        home_port_id = ?,
        commissioned_date = ?
      WHERE id = ?
    `, [
      normalizedCode,
      normalizedName,
      normalizedType,
      normalizedFlagCountry,
      normalizedImoNumber,
      normalizedCallSign,
      normalizedMmsi,
      normalizedCapacity,
      normalizedStatus,
      normalizedHomePortId,
      normalizedCommissionedDate,
      vesselId
    ]);

    const [rows] = await pool.query(`
      ${VESSEL_SELECT}
      WHERE v.id = ?
      LIMIT 1
    `, [vesselId]);

    const vessel = rows[0];

    res.json({
      success: true,
      message: "Vessel updated successfully",
      data: serializeVessel(vessel)
    });

  } catch (error) {
    logger.error({ err: error }, "Update vessel API error");

    if(error && error.code === "ER_DUP_ENTRY"){
      return res.status(409).json({
        success: false,
        error: "Vessel code, IMO number, or MMSI already exists"
      });
    }

    res.status(500).json({
      success: false,
      error: "Unable to update vessel"
    });
  }
});

router.use(vesselRetireRouter);

/*
 * GET /api/vessels/:id/position
 *
 * Returns the latest known position for one vessel.
 */
router.get("/:id/position", async (req, res) => {
  try {
    const vesselId = Number(req.params.id);

    if(!Number.isInteger(vesselId) || vesselId <= 0){
      return res.status(400).json({
        success: false,
        error: "Invalid vessel ID"
      });
    }

    const [rows] = await pool.query(`
      SELECT
        vp.id,
        vp.vessel_id,
        vp.latitude,
        vp.longitude,
        vp.speed_knots,
        vp.heading_degrees,
        vp.position_source,
        vp.source_device_id,
        vp.source_timestamp,
        vp.recorded_at,
        v.vessel_code,
        v.mmsi,
        v.name AS vessel_name
      FROM vessel_positions vp
      INNER JOIN vessels v
        ON v.id = vp.vessel_id
      WHERE vp.vessel_id = ?
        AND v.status <> 'retired'
      ORDER BY vp.recorded_at DESC, vp.id DESC
      LIMIT 1
    `, [vesselId]);

    if(rows.length === 0){
      return res.status(404).json({
        success: false,
        error: "No position data found for vessel"
      });
    }

    const position = rows[0];

    res.json({
      success: true,
      data: {
        id: Number(position.id),
        vesselId: Number(position.vessel_id),
        vesselCode: position.vessel_code,
        vesselName: position.vessel_name,
        mmsi: position.mmsi,
        latitude: Number(position.latitude),
        longitude: Number(position.longitude),
        speedKnots: Number(position.speed_knots),
        headingDegrees: Number(position.heading_degrees),
        positionSource: position.position_source,
        sourceDeviceId: position.source_device_id,
        sourceTimestamp: position.source_timestamp,
        recordedAt: position.recorded_at
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ err: error }, "Vessel position API error");

    res.status(500).json({
      success: false,
      error: "Unable to load vessel position"
    });
  }
});

/*
 * GET /api/vessels/:id
 *
 * Returns one vessel by database ID.
 */
router.get("/:id", async (req, res) => {
  try {
    const vesselId = Number(req.params.id);

    if(!Number.isInteger(vesselId) || vesselId <= 0){
      return res.status(400).json({
        success: false,
        error: "Invalid vessel ID"
      });
    }

    const [rows] = await pool.query(`
      SELECT
        v.id,
        v.vessel_code,
        v.name,
        v.vessel_type,
        v.flag_country,
        v.imo_number,
        v.call_sign,
        v.capacity_tons,
        v.status,
        DATE_FORMAT(v.commissioned_date, '%Y-%m-%d') AS commissioned_date,
        v.created_at,
        v.updated_at,
        p.id AS home_port_id,
        p.name AS home_port_name,
        p.country AS home_port_country,
        p.code AS home_port_code
      FROM vessels v
      LEFT JOIN ports p
        ON p.id = v.home_port_id
      WHERE v.id = ?
        AND v.status <> 'retired'
      LIMIT 1
    `, [vesselId]);

    if(rows.length === 0){
      return res.status(404).json({
        success: false,
        error: "Vessel not found"
      });
    }

    const vessel = rows[0];

    res.json({
      success: true,
      data: {
        id: Number(vessel.id),
        vesselCode: vessel.vessel_code,
        name: vessel.name,
        vesselType: vessel.vessel_type,
        flagCountry: vessel.flag_country,
        imoNumber: vessel.imo_number,
        callSign: vessel.call_sign,
        capacityTons: Number(vessel.capacity_tons),
        status: vessel.status,
        commissionedDate: vessel.commissioned_date
        ? String(vessel.commissioned_date).slice(0, 10)
        : null,
        homePort: vessel.home_port_id
          ? {
              id: Number(vessel.home_port_id),
              name: vessel.home_port_name,
              country: vessel.home_port_country,
              code: vessel.home_port_code
            }
          : null,
        createdAt: vessel.created_at,
        updatedAt: vessel.updated_at
      }
    });

  } catch (error) {
    logger.error({ err: error }, "Vessel detail API error");

    res.status(500).json({
      success: false,
      error: "Unable to load vessel"
    });
  }
});

module.exports = router;
