const express = require("express");
const pool = require("../db");
const logger = require("../lib/logger");
const { requireRole } = require("../middleware/auth");
const { serializeUser } = require("./user-helpers");

const router = express.Router();

/*
 * List users.
 * Only Super Admin and Admin may access user management.
 * Password hashes are never returned.
 */

router.get("/", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        id,
        full_name,
        email,
        role,
        status,
        last_login_at,
        created_at,
        updated_at
      FROM users
      ORDER BY id ASC
    `);

    const users = rows.map(serializeUser);

    return res.json({
      success: true,
      data: users
    });
  } catch (error) {
    logger.error({ err: error }, "Users API error");

    return res.status(500).json({
      success: false,
      message: "Unable to load users."
    });
  }
});

module.exports = router;
