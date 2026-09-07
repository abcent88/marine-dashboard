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
            total_capacity_tons: "2500.50",
            active_capacity_tons: "1600.50"
          }
        ]
      ])
      .mockResolvedValueOnce([
        [
          {
            metric_date: "2026-09-06",
            sales_amount: "25798000.00",
            capture_kg: "13300.00",
            target_capture_kg: "15000.00",
            active_vessels: "6",
            fuel_consumed_liters: "6850.00",
            performance_percent: "88.67"
          }
        ]
      ])
      .mockResolvedValueOnce([
        [
          {
            metric_date: "2026-09-06",
            sales_amount: "25798000.00",
            capture_kg: "13300.00",
            target_capture_kg: "15000.00",
            active_vessels: "6",
            fuel_consumed_liters: "6850.00",
            performance_percent: "88.67"
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
            species: "Mackerel",
            quantity_kg: "750.50",
            record_count: "2"
          },
          {
            species: "Tuna",
            quantity_kg: "500.25",
            record_count: "1"
          }
        ]
      ])
      .mockResolvedValueOnce([
        [
          {
            open_alerts: "4"
          }
        ]
      ])
      .mockResolvedValueOnce([
        [
          {
            id: "5",
            vessel_id: "1",
            vessel_code: "MD-001",
            vessel_name: "Ocean Pioneer",
            latitude: "4.8123",
            longitude: "4.9012",
            speed_knots: "12.50",
            heading_degrees: "118.00",
            position_source: "ais",
            source_timestamp: "2026-09-06T11:40:00.000Z",
            recorded_at: "2026-09-06T11:40:00.000Z"
          },
          {
            id: "2",
            vessel_id: "2",
            vessel_code: "MD-002",
            vessel_name: "Atlantic Star",
            latitude: "3.9045",
            longitude: "5.2187",
            speed_knots: "10.80",
            heading_degrees: "132.00",
            position_source: "manual",
            source_timestamp: null,
            recorded_at: "2026-09-01T22:00:00.000Z"
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
      totalCapacityTons: 2500.5,
      activeCapacityTons: 1600.5
    });

    expect(response.body.data.dailyMetric).toEqual({
      metricDate: "2026-09-06",
      salesAmount: 25798000,
      captureKg: 13300,
      targetCaptureKg: 15000,
      activeVessels: 6,
      fuelConsumedLiters: 6850,
      performancePercent: 88.67
    });

    expect(response.body.data.todayMetric).toEqual({
      metricDate: "2026-09-06",
      salesAmount: 25798000,
      captureKg: 13300,
      targetCaptureKg: 15000,
      activeVessels: 6,
      fuelConsumedLiters: 6850,
      performancePercent: 88.67
    });

    expect(response.body.data.todaySpeciesBreakdown).toEqual([
      {
        species: "Mackerel",
        quantityKg: 750.5,
        recordCount: 2
      },
      {
        species: "Tuna",
        quantityKg: 500.25,
        recordCount: 1
      }
    ]);

    expect(response.body.data.operations).toEqual({
      captureKg: 1250.75,
      fuelConsumedLiters: 875.25,
      openAlerts: 4
    });

    expect(response.body.data.tracking).toEqual({
      trackedVessels: 2,
      positions: [
        {
          id: 5,
          vesselId: 1,
          vesselCode: "MD-001",
          vesselName: "Ocean Pioneer",
          latitude: 4.8123,
          longitude: 4.9012,
          speedKnots: 12.5,
          headingDegrees: 118,
          positionSource: "ais",
          sourceTimestamp: "2026-09-06T11:40:00.000Z",
          recordedAt: "2026-09-06T11:40:00.000Z"
        },
        {
          id: 2,
          vesselId: 2,
          vesselCode: "MD-002",
          vesselName: "Atlantic Star",
          latitude: 3.9045,
          longitude: 5.2187,
          speedKnots: 10.8,
          headingDegrees: 132,
          positionSource: "manual",
          sourceTimestamp: null,
          recordedAt: "2026-09-01T22:00:00.000Z"
        }
      ]
    });

    expect(response.body.data.generatedAt).toEqual(expect.any(String));

    expect(pool.query).toHaveBeenCalledTimes(8);
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
            total_capacity_tons: "0",
            active_capacity_tons: "0"
          }
        ]
      ])
      .mockResolvedValueOnce([
        []
      ])
      .mockResolvedValueOnce([
        []
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
        []
      ])
      .mockResolvedValueOnce([
        [
          {
            open_alerts: null
          }
        ]
      ])
      .mockResolvedValueOnce([
        []
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
      totalCapacityTons: 0,
      activeCapacityTons: 0
    });

    expect(response.body.data.dailyMetric).toBeNull();
    expect(response.body.data.todayMetric).toBeNull();

    expect(response.body.data.operations).toEqual({
      captureKg: 0,
      fuelConsumedLiters: 0,
      openAlerts: 0
    });

    expect(response.body.data.tracking).toEqual({
      trackedVessels: 0,
      positions: []
    });

    expect(pool.query).toHaveBeenCalledTimes(8);
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
