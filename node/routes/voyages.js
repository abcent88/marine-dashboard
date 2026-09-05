const express = require("express");
const pool = require("../db");
const logger = require("../lib/logger");

const router = express.Router();

/*
 * GET /api/voyages
 *
 * Returns voyages with vessel and port information.
 */
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        vo.id,
        vo.vessel_id,
        vo.voyage_number,
        vo.status,
        vo.departure_at,
        vo.expected_arrival_at,
        vo.actual_arrival_at,

        v.vessel_code,
        v.name AS vessel_name,
        v.vessel_type,

        dp.code AS departure_port_code,
        dp.name AS departure_port_name,
        dp.country AS departure_port_country,

        ap.code AS destination_port_code,
        ap.name AS destination_port_name,
        ap.country AS destination_port_country

      FROM voyages vo

      INNER JOIN vessels v
        ON v.id = vo.vessel_id

      LEFT JOIN ports dp
        ON dp.id = vo.departure_port_id

      LEFT JOIN ports ap
        ON ap.id = vo.destination_port_id

      WHERE v.status <> 'retired'

      ORDER BY
        CASE vo.status
          WHEN 'in_progress' THEN 1
          WHEN 'planned' THEN 2
          WHEN 'completed' THEN 3
          WHEN 'cancelled' THEN 4
          ELSE 5
        END,
        vo.expected_arrival_at ASC,
        vo.id ASC
    `);

    const voyages = rows.map(voyage => ({
      id: Number(voyage.id),
      vesselId: Number(voyage.vessel_id),
      voyageNumber: voyage.voyage_number,
      status: voyage.status,

      vessel: {
        id: Number(voyage.vessel_id),
        code: voyage.vessel_code,
        name: voyage.vessel_name,
        type: voyage.vessel_type
      },

      departurePort: voyage.departure_port_name
        ? {
            code: voyage.departure_port_code,
            name: voyage.departure_port_name,
            country: voyage.departure_port_country
          }
        : null,

      destinationPort: voyage.destination_port_name
        ? {
            code: voyage.destination_port_code,
            name: voyage.destination_port_name,
            country: voyage.destination_port_country
          }
        : null,

      departureAt: voyage.departure_at,
      expectedArrivalAt: voyage.expected_arrival_at,
      actualArrivalAt: voyage.actual_arrival_at
    }));

    res.json({
      success: true,
      data: voyages,
      count: voyages.length,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ err: error }, "Voyages API error");

    res.status(500).json({
      success: false,
      error: "Unable to load voyages"
    });
  }
});

module.exports = router;
