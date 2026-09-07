const express = require("express");
const pool = require("../db");
const logger = require("../lib/logger");

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
        COALESCE(SUM(capacity_tons), 0) AS total_capacity_tons,
        COALESCE(SUM(CASE WHEN status = "active" THEN capacity_tons ELSE 0 END), 0) AS active_capacity_tons
      FROM vessels
      WHERE status <> 'retired'
    `);

    const [dailyMetricRows] = await pool.query(`
      SELECT
        DATE_FORMAT(metric_date, "%Y-%m-%d") AS metric_date,
        sales_amount,
        capture_kg,
        target_capture_kg,
        active_vessels,
        fuel_consumed_liters,
        performance_percent
      FROM daily_metrics
      ORDER BY metric_date DESC
      LIMIT 1
    `);

    const [todayMetricRows] = await pool.query(`
      SELECT
        DATE_FORMAT(metric_date, "%Y-%m-%d") AS metric_date,
        sales_amount,
        capture_kg,
        target_capture_kg,
        active_vessels,
        fuel_consumed_liters,
        performance_percent
      FROM daily_metrics
      WHERE metric_date = CURDATE()
      LIMIT 1
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

    const [todaySpeciesRows] = await pool.query(`
      SELECT
        species,
        COALESCE(SUM(quantity_kg), 0) AS quantity_kg,
        COUNT(*) AS record_count
      FROM catch_records
      WHERE DATE(recorded_at) = CURDATE()
      GROUP BY species
      ORDER BY quantity_kg DESC
    `);

    const [alertRows] = await pool.query(`
      SELECT COUNT(*) AS open_alerts
      FROM alerts
      WHERE status = 'open'
    `);

    const [trackingRows] = await pool.query(`
      SELECT
        id,
        vessel_id,
        vessel_code,
        vessel_name,
        latitude,
        longitude,
        speed_knots,
        heading_degrees,
        position_source,
        source_timestamp,
        recorded_at
      FROM (
        SELECT
          vp.id,
          vp.vessel_id,
          v.vessel_code,
          v.name AS vessel_name,
          vp.latitude,
          vp.longitude,
          vp.speed_knots,
          vp.heading_degrees,
          vp.position_source,
          vp.source_timestamp,
          vp.recorded_at,
          ROW_NUMBER() OVER (
            PARTITION BY vp.vessel_id
            ORDER BY vp.recorded_at DESC, vp.id DESC
          ) AS position_rank
        FROM vessel_positions vp
        INNER JOIN vessels v ON v.id = vp.vessel_id
        WHERE v.status <> 'retired'
      ) latest_positions
      WHERE position_rank = 1
      ORDER BY recorded_at DESC, id DESC
    `);

    const vessel = vesselRows[0];
    const captureKg = Number(catchRows[0].capture_kg || 0);
    const fuelConsumedLiters = Number(fuelRows[0].fuel_consumed_liters || 0);
    const openAlerts = Number(alertRows[0].open_alerts || 0);

    const tracking = {
      trackedVessels: trackingRows.length,
      positions: trackingRows.map(row => ({
        id: Number(row.id),
        vesselId: Number(row.vessel_id),
        vesselCode: row.vessel_code,
        vesselName: row.vessel_name,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        speedKnots: Number(row.speed_knots || 0),
        headingDegrees: Number(row.heading_degrees || 0),
        positionSource: row.position_source,
        sourceTimestamp: row.source_timestamp,
        recordedAt: row.recorded_at
      }))
    };

    res.json({
      success: true,
      data: {
        vessels: {
          total: Number(vessel.total_vessels),
          active: Number(vessel.active_vessels),
          restricted: Number(vessel.restricted_vessels),
          maintenance: Number(vessel.maintenance_vessels),
          outOfService: Number(vessel.out_of_service_vessels),
          totalCapacityTons: Number(vessel.total_capacity_tons),
          activeCapacityTons: Number(vessel.active_capacity_tons)
        },
        operations: {
          captureKg,
          fuelConsumedLiters,
          openAlerts
        },
        todaySpeciesBreakdown: todaySpeciesRows.map(row => ({
          species: row.species || "Unknown",
          quantityKg: Number(row.quantity_kg || 0),
          recordCount: Number(row.record_count || 0)
        })),
        tracking,
        dailyMetric: dailyMetricRows.length > 0 ? {
          metricDate: dailyMetricRows[0].metric_date,
          salesAmount: Number(dailyMetricRows[0].sales_amount || 0),
          captureKg: Number(dailyMetricRows[0].capture_kg || 0),
          targetCaptureKg: Number(dailyMetricRows[0].target_capture_kg || 0),
          activeVessels: Number(dailyMetricRows[0].active_vessels || 0),
          fuelConsumedLiters: Number(dailyMetricRows[0].fuel_consumed_liters || 0),
          performancePercent: Number(dailyMetricRows[0].performance_percent || 0)
        } : null,
        todayMetric: todayMetricRows.length > 0 ? {
          metricDate: todayMetricRows[0].metric_date,
          salesAmount: Number(todayMetricRows[0].sales_amount || 0),
          captureKg: Number(todayMetricRows[0].capture_kg || 0),
          targetCaptureKg: Number(todayMetricRows[0].target_capture_kg || 0),
          activeVessels: Number(todayMetricRows[0].active_vessels || 0),
          fuelConsumedLiters: Number(todayMetricRows[0].fuel_consumed_liters || 0),
          performancePercent: Number(todayMetricRows[0].performance_percent || 0)
        } : null,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error({ err: error }, "Dashboard summary error");

    res.status(500).json({
      success: false,
      error: "Unable to load dashboard summary"
    });
  }
});

module.exports = router;
