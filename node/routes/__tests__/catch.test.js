const express = require("express");
const request = require("supertest");

jest.mock("../../db", () => ({
  query: jest.fn()
}));

const pool = require("../../db");
const catchRoutes = require("../catch");

const app = express();

app.use(express.json());
app.use("/api/catch", catchRoutes);

describe("Catch routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/catch returns catches with species and vessel breakdowns", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: "1",
          vessel_id: "10",
          voyage_id: "100",
          species: "Tuna",
          quantity_kg: "1200.50",
          recorded_at: "2026-09-05T08:00:00.000Z",
          location_latitude: "5.6037",
          location_longitude: "0.1870",
          notes: "Morning catch",
          vessel_code: "FV-010",
          vessel_name: "Ocean Star",
          voyage_number: "VOY-001",
          voyage_status: "completed"
        },
        {
          id: "2",
          vessel_id: "10",
          voyage_id: "100",
          species: "Tuna",
          quantity_kg: "800.50",
          recorded_at: "2026-09-05T09:00:00.000Z",
          location_latitude: null,
          location_longitude: null,
          notes: null,
          vessel_code: "FV-010",
          vessel_name: "Ocean Star",
          voyage_number: "VOY-001",
          voyage_status: "completed"
        },
        {
          id: "3",
          vessel_id: null,
          voyage_id: null,
          species: "Mackerel",
          quantity_kg: "500",
          recorded_at: "2026-09-05T07:00:00.000Z",
          location_latitude: "5.7000",
          location_longitude: "0.2000",
          notes: "Unassigned catch",
          vessel_code: null,
          vessel_name: null,
          voyage_number: null,
          voyage_status: null
        }
      ]
    ]);

    const response = await request(app)
      .get("/api/catch");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.summary).toEqual({
      totalCatchKg: 2501,
      targetKg: 15000,
      targetProgressPercent: 16.7,
      recordCount: 3,
      speciesCount: 2,
      vesselsReporting: 2
    });

    expect(response.body.data.speciesBreakdown).toEqual([
      {
        species: "Tuna",
        quantityKg: 2001,
        recordCount: 2
      },
      {
        species: "Mackerel",
        quantityKg: 500,
        recordCount: 1
      }
    ]);

    expect(response.body.data.vesselBreakdown).toEqual([
      {
        vesselId: 10,
        vesselCode: "FV-010",
        vesselName: "Ocean Star",
        quantityKg: 2001,
        recordCount: 2
      },
      {
        vesselId: null,
        vesselCode: null,
        vesselName: "Unassigned",
        quantityKg: 500,
        recordCount: 1
      }
    ]);

    expect(response.body.data.catches).toEqual([
      {
        id: 1,
        vesselId: 10,
        voyageId: 100,
        vesselCode: "FV-010",
        vesselName: "Ocean Star",
        voyageNumber: "VOY-001",
        voyageStatus: "completed",
        species: "Tuna",
        quantityKg: 1200.5,
        recordedAt: "2026-09-05T08:00:00.000Z",
        latitude: 5.6037,
        longitude: 0.187,
        notes: "Morning catch"
      },
      {
        id: 2,
        vesselId: 10,
        voyageId: 100,
        vesselCode: "FV-010",
        vesselName: "Ocean Star",
        voyageNumber: "VOY-001",
        voyageStatus: "completed",
        species: "Tuna",
        quantityKg: 800.5,
        recordedAt: "2026-09-05T09:00:00.000Z",
        latitude: null,
        longitude: null,
        notes: null
      },
      {
        id: 3,
        vesselId: null,
        voyageId: null,
        vesselCode: null,
        vesselName: null,
        voyageNumber: null,
        voyageStatus: null,
        species: "Mackerel",
        quantityKg: 500,
        recordedAt: "2026-09-05T07:00:00.000Z",
        latitude: 5.7,
        longitude: 0.2,
        notes: "Unassigned catch"
      }
    ]);

    expect(response.body.generatedAt).toEqual(expect.any(String));
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("GET /api/catch applies fallback values for incomplete catch records", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: "4",
          vessel_id: "11",
          voyage_id: null,
          species: null,
          quantity_kg: null,
          recorded_at: "2026-09-05T10:00:00.000Z",
          location_latitude: null,
          location_longitude: null,
          notes: null,
          vessel_code: "",
          vessel_name: "",
          voyage_number: null,
          voyage_status: null
        }
      ]
    ]);

    const response = await request(app)
      .get("/api/catch");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.summary).toEqual({
      totalCatchKg: 0,
      targetKg: 15000,
      targetProgressPercent: 0,
      recordCount: 1,
      speciesCount: 1,
      vesselsReporting: 1
    });

    expect(response.body.data.speciesBreakdown).toEqual([
      {
        species: "Unknown",
        quantityKg: 0,
        recordCount: 1
      }
    ]);

    expect(response.body.data.vesselBreakdown).toEqual([
      {
        vesselId: 11,
        vesselCode: null,
        vesselName: "Unassigned",
        quantityKg: 0,
        recordCount: 1
      }
    ]);

    expect(response.body.data.catches).toEqual([
      {
        id: 4,
        vesselId: 11,
        voyageId: null,
        vesselCode: "",
        vesselName: "",
        voyageNumber: null,
        voyageStatus: null,
        species: null,
        quantityKg: 0,
        recordedAt: "2026-09-05T10:00:00.000Z",
        latitude: null,
        longitude: null,
        notes: null
      }
    ]);
  });

  test("GET /api/catch returns 500 when the database query fails", async () => {
    pool.query.mockRejectedValueOnce(new Error("Database unavailable"));

    const response = await request(app)
      .get("/api/catch");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: "Unable to load catch data"
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});
