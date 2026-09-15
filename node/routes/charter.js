const express = require("express");
const pool = require("../db");
const logger = require("../lib/logger");

const router = express.Router();

const validDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value);


/*
 * GET /api/charter/enquiries
 *
 * List charter enquiries belonging to the logged-in user.
 */
router.get("/enquiries", async (req, res) => {
  try {
    const status = req.query.status == null
      ? null
      : String(req.query.status).trim() || null;

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);

    const validStatuses = [
      "submitted",
      "under_review",
      "offer_made",
      "negotiating",
      "accepted",
      "rejected",
      "withdrawn",
      "closed"
    ];

    if (status !== null && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid enquiry status"
      });
    }

    if (!Number.isInteger(page) || page <= 0) {
      return res.status(400).json({
        success: false,
        error: "page must be a positive integer"
      });
    }

    if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: "limit must be between 1 and 100"
      });
    }

    const offset = (page - 1) * limit;
    const params = [req.session.user.id];
    let where = "WHERE e.requester_user_id = ?";

    if (status !== null) {
      where += " AND e.status = ?";
      params.push(status);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM charter_enquiries e ${where}`,
      params
    );

    const [rows] = await pool.query(
      `
        SELECT
          e.id,
          e.listing_id,
          e.requester_user_id,
          e.cargo_type,
          e.cargo_quantity_tons,
          e.origin_port_id,
          e.destination_port_id,
          DATE_FORMAT(e.requested_start_date, '%Y-%m-%d')
            AS requested_start_date,
          DATE_FORMAT(e.requested_end_date, '%Y-%m-%d')
            AS requested_end_date,
          e.message,
          e.status,
          e.created_at,
          e.updated_at,
          l.title AS listing_title,
          l.charter_type,
          v.vessel_code,
          v.name AS vessel_name
        FROM charter_enquiries e
        INNER JOIN vessel_marketplace_listings l
          ON l.id = e.listing_id
        INNER JOIN vessels v
          ON v.id = l.vessel_id
        ${where}
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const total = Number(countRows[0].total);

    return res.json({
      success: true,
      data: rows.map((enquiry) => ({
        id: Number(enquiry.id),
        listingId: Number(enquiry.listing_id),
        requesterUserId: Number(enquiry.requester_user_id),
        cargoType: enquiry.cargo_type,
        cargoQuantityTons: enquiry.cargo_quantity_tons === null
          ? null
          : Number(enquiry.cargo_quantity_tons),
        originPortId: enquiry.origin_port_id === null
          ? null
          : Number(enquiry.origin_port_id),
        destinationPortId: enquiry.destination_port_id === null
          ? null
          : Number(enquiry.destination_port_id),
        requestedStartDate: enquiry.requested_start_date,
        requestedEndDate: enquiry.requested_end_date,
        message: enquiry.message,
        status: enquiry.status,
        listingTitle: enquiry.listing_title,
        charterType: enquiry.charter_type,
        vesselCode: enquiry.vessel_code,
        vesselName: enquiry.vessel_name,
        createdAt: enquiry.created_at,
        updatedAt: enquiry.updated_at
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error(
      { err: error },
      "Charter enquiry listing API error"
    );

    return res.status(500).json({
      success: false,
      error: "Unable to retrieve charter enquiries"
    });
  }
});

/*
 * GET /api/charter/enquiries/:id
 *
 * Retrieve a charter enquiry when the logged-in user is either
 * the enquiry requester or the marketplace listing owner.
 */
router.get("/enquiries/:id", async (req, res) => {
  try {
    const enquiryId = Number(req.params.id);

    if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
      return res.status(400).json({
        success: false,
        error: "enquiryId must be a positive integer"
      });
    }

    const [rows] = await pool.query(
      `
        SELECT
          e.id,
          e.listing_id,
          e.requester_user_id,
          e.cargo_type,
          e.cargo_quantity_tons,
          e.origin_port_id,
          e.destination_port_id,
          DATE_FORMAT(e.requested_start_date, '%Y-%m-%d')
            AS requested_start_date,
          DATE_FORMAT(e.requested_end_date, '%Y-%m-%d')
            AS requested_end_date,
          e.message,
          e.status,
          e.created_at,
          e.updated_at,
          l.title AS listing_title,
          l.charter_type,
          l.listed_by_user_id,
          v.vessel_code,
          v.name AS vessel_name
        FROM charter_enquiries e
        INNER JOIN vessel_marketplace_listings l
          ON l.id = e.listing_id
        INNER JOIN vessels v
          ON v.id = l.vessel_id
        WHERE e.id = ?
          AND (
            e.requester_user_id = ?
            OR l.listed_by_user_id = ?
          )
        LIMIT 1
      `,
      [enquiryId, req.session.user.id, req.session.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Charter enquiry not found"
      });
    }

    const enquiry = rows[0];

    return res.json({
      success: true,
      data: {
        id: Number(enquiry.id),
        listingId: Number(enquiry.listing_id),
        requesterUserId: Number(enquiry.requester_user_id),
        cargoType: enquiry.cargo_type,
        cargoQuantityTons: enquiry.cargo_quantity_tons === null
          ? null
          : Number(enquiry.cargo_quantity_tons),
        originPortId: enquiry.origin_port_id === null
          ? null
          : Number(enquiry.origin_port_id),
        destinationPortId: enquiry.destination_port_id === null
          ? null
          : Number(enquiry.destination_port_id),
        requestedStartDate: enquiry.requested_start_date,
        requestedEndDate: enquiry.requested_end_date,
        message: enquiry.message,
        status: enquiry.status,
        listingTitle: enquiry.listing_title,
        charterType: enquiry.charter_type,
        vesselCode: enquiry.vessel_code,
        vesselName: enquiry.vessel_name,
        createdAt: enquiry.created_at,
        updatedAt: enquiry.updated_at
      }
    });
  } catch (error) {
    logger.error(
      { err: error },
      "Charter enquiry detail API error"
    );

    return res.status(500).json({
      success: false,
      error: "Unable to retrieve charter enquiry"
    });
  }
});

router.post("/enquiries", async (req, res) => {
  try {
    const body = req.body || {};

    const listingId = Number(body.listingId);

    const cargoType = body.cargoType == null
      ? null
      : String(body.cargoType).trim() || null;

    const cargoQuantityTons = body.cargoQuantityTons == null ||
      body.cargoQuantityTons === ""
      ? null
      : Number(body.cargoQuantityTons);

    const originPortId = body.originPortId == null ||
      body.originPortId === ""
      ? null
      : Number(body.originPortId);

    const destinationPortId = body.destinationPortId == null ||
      body.destinationPortId === ""
      ? null
      : Number(body.destinationPortId);

    const requestedStartDate = body.requestedStartDate == null
      ? null
      : String(body.requestedStartDate).trim() || null;

    const requestedEndDate = body.requestedEndDate == null
      ? null
      : String(body.requestedEndDate).trim() || null;

    const message = body.message == null
      ? null
      : String(body.message).trim() || null;

    if (!Number.isInteger(listingId) || listingId <= 0) {
      return res.status(400).json({
        success: false,
        error: "listingId must be a positive integer"
      });
    }

    if (
      cargoQuantityTons !== null &&
      (!Number.isFinite(cargoQuantityTons) || cargoQuantityTons <= 0)
    ) {
      return res.status(400).json({
        success: false,
        error: "cargoQuantityTons must be a positive number"
      });
    }

    if (
      originPortId !== null &&
      (!Number.isInteger(originPortId) || originPortId <= 0)
    ) {
      return res.status(400).json({
        success: false,
        error: "originPortId must be a positive integer"
      });
    }

    if (
      destinationPortId !== null &&
      (!Number.isInteger(destinationPortId) || destinationPortId <= 0)
    ) {
      return res.status(400).json({
        success: false,
        error: "destinationPortId must be a positive integer"
      });
    }

    if (
      requestedStartDate !== null &&
      !validDate(requestedStartDate)
    ) {
      return res.status(400).json({
        success: false,
        error: "requestedStartDate must use YYYY-MM-DD format"
      });
    }

    if (
      requestedEndDate !== null &&
      !validDate(requestedEndDate)
    ) {
      return res.status(400).json({
        success: false,
        error: "requestedEndDate must use YYYY-MM-DD format"
      });
    }

    if (
      requestedStartDate !== null &&
      requestedEndDate !== null &&
      requestedStartDate > requestedEndDate
    ) {
      return res.status(400).json({
        success: false,
        error: "requestedStartDate cannot be after requestedEndDate"
      });
    }

    const [listingRows] = await pool.query(
      `
        SELECT
          id,
          listed_by_user_id,
          listing_status,
          verification_status,
          availability_status
        FROM vessel_marketplace_listings
        WHERE id = ?
        LIMIT 1
      `,
      [listingId]
    );

    if (listingRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Marketplace listing not found"
      });
    }

    const listing = listingRows[0];

    if (
      listing.listing_status !== "published" ||
      listing.verification_status !== "verified" ||
      listing.availability_status !== "available"
    ) {
      return res.status(400).json({
        success: false,
        error: "Marketplace listing is not available for enquiry"
      });
    }

    if (originPortId !== null) {
      const [originRows] = await pool.query(
        "SELECT id FROM ports WHERE id = ? LIMIT 1",
        [originPortId]
      );

      if (originRows.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Origin port not found"
        });
      }
    }

    if (destinationPortId !== null) {
      const [destinationRows] = await pool.query(
        "SELECT id FROM ports WHERE id = ? LIMIT 1",
        [destinationPortId]
      );

      if (destinationRows.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Destination port not found"
        });
      }
    }

    const [result] = await pool.query(
      `
        INSERT INTO charter_enquiries (
          listing_id,
          requester_user_id,
          cargo_type,
          cargo_quantity_tons,
          origin_port_id,
          destination_port_id,
          requested_start_date,
          requested_end_date,
          message
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        listingId,
        req.session.user.id,
        cargoType,
        cargoQuantityTons,
        originPortId,
        destinationPortId,
        requestedStartDate,
        requestedEndDate,
        message
      ]
    );

    const [rows] = await pool.query(
      `
        SELECT
          e.id,
          e.listing_id,
          e.requester_user_id,
          e.cargo_type,
          e.cargo_quantity_tons,
          e.origin_port_id,
          e.destination_port_id,
          DATE_FORMAT(e.requested_start_date, '%Y-%m-%d')
            AS requested_start_date,
          DATE_FORMAT(e.requested_end_date, '%Y-%m-%d')
            AS requested_end_date,
          e.message,
          e.status,
          e.created_at,
          e.updated_at
        FROM charter_enquiries e
        WHERE e.id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    const enquiry = rows[0];

    return res.status(201).json({
      success: true,
      data: {
        id: Number(enquiry.id),
        listingId: Number(enquiry.listing_id),
        requesterUserId: Number(enquiry.requester_user_id),
        cargoType: enquiry.cargo_type,
        cargoQuantityTons: enquiry.cargo_quantity_tons === null
          ? null
          : Number(enquiry.cargo_quantity_tons),
        originPortId: enquiry.origin_port_id === null
          ? null
          : Number(enquiry.origin_port_id),
        destinationPortId: enquiry.destination_port_id === null
          ? null
          : Number(enquiry.destination_port_id),
        requestedStartDate: enquiry.requested_start_date,
        requestedEndDate: enquiry.requested_end_date,
        message: enquiry.message,
        status: enquiry.status,
        createdAt: enquiry.created_at,
        updatedAt: enquiry.updated_at
      },
      message: "Charter enquiry submitted successfully"
    });
  } catch (error) {
    logger.error(
      { err: error },
      "Charter enquiry creation API error"
    );

    return res.status(500).json({
      success: false,
      error: "Unable to submit charter enquiry"
    });
  }
});


/*
 * POST /api/charter/enquiries/:id/offers
 *
 * Create the initial charter offer for an enquiry.
 * Only the marketplace listing owner may make the initial offer.
 */
router.post("/enquiries/:id/offers", async (req, res) => {
  try {
    const enquiryId = Number(req.params.id);

    if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
      return res.status(400).json({
        success: false,
        error: "enquiry id must be a positive integer"
      });
    }

    const amount = req.body.amount == null
      ? null
      : Number(req.body.amount);

    const currencyCode = req.body.currencyCode == null
      ? "USD"
      : String(req.body.currencyCode).trim().toUpperCase();

    const rateUnit = req.body.rateUnit == null
      ? null
      : String(req.body.rateUnit).trim();

    const charterDays = req.body.charterDays == null
      ? null
      : Number(req.body.charterDays);

    const terms = req.body.terms == null
      ? null
      : String(req.body.terms).trim();

    const expiresAt = req.body.expiresAt == null
      ? null
      : String(req.body.expiresAt).trim();

    if (
      amount !== null &&
      (!Number.isFinite(amount) || amount <= 0)
    ) {
      return res.status(400).json({
        success: false,
        error: "amount must be a positive number"
      });
    }

    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      return res.status(400).json({
        success: false,
        error: "currencyCode must be a 3-letter currency code"
      });
    }

    const validRateUnits = [
      "per_day",
      "per_voyage",
      "per_metric_ton",
      "lump_sum"
    ];

    if (rateUnit !== null && !validRateUnits.includes(rateUnit)) {
      return res.status(400).json({
        success: false,
        error: "Invalid rateUnit"
      });
    }

    if (
      charterDays !== null &&
      (!Number.isInteger(charterDays) || charterDays <= 0)
    ) {
      return res.status(400).json({
        success: false,
        error: "charterDays must be a positive integer"
      });
    }

    if (expiresAt !== null) {
      const expiryDate = new Date(expiresAt);

      if (
        !expiresAt ||
        Number.isNaN(expiryDate.getTime()) ||
        expiryDate.getTime() <= Date.now()
      ) {
        return res.status(400).json({
          success: false,
          error: "expiresAt must be a valid future datetime"
        });
      }
    }

    const [enquiryRows] = await pool.query(
      `
        SELECT
          e.id,
          e.requester_user_id,
          e.status,
          l.listed_by_user_id
        FROM charter_enquiries e
        INNER JOIN vessel_marketplace_listings l
          ON l.id = e.listing_id
        WHERE e.id = ?
        LIMIT 1
      `,
      [enquiryId]
    );

    const enquiry = enquiryRows[0];

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        error: "Charter enquiry not found"
      });
    }

    if (
      Number(enquiry.listed_by_user_id) !==
      Number(req.session.user.id)
    ) {
      return res.status(403).json({
        success: false,
        error: "Only the listing owner can make the initial offer"
      });
    }

    const closedStatuses = [
      "accepted",
      "rejected",
      "withdrawn",
      "closed"
    ];

    if (closedStatuses.includes(enquiry.status)) {
      return res.status(409).json({
        success: false,
        error: "This charter enquiry is no longer available for an offer"
      });
    }

    if (enquiry.status === "offer_made") {
      return res.status(409).json({
        success: false,
        error: "An initial offer has already been made for this enquiry"
      });
    }

    const [result] = await pool.query(
      `
        INSERT INTO charter_offers (
          enquiry_id,
          offered_by_user_id,
          parent_offer_id,
          amount,
          currency_code,
          rate_unit,
          charter_days,
          terms,
          status,
          expires_at
        )
        VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'pending', ?)
      `,
      [
        enquiryId,
        req.session.user.id,
        amount,
        currencyCode,
        rateUnit,
        charterDays,
        terms,
        expiresAt
      ]
    );

    await pool.query(
      `
        UPDATE charter_enquiries
        SET status = 'offer_made'
        WHERE id = ?
      `,
      [enquiryId]
    );

    const [rows] = await pool.query(
      `
        SELECT
          id,
          enquiry_id,
          offered_by_user_id,
          parent_offer_id,
          amount,
          currency_code,
          rate_unit,
          charter_days,
          terms,
          status,
          expires_at,
          created_at,
          updated_at
        FROM charter_offers
        WHERE id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    const offer = rows[0];

    return res.status(201).json({
      success: true,
      data: {
        id: Number(offer.id),
        enquiryId: Number(offer.enquiry_id),
        offeredByUserId: Number(offer.offered_by_user_id),
        parentOfferId: offer.parent_offer_id === null
          ? null
          : Number(offer.parent_offer_id),
        amount: offer.amount === null
          ? null
          : Number(offer.amount),
        currencyCode: offer.currency_code,
        rateUnit: offer.rate_unit,
        charterDays: offer.charter_days === null
          ? null
          : Number(offer.charter_days),
        terms: offer.terms,
        status: offer.status,
        expiresAt: offer.expires_at,
        createdAt: offer.created_at,
        updatedAt: offer.updated_at
      },
      message: "Charter offer created successfully"
    });
  } catch (error) {
    logger.error(
      { err: error },
      "Charter offer creation API error"
    );

    return res.status(500).json({
      success: false,
      error: "Unable to create charter offer"
    });
  }
});

module.exports = router;
