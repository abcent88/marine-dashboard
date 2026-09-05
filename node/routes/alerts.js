const express = require("express");
const pool = require("../db");
const logger = require("../lib/logger");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        a.id,
        a.vessel_id,
        a.alert_type,
        a.severity,
        a.title,
        a.message,
        a.status,
        a.created_at,
        a.acknowledged_at,
        a.resolved_at,

        v.vessel_code,
        v.name AS vessel_name,
        v.vessel_type,
        v.status AS vessel_status

      FROM alerts a

      LEFT JOIN vessels v
        ON v.id = a.vessel_id

      ORDER BY
        CASE a.status
          WHEN 'open' THEN 1
          WHEN 'acknowledged' THEN 2
          WHEN 'resolved' THEN 3
          ELSE 4
        END,
        CASE a.severity
          WHEN 'critical' THEN 1
          WHEN 'warning' THEN 2
          WHEN 'info' THEN 3
          ELSE 4
        END,
        a.created_at DESC,
        a.id DESC
    `);

    const summary = {
      totalAlerts: rows.length,
      open: 0,
      acknowledged: 0,
      resolved: 0,
      info: 0,
      warning: 0,
      critical: 0
    };

    rows.forEach(row => {
      if(row.status === "open") summary.open++;
      if(row.status === "acknowledged") summary.acknowledged++;
      if(row.status === "resolved") summary.resolved++;

      if(row.severity === "info") summary.info++;
      if(row.severity === "warning") summary.warning++;
      if(row.severity === "critical") summary.critical++;
    });

    const alerts = rows.map(row => ({
      id: Number(row.id),
      vesselId: row.vessel_id === null ? null : Number(row.vessel_id),
      vesselCode: row.vessel_code,
      vesselName: row.vessel_name,
      vesselType: row.vessel_type,
      vesselStatus: row.vessel_status,
      alertType: row.alert_type,
      severity: row.severity,
      title: row.title,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at
    }));

    res.json({
      success: true,
      data: {
        summary,
        alerts
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ err: error }, "Alerts API error");

    res.status(500).json({
      success: false,
      error: "Unable to load alerts data"
    });
  }
});

module.exports = router;
