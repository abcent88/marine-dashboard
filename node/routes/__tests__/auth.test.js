const express = require("express");
const session = require("express-session");
const request = require("supertest");

jest.mock("../../db", () => ({
  execute: jest.fn()
}));

const pool = require("../../db");
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

    const bcrypt = require("bcrypt");

    jest.spyOn(bcrypt, "compare").mockResolvedValueOnce(true);

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
    expect(bcrypt.compare).toHaveBeenCalledWith(
      "CorrectPassword123!",
      "stored-hash"
    );

    bcrypt.compare.mockRestore();
  });

  test("POST /login rejects invalid credentials", async () => {
    pool.execute.mockResolvedValueOnce([
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
    ]);

    const bcrypt = require("bcrypt");

    jest.spyOn(bcrypt, "compare").mockResolvedValueOnce(false);

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

    bcrypt.compare.mockRestore();
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
  });
});
