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


    test("GET /api/marketplace/listings returns management listings", async () => {
      pool.query.mockResolvedValueOnce([[{
        id: "25",
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
        verification_status: "pending",
        listing_status: "draft",
        listed_by_user_id: "1",
        created_at: "2026-09-15T10:00:00.000Z",
        updated_at: "2026-09-15T10:00:00.000Z"
      }]]);

      const response = await request(app).get("/api/marketplace/listings");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.data[0].id).toBe(25);
      expect(response.body.data[0].verificationStatus).toBe("pending");
      expect(response.body.data[0].listingStatus).toBe("draft");
    });

    test("GET /api/marketplace/listings returns 500 when the database fails", async () => {
      pool.query.mockRejectedValueOnce(new Error("database unavailable"));

      const response = await request(app).get("/api/marketplace/listings");

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: "Unable to load marketplace listings"
      });
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

  test("PATCH /listings/:id/verification verifies a pending listing and keeps it draft", async () => {
    pool.query
      .mockResolvedValueOnce([[
        {
          id: 1,
          vessel_id: 1,
          listed_by_user_id: 1,
          title: "Ocean Pioneer Fishing Vessel Charter",
          verification_status: "pending",
          listing_status: "draft",
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer"
        }
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([[
        {
          id: 1,
          vessel_id: 1,
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer",
          vessel_type: "fishing",
          title: "Ocean Pioneer Fishing Vessel Charter",
          description: "Available for fishing charter.",
          charter_type: "voyage_charter",
          cargo_type: "Fish",
          availability_status: "available",
          available_from: "2026-09-16",
          available_until: null,
          minimum_charter_days: 5,
          maximum_charter_days: 30,
          indicative_rate: "2500.00",
          rate_unit: "per_day",
          currency_code: "USD",
          verification_status: "verified",
          listing_status: "draft",
          created_at: "2026-09-15 14:02:20",
          updated_at: "2026-09-18 22:00:00"
        }
      ]]);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/verification")
      .send({ verificationStatus: "verified" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Marketplace listing verified successfully"
    );
    expect(response.body.data.verificationStatus).toBe("verified");
    expect(response.body.data.listingStatus).toBe("draft");
    expect(response.body.data.vesselCode).toBe("MD-001");
    expect(response.body.data.indicativeRate).toBe(2500);

    expect(pool.query).toHaveBeenCalledTimes(4);

    const updateCall = pool.query.mock.calls[1];
    expect(updateCall[1]).toEqual(["verified", 1]);

    const auditCall = pool.query.mock.calls[2];
    expect(auditCall[1][0]).toBe(1);
    expect(auditCall[1][1]).toBe("verify_marketplace_listing");
    expect(auditCall[1][2]).toBe("marketplace_listing");
    expect(auditCall[1][3]).toBe(1);

    const auditDetails = JSON.parse(auditCall[1][4]);
    expect(auditDetails.before.verificationStatus).toBe("pending");
    expect(auditDetails.before.listingStatus).toBe("draft");
    expect(auditDetails.after.verificationStatus).toBe("verified");
    expect(auditDetails.after.listingStatus).toBe("draft");
  });

  test("PATCH /listings/:id/verification rejects a pending listing and keeps it draft", async () => {
    pool.query
      .mockResolvedValueOnce([[
        {
          id: 2,
          vessel_id: 1,
          listed_by_user_id: 1,
          title: "Ocean Pioneer Charter",
          verification_status: "pending",
          listing_status: "draft",
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer"
        }
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 2 }])
      .mockResolvedValueOnce([[
        {
          id: 2,
          vessel_id: 1,
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer",
          vessel_type: "fishing",
          title: "Ocean Pioneer Charter",
          description: "Pending marketplace review.",
          charter_type: "voyage_charter",
          cargo_type: "Fish",
          availability_status: "available",
          available_from: "2026-09-16",
          available_until: null,
          minimum_charter_days: 5,
          maximum_charter_days: 30,
          indicative_rate: "2500.00",
          rate_unit: "per_day",
          currency_code: "USD",
          verification_status: "rejected",
          listing_status: "draft",
          created_at: "2026-09-15 14:02:20",
          updated_at: "2026-09-18 22:00:00"
        }
      ]]);

    const response = await request(app)
      .patch("/api/marketplace/listings/2/verification")
      .send({ verificationStatus: "rejected" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Marketplace listing rejected successfully"
    );
    expect(response.body.data.verificationStatus).toBe("rejected");
    expect(response.body.data.listingStatus).toBe("draft");

    expect(pool.query).toHaveBeenCalledTimes(4);

    const auditCall = pool.query.mock.calls[2];
    expect(auditCall[1][0]).toBe(1);
    expect(auditCall[1][1]).toBe("reject_marketplace_listing");
    expect(auditCall[1][2]).toBe("marketplace_listing");
    expect(auditCall[1][3]).toBe(2);

    const auditDetails = JSON.parse(auditCall[1][4]);
    expect(auditDetails.before.verificationStatus).toBe("pending");
    expect(auditDetails.after.verificationStatus).toBe("rejected");
    expect(auditDetails.after.listingStatus).toBe("draft");
  });

  test("PATCH /listings/:id/verification rejects invalid verification status", async () => {
    const response = await request(app)
      .patch("/api/marketplace/listings/1/verification")
      .send({ verificationStatus: "published" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "verificationStatus must be either verified or rejected"
    );
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("PATCH /listings/:id/verification returns 404 for a missing listing", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .patch("/api/marketplace/listings/999/verification")
      .send({ verificationStatus: "verified" });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Marketplace listing not found"
    );
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("PATCH /listings/:id/verification returns 409 for an already verified listing", async () => {
    pool.query.mockResolvedValueOnce([[
      {
        id: 1,
        vessel_id: 1,
        listed_by_user_id: 1,
        title: "Already Verified Listing",
        verification_status: "verified",
        listing_status: "draft",
        vessel_code: "MD-001",
        vessel_name: "Ocean Pioneer"
      }
    ]]);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/verification")
      .send({ verificationStatus: "verified" });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Marketplace listing is already verified"
    );
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("PATCH /listings/:id/verification returns 500 when the database fails", async () => {
    const dbError = new Error("database failure");
    pool.query.mockRejectedValueOnce(dbError);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/verification")
      .send({ verificationStatus: "verified" });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Unable to update marketplace listing verification"
    );

    const logger = require("../../lib/logger");
    expect(logger.error).toHaveBeenCalled();
  });
  test("PATCH /listings/:id/verification returns 409 when the pending state changes before update", async () => {
    pool.query
      .mockResolvedValueOnce([[
        {
          id: 1,
          vessel_id: 1,
          listed_by_user_id: 1,
          title: "Ocean Pioneer Fishing Vessel Charter",
          verification_status: "pending",
          listing_status: "draft",
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer"
        }
      ]])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/verification")
      .send({ verificationStatus: "verified" });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Marketplace listing verification state changed before the update completed"
    );

    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test("PATCH /listings/:id/publish publishes a verified draft listing", async () => {
    pool.query
      .mockResolvedValueOnce([[
        {
          id: 1,
          vessel_id: 1,
          listed_by_user_id: 1,
          title: "Ocean Pioneer Fishing Vessel Charter",
          verification_status: "verified",
          listing_status: "draft",
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer"
        }
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[
        {
          id: 1,
          vessel_id: 1,
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer",
          vessel_type: "fishing",
          title: "Ocean Pioneer Fishing Vessel Charter",
          description: "Available for fishing charter.",
          charter_type: "voyage_charter",
          cargo_type: "fish",
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
          created_at: "2026-09-18T21:00:00.000Z",
          updated_at: "2026-09-18T22:00:00.000Z"
        }
      ]]);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/publish");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Marketplace listing published successfully"
    );

    expect(response.body.data).toEqual({
      id: 1,
      vesselId: 1,
      vesselCode: "MD-001",
      vesselName: "Ocean Pioneer",
      vesselType: "fishing",
      title: "Ocean Pioneer Fishing Vessel Charter",
      description: "Available for fishing charter.",
      charterType: "voyage_charter",
      cargoType: "fish",
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
      createdAt: "2026-09-18T21:00:00.000Z",
      updatedAt: "2026-09-18T22:00:00.000Z"
    });

    expect(pool.query).toHaveBeenCalledTimes(4);

    expect(pool.query.mock.calls[1][1]).toEqual([1]);

    expect(pool.query.mock.calls[2][1]).toEqual([
      1,
      "publish_marketplace_listing",
      "marketplace_listing",
      1,
      expect.any(String),
      expect.any(String)
    ]);

    expect(pool.query.mock.calls[2][0]).toContain(
      "INSERT INTO audit_logs"
    );
  });

  test("PATCH /listings/:id/publish returns 409 when the listing is not verified", async () => {
    pool.query.mockResolvedValueOnce([[
      {
        id: 1,
        vessel_id: 1,
        listed_by_user_id: 1,
        title: "Unverified Listing",
        verification_status: "pending",
        listing_status: "draft",
        vessel_code: "MD-001",
        vessel_name: "Ocean Pioneer"
      }
    ]]);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/publish");

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Marketplace listing must be verified before it can be published"
    );
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("PATCH /listings/:id/publish returns 409 for an already published listing", async () => {
    pool.query.mockResolvedValueOnce([[
      {
        id: 1,
        vessel_id: 1,
        listed_by_user_id: 1,
        title: "Published Listing",
        verification_status: "verified",
        listing_status: "published",
        vessel_code: "MD-001",
        vessel_name: "Ocean Pioneer"
      }
    ]]);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/publish");

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Marketplace listing is already published"
    );
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("PATCH /listings/:id/publish returns 404 for a missing listing", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .patch("/api/marketplace/listings/999/publish");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Marketplace listing not found"
    );
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("PATCH /listings/:id/publish returns 500 when the database fails", async () => {
    const dbError = new Error("database failure");
    pool.query.mockRejectedValueOnce(dbError);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/publish");

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Unable to publish marketplace listing"
    );

    const logger = require("../../lib/logger");
    expect(logger.error).toHaveBeenCalled();
  });

  test("PATCH /listings/:id/publish returns 409 when the draft state changes before publication", async () => {
    pool.query
      .mockResolvedValueOnce([[
        {
          id: 1,
          vessel_id: 1,
          listed_by_user_id: 1,
          title: "Ocean Pioneer Fishing Vessel Charter",
          verification_status: "verified",
          listing_status: "draft",
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer"
        }
      ]])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/publish");

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Marketplace listing state changed before publication completed"
    );

    expect(pool.query).toHaveBeenCalledTimes(2);
    });

  test("PATCH /listings/:id/suspend suspends a verified published listing", async () => {
    pool.query
      .mockResolvedValueOnce([[
        {
          id: 1,
          vessel_id: 1,
          listed_by_user_id: 1,
          title: "Ocean Pioneer Fishing Vessel Charter",
          verification_status: "verified",
          listing_status: "published",
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer"
        }
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[
        {
          id: 1,
          vessel_id: 1,
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer",
          vessel_type: "fishing",
          title: "Ocean Pioneer Fishing Vessel Charter",
          description: "Available for fishing charter.",
          charter_type: "voyage_charter",
          cargo_type: "fish",
          availability_status: "available",
          available_from: "2026-10-01",
          available_until: "2026-12-31",
          minimum_charter_days: 10,
          maximum_charter_days: 45,
          indicative_rate: "25000.00",
          rate_unit: "per_day",
          currency_code: "USD",
          verification_status: "verified",
          listing_status: "suspended",
          created_at: "2026-09-18T21:00:00.000Z",
          updated_at: "2026-09-18T22:00:00.000Z"
        }
      ]]);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/suspend");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Marketplace listing suspended successfully"
    );

    expect(response.body.data).toEqual({
      id: 1,
      vesselId: 1,
      vesselCode: "MD-001",
      vesselName: "Ocean Pioneer",
      vesselType: "fishing",
      title: "Ocean Pioneer Fishing Vessel Charter",
      description: "Available for fishing charter.",
      charterType: "voyage_charter",
      cargoType: "fish",
      availabilityStatus: "available",
      availableFrom: "2026-10-01",
      availableUntil: "2026-12-31",
      minimumCharterDays: 10,
      maximumCharterDays: 45,
      indicativeRate: 25000,
      rateUnit: "per_day",
      currencyCode: "USD",
      verificationStatus: "verified",
      listingStatus: "suspended",
      createdAt: "2026-09-18T21:00:00.000Z",
      updatedAt: "2026-09-18T22:00:00.000Z"
    });

    expect(pool.query).toHaveBeenCalledTimes(4);

    expect(pool.query.mock.calls[1][1]).toEqual([1]);

    expect(pool.query.mock.calls[2][1]).toEqual([
      1,
      "suspend_marketplace_listing",
      "marketplace_listing",
      1,
      expect.any(String),
      expect.any(String)
    ]);

    expect(pool.query.mock.calls[2][0]).toContain(
      "INSERT INTO audit_logs"
    );
  });

  test("PATCH /listings/:id/suspend returns 409 when the listing is not verified", async () => {
    pool.query.mockResolvedValueOnce([[
      {
        id: 1,
        vessel_id: 1,
        listed_by_user_id: 1,
        title: "Unverified Listing",
        verification_status: "pending",
        listing_status: "published",
        vessel_code: "MD-001",
        vessel_name: "Ocean Pioneer"
      }
    ]]);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/suspend");

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Only verified marketplace listings can be suspended"
    );
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("PATCH /listings/:id/suspend returns 409 for a listing that is not published", async () => {
    pool.query.mockResolvedValueOnce([[
      {
        id: 1,
        vessel_id: 1,
        listed_by_user_id: 1,
        title: "Draft Listing",
        verification_status: "verified",
        listing_status: "draft",
        vessel_code: "MD-001",
        vessel_name: "Ocean Pioneer"
      }
    ]]);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/suspend");

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Marketplace listing is draft, not published"
    );
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("PATCH /listings/:id/suspend returns 404 for a missing listing", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .patch("/api/marketplace/listings/999/suspend");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Marketplace listing not found"
    );
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("PATCH /listings/:id/suspend returns 500 when the database fails", async () => {
    const dbError = new Error("database failure");
    pool.query.mockRejectedValueOnce(dbError);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/suspend");

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Unable to suspend marketplace listing"
    );

    const logger = require("../../lib/logger");
    expect(logger.error).toHaveBeenCalled();
  });

  test("PATCH /listings/:id/suspend returns 409 when the published state changes before suspension", async () => {
    pool.query
      .mockResolvedValueOnce([[
        {
          id: 1,
          vessel_id: 1,
          listed_by_user_id: 1,
          title: "Ocean Pioneer Fishing Vessel Charter",
          verification_status: "verified",
          listing_status: "published",
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer"
        }
      ]])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/suspend");

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Marketplace listing state changed before suspension completed"
    );

    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test("PATCH /listings/:id/resume resumes a verified suspended listing", async () => {
    pool.query
      .mockResolvedValueOnce([[
        {
          id: 1,
          vessel_id: 1,
          listed_by_user_id: 1,
          title: "Ocean Pioneer Fishing Vessel Charter",
          verification_status: "verified",
          listing_status: "suspended",
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer"
        }
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[
        {
          id: 1,
          vessel_id: 1,
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer",
          vessel_type: "fishing",
          title: "Ocean Pioneer Fishing Vessel Charter",
          description: "Available for fishing charter.",
          charter_type: "voyage_charter",
          cargo_type: "fish",
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
          created_at: "2026-09-18T21:00:00.000Z",
          updated_at: "2026-09-18T22:00:00.000Z"
        }
      ]]);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/resume");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Marketplace listing resumed successfully"
    );

    expect(response.body.data).toEqual({
      id: 1,
      vesselId: 1,
      vesselCode: "MD-001",
      vesselName: "Ocean Pioneer",
      vesselType: "fishing",
      title: "Ocean Pioneer Fishing Vessel Charter",
      description: "Available for fishing charter.",
      charterType: "voyage_charter",
      cargoType: "fish",
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
      createdAt: "2026-09-18T21:00:00.000Z",
      updatedAt: "2026-09-18T22:00:00.000Z"
    });

    expect(pool.query).toHaveBeenCalledTimes(4);

    expect(pool.query.mock.calls[1][1]).toEqual([1]);

    expect(pool.query.mock.calls[2][1]).toEqual([
      1,
      "resume_marketplace_listing",
      "marketplace_listing",
      1,
      expect.any(String),
      expect.any(String)
    ]);

    expect(pool.query.mock.calls[2][0]).toContain(
      "INSERT INTO audit_logs"
    );
  });

  test("PATCH /listings/:id/resume returns 409 when the listing is not verified", async () => {
    pool.query.mockResolvedValueOnce([[
      {
        id: 1,
        vessel_id: 1,
        listed_by_user_id: 1,
        title: "Unverified Listing",
        verification_status: "pending",
        listing_status: "suspended",
        vessel_code: "MD-001",
        vessel_name: "Ocean Pioneer"
      }
    ]]);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/resume");

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Only verified marketplace listings can be resumed"
    );
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("PATCH /listings/:id/resume returns 409 for a listing that is not suspended", async () => {
    pool.query.mockResolvedValueOnce([[
      {
        id: 1,
        vessel_id: 1,
        listed_by_user_id: 1,
        title: "Published Listing",
        verification_status: "verified",
        listing_status: "published",
        vessel_code: "MD-001",
        vessel_name: "Ocean Pioneer"
      }
    ]]);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/resume");

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Marketplace listing is published, not suspended"
    );
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("PATCH /listings/:id/resume returns 404 for a missing listing", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .patch("/api/marketplace/listings/999/resume");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Marketplace listing not found"
    );
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("PATCH /listings/:id/resume returns 500 when the database fails", async () => {
    const dbError = new Error("database failure");
    pool.query.mockRejectedValueOnce(dbError);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/resume");

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Unable to resume marketplace listing"
    );

    const logger = require("../../lib/logger");
    expect(logger.error).toHaveBeenCalled();
  });

  test("PATCH /listings/:id/resume returns 409 when the suspended state changes before resumption", async () => {
    pool.query
      .mockResolvedValueOnce([[
        {
          id: 1,
          vessel_id: 1,
          listed_by_user_id: 1,
          title: "Ocean Pioneer Fishing Vessel Charter",
          verification_status: "verified",
          listing_status: "suspended",
          vessel_code: "MD-001",
          vessel_name: "Ocean Pioneer"
        }
      ]])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);

    const response = await request(app)
      .patch("/api/marketplace/listings/1/resume");

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe(
      "Marketplace listing state changed before resumption completed"
    );

    expect(pool.query).toHaveBeenCalledTimes(2);
  });
});
