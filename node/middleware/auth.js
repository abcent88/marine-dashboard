const pool = require("../db");
const logger = require("../lib/logger");

async function validateSessionUser(req, res) {
  if (!req.session || !req.session.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required."
    });
    return false;
  }

  const sessionUserId = Number(req.session.user.id);

  if (!Number.isInteger(sessionUserId) || sessionUserId <= 0) {
    req.session.user = null;

    res.status(401).json({
      success: false,
      message: "Invalid session."
    });
    return false;
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT
          id,
          full_name,
          email,
          role,
          status
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [sessionUserId]
    );

    if (rows.length !== 1) {
      req.session.user = null;

      res.status(401).json({
        success: false,
        message: "Your session is no longer valid."
      });
      return false;
    }

    const user = rows[0];

    /*
     * Only active accounts may use protected APIs.
     * This immediately blocks inactive, suspended,
     * and soft-deleted accounts.
     */
    if (user.status !== "active") {
      req.session.user = null;

      res.status(403).json({
        success: false,
        message: "This account is no longer active."
      });
      return false;
    }

    /*
     * Synchronize the session with the current database record.
     * This makes role changes take effect immediately.
     */
    req.session.user = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      status: user.status
    };

    return true;
  } catch (error) {
    logger.error({ err: error }, "Session validation error");

    res.status(500).json({
      success: false,
      message: "Authentication service error."
    });
    return false;
  }
}

async function requireAuth(req, res, next) {
  const valid = await validateSessionUser(req, res);

  if (!valid) {
    return;
  }

  next();
}

function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    const valid = await validateSessionUser(req, res);

    if (!valid) {
      return;
    }

    if (!allowedRoles.includes(req.session.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action."
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
