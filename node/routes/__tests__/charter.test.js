const express = require("express");
const request = require("supertest");

jest.mock("../../db", () => ({
  query: jest.fn(),
  getConnection: jest.fn()
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
          availability_status: "available",
          available_from: "2026-09-16",
          available_until: null,
          minimum_charter_days: 7,
          maximum_charter_days: 30
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


    test("POST /api/charter/enquiries rejects impossible calendar date", async () => {
      const response = await request(app)
        .post("/api/charter/enquiries")
        .send({
          listingId: 25,
          requestedStartDate: "2026-02-30",
          requestedEndDate: "2026-03-10"
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        "requestedStartDate must use YYYY-MM-DD format"
      );

      expect(pool.query).not.toHaveBeenCalled();
    });

    test("POST /api/charter/enquiries rejects start date before listing availability", async () => {
      pool.query.mockResolvedValueOnce([
        [{
          id: 25,
          listed_by_user_id: 12,
          listing_status: "published",
          verification_status: "verified",
          availability_status: "available",
          available_from: "2026-09-16",
          available_until: null,
          minimum_charter_days: 7,
          maximum_charter_days: 30
        }]
      ]);

      const response = await request(app)
        .post("/api/charter/enquiries")
        .send({
          listingId: 25,
          requestedStartDate: "2026-09-15",
          requestedEndDate: "2026-09-21"
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        "requestedStartDate cannot be before the listing availability date"
      );

      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test("POST /api/charter/enquiries rejects end date after listing availability", async () => {
      pool.query.mockResolvedValueOnce([
        [{
          id: 25,
          listed_by_user_id: 12,
          listing_status: "published",
          verification_status: "verified",
          availability_status: "available",
          available_from: "2026-09-16",
          available_until: "2026-10-31",
          minimum_charter_days: 7,
          maximum_charter_days: 30
        }]
      ]);

      const response = await request(app)
        .post("/api/charter/enquiries")
        .send({
          listingId: 25,
          requestedStartDate: "2026-10-01",
          requestedEndDate: "2026-11-01"
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        "requestedEndDate cannot be after the listing availability date"
      );

      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test("POST /api/charter/enquiries rejects duration below minimum", async () => {
      pool.query.mockResolvedValueOnce([
        [{
          id: 25,
          listed_by_user_id: 12,
          listing_status: "published",
          verification_status: "verified",
          availability_status: "available",
          available_from: "2026-09-16",
          available_until: null,
          minimum_charter_days: 7,
          maximum_charter_days: 30
        }]
      ]);

      const response = await request(app)
        .post("/api/charter/enquiries")
        .send({
          listingId: 25,
          requestedStartDate: "2026-10-01",
          requestedEndDate: "2026-10-06"
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        "Requested charter duration must be at least 7 day(s)"
      );

      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test("POST /api/charter/enquiries rejects duration above maximum", async () => {
      pool.query.mockResolvedValueOnce([
        [{
          id: 25,
          listed_by_user_id: 12,
          listing_status: "published",
          verification_status: "verified",
          availability_status: "available",
          available_from: "2026-09-16",
          available_until: null,
          minimum_charter_days: 7,
          maximum_charter_days: 30
        }]
      ]);

      const response = await request(app)
        .post("/api/charter/enquiries")
        .send({
          listingId: 25,
          requestedStartDate: "2026-10-01",
          requestedEndDate: "2026-10-31"
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        "Requested charter duration cannot exceed 30 day(s)"
      );

      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test("POST /api/charter/enquiries accepts exactly minimum charter duration", async () => {
      pool.query
        .mockResolvedValueOnce([
          [{
            id: 25,
            listed_by_user_id: 12,
            listing_status: "published",
            verification_status: "verified",
            availability_status: "available",
            available_from: "2026-09-16",
            available_until: null,
            minimum_charter_days: 7,
            maximum_charter_days: 30
          }]
        ])
        .mockResolvedValueOnce([[{ id: 10 }]])
        .mockResolvedValueOnce([[{ id: 20 }]])
        .mockResolvedValueOnce([{ insertId: 4 }])
        .mockResolvedValueOnce([[
          {
            id: 4,
            listing_id: 25,
            requester_user_id: 7,
            cargo_type: "Crude Oil",
            cargo_quantity_tons: "50000.00",
            origin_port_id: 10,
            destination_port_id: 20,
            requested_start_date: "2026-10-01",
            requested_end_date: "2026-10-07",
            message: "Seven-day charter request.",
            status: "submitted"
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
          requestedEndDate: "2026-10-07",
          message: "Seven-day charter request."
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(4);
      expect(response.body.data.requestedStartDate).toBe("2026-10-01");
      expect(response.body.data.requestedEndDate).toBe("2026-10-07");

      expect(pool.query).toHaveBeenCalledTimes(5);
    });

    test("POST /api/charter/enquiries accepts exactly maximum charter duration", async () => {
      pool.query
        .mockResolvedValueOnce([
          [{
            id: 25,
            listed_by_user_id: 12,
            listing_status: "published",
            verification_status: "verified",
            availability_status: "available",
            available_from: "2026-09-16",
            available_until: null,
            minimum_charter_days: 7,
            maximum_charter_days: 30
          }]
        ])
        .mockResolvedValueOnce([[{ id: 10 }]])
        .mockResolvedValueOnce([[{ id: 20 }]])
        .mockResolvedValueOnce([{ insertId: 5 }])
        .mockResolvedValueOnce([[
          {
            id: 5,
            listing_id: 25,
            requester_user_id: 7,
            cargo_type: "Crude Oil",
            cargo_quantity_tons: "50000.00",
            origin_port_id: 10,
            destination_port_id: 20,
            requested_start_date: "2026-10-01",
            requested_end_date: "2026-10-30",
            message: "Thirty-day charter request.",
            status: "submitted"
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
          requestedEndDate: "2026-10-30",
          message: "Thirty-day charter request."
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(5);
      expect(response.body.data.requestedStartDate).toBe("2026-10-01");
      expect(response.body.data.requestedEndDate).toBe("2026-10-30");

      expect(pool.query).toHaveBeenCalledTimes(5);
    });

    test("POST /api/charter/enquiries handles database failure", async () => {
      pool.query.mockRejectedValueOnce(
        new Error("Database connection failed")
      );

      const response = await request(app)
        .post("/api/charter/enquiries")
        .send({
          listingId: 25
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        "Unable to submit charter enquiry"
      );

      expect(pool.query).toHaveBeenCalledTimes(1);
    });

  test("POST /api/charter/enquiries rejects unknown origin port", async () => {
    pool.query
      .mockResolvedValueOnce([
        [{
          id: 25,
          listed_by_user_id: 12,
          listing_status: "published",
          verification_status: "verified",
          availability_status: "available",
          available_from: "2026-09-16",
          available_until: null,
          minimum_charter_days: 7,
          maximum_charter_days: 30
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


  test("POST /api/charter/enquiries/:id/offers rejects a non-owner", async () => {
    mockUserId = 7;

    pool.query.mockResolvedValueOnce([[
      {
        id: 3,
        requester_user_id: 7,
        status: "submitted",
        listed_by_user_id: 12
      }
    ]]);

    const response = await request(app)
      .post("/api/charter/enquiries/3/offers")
      .send({
        amount: 125000,
        currencyCode: "USD",
        rateUnit: "per_voyage",
        charterDays: 20,
        terms: "Attempted unauthorized offer.",
        expiresAt: "2026-10-01T12:00:00Z"
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error)
      .toBe("Only the listing owner can make the initial offer");

    expect(pool.query).toHaveBeenCalledTimes(1);
  });


  test("POST /api/charter/enquiries/:id/offers creates an initial offer", async () => {
    mockUserId = 12;

    pool.query
      .mockResolvedValueOnce([[
        {
          id: 3,
          requester_user_id: 7,
          status: "submitted",
          listed_by_user_id: 12
        }
      ]])
      .mockResolvedValueOnce([{ insertId: 8 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[
        {
          id: 8,
          enquiry_id: 3,
          offered_by_user_id: 12,
          parent_offer_id: null,
          amount: "125000.00",
          currency_code: "USD",
          rate_unit: "per_voyage",
          charter_days: 20,
          terms: "Worldscale terms subject to final fixture.",
          status: "pending",
          expires_at: "2026-10-01 12:00:00",
          created_at: "2026-09-15 12:00:00",
          updated_at: "2026-09-15 12:00:00"
        }
      ]]);

    const response = await request(app)
      .post("/api/charter/enquiries/3/offers")
      .send({
        amount: 125000,
        currencyCode: "USD",
        rateUnit: "per_voyage",
        charterDays: 20,
        terms: "Worldscale terms subject to final fixture.",
        expiresAt: "2026-10-01T12:00:00Z"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: 8,
      enquiryId: 3,
      offeredByUserId: 12,
      parentOfferId: null,
      amount: 125000,
      currencyCode: "USD",
      rateUnit: "per_voyage",
      charterDays: 20,
      terms: "Worldscale terms subject to final fixture.",
      status: "pending"
    });

    expect(pool.query).toHaveBeenCalledTimes(4);
  });

  test("POST /api/charter/enquiries/:id/offers rejects an initial offer during negotiation", async () => {
    mockUserId = 12;

    pool.query.mockResolvedValueOnce([[
      {
        id: 3,
        requester_user_id: 7,
        status: "negotiating",
        listed_by_user_id: 12
      }
    ]]);

    const response = await request(app)
      .post("/api/charter/enquiries/3/offers")
      .send({
        amount: 125000,
        currencyCode: "USD",
        rateUnit: "per_voyage",
        charterDays: 20,
        terms: "Attempted second initial offer.",
        expiresAt: "2026-10-01T12:00:00Z"
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "An initial offer can only be made while the enquiry is submitted or under review"
    );

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][1]).toEqual([3]);
  });

  test("GET /api/charter/incoming-enquiries returns enquiries for listings owned by the logged-in user", async () => {
    mockUserId = 12;

    pool.query
      .mockResolvedValueOnce([[{ total: 1 }]])
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
          created_at: "2026-09-15 12:00:00",
          updated_at: "2026-09-15 12:00:00",
          listing_title: "Ocean Pioneer Voyage Charter",
          charter_type: "voyage_charter",
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer"
        }
      ]]);

    const response = await request(app)
      .get("/api/charter/incoming-enquiries");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: 3,
      listingId: 25,
      requesterUserId: 7,
      cargoType: "Crude Oil",
      cargoQuantityTons: 50000,
      originPortId: 10,
      destinationPortId: 20,
      requestedStartDate: "2026-10-01",
      requestedEndDate: "2026-10-20",
      message: "Please provide your best voyage charter terms.",
      status: "submitted",
      listingTitle: "Ocean Pioneer Voyage Charter",
      charterType: "voyage_charter",
      vesselCode: "MD-001",
      vesselName: "Ocean Pioneer"
    });
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1
    });

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls[0][0]).toContain(
      "l.listed_by_user_id = ?"
    );
    expect(pool.query.mock.calls[0][1]).toEqual([12]);
    expect(pool.query.mock.calls[1][1]).toEqual([12, 20, 0]);
    });


  test("GET /api/charter/incoming-enquiries applies status and pagination filters", async () => {
    mockUserId = 12;

    pool.query
      .mockResolvedValueOnce([[{ total: 3 }]])
      .mockResolvedValueOnce([[
        {
          id: 5,
          listing_id: 25,
          requester_user_id: 8,
          cargo_type: "Diesel",
          cargo_quantity_tons: "12000.00",
          origin_port_id: null,
          destination_port_id: null,
          requested_start_date: null,
          requested_end_date: null,
          message: "Looking for time charter terms.",
          status: "offer_made",
          created_at: "2026-09-15 13:00:00",
          updated_at: "2026-09-15 13:30:00",
          listing_title: "Ocean Pioneer Time Charter",
          charter_type: "time_charter",
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer"
        }
      ]]);

    const response = await request(app)
      .get("/api/charter/incoming-enquiries")
      .query({
        status: "offer_made",
        page: 2,
        limit: 1
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: 5,
      status: "offer_made",
      cargoType: "Diesel",
      cargoQuantityTons: 12000
    });
    expect(response.body.pagination).toMatchObject({
      page: 2,
      limit: 1,
      total: 3,
      totalPages: 3
    });

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls[0][0]).toContain(
      "l.listed_by_user_id = ?"
    );
    expect(pool.query.mock.calls[0][0]).toContain(
      "e.status = ?"
    );
    expect(pool.query.mock.calls[0][1]).toEqual([12, "offer_made"]);
    expect(pool.query.mock.calls[1][1]).toEqual([
      12,
      "offer_made",
      1,
      1
    ]);
    });


  test("GET /api/charter/incoming-enquiries rejects an invalid status", async () => {
    mockUserId = 12;

    const response = await request(app)
      .get("/api/charter/incoming-enquiries")
      .query({
        status: "invalid_status"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe("Invalid enquiry status");

    expect(pool.query).not.toHaveBeenCalled();
    });


  test("GET /api/charter/incoming-enquiries rejects an invalid page", async () => {
    mockUserId = 12;

    const response = await request(app)
      .get("/api/charter/incoming-enquiries")
      .query({
        page: 0
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "page must be a positive integer"
    );

    expect(pool.query).not.toHaveBeenCalled();
    });


  test("GET /api/charter/incoming-enquiries rejects an invalid limit", async () => {
    mockUserId = 12;

    const response = await request(app)
      .get("/api/charter/incoming-enquiries")
      .query({
        limit: 101
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "limit must be between 1 and 100"
    );

    expect(pool.query).not.toHaveBeenCalled();
    });




  test("PATCH /api/charter/enquiries/:id updates an enquiry for its requester", async () => {
    mockUserId = 7;

    pool.query
      .mockResolvedValueOnce([[
        {
          id: 3,
          listing_id: 25,
          requester_user_id: 7,
          cargo_type: "Crude Oil",
          cargo_quantity_tons: 50000,
          origin_port_id: 10,
          destination_port_id: 20,
          requested_start_date: "2026-10-01",
          requested_end_date: "2026-10-20",
          message: "Original message",
          status: "submitted"
        }
      ]])
      .mockResolvedValueOnce([[
        {
          id: 25,
          listing_status: "published",
          verification_status: "verified",
          availability_status: "available",
          available_from: "2026-09-16",
          available_until: null,
          minimum_charter_days: 7,
          maximum_charter_days: 30
        }
      ]])
      .mockResolvedValueOnce([[{ id: 11 }]])
      .mockResolvedValueOnce([[{ id: 22 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[
        {
          id: 3,
          listing_id: 25,
          requester_user_id: 7,
          cargo_type: "Refined Fuel",
          cargo_quantity_tons: 42000,
          origin_port_id: 11,
          destination_port_id: 22,
          requested_start_date: "2026-10-05",
          requested_end_date: "2026-10-11",
          message: "Please update the charter requirements.",
          status: "submitted",
          created_at: "2026-09-08 12:00:00",
          updated_at: "2026-09-19 16:00:00"
        }
      ]]);

    const response = await request(app)
      .patch("/api/charter/enquiries/3")
      .send({
        cargoType: "Refined Fuel",
        cargoQuantityTons: 42000,
        originPortId: 11,
        destinationPortId: 22,
        requestedStartDate: "2026-10-05",
        requestedEndDate: "2026-10-11",
        message: "Please update the charter requirements."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Charter enquiry updated successfully"
    );

    expect(response.body.data).toMatchObject({
      id: 3,
      listingId: 25,
      requesterUserId: 7,
      cargoType: "Refined Fuel",
      cargoQuantityTons: 42000,
      originPortId: 11,
      destinationPortId: 22,
      requestedStartDate: "2026-10-05",
      requestedEndDate: "2026-10-11",
      message: "Please update the charter requirements.",
      status: "submitted"
    });

    expect(pool.query).toHaveBeenCalledTimes(6);

    expect(pool.query.mock.calls[0][1]).toEqual([3]);
    expect(pool.query.mock.calls[1][1]).toEqual([25]);
    expect(pool.query.mock.calls[2][1]).toEqual([11]);
    expect(pool.query.mock.calls[3][1]).toEqual([22]);

    expect(pool.query.mock.calls[4][1]).toEqual([
      "Refined Fuel",
      42000,
      11,
      22,
      "2026-10-05",
      "2026-10-11",
      "Please update the charter requirements.",
      3
    ]);

    expect(pool.query.mock.calls[5][1]).toEqual([3]);
  });


  test("PATCH /api/charter/enquiries/:id allows editing an under_review enquiry", async () => {
    mockUserId = 7;

    pool.query
      .mockResolvedValueOnce([[
        {
          id: 4,
          listing_id: 25,
          requester_user_id: 7,
          cargo_type: "Crude Oil",
          cargo_quantity_tons: 50000,
          origin_port_id: 10,
          destination_port_id: 20,
          requested_start_date: "2026-10-01",
          requested_end_date: "2026-10-20",
          message: "Under review enquiry",
          status: "under_review"
        }
      ]])
      .mockResolvedValueOnce([[
        {
          id: 25,
          listing_status: "published",
          verification_status: "verified",
          availability_status: "available",
          available_from: "2026-09-16",
          available_until: null,
          minimum_charter_days: 7,
          maximum_charter_days: 30
        }
      ]])
      .mockResolvedValueOnce([[{ id: 11 }]])
      .mockResolvedValueOnce([[{ id: 22 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[
        {
          id: 4,
          listing_id: 25,
          requester_user_id: 7,
          cargo_type: "Crude Oil",
          cargo_quantity_tons: 50000,
          origin_port_id: 11,
          destination_port_id: 22,
          requested_start_date: "2026-10-05",
          requested_end_date: "2026-10-11",
          message: "Updated while under review.",
          status: "under_review",
          created_at: "2026-09-08 12:00:00",
          updated_at: "2026-09-19 16:10:00"
        }
      ]]);

    const response = await request(app)
      .patch("/api/charter/enquiries/4")
      .send({
        originPortId: 11,
        destinationPortId: 22,
        requestedStartDate: "2026-10-05",
        requestedEndDate: "2026-10-11",
        message: "Updated while under review."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: 4,
      status: "under_review",
      originPortId: 11,
      destinationPortId: 22,
      requestedStartDate: "2026-10-05",
      requestedEndDate: "2026-10-11",
      message: "Updated while under review."
    });

    expect(pool.query).toHaveBeenCalledTimes(6);

    expect(pool.query.mock.calls[4][1]).toEqual([
      "Crude Oil",
      50000,
      11,
      22,
      "2026-10-05",
      "2026-10-11",
      "Updated while under review.",
      4
    ]);

    expect(pool.query.mock.calls[5][1]).toEqual([4]);
  });


  test("PATCH /api/charter/enquiries/:id rejects an unrelated user", async () => {
    mockUserId = 99;

    pool.query.mockResolvedValueOnce([[
      {
        id: 3,
        listing_id: 25,
        requester_user_id: 7,
        cargo_type: "Crude Oil",
        cargo_quantity_tons: 50000,
        origin_port_id: 10,
        destination_port_id: 20,
        requested_start_date: "2026-10-01",
        requested_end_date: "2026-10-20",
        message: "Original message",
        status: "submitted"
      }
    ]]);

    const response = await request(app)
      .patch("/api/charter/enquiries/3")
      .send({
        cargoType: "Attempted Unauthorized Edit"
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Only the enquiry requester can edit this enquiry"
    );

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][1]).toEqual([3]);
  });


  test("PATCH /api/charter/enquiries/:id rejects editing after an offer has been made", async () => {
    mockUserId = 7;

    pool.query.mockResolvedValueOnce([[
      {
        id: 5,
        listing_id: 25,
        requester_user_id: 7,
        cargo_type: "Crude Oil",
        cargo_quantity_tons: 50000,
        origin_port_id: 10,
        destination_port_id: 20,
        requested_start_date: "2026-10-01",
        requested_end_date: "2026-10-20",
        message: "Offer already received.",
        status: "offer_made"
      }
    ]]);

    const response = await request(app)
      .patch("/api/charter/enquiries/5")
      .send({
        cargoType: "Attempted Post-Offer Edit"
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "This charter enquiry can no longer be edited"
    );

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][1]).toEqual([5]);
  });


  test("PATCH /api/charter/enquiries/:id rejects editing while negotiating", async () => {
    mockUserId = 7;

    pool.query.mockResolvedValueOnce([[
      {
        id: 6,
        listing_id: 25,
        requester_user_id: 7,
        cargo_type: "Crude Oil",
        cargo_quantity_tons: 50000,
        origin_port_id: 10,
        destination_port_id: 20,
        requested_start_date: "2026-10-01",
        requested_end_date: "2026-10-20",
        message: "Negotiation already started.",
        status: "negotiating"
      }
    ]]);

    const response = await request(app)
      .patch("/api/charter/enquiries/6")
      .send({
        cargoType: "Attempted Negotiation Edit"
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "This charter enquiry can no longer be edited"
    );

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][1]).toEqual([6]);
  });




  test("PATCH /api/charter/enquiries/:id rejects editing a withdrawn enquiry", async () => {
    mockUserId = 7;

    pool.query
      .mockResolvedValueOnce([[
        {
          id: 8,
          listing_id: 25,
          requester_user_id: 7,
          cargo_type: "Crude Oil",
          cargo_quantity_tons: 50000,
          origin_port_id: 10,
          destination_port_id: 20,
          requested_start_date: "2026-10-01",
          requested_end_date: "2026-10-07",
          message: "Withdrawn enquiry.",
          status: "withdrawn"
        }
      ]]);

    const response = await request(app)
      .patch("/api/charter/enquiries/8")
      .send({
        message: "Trying to edit after withdrawal."
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "This charter enquiry can no longer be edited"
    );

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][1]).toEqual([8]);
  });

  test("PATCH /api/charter/enquiries/:id rejects an edited duration below the listing minimum", async () => {
    mockUserId = 7;

    pool.query
      .mockResolvedValueOnce([[
        {
          id: 7,
          listing_id: 25,
          requester_user_id: 7,
          cargo_type: "Crude Oil",
          cargo_quantity_tons: 50000,
          origin_port_id: 10,
          destination_port_id: 20,
          requested_start_date: "2026-10-01",
          requested_end_date: "2026-10-10",
          message: "Original valid enquiry.",
          status: "submitted"
        }
      ]])
      .mockResolvedValueOnce([[
        {
          id: 25,
          listing_status: "published",
          verification_status: "verified",
          availability_status: "available",
          available_from: "2026-09-16",
          available_until: null,
          minimum_charter_days: 7,
          maximum_charter_days: 30
        }
      ]]);

    const response = await request(app)
      .patch("/api/charter/enquiries/7")
      .send({
        requestedStartDate: "2026-10-01",
        requestedEndDate: "2026-10-06"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Requested charter duration must be at least 7 day(s)"
    );

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls[0][1]).toEqual([7]);
    expect(pool.query.mock.calls[1][1]).toEqual([25]);
  });






  test("GET /api/charter/enquiries/:id/offers returns the offer chain for the requester", async () => {
    mockUserId = 7;

    pool.query
      .mockResolvedValueOnce([[{ id: 8 }]])
      .mockResolvedValueOnce([[
        {
          id: 1,
          enquiry_id: 8,
          offered_by_user_id: 12,
          parent_offer_id: null,
          amount: "8500.00",
          currency_code: "USD",
          rate_unit: "per_voyage",
          charter_days: 7,
          terms: "Initial owner offer.",
          status: "countered",
          expires_at: "2026-09-25 12:00:00",
          created_at: "2026-09-19 10:00:00",
          updated_at: "2026-09-19 10:05:00"
        },
        {
          id: 2,
          enquiry_id: 8,
          offered_by_user_id: 7,
          parent_offer_id: 1,
          amount: "7500.00",
          currency_code: "USD",
          rate_unit: "per_voyage",
          charter_days: 7,
          terms: "Requester counter offer.",
          status: "countered",
          expires_at: "2026-09-26 12:00:00",
          created_at: "2026-09-19 11:00:00",
          updated_at: "2026-09-19 11:05:00"
        },
        {
          id: 3,
          enquiry_id: 8,
          offered_by_user_id: 12,
          parent_offer_id: 2,
          amount: "8000.00",
          currency_code: "USD",
          rate_unit: "per_voyage",
          charter_days: 7,
          terms: "Owner counter offer.",
          status: "pending",
          expires_at: "2026-09-27 12:00:00",
          created_at: "2026-09-19 12:00:00",
          updated_at: "2026-09-19 12:00:00"
        }
      ]]);

    const response = await request(app)
      .get("/api/charter/enquiries/8/offers");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(3);

    expect(response.body.data[0]).toMatchObject({
      id: 1,
      enquiryId: 8,
      offeredByUserId: 12,
      parentOfferId: null,
      amount: 8500,
      currencyCode: "USD",
      rateUnit: "per_voyage",
      charterDays: 7,
      terms: "Initial owner offer.",
      status: "countered"
    });

    expect(response.body.data[1]).toMatchObject({
      id: 2,
      enquiryId: 8,
      offeredByUserId: 7,
      parentOfferId: 1,
      amount: 7500,
      status: "countered"
    });

    expect(response.body.data[2]).toMatchObject({
      id: 3,
      enquiryId: 8,
      offeredByUserId: 12,
      parentOfferId: 2,
      amount: 8000,
      status: "pending"
    });

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls[0][1]).toEqual([8, 7, 7]);
    expect(pool.query.mock.calls[1][1]).toEqual([8]);
  });


  test("GET /api/charter/enquiries/:id/offers returns the offer history to the listing owner", async () => {
    mockUserId = 12;

    pool.query
      .mockResolvedValueOnce([[{ id: 8 }]])
      .mockResolvedValueOnce([[
        {
          id: 1,
          enquiry_id: 8,
          offered_by_user_id: 12,
          parent_offer_id: null,
          amount: "8500.00",
          currency_code: "USD",
          rate_unit: "per_voyage",
          charter_days: 7,
          terms: "Initial owner offer.",
          status: "pending",
          expires_at: null,
          created_at: "2026-09-19 10:00:00",
          updated_at: "2026-09-19 10:00:00"
        }
      ]]);

    const response = await request(app)
      .get("/api/charter/enquiries/8/offers");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: 1,
      enquiryId: 8,
      offeredByUserId: 12,
      parentOfferId: null,
      amount: 8500,
      currencyCode: "USD",
      rateUnit: "per_voyage",
      charterDays: 7,
      terms: "Initial owner offer.",
      status: "pending",
      expiresAt: null
    });

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls[0][1]).toEqual([8, 12, 12]);
    expect(pool.query.mock.calls[1][1]).toEqual([8]);
  });


  test("GET /api/charter/enquiries/:id/offers rejects an unrelated user", async () => {
    mockUserId = 99;

    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .get("/api/charter/enquiries/8/offers");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe("Charter enquiry not found");

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][1]).toEqual([8, 99, 99]);
  });


  test("GET /api/charter/enquiries/:id/offers returns an empty list when the enquiry has no offers", async () => {
    mockUserId = 7;

    pool.query
      .mockResolvedValueOnce([[{ id: 8 }]])
      .mockResolvedValueOnce([[]]);

    const response = await request(app)
      .get("/api/charter/enquiries/8/offers");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([]);

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls[0][1]).toEqual([8, 7, 7]);
    expect(pool.query.mock.calls[1][1]).toEqual([8]);
  });

  test("POST /api/charter/enquiries/:id/withdraw rejects a non-requester", async () => {
    mockUserId = 12;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "submitted"
          }
        ]]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/enquiries/8/withdraw");

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Only the enquiry requester can withdraw this enquiry"
    );

    expect(pool.getConnection).toHaveBeenCalledTimes(1);
    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(1);
    expect(connection.query.mock.calls[0][1]).toEqual([8]);
  });

  test("POST /api/charter/enquiries/:id/withdraw withdraws a submitted enquiry", async () => {
    mockUserId = 7;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "submitted"
          }
        ]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[
          {
            id: 8,
            listing_id: 25,
            requester_user_id: 7,
            status: "withdrawn",
            created_at: "2026-09-19T10:00:00.000Z",
            updated_at: "2026-09-19T11:00:00.000Z"
          }
        ]]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/enquiries/8/withdraw");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: 8,
      listingId: 25,
      requesterUserId: 7,
      status: "withdrawn"
    });
    expect(response.body.message).toBe(
      "Charter enquiry withdrawn successfully"
    );

    expect(pool.getConnection).toHaveBeenCalledTimes(1);
    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(4);

    expect(connection.query.mock.calls[0][1]).toEqual([8]);
    expect(connection.query.mock.calls[1][1]).toEqual([8]);
    expect(connection.query.mock.calls[2][1]).toEqual([8]);
    expect(connection.query.mock.calls[3][1]).toEqual([8]);

    expect(connection.query.mock.calls[1][0]).toContain(
      "UPDATE charter_offers"
    );
    expect(connection.query.mock.calls[2][0]).toContain(
      "UPDATE charter_enquiries"
    );
  });

  test("POST /api/charter/offers/:id/counter expires and rejects an expired latest offer", async () => {
    mockUserId = 7;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "offer_made",
            listed_by_user_id: 12
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            enquiry_id: 8,
            offered_by_user_id: 12,
            parent_offer_id: null,
            amount: "8500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Expired owner offer.",
            status: "pending",
            expires_at: "2026-09-18 12:00:00",
            created_at: "2026-09-19 12:00:00",
            updated_at: "2026-09-19 12:00:00",
            is_expired: 1
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            status: "pending",
            expires_at: "2026-09-18 12:00:00"
          }
        ]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/offers/1/counter")
      .send({
        amount: 7500,
        currencyCode: "USD",
        rateUnit: "per_voyage",
        charterDays: 7,
        terms: "Counter after expiry.",
        expiresAt: "2026-09-27T12:00:00Z"
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "This charter offer has expired"
    );

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(4);
    expect(connection.query.mock.calls[3][0]).toContain(
      "UPDATE charter_offers"
    );
  });

  test("POST /api/charter/offers/:id/counter rejects an older non-latest offer", async () => {
    mockUserId = 7;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "negotiating",
            listed_by_user_id: 12
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            enquiry_id: 8,
            offered_by_user_id: 12,
            parent_offer_id: null,
            amount: "8500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Older owner offer.",
            status: "countered",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 12:00:00",
            updated_at: "2026-09-19 12:00:00",
            is_expired: 0
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 2,
            status: "pending",
            expires_at: "2026-09-26 12:00:00"
          }
        ]]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/offers/1/counter")
      .send({
        amount: 7000,
        currencyCode: "USD",
        rateUnit: "per_voyage",
        charterDays: 7,
        terms: "Invalid counter against old offer.",
        expiresAt: "2026-09-27T12:00:00Z"
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Only the latest charter offer can be countered"
    );

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(3);
  });

  test("POST /api/charter/offers/:id/counter rejects the offer creator from countering their own offer", async () => {
    mockUserId = 12;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "offer_made",
            listed_by_user_id: 12
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            enquiry_id: 8,
            offered_by_user_id: 12,
            parent_offer_id: null,
            amount: "8500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Initial owner offer.",
            status: "pending",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 12:00:00",
            updated_at: "2026-09-19 12:00:00",
            is_expired: 0
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            status: "pending",
            expires_at: "2026-09-25 12:00:00"
          }
        ]]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/offers/1/counter")
      .send({
        amount: 8000,
        currencyCode: "USD",
        rateUnit: "per_voyage",
        charterDays: 7,
        terms: "Invalid self-counter.",
        expiresAt: "2026-09-26T12:00:00Z"
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "You cannot counter your own charter offer"
    );

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(3);
  });

  test("POST /api/charter/offers/:id/accept rejects the offer creator from accepting their own offer", async () => {
    mockUserId = 12;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "offer_made",
            listed_by_user_id: 12
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            enquiry_id: 8,
            offered_by_user_id: 12,
            parent_offer_id: null,
            amount: "8500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Owner offer.",
            status: "pending",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 12:00:00",
            updated_at: "2026-09-19 12:00:00",
            is_expired: 0
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            status: "pending",
            expires_at: "2026-09-25 12:00:00"
          }
        ]]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/offers/1/accept");

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "You cannot accept your own charter offer"
    );

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(3);
  });

  test("POST /api/charter/offers/:id/accept rejects an older non-latest offer", async () => {
    mockUserId = 7;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "negotiating",
            listed_by_user_id: 12
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            enquiry_id: 8,
            offered_by_user_id: 12,
            parent_offer_id: null,
            amount: "8500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Older owner offer.",
            status: "countered",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 12:00:00",
            updated_at: "2026-09-19 12:00:00",
            is_expired: 0
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 2,
            status: "pending",
            expires_at: "2026-09-26 12:00:00"
          }
        ]]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/offers/1/accept");

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Only the latest charter offer can be accepted"
    );

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(3);
  });

  test("POST /api/charter/offers/:id/accept expires and rejects an expired latest offer", async () => {
    mockUserId = 7;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "offer_made",
            listed_by_user_id: 12
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            enquiry_id: 8,
            offered_by_user_id: 12,
            parent_offer_id: null,
            amount: "8500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Expired owner offer.",
            status: "pending",
            expires_at: "2026-09-18 12:00:00",
            created_at: "2026-09-19 12:00:00",
            updated_at: "2026-09-19 12:00:00",
            is_expired: 1
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            status: "pending",
            expires_at: "2026-09-18 12:00:00"
          }
        ]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/offers/1/accept");

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "This charter offer has expired"
    );

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(4);
    expect(connection.query.mock.calls[3][0]).toContain(
      "UPDATE charter_offers"
    );
  });

  test("POST /api/charter/offers/:id/reject rejects the offer creator from rejecting their own offer", async () => {
    mockUserId = 12;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "offer_made",
            listed_by_user_id: 12
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            enquiry_id: 8,
            offered_by_user_id: 12,
            parent_offer_id: null,
            amount: "8500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Owner offer.",
            status: "pending",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 12:00:00",
            updated_at: "2026-09-19 12:00:00",
            is_expired: 0
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            status: "pending",
            expires_at: "2026-09-25 12:00:00"
          }
        ]]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/offers/1/reject");

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "You cannot reject your own charter offer"
    );

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(3);
  });

  test("POST /api/charter/offers/:id/reject rejects an older non-latest offer", async () => {
    mockUserId = 7;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "negotiating",
            listed_by_user_id: 12
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            enquiry_id: 8,
            offered_by_user_id: 12,
            parent_offer_id: null,
            amount: "8500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Owner opening offer.",
            status: "countered",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 12:00:00",
            updated_at: "2026-09-19 12:00:00",
            is_expired: 0
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 2,
            status: "pending",
            expires_at: "2026-09-25 12:00:00"
          }
        ]]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/offers/1/reject");

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Only the latest charter offer can be rejected"
    );

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(3);
  });

  test("POST /api/charter/offers/:id/reject marks an expired latest offer as expired", async () => {
    mockUserId = 7;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "offer_made",
            listed_by_user_id: 12
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            enquiry_id: 8,
            offered_by_user_id: 12,
            parent_offer_id: null,
            amount: "8500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Expired owner offer.",
            status: "pending",
            expires_at: "2026-09-18 12:00:00",
            created_at: "2026-09-18 10:00:00",
            updated_at: "2026-09-18 10:00:00",
            is_expired: 1
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            status: "pending",
            expires_at: "2026-09-18 12:00:00"
          }
        ]])
        .mockResolvedValueOnce([{
          affectedRows: 1
        }]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/offers/1/reject");

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "This charter offer has expired"
    );

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(4);
    expect(connection.query.mock.calls[3][0]).toContain(
      "UPDATE charter_offers"
    );
  });

  test("POST /api/charter/offers/:id/reject blocks an unauthorized user", async () => {
    mockUserId = 99;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "offer_made",
            listed_by_user_id: 12
          }
        ]]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/offers/1/reject");

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "You are not authorized to reject this charter offer"
    );

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(1);
  });

  test("POST /api/charter/offers/:id/reject lets the requester reject the latest owner offer during negotiation", async () => {
    mockUserId = 7;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "negotiating",
            listed_by_user_id: 12
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 3,
            enquiry_id: 8,
            offered_by_user_id: 12,
            parent_offer_id: 2,
            amount: "8000.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Owner counter-offer.",
            status: "pending",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 14:00:00",
            updated_at: "2026-09-19 14:00:00",
            is_expired: 0
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 3,
            status: "pending",
            expires_at: "2026-09-25 12:00:00"
          }
        ]])
        .mockResolvedValueOnce({
          affectedRows: 1
        })
        .mockResolvedValueOnce({
          affectedRows: 1
        })
        .mockResolvedValueOnce([[
          {
            id: 3,
            enquiry_id: 8,
            offered_by_user_id: 12,
            parent_offer_id: 2,
            amount: "8000.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Owner counter-offer.",
            status: "rejected",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 14:00:00",
            updated_at: "2026-09-19 14:00:00"
          }
        ]]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/offers/3/reject");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Charter offer rejected successfully"
    );
    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: 3,
        enquiryId: 8,
        offeredByUserId: 12,
        parentOfferId: 2,
        amount: 8000,
        currencyCode: "USD",
        rateUnit: "per_voyage",
        charterDays: 7,
        status: "rejected"
      })
    );

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(6);
  });

  test("POST /api/charter/offers/:id/reject lets the listing owner reject the latest requester counter-offer", async () => {
    mockUserId = 12;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "negotiating",
            listed_by_user_id: 12
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 2,
            enquiry_id: 8,
            offered_by_user_id: 7,
            parent_offer_id: 1,
            amount: "7500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Requester counter-offer.",
            status: "pending",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 13:00:00",
            updated_at: "2026-09-19 13:00:00"
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 2,
            status: "pending",
            expires_at: "2026-09-25 12:00:00"
          }
        ]])
        .mockResolvedValueOnce({
          affectedRows: 1
        })
        .mockResolvedValueOnce({
          affectedRows: 1
        })
        .mockResolvedValueOnce([[
          {
            id: 2,
            enquiry_id: 8,
            offered_by_user_id: 7,
            parent_offer_id: 1,
            amount: "7500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Requester counter-offer.",
            status: "rejected",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 13:00:00",
            updated_at: "2026-09-19 13:00:00"
          }
        ]]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/offers/2/reject");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Charter offer rejected successfully"
    );
    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: 2,
        enquiryId: 8,
        offeredByUserId: 7,
        parentOfferId: 1,
        amount: 7500,
        currencyCode: "USD",
        rateUnit: "per_voyage",
        charterDays: 7,
        status: "rejected"
      })
    );

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(6);
  });

  test("POST /api/charter/offers/:id/reject lets the requester reject the latest owner offer", async () => {
    mockUserId = 7;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "offer_made",
            listed_by_user_id: 12
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            enquiry_id: 8,
            offered_by_user_id: 12,
            parent_offer_id: null,
            amount: "8500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Owner offer.",
            status: "pending",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 12:00:00",
            updated_at: "2026-09-19 12:00:00",
            is_expired: 0
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            status: "pending",
            expires_at: "2026-09-25 12:00:00"
          }
        ]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[
          {
            id: 1,
            enquiry_id: 8,
            offered_by_user_id: 12,
            parent_offer_id: null,
            amount: "8500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Owner offer.",
            status: "rejected",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 12:00:00",
            updated_at: "2026-09-19 13:00:00"
          }
        ]]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/offers/1/reject");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: 1,
      enquiryId: 8,
      offeredByUserId: 12,
      parentOfferId: null,
      amount: 8500,
      currencyCode: "USD",
      rateUnit: "per_voyage",
      charterDays: 7,
      terms: "Owner offer.",
      status: "rejected"
    });
    expect(response.body.message).toBe(
      "Charter offer rejected successfully"
    );

    expect(pool.getConnection).toHaveBeenCalledTimes(1);
    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(6);

    expect(connection.query.mock.calls[3][0]).toContain(
      "UPDATE charter_offers"
    );
    expect(connection.query.mock.calls[4][0]).toContain(
      "UPDATE charter_enquiries"
    );
  });

  test("POST /api/charter/offers/:id/accept lets the listing owner accept the latest requester counter-offer", async () => {
    mockUserId = 12;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "negotiating",
            listed_by_user_id: 12
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 2,
            enquiry_id: 8,
            offered_by_user_id: 7,
            parent_offer_id: 1,
            amount: "7500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Requester counter-offer.",
            status: "pending",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 13:00:00",
            updated_at: "2026-09-19 13:00:00",
            is_expired: 0
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 2,
            status: "pending",
            expires_at: "2026-09-25 12:00:00"
          }
        ]])
        .mockResolvedValueOnce({
          affectedRows: 1
        })
        .mockResolvedValueOnce({
          affectedRows: 1
        })
        .mockResolvedValueOnce([[
          {
            id: 2,
            enquiry_id: 8,
            offered_by_user_id: 7,
            parent_offer_id: 1,
            amount: "7500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Requester counter-offer.",
            status: "accepted",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 13:00:00",
            updated_at: "2026-09-19 13:00:00"
          }
        ]]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/offers/2/accept");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Charter offer accepted successfully"
    );
    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: 2,
        enquiryId: 8,
        offeredByUserId: 7,
        parentOfferId: 1,
        amount: 7500,
        currencyCode: "USD",
        rateUnit: "per_voyage",
        charterDays: 7,
        status: "accepted"
      })
    );

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(6);
  });

  test("POST /api/charter/offers/:id/accept lets the requester accept the latest owner offer", async () => {
    mockUserId = 7;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "offer_made",
            listed_by_user_id: 12
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            enquiry_id: 8,
            offered_by_user_id: 12,
            parent_offer_id: null,
            amount: "8500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Owner offer.",
            status: "pending",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 12:00:00",
            updated_at: "2026-09-19 12:00:00",
            is_expired: 0
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            status: "pending",
            expires_at: "2026-09-25 12:00:00"
          }
        ]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[
          {
            id: 1,
            enquiry_id: 8,
            offered_by_user_id: 12,
            parent_offer_id: null,
            amount: "8500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Owner offer.",
            status: "accepted",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 12:00:00",
            updated_at: "2026-09-19 13:00:00"
          }
        ]]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/offers/1/accept");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: 1,
      enquiryId: 8,
      offeredByUserId: 12,
      parentOfferId: null,
      amount: 8500,
      currencyCode: "USD",
      rateUnit: "per_voyage",
      charterDays: 7,
      terms: "Owner offer.",
      status: "accepted"
    });
    expect(response.body.message).toBe(
      "Charter offer accepted successfully"
    );

    expect(pool.getConnection).toHaveBeenCalledTimes(1);
    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(6);

    expect(connection.query.mock.calls[3][0]).toContain(
      "UPDATE charter_offers"
    );
    expect(connection.query.mock.calls[4][0]).toContain(
      "UPDATE charter_enquiries"
    );
  });

  test("POST /api/charter/offers/:id/counter lets the requester counter the latest owner offer", async () => {
    mockUserId = 7;

    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          {
            id: 8,
            requester_user_id: 7,
            status: "offer_made",
            listed_by_user_id: 12
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            enquiry_id: 8,
            offered_by_user_id: 12,
            parent_offer_id: null,
            amount: "8500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Initial owner offer.",
            status: "pending",
            expires_at: "2026-09-25 12:00:00",
            created_at: "2026-09-19 12:00:00",
            updated_at: "2026-09-19 12:00:00",
            is_expired: 0
          }
        ]])
        .mockResolvedValueOnce([[
          {
            id: 1,
            status: "pending",
            expires_at: "2026-09-25 12:00:00"
          }
        ]])
        .mockResolvedValueOnce([{ insertId: 2 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[
          {
            id: 2,
            enquiry_id: 8,
            offered_by_user_id: 7,
            parent_offer_id: 1,
            amount: "7500.00",
            currency_code: "USD",
            rate_unit: "per_voyage",
            charter_days: 7,
            terms: "Requester counter-offer.",
            status: "pending",
            expires_at: "2026-09-26 12:00:00",
            created_at: "2026-09-19 13:00:00",
            updated_at: "2026-09-19 13:00:00"
          }
        ]]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/charter/offers/1/counter")
      .send({
        amount: 7500,
        currencyCode: "USD",
        rateUnit: "per_voyage",
        charterDays: 7,
        terms: "Requester counter-offer.",
        expiresAt: "2026-09-26T12:00:00Z"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: 2,
      enquiryId: 8,
      offeredByUserId: 7,
      parentOfferId: 1,
      amount: 7500,
      currencyCode: "USD",
      rateUnit: "per_voyage",
      charterDays: 7,
      terms: "Requester counter-offer.",
      status: "pending"
    });
    expect(response.body.message).toBe(
      "Charter counter-offer created successfully"
    );

    expect(pool.getConnection).toHaveBeenCalledTimes(1);
    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.query).toHaveBeenCalledTimes(7);

    expect(connection.query.mock.calls[3][0]).toContain(
      "INSERT INTO charter_offers"
    );
    expect(connection.query.mock.calls[4][0]).toContain(
      "UPDATE charter_offers"
    );
    expect(connection.query.mock.calls[5][0]).toContain(
      "UPDATE charter_enquiries"
    );
  });
});
