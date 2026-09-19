const express = require("express");
const pool = require("../db");
const logger = require("../lib/logger");

const router = express.Router();

/*
 * GET /api/ports
 *
 * Returns available ports for voyage and charter forms.
 */
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        name,
        country,
        code
      FROM ports
      ORDER BY name ASC
    `);

    const ports = rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      country: row.country,
      code: row.code
    }));

    return res.json({
      success: true,
      count: ports.length,
      data: ports,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ err: error }, "Ports API error");

    return res.status(500).json({
      success: false,
      error: "Unable to load ports"
    });
  }
});

module.exports = router;
