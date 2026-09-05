const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");
const logger = require("../lib/logger");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    const [rows] = await pool.execute(
      `SELECT
        id,
        full_name,
        email,
        password_hash,
        role,
        status
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    if (rows.length !== 1) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const user = rows[0];

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "This account is not active."
      });
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    await pool.execute(
      "UPDATE users SET last_login_at = NOW() WHERE id = ?",
      [user.id]
    );

    req.session.user = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      status: user.status
    };

    return res.json({
      success: true,
      message: "Login successful.",
      data: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    logger.error({ err: error }, "Authentication error");

    return res.status(500).json({
      success: false,
      message: "Authentication service error."
    });
  }
});


router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if(error){
      logger.error({ err: error }, "Logout error");

      return res.status(500).json({
        success: false,
        message: "Unable to log out."
      });
    }

    res.clearCookie("connect.sid");

    return res.json({
      success: true,
      message: "Logout successful."
    });
  });
});

router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated."
    });
  }

  return res.json({
    success: true,
    data: req.session.user
  });
});

module.exports = router;
