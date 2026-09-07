const express = require("express");
const request = require("supertest");

jest.mock("../../db", () => ({
  query: jest.fn()
}));

const pool = require("../../db");
const reportsRoutes = require("../reports");

const app = express();

app.use(express.json());
app.use("/api/reports", reportsRoutes);

describe("Reports routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/reports/summary returns structured fleet report", async () => {
    pool.query
      .mockResolvedValueOnce([
        [{
          total_vessels: "5",
          active_vessels: "3",
          restricted_vessels: "1",
          maintenance_vessels: "1",
          out_of_service_vessels: "0",
          total_capacity_tons: "1250.5"
        }]
      ])
      .mockResolvedValueOnce([
        [{
          total_catch_kg: "7500",
          record_count: "25",
          species_count: "4",
          vessels_reporting: "3"
        }]
      ])
      .mockResolvedValueOnce([
        [
          {
            species: "Tuna",
            quantity_kg: "5000",
            record_count: "15"
          },
          {
            species: "Mackerel",
            quantity_kg: "2500",
            record_count: "10"
          }
        ]
      ])
      .mockResolvedValueOnce([
        [
          {
            vessel_id: "1",
            vessel_code: "FV-001",
            vessel_name: "Ocean Star",
            quantity_kg: "4500",
            record_count: "12"
          },
          {
            vessel_id: null,
            vessel_code: null,
            vessel_name: null,
            quantity_kg: "3000",
            record_count: "13"
          }
        ]
      ])
      .mockResolvedValueOnce([
        [{
          total_fuel_liters: "2500",
          record_count: "10",
          vessels_reporting: "3"
        }]
      ])
      .mockResolvedValueOnce([
        [
          {
            vessel_id: "1",
            vessel_code: "FV-001",
            vessel_name: "Ocean Star",
            fuel_liters: "1500",
            record_count: "6"
          },
          {
            vessel_id: null,
            vessel_code: null,
            vessel_name: null,
            fuel_liters: "1000",
            record_count: "4"
          }
        ]
      ])
      .mockResolvedValueOnce([
        [{
          total_voyages: "8",
          planned: "2",
          in_progress: "3",
          completed: "2",
          cancelled: "1"
        }]
      ])
      .mockResolvedValueOnce([
        [{
          total_records: "12",
          scheduled: "3",
          in_progress: "4",
          completed: "4",
          cancelled: "1",
          total_cost: "87500.50"
        }]
      ])
      .mockResolvedValueOnce([
        [
          {
            vessel_id: "1",
            vessel_code: "FV-001",
            vessel_name: "Ocean Star",
            record_count: "7",
            total_cost: "50000"
          }
        ]
      ])
      .mockResolvedValueOnce([
        [{
          total_alerts: "10",
          open_alerts: "3",
          acknowledged_alerts: "2",
          resolved_alerts: "5",
          critical_alerts: "1",
          warning_alerts: "6",
          info_alerts: "3"
        }]
      ])
      .mockResolvedValueOnce([
        [{
          total_crew: "18",
          active_crew: "14",
          on_leave: "2",
          inactive_crew: "2",
          assigned_vessels: "4"
        }]
      ])
      .mockResolvedValueOnce([
        [
          {
            metric_date: "2026-09-05",
            sales_amount: "125000.75",
            capture_kg: "1500",
            target_capture_kg: "2000",
            active_vessels: "4",
            fuel_consumed_liters: "500",
            performance_percent: "75.5"
          }
        ]
      ]);

    const response = await request(app)
      .get("/api/reports/summary");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.fleet).toEqual({
      total: 5,
      active: 3,
      restricted: 1,
      maintenance: 1,
      outOfService: 0,
      totalCapacityTons: 1250.5
    });

    expect(response.body.data.production.totalCatchKg).toBe(7500);
    expect(response.body.data.production.targetKg).toBe(2000);
    expect(response.body.data.production.catchProgressPercent).toBe(375);
    expect(response.body.data.production.catchPerLiterKg).toBe(3);
    expect(response.body.data.production.recordCount).toBe(25);
    expect(response.body.data.production.speciesCount).toBe(4);
    expect(response.body.data.production.vesselsReporting).toBe(3);

    expect(response.body.data.production.bySpecies).toEqual([
      {
        species: "Tuna",
        quantityKg: 5000,
        recordCount: 15
      },
      {
        species: "Mackerel",
        quantityKg: 2500,
        recordCount: 10
      }
    ]);

    expect(response.body.data.production.byVessel[0]).toEqual({
      vesselId: 1,
      vesselCode: "FV-001",
      vesselName: "Ocean Star",
      quantityKg: 4500,
      recordCount: 12
    });

    expect(response.body.data.production.byVessel[1]).toEqual({
      vesselId: null,
      vesselCode: null,
      vesselName: "Unassigned",
      quantityKg: 3000,
      recordCount: 13
    });

    expect(response.body.data.fuel).toEqual({
      totalLiters: 2500,
      recordCount: 10,
      vesselsReporting: 3,
      byVessel: [
        {
          vesselId: 1,
          vesselCode: "FV-001",
          vesselName: "Ocean Star",
          fuelLiters: 1500,
          recordCount: 6
        },
        {
          vesselId: null,
          vesselCode: null,
          vesselName: "Unassigned",
          fuelLiters: 1000,
          recordCount: 4
        }
      ]
    });

    expect(response.body.data.voyages).toEqual({
      total: 8,
      planned: 2,
      inProgress: 3,
      completed: 2,
      cancelled: 1
    });

    expect(response.body.data.maintenance).toEqual({
      totalRecords: 12,
      scheduled: 3,
      inProgress: 4,
      completed: 4,
      cancelled: 1,
      totalCost: 87500.5,
      byVessel: [
        {
          vesselId: 1,
          vesselCode: "FV-001",
          vesselName: "Ocean Star",
          recordCount: 7,
          totalCost: 50000
        }
      ]
    });

    expect(response.body.data.alerts).toEqual({
      total: 10,
      open: 3,
      acknowledged: 2,
      resolved: 5,
      critical: 1,
      warning: 6,
      info: 3
    });

    expect(response.body.data.crew).toEqual({
      total: 18,
      active: 14,
      onLeave: 2,
      inactive: 2,
      assignedVessels: 4
    });

    expect(response.body.data.dailyMetrics).toEqual([
      {
        metricDate: "2026-09-05",
        salesAmount: 125000.75,
        captureKg: 1500,
        targetCaptureKg: 2000,
        activeVessels: 4,
        fuelConsumedLiters: 500,
        performancePercent: 75.5
      }
    ]);

    expect(response.body.generatedAt).toEqual(expect.any(String));
    expect(pool.query).toHaveBeenCalledTimes(12);
  });

  test("GET /api/reports/summary handles empty database results", async () => {
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);

    const response = await request(app)
      .get("/api/reports/summary");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.fleet).toEqual({
      total: 0,
      active: 0,
      restricted: 0,
      maintenance: 0,
      outOfService: 0,
      totalCapacityTons: 0
    });

    expect(response.body.data.production).toEqual({
      totalCatchKg: 0,
      targetKg: 0,
      catchProgressPercent: 0,
      recordCount: 0,
      speciesCount: 0,
      vesselsReporting: 0,
      catchPerLiterKg: 0,
      bySpecies: [],
      byVessel: []
    });

    expect(response.body.data.fuel).toEqual({
      totalLiters: 0,
      recordCount: 0,
      vesselsReporting: 0,
      byVessel: []
    });

    expect(response.body.data.voyages).toEqual({
      total: 0,
      planned: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0
    });

    expect(response.body.data.maintenance).toEqual({
      totalRecords: 0,
      scheduled: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      totalCost: 0,
      byVessel: []
    });

    expect(response.body.data.alerts).toEqual({
      total: 0,
      open: 0,
      acknowledged: 0,
      resolved: 0,
      critical: 0,
      warning: 0,
      info: 0
    });

    expect(response.body.data.crew).toEqual({
      total: 0,
      active: 0,
      onLeave: 0,
      inactive: 0,
      assignedVessels: 0
    });

    expect(response.body.data.dailyMetrics).toEqual([]);
    expect(response.body.generatedAt).toEqual(expect.any(String));
    expect(pool.query).toHaveBeenCalledTimes(12);
  });

  test("GET /api/reports/summary returns 500 when a database query fails", async () => {
    pool.query.mockRejectedValueOnce(new Error("Database unavailable"));

    const response = await request(app)
      .get("/api/reports/summary");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: "Unable to generate reports summary"
    });

    expect(pool.query).toHaveBeenCalledTimes(12);
  });
});
