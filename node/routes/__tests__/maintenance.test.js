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
const maintenanceRoutes = require("../maintenance");

const app = express();

app.use(express.json());
app.use("/api/maintenance", maintenanceRoutes);

describe("Maintenance routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/maintenance returns maintenance records and summary", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: "4",
          vessel_id: "2",
          title: "Engine Overhaul",
          description: "Full main engine inspection and overhaul",
          maintenance_type: "engine",
          status: "in_progress",
          priority: "critical",
          scheduled_at: "2026-09-06T08:00:00.000Z",
          completed_at: null,
          cost: "12500.50",
          vessel_code: "MV-002",
          vessel_name: "Ocean Pioneer",
          vessel_type: "trawler",
          vessel_status: "active"
        },
        {
          id: "3",
          vessel_id: "1",
          title: "Hull Inspection",
          description: "Routine hull inspection",
          maintenance_type: "inspection",
          status: "scheduled",
          priority: "high",
          scheduled_at: "2026-09-07T08:00:00.000Z",
          completed_at: null,
          cost: "4500",
          vessel_code: "MV-001",
          vessel_name: "Atlantic Star",
          vessel_type: "longliner",
          vessel_status: "active"
        },
        {
          id: "2",
          vessel_id: "3",
          title: "Navigation System Service",
          description: "Service navigation equipment",
          maintenance_type: "electrical",
          status: "completed",
          priority: "medium",
          scheduled_at: "2026-09-01T08:00:00.000Z",
          completed_at: "2026-09-02T16:00:00.000Z",
          cost: "3200.75",
          vessel_code: "MV-003",
          vessel_name: "Pacific Dawn",
          vessel_type: "carrier",
          vessel_status: "maintenance"
        },
        {
          id: "1",
          vessel_id: "4",
          title: "Pump Replacement",
          description: "Replace freshwater pump",
          maintenance_type: "mechanical",
          status: "cancelled",
          priority: "low",
          scheduled_at: "2026-08-30T08:00:00.000Z",
          completed_at: null,
          cost: "800",
          vessel_code: "MV-004",
          vessel_name: "Coastal Runner",
          vessel_type: "support",
          vessel_status: "restricted"
        }
      ]
    ]);

    const response = await request(app)
      .get("/api/maintenance");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.summary).toEqual({
      totalRecords: 4,
      scheduled: 1,
      inProgress: 1,
      completed: 1,
      cancelled: 1,
      lowPriority: 1,
      mediumPriority: 1,
      highPriority: 1,
      criticalPriority: 1,
      totalCost: 21001.25
    });

    expect(response.body.data.records).toEqual([
      {
        id: 4,
        vesselId: 2,
        vesselCode: "MV-002",
        vesselName: "Ocean Pioneer",
        vesselType: "trawler",
        vesselStatus: "active",
        title: "Engine Overhaul",
        description: "Full main engine inspection and overhaul",
        maintenanceType: "engine",
        status: "in_progress",
        priority: "critical",
        scheduledAt: "2026-09-06T08:00:00.000Z",
        completedAt: null,
        cost: 12500.5
      },
      {
        id: 3,
        vesselId: 1,
        vesselCode: "MV-001",
        vesselName: "Atlantic Star",
        vesselType: "longliner",
        vesselStatus: "active",
        title: "Hull Inspection",
        description: "Routine hull inspection",
        maintenanceType: "inspection",
        status: "scheduled",
        priority: "high",
        scheduledAt: "2026-09-07T08:00:00.000Z",
        completedAt: null,
        cost: 4500
      },
      {
        id: 2,
        vesselId: 3,
        vesselCode: "MV-003",
        vesselName: "Pacific Dawn",
        vesselType: "carrier",
        vesselStatus: "maintenance",
        title: "Navigation System Service",
        description: "Service navigation equipment",
        maintenanceType: "electrical",
        status: "completed",
        priority: "medium",
        scheduledAt: "2026-09-01T08:00:00.000Z",
        completedAt: "2026-09-02T16:00:00.000Z",
        cost: 3200.75
      },
      {
        id: 1,
        vesselId: 4,
        vesselCode: "MV-004",
        vesselName: "Coastal Runner",
        vesselType: "support",
        vesselStatus: "restricted",
        title: "Pump Replacement",
        description: "Replace freshwater pump",
        maintenanceType: "mechanical",
        status: "cancelled",
        priority: "low",
        scheduledAt: "2026-08-30T08:00:00.000Z",
        completedAt: null,
        cost: 800
      }
    ]);

    expect(response.body.generatedAt).toEqual(expect.any(String));
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("GET /api/maintenance handles an empty result set", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .get("/api/maintenance");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        summary: {
          totalRecords: 0,
          scheduled: 0,
          inProgress: 0,
          completed: 0,
          cancelled: 0,
          lowPriority: 0,
          mediumPriority: 0,
          highPriority: 0,
          criticalPriority: 0,
          totalCost: 0
        },
        records: []
      },
      generatedAt: expect.any(String)
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("GET /api/maintenance handles zero and null costs", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: "5",
          vessel_id: "5",
          title: "Minor Inspection",
          description: null,
          maintenance_type: "inspection",
          status: "scheduled",
          priority: "low",
          scheduled_at: "2026-09-08T08:00:00.000Z",
          completed_at: null,
          cost: null,
          vessel_code: "MV-005",
          vessel_name: "Harbor Star",
          vessel_type: "support",
          vessel_status: "active"
        },
        {
          id: "6",
          vessel_id: "5",
          title: "Safety Check",
          description: "Routine safety check",
          maintenance_type: "inspection",
          status: "scheduled",
          priority: "low",
          scheduled_at: "2026-09-09T08:00:00.000Z",
          completed_at: null,
          cost: "0",
          vessel_code: "MV-005",
          vessel_name: "Harbor Star",
          vessel_type: "support",
          vessel_status: "active"
        }
      ]
    ]);

    const response = await request(app)
      .get("/api/maintenance");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.summary).toEqual({
      totalRecords: 2,
      scheduled: 2,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      lowPriority: 2,
      mediumPriority: 0,
      highPriority: 0,
      criticalPriority: 0,
      totalCost: 0
    });

    expect(response.body.data.records).toEqual([
      {
        id: 5,
        vesselId: 5,
        vesselCode: "MV-005",
        vesselName: "Harbor Star",
        vesselType: "support",
        vesselStatus: "active",
        title: "Minor Inspection",
        description: null,
        maintenanceType: "inspection",
        status: "scheduled",
        priority: "low",
        scheduledAt: "2026-09-08T08:00:00.000Z",
        completedAt: null,
        cost: 0
      },
      {
        id: 6,
        vesselId: 5,
        vesselCode: "MV-005",
        vesselName: "Harbor Star",
        vesselType: "support",
        vesselStatus: "active",
        title: "Safety Check",
        description: "Routine safety check",
        maintenanceType: "inspection",
        status: "scheduled",
        priority: "low",
        scheduledAt: "2026-09-09T08:00:00.000Z",
        completedAt: null,
        cost: 0
      }
    ]);
  });

  test("GET /api/maintenance returns 500 when the database query fails", async () => {
    const databaseError = new Error("Database unavailable");

    pool.query.mockRejectedValueOnce(databaseError);

    const response = await request(app)
      .get("/api/maintenance");

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      success: false,
      error: "Unable to load maintenance data"
    });

    expect(pool.query).toHaveBeenCalledTimes(1);

    expect(logger.error).toHaveBeenCalledWith(
      { err: databaseError },
      "Maintenance API error"
    );
  });
});
