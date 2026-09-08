const express = require("express");
const pool = require("../db");
const { requireRole } = require("../middleware/auth");
const logger = require("../lib/logger");

const router = express.Router();

router.patch("/:id/retire", requireRole("super_admin", "admin"), async (req, res) => {
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
    logger.error({ err: error }, "Retire vessel API error");

    res.status(500).json({
      success: false,
      error: "Unable to retire vessel"
    });
  }
});


module.exports = router;
