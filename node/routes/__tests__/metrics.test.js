jest.mock("../../lib/metrics", () => ({
  getCounters: jest.fn()
}));

const express = require("express");
const request = require("supertest");
const metrics = require("../../lib/metrics");
const metricsRoutes = require("../metrics");

describe("Metrics routes", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use("/metrics", metricsRoutes);
  });

  test("returns current metrics counters", async () => {
    metrics.getCounters.mockReturnValue({
      "ais.ingestion.received": 10,
      "ais.ingestion.accepted": 7,
      "ais.ingestion.duplicates": 2,
      "ais.ingestion.rejected": 1,
      "ais.ingestion.errors": 0
    });

    const response = await request(app).get("/metrics");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      "ais.ingestion.received": 10,
      "ais.ingestion.accepted": 7,
      "ais.ingestion.duplicates": 2,
      "ais.ingestion.rejected": 1,
      "ais.ingestion.errors": 0
    });
    expect(response.body.time).toEqual(expect.any(String));
    expect(metrics.getCounters).toHaveBeenCalledTimes(1);
  });

  test("returns an empty data object when no counters exist", async () => {
    metrics.getCounters.mockReturnValue({});

    const response = await request(app).get("/metrics");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {},
      time: expect.any(String)
    });
  });
});
