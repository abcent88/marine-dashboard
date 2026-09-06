const express = require("express");
const request = require("supertest");

jest.mock("../../db", () => ({
  execute: jest.fn()
}));

jest.mock("../../lib/logger", () => ({
  error: jest.fn()
}));

const pool = require("../../db");
const logger = require("../../lib/logger");
const { requireAuth, requireRole } = require("../auth");

function createApp(middleware, configureSession) {
  const app = express();

  app.use(express.json());

  app.use((req, res, next) => {
    req.session = {
      user: {
        id: 1,
        fullName: "Old Name",
        email: "old@example.com",
        role: "old_role",
        status: "active"
      }
    };

    if (configureSession) {
      configureSession(req);
    }

    next();
  });

  app.get("/protected", middleware, (req, res) => {
    res.json({
      success: true,
      data: req.session.user
    });
  });

  return app;
}

describe("Authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("requireAuth rejects requests without a session", async () => {
    const app = createApp(requireAuth, (req) => {
      req.session = undefined;
    });

    const response = await request(app)
      .get("/protected");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Authentication required."
    });

    expect(pool.execute).not.toHaveBeenCalled();
  });

  test("requireAuth rejects requests without a session user", async () => {
    const app = createApp(requireAuth, (req) => {
      req.session.user = null;
    });

    const response = await request(app)
      .get("/protected");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Authentication required."
    });

    expect(pool.execute).not.toHaveBeenCalled();
  });

  test("requireAuth rejects an invalid session user ID", async () => {
    const app = createApp(requireAuth, (req) => {
      req.session.user.id = "invalid-id";
    });

    const response = await request(app)
      .get("/protected");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid session."
    });

    expect(pool.execute).not.toHaveBeenCalled();
  });

  test("requireAuth rejects a non-positive session user ID", async () => {
    const app = createApp(requireAuth, (req) => {
      req.session.user.id = 0;
    });

    const response = await request(app)
      .get("/protected");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid session."
    });

    expect(pool.execute).not.toHaveBeenCalled();
  });

  test("requireAuth rejects a session when the user no longer exists", async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const app = createApp(requireAuth);

    const response = await request(app)
      .get("/protected");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Your session is no longer valid."
    });

    expect(pool.execute).toHaveBeenCalledTimes(1);
  });

  test("requireAuth rejects inactive accounts", async () => {
    pool.execute.mockResolvedValueOnce([
      [
        {
          id: 1,
          full_name: "Inactive Captain",
          email: "inactive@example.com",
          role: "captain",
          status: "inactive"
        }
      ]
    ]);

    const app = createApp(requireAuth);

    const response = await request(app)
      .get("/protected");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "This account is no longer active."
    });

    expect(pool.execute).toHaveBeenCalledTimes(1);
  });

  test("requireAuth rejects suspended accounts", async () => {
    pool.execute.mockResolvedValueOnce([
      [
        {
          id: 1,
          full_name: "Suspended Captain",
          email: "suspended@example.com",
          role: "captain",
          status: "suspended"
        }
      ]
    ]);

    const app = createApp(requireAuth);

    const response = await request(app)
      .get("/protected");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "This account is no longer active."
    });
  });

  test("requireAuth returns 500 when session validation database query fails", async () => {
    const databaseError = new Error("Database unavailable");

    pool.execute.mockRejectedValueOnce(databaseError);

    const app = createApp(requireAuth);

    const response = await request(app)
      .get("/protected");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: "Authentication service error."
    });

    expect(logger.error).toHaveBeenCalledWith(
      { err: databaseError },
      "Session validation error"
    );
  });

  test("requireAuth synchronizes the session with the active database user", async () => {
    pool.execute.mockResolvedValueOnce([
      [
        {
          id: 1,
          full_name: "Current Captain",
          email: "current@example.com",
          role: "captain",
          status: "active"
        }
      ]
    ]);

    const app = createApp(requireAuth);

    const response = await request(app)
      .get("/protected");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        id: 1,
        fullName: "Current Captain",
        email: "current@example.com",
        role: "captain",
        status: "active"
      }
    });

    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ?"),
      [1]
    );
  });

  test("requireRole allows an authorized role", async () => {
    pool.execute.mockResolvedValueOnce([
      [
        {
          id: 1,
          full_name: "Admin Captain",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]
    ]);

    const app = createApp(
      requireRole("admin", "super_admin")
    );

    const response = await request(app)
      .get("/protected");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        id: 1,
        fullName: "Admin Captain",
        email: "admin@example.com",
        role: "admin",
        status: "active"
      }
    });
  });

  test("requireRole rejects a forbidden role", async () => {
    pool.execute.mockResolvedValueOnce([
      [
        {
          id: 1,
          full_name: "Captain",
          email: "captain@example.com",
          role: "captain",
          status: "active"
        }
      ]
    ]);

    const app = createApp(
      requireRole("admin", "super_admin")
    );

    const response = await request(app)
      .get("/protected");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "You do not have permission to perform this action."
    });
  });

  test("requireRole stops when session validation fails", async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const app = createApp(
      requireRole("admin")
    );

    const response = await request(app)
      .get("/protected");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Your session is no longer valid."
    });
  });
});
