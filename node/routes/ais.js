const express = require("express");
const { requireAisIngestKey } = require("../middleware/aisAuth");
const logger = require("../lib/logger");
const {
  AisIngestionError,
  ingestPosition
} = require("../services/aisIngestion");

const router = express.Router();

router.post("/positions", requireAisIngestKey, async (req, res) => {
  try {
    const position = await ingestPosition(req.body);

    res.status(position.duplicate ? 200 : 201).json({
      success: true,
      message: position.duplicate
        ? "Position already recorded"
        : "Position recorded successfully",
      data: position,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof AisIngestionError) {
      return res.status(error.status).json({
        success: false,
        error: error.message
      });
    }

    logger.error({ err: error }, "AIS/GPS position ingestion error");

    res.status(500).json({
      success: false,
      error: "Unable to record AIS/GPS position"
    });
  }
});

module.exports = router;
