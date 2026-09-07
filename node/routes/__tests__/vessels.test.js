const express = require("express");
const request = require("supertest");

jest.mock("../../db", () => ({
  query: jest.fn()
}));

jest.mock("../../lib/logger", () => ({
  error: jest.fn()
}));

jest.mock("../../middleware/auth", () => ({
  requireRole: jest.fn(() => (req, res, next) => next())
}));

const pool = require("../../db");
const logger = require("../../lib/logger");
const vesselRoutes = require("../vessels");

const app = express();

app.use(express.json());
app.use("/api/vessels", vesselRoutes);

describe("Vessels routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/vessels returns vessels with and without home ports", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: "1",
          vessel_code: "MV-001",
          name: "Atlantic Star",
          vessel_type: "longliner",
          flag_country: "Nigeria",
          imo_number: "IMO1234567",
          call_sign: "5N-AS1",
          mmsi: "636019001",
          capacity_tons: "500.50",
          status: "active",
          commissioned_date: "2020-05-15T00:00:00.000Z",
          created_at: "2026-01-01T10:00:00.000Z",
          updated_at: "2026-09-01T10:00:00.000Z",
          home_port_id: "1",
          home_port_name: "Lagos Port",
          home_port_country: "Nigeria",
          home_port_code: "LAG"
        },
        {
          id: "2",
          vessel_code: "MV-002",
          name: "Ocean Pioneer",
          vessel_type: "trawler",
          flag_country: null,
          imo_number: null,
          call_sign: null,
          capacity_tons: "800",
          status: "active",
          commissioned_date: null,
          created_at: "2026-01-02T10:00:00.000Z",
          updated_at: "2026-09-02T10:00:00.000Z",
          home_port_id: null,
          home_port_name: null,
          home_port_country: null,
          home_port_code: null
        }
      ]
    ]);

    const response = await request(app)
      .get("/api/vessels");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(2);

    expect(response.body.data).toEqual([
      {
        id: 1,
        vesselCode: "MV-001",
        name: "Atlantic Star",
        vesselType: "longliner",
        flagCountry: "Nigeria",
        imoNumber: "IMO1234567",
        callSign: "5N-AS1",
        mmsi: "636019001",
        capacityTons: 500.5,
        status: "active",
        commissionedDate: "2020-05-15",
        homePort: {
          id: 1,
          name: "Lagos Port",
          country: "Nigeria",
          code: "LAG"
        },
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-09-01T10:00:00.000Z"
      },
      {
        id: 2,
        vesselCode: "MV-002",
        name: "Ocean Pioneer",
        vesselType: "trawler",
        flagCountry: null,
        imoNumber: null,
        callSign: null,
        capacityTons: 800,
        status: "active",
        commissionedDate: null,
        homePort: null,
        createdAt: "2026-01-02T10:00:00.000Z",
        updatedAt: "2026-09-02T10:00:00.000Z"
      }
    ]);

    expect(response.body.generatedAt).toEqual(expect.any(String));
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("GET /api/vessels handles an empty result set", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .get("/api/vessels");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      success: true,
      count: 0,
      data: [],
      generatedAt: expect.any(String)
    });
  });

  test("GET /api/vessels returns 500 when database query fails", async () => {
    const databaseError = new Error("Database unavailable");

    pool.query.mockRejectedValueOnce(databaseError);

    const response = await request(app)
      .get("/api/vessels");

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      success: false,
      error: "Unable to load vessels"
    });

    expect(logger.error).toHaveBeenCalledWith(
      { err: databaseError },
      "Vessels API error"
    );
  });

  test("POST /api/vessels creates a vessel with a home port", async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 7 }]])
      .mockResolvedValueOnce([{ insertId: 7 }])
      .mockResolvedValueOnce([
        [{
          id: "7",
          vessel_code: "MV-007",
          name: "New Horizon",
          vessel_type: "trawler",
          flag_country: "Nigeria",
          imo_number: "IMO7654321",
          call_sign: "5N-NH7",
          mmsi: "636019007",
          capacity_tons: "650",
          status: "active",
          commissioned_date: "2026-09-06",
          created_at: "2026-09-06T10:00:00.000Z",
          updated_at: "2026-09-06T10:00:00.000Z",
          home_port_id: "7",
          home_port_name: "Lagos Port",
          home_port_country: "Nigeria",
          home_port_code: "LAG"
        }]
      ]);

    const response = await request(app)
      .post("/api/vessels")
      .send({
        vesselCode: "  MV-007  ",
        name: "  New Horizon  ",
        vesselType: "  trawler  ",
        flagCountry: " Nigeria ",
        imoNumber: " IMO7654321 ",
        callSign: " 5N-NH7 ",
        mmsi: " 636019007 ",
        capacityTons: "650",
        status: "active",
        homePortId: "7",
        commissionedDate: "2026-09-06"
      });

    expect(response.status).toBe(201);

    expect(response.body).toEqual({
      success: true,
      message: "Vessel created successfully",
      data: {
        id: 7,
        vesselCode: "MV-007",
        name: "New Horizon",
        vesselType: "trawler",
        flagCountry: "Nigeria",
        imoNumber: "IMO7654321",
        callSign: "5N-NH7",
        mmsi: "636019007",
        capacityTons: 650,
        status: "active",
        commissionedDate: "2026-09-06",
        homePort: {
          id: 7,
          name: "Lagos Port",
          country: "Nigeria",
          code: "LAG"
        },
        createdAt: "2026-09-06T10:00:00.000Z",
        updatedAt: "2026-09-06T10:00:00.000Z"
      }
    });

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      "SELECT id FROM ports WHERE id = ? LIMIT 1",
      [7]
    );

    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  test("POST /api/vessels creates a vessel with default status and no home port", async () => {
    pool.query
      .mockResolvedValueOnce([{ insertId: 8 }])
      .mockResolvedValueOnce([
        [{
          id: "8",
          vessel_code: "MV-008",
          name: "Sea Guardian",
          vessel_type: "support",
          flag_country: null,
          imo_number: null,
          call_sign: null,
          capacity_tons: "0",
          status: "active",
          commissioned_date: null,
          created_at: "2026-09-06T11:00:00.000Z",
          updated_at: "2026-09-06T11:00:00.000Z",
          home_port_id: null,
          home_port_name: null,
          home_port_country: null,
          home_port_code: null
        }]
      ]);

    const response = await request(app)
      .post("/api/vessels")
      .send({
        vesselCode: "MV-008",
        name: "Sea Guardian",
        vesselType: "support"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("active");
    expect(response.body.data.capacityTons).toBe(0);
    expect(response.body.data.homePort).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test.each([
    [{}, "vesselCode, name and vesselType are required"],
    [{ vesselCode: "MV-001" }, "vesselCode, name and vesselType are required"],
    [{ vesselCode: "MV-001", name: "Test" }, "vesselCode, name and vesselType are required"]
  ])("POST /api/vessels validates required fields", async (body, error) => {
    const response = await request(app)
      .post("/api/vessels")
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error
    });

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /api/vessels rejects an invalid status", async () => {
    const response = await request(app)
      .post("/api/vessels")
      .send({
        vesselCode: "MV-009",
        name: "Invalid Status",
        vesselType: "support",
        status: "unknown"
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "Invalid vessel status"
    });

    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each([
    ["12345678", "mmsi must be a 9-digit number"],
    ["1234567890", "mmsi must be a 9-digit number"],
    ["12345ABCD", "mmsi must be a 9-digit number"]
  ])("POST /api/vessels rejects invalid MMSI %s", async (mmsi, error) => {
    const response = await request(app)
      .post("/api/vessels")
      .send({
        vesselCode: "MV-009",
        name: "MMSI Test",
        vesselType: "support",
        mmsi
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error
    });

    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each([
    ["-10", "capacityTons must be a non-negative number"],
    ["not-a-number", "capacityTons must be a non-negative number"]
  ])("POST /api/vessels rejects invalid capacity %s", async (capacityTons, error) => {
    const response = await request(app)
      .post("/api/vessels")
      .send({
        vesselCode: "MV-009",
        name: "Capacity Test",
        vesselType: "support",
        capacityTons
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error
    });

    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each([
    ["abc", "homePortId must be a positive integer"],
    ["0", "homePortId must be a positive integer"],
    ["-2", "homePortId must be a positive integer"]
  ])("POST /api/vessels rejects invalid homePortId %s", async (homePortId, error) => {
    const response = await request(app)
      .post("/api/vessels")
      .send({
        vesselCode: "MV-010",
        name: "Port Test",
        vesselType: "support",
        homePortId
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error
    });

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /api/vessels rejects an unknown home port", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .post("/api/vessels")
      .send({
        vesselCode: "MV-011",
        name: "Unknown Port",
        vesselType: "support",
        homePortId: 999
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      success: false,
      error: "Home port not found"
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("POST /api/vessels rejects an invalid commissioned date", async () => {
    const response = await request(app)
      .post("/api/vessels")
      .send({
        vesselCode: "MV-012",
        name: "Date Test",
        vesselType: "support",
        commissionedDate: "06-09-2026"
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      success: false,
      error: "commissionedDate must use YYYY-MM-DD format"
    });

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /api/vessels returns 409 for duplicate vessel data", async () => {
    const duplicateError = new Error("Duplicate");
    duplicateError.code = "ER_DUP_ENTRY";

    pool.query.mockRejectedValueOnce(duplicateError);

    const response = await request(app)
      .post("/api/vessels")
      .send({
        vesselCode: "MV-001",
        name: "Duplicate Vessel",
        vesselType: "trawler"
      });

    expect(response.status).toBe(409);

    expect(response.body).toEqual({
      success: false,
      error: "Vessel code, IMO number, or MMSI already exists"
    });

    expect(logger.error).toHaveBeenCalledWith(
      { err: duplicateError },
      "Create vessel API error"
    );
  });

  test("POST /api/vessels returns 500 for an unexpected database error", async () => {
    const databaseError = new Error("Database unavailable");

    pool.query.mockRejectedValueOnce(databaseError);

    const response = await request(app)
      .post("/api/vessels")
      .send({
        vesselCode: "MV-013",
        name: "Database Failure",
        vesselType: "trawler"
      });

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      success: false,
      error: "Unable to create vessel"
    });

    expect(logger.error).toHaveBeenCalledWith(
      { err: databaseError },
      "Create vessel API error"
    );
  });

  test("PUT /api/vessels/:id updates a vessel with a home port", async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 4 }]])
      .mockResolvedValueOnce([[{ id: 4 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[
        {
          id: "4",
          vessel_code: "MV-004",
          name: "Updated Runner",
          vessel_type: "support",
          flag_country: "Nigeria",
          imo_number: "IMO4444444",
          call_sign: "5N-UR4",
          mmsi: "636019004",
          capacity_tons: "900",
          status: "restricted",
          commissioned_date: "2024-03-10",
          created_at: "2026-01-01T10:00:00.000Z",
          updated_at: "2026-09-06T12:00:00.000Z",
          home_port_id: "4",
          home_port_name: "Calabar Port",
          home_port_country: "Nigeria",
          home_port_code: "CAL"
        }
      ]]);

    const response = await request(app)
      .put("/api/vessels/4")
      .send({
        vesselCode: " MV-004 ",
        name: " Updated Runner ",
        vesselType: " support ",
        flagCountry: " Nigeria ",
        imoNumber: " IMO4444444 ",
        callSign: " 5N-UR4 ",
        mmsi: "636019004 ",
        capacityTons: "900",
        status: "restricted",
        homePortId: "4",
        commissionedDate: "2024-03-10"
      });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      success: true,
      message: "Vessel updated successfully",
      data: {
        id: 4,
        vesselCode: "MV-004",
        name: "Updated Runner",
        vesselType: "support",
        flagCountry: "Nigeria",
        imoNumber: "IMO4444444",
        callSign: "5N-UR4",
        mmsi: "636019004",
        capacityTons: 900,
        status: "restricted",
        commissionedDate: "2024-03-10",
        homePort: {
          id: 4,
          name: "Calabar Port",
          country: "Nigeria",
          code: "CAL"
        },
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-09-06T12:00:00.000Z"
      }
    });

    expect(pool.query).toHaveBeenCalledTimes(4);
  });

  test("PUT /api/vessels/:id updates a vessel without a home port", async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 5 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[
        {
          id: "5",
          vessel_code: "MV-005",
          name: "Updated Harbor",
          vessel_type: "support",
          flag_country: null,
          imo_number: null,
          call_sign: null,
          capacity_tons: "100",
          status: "active",
          commissioned_date: null,
          created_at: "2026-01-01T10:00:00.000Z",
          updated_at: "2026-09-06T12:00:00.000Z",
          home_port_id: null,
          home_port_name: null,
          home_port_country: null,
          home_port_code: null
        }
      ]]);

    const response = await request(app)
      .put("/api/vessels/5")
      .send({
        vesselCode: "MV-005",
        name: "Updated Harbor",
        vesselType: "support",
        capacityTons: 100,
        status: "active",
        homePortId: ""
      });

    expect(response.status).toBe(200);
    expect(response.body.data.homePort).toBeNull();
    expect(response.body.data.capacityTons).toBe(100);
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  test.each([
    ["abc", "Invalid vessel ID"],
    ["0", "Invalid vessel ID"],
    ["-1", "Invalid vessel ID"],
    ["1.5", "Invalid vessel ID"]
  ])("PUT /api/vessels/:id rejects invalid ID %s", async (id, error) => {
    const response = await request(app)
      .put(`/api/vessels/${id}`)
      .send({});

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      success: false,
      error
    });

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("PUT /api/vessels/:id rejects missing required fields", async () => {
    const response = await request(app)
      .put("/api/vessels/1")
      .send({
        vesselCode: "MV-001",
        name: "Only Name"
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      success: false,
      error: "vesselCode, name and vesselType are required"
    });
  });

  test.each([
    ["12345678", "mmsi must be a 9-digit number"],
    ["1234567890", "mmsi must be a 9-digit number"],
    ["12345ABCD", "mmsi must be a 9-digit number"]
  ])("PUT /api/vessels/:id rejects invalid MMSI %s", async (mmsi, error) => {
    const response = await request(app)
      .put("/api/vessels/1")
      .send({
        vesselCode: "MV-001",
        name: "MMSI Test",
        vesselType: "support",
        mmsi
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error
    });

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("PUT /api/vessels/:id rejects an invalid status", async () => {
    const response = await request(app)
      .put("/api/vessels/1")
      .send({
        vesselCode: "MV-001",
        name: "Test",
        vesselType: "support",
        capacityTons: 100,
        status: "unknown"
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      success: false,
      error: "Invalid vessel status"
    });
  });

  test("PUT /api/vessels/:id rejects invalid capacity", async () => {
    const response = await request(app)
      .put("/api/vessels/1")
      .send({
        vesselCode: "MV-001",
        name: "Test",
        vesselType: "support",
        capacityTons: -5,
        status: "active"
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      success: false,
      error: "capacityTons must be a non-negative number"
    });
  });

  test("PUT /api/vessels/:id rejects an invalid home port ID", async () => {
    const response = await request(app)
      .put("/api/vessels/1")
      .send({
        vesselCode: "MV-001",
        name: "Test",
        vesselType: "support",
        capacityTons: 100,
        status: "active",
        homePortId: "abc"
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      success: false,
      error: "homePortId must be a positive integer"
    });
  });

  test("PUT /api/vessels/:id rejects an unknown home port", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .put("/api/vessels/1")
      .send({
        vesselCode: "MV-001",
        name: "Test",
        vesselType: "support",
        capacityTons: 100,
        status: "active",
        homePortId: 999
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      success: false,
      error: "Home port not found"
    });
  });

  test("PUT /api/vessels/:id rejects an invalid commissioned date", async () => {
    const response = await request(app)
      .put("/api/vessels/1")
      .send({
        vesselCode: "MV-001",
        name: "Test",
        vesselType: "support",
        capacityTons: 100,
        status: "active",
        commissionedDate: "2026/09/06"
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      success: false,
      error: "commissionedDate must use YYYY-MM-DD format"
    });
  });

  test("PUT /api/vessels/:id returns 404 when vessel does not exist", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .put("/api/vessels/999")
      .send({
        vesselCode: "MV-999",
        name: "Missing Vessel",
        vesselType: "support",
        capacityTons: 100,
        status: "active"
      });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      success: false,
      error: "Vessel not found"
    });
  });

  test("PUT /api/vessels/:id returns 409 for duplicate vessel data", async () => {
    const duplicateError = new Error("Duplicate");
    duplicateError.code = "ER_DUP_ENTRY";

    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockRejectedValueOnce(duplicateError);

    const response = await request(app)
      .put("/api/vessels/1")
      .send({
        vesselCode: "MV-001",
        name: "Duplicate",
        vesselType: "support",
        capacityTons: 100,
        status: "active"
      });

    expect(response.status).toBe(409);

    expect(response.body).toEqual({
      success: false,
      error: "Vessel code, IMO number, or MMSI already exists"
    });

    expect(logger.error).toHaveBeenCalledWith(
      { err: duplicateError },
      "Update vessel API error"
    );
  });

  test("PUT /api/vessels/:id returns 500 for an unexpected database error", async () => {
    const databaseError = new Error("Database unavailable");

    pool.query.mockRejectedValueOnce(databaseError);

    const response = await request(app)
      .put("/api/vessels/1")
      .send({
        vesselCode: "MV-001",
        name: "Failure",
        vesselType: "support",
        capacityTons: 100,
        status: "active"
      });

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      success: false,
      error: "Unable to update vessel"
    });

    expect(logger.error).toHaveBeenCalledWith(
      { err: databaseError },
      "Update vessel API error"
    );
  });

  test("PATCH /api/vessels/:id/retire retires an active vessel", async () => {
    pool.query
      .mockResolvedValueOnce([[
        {
          id: "2",
          vessel_code: "MV-002",
          name: "Ocean Pioneer",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[
        {
          id: "2",
          vessel_code: "MV-002",
          name: "Ocean Pioneer",
          vessel_type: "trawler",
          flag_country: "Nigeria",
          imo_number: "IMO2222222",
          call_sign: "5N-OP2",
          capacity_tons: "800",
          status: "retired",
          commissioned_date: "2021-01-15",
          created_at: "2026-01-01T10:00:00.000Z",
          updated_at: "2026-09-06T12:00:00.000Z",
          home_port_id: "1",
          home_port_name: "Lagos Port",
          home_port_country: "Nigeria",
          home_port_code: "LAG"
        }
      ]]);

    const response = await request(app)
      .patch("/api/vessels/2/retire");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      success: true,
      message: "Vessel retired successfully",
      data: {
        id: 2,
        vesselCode: "MV-002",
        name: "Ocean Pioneer",
        vesselType: "trawler",
        flagCountry: "Nigeria",
        imoNumber: "IMO2222222",
        callSign: "5N-OP2",
        capacityTons: 800,
        status: "retired",
        commissionedDate: "2021-01-15",
        homePort: {
          id: 1,
          name: "Lagos Port",
          country: "Nigeria",
          code: "LAG"
        },
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-09-06T12:00:00.000Z"
      }
    });

    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  test.each([
    ["abc", "Invalid vessel ID"],
    ["0", "Invalid vessel ID"],
    ["-1", "Invalid vessel ID"]
  ])("PATCH /api/vessels/:id/retire rejects invalid ID %s", async (id, error) => {
    const response = await request(app)
      .patch(`/api/vessels/${id}/retire`);

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      success: false,
      error
    });

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("PATCH /api/vessels/:id/retire returns 404 when vessel does not exist", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .patch("/api/vessels/999/retire");

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      success: false,
      error: "Vessel not found"
    });
  });

  test("PATCH /api/vessels/:id/retire returns 409 when vessel is already retired", async () => {
    pool.query.mockResolvedValueOnce([[
      {
        id: "6",
        vessel_code: "MV-006",
        name: "Retired Vessel",
        status: "retired"
      }
    ]]);

    const response = await request(app)
      .patch("/api/vessels/6/retire");

    expect(response.status).toBe(409);

    expect(response.body).toEqual({
      success: false,
      error: "Vessel is already retired"
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("PATCH /api/vessels/:id/retire returns 500 when database fails", async () => {
    const databaseError = new Error("Database unavailable");

    pool.query.mockRejectedValueOnce(databaseError);

    const response = await request(app)
      .patch("/api/vessels/2/retire");

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      success: false,
      error: "Unable to retire vessel"
    });

    expect(logger.error).toHaveBeenCalledWith(
      { err: databaseError },
      "Retire vessel API error"
    );
  });

  test("GET /api/vessels/:id/position returns the latest position", async () => {
    pool.query.mockResolvedValueOnce([[
      {
        id: "100",
        vessel_id: "2",
        latitude: "4.8123",
        longitude: "4.9012",
        speed_knots: "12.5",
        heading_degrees: "118",
        position_source: "ais",
        source_device_id: "local-test-01",
        source_timestamp: "2026-09-06T11:40:00.000Z",
        recorded_at: "2026-09-06T11:41:00.000Z",
        vessel_code: "MV-002",
        mmsi: "999000001",
        vessel_name: "Ocean Pioneer"
      }
    ]]);

    const response = await request(app)
      .get("/api/vessels/2/position");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        id: 100,
        vesselId: 2,
        vesselCode: "MV-002",
        vesselName: "Ocean Pioneer",
        mmsi: "999000001",
        latitude: 4.8123,
        longitude: 4.9012,
        speedKnots: 12.5,
        headingDegrees: 118,
        positionSource: "ais",
        sourceDeviceId: "local-test-01",
        sourceTimestamp: "2026-09-06T11:40:00.000Z",
        recordedAt: "2026-09-06T11:41:00.000Z"
      },
      generatedAt: expect.any(String)
    });
  });

  test.each([
    ["abc", "Invalid vessel ID"],
    ["0", "Invalid vessel ID"],
    ["-1", "Invalid vessel ID"],
    ["1.5", "Invalid vessel ID"]
  ])("GET /api/vessels/:id/position rejects invalid ID %s", async (id, error) => {
    const response = await request(app)
      .get(`/api/vessels/${id}/position`);

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      success: false,
      error
    });

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("GET /api/vessels/:id/position returns 404 when no position exists", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .get("/api/vessels/2/position");

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      success: false,
      error: "No position data found for vessel"
    });
  });

  test("GET /api/vessels/:id/position returns 500 when database fails", async () => {
    const databaseError = new Error("Database unavailable");

    pool.query.mockRejectedValueOnce(databaseError);

    const response = await request(app)
      .get("/api/vessels/2/position");

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      success: false,
      error: "Unable to load vessel position"
    });

    expect(logger.error).toHaveBeenCalledWith(
      { err: databaseError },
      "Vessel position API error"
    );
  });

  test("GET /api/vessels/:id returns vessel details with a home port", async () => {
    pool.query.mockResolvedValueOnce([[
      {
        id: "3",
        vessel_code: "MV-003",
        name: "Pacific Dawn",
        vessel_type: "carrier",
        flag_country: "Ghana",
        imo_number: "IMO3333333",
        call_sign: "9G-PD3",
        capacity_tons: "1200",
        status: "maintenance",
        commissioned_date: "2019-07-20",
        created_at: "2026-01-01T10:00:00.000Z",
        updated_at: "2026-09-06T12:00:00.000Z",
        home_port_id: "3",
        home_port_name: "Tema Port",
        home_port_country: "Ghana",
        home_port_code: "TEM"
      }
    ]]);

    const response = await request(app)
      .get("/api/vessels/3");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        id: 3,
        vesselCode: "MV-003",
        name: "Pacific Dawn",
        vesselType: "carrier",
        flagCountry: "Ghana",
        imoNumber: "IMO3333333",
        callSign: "9G-PD3",
        capacityTons: 1200,
        status: "maintenance",
        commissionedDate: "2019-07-20",
        homePort: {
          id: 3,
          name: "Tema Port",
          country: "Ghana",
          code: "TEM"
        },
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-09-06T12:00:00.000Z"
      }
    });
  });

  test.each([
    ["abc", "Invalid vessel ID"],
    ["0", "Invalid vessel ID"],
    ["-1", "Invalid vessel ID"],
    ["1.5", "Invalid vessel ID"]
  ])("GET /api/vessels/:id rejects invalid ID %s", async (id, error) => {
    const response = await request(app)
      .get(`/api/vessels/${id}`);

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      success: false,
      error
    });

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("GET /api/vessels/:id returns 404 when vessel does not exist", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .get("/api/vessels/999");

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      success: false,
      error: "Vessel not found"
    });
  });

  test("GET /api/vessels/:id returns 500 when database fails", async () => {
    const databaseError = new Error("Database unavailable");

    pool.query.mockRejectedValueOnce(databaseError);

    const response = await request(app)
      .get("/api/vessels/3");

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      success: false,
      error: "Unable to load vessel"
    });

    expect(logger.error).toHaveBeenCalledWith(
      { err: databaseError },
      "Vessel detail API error"
    );
  });
});
