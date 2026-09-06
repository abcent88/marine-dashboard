const crypto = require("crypto");
const logger = require("../lib/logger");

function safeCompare(a, b) {
  const aBuffer = Buffer.from(String(a || ""), "utf8");
  const bBuffer = Buffer.from(String(b || ""), "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function requireAisIngestKey(req, res, next) {
  const configuredKey = process.env.AIS_INGEST_API_KEY;

  if (!configuredKey) {
    logger.error("AIS ingestion API key is not configured");

    return res.status(503).json({
      success: false,
      error: "AIS ingestion service is not configured"
    });
  }

  const suppliedKey =
    req.get("x-ais-api-key") ||
    req.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!suppliedKey || !safeCompare(suppliedKey, configuredKey)) {
    logger.warn({
      method: req.method,
      path: req.originalUrl
    }, "Rejected AIS ingestion authentication");

    return res.status(401).json({
      success: false,
      error: "AIS ingestion authentication required"
    });
  }

  next();
}

module.exports = {
  requireAisIngestKey
};
