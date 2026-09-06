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
const fuelRoutes = require("../fuel");

const app = express();

app.use(express.json());
app.use("/api/fuel", fuelRoutes);

describe("Fuel routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/fuel returns fuel records and vessel summaries", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: "3",
          vessel_id: "2",
          fuel_type: "diesel",
          quantity_liters: "1250.50",
          recorded_at: "2026-09-06T10:00:00.000Z",
          notes: "Main tank refill",
          vessel_code: "MV-002",
          vessel_name: "Ocean Pioneer",
          vessel_type: "trawler"
        },
        {
          id: "2",
          vessel_id: "2",
          fuel_type: "diesel",
          quantity_liters: "500",
          recorded_at: "2026-09-05T10:00:00.000Z",
          notes: null,
          vessel_code: "MV-002",
          vessel_name: "Ocean Pioneer",
          vessel_type: "trawler"
        },
        {
          id: "1",
          vessel_id: "1",
          fuel_type: "diesel",
          quantity_liters: "750.25",
          recorded_at: "2026-09-04T10:00:00.000Z",
          notes: "Departure fuel",
          vessel_code: "MV-001",
          vessel_name: "Atlantic Star",
          vessel_type: "longliner"
        }
      ]
    ]);

    const response = await request(app)
      .get("/api/fuel");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.summary).toEqual({
      totalLiters: 2500.75,
      recordCount: 3
    });

    expect(response.body.data.byVessel).toEqual([
      {
        vesselId: 1,
        vesselCode: "MV-001",
        vesselName: "Atlantic Star",
        vesselType: "longliner",
        totalLiters: 750.25,
        records: 1
      },
      {
        vesselId: 2,
        vesselCode: "MV-002",
        vesselName: "Ocean Pioneer",
        vesselType: "trawler",
        totalLiters: 1750.5,
        records: 2
      }
    ]);

    expect(response.body.data.records).toEqual([
      {
        id: 3,
        vesselId: 2,
        vesselCode: "MV-002",
        vesselName: "Ocean Pioneer",
        vesselType: "trawler",
        fuelType: "diesel",
        quantityLiters: 1250.5,
        recordedAt: "2026-09-06T10:00:00.000Z",
        notes: "Main tank refill"
      },
      {
        id: 2,
        vesselId: 2,
        vesselCode: "MV-002",
        vesselName: "Ocean Pioneer",
        vesselType: "trawler",
        fuelType: "diesel",
        quantityLiters: 500,
        recordedAt: "2026-09-05T10:00:00.000Z",
        notes: null
      },
      {
        id: 1,
        vesselId: 1,
        vesselCode: "MV-001",
        vesselName: "Atlantic Star",
        vesselType: "longliner",
        fuelType: "diesel",
        quantityLiters: 750.25,
        recordedAt: "2026-09-04T10:00:00.000Z",
        notes: "Departure fuel"
      }
    ]);

    expect(response.body.generatedAt).toEqual(expect.any(String));
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("GET /api/fuel handles an empty result set", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .get("/api/fuel");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        summary: {
          totalLiters: 0,
          recordCount: 0
        },
        byVessel: [],
        records: []
      },
      generatedAt: expect.any(String)
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("GET /api/fuel handles zero and null fuel quantities", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: "4",
          vessel_id: "3",
          fuel_type: "diesel",
          quantity_liters: null,
          recorded_at: "2026-09-03T10:00:00.000Z",
          notes: null,
          vessel_code: "MV-003",
          vessel_name: "Pacific Dawn",
          vessel_type: "carrier"
        },
        {
          id: "5",
          vessel_id: "3",
          fuel_type: "diesel",
          quantity_liters: "0",
          recorded_at: "2026-09-02T10:00:00.000Z",
          notes: "No fuel consumed",
          vessel_code: "MV-003",
          vessel_name: "Pacific Dawn",
          vessel_type: "carrier"
        }
      ]
    ]);

    const response = await request(app)
      .get("/api/fuel");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.summary).toEqual({
      totalLiters: 0,
      recordCount: 2
    });

    expect(response.body.data.byVessel).toEqual([
      {
        vesselId: 3,
        vesselCode: "MV-003",
        vesselName: "Pacific Dawn",
        vesselType: "carrier",
        totalLiters: 0,
        records: 2
      }
    ]);

    expect(response.body.data.records).toEqual([
      {
        id: 4,
        vesselId: 3,
        vesselCode: "MV-003",
        vesselName: "Pacific Dawn",
        vesselType: "carrier",
        fuelType: "diesel",
        quantityLiters: 0,
        recordedAt: "2026-09-03T10:00:00.000Z",
        notes: null
      },
      {
        id: 5,
        vesselId: 3,
        vesselCode: "MV-003",
        vesselName: "Pacific Dawn",
        vesselType: "carrier",
        fuelType: "diesel",
        quantityLiters: 0,
        recordedAt: "2026-09-02T10:00:00.000Z",
        notes: "No fuel consumed"
      }
    ]);
  });

  test("GET /api/fuel returns 500 when the database query fails", async () => {
    const databaseError = new Error("Database unavailable");

    pool.query.mockRejectedValueOnce(databaseError);

    const response = await request(app)
      .get("/api/fuel");

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      success: false,
      error: "Unable to load fuel data"
    });

    expect(pool.query).toHaveBeenCalledTimes(1);

    expect(logger.error).toHaveBeenCalledWith(
      { err: databaseError },
      "Fuel API error"
    );
  });
});
