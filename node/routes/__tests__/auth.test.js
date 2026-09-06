const express = require("express");
const session = require("express-session");
const request = require("supertest");

jest.mock("../../db", () => ({
  execute: jest.fn()
}));

jest.mock("../../lib/logger", () => ({
  error: jest.fn()
}));

jest.mock("bcrypt", () => ({
  compare: jest.fn()
}));

const pool = require("../../db");
const logger = require("../../lib/logger");
const bcrypt = require("bcrypt");
const authRoutes = require("../auth");

const app = express();

app.use(express.json());

app.use(
  session({
    secret: "test-session-secret",
    resave: false,
    saveUninitialized: false
  })
);

app.use("/api/auth", authRoutes);

describe("Authentication routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("POST /login succeeds with valid active credentials", async () => {
    pool.execute
      .mockResolvedValueOnce([
        [
          {
            id: 1,
            full_name: "Test Captain",
            email: "captain@example.com",
            password_hash: "stored-hash",
            role: "captain",
            status: "active"
          }
        ]
      ])
      .mockResolvedValueOnce([{}]);

    bcrypt.compare.mockResolvedValueOnce(true);

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "captain@example.com",
        password: "CorrectPassword123!"
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Login successful.",
      data: {
        id: 1,
        fullName: "Test Captain",
        email: "captain@example.com",
        role: "captain",
        status: "active"
      }
    });

    expect(pool.execute).toHaveBeenCalledTimes(2);
    expect(pool.execute).toHaveBeenLastCalledWith(
      "UPDATE users SET last_login_at = NOW() WHERE id = ?",
      [1]
    );
    expect(bcrypt.compare).toHaveBeenCalledWith(
      "CorrectPassword123!",
      "stored-hash"
    );
  });

  test("POST /login normalizes email and trims whitespace", async () => {
    pool.execute
      .mockResolvedValueOnce([
        [
          {
            id: 3,
            full_name: "Normalized Captain",
            email: "captain@example.com",
            password_hash: "stored-hash",
            role: "captain",
            status: "active"
          }
        ]
      ])
      .mockResolvedValueOnce([{}]);

    bcrypt.compare.mockResolvedValueOnce(true);

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "  CAPTAIN@EXAMPLE.COM  ",
        password: "CorrectPassword123!"
      });

    expect(response.status).toBe(200);

    expect(pool.execute).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("WHERE email = ?"),
      ["captain@example.com"]
    );

    expect(bcrypt.compare).toHaveBeenCalledWith(
      "CorrectPassword123!",
      "stored-hash"
    );
  });

  test("POST /login rejects missing email or password", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "",
        password: ""
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Email and password are required."
    });

    expect(pool.execute).not.toHaveBeenCalled();
  });

  test("POST /login rejects unknown email", async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "unknown@example.com",
        password: "CorrectPassword123!"
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid email or password."
    });

    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test("POST /login rejects inactive accounts", async () => {
    pool.execute.mockResolvedValueOnce([
      [
        {
          id: 2,
          full_name: "Inactive Captain",
          email: "inactive@example.com",
          password_hash: "stored-hash",
          role: "captain",
          status: "inactive"
        }
      ]
    ]);

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "inactive@example.com",
        password: "CorrectPassword123!"
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "This account is not active."
    });

    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test("POST /login rejects incorrect password", async () => {
    pool.execute.mockResolvedValueOnce([
      [
        {
          id: 4,
          full_name: "Wrong Password Captain",
          email: "captain@example.com",
          password_hash: "stored-hash",
          role: "captain",
          status: "active"
        }
      ]
    ]);

    bcrypt.compare.mockResolvedValueOnce(false);

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "captain@example.com",
        password: "WrongPassword"
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid email or password."
    });

    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(bcrypt.compare).toHaveBeenCalledWith(
      "WrongPassword",
      "stored-hash"
    );
  });

  test("POST /login returns 500 when database lookup fails", async () => {
    const databaseError = new Error("Database unavailable");

    pool.execute.mockRejectedValueOnce(databaseError);

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "captain@example.com",
        password: "CorrectPassword123!"
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: "Authentication service error."
    });

    expect(logger.error).toHaveBeenCalledWith(
      { err: databaseError },
      "Authentication error"
    );
  });

  test("POST /logout succeeds and destroys the session", async () => {
    const response = await request(app)
      .post("/api/auth/logout");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Logout successful."
    });

    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("connect.sid=")
      ])
    );
  });

  test("POST /logout returns 500 when session destruction fails", async () => {
    const destroyError = new Error("Session store unavailable");

    const failureApp = express();

    failureApp.use(express.json());

    failureApp.use(
      session({
        secret: "test-session-secret",
        resave: false,
        saveUninitialized: false
      })
    );

    failureApp.use((req, res, next) => {
      req.session.destroy = (callback) => {
        callback(destroyError);
      };

      next();
    });

    failureApp.use("/api/auth", authRoutes);

    const response = await request(failureApp)
      .post("/api/auth/logout");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: "Unable to log out."
    });

    expect(logger.error).toHaveBeenCalledWith(
      { err: destroyError },
      "Logout error"
    );
  });

  test("GET /me rejects unauthenticated requests", async () => {
    const response = await request(app)
      .get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Not authenticated."
    });
  });

  test("GET /me returns the authenticated session user", async () => {
    const agent = request.agent(app);

    pool.execute
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            full_name: "Session Captain",
            email: "session@example.com",
            password_hash: "stored-hash",
            role: "captain",
            status: "active"
          }
        ]
      ])
      .mockResolvedValueOnce([{}]);

    bcrypt.compare.mockResolvedValueOnce(true);

    const loginResponse = await agent
      .post("/api/auth/login")
      .send({
        email: "session@example.com",
        password: "CorrectPassword123!"
      });

    expect(loginResponse.status).toBe(200);

    const meResponse = await agent
      .get("/api/auth/me");

    expect(meResponse.status).toBe(200);
    expect(meResponse.body).toEqual({
      success: true,
      data: {
        id: 10,
        fullName: "Session Captain",
        email: "session@example.com",
        role: "captain",
        status: "active"
      }
    });
  });

  test("POST /login stores the expected session user", async () => {
    pool.execute
      .mockResolvedValueOnce([
        [
          {
            id: 11,
            full_name: "Session Test Captain",
            email: "session-test@example.com",
            password_hash: "stored-hash",
            role: "admin",
            status: "active"
          }
        ]
      ])
      .mockResolvedValueOnce([{}]);

    bcrypt.compare.mockResolvedValueOnce(true);

    const agent = request.agent(app);

    await agent
      .post("/api/auth/login")
      .send({
        email: "session-test@example.com",
        password: "CorrectPassword123!"
      });

    const response = await agent
      .get("/api/auth/me");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      id: 11,
      fullName: "Session Test Captain",
      email: "session-test@example.com",
      role: "admin",
      status: "active"
    });
  });
});
