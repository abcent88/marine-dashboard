const express = require("express");
const pool = require("../db");
const logger = require("../lib/logger");
const { requireRole } = require("../middleware/auth");
const { ALLOWED_ROLES, ALLOWED_STATUSES, validateUserId } = require("./user-helpers");

const router = express.Router();

/*
 * Update an existing user.
 * Super Admin may update any supported user.
 * Admin may not edit a Super Admin or assign the Super Admin role.
 *
 * Password changes are intentionally handled separately.
 */
router.put("/:id", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const userId = validateUserId(req.params.id);

    if (userId === null) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID."
      });
    }

    const fullName = String(req.body?.fullName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const role = String(req.body?.role || "").trim();
    const status = String(req.body?.status || "").trim();

    if (!fullName || !email || !role || !status) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, role, and status are required."
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

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role."
      });
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user status."
      });
    }

    const [existingRows] = await pool.execute(
      `SELECT
        id,
        full_name,
        email,
        role,
        status
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const existingUser = existingRows[0];
    const currentUserRole = req.session.user.role;
    const currentUserId = Number(req.session.user.id);

    /*
     * Deleted accounts are retained for historical records and
     * cannot be modified through the normal edit endpoint.
     */
    if (existingUser.status === "deleted") {
      return res.status(409).json({
        success: false,
        message: "Deleted accounts cannot be edited."
      });
    }

    /*
     * Admins cannot edit Super Admin accounts.
     */
    if (
      existingUser.role === "super_admin" &&
      currentUserRole !== "super_admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Only a Super Admin can edit a Super Admin account."
      });
    }

    /*
     * Admins cannot promote any user to Super Admin.
     */
    if (
      role === "super_admin" &&
      currentUserRole !== "super_admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Only a Super Admin can assign the Super Admin role."
      });
    }

    /*
     * Prevent an administrator from accidentally locking or
     * changing the privilege level of their own active session.
     */
    if (userId === currentUserId) {
      if (role !== existingUser.role) {
        return res.status(400).json({
          success: false,
          message: "You cannot change your own role while signed in."
        });
      }

      if (status !== existingUser.status) {
        return res.status(400).json({
          success: false,
          message: "You cannot change your own account status while signed in."
        });
      }
    }

    /*
     * Check that the email is not already being used by another user.
     */
    const [duplicateRows] = await pool.execute(
      `SELECT id
       FROM users
       WHERE email = ?
         AND id <> ?
       LIMIT 1`,
      [email, userId]
    );

    if (duplicateRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "A user with that email already exists."
      });
    }

    await pool.execute(
      `UPDATE users
       SET
         full_name = ?,
         email = ?,
         role = ?,
         status = ?
       WHERE id = ?
       LIMIT 1`,
      [fullName, email, role, status, userId]
    );

    await pool.execute(
      `INSERT INTO audit_logs
        (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        currentUserId,
        "update_user",
        "user",
        userId,
        JSON.stringify({
          before: {
            fullName: existingUser.full_name,
            email: existingUser.email,
            role: existingUser.role,
            status: existingUser.status
          },
          after: {
            fullName,
            email,
            role,
            status
          }
        }),
        req.ip
      ]
    );

    return res.json({
      success: true,
      message: "User updated successfully.",
      data: {
        id: userId,
        fullName,
        email,
        role,
        status
      }
    });
  } catch (error) {
    logger.error({ err: error }, "Update user error");

    return res.status(500).json({
      success: false,
      message: "Unable to update user."
    });
  }
});

module.exports = router;
