const session = require("express-session");
const pool = require("../db");

class MySQLSessionStore extends session.Store {
  async get(sid, callback) {
    try {
      const [rows] = await pool.query(
        `
          SELECT data
          FROM sessions
          WHERE session_id = ?
            AND expires_at > ?
          LIMIT 1
        `,
        [sid, Date.now()]
      );

      if (rows.length === 0) {
        return callback(null, null);
      }

      callback(null, JSON.parse(rows[0].data));
    } catch (error) {
      callback(error);
    }
  }

  async set(sid, sessionData, callback) {
    try {
      const expiresAt = this.getExpiration(sessionData);
      const data = JSON.stringify(sessionData);

      await pool.query(
        `
          INSERT INTO sessions (session_id, expires_at, data)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            expires_at = VALUES(expires_at),
            data = VALUES(data),
            updated_at = CURRENT_TIMESTAMP
        `,
        [sid, expiresAt, data]
      );

      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async destroy(sid, callback) {
    try {
      await pool.query(
        "DELETE FROM sessions WHERE session_id = ?",
        [sid]
      );

      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async touch(sid, sessionData, callback) {
    try {
      const expiresAt = this.getExpiration(sessionData);

      await pool.query(
        `
          UPDATE sessions
          SET expires_at = ?, updated_at = CURRENT_TIMESTAMP
          WHERE session_id = ?
        `,
        [expiresAt, sid]
      );

      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  getExpiration(sessionData) {
    if (sessionData.cookie && sessionData.cookie.expires) {
      return new Date(sessionData.cookie.expires).getTime();
    }

    if (
      sessionData.cookie &&
      typeof sessionData.cookie.maxAge === "number"
    ) {
      return Date.now() + sessionData.cookie.maxAge;
    }

    return Date.now() + 1000 * 60 * 60 * 8;
  }
}

module.exports = MySQLSessionStore;
