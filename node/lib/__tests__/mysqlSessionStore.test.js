jest.mock("../../db", () => ({
  query: jest.fn()
}));

const pool = require("../../db");
const MySQLSessionStore = require("../mysqlSessionStore");

describe("MySQLSessionStore", () => {
  let store;

  beforeEach(() => {
    store = new MySQLSessionStore();
    pool.query.mockReset();
  });

  test("get returns the stored session when it has not expired", async () => {
    const sessionData = {
      cookie: {
        maxAge: 28800000
      },
      user: {
        id: 7,
        role: "admin"
      }
    };

    pool.query.mockResolvedValueOnce([
      [{ data: JSON.stringify(sessionData) }],
      []
    ]);

    const callback = jest.fn();

    await store.get("session-123", callback);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT data"),
      ["session-123", expect.any(Number)]
    );
    expect(callback).toHaveBeenCalledWith(null, sessionData);
  });

  test("get returns null when the session does not exist or has expired", async () => {
    pool.query.mockResolvedValueOnce([[], []]);

    const callback = jest.fn();

    await store.get("missing-session", callback);

    expect(callback).toHaveBeenCalledWith(null, null);
  });

  test("get returns a database error", async () => {
    const error = new Error("database unavailable");
    pool.query.mockRejectedValueOnce(error);

    const callback = jest.fn();

    await store.get("session-123", callback);

    expect(callback).toHaveBeenCalledWith(error);
  });

  test("set stores the session with its cookie expiration", async () => {
    const expiresAt = Date.now() + 3600000;
    const sessionData = {
      cookie: {
        expires: new Date(expiresAt).toISOString()
      },
      user: {
        id: 9
      }
    };

    pool.query.mockResolvedValueOnce([{}, []]);

    const callback = jest.fn();

    await store.set("session-456", sessionData, callback);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO sessions"),
      ["session-456", expiresAt, JSON.stringify(sessionData)]
    );
    expect(callback).toHaveBeenCalledWith(null);
  });

  test("set uses maxAge when cookie expiration is unavailable", async () => {
    const sessionData = {
      cookie: {
        maxAge: 60000
      }
    };

    pool.query.mockResolvedValueOnce([{}, []]);

    const callback = jest.fn();
    const before = Date.now();

    await store.set("session-789", sessionData, callback);

    const after = Date.now();
    const [, params] = pool.query.mock.calls[0];

    expect(params[0]).toBe("session-789");
    expect(params[1]).toBeGreaterThanOrEqual(before + 60000);
    expect(params[1]).toBeLessThanOrEqual(after + 60000);
    expect(params[2]).toBe(JSON.stringify(sessionData));
    expect(callback).toHaveBeenCalledWith(null);
  });

  test("set returns a database error", async () => {
    const error = new Error("insert failed");
    pool.query.mockRejectedValueOnce(error);

    const callback = jest.fn();

    await store.set("session-123", { cookie: {} }, callback);

    expect(callback).toHaveBeenCalledWith(error);
  });

  test("destroy deletes the session", async () => {
    pool.query.mockResolvedValueOnce([{}, []]);

    const callback = jest.fn();

    await store.destroy("session-123", callback);

    expect(pool.query).toHaveBeenCalledWith(
      "DELETE FROM sessions WHERE session_id = ?",
      ["session-123"]
    );
    expect(callback).toHaveBeenCalledWith(null);
  });

  test("destroy returns a database error", async () => {
    const error = new Error("delete failed");
    pool.query.mockRejectedValueOnce(error);

    const callback = jest.fn();

    await store.destroy("session-123", callback);

    expect(callback).toHaveBeenCalledWith(error);
  });

  test("touch updates the session expiration", async () => {
    const sessionData = {
      cookie: {
        expires: new Date(Date.now() + 7200000).toISOString()
      }
    };

    pool.query.mockResolvedValueOnce([{}, []]);

    const callback = jest.fn();

    await store.touch("session-123", sessionData, callback);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE sessions"),
      [new Date(sessionData.cookie.expires).getTime(), "session-123"]
    );
    expect(callback).toHaveBeenCalledWith(null);
  });

  test("touch returns a database error", async () => {
    const error = new Error("update failed");
    pool.query.mockRejectedValueOnce(error);

    const callback = jest.fn();

    await store.touch("session-123", { cookie: {} }, callback);

    expect(callback).toHaveBeenCalledWith(error);
  });

  test("getExpiration falls back to eight hours", () => {
    const before = Date.now();

    const expiresAt = store.getExpiration({ cookie: {} });

    const after = Date.now();

    expect(expiresAt).toBeGreaterThanOrEqual(before + 28800000);
    expect(expiresAt).toBeLessThanOrEqual(after + 28800000);
  });
});
