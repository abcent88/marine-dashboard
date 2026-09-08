const express = require("express");
const pool = require("../db");
const logger = require("../lib/logger");
const { requireRole } = require("../middleware/auth");
const { validateUserId } = require("./user-helpers");

const router = express.Router();

/*
 * Soft-delete an existing user.
 *
 * The user record is retained so historical audit logs and crew records
 * remain connected to the original account.
 */
router.delete("/:id", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const userId = validateUserId(req.params.id);

    if (userId === null) {
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

module.exports = router;
