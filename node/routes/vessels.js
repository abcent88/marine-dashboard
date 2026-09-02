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
        v.commissioned_date,
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
      commissionedDate: vessel.commissioned_date,
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
        v.commissioned_date,
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
        commissionedDate: vessel.commissioned_date,
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
