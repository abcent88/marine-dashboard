const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");
const logger = require("../lib/logger");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

const ALLOWED_ROLES = [
  "super_admin",
  "admin",
  "manager",
  "captain",
  "crew",
  "operator",
  "viewer"
];

/*
 * Create a user.
 * Super Admin may create any supported role.
 * Admin may create any supported role except Super Admin.
 */
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


/*
 * Update an existing user.
 * Super Admin may update any supported user.
 * Admin may not edit a Super Admin or assign the Super Admin role.
 *
 * Password changes are intentionally handled separately.
 */
router.put("/:id", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID."
      });
    }

    const fullName = String(req.body?.fullName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const role = String(req.body?.role || "").trim();
    const status = String(req.body?.status || "").trim();

    const ALLOWED_STATUSES = [
      "active",
      "inactive",
      "suspended"
    ];

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


/*
 * List users.
 * Only Super Admin and Admin may access user management.
 * Password hashes are never returned.
 */

/*
 * Reset an existing user's password.
 * Passwords are stored only as bcrypt hashes.
 * The plain-text password is never written to the audit log.
 */
router.put("/:id/password", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const newPassword = String(req.body?.newPassword || "");

    if (!Number.isInteger(userId) || userId <= 0) {
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


/*
 * Soft-delete an existing user.
 *
 * The user record is retained so historical audit logs and crew records
 * remain connected to the original account.
 */
router.delete("/:id", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID."
      });
    }

    const currentUserId = Number(req.session.user.id);
    const currentUserRole = req.session.user.role;

    if (userId === currentUserId) {
      return res.status(403).json({
        success: false,
        message: "You cannot delete your own account."
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

    if (targetUser.status === "deleted") {
      return res.status(409).json({
        success: false,
        message: "User is already deleted."
      });
    }

    if (
      currentUserRole === "admin" &&
      targetUser.role === "super_admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Administrators cannot delete a Super Admin."
      });
    }

    await pool.execute(
      `
        UPDATE users
        SET status = 'deleted'
        WHERE id = ?
      `,
      [userId]
    );

    await pool.execute(
      `
        INSERT INTO audit_logs
          (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        currentUserId,
        "delete_user",
        "user",
        userId,
        JSON.stringify({
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          targetRole: targetUser.role,
          previousStatus: targetUser.status
        }),
        req.ip || null
      ]
    );

    return res.json({
      success: true,
      message: "User deleted successfully.",
      user: {
        id: targetUser.id,
        fullName: targetUser.full_name,
        email: targetUser.email,
        role: targetUser.role,
        status: "deleted"
      }
    });
  } catch (error) {
    logger.error({ err: error }, "Delete user error");

    return res.status(500).json({
      success: false,
      message: "Unable to delete user."
    });
  }
});

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

    const users = rows.map(user => ({
      id: Number(user.id),
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      status: user.status,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }));

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
