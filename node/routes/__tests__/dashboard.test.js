const express = require("express");
const request = require("supertest");

jest.mock("../../db", () => ({
  query: jest.fn()
}));

jest.mock("../../lib/logger", () => ({
  error: jest.fn()
}));

const pool = require("../../db");
const logger = require("../../lib/logger");
const dashboardRoutes = require("../dashboard");

const app = express();

app.use(express.json());
app.use("/api/dashboard", dashboardRoutes);

describe("Dashboard routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/dashboard/summary returns dashboard summary", async () => {
    pool.query
      .mockResolvedValueOnce([
        [
          {
            total_vessels: "10",
            active_vessels: "6",
            restricted_vessels: "1",
            maintenance_vessels: "2",
            out_of_service_vessels: "1",
            total_capacity_tons: "2500.50"
          }
        ]
      ])
      .mockResolvedValueOnce([
        [
          {
            capture_kg: "1250.75"
          }
        ]
      ])
      .mockResolvedValueOnce([
        [
          {
            fuel_consumed_liters: "875.25"
          }
        ]
      ])
      .mockResolvedValueOnce([
        [
          {
            open_alerts: "4"
          }
        ]
      ]);

    const response = await request(app)
      .get("/api/dashboard/summary");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.vessels).toEqual({
      total: 10,
      active: 6,
      restricted: 1,
      maintenance: 2,
      outOfService: 1,
      totalCapacityTons: 2500.5
    });

    expect(response.body.data.operations).toEqual({
      captureKg: 1250.75,
      fuelConsumedLiters: 875.25,
      openAlerts: 4
    });

    expect(response.body.data.generatedAt).toEqual(expect.any(String));

    expect(pool.query).toHaveBeenCalledTimes(4);
  });

  test("GET /api/dashboard/summary handles zero and null aggregate values", async () => {
    pool.query
      .mockResolvedValueOnce([
        [
          {
            total_vessels: "0",
            active_vessels: "0",
            restricted_vessels: "0",
            maintenance_vessels: "0",
            out_of_service_vessels: "0",
            total_capacity_tons: "0"
          }
        ]
      ])
      .mockResolvedValueOnce([
        [
          {
            capture_kg: null
          }
        ]
      ])
      .mockResolvedValueOnce([
        [
          {
            fuel_consumed_liters: null
          }
        ]
      ])
      .mockResolvedValueOnce([
        [
          {
            open_alerts: null
          }
        ]
      ]);

    const response = await request(app)
      .get("/api/dashboard/summary");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.vessels).toEqual({
      total: 0,
      active: 0,
      restricted: 0,
      maintenance: 0,
      outOfService: 0,
      totalCapacityTons: 0
    });

    expect(response.body.data.operations).toEqual({
      captureKg: 0,
      fuelConsumedLiters: 0,
      openAlerts: 0
    });

    expect(pool.query).toHaveBeenCalledTimes(4);
  });

  test("GET /api/dashboard/summary returns 500 when a database query fails", async () => {
    const databaseError = new Error("Database unavailable");

    pool.query.mockRejectedValueOnce(databaseError);

    const response = await request(app)
      .get("/api/dashboard/summary");

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      success: false,
      error: "Unable to load dashboard summary"
    });

    expect(pool.query).toHaveBeenCalledTimes(1);

    expect(logger.error).toHaveBeenCalledWith(
      { err: databaseError },
      "Dashboard summary error"
    );
  });
});
