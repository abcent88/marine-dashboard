const express = require("express");
const pool = require("../db");

const router = express.Router();

/*
 * GET /api/vessels
 *
 * Returns all non-retired vessels together with their home port.
 */
router.get("/", async (req, res) => {
  try {
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
      WHERE v.status <> 'retired'
      ORDER BY v.id ASC
    `);

    const vessels = rows.map(vessel => ({
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
    }));

    res.json({
      success: true,
      count: vessels.length,
      data: vessels,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("Vessels API error:", error);

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
router.post("/", async (req, res) => {
  try {
    const {
      vesselCode,
      name,
      vesselType,
      flagCountry,
      imoNumber,
      callSign,
      capacityTons,
      status,
      homePortId,
      commissionedDate
    } = req.body || {};

    const normalizedCode = String(vesselCode || "").trim();
    const normalizedName = String(name || "").trim();
    const normalizedType = String(vesselType || "").trim();
    const normalizedFlag = String(flagCountry || "").trim() || null;
    const normalizedImo = String(imoNumber || "").trim() || null;
    const normalizedCallSign = String(callSign || "").trim() || null;

    if(!normalizedCode || !normalizedName || !normalizedType){
      return res.status(400).json({
        success: false,
        error: "vesselCode, name and vesselType are required"
      });
    }

    const allowedStatuses = [
      "active",
      "restricted",
      "maintenance",
      "out_of_service",
      "retired"
    ];

    const normalizedStatus = String(status || "active").trim();

    if(!allowedStatuses.includes(normalizedStatus)){
      return res.status(400).json({
        success: false,
        error: "Invalid vessel status"
      });
    }

    const numericCapacity = Number(capacityTons ?? 0);

    if(!Number.isFinite(numericCapacity) || numericCapacity < 0){
      return res.status(400).json({
        success: false,
        error: "capacityTons must be a non-negative number"
      });
    }

    let normalizedHomePortId = null;

    if(homePortId !== undefined && homePortId !== null && String(homePortId).trim() !== ""){
      normalizedHomePortId = Number(homePortId);

      if(!Number.isInteger(normalizedHomePortId) || normalizedHomePortId <= 0){
        return res.status(400).json({
          success: false,
          error: "homePortId must be a positive integer"
        });
      }

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

    const normalizedCommissionedDate =
      commissionedDate ? String(commissionedDate).trim() : null;

    if(normalizedCommissionedDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedCommissionedDate)){
      return res.status(400).json({
        success: false,
        error: "commissionedDate must use YYYY-MM-DD format"
      });
    }

    const [result] = await pool.query(`
      INSERT INTO vessels (
        vessel_code,
        name,
        vessel_type,
        flag_country,
        imo_number,
        call_sign,
        capacity_tons,
        status,
        home_port_id,
        commissioned_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      normalizedCode,
      normalizedName,
      normalizedType,
      normalizedFlag,
      normalizedImo,
      normalizedCallSign,
      numericCapacity,
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
    console.error("Create vessel API error:", error);

    if(error && error.code === "ER_DUP_ENTRY"){
      return res.status(409).json({
        success: false,
        error: "Vessel code or IMO number already exists"
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
router.put("/:id", async (req, res) => {
  try {
    const vesselId = Number(req.params.id);

    if(!Number.isInteger(vesselId) || vesselId <= 0){
      return res.status(400).json({
        success: false,
        error: "Invalid vessel ID"
      });
    }

    const {
      vesselCode,
      name,
      vesselType,
      flagCountry,
      imoNumber,
      callSign,
      capacityTons,
      status,
      homePortId,
      commissionedDate
    } = req.body || {};

    const normalizedCode = String(vesselCode || "").trim();
    const normalizedName = String(name || "").trim();
    const normalizedType = String(vesselType || "").trim();
    const normalizedFlagCountry = flagCountry == null
      ? null
      : String(flagCountry).trim() || null;
    const normalizedImoNumber = imoNumber == null
      ? null
      : String(imoNumber).trim() || null;
    const normalizedCallSign = callSign == null
      ? null
      : String(callSign).trim() || null;
    const normalizedStatus = String(status || "").trim();
    const normalizedHomePortId =
      homePortId == null || homePortId === ""
        ? null
        : Number(homePortId);
    const normalizedCommissionedDate =
      commissionedDate == null || commissionedDate === ""
        ? null
        : String(commissionedDate).trim();

    if(!normalizedCode || !normalizedName || !normalizedType){
      return res.status(400).json({
        success: false,
        error: "vesselCode, name and vesselType are required"
      });
    }

    const allowedStatuses = [
      "active",
      "restricted",
      "maintenance",
      "out_of_service",
      "retired"
    ];

    if(!allowedStatuses.includes(normalizedStatus)){
      return res.status(400).json({
        success: false,
        error: "Invalid vessel status"
      });
    }

    const normalizedCapacity = Number(capacityTons);

    if(!Number.isFinite(normalizedCapacity) || normalizedCapacity < 0){
      return res.status(400).json({
        success: false,
        error: "capacityTons must be a non-negative number"
      });
    }

    if(normalizedHomePortId !== null &&
       (!Number.isInteger(normalizedHomePortId) || normalizedHomePortId <= 0)){
      return res.status(400).json({
        success: false,
        error: "homePortId must be a positive integer"
      });
    }

    if(normalizedHomePortId !== null){
      const [portRows] = await pool.query(`
        SELECT id
        FROM ports
        WHERE id = ?
        LIMIT 1
      `, [normalizedHomePortId]);

      if(portRows.length === 0){
        return res.status(400).json({
          success: false,
          error: "Home port not found"
        });
      }
    }

    if(normalizedCommissionedDate &&
       !/^\d{4}-\d{2}-\d{2}$/.test(normalizedCommissionedDate)){
      return res.status(400).json({
        success: false,
        error: "commissionedDate must use YYYY-MM-DD format"
      });
    }

    const [existingRows] = await pool.query(`
      SELECT id
      FROM vessels
      WHERE id = ?
      LIMIT 1
    `, [vesselId]);

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
      normalizedCapacity,
      normalizedStatus,
      normalizedHomePortId,
      normalizedCommissionedDate,
      vesselId
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
    `, [vesselId]);

    const vessel = rows[0];

    res.json({
      success: true,
      message: "Vessel updated successfully",
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
    console.error("Update vessel API error:", error);

    if(error && error.code === "ER_DUP_ENTRY"){
      return res.status(409).json({
        success: false,
        error: "Vessel code or IMO number already exists"
      });
    }

    res.status(500).json({
      success: false,
      error: "Unable to update vessel"
    });
  }
});

/*
 * PATCH /api/vessels/:id/retire
 *
 * Retires one vessel without deleting its historical records.
 */
router.patch("/:id/retire", async (req, res) => {
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
        id,
        vessel_code,
        name,
        status
      FROM vessels
      WHERE id = ?
      LIMIT 1
    `, [vesselId]);

    if(rows.length === 0){
      return res.status(404).json({
        success: false,
        error: "Vessel not found"
      });
    }

    const vessel = rows[0];

    if(vessel.status === "retired"){
      return res.status(409).json({
        success: false,
        error: "Vessel is already retired"
      });
    }

    await pool.query(`
      UPDATE vessels
      SET status = 'retired'
      WHERE id = ?
    `, [vesselId]);

    const [updatedRows] = await pool.query(`
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
      LIMIT 1
    `, [vesselId]);

    const updatedVessel = updatedRows[0];

    res.json({
      success: true,
      message: "Vessel retired successfully",
      data: {
        id: Number(updatedVessel.id),
        vesselCode: updatedVessel.vessel_code,
        name: updatedVessel.name,
        vesselType: updatedVessel.vessel_type,
        flagCountry: updatedVessel.flag_country,
        imoNumber: updatedVessel.imo_number,
        callSign: updatedVessel.call_sign,
        capacityTons: Number(updatedVessel.capacity_tons),
        status: updatedVessel.status,
        commissionedDate: updatedVessel.commissioned_date
          ? String(updatedVessel.commissioned_date).slice(0, 10)
          : null,
        homePort: updatedVessel.home_port_id
          ? {
              id: Number(updatedVessel.home_port_id),
              name: updatedVessel.home_port_name,
              country: updatedVessel.home_port_country,
              code: updatedVessel.home_port_code
            }
          : null,
        createdAt: updatedVessel.created_at,
        updatedAt: updatedVessel.updated_at
      }
    });

  } catch (error) {
    console.error("Retire vessel API error:", error);

    res.status(500).json({
      success: false,
      error: "Unable to retire vessel"
    });
  }
});

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
        vp.recorded_at,
        v.vessel_code,
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
        latitude: Number(position.latitude),
        longitude: Number(position.longitude),
        speedKnots: Number(position.speed_knots),
        headingDegrees: Number(position.heading_degrees),
        recordedAt: position.recorded_at
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("Vessel position API error:", error);

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
    console.error("Vessel detail API error:", error);

    res.status(500).json({
      success: false,
      error: "Unable to load vessel"
    });
  }
});

module.exports = router;
