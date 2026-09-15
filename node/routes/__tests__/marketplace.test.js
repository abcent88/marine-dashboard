const express = require("express");
const request = require("supertest");

jest.mock("../../db", () => ({
  query: jest.fn()
}));

jest.mock("../../lib/logger", () => ({
  error: jest.fn()
}));

jest.mock("../../middleware/auth", () => ({
  requireRole: jest.fn(() => (req, res, next) => {
    req.session = {
      user: {
        id: 1,
        role: "admin"
      }
    };
    next();
  })
}));

const pool = require("../../db");
const marketplaceRoutes = require("../marketplace");

const app = express();

app.use(express.json());
app.use("/api/marketplace", marketplaceRoutes);

describe("Marketplace routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/marketplace/vessels returns published verified vessels", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: "1",
          vessel_id: "10",
          vessel_code: "MT-001",
          vessel_name: "Ocean Pioneer",
          vessel_type: "crude oil tanker",
          flag_country: "Nigeria",
          imo_number: "IMO1234567",
          capacity_tons: "75000.00",
          title: "75,000 MT Crude Oil Tanker",
          description: "Available for voyage charter.",
          charter_type: "voyage_charter",
          cargo_type: "crude oil",
          availability_status: "available",
          available_from: "2026-10-01",
          available_until: "2026-12-31",
          minimum_charter_days: 10,
          maximum_charter_days: 45,
          indicative_rate: "25000.00",
          rate_unit: "per_day",
          currency_code: "USD",
          verification_status: "verified",
          listing_status: "published",
          created_at: "2026-09-10T10:00:00.000Z",
          updated_at: "2026-09-12T10:00:00.000Z"
        }
      ]
    ]);

    const response = await request(app)
      .get("/api/marketplace/vessels");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);

    expect(response.body.data[0]).toEqual({
      id: 1,
      vesselId: 10,
      vesselCode: "MT-001",
      vesselName: "Ocean Pioneer",
      vesselType: "crude oil tanker",
      flagCountry: "Nigeria",
      imoNumber: "IMO1234567",
      capacityTons: 75000,
      title: "75,000 MT Crude Oil Tanker",
      description: "Available for voyage charter.",
      charterType: "voyage_charter",
      cargoType: "crude oil",
      availabilityStatus: "available",
      availableFrom: "2026-10-01",
      availableUntil: "2026-12-31",
      minimumCharterDays: 10,
      maximumCharterDays: 45,
      indicativeRate: 25000,
      rateUnit: "per_day",
      currencyCode: "USD",
      verificationStatus: "verified",
      listingStatus: "published",
      createdAt: "2026-09-10T10:00:00.000Z",
      updatedAt: "2026-09-12T10:00:00.000Z"
    });
  });

  test("GET /api/marketplace/vessels applies search filters", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .get("/api/marketplace/vessels")
      .query({
        cargoType: "crude oil",
        charterType: "voyage_charter",
        vesselType: "tanker",
        minCapacity: "50000",
        maxCapacity: "150000"
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(0);

    expect(pool.query).toHaveBeenCalledTimes(1);

    const [sql, params] = pool.query.mock.calls[0];

    expect(sql).toContain("l.listing_status = 'published'");
    expect(sql).toContain("l.verification_status = 'verified'");
    expect(sql).toContain("l.availability_status = 'available'");
    expect(sql).toContain("v.capacity_tons >= ?");
    expect(sql).toContain("v.capacity_tons <= ?");

    expect(params).toEqual([
      "crude oil",
      "voyage_charter",
      "%tanker%",
      50000,
      150000
    ]);
  });


  test("POST /api/marketplace/listings creates a draft listing", async () => {
    pool.query
      .mockResolvedValueOnce([
        [
          {
            id: "10",
            status: "active"
          }
        ]
      ])
      .mockResolvedValueOnce([
        {
          insertId: 25
        }
      ])
      .mockResolvedValueOnce([
        [
          {
            id: "25",
            vessel_id: "10",
            vessel_code: "MT-001",
            vessel_name: "Ocean Pioneer",
            vessel_type: "crude oil tanker",
            title: "75,000 MT Crude Oil Tanker",
            description: "Available for voyage charter.",
            charter_type: "voyage_charter",
            cargo_type: "crude oil",
            availability_status: "available",
            available_from: "2026-10-01",
            available_until: "2026-12-31",
            minimum_charter_days: 10,
            maximum_charter_days: 45,
            indicative_rate: "25000.00",
            rate_unit: "per_day",
            currency_code: "USD",
            verification_status: "pending",
            listing_status: "draft",
            created_at: "2026-09-15T10:00:00.000Z",
            updated_at: "2026-09-15T10:00:00.000Z"
          }
        ]
      ]);

    const response = await request(app)
      .post("/api/marketplace/listings")
      .send({
        vesselId: 10,
        title: "75,000 MT Crude Oil Tanker",
        description: "Available for voyage charter.",
        charterType: "voyage_charter",
        cargoType: "crude oil",
        availabilityStatus: "available",
        availableFrom: "2026-10-01",
        availableUntil: "2026-12-31",
        minimumCharterDays: 10,
        maximumCharterDays: 45,
        indicativeRate: 25000,
        rateUnit: "per_day",
        currencyCode: "USD",
        verificationStatus: "verified",
        listingStatus: "published"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(25);
    expect(response.body.data.vesselId).toBe(10);
    expect(response.body.data.vesselCode).toBe("MT-001");
    expect(response.body.data.vesselName).toBe("Ocean Pioneer");
    expect(response.body.data.verificationStatus).toBe("pending");
    expect(response.body.data.listingStatus).toBe("draft");

    expect(pool.query).toHaveBeenCalledTimes(3);

    const [insertSql, insertParams] = pool.query.mock.calls[1];

    expect(insertSql).toContain(
      "INSERT INTO vessel_marketplace_listings"
    );

    expect(insertParams).toEqual([
      10,
      1,
      "75,000 MT Crude Oil Tanker",
      "Available for voyage charter.",
      "voyage_charter",
      "crude oil",
      "available",
      "2026-10-01",
      "2026-12-31",
      10,
      45,
      25000,
      "per_day",
      "USD",
      "pending",
      "draft"
    ]);
  });

  test("POST /api/marketplace/listings rejects nonexistent vessel", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .post("/api/marketplace/listings")
      .send({
        vesselId: 999,
        title: "Test Vessel Listing"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe("Vessel not found");

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("POST /api/marketplace/listings rejects retired vessel", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: "10",
          status: "retired"
        }
      ]
    ]);

    const response = await request(app)
      .post("/api/marketplace/listings")
      .send({
        vesselId: 10,
        title: "Retired Vessel Listing"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Vessel is not available for marketplace listing"
    );

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("POST /api/marketplace/listings rejects invalid charter duration", async () => {
    const response = await request(app)
      .post("/api/marketplace/listings")
      .send({
        vesselId: 10,
        title: "Test Vessel Listing",
        minimumCharterDays: 60,
        maximumCharterDays: 30
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "minimumCharterDays cannot exceed maximumCharterDays"
    );

    expect(pool.query).not.toHaveBeenCalled();
  });


  test("GET /api/marketplace/vessels rejects invalid capacity filters", async () => {
    const response = await request(app)
      .get("/api/marketplace/vessels")
      .query({
        minCapacity: "not-a-number"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe("Invalid minCapacity");

    expect(pool.query).not.toHaveBeenCalled();
  });
});
