const express = require("express");
const pool = require("../db");
const logger = require("../lib/logger");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

/*
 * GET /api/marketplace/vessels
 *
 * Search published and verified vessels available for charter.
 */
router.get("/vessels", async (req, res) => {
  try {
    const {
      cargoType,
      charterType,
      vesselType,
      minCapacity,
      maxCapacity
    } = req.query;

    const conditions = [
      "l.listing_status = 'published'",
      "l.verification_status = 'verified'",
      "l.availability_status = 'available'",
      "v.status NOT IN ('retired', 'out_of_service')"
    ];

    const params = [];

    if(cargoType){
      conditions.push("LOWER(l.cargo_type) = LOWER(?)");
      params.push(String(cargoType).trim());
    }

    if(charterType){
      conditions.push("l.charter_type = ?");
      params.push(String(charterType).trim());
    }

    if(vesselType){
      conditions.push("LOWER(v.vessel_type) LIKE LOWER(?)");
      params.push(`%${String(vesselType).trim()}%`);
    }

    if(minCapacity !== undefined){
      const value = Number(minCapacity);

      if(!Number.isFinite(value) || value < 0){
        return res.status(400).json({
          success: false,
          error: "Invalid minCapacity"
        });
      }

      conditions.push("v.capacity_tons >= ?");
      params.push(value);
    }

    if(maxCapacity !== undefined){
      const value = Number(maxCapacity);

      if(!Number.isFinite(value) || value < 0){
        return res.status(400).json({
          success: false,
          error: "Invalid maxCapacity"
        });
      }

      conditions.push("v.capacity_tons <= ?");
      params.push(value);
    }

    const [rows] = await pool.query(`
      SELECT
        l.id,
        l.vessel_id,
        v.vessel_code,
        v.name AS vessel_name,
        v.vessel_type,
        v.flag_country,
        v.imo_number,
        v.capacity_tons,
        l.title,
        l.description,
        l.charter_type,
        l.cargo_type,
        l.availability_status,
        DATE_FORMAT(l.available_from, '%Y-%m-%d') AS available_from,
        DATE_FORMAT(l.available_until, '%Y-%m-%d') AS available_until,
        l.minimum_charter_days,
        l.maximum_charter_days,
        l.indicative_rate,
        l.rate_unit,
        l.currency_code,
        l.verification_status,
        l.listing_status,
        l.created_at,
        l.updated_at
      FROM vessel_marketplace_listings l
      INNER JOIN vessels v
        ON v.id = l.vessel_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY l.updated_at DESC, l.id DESC
    `, params);

    const vessels = rows.map((row) => ({
      id: Number(row.id),
      vesselId: Number(row.vessel_id),
      vesselCode: row.vessel_code,
      vesselName: row.vessel_name,
      vesselType: row.vessel_type,
      flagCountry: row.flag_country,
      imoNumber: row.imo_number,
      capacityTons: Number(row.capacity_tons),
      title: row.title,
      description: row.description,
      charterType: row.charter_type,
      cargoType: row.cargo_type,
      availabilityStatus: row.availability_status,
      availableFrom: row.available_from,
      availableUntil: row.available_until,
      minimumCharterDays: row.minimum_charter_days,
      maximumCharterDays: row.maximum_charter_days,
      indicativeRate: row.indicative_rate === null
        ? null
        : Number(row.indicative_rate),
      rateUnit: row.rate_unit,
      currencyCode: row.currency_code,
      verificationStatus: row.verification_status,
      listingStatus: row.listing_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return res.json({
      success: true,
      count: vessels.length,
      data: vessels,
      generatedAt: new Date().toISOString()
    });

  } catch(error){
    logger.error(
      { err: error },
      "Marketplace vessel search API error"
    );

    return res.status(500).json({
      success: false,
      error: "Unable to search marketplace vessels"
    });
  }
});

/*
 * POST /api/marketplace/listings
 *
 * Creates a vessel marketplace listing.
 */
router.post("/listings", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const body = req.body || {};

    const vesselId = Number(body.vesselId);
    const title = String(body.title || "").trim();
    const description = body.description == null
      ? null
      : String(body.description).trim() || null;

    const charterType = String(body.charterType || "voyage_charter").trim();
    const cargoType = body.cargoType == null
      ? null
      : String(body.cargoType).trim() || null;

    const availabilityStatus = String(
      body.availabilityStatus || "available"
    ).trim();

    const availableFrom = body.availableFrom == null
      ? null
      : String(body.availableFrom).trim() || null;

    const availableUntil = body.availableUntil == null
      ? null
      : String(body.availableUntil).trim() || null;

    const minimumCharterDays = body.minimumCharterDays == null ||
      body.minimumCharterDays === ""
      ? null
      : Number(body.minimumCharterDays);

    const maximumCharterDays = body.maximumCharterDays == null ||
      body.maximumCharterDays === ""
      ? null
      : Number(body.maximumCharterDays);

    const indicativeRate = body.indicativeRate == null ||
      body.indicativeRate === ""
      ? null
      : Number(body.indicativeRate);

    const rateUnit = body.rateUnit == null
      ? null
      : String(body.rateUnit).trim() || null;

    const currencyCode = String(
      body.currencyCode || "USD"
    ).trim().toUpperCase();

    const verificationStatus = "pending";
    const listingStatus = "draft";

    const validCharterTypes = [
      "voyage_charter",
      "time_charter",
      "bareboat",
      "contract_of_affreightment"
    ];

    const validAvailabilityStatuses = [
      "available",
      "under_enquiry",
      "under_negotiation",
      "chartered",
      "unavailable"
    ];

    const validRateUnits = [
      "per_day",
      "per_voyage",
      "per_metric_ton",
      "lump_sum"
    ];

    const validVerificationStatuses = [
      "pending",
      "verified",
      "rejected"
    ];

    const validListingStatuses = [
      "draft",
      "published",
      "suspended",
      "closed"
    ];

    if(!Number.isInteger(vesselId) || vesselId <= 0){
      return res.status(400).json({
        success: false,
        error: "vesselId must be a positive integer"
      });
    }

    if(!title){
      return res.status(400).json({
        success: false,
        error: "title is required"
      });
    }

    if(!validCharterTypes.includes(charterType)){
      return res.status(400).json({
        success: false,
        error: "Invalid charterType"
      });
    }

    if(!validAvailabilityStatuses.includes(availabilityStatus)){
      return res.status(400).json({
        success: false,
        error: "Invalid availabilityStatus"
      });
    }

    if(!validRateUnits.includes(rateUnit) && rateUnit !== null){
      return res.status(400).json({
        success: false,
        error: "Invalid rateUnit"
      });
    }

    if(!validVerificationStatuses.includes(verificationStatus)){
      return res.status(400).json({
        success: false,
        error: "Invalid verificationStatus"
      });
    }

    if(!validListingStatuses.includes(listingStatus)){
      return res.status(400).json({
        success: false,
        error: "Invalid listingStatus"
      });
    }

    if(!/^[A-Z]{3}$/.test(currencyCode)){
      return res.status(400).json({
        success: false,
        error: "currencyCode must be a 3-letter ISO-style code"
      });
    }

    if(
      minimumCharterDays !== null &&
      (!Number.isInteger(minimumCharterDays) || minimumCharterDays < 0)
    ){
      return res.status(400).json({
        success: false,
        error: "minimumCharterDays must be a non-negative integer"
      });
    }

    if(
      maximumCharterDays !== null &&
      (!Number.isInteger(maximumCharterDays) || maximumCharterDays < 0)
    ){
      return res.status(400).json({
        success: false,
        error: "maximumCharterDays must be a non-negative integer"
      });
    }

    if(
      minimumCharterDays !== null &&
      maximumCharterDays !== null &&
      minimumCharterDays > maximumCharterDays
    ){
      return res.status(400).json({
        success: false,
        error: "minimumCharterDays cannot exceed maximumCharterDays"
      });
    }

    if(
      indicativeRate !== null &&
      (!Number.isFinite(indicativeRate) || indicativeRate < 0)
    ){
      return res.status(400).json({
        success: false,
        error: "indicativeRate must be a non-negative number"
      });
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if(availableFrom !== null && !datePattern.test(availableFrom)){
      return res.status(400).json({
        success: false,
        error: "availableFrom must use YYYY-MM-DD format"
      });
    }

    if(availableUntil !== null && !datePattern.test(availableUntil)){
      return res.status(400).json({
        success: false,
        error: "availableUntil must use YYYY-MM-DD format"
      });
    }

    if(
      availableFrom !== null &&
      availableUntil !== null &&
      availableFrom > availableUntil
    ){
      return res.status(400).json({
        success: false,
        error: "availableFrom cannot be after availableUntil"
      });
    }

    const [vesselRows] = await pool.query(
      `
        SELECT id, status
        FROM vessels
        WHERE id = ?
        LIMIT 1
      `,
      [vesselId]
    );

    if(vesselRows.length === 0){
      return res.status(400).json({
        success: false,
        error: "Vessel not found"
      });
    }

    if(["retired", "out_of_service"].includes(vesselRows[0].status)){
      return res.status(400).json({
        success: false,
        error: "Vessel is not available for marketplace listing"
      });
    }

    const [result] = await pool.query(
      `
        INSERT INTO vessel_marketplace_listings (
          vessel_id,
          listed_by_user_id,
          title,
          description,
          charter_type,
          cargo_type,
          availability_status,
          available_from,
          available_until,
          minimum_charter_days,
          maximum_charter_days,
          indicative_rate,
          rate_unit,
          currency_code,
          verification_status,
          listing_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        vesselId,
        req.session.user.id,
        title,
        description,
        charterType,
        cargoType,
        availabilityStatus,
        availableFrom,
        availableUntil,
        minimumCharterDays,
        maximumCharterDays,
        indicativeRate,
        rateUnit,
        currencyCode,
        verificationStatus,
        listingStatus
      ]
    );

    const [rows] = await pool.query(
      `
        SELECT
          l.id,
          l.vessel_id,
          v.vessel_code,
          v.name AS vessel_name,
          v.vessel_type,
          l.title,
          l.description,
          l.charter_type,
          l.cargo_type,
          l.availability_status,
          DATE_FORMAT(l.available_from, '%Y-%m-%d') AS available_from,
          DATE_FORMAT(l.available_until, '%Y-%m-%d') AS available_until,
          l.minimum_charter_days,
          l.maximum_charter_days,
          l.indicative_rate,
          l.rate_unit,
          l.currency_code,
          l.verification_status,
          l.listing_status,
          l.created_at,
          l.updated_at
        FROM vessel_marketplace_listings l
        INNER JOIN vessels v
          ON v.id = l.vessel_id
        WHERE l.id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    const listing = rows[0];

    return res.status(201).json({
      success: true,
      data: {
        id: Number(listing.id),
        vesselId: Number(listing.vessel_id),
        vesselCode: listing.vessel_code,
        vesselName: listing.vessel_name,
        vesselType: listing.vessel_type,
        title: listing.title,
        description: listing.description,
        charterType: listing.charter_type,
        cargoType: listing.cargo_type,
        availabilityStatus: listing.availability_status,
        availableFrom: listing.available_from,
        availableUntil: listing.available_until,
        minimumCharterDays: listing.minimum_charter_days,
        maximumCharterDays: listing.maximum_charter_days,
        indicativeRate: listing.indicative_rate === null
          ? null
          : Number(listing.indicative_rate),
        rateUnit: listing.rate_unit,
        currencyCode: listing.currency_code,
        verificationStatus: listing.verification_status,
        listingStatus: listing.listing_status,
        createdAt: listing.created_at,
        updatedAt: listing.updated_at
      },
      message: "Marketplace listing created successfully"
    });

  } catch(error){
    logger.error(
      { err: error },
      "Marketplace listing creation API error"
    );

    return res.status(500).json({
      success: false,
      error: "Unable to create marketplace listing"
    });
  }
});

/*
 * PATCH /api/marketplace/listings/:id/verification
 *
 * Verifies or rejects a pending marketplace listing.
 * Verification does not publish the listing.
 */
router.patch(
  "/listings/:id/verification",
  requireRole("super_admin", "admin"),
  async (req, res) => {
    try {
      const listingId = Number(req.params.id);

      if(!Number.isInteger(listingId) || listingId <= 0){
        return res.status(400).json({
          success: false,
          error: "Invalid marketplace listing ID"
        });
      }

      const verificationStatus = String(
        req.body?.verificationStatus || ""
      ).trim();

      if(!["verified", "rejected"].includes(verificationStatus)){
        return res.status(400).json({
          success: false,
          error: "verificationStatus must be either verified or rejected"
        });
      }

      const [rows] = await pool.query(
        `
          SELECT
            l.id,
            l.vessel_id,
            l.listed_by_user_id,
            l.title,
            l.verification_status,
            l.listing_status,
            v.vessel_code,
            v.name AS vessel_name
          FROM vessel_marketplace_listings l
          INNER JOIN vessels v
            ON v.id = l.vessel_id
          WHERE l.id = ?
          LIMIT 1
        `,
        [listingId]
      );

      if(rows.length === 0){
        return res.status(404).json({
          success: false,
          error: "Marketplace listing not found"
        });
      }

      const listing = rows[0];

      if(listing.verification_status !== "pending"){
        return res.status(409).json({
          success: false,
          error: `Marketplace listing is already ${listing.verification_status}`
        });
      }

      const [updateResult] = await pool.query(
        `
          UPDATE vessel_marketplace_listings
          SET verification_status = ?
          WHERE id = ?
            AND verification_status = 'pending'
          LIMIT 1
        `,
        [verificationStatus, listingId]
      );
      if(updateResult.affectedRows !== 1){
        return res.status(409).json({
          success: false,
          error: "Marketplace listing verification state changed before the update completed"
        });
      }

      await pool.query(
        `
          INSERT INTO audit_logs
            (user_id, action, entity_type, entity_id, details, ip_address)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          req.session.user.id,
          verificationStatus === "verified"
            ? "verify_marketplace_listing"
            : "reject_marketplace_listing",
          "marketplace_listing",
          listingId,
          JSON.stringify({
            listingId,
            vesselId: Number(listing.vessel_id),
            vesselCode: listing.vessel_code,
            vesselName: listing.vessel_name,
            title: listing.title,
            before: {
              verificationStatus: listing.verification_status,
              listingStatus: listing.listing_status
            },
            after: {
              verificationStatus,
              listingStatus: listing.listing_status
            }
          }),
          req.ip || null
        ]
      );

      const [updatedRows] = await pool.query(
        `
          SELECT
            l.id,
            l.vessel_id,
            v.vessel_code,
            v.name AS vessel_name,
            v.vessel_type,
            l.title,
            l.description,
            l.charter_type,
            l.cargo_type,
            l.availability_status,
            DATE_FORMAT(l.available_from, '%Y-%m-%d') AS available_from,
            DATE_FORMAT(l.available_until, '%Y-%m-%d') AS available_until,
            l.minimum_charter_days,
            l.maximum_charter_days,
            l.indicative_rate,
            l.rate_unit,
            l.currency_code,
            l.verification_status,
            l.listing_status,
            l.created_at,
            l.updated_at
          FROM vessel_marketplace_listings l
          INNER JOIN vessels v
            ON v.id = l.vessel_id
          WHERE l.id = ?
          LIMIT 1
        `,
        [listingId]
      );

      const updatedListing = updatedRows[0];

      return res.json({
        success: true,
        message: verificationStatus === "verified"
          ? "Marketplace listing verified successfully"
          : "Marketplace listing rejected successfully",
        data: {
          id: Number(updatedListing.id),
          vesselId: Number(updatedListing.vessel_id),
          vesselCode: updatedListing.vessel_code,
          vesselName: updatedListing.vessel_name,
          vesselType: updatedListing.vessel_type,
          title: updatedListing.title,
          description: updatedListing.description,
          charterType: updatedListing.charter_type,
          cargoType: updatedListing.cargo_type,
          availabilityStatus: updatedListing.availability_status,
          availableFrom: updatedListing.available_from,
          availableUntil: updatedListing.available_until,
          minimumCharterDays: updatedListing.minimum_charter_days,
          maximumCharterDays: updatedListing.maximum_charter_days,
          indicativeRate: updatedListing.indicative_rate === null
            ? null
            : Number(updatedListing.indicative_rate),
          rateUnit: updatedListing.rate_unit,
          currencyCode: updatedListing.currency_code,
          verificationStatus: updatedListing.verification_status,
          listingStatus: updatedListing.listing_status,
          createdAt: updatedListing.created_at,
          updatedAt: updatedListing.updated_at
        }
      });

    } catch(error){
      logger.error(
        { err: error },
        "Marketplace listing verification API error"
      );

      return res.status(500).json({
        success: false,
        error: "Unable to update marketplace listing verification"
      });
    }
  }
);


/*
 * PATCH /api/marketplace/listings/:id/publish
 *
 * Publishes a verified draft marketplace listing.
 * Publication does not change verification status.
 */
router.patch(
  "/listings/:id/publish",
  requireRole("super_admin", "admin"),
  async (req, res) => {
    try {
      const listingId = Number(req.params.id);

      if(!Number.isInteger(listingId) || listingId <= 0){
        return res.status(400).json({
          success: false,
          error: "Invalid marketplace listing ID"
        });
      }

      const [rows] = await pool.query(
        `
          SELECT
            l.id,
            l.vessel_id,
            l.listed_by_user_id,
            l.title,
            l.verification_status,
            l.listing_status,
            v.vessel_code,
            v.name AS vessel_name
          FROM vessel_marketplace_listings l
          INNER JOIN vessels v
            ON v.id = l.vessel_id
          WHERE l.id = ?
          LIMIT 1
        `,
        [listingId]
      );

      if(rows.length === 0){
        return res.status(404).json({
          success: false,
          error: "Marketplace listing not found"
        });
      }

      const listing = rows[0];

      if(listing.verification_status !== "verified"){
        return res.status(409).json({
          success: false,
          error: "Marketplace listing must be verified before it can be published"
        });
      }

      if(listing.listing_status !== "draft"){
        return res.status(409).json({
          success: false,
          error: `Marketplace listing is already ${listing.listing_status}`
        });
      }

      const [updateResult] = await pool.query(
        `
          UPDATE vessel_marketplace_listings
          SET listing_status = 'published'
          WHERE id = ?
            AND verification_status = 'verified'
            AND listing_status = 'draft'
          LIMIT 1
        `,
        [listingId]
      );

      if(updateResult.affectedRows !== 1){
        return res.status(409).json({
          success: false,
          error: "Marketplace listing state changed before publication completed"
        });
      }

      await pool.query(
        `
          INSERT INTO audit_logs
            (user_id, action, entity_type, entity_id, details, ip_address)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          req.session.user.id,
          "publish_marketplace_listing",
          "marketplace_listing",
          listingId,
          JSON.stringify({
            listingId,
            vesselId: Number(listing.vessel_id),
            vesselCode: listing.vessel_code,
            vesselName: listing.vessel_name,
            title: listing.title,
            before: {
              verificationStatus: listing.verification_status,
              listingStatus: listing.listing_status
            },
            after: {
              verificationStatus: listing.verification_status,
              listingStatus: "published"
            }
          }),
          req.ip || null
        ]
      );

      const [updatedRows] = await pool.query(
        `
          SELECT
            l.id,
            l.vessel_id,
            v.vessel_code,
            v.name AS vessel_name,
            v.vessel_type,
            l.title,
            l.description,
            l.charter_type,
            l.cargo_type,
            l.availability_status,
            DATE_FORMAT(l.available_from, '%Y-%m-%d') AS available_from,
            DATE_FORMAT(l.available_until, '%Y-%m-%d') AS available_until,
            l.minimum_charter_days,
            l.maximum_charter_days,
            l.indicative_rate,
            l.rate_unit,
            l.currency_code,
            l.verification_status,
            l.listing_status,
            l.created_at,
            l.updated_at
          FROM vessel_marketplace_listings l
          INNER JOIN vessels v
            ON v.id = l.vessel_id
          WHERE l.id = ?
          LIMIT 1
        `,
        [listingId]
      );

      const updatedListing = updatedRows[0];

      return res.json({
        success: true,
        message: "Marketplace listing published successfully",
        data: {
          id: Number(updatedListing.id),
          vesselId: Number(updatedListing.vessel_id),
          vesselCode: updatedListing.vessel_code,
          vesselName: updatedListing.vessel_name,
          vesselType: updatedListing.vessel_type,
          title: updatedListing.title,
          description: updatedListing.description,
          charterType: updatedListing.charter_type,
          cargoType: updatedListing.cargo_type,
          availabilityStatus: updatedListing.availability_status,
          availableFrom: updatedListing.available_from,
          availableUntil: updatedListing.available_until,
          minimumCharterDays: updatedListing.minimum_charter_days,
          maximumCharterDays: updatedListing.maximum_charter_days,
          indicativeRate: updatedListing.indicative_rate === null
            ? null
            : Number(updatedListing.indicative_rate),
          rateUnit: updatedListing.rate_unit,
          currencyCode: updatedListing.currency_code,
          verificationStatus: updatedListing.verification_status,
          listingStatus: updatedListing.listing_status,
          createdAt: updatedListing.created_at,
          updatedAt: updatedListing.updated_at
        }
      });

    } catch(error){
      logger.error(
        { err: error },
        "Marketplace listing publication API error"
      );

      return res.status(500).json({
        success: false,
        error: "Unable to publish marketplace listing"
      });
    }
  }
);


  /*
   * PATCH /api/marketplace/listings/:id/suspend
   *
   * Suspends a verified published marketplace listing.
   * Suspension does not change verification or availability status.
   */
  router.patch(
    "/listings/:id/suspend",
    requireRole("super_admin", "admin"),
    async (req, res) => {
      try {
        const listingId = Number(req.params.id);

        if(!Number.isInteger(listingId) || listingId <= 0){
          return res.status(400).json({
            success: false,
            error: "Invalid marketplace listing ID"
          });
        }

        const [rows] = await pool.query(
          `
            SELECT
              l.id,
              l.vessel_id,
              l.listed_by_user_id,
              l.title,
              l.verification_status,
              l.listing_status,
              v.vessel_code,
              v.name AS vessel_name
            FROM vessel_marketplace_listings l
            INNER JOIN vessels v
              ON v.id = l.vessel_id
            WHERE l.id = ?
            LIMIT 1
          `,
          [listingId]
        );

        if(rows.length === 0){
          return res.status(404).json({
            success: false,
            error: "Marketplace listing not found"
          });
        }

        const listing = rows[0];

        if(listing.verification_status !== "verified"){
          return res.status(409).json({
            success: false,
            error: "Only verified marketplace listings can be suspended"
          });
        }

        if(listing.listing_status !== "published"){
          return res.status(409).json({
            success: false,
            error: `Marketplace listing is ${listing.listing_status}, not published`
          });
        }

        const [updateResult] = await pool.query(
          `
            UPDATE vessel_marketplace_listings
            SET listing_status = 'suspended'
            WHERE id = ?
              AND verification_status = 'verified'
              AND listing_status = 'published'
            LIMIT 1
          `,
          [listingId]
        );

        if(updateResult.affectedRows !== 1){
          return res.status(409).json({
            success: false,
            error: "Marketplace listing state changed before suspension completed"
          });
        }

        await pool.query(
          `
            INSERT INTO audit_logs
              (user_id, action, entity_type, entity_id, details, ip_address)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            req.session.user.id,
            "suspend_marketplace_listing",
            "marketplace_listing",
            listingId,
            JSON.stringify({
              listingId,
              vesselId: Number(listing.vessel_id),
              vesselCode: listing.vessel_code,
              vesselName: listing.vessel_name,
              title: listing.title,
              before: {
                verificationStatus: listing.verification_status,
                listingStatus: listing.listing_status
              },
              after: {
                verificationStatus: listing.verification_status,
                listingStatus: "suspended"
              }
            }),
            req.ip || null
          ]
        );

        const [updatedRows] = await pool.query(
          `
            SELECT
              l.id,
              l.vessel_id,
              v.vessel_code,
              v.name AS vessel_name,
              v.vessel_type,
              l.title,
              l.description,
              l.charter_type,
              l.cargo_type,
              l.availability_status,
              DATE_FORMAT(l.available_from, '%Y-%m-%d') AS available_from,
              DATE_FORMAT(l.available_until, '%Y-%m-%d') AS available_until,
              l.minimum_charter_days,
              l.maximum_charter_days,
              l.indicative_rate,
              l.rate_unit,
              l.currency_code,
              l.verification_status,
              l.listing_status,
              l.created_at,
              l.updated_at
            FROM vessel_marketplace_listings l
            INNER JOIN vessels v
              ON v.id = l.vessel_id
            WHERE l.id = ?
            LIMIT 1
          `,
          [listingId]
        );

        const updatedListing = updatedRows[0];

        return res.json({
          success: true,
          message: "Marketplace listing suspended successfully",
          data: {
            id: Number(updatedListing.id),
            vesselId: Number(updatedListing.vessel_id),
            vesselCode: updatedListing.vessel_code,
            vesselName: updatedListing.vessel_name,
            vesselType: updatedListing.vessel_type,
            title: updatedListing.title,
            description: updatedListing.description,
            charterType: updatedListing.charter_type,
            cargoType: updatedListing.cargo_type,
            availabilityStatus: updatedListing.availability_status,
            availableFrom: updatedListing.available_from,
            availableUntil: updatedListing.available_until,
            minimumCharterDays: updatedListing.minimum_charter_days,
            maximumCharterDays: updatedListing.maximum_charter_days,
            indicativeRate: updatedListing.indicative_rate === null
              ? null
              : Number(updatedListing.indicative_rate),
            rateUnit: updatedListing.rate_unit,
            currencyCode: updatedListing.currency_code,
            verificationStatus: updatedListing.verification_status,
            listingStatus: updatedListing.listing_status,
            createdAt: updatedListing.created_at,
            updatedAt: updatedListing.updated_at
          }
        });

      } catch(error){
        logger.error(
          { err: error },
          "Marketplace listing suspension API error"
        );

        return res.status(500).json({
          success: false,
          error: "Unable to suspend marketplace listing"
        });
      }
    }
  );


  /*
   * PATCH /api/marketplace/listings/:id/resume
   *
   * Resumes a verified suspended marketplace listing.
   * Resumption does not change verification or availability status.
   */
  router.patch(
    "/listings/:id/resume",
    requireRole("super_admin", "admin"),
    async (req, res) => {
      try {
        const listingId = Number(req.params.id);

        if(!Number.isInteger(listingId) || listingId <= 0){
          return res.status(400).json({
            success: false,
            error: "Invalid marketplace listing ID"
          });
        }

        const [rows] = await pool.query(
          `
            SELECT
              l.id,
              l.vessel_id,
              l.listed_by_user_id,
              l.title,
              l.verification_status,
              l.listing_status,
              v.vessel_code,
              v.name AS vessel_name
            FROM vessel_marketplace_listings l
            INNER JOIN vessels v
              ON v.id = l.vessel_id
            WHERE l.id = ?
            LIMIT 1
          `,
          [listingId]
        );

        if(rows.length === 0){
          return res.status(404).json({
            success: false,
            error: "Marketplace listing not found"
          });
        }

        const listing = rows[0];

        if(listing.verification_status !== "verified"){
          return res.status(409).json({
            success: false,
            error: "Only verified marketplace listings can be resumed"
          });
        }

        if(listing.listing_status !== "suspended"){
          return res.status(409).json({
            success: false,
            error: `Marketplace listing is ${listing.listing_status}, not suspended`
          });
        }

        const [updateResult] = await pool.query(
          `
            UPDATE vessel_marketplace_listings
            SET listing_status = 'published'
            WHERE id = ?
              AND verification_status = 'verified'
              AND listing_status = 'suspended'
            LIMIT 1
          `,
          [listingId]
        );

        if(updateResult.affectedRows !== 1){
          return res.status(409).json({
            success: false,
            error: "Marketplace listing state changed before resumption completed"
          });
        }

        await pool.query(
          `
            INSERT INTO audit_logs
              (user_id, action, entity_type, entity_id, details, ip_address)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            req.session.user.id,
            "resume_marketplace_listing",
            "marketplace_listing",
            listingId,
            JSON.stringify({
              listingId,
              vesselId: Number(listing.vessel_id),
              vesselCode: listing.vessel_code,
              vesselName: listing.vessel_name,
              title: listing.title,
              before: {
                verificationStatus: listing.verification_status,
                listingStatus: listing.listing_status
              },
              after: {
                verificationStatus: listing.verification_status,
                listingStatus: "published"
              }
            }),
            req.ip || null
          ]
        );

        const [updatedRows] = await pool.query(
          `
            SELECT
              l.id,
              l.vessel_id,
              v.vessel_code,
              v.name AS vessel_name,
              v.vessel_type,
              l.title,
              l.description,
              l.charter_type,
              l.cargo_type,
              l.availability_status,
              DATE_FORMAT(l.available_from, '%Y-%m-%d') AS available_from,
              DATE_FORMAT(l.available_until, '%Y-%m-%d') AS available_until,
              l.minimum_charter_days,
              l.maximum_charter_days,
              l.indicative_rate,
              l.rate_unit,
              l.currency_code,
              l.verification_status,
              l.listing_status,
              l.created_at,
              l.updated_at
            FROM vessel_marketplace_listings l
            INNER JOIN vessels v
              ON v.id = l.vessel_id
            WHERE l.id = ?
            LIMIT 1
          `,
          [listingId]
        );

        const updatedListing = updatedRows[0];

        return res.json({
          success: true,
          message: "Marketplace listing resumed successfully",
          data: {
            id: Number(updatedListing.id),
            vesselId: Number(updatedListing.vessel_id),
            vesselCode: updatedListing.vessel_code,
            vesselName: updatedListing.vessel_name,
            vesselType: updatedListing.vessel_type,
            title: updatedListing.title,
            description: updatedListing.description,
            charterType: updatedListing.charter_type,
            cargoType: updatedListing.cargo_type,
            availabilityStatus: updatedListing.availability_status,
            availableFrom: updatedListing.available_from,
            availableUntil: updatedListing.available_until,
            minimumCharterDays: updatedListing.minimum_charter_days,
            maximumCharterDays: updatedListing.maximum_charter_days,
            indicativeRate: updatedListing.indicative_rate === null
              ? null
              : Number(updatedListing.indicative_rate),
            rateUnit: updatedListing.rate_unit,
            currencyCode: updatedListing.currency_code,
            verificationStatus: updatedListing.verification_status,
            listingStatus: updatedListing.listing_status,
            createdAt: updatedListing.created_at,
            updatedAt: updatedListing.updated_at
          }
        });

      } catch(error){
        logger.error(
          { err: error },
          "Marketplace listing resumption API error"
        );

        return res.status(500).json({
          success: false,
          error: "Unable to resume marketplace listing"
        });
      }
    }
  );


module.exports = router;
