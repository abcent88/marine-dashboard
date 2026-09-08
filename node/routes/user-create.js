const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");
const logger = require("../lib/logger");
const { requireRole } = require("../middleware/auth");
const { ALLOWED_ROLES } = require("./user-helpers");

const router = express.Router();

router.post("/", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || "").trim();

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, password, and role are required."
      });
    }

    if (fullName.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Full name must not exceed 150 characters."
      });
    }

    if (email.length > 255 || !email.includes("@")) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters."
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role."
      });
    }

    if (
      role === "super_admin" &&
      req.session.user.role !== "super_admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Only a Super Admin can create a Super Admin account."
      });
    }

    const [existingUsers] = await pool.execute(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "A user with that email already exists."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await pool.execute(
      `INSERT INTO users
        (full_name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [fullName, email, passwordHash, role]
    );

    const userId = Number(result.insertId);

    await pool.execute(
      `INSERT INTO audit_logs
        (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.session.user.id,
        "create_user",
        "user",
        userId,
        JSON.stringify({
          fullName,
          email,
          role,
          status: "active"
        }),
        req.ip
      ]
    );

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      data: {
        id: userId,
        fullName,
        email,
        role,
        status: "active"
      }
    });
  } catch (error) {
    logger.error({ err: error }, "Create user error");

    return res.status(500).json({
      success: false,
      message: "Unable to create user."
    });
  }
});

module.exports = router;
