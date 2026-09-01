const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/summary", async (req, res) => {
  try {
    const [vesselRows] = await pool.query(`
      SELECT
        COUNT(*) AS total_vessels,
        COALESCE(SUM(status = 'active'), 0) AS active_vessels,
        COALESCE(SUM(status = 'restricted'), 0) AS restricted_vessels,
        COALESCE(SUM(status = 'maintenance'), 0) AS maintenance_vessels,
        COALESCE(SUM(status = 'out_of_service'), 0) AS out_of_service_vessels,
        COALESCE(SUM(capacity_tons), 0) AS total_capacity_tons
      FROM vessels
      WHERE status <> 'retired'
    `);

    const [catchRows] = await pool.query(`
      SELECT
        COALESCE(SUM(quantity_kg), 0) AS capture_kg
      FROM catch_records
      WHERE DATE(recorded_at) = CURDATE()
    `);

    const [fuelRows] = await pool.query(`
      SELECT
        COALESCE(SUM(quantity_liters), 0) AS fuel_consumed_liters
      FROM vessel_fuel_logs
      WHERE DATE(recorded_at) = CURDATE()
    `);

    const [alertRows] = await pool.query(`
      SELECT COUNT(*) AS open_alerts
      FROM alerts
      WHERE status = 'open'
    `);

    const vessel = vesselRows[0];
    const captureKg = Number(catchRows[0].capture_kg || 0);
    const fuelConsumedLiters = Number(fuelRows[0].fuel_consumed_liters || 0);
    const openAlerts = Number(alertRows[0].open_alerts || 0);

    res.json({
      success: true,
      data: {
        vessels: {
          total: Number(vessel.total_vessels),
          active: Number(vessel.active_vessels),
          restricted: Number(vessel.restricted_vessels),
          maintenance: Number(vessel.maintenance_vessels),
          outOfService: Number(vessel.out_of_service_vessels),
          totalCapacityTons: Number(vessel.total_capacity_tons)
        },
        operations: {
          captureKg,
          fuelConsumedLiters,
          openAlerts
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);

    res.status(500).json({
      success: false,
      error: "Unable to load dashboard summary"
    });
  }
});

module.exports = router;
