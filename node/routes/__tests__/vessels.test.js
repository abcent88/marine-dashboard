const express = require("express");
const session = require("express-session");
const request = require("supertest");

jest.mock("../../db", () => ({
  execute: jest.fn(),
  query: jest.fn()
}));

const pool = require("../../db");
const vesselRoutes = require("../vessels");

const app = express();

app.use(express.json());

app.use(
  session({
    secret: "test-session-secret",
    resave: false,
    saveUninitialized: false
  })
);

app.use((req, res, next) => {
  req.session.user = {
    id: 1,
    fullName: "Test Admin",
    email: "admin@example.com",
    role: "admin",
    status: "active"
  };

  next();
});

app.use("/api/vessels", vesselRoutes);

describe("Vessel routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    pool.execute.mockResolvedValue([
      [{
        id: 1,
        full_name: "Test Admin",
        email: "admin@example.com",
        role: "admin",
        status: "active"
      }]
    ]);
  });

  test("GET /api/vessels returns non-retired vessels", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: 1,
          vessel_code: "MD-001",
          name: "Marine Explorer",
          vessel_type: "Fishing Vessel",
          flag_country: "Nigeria",
          imo_number: "IMO1234567",
          call_sign: "5NME",
          capacity_tons: "250.00",
          status: "active",
          commissioned_date: "2026-01-15",
          created_at: "2026-01-15T10:00:00.000Z",
          updated_at: "2026-01-15T10:00:00.000Z",
          home_port_id: 10,
          home_port_name: "Lagos Port",
          home_port_country: "Nigeria",
          home_port_code: "LOS"
        }
      ]
    ]);

    const response = await request(app)
      .get("/api/vessels");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);
    expect(response.body.data[0]).toEqual({
      id: 1,
      vesselCode: "MD-001",
      name: "Marine Explorer",
      vesselType: "Fishing Vessel",
      flagCountry: "Nigeria",
      imoNumber: "IMO1234567",
      callSign: "5NME",
      capacityTons: 250,
      status: "active",
      commissionedDate: "2026-01-15",
      homePort: {
        id: 10,
        name: "Lagos Port",
        country: "Nigeria",
        code: "LOS"
      },
      createdAt: "2026-01-15T10:00:00.000Z",
      updatedAt: "2026-01-15T10:00:00.000Z"
    });
  });

  test("POST /api/vessels rejects missing required fields", async () => {
    const response = await request(app)
      .post("/api/vessels")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "vesselCode, name and vesselType are required"
    });

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /api/vessels rejects an invalid vessel status", async () => {
    const response = await request(app)
      .post("/api/vessels")
      .send({
        vesselCode: "MD-002",
        name: "Ocean Runner",
        vesselType: "Cargo Vessel",
        status: "invalid_status"
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "Invalid vessel status"
    });

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /api/vessels rejects an invalid homePortId", async () => {
    const response = await request(app)
      .post("/api/vessels")
      .send({
        vesselCode: "MD-003",
        name: "Atlantic Star",
        vesselType: "Fishing Vessel",
        status: "active",
        homePortId: 0
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "homePortId must be a positive integer"
    });

    expect(pool.query).not.toHaveBeenCalled();
  });
});
