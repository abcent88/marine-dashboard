const express = require("express");
const pool = require("../db");
const logger = require("../lib/logger");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        m.id,
        m.vessel_id,
        m.title,
        m.description,
        m.maintenance_type,
        m.status,
        m.priority,
        m.scheduled_at,
        m.completed_at,
        m.cost,
        v.vessel_code,
        v.name AS vessel_name,
        v.vessel_type,
        v.status AS vessel_status
      FROM maintenance_records m
      INNER JOIN vessels v
        ON v.id = m.vessel_id
      WHERE v.status <> 'retired'
      ORDER BY
        CASE m.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        CASE m.status
          WHEN 'in_progress' THEN 1
          WHEN 'scheduled' THEN 2
          WHEN 'completed' THEN 3
          WHEN 'cancelled' THEN 4
          ELSE 5
        END,
        m.scheduled_at ASC,
        m.id DESC
    `);

    const totalCost = rows.reduce(
      (total, row) => total + Number(row.cost || 0),
      0
    );

    const summary = {
      totalRecords: rows.length,
      scheduled: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      lowPriority: 0,
      mediumPriority: 0,
      highPriority: 0,
      criticalPriority: 0,
      totalCost
    };

    rows.forEach(row => {
      if(row.status === "scheduled") summary.scheduled++;
      if(row.status === "in_progress") summary.inProgress++;
      if(row.status === "completed") summary.completed++;
      if(row.status === "cancelled") summary.cancelled++;

      if(row.priority === "low") summary.lowPriority++;
      if(row.priority === "medium") summary.mediumPriority++;
      if(row.priority === "high") summary.highPriority++;
      if(row.priority === "critical") summary.criticalPriority++;
    });

    const maintenance = rows.map(row => ({
      id: Number(row.id),
      vesselId: Number(row.vessel_id),
      vesselCode: row.vessel_code,
      vesselName: row.vessel_name,
      vesselType: row.vessel_type,
      vesselStatus: row.vessel_status,
      title: row.title,
      description: row.description,
      maintenanceType: row.maintenance_type,
      status: row.status,
      priority: row.priority,
      scheduledAt: row.scheduled_at,
      completedAt: row.completed_at,
      cost: Number(row.cost || 0)
    }));

    res.json({
      success: true,
      data: {
        summary,
        records: maintenance
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ err: error }, "Maintenance API error");

    res.status(500).json({
      success: false,
      error: "Unable to load maintenance data"
    });
  }
});

module.exports = router;
