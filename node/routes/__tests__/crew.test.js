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
const crewRoutes = require("../crew");

const app = express();

app.use(express.json());
app.use("/api/crew", crewRoutes);

describe("Crew routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/crew returns crew with summary", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: "1",
          user_id: "101",
          vessel_id: "10",
          employee_code: "CREW-001",
          full_name: "John Captain",
          position: "Captain",
          phone: "+234800000001",
          certification: "Master Mariner",
          status: "active",
          joined_at: "2025-01-10T00:00:00.000Z",
          vessel_code: "FV-010",
          vessel_name: "Ocean Star",
          vessel_type: "Fishing Vessel",
          vessel_status: "active"
        },
        {
          id: "2",
          user_id: "102",
          vessel_id: "10",
          employee_code: "CREW-002",
          full_name: "Mary Engineer",
          position: "Chief Engineer",
          phone: "+234800000002",
          certification: "Marine Engineer",
          status: "active",
          joined_at: "2025-02-15T00:00:00.000Z",
          vessel_code: "FV-010",
          vessel_name: "Ocean Star",
          vessel_type: "Fishing Vessel",
          vessel_status: "active"
        },
        {
          id: "3",
          user_id: null,
          vessel_id: "20",
          employee_code: "CREW-003",
          full_name: "Peter Deckhand",
          position: "Deckhand",
          phone: "+234800000003",
          certification: "STCW",
          status: "on_leave",
          joined_at: "2025-03-20T00:00:00.000Z",
          vessel_code: "FV-020",
          vessel_name: "Atlantic Star",
          vessel_type: "Cargo Vessel",
          vessel_status: "restricted"
        },
        {
          id: "4",
          user_id: "104",
          vessel_id: null,
          employee_code: "CREW-004",
          full_name: "Sarah Officer",
          position: "Safety Officer",
          phone: "+234800000004",
          certification: "Safety Management",
          status: "inactive",
          joined_at: "2025-04-25T00:00:00.000Z",
          vessel_code: null,
          vessel_name: null,
          vessel_type: null,
          vessel_status: null
        },
        {
          id: "5",
          user_id: "105",
          vessel_id: "20",
          employee_code: "CREW-005",
          full_name: "David Cook",
          position: "Cook",
          phone: "+234800000005",
          certification: "Food Safety",
          status: "active",
          joined_at: "2025-05-30T00:00:00.000Z",
          vessel_code: "FV-020",
          vessel_name: "Atlantic Star",
          vessel_type: "Cargo Vessel",
          vessel_status: "restricted"
        }
      ]
    ]);

    const response = await request(app)
      .get("/api/crew");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.summary).toEqual({
      totalCrew: 5,
      active: 3,
      onLeave: 1,
      inactive: 1,
      assignedVessels: 2
    });

    expect(response.body.data.crew).toEqual([
      {
        id: 1,
        userId: 101,
        vesselId: 10,
        employeeCode: "CREW-001",
        fullName: "John Captain",
        position: "Captain",
        phone: "+234800000001",
        certification: "Master Mariner",
        status: "active",
        joinedAt: "2025-01-10T00:00:00.000Z",
        vesselCode: "FV-010",
        vesselName: "Ocean Star",
        vesselType: "Fishing Vessel",
        vesselStatus: "active"
      },
      {
        id: 2,
        userId: 102,
        vesselId: 10,
        employeeCode: "CREW-002",
        fullName: "Mary Engineer",
        position: "Chief Engineer",
        phone: "+234800000002",
        certification: "Marine Engineer",
        status: "active",
        joinedAt: "2025-02-15T00:00:00.000Z",
        vesselCode: "FV-010",
        vesselName: "Ocean Star",
        vesselType: "Fishing Vessel",
        vesselStatus: "active"
      },
      {
        id: 3,
        userId: null,
        vesselId: 20,
        employeeCode: "CREW-003",
        fullName: "Peter Deckhand",
        position: "Deckhand",
        phone: "+234800000003",
        certification: "STCW",
        status: "on_leave",
        joinedAt: "2025-03-20T00:00:00.000Z",
        vesselCode: "FV-020",
        vesselName: "Atlantic Star",
        vesselType: "Cargo Vessel",
        vesselStatus: "restricted"
      },
      {
        id: 4,
        userId: 104,
        vesselId: null,
        employeeCode: "CREW-004",
        fullName: "Sarah Officer",
        position: "Safety Officer",
        phone: "+234800000004",
        certification: "Safety Management",
        status: "inactive",
        joinedAt: "2025-04-25T00:00:00.000Z",
        vesselCode: null,
        vesselName: null,
        vesselType: null,
        vesselStatus: null
      },
      {
        id: 5,
        userId: 105,
        vesselId: 20,
        employeeCode: "CREW-005",
        fullName: "David Cook",
        position: "Cook",
        phone: "+234800000005",
        certification: "Food Safety",
        status: "active",
        joinedAt: "2025-05-30T00:00:00.000Z",
        vesselCode: "FV-020",
        vesselName: "Atlantic Star",
        vesselType: "Cargo Vessel",
        vesselStatus: "restricted"
      }
    ]);

    expect(response.body.generatedAt).toEqual(expect.any(String));
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("GET /api/crew handles an empty result set", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .get("/api/crew");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.summary).toEqual({
      totalCrew: 0,
      active: 0,
      onLeave: 0,
      inactive: 0,
      assignedVessels: 0
    });

    expect(response.body.data.crew).toEqual([]);
  });

  test("GET /api/crew returns 500 when the database query fails", async () => {
    const databaseError = new Error("Database unavailable");

    pool.query.mockRejectedValueOnce(databaseError);

    const response = await request(app)
      .get("/api/crew");

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      success: false,
      error: "Unable to load crew data"
    });

    expect(pool.query).toHaveBeenCalledTimes(1);

    expect(logger.error).toHaveBeenCalledWith(
      { err: databaseError },
      "Crew API error"
    );
  });
});
