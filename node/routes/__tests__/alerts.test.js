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
const alertsRoutes = require("../alerts");

const app = express();

app.use(express.json());
app.use("/api/alerts", alertsRoutes);

describe("Alerts routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/alerts returns alerts with summary", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: "1",
          vessel_id: "10",
          alert_type: "engine",
          severity: "critical",
          title: "Engine temperature critical",
          message: "Engine temperature exceeds safe operating range.",
          status: "open",
          created_at: "2026-09-05T08:00:00.000Z",
          acknowledged_at: null,
          resolved_at: null,
          vessel_code: "FV-010",
          vessel_name: "Ocean Star",
          vessel_type: "Fishing Vessel",
          vessel_status: "active"
        },
        {
          id: "2",
          vessel_id: "10",
          alert_type: "fuel",
          severity: "warning",
          title: "Low fuel level",
          message: "Fuel level is below the recommended threshold.",
          status: "acknowledged",
          created_at: "2026-09-05T09:00:00.000Z",
          acknowledged_at: "2026-09-05T09:30:00.000Z",
          resolved_at: null,
          vessel_code: "FV-010",
          vessel_name: "Ocean Star",
          vessel_type: "Fishing Vessel",
          vessel_status: "active"
        },
        {
          id: "3",
          vessel_id: null,
          alert_type: "system",
          severity: "info",
          title: "System notification",
          message: "Scheduled maintenance is complete.",
          status: "resolved",
          created_at: "2026-09-05T10:00:00.000Z",
          acknowledged_at: "2026-09-05T10:05:00.000Z",
          resolved_at: "2026-09-05T10:30:00.000Z",
          vessel_code: null,
          vessel_name: null,
          vessel_type: null,
          vessel_status: null
        },
        {
          id: "4",
          vessel_id: "20",
          alert_type: "navigation",
          severity: "warning",
          title: "Navigation warning",
          message: "Vessel is approaching restricted waters.",
          status: "open",
          created_at: "2026-09-05T11:00:00.000Z",
          acknowledged_at: null,
          resolved_at: null,
          vessel_code: "FV-020",
          vessel_name: "Atlantic Star",
          vessel_type: "Cargo Vessel",
          vessel_status: "restricted"
        },
        {
          id: "5",
          vessel_id: "20",
          alert_type: "operations",
          severity: "critical",
          title: "Operational issue",
          message: "Immediate operator attention required.",
          status: "resolved",
          created_at: "2026-09-05T12:00:00.000Z",
          acknowledged_at: "2026-09-05T12:10:00.000Z",
          resolved_at: "2026-09-05T12:30:00.000Z",
          vessel_code: "FV-020",
          vessel_name: "Atlantic Star",
          vessel_type: "Cargo Vessel",
          vessel_status: "restricted"
        }
      ]
    ]);

    const response = await request(app)
      .get("/api/alerts");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.summary).toEqual({
      totalAlerts: 5,
      open: 2,
      acknowledged: 1,
      resolved: 2,
      info: 1,
      warning: 2,
      critical: 2
    });

    expect(response.body.data.alerts).toEqual([
      {
        id: 1,
        vesselId: 10,
        vesselCode: "FV-010",
        vesselName: "Ocean Star",
        vesselType: "Fishing Vessel",
        vesselStatus: "active",
        alertType: "engine",
        severity: "critical",
        title: "Engine temperature critical",
        message: "Engine temperature exceeds safe operating range.",
        status: "open",
        createdAt: "2026-09-05T08:00:00.000Z",
        acknowledgedAt: null,
        resolvedAt: null
      },
      {
        id: 2,
        vesselId: 10,
        vesselCode: "FV-010",
        vesselName: "Ocean Star",
        vesselType: "Fishing Vessel",
        vesselStatus: "active",
        alertType: "fuel",
        severity: "warning",
        title: "Low fuel level",
        message: "Fuel level is below the recommended threshold.",
        status: "acknowledged",
        createdAt: "2026-09-05T09:00:00.000Z",
        acknowledgedAt: "2026-09-05T09:30:00.000Z",
        resolvedAt: null
      },
      {
        id: 3,
        vesselId: null,
        vesselCode: null,
        vesselName: null,
        vesselType: null,
        vesselStatus: null,
        alertType: "system",
        severity: "info",
        title: "System notification",
        message: "Scheduled maintenance is complete.",
        status: "resolved",
        createdAt: "2026-09-05T10:00:00.000Z",
        acknowledgedAt: "2026-09-05T10:05:00.000Z",
        resolvedAt: "2026-09-05T10:30:00.000Z"
      },
      {
        id: 4,
        vesselId: 20,
        vesselCode: "FV-020",
        vesselName: "Atlantic Star",
        vesselType: "Cargo Vessel",
        vesselStatus: "restricted",
        alertType: "navigation",
        severity: "warning",
        title: "Navigation warning",
        message: "Vessel is approaching restricted waters.",
        status: "open",
        createdAt: "2026-09-05T11:00:00.000Z",
        acknowledgedAt: null,
        resolvedAt: null
      },
      {
        id: 5,
        vesselId: 20,
        vesselCode: "FV-020",
        vesselName: "Atlantic Star",
        vesselType: "Cargo Vessel",
        vesselStatus: "restricted",
        alertType: "operations",
        severity: "critical",
        title: "Operational issue",
        message: "Immediate operator attention required.",
        status: "resolved",
        createdAt: "2026-09-05T12:00:00.000Z",
        acknowledgedAt: "2026-09-05T12:10:00.000Z",
        resolvedAt: "2026-09-05T12:30:00.000Z"
      }
    ]);

    expect(response.body.generatedAt).toEqual(expect.any(String));
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("GET /api/alerts handles an empty result set", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .get("/api/alerts");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.summary).toEqual({
      totalAlerts: 0,
      open: 0,
      acknowledged: 0,
      resolved: 0,
      info: 0,
      warning: 0,
      critical: 0
    });

    expect(response.body.data.alerts).toEqual([]);
  });

  test("GET /api/alerts returns 500 when the database query fails", async () => {
    const databaseError = new Error("Database unavailable");

    pool.query.mockRejectedValueOnce(databaseError);

    const response = await request(app)
      .get("/api/alerts");

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      success: false,
      error: "Unable to load alerts data"
    });

    expect(pool.query).toHaveBeenCalledTimes(1);

    expect(logger.error).toHaveBeenCalledWith(
      { err: databaseError },
      "Alerts API error"
    );
  });
});
