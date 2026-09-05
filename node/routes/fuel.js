const express = require("express");
const pool = require("../db");
const logger = require("../lib/logger");

const router = express.Router();

/*
 * GET /api/fuel
 *
 * Returns fuel consumption records with vessel information.
 */
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        f.id,
        f.vessel_id,
        f.fuel_type,
        f.quantity_liters,
        f.recorded_at,
        f.notes,

        v.vessel_code,
        v.name AS vessel_name,
        v.vessel_type

      FROM vessel_fuel_logs f

      INNER JOIN vessels v
        ON v.id = f.vessel_id

      WHERE v.status <> 'retired'

      ORDER BY
        f.recorded_at DESC,
        f.id DESC
    `);

    const totalFuelLiters = rows.reduce(
      (total, row) =>
        total + Number(row.quantity_liters || 0),
      0
    );

    const byVessel = {};

    rows.forEach(row => {
      const vesselId = Number(row.vessel_id);

      if(!byVessel[vesselId]){
        byVessel[vesselId] = {
          vesselId,
          vesselCode: row.vessel_code,
          vesselName: row.vessel_name,
          vesselType: row.vessel_type,
          totalLiters: 0,
          records: 0
        };
      }

      byVessel[vesselId].totalLiters +=
        Number(row.quantity_liters || 0);

      byVessel[vesselId].records++;
    });

    const fuel = rows.map(row => ({
      id: Number(row.id),
      vesselId: Number(row.vessel_id),
      vesselCode: row.vessel_code,
      vesselName: row.vessel_name,
      vesselType: row.vessel_type,
      fuelType: row.fuel_type,
      quantityLiters: Number(row.quantity_liters),
      recordedAt: row.recorded_at,
      notes: row.notes
    }));

    res.json({
      success: true,
      data: {
        summary: {
          totalLiters: totalFuelLiters,
          recordCount: fuel.length
        },
        byVessel: Object.values(byVessel),
        records: fuel
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ err: error }, "Fuel API error");

    res.status(500).json({
      success: false,
      error: "Unable to load fuel data"
    });
  }
});

module.exports = router;
