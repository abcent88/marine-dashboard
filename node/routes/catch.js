const express = require("express");
const pool = require("../db");
const logger = require("../lib/logger");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        c.id,
        c.vessel_id,
        c.voyage_id,
        c.species,
        c.quantity_kg,
        c.recorded_at,
        c.location_latitude,
        c.location_longitude,
        c.notes,

        v.vessel_code,
        v.name AS vessel_name,

        voy.voyage_number,
        voy.status AS voyage_status

      FROM catch_records c

      LEFT JOIN vessels v
        ON v.id = c.vessel_id

      LEFT JOIN voyages voy
        ON voy.id = c.voyage_id

      ORDER BY
        c.recorded_at DESC,
        c.id DESC
    `);

    const totalCatchKg = rows.reduce(
      (total, row) => total + Number(row.quantity_kg || 0),
      0
    );

    const speciesMap = new Map();
    const vesselMap = new Map();

    rows.forEach(row => {
      const quantityKg = Number(row.quantity_kg || 0);

      const speciesKey = row.species || "Unknown";
      const existingSpecies = speciesMap.get(speciesKey) || {
        species: speciesKey,
        quantityKg: 0,
        recordCount: 0
      };

      existingSpecies.quantityKg += quantityKg;
      existingSpecies.recordCount += 1;
      speciesMap.set(speciesKey, existingSpecies);

      const vesselKey = row.vessel_id === null
        ? "unassigned"
        : Number(row.vessel_id);

      const existingVessel = vesselMap.get(vesselKey) || {
        vesselId: row.vessel_id === null ? null : Number(row.vessel_id),
        vesselCode: row.vessel_code || null,
        vesselName: row.vessel_name || "Unassigned",
        quantityKg: 0,
        recordCount: 0
      };

      existingVessel.quantityKg += quantityKg;
      existingVessel.recordCount += 1;
      vesselMap.set(vesselKey, existingVessel);
    });

    const targetKg = 15000;
    const targetProgressPercent = targetKg > 0
      ? Number(((totalCatchKg / targetKg) * 100).toFixed(1))
      : 0;

    const catchData = rows.map(row => ({
      id: Number(row.id),
      vesselId: row.vessel_id === null ? null : Number(row.vessel_id),
      voyageId: row.voyage_id === null ? null : Number(row.voyage_id),
      vesselCode: row.vessel_code,
      vesselName: row.vessel_name,
      voyageNumber: row.voyage_number,
      voyageStatus: row.voyage_status,
      species: row.species,
      quantityKg: Number(row.quantity_kg),
      recordedAt: row.recorded_at,
      latitude: row.location_latitude === null
        ? null
        : Number(row.location_latitude),
      longitude: row.location_longitude === null
        ? null
        : Number(row.location_longitude),
      notes: row.notes
    }));

    const speciesBreakdown = Array.from(speciesMap.values())
      .sort((a, b) => b.quantityKg - a.quantityKg);

    const vesselBreakdown = Array.from(vesselMap.values())
      .sort((a, b) => b.quantityKg - a.quantityKg);

    res.json({
      success: true,
      data: {
        summary: {
          totalCatchKg,
          targetKg,
          targetProgressPercent,
          recordCount: rows.length,
          speciesCount: speciesBreakdown.length,
          vesselsReporting: vesselBreakdown.length
        },
        speciesBreakdown,
        vesselBreakdown,
        catches: catchData
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ err: error }, "Catch API error");

    res.status(500).json({
      success: false,
      error: "Unable to load catch data"
    });
  }
});

module.exports = router;
