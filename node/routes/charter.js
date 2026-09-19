const express = require("express");
const pool = require("../db");
const logger = require("../lib/logger");

const router = express.Router();

const parseDateParts = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const validDate = (value) =>
  parseDateParts(value) !== null;

const inclusiveDateDifference = (startDate, endDate) => {
  const start = parseDateParts(startDate);
  const end = parseDateParts(endDate);

  if (!start || !end) {
    return null;
  }

  return Math.floor(
    (end.getTime() - start.getTime()) /
      (24 * 60 * 60 * 1000)
  ) + 1;
};

const normalizeOfferPayload = (body = {}) => {
  const amount = body.amount == null || body.amount === ""
    ? null
    : Number(body.amount);

  const currencyCode = body.currencyCode == null ||
    String(body.currencyCode).trim() === ""
    ? "USD"
    : String(body.currencyCode).trim().toUpperCase();

  const rateUnit = body.rateUnit == null ||
    String(body.rateUnit).trim() === ""
    ? null
    : String(body.rateUnit).trim();

  const charterDays = body.charterDays == null ||
    body.charterDays === ""
    ? null
    : Number(body.charterDays);

  const terms = body.terms == null
    ? null
    : String(body.terms).trim() || null;

  const expiresAt = body.expiresAt == null
    ? null
    : String(body.expiresAt).trim() || null;

  if (
    amount !== null &&
    (!Number.isFinite(amount) || amount <= 0)
  ) {
    return {
      error: "amount must be a positive number"
    };
  }

  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    return {
      error: "currencyCode must be a 3-letter currency code"
    };
  }

  const validRateUnits = [
    "per_day",
    "per_voyage",
    "per_metric_ton",
    "lump_sum"
  ];

  if (
    rateUnit !== null &&
    !validRateUnits.includes(rateUnit)
  ) {
    return {
      error: "Invalid rateUnit"
    };
  }

  if (
    charterDays !== null &&
    (!Number.isInteger(charterDays) || charterDays <= 0)
  ) {
    return {
      error: "charterDays must be a positive integer"
    };
  }

  if (expiresAt !== null) {
    const expiryDate = new Date(expiresAt);

    if (
      Number.isNaN(expiryDate.getTime()) ||
      expiryDate.getTime() <= Date.now()
    ) {
      return {
        error: "expiresAt must be a valid future datetime"
      };
    }
  }

  return {
    value: {
      amount,
      currencyCode,
      rateUnit,
      charterDays,
      terms,
      expiresAt
    }
  };
};


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
 * GET /api/charter/incoming-enquiries
 *
 * List charter enquiries submitted against marketplace listings
 * owned by the logged-in user.
 */
router.get("/incoming-enquiries", async (req, res) => {
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

    let where = "WHERE l.listed_by_user_id = ?";

    if (status !== null) {
      where += " AND e.status = ?";
      params.push(status);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM charter_enquiries e
       INNER JOIN vessel_marketplace_listings l
         ON l.id = e.listing_id
       ${where}`,
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
      "Incoming charter enquiry listing API error"
    );

    return res.status(500).json({
      success: false,
      error: "Unable to retrieve incoming charter enquiries"
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
          availability_status,
          DATE_FORMAT(available_from, '%Y-%m-%d')
            AS available_from,
          DATE_FORMAT(available_until, '%Y-%m-%d')
            AS available_until,
          minimum_charter_days,
          maximum_charter_days
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

    if (
      requestedStartDate !== null &&
      listing.available_from !== null &&
      requestedStartDate < listing.available_from
    ) {
      return res.status(400).json({
        success: false,
        error: "requestedStartDate cannot be before the listing availability date"
      });
    }

    if (
      requestedEndDate !== null &&
      listing.available_until !== null &&
      requestedEndDate > listing.available_until
    ) {
      return res.status(400).json({
        success: false,
        error: "requestedEndDate cannot be after the listing availability date"
      });
    }

    if (
      requestedStartDate !== null &&
      requestedEndDate !== null
    ) {
      const charterDays = inclusiveDateDifference(
        requestedStartDate,
        requestedEndDate
      );

      if (
        listing.minimum_charter_days !== null &&
        charterDays < Number(listing.minimum_charter_days)
      ) {
        return res.status(400).json({
          success: false,
          error: `Requested charter duration must be at least ${Number(
            listing.minimum_charter_days
          )} day(s)`
        });
      }

      if (
        listing.maximum_charter_days !== null &&
        charterDays > Number(listing.maximum_charter_days)
      ) {
        return res.status(400).json({
          success: false,
          error: `Requested charter duration cannot exceed ${Number(
            listing.maximum_charter_days
          )} day(s)`
        });
      }
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
 * PATCH /api/charter/enquiries/:id
 *
 * Edit a charter enquiry before an offer has been made.
 * Only the original requester may edit the enquiry.
 */
router.patch("/enquiries/:id", async (req, res) => {
  try {
    const enquiryId = Number(req.params.id);

    if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
      return res.status(400).json({
        success: false,
        error: "enquiry id must be a positive integer"
      });
    }

    const [enquiryRows] = await pool.query(
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
          e.status
        FROM charter_enquiries e
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
      Number(enquiry.requester_user_id) !==
      Number(req.session.user.id)
    ) {
      return res.status(403).json({
        success: false,
        error: "Only the enquiry requester can edit this enquiry"
      });
    }

    if (
      enquiry.status !== "submitted" &&
      enquiry.status !== "under_review"
    ) {
      return res.status(409).json({
        success: false,
        error: "This charter enquiry can no longer be edited"
      });
    }

    const body = req.body || {};

    const cargoType = body.cargoType === undefined
      ? enquiry.cargo_type
      : body.cargoType == null
        ? null
        : String(body.cargoType).trim() || null;

    const cargoQuantityTons = body.cargoQuantityTons === undefined
      ? enquiry.cargo_quantity_tons === null
        ? null
        : Number(enquiry.cargo_quantity_tons)
      : body.cargoQuantityTons == null ||
        body.cargoQuantityTons === ""
        ? null
        : Number(body.cargoQuantityTons);

    const originPortId = body.originPortId === undefined
      ? enquiry.origin_port_id === null
        ? null
        : Number(enquiry.origin_port_id)
      : body.originPortId == null ||
        body.originPortId === ""
        ? null
        : Number(body.originPortId);

    const destinationPortId =
      body.destinationPortId === undefined
        ? enquiry.destination_port_id === null
          ? null
          : Number(enquiry.destination_port_id)
        : body.destinationPortId == null ||
          body.destinationPortId === ""
          ? null
          : Number(body.destinationPortId);

    const requestedStartDate =
      body.requestedStartDate === undefined
        ? enquiry.requested_start_date
        : body.requestedStartDate == null
          ? null
          : String(body.requestedStartDate).trim() || null;

    const requestedEndDate =
      body.requestedEndDate === undefined
        ? enquiry.requested_end_date
        : body.requestedEndDate == null
          ? null
          : String(body.requestedEndDate).trim() || null;

    const message = body.message === undefined
      ? enquiry.message
      : body.message == null
        ? null
        : String(body.message).trim() || null;

    if (
      cargoQuantityTons !== null &&
      (!Number.isFinite(cargoQuantityTons) ||
        cargoQuantityTons <= 0)
    ) {
      return res.status(400).json({
        success: false,
        error: "cargoQuantityTons must be a positive number"
      });
    }

    if (
      originPortId !== null &&
      (!Number.isInteger(originPortId) ||
        originPortId <= 0)
    ) {
      return res.status(400).json({
        success: false,
        error: "originPortId must be a positive integer"
      });
    }

    if (
      destinationPortId !== null &&
      (!Number.isInteger(destinationPortId) ||
        destinationPortId <= 0)
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
          listing_status,
          verification_status,
          availability_status,
          DATE_FORMAT(available_from, '%Y-%m-%d')
            AS available_from,
          DATE_FORMAT(available_until, '%Y-%m-%d')
            AS available_until,
          minimum_charter_days,
          maximum_charter_days
        FROM vessel_marketplace_listings
        WHERE id = ?
        LIMIT 1
      `,
      [enquiry.listing_id]
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

    if (
      requestedStartDate !== null &&
      listing.available_from !== null &&
      requestedStartDate < listing.available_from
    ) {
      return res.status(400).json({
        success: false,
        error: "requestedStartDate cannot be before the listing availability date"
      });
    }

    if (
      requestedEndDate !== null &&
      listing.available_until !== null &&
      requestedEndDate > listing.available_until
    ) {
      return res.status(400).json({
        success: false,
        error: "requestedEndDate cannot be after the listing availability date"
      });
    }

    if (
      requestedStartDate !== null &&
      requestedEndDate !== null
    ) {
      const charterDays = inclusiveDateDifference(
        requestedStartDate,
        requestedEndDate
      );

      if (
        listing.minimum_charter_days !== null &&
        charterDays < Number(listing.minimum_charter_days)
      ) {
        return res.status(400).json({
          success: false,
          error: `Requested charter duration must be at least ${Number(
            listing.minimum_charter_days
          )} day(s)`
        });
      }

      if (
        listing.maximum_charter_days !== null &&
        charterDays > Number(listing.maximum_charter_days)
      ) {
        return res.status(400).json({
          success: false,
          error: `Requested charter duration cannot exceed ${Number(
            listing.maximum_charter_days
          )} day(s)`
        });
      }
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

    await pool.query(
      `
        UPDATE charter_enquiries
        SET
          cargo_type = ?,
          cargo_quantity_tons = ?,
          origin_port_id = ?,
          destination_port_id = ?,
          requested_start_date = ?,
          requested_end_date = ?,
          message = ?
        WHERE id = ?
      `,
      [
        cargoType,
        cargoQuantityTons,
        originPortId,
        destinationPortId,
        requestedStartDate,
        requestedEndDate,
        message,
        enquiryId
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
      [enquiryId]
    );

    const updatedEnquiry = rows[0];

    return res.json({
      success: true,
      data: {
        id: Number(updatedEnquiry.id),
        listingId: Number(updatedEnquiry.listing_id),
        requesterUserId: Number(updatedEnquiry.requester_user_id),
        cargoType: updatedEnquiry.cargo_type,
        cargoQuantityTons:
          updatedEnquiry.cargo_quantity_tons === null
            ? null
            : Number(updatedEnquiry.cargo_quantity_tons),
        originPortId:
          updatedEnquiry.origin_port_id === null
            ? null
            : Number(updatedEnquiry.origin_port_id),
        destinationPortId:
          updatedEnquiry.destination_port_id === null
            ? null
            : Number(updatedEnquiry.destination_port_id),
        requestedStartDate: updatedEnquiry.requested_start_date,
        requestedEndDate: updatedEnquiry.requested_end_date,
        message: updatedEnquiry.message,
        status: updatedEnquiry.status,
        createdAt: updatedEnquiry.created_at,
        updatedAt: updatedEnquiry.updated_at
      },
      message: "Charter enquiry updated successfully"
    });
  } catch (error) {
    logger.error(
      { err: error },
      "Charter enquiry update API error"
    );

    return res.status(500).json({
      success: false,
      error: "Unable to update charter enquiry"
    });
  }
});


/*
 * POST /api/charter/enquiries/:id/withdraw
 *
 * Withdraw a charter enquiry.
 * Only the original requester may withdraw the enquiry.
 */
router.post("/enquiries/:id/withdraw", async (req, res) => {
  let connection;

  try {
    const enquiryId = Number(req.params.id);

    if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
      return res.status(400).json({
        success: false,
        error: "enquiry id must be a positive integer"
      });
    }

    connection = await pool.getConnection();

    await connection.beginTransaction();

    const [enquiryRows] = await connection.query(
      `
        SELECT
          e.id,
          e.requester_user_id,
          e.status
        FROM charter_enquiries e
        WHERE e.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [enquiryId]
    );

    const enquiry = enquiryRows[0];

    if (!enquiry) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        error: "Charter enquiry not found"
      });
    }

    if (
      Number(enquiry.requester_user_id) !==
      Number(req.session.user.id)
    ) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        error: "Only the enquiry requester can withdraw this enquiry"
      });
    }

    const withdrawableStatuses = [
      "submitted",
      "under_review",
      "offer_made",
      "negotiating"
    ];

    if (!withdrawableStatuses.includes(enquiry.status)) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        error: "This charter enquiry can no longer be withdrawn"
      });
    }

    await connection.query(
      `
        UPDATE charter_offers
        SET status = 'withdrawn'
        WHERE enquiry_id = ?
          AND status = 'pending'
      `,
      [enquiryId]
    );

    await connection.query(
      `
        UPDATE charter_enquiries
        SET status = 'withdrawn'
        WHERE id = ?
      `,
      [enquiryId]
    );

    const [rows] = await connection.query(
      `
        SELECT
          e.id,
          e.listing_id,
          e.requester_user_id,
          e.status,
          e.created_at,
          e.updated_at
        FROM charter_enquiries e
        WHERE e.id = ?
        LIMIT 1
      `,
      [enquiryId]
    );

    const withdrawnEnquiry = rows[0];

    await connection.commit();

    return res.json({
      success: true,
      data: {
        id: Number(withdrawnEnquiry.id),
        listingId: Number(withdrawnEnquiry.listing_id),
        requesterUserId: Number(withdrawnEnquiry.requester_user_id),
        status: withdrawnEnquiry.status,
        createdAt: withdrawnEnquiry.created_at,
        updatedAt: withdrawnEnquiry.updated_at
      },
      message: "Charter enquiry withdrawn successfully"
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logger.error(
          { err: rollbackError },
          "Charter enquiry withdrawal rollback error"
        );
      }
    }

    logger.error(
      { err: error },
      "Charter enquiry withdrawal API error"
    );

    return res.status(500).json({
      success: false,
      error: "Unable to withdraw charter enquiry"
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/*
 * GET /api/charter/enquiries/:id/offers
 *
 * Retrieve the offer history for a charter enquiry.
 * Only the enquiry requester or marketplace listing owner may view it.
 */
router.get("/enquiries/:id/offers", async (req, res) => {
  try {
    const enquiryId = Number(req.params.id);

    if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
      return res.status(400).json({
        success: false,
        error: "enquiry id must be a positive integer"
      });
    }

    const [enquiryRows] = await pool.query(
      `
        SELECT
          e.id
        FROM charter_enquiries e
        INNER JOIN vessel_marketplace_listings l
          ON l.id = e.listing_id
        WHERE e.id = ?
          AND (
            e.requester_user_id = ?
            OR l.listed_by_user_id = ?
          )
        LIMIT 1
      `,
      [
        enquiryId,
        req.session.user.id,
        req.session.user.id
      ]
    );

    if (!enquiryRows[0]) {
      return res.status(404).json({
        success: false,
        error: "Charter enquiry not found"
      });
    }

    const [rows] = await pool.query(
      `
        SELECT
          o.id,
          o.enquiry_id,
          o.offered_by_user_id,
          o.parent_offer_id,
          o.amount,
          o.currency_code,
          o.rate_unit,
          o.charter_days,
          o.terms,
          o.status,
          o.expires_at,
          o.created_at,
          o.updated_at
        FROM charter_offers o
        WHERE o.enquiry_id = ?
        ORDER BY o.created_at ASC, o.id ASC
      `,
      [enquiryId]
    );

    return res.json({
      success: true,
      data: rows.map((offer) => ({
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
      }))
    });
  } catch (error) {
    logger.error(
      { err: error },
      "Charter offer history API error"
    );

    return res.status(500).json({
      success: false,
      error: "Unable to retrieve charter offers"
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

    const initialOfferStatuses = [
      "submitted",
      "under_review"
    ];

    if (!initialOfferStatuses.includes(enquiry.status)) {
      return res.status(409).json({
        success: false,
        error: "An initial offer can only be made while the enquiry is submitted or under review"
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

/*
 * POST /api/charter/offers/:id/accept
 *
 * Accept the latest pending charter offer.
 * Only the opposite party in the negotiation may accept.
 */
router.post("/offers/:id/accept", async (req, res) => {
  let connection;

  try {
    const offerId = Number(req.params.id);

    if (!Number.isInteger(offerId) || offerId <= 0) {
      return res.status(400).json({
        success: false,
        error: "offer id must be a positive integer"
      });
    }

    connection = await pool.getConnection();

    await connection.beginTransaction();

    const [enquiryRows] = await connection.query(
      `
        SELECT
          e.id,
          e.requester_user_id,
          e.status,
          l.listed_by_user_id
        FROM charter_enquiries e
        INNER JOIN vessel_marketplace_listings l
          ON l.id = e.listing_id
        INNER JOIN charter_offers o
          ON o.enquiry_id = e.id
        WHERE o.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [offerId]
    );

    const enquiry = enquiryRows[0];

    if (!enquiry) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        error: "Charter offer not found"
      });
    }

    const userId = Number(req.session.user.id);
    const requesterUserId = Number(enquiry.requester_user_id);
    const listingOwnerUserId = Number(enquiry.listed_by_user_id);

    if (
      userId !== requesterUserId &&
      userId !== listingOwnerUserId
    ) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        error: "You are not authorized to accept this charter offer"
      });
    }

    if (
      enquiry.status !== "offer_made" &&
      enquiry.status !== "negotiating"
    ) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        error: "This charter enquiry is not open for acceptance"
      });
    }

    const [offerRows] = await connection.query(
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
          updated_at,
          CASE
            WHEN expires_at IS NOT NULL
              AND expires_at <= NOW()
            THEN 1
            ELSE 0
          END AS is_expired
        FROM charter_offers
        WHERE id = ?
          AND enquiry_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [offerId, enquiry.id]
    );

    const currentOffer = offerRows[0];

    if (!currentOffer) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        error: "Charter offer not found"
      });
    }

    const [latestOfferRows] = await connection.query(
      `
        SELECT
          id,
          status,
          expires_at
        FROM charter_offers
        WHERE enquiry_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [enquiry.id]
    );

    const latestOffer = latestOfferRows[0];

    if (
      !latestOffer ||
      Number(latestOffer.id) !== Number(currentOffer.id)
    ) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        error: "Only the latest charter offer can be accepted"
      });
    }

    if (currentOffer.status !== "pending") {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        error: "This charter offer is no longer pending"
      });
    }

    if (Number(currentOffer.is_expired) === 1) {
      await connection.query(
        `
          UPDATE charter_offers
          SET status = 'expired'
          WHERE id = ?
            AND status = 'pending'
        `,
        [offerId]
      );

      await connection.commit();

      return res.status(409).json({
        success: false,
        error: "This charter offer has expired"
      });
    }

    if (Number(currentOffer.offered_by_user_id) === userId) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        error: "You cannot accept your own charter offer"
      });
    }

    await connection.query(
      `
        UPDATE charter_offers
        SET status = 'accepted'
        WHERE id = ?
          AND status = 'pending'
      `,
      [offerId]
    );

    await connection.query(
      `
        UPDATE charter_enquiries
        SET status = 'accepted'
        WHERE id = ?
      `,
      [enquiry.id]
    );

    const [rows] = await connection.query(
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
      [offerId]
    );

    const offer = rows[0];

    await connection.commit();

    return res.json({
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
      message: "Charter offer accepted successfully"
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logger.error(
          { err: rollbackError },
          "Charter offer acceptance rollback error"
        );
      }
    }

    logger.error(
      { err: error },
      "Charter offer acceptance API error"
    );

    return res.status(500).json({
      success: false,
      error: "Unable to accept charter offer"
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/*
 * POST /api/charter/offers/:id/reject
 *
 * Reject the latest pending charter offer.
 * Only the opposite party in the negotiation may reject.
 */
router.post("/offers/:id/reject", async (req, res) => {
  let connection;

  try {
    const offerId = Number(req.params.id);

    if (!Number.isInteger(offerId) || offerId <= 0) {
      return res.status(400).json({
        success: false,
        error: "offer id must be a positive integer"
      });
    }

    connection = await pool.getConnection();

    await connection.beginTransaction();

    const [enquiryRows] = await connection.query(
      `
        SELECT
          e.id,
          e.requester_user_id,
          e.status,
          l.listed_by_user_id
        FROM charter_enquiries e
        INNER JOIN vessel_marketplace_listings l
          ON l.id = e.listing_id
        INNER JOIN charter_offers o
          ON o.enquiry_id = e.id
        WHERE o.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [offerId]
    );

    const enquiry = enquiryRows[0];

    if (!enquiry) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        error: "Charter offer not found"
      });
    }

    const userId = Number(req.session.user.id);
    const requesterUserId = Number(enquiry.requester_user_id);
    const listingOwnerUserId = Number(enquiry.listed_by_user_id);

    if (
      userId !== requesterUserId &&
      userId !== listingOwnerUserId
    ) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        error: "You are not authorized to reject this charter offer"
      });
    }

    if (
      enquiry.status !== "offer_made" &&
      enquiry.status !== "negotiating"
    ) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        error: "This charter enquiry is not open for rejection"
      });
    }

    const [offerRows] = await connection.query(
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
          updated_at,
          CASE
            WHEN expires_at IS NOT NULL
              AND expires_at <= NOW()
            THEN 1
            ELSE 0
          END AS is_expired
        FROM charter_offers
        WHERE id = ?
          AND enquiry_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [offerId, enquiry.id]
    );

    const currentOffer = offerRows[0];

    if (!currentOffer) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        error: "Charter offer not found"
      });
    }

    const [latestOfferRows] = await connection.query(
      `
        SELECT
          id,
          status,
          expires_at
        FROM charter_offers
        WHERE enquiry_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [enquiry.id]
    );

    const latestOffer = latestOfferRows[0];

    if (
      !latestOffer ||
      Number(latestOffer.id) !== Number(currentOffer.id)
    ) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        error: "Only the latest charter offer can be rejected"
      });
    }

    if (currentOffer.status !== "pending") {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        error: "This charter offer is no longer pending"
      });
    }

    if (Number(currentOffer.is_expired) === 1) {
      await connection.query(
        `
          UPDATE charter_offers
          SET status = 'expired'
          WHERE id = ?
            AND status = 'pending'
        `,
        [offerId]
      );

      await connection.commit();

      return res.status(409).json({
        success: false,
        error: "This charter offer has expired"
      });
    }

    if (Number(currentOffer.offered_by_user_id) === userId) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        error: "You cannot reject your own charter offer"
      });
    }

    await connection.query(
      `
        UPDATE charter_offers
        SET status = 'rejected'
        WHERE id = ?
          AND status = 'pending'
      `,
      [offerId]
    );

    await connection.query(
      `
        UPDATE charter_enquiries
        SET status = 'rejected'
        WHERE id = ?
      `,
      [enquiry.id]
    );

    const [rows] = await connection.query(
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
      [offerId]
    );

    const offer = rows[0];

    await connection.commit();

    return res.json({
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
      message: "Charter offer rejected successfully"
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logger.error(
          { err: rollbackError },
          "Charter offer rejection rollback error"
        );
      }
    }

    logger.error(
      { err: error },
      "Charter offer rejection API error"
    );

    return res.status(500).json({
      success: false,
      error: "Unable to reject charter offer"
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/*
 * POST /api/charter/offers/:id/counter
 *
 * Counter the latest pending charter offer.
 * Only the opposite party in the negotiation may counter.
 */
router.post("/offers/:id/counter", async (req, res) => {
  let connection;

  try {
    const offerId = Number(req.params.id);

    if (!Number.isInteger(offerId) || offerId <= 0) {
      return res.status(400).json({
        success: false,
        error: "offer id must be a positive integer"
      });
    }

    const normalized = normalizeOfferPayload(req.body);

    if (normalized.error) {
      return res.status(400).json({
        success: false,
        error: normalized.error
      });
    }

    const {
      amount,
      currencyCode,
      rateUnit,
      charterDays,
      terms,
      expiresAt
    } = normalized.value;

    connection = await pool.getConnection();

    await connection.beginTransaction();

    const [enquiryRows] = await connection.query(
      `
        SELECT
          e.id,
          e.requester_user_id,
          e.status,
          l.listed_by_user_id
        FROM charter_enquiries e
        INNER JOIN vessel_marketplace_listings l
          ON l.id = e.listing_id
        INNER JOIN charter_offers o
          ON o.enquiry_id = e.id
        WHERE o.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [offerId]
    );

    const enquiry = enquiryRows[0];

    if (!enquiry) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        error: "Charter offer not found"
      });
    }

    const userId = Number(req.session.user.id);
    const requesterUserId = Number(enquiry.requester_user_id);
    const listingOwnerUserId = Number(enquiry.listed_by_user_id);

    if (
      userId !== requesterUserId &&
      userId !== listingOwnerUserId
    ) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        error: "You are not authorized to counter this charter offer"
      });
    }

    if (
      enquiry.status !== "offer_made" &&
      enquiry.status !== "negotiating"
    ) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        error: "This charter enquiry is not open for negotiation"
      });
    }

    const [offerRows] = await connection.query(
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
          updated_at,
          CASE
            WHEN expires_at IS NOT NULL
              AND expires_at <= NOW()
            THEN 1
            ELSE 0
          END AS is_expired
        FROM charter_offers
        WHERE id = ?
          AND enquiry_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [offerId, enquiry.id]
    );

    const currentOffer = offerRows[0];

    if (!currentOffer) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        error: "Charter offer not found"
      });
    }

    const [latestOfferRows] = await connection.query(
      `
        SELECT
          id,
          status,
          expires_at
        FROM charter_offers
        WHERE enquiry_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [enquiry.id]
    );

    const latestOffer = latestOfferRows[0];

    if (
      !latestOffer ||
      Number(latestOffer.id) !== Number(currentOffer.id)
    ) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        error: "Only the latest charter offer can be countered"
      });
    }

    if (currentOffer.status !== "pending") {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        error: "This charter offer is no longer pending"
      });
    }

    if (Number(currentOffer.is_expired) === 1) {
      await connection.query(
        `
          UPDATE charter_offers
          SET status = 'expired'
          WHERE id = ?
            AND status = 'pending'
        `,
        [offerId]
      );

      await connection.commit();

      return res.status(409).json({
        success: false,
        error: "This charter offer has expired"
      });
    }

    if (Number(currentOffer.offered_by_user_id) === userId) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        error: "You cannot counter your own charter offer"
      });
    }

    const [result] = await connection.query(
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `,
      [
        enquiry.id,
        userId,
        currentOffer.id,
        amount,
        currencyCode,
        rateUnit,
        charterDays,
        terms,
        expiresAt
      ]
    );

    await connection.query(
      `
        UPDATE charter_offers
        SET status = 'countered'
        WHERE id = ?
          AND status = 'pending'
      `,
      [currentOffer.id]
    );

    await connection.query(
      `
        UPDATE charter_enquiries
        SET status = 'negotiating'
        WHERE id = ?
      `,
      [enquiry.id]
    );

    const [rows] = await connection.query(
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

    await connection.commit();

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
      message: "Charter counter-offer created successfully"
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logger.error(
          { err: rollbackError },
          "Charter counter-offer rollback error"
        );
      }
    }

    logger.error(
      { err: error },
      "Charter counter-offer API error"
    );

    return res.status(500).json({
      success: false,
      error: "Unable to create charter counter-offer"
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
