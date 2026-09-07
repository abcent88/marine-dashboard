const express = require("express");
const pool = require("../db");
const logger = require("../lib/logger");

const router = express.Router();

router.get("/summary", async (req, res) => {
  try {
    const [
      [fleetRows],
      [catchRows],
      [speciesRows],
      [catchVesselRows],
      [fuelRows],
      [fuelVesselRows],
      [voyageRows],
      [maintenanceRows],
      [maintenanceVesselRows],
      [alertRows],
      [crewRows],
      [dailyRows]
    ] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total_vessels,
          COALESCE(SUM(status = 'active'), 0) AS active_vessels,
          COALESCE(SUM(status = 'restricted'), 0) AS restricted_vessels,
          COALESCE(SUM(status = 'maintenance'), 0) AS maintenance_vessels,
          COALESCE(SUM(status = 'out_of_service'), 0) AS out_of_service_vessels,
          COALESCE(SUM(capacity_tons), 0) AS total_capacity_tons
        FROM vessels
        WHERE status <> 'retired'
      `),

      pool.query(`
        SELECT
          COALESCE(SUM(quantity_kg), 0) AS total_catch_kg,
          COUNT(*) AS record_count,
          COUNT(DISTINCT species) AS species_count,
          COUNT(DISTINCT vessel_id) AS vessels_reporting
        FROM catch_records
      `),

      pool.query(`
        SELECT
          species,
          COALESCE(SUM(quantity_kg), 0) AS quantity_kg,
          COUNT(*) AS record_count
        FROM catch_records
        GROUP BY species
        ORDER BY quantity_kg DESC
      `),

      pool.query(`
        SELECT
          c.vessel_id,
          v.vessel_code,
          v.name AS vessel_name,
          COALESCE(SUM(c.quantity_kg), 0) AS quantity_kg,
          COUNT(*) AS record_count
        FROM catch_records c
        LEFT JOIN vessels v ON v.id = c.vessel_id
        GROUP BY c.vessel_id, v.vessel_code, v.name
        ORDER BY quantity_kg DESC
      `),

      pool.query(`
        SELECT
          COALESCE(SUM(quantity_liters), 0) AS total_fuel_liters,
          COUNT(*) AS record_count,
          COUNT(DISTINCT vessel_id) AS vessels_reporting
        FROM vessel_fuel_logs
      `),

      pool.query(`
        SELECT
          f.vessel_id,
          v.vessel_code,
          v.name AS vessel_name,
          COALESCE(SUM(f.quantity_liters), 0) AS fuel_liters,
          COUNT(*) AS record_count
        FROM vessel_fuel_logs f
        LEFT JOIN vessels v ON v.id = f.vessel_id
        GROUP BY f.vessel_id, v.vessel_code, v.name
        ORDER BY fuel_liters DESC
      `),

      pool.query(`
        SELECT
          COUNT(*) AS total_voyages,
          COALESCE(SUM(status = 'planned'), 0) AS planned,
          COALESCE(SUM(status = 'in_progress'), 0) AS in_progress,
          COALESCE(SUM(status = 'completed'), 0) AS completed,
          COALESCE(SUM(status = 'cancelled'), 0) AS cancelled
        FROM voyages
      `),

      pool.query(`
        SELECT
          COUNT(*) AS total_records,
          COALESCE(SUM(status = 'scheduled'), 0) AS scheduled,
          COALESCE(SUM(status = 'in_progress'), 0) AS in_progress,
          COALESCE(SUM(status = 'completed'), 0) AS completed,
          COALESCE(SUM(status = 'cancelled'), 0) AS cancelled,
          COALESCE(SUM(cost), 0) AS total_cost
        FROM maintenance_records
      `),

      pool.query(`
        SELECT
          m.vessel_id,
          v.vessel_code,
          v.name AS vessel_name,
          COUNT(*) AS record_count,
          COALESCE(SUM(m.cost), 0) AS total_cost
        FROM maintenance_records m
        LEFT JOIN vessels v ON v.id = m.vessel_id
        GROUP BY m.vessel_id, v.vessel_code, v.name
        ORDER BY total_cost DESC
      `),

      pool.query(`
        SELECT
          COUNT(*) AS total_alerts,
          COALESCE(SUM(status = 'open'), 0) AS open_alerts,
          COALESCE(SUM(status = 'acknowledged'), 0) AS acknowledged_alerts,
          COALESCE(SUM(status = 'resolved'), 0) AS resolved_alerts,
          COALESCE(SUM(severity = 'critical'), 0) AS critical_alerts,
          COALESCE(SUM(severity = 'warning'), 0) AS warning_alerts,
          COALESCE(SUM(severity = 'info'), 0) AS info_alerts
        FROM alerts
      `),

      pool.query(`
        SELECT
          COUNT(*) AS total_crew,
          COALESCE(SUM(status = 'active'), 0) AS active_crew,
          COALESCE(SUM(status = 'on_leave'), 0) AS on_leave,
          COALESCE(SUM(status = 'inactive'), 0) AS inactive_crew,
          COUNT(DISTINCT vessel_id) AS assigned_vessels
        FROM crew_members
      `),

      pool.query(`
        SELECT
          DATE_FORMAT(metric_date, '%Y-%m-%d') AS metric_date,
          sales_amount,
          capture_kg,
          target_capture_kg,
          active_vessels,
          fuel_consumed_liters,
          performance_percent
        FROM daily_metrics
        ORDER BY metric_date DESC
        LIMIT 30
      `)
    ]);

    const fleet = fleetRows[0] || {};
    const catchSummary = catchRows[0] || {};
    const fuelSummary = fuelRows[0] || {};
    const voyages = voyageRows[0] || {};
    const maintenance = maintenanceRows[0] || {};
    const alerts = alertRows[0] || {};
    const crew = crewRows[0] || {};

    const totalCatchKg = Number(catchSummary.total_catch_kg || 0);
    const totalFuelLiters = Number(fuelSummary.total_fuel_liters || 0);
    const targetKg = Number(dailyRows[0]?.target_capture_kg || 0);

    const catchProgressPercent = targetKg > 0
      ? Number(((totalCatchKg / targetKg) * 100).toFixed(1))
      : 0;

    const catchPerLiterKg = totalFuelLiters > 0
      ? Number((totalCatchKg / totalFuelLiters).toFixed(2))
      : 0;

    res.json({
      success: true,
      data: {
        fleet: {
          total: Number(fleet.total_vessels || 0),
          active: Number(fleet.active_vessels || 0),
          restricted: Number(fleet.restricted_vessels || 0),
          maintenance: Number(fleet.maintenance_vessels || 0),
          outOfService: Number(fleet.out_of_service_vessels || 0),
          totalCapacityTons: Number(fleet.total_capacity_tons || 0)
        },

        production: {
          totalCatchKg,
          targetKg,
          catchProgressPercent,
          recordCount: Number(catchSummary.record_count || 0),
          speciesCount: Number(catchSummary.species_count || 0),
          vesselsReporting: Number(catchSummary.vessels_reporting || 0),
          catchPerLiterKg,
          bySpecies: speciesRows.map(row => ({
            species: row.species,
            quantityKg: Number(row.quantity_kg || 0),
            recordCount: Number(row.record_count || 0)
          })),
          byVessel: catchVesselRows.map(row => ({
            vesselId: row.vessel_id === null ? null : Number(row.vessel_id),
            vesselCode: row.vessel_code,
            vesselName: row.vessel_name || "Unassigned",
            quantityKg: Number(row.quantity_kg || 0),
            recordCount: Number(row.record_count || 0)
          }))
        },

        fuel: {
          totalLiters: totalFuelLiters,
          recordCount: Number(fuelSummary.record_count || 0),
          vesselsReporting: Number(fuelSummary.vessels_reporting || 0),
          byVessel: fuelVesselRows.map(row => ({
            vesselId: row.vessel_id === null ? null : Number(row.vessel_id),
            vesselCode: row.vessel_code,
            vesselName: row.vessel_name || "Unassigned",
            fuelLiters: Number(row.fuel_liters || 0),
            recordCount: Number(row.record_count || 0)
          }))
        },

        voyages: {
          total: Number(voyages.total_voyages || 0),
          planned: Number(voyages.planned || 0),
          inProgress: Number(voyages.in_progress || 0),
          completed: Number(voyages.completed || 0),
          cancelled: Number(voyages.cancelled || 0)
        },

        maintenance: {
          totalRecords: Number(maintenance.total_records || 0),
          scheduled: Number(maintenance.scheduled || 0),
          inProgress: Number(maintenance.in_progress || 0),
          completed: Number(maintenance.completed || 0),
          cancelled: Number(maintenance.cancelled || 0),
          totalCost: Number(maintenance.total_cost || 0),
          byVessel: maintenanceVesselRows.map(row => ({
            vesselId: row.vessel_id === null ? null : Number(row.vessel_id),
            vesselCode: row.vessel_code,
            vesselName: row.vessel_name || "Unassigned",
            recordCount: Number(row.record_count || 0),
            totalCost: Number(row.total_cost || 0)
          }))
        },

        alerts: {
          total: Number(alerts.total_alerts || 0),
          open: Number(alerts.open_alerts || 0),
          acknowledged: Number(alerts.acknowledged_alerts || 0),
          resolved: Number(alerts.resolved_alerts || 0),
          critical: Number(alerts.critical_alerts || 0),
          warning: Number(alerts.warning_alerts || 0),
          info: Number(alerts.info_alerts || 0)
        },

        crew: {
          total: Number(crew.total_crew || 0),
          active: Number(crew.active_crew || 0),
          onLeave: Number(crew.on_leave || 0),
          inactive: Number(crew.inactive_crew || 0),
          assignedVessels: Number(crew.assigned_vessels || 0)
        },

        dailyMetrics: dailyRows.map(row => ({
          metricDate: row.metric_date,
          salesAmount: Number(row.sales_amount || 0),
          captureKg: Number(row.capture_kg || 0),
          targetCaptureKg: Number(row.target_capture_kg || 0),
          activeVessels: Number(row.active_vessels || 0),
          fuelConsumedLiters: Number(row.fuel_consumed_liters || 0),
          performancePercent: Number(row.performance_percent || 0)
        }))
      },

      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ err: error }, "Reports summary error");

    res.status(500).json({
      success: false,
      error: "Unable to generate reports summary"
    });
  }
});

module.exports = router;
