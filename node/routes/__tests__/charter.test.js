const express = require("express");
const request = require("supertest");

jest.mock("../../db", () => ({
  query: jest.fn()
}));

jest.mock("../../lib/logger", () => ({
  error: jest.fn()
}));

let mockUserId = 7;

jest.mock("../../middleware/auth", () => ({
  requireAuth: jest.fn((req, res, next) => {
    req.session = {
      user: {
        id: mockUserId,
        role: "viewer"
      }
    };
    next();
  })
}));

const pool = require("../../db");
const charterRoutes = require("../charter");
const { requireAuth } = require("../../middleware/auth");

const app = express();

app.use(express.json());
app.use("/api/charter", requireAuth, charterRoutes);

describe("Charter routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/charter/enquiries creates an enquiry", async () => {
    pool.query
      .mockResolvedValueOnce([
        [{
          id: 25,
          listed_by_user_id: 12,
          listing_status: "published",
          verification_status: "verified",
          availability_status: "available"
        }]
      ])
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([[{ id: 20 }]])
      .mockResolvedValueOnce([{ insertId: 3 }])
      .mockResolvedValueOnce([[
        {
          id: 3,
          listing_id: 25,
          requester_user_id: 7,
          cargo_type: "Crude Oil",
          cargo_quantity_tons: "50000.00",
          origin_port_id: 10,
          destination_port_id: 20,
          requested_start_date: "2026-10-01",
          requested_end_date: "2026-10-20",
          message: "Please provide your best voyage charter terms.",
          status: "submitted",
          created_at: "2026-09-08 12:00:00",
          updated_at: "2026-09-08 12:00:00"
        }
      ]]);


    const response = await request(app)
      .post("/api/charter/enquiries")
      .send({
        listingId: 25,
        cargoType: "Crude Oil",
        cargoQuantityTons: 50000,
        originPortId: 10,
        destinationPortId: 20,
        requestedStartDate: "2026-10-01",
        requestedEndDate: "2026-10-20",
        message: "Please provide your best voyage charter terms."
      });

    console.log("RESPONSE:", JSON.stringify(response.body, null, 2));
    console.log("DB CALLS:", JSON.stringify(pool.query.mock.calls, null, 2));

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: 3,
      listingId: 25,
      requesterUserId: 7,
      cargoType: "Crude Oil",
      cargoQuantityTons: 50000,
      originPortId: 10,
      destinationPortId: 20,
      requestedStartDate: "2026-10-01",
      requestedEndDate: "2026-10-20",
      status: "submitted"
    });

    expect(pool.query).toHaveBeenCalledTimes(5);
  });

  test("POST /api/charter/enquiries rejects missing listingId", async () => {
    const response = await request(app)
      .post("/api/charter/enquiries")
      .send({
        cargoType: "Crude Oil"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "listingId must be a positive integer"
    );

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /api/charter/enquiries rejects unavailable listing", async () => {
    pool.query.mockResolvedValueOnce([
      [{
        id: 25,
        listed_by_user_id: 12,
        listing_status: "published",
        verification_status: "pending",
        availability_status: "available"
      }]
    ]);

    const response = await request(app)
      .post("/api/charter/enquiries")
      .send({
        listingId: 25
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Marketplace listing is not available for enquiry"
    );

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("POST /api/charter/enquiries rejects invalid cargo quantity", async () => {
    const response = await request(app)
      .post("/api/charter/enquiries")
      .send({
        listingId: 25,
        cargoQuantityTons: 0
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "cargoQuantityTons must be a positive number"
    );

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /api/charter/enquiries rejects invalid date range", async () => {
    const response = await request(app)
      .post("/api/charter/enquiries")
      .send({
        listingId: 25,
        requestedStartDate: "2026-11-20",
        requestedEndDate: "2026-10-01"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "requestedStartDate cannot be after requestedEndDate"
    );

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /api/charter/enquiries rejects unknown origin port", async () => {
    pool.query
      .mockResolvedValueOnce([
        [{
          id: 25,
          listed_by_user_id: 12,
          listing_status: "published",
          verification_status: "verified",
          availability_status: "available"
        }]
      ])
      .mockResolvedValueOnce([[]]);

    const response = await request(app)
      .post("/api/charter/enquiries")
      .send({
        listingId: 25,
        originPortId: 99999
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe("Origin port not found");

    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test("GET /api/charter/enquiries returns the logged-in user's enquiries", async () => {
    pool.query
      .mockResolvedValueOnce([[{ total: 2 }]])
      .mockResolvedValueOnce([[
        {
          id: 3,
          listing_id: 25,
          requester_user_id: 7,
          cargo_type: "Crude Oil",
          cargo_quantity_tons: "50000.00",
          origin_port_id: 10,
          destination_port_id: 20,
          requested_start_date: "2026-10-01",
          requested_end_date: "2026-10-20",
          message: "Please provide your best voyage charter terms.",
          status: "submitted",
          created_at: "2026-09-08 12:00:00",
          updated_at: "2026-09-08 12:00:00",
          listing_title: "Crude Tanker Charter",
          charter_type: "voyage_charter",
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer"
        }
      ]]);

    const response = await request(app)
      .get("/api/charter/enquiries")
      .query({ page: 1, limit: 20 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: 3,
      listingId: 25,
      requesterUserId: 7,
      cargoType: "Crude Oil",
      cargoQuantityTons: 50000,
      listingTitle: "Crude Tanker Charter",
      charterType: "voyage_charter",
      vesselCode: "MD-001",
      vesselName: "Ocean Pioneer",
      status: "submitted"
    });
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1
    });

    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test("GET /api/charter/enquiries filters by status", async () => {
    pool.query
      .mockResolvedValueOnce([[{ total: 1 }]])
      .mockResolvedValueOnce([[
        {
          id: 4,
          listing_id: 25,
          requester_user_id: 7,
          cargo_type: "Crude Oil",
          cargo_quantity_tons: "30000.00",
          origin_port_id: null,
          destination_port_id: null,
          requested_start_date: null,
          requested_end_date: null,
          message: "Time charter enquiry",
          status: "under_review",
          created_at: "2026-09-08 13:00:00",
          updated_at: "2026-09-08 13:00:00",
          listing_title: "Crude Tanker Charter",
          charter_type: "time_charter",
          vessel_code: "MD-002",
          vessel_name: "Atlantic Star"
        }
      ]]);

    const response = await request(app)
      .get("/api/charter/enquiries")
      .query({
        status: "under_review",
        page: 1,
        limit: 10
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      id: 4,
      status: "under_review",
      charterType: "time_charter",
      vesselCode: "MD-002"
    });
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1
    });

    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test("GET /api/charter/enquiries rejects invalid status", async () => {
    const response = await request(app)
      .get("/api/charter/enquiries")
      .query({ status: "invalid_status" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe("Invalid enquiry status");

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("GET /api/charter/enquiries/:id returns an enquiry to its requester", async () => {
    mockUserId = 7;

    pool.query.mockResolvedValueOnce([[
      {
        id: 3,
        listing_id: 25,
        requester_user_id: 7,
        cargo_type: "Crude Oil",
        cargo_quantity_tons: "50000.00",
        origin_port_id: 10,
        destination_port_id: 20,
        requested_start_date: "2026-10-01",
        requested_end_date: "2026-10-20",
        message: "Please provide your best voyage charter terms.",
        status: "submitted",
        created_at: "2026-09-08 12:00:00",
        updated_at: "2026-09-08 12:00:00",
        listing_title: "Crude Tanker Charter",
        charter_type: "voyage_charter",
        listed_by_user_id: 12,
        vessel_code: "MD-001",
        vessel_name: "Ocean Pioneer"
      }
    ]]);

    const response = await request(app)
      .get("/api/charter/enquiries/3");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: 3,
      listingId: 25,
      requesterUserId: 7,
      cargoType: "Crude Oil",
      cargoQuantityTons: 50000,
      originPortId: 10,
      destinationPortId: 20,
      requestedStartDate: "2026-10-01",
      requestedEndDate: "2026-10-20",
      listingTitle: "Crude Tanker Charter",
      charterType: "voyage_charter",
      vesselCode: "MD-001",
      vesselName: "Ocean Pioneer",
      status: "submitted"
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("GET /api/charter/enquiries/:id returns an enquiry to its listing owner", async () => {
    mockUserId = 12;

    pool.query.mockResolvedValueOnce([[
      {
        id: 3,
        listing_id: 25,
        requester_user_id: 7,
        cargo_type: "Crude Oil",
        cargo_quantity_tons: "50000.00",
        origin_port_id: 10,
        destination_port_id: 20,
        requested_start_date: "2026-10-01",
        requested_end_date: "2026-10-20",
        message: "Please provide your best voyage charter terms.",
        status: "submitted",
        created_at: "2026-09-08 12:00:00",
        updated_at: "2026-09-08 12:00:00",
        listing_title: "Crude Tanker Charter",
        charter_type: "voyage_charter",
        listed_by_user_id: 12,
        vessel_code: "MD-001",
        vessel_name: "Ocean Pioneer"
      }
    ]]);

    const response = await request(app)
      .get("/api/charter/enquiries/3");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(3);
    expect(response.body.data.requesterUserId).toBe(7);

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("GET /api/charter/enquiries/:id hides an enquiry from unrelated users", async () => {
    mockUserId = 99;

    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .get("/api/charter/enquiries/3");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe("Charter enquiry not found");

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

});
