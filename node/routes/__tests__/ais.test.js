const express = require("express");
const request = require("supertest");

jest.mock("../../db", () => ({
  query: jest.fn()
}));

jest.mock("../../lib/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const pool = require("../../db");
const logger = require("../../lib/logger");
const aisRoutes = require("../ais");

const app = express();

app.use(express.json());
app.use("/api/ais", aisRoutes);

describe("AIS authentication and ingestion routes", () => {
  const validKey = "test-ais-ingest-key";

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AIS_INGEST_API_KEY = validKey;
  });

  afterAll(() => {
    delete process.env.AIS_INGEST_API_KEY;
  });

  test("rejects AIS ingestion when API key is missing", async () => {
    const response = await request(app)
      .post("/api/ais/positions")
      .send({
        mmsi: "123456789",
        latitude: 4.8123,
        longitude: 4.9012
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: "AIS ingestion authentication required"
    });

    expect(pool.query).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  test("rejects AIS ingestion with an invalid API key", async () => {
    const response = await request(app)
      .post("/api/ais/positions")
      .set("X-AIS-API-Key", "wrong-key")
      .send({
        mmsi: "123456789",
        latitude: 4.8123,
        longitude: 4.9012
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: "AIS ingestion authentication required"
    });

    expect(pool.query).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  test("returns 503 when AIS ingestion key is not configured", async () => {
    delete process.env.AIS_INGEST_API_KEY;

    const response = await request(app)
      .post("/api/ais/positions")
      .set("X-AIS-API-Key", validKey)
      .send({
        mmsi: "123456789",
        latitude: 4.8123,
        longitude: 4.9012
      });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: "AIS ingestion service is not configured"
    });

    expect(pool.query).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "AIS ingestion API key is not configured"
    );
  });

  test("accepts a valid X-AIS-API-Key header", async () => {
    pool.query
      .mockResolvedValueOnce([
        [
          {
            id: 1,
            vessel_code: "MD-001",
            name: "Marine Explorer",
            status: "active"
          }
        ]
      ])
      .mockResolvedValueOnce([
        {
          insertId: 101
        }
      ]);

    const response = await request(app)
      .post("/api/ais/positions")
      .set("X-AIS-API-Key", validKey)
      .send({
        mmsi: "123456789",
        latitude: 4.8123,
        longitude: 4.9012,
        speedKnots: 12.5,
        headingDegrees: 118,
        positionSource: "ais",
        sourceDeviceId: "ais-provider-01",
        sourceTimestamp: "2026-09-06T11:30:00Z"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Position recorded successfully");
    expect(response.body.data).toMatchObject({
      id: 101,
      vesselId: 1,
      vesselCode: "MD-001",
      vesselName: "Marine Explorer",
      mmsi: "123456789",
      latitude: 4.8123,
      longitude: 4.9012,
      speedKnots: 12.5,
      headingDegrees: 118,
      positionSource: "ais",
      sourceDeviceId: "ais-provider-01",
      sourceTimestamp: "2026-09-06 11:30:00",
      recordedAt: "2026-09-06 11:30:00"
    });

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalled();
  });

  test("accepts a valid Bearer token", async () => {
    pool.query
      .mockResolvedValueOnce([
        [
          {
            id: 2,
            vessel_code: "MD-002",
            name: "Ocean Runner",
            status: "active"
          }
        ]
      ])
      .mockResolvedValueOnce([
        {
          insertId: 102
        }
      ]);

    const response = await request(app)
      .post("/api/ais/positions")
      .set("Authorization", `Bearer ${validKey}`)
      .send({
        mmsi: "987654321",
        latitude: 5,
        longitude: 6
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: 102,
      vesselId: 2,
      vesselCode: "MD-002",
      mmsi: "987654321",
      latitude: 5,
      longitude: 6,
      speedKnots: null,
      headingDegrees: null,
      positionSource: "ais",
      sourceDeviceId: null,
      sourceTimestamp: null
    });
  });

  test("rejects a missing MMSI", async () => {
    const response = await request(app)
      .post("/api/ais/positions")
      .set("X-AIS-API-Key", validKey)
      .send({
        latitude: 4.8123,
        longitude: 4.9012
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "mmsi is required"
    });

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("rejects invalid latitude", async () => {
    const response = await request(app)
      .post("/api/ais/positions")
      .set("X-AIS-API-Key", validKey)
      .send({
        mmsi: "123456789",
        latitude: 91,
        longitude: 4.9012
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "latitude must be a number between -90 and 90"
    );

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("rejects invalid longitude", async () => {
    const response = await request(app)
      .post("/api/ais/positions")
      .set("X-AIS-API-Key", validKey)
      .send({
        mmsi: "123456789",
        latitude: 4.8123,
        longitude: 181
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "longitude must be a number between -180 and 180"
    );

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("rejects negative speed", async () => {
    const response = await request(app)
      .post("/api/ais/positions")
      .set("X-AIS-API-Key", validKey)
      .send({
        mmsi: "123456789",
        latitude: 4.8123,
        longitude: 4.9012,
        speedKnots: -1
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "speedKnots must be a non-negative number"
    );

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("rejects an invalid heading", async () => {
    const response = await request(app)
      .post("/api/ais/positions")
      .set("X-AIS-API-Key", validKey)
      .send({
        mmsi: "123456789",
        latitude: 4.8123,
        longitude: 4.9012,
        headingDegrees: 360
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "headingDegrees must be between 0 and less than 360"
    );

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("rejects an invalid position source", async () => {
    const response = await request(app)
      .post("/api/ais/positions")
      .set("X-AIS-API-Key", validKey)
      .send({
        mmsi: "123456789",
        latitude: 4.8123,
        longitude: 4.9012,
        positionSource: "manual"
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "positionSource must be gps or ais"
    );

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("rejects an invalid source timestamp", async () => {
    const response = await request(app)
      .post("/api/ais/positions")
      .set("X-AIS-API-Key", validKey)
      .send({
        mmsi: "123456789",
        latitude: 4.8123,
        longitude: 4.9012,
        sourceTimestamp: "not-a-date"
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "sourceTimestamp must be a valid date/time"
    );

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("returns 404 when MMSI is not registered", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .post("/api/ais/positions")
      .set("X-AIS-API-Key", validKey)
      .send({
        mmsi: "111111111",
        latitude: 4.8123,
        longitude: 4.9012
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: "No vessel is registered with this MMSI"
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("returns 409 for a retired vessel", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: 3,
          vessel_code: "MD-003",
          name: "Retired Vessel",
          status: "retired"
        }
      ]
    ]);

    const response = await request(app)
      .post("/api/ais/positions")
      .set("X-AIS-API-Key", validKey)
      .send({
        mmsi: "222222222",
        latitude: 4.8123,
        longitude: 4.9012
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      error: "Cannot record a position for a retired vessel"
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("returns 500 when the database fails", async () => {
    const databaseError = new Error("Database unavailable");

    pool.query.mockRejectedValueOnce(databaseError);

    const response = await request(app)
      .post("/api/ais/positions")
      .set("X-AIS-API-Key", validKey)
      .send({
        mmsi: "123456789",
        latitude: 4.8123,
        longitude: 4.9012
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: "Unable to record AIS/GPS position"
    });

    expect(logger.error).toHaveBeenCalledWith(
      { err: databaseError },
      "AIS/GPS position ingestion error"
    );
  });
});
