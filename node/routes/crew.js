const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        c.id,
        c.user_id,
        c.vessel_id,
        c.employee_code,
        c.full_name,
        c.position,
        c.phone,
        c.certification,
        c.status,
        c.joined_at,

        v.vessel_code,
        v.name AS vessel_name,
        v.vessel_type,
        v.status AS vessel_status

      FROM crew_members c

      LEFT JOIN vessels v
        ON v.id = c.vessel_id

      ORDER BY
        CASE c.status
          WHEN 'active' THEN 1
          WHEN 'on_leave' THEN 2
          WHEN 'inactive' THEN 3
          ELSE 4
        END,
        c.full_name ASC,
        c.id ASC
    `);

    const summary = {
      totalCrew: rows.length,
      active: 0,
      onLeave: 0,
      inactive: 0,
      assignedVessels: 0
    };

    const assignedVesselIds = new Set();

    rows.forEach(row => {
      if(row.status === "active") summary.active++;
      if(row.status === "on_leave") summary.onLeave++;
      if(row.status === "inactive") summary.inactive++;

      if(row.vessel_id !== null){
        assignedVesselIds.add(Number(row.vessel_id));
      }
    });

    summary.assignedVessels = assignedVesselIds.size;

    const crew = rows.map(row => ({
      id: Number(row.id),
      userId: row.user_id === null ? null : Number(row.user_id),
      vesselId: row.vessel_id === null ? null : Number(row.vessel_id),
      employeeCode: row.employee_code,
      fullName: row.full_name,
      position: row.position,
      phone: row.phone,
      certification: row.certification,
      status: row.status,
      joinedAt: row.joined_at,

      vesselCode: row.vessel_code,
      vesselName: row.vessel_name,
      vesselType: row.vessel_type,
      vesselStatus: row.vessel_status
    }));

    res.json({
      success: true,
      data: {
        summary,
        crew
      },
      generatedAt: new Date().toISOString()
    });

  } catch(error) {
    console.error("Crew API error:", error);

    res.status(500).json({
      success: false,
      error: "Unable to load crew data"
    });
  }
});

module.exports = router;
