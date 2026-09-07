const express = require("express");
const metrics = require("../lib/metrics");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    data: metrics.getCounters(),
    time: new Date().toISOString()
  });
});

module.exports = router;
