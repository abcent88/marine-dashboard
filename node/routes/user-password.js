const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");
const logger = require("../lib/logger");
const { requireRole } = require("../middleware/auth");
const { validateUserId } = require("./user-helpers");

const router = express.Router();

/*
 * Reset an existing user's password.
 * Passwords are stored only as bcrypt hashes.
 * The plain-text password is never written to the audit log.
 */
router.put("/:id/password", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const userId = validateUserId(req.params.id);
    const newPassword = String(req.body?.newPassword || "");

    if (userId === null) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID."
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters."
      });
    }

    const [users] = await pool.execute(
      `
        SELECT id, full_name, email, role, status
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const targetUser = users[0];
    const currentUserRole = req.session.user.role;
    const currentUserId = Number(req.session.user.id);

    if (targetUser.status === "deleted") {
      return res.status(409).json({
        success: false,
        message: "Password changes are not allowed for a deleted account."
      });
    }

    if (
      currentUserRole === "admin" &&
      targetUser.role === "super_admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Administrators cannot reset a Super Admin password."
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await pool.execute(
      `
        UPDATE users
        SET password_hash = ?
        WHERE id = ?
      `,
      [passwordHash, userId]
    );

    await pool.execute(
      `
        INSERT INTO audit_logs
          (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        currentUserId,
        "reset_user_password",
        "user",
        userId,
        JSON.stringify({
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          targetRole: targetUser.role
        }),
        req.ip || null
      ]
    );

    return res.json({
      success: true,
      message: "User password reset successfully.",
      user: {
        id: targetUser.id,
        fullName: targetUser.full_name,
        email: targetUser.email,
        role: targetUser.role,
        status: targetUser.status
      }
    });
  } catch (error) {
    logger.error({ err: error }, "Reset user password error");

    return res.status(500).json({
      success: false,
      message: "Unable to reset user password."
    });
  }
});

module.exports = router;
