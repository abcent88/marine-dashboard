const express = require("express");
const session = require("express-session");
const request = require("supertest");

jest.mock("../../db", () => ({
  execute: jest.fn()
}));

const pool = require("../../db");
const userRoutes = require("../users");

const app = express();

app.use(express.json());

app.use(
  session({
    secret: "test-session-secret",
    resave: false,
    saveUninitialized: false
  })
);

app.use((req, res, next) => {
  req.session.user = {
    id: 1,
    fullName: "Test Admin",
    email: "admin@example.com",
    role: "admin",
    status: "active"
  };

  next();
});

app.use("/api/users", userRoutes);

describe("User routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    pool.execute.mockResolvedValue([
      [{
        id: 1,
        full_name: "Test Admin",
        email: "admin@example.com",
        role: "admin",
        status: "active"
      }]
    ]);
  });

  test("GET /api/users returns users without password hashes", async () => {
    pool.execute
      .mockResolvedValueOnce([
        [{
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }]
      ])
      .mockResolvedValueOnce([
        [
          {
            id: 1,
            full_name: "Test Admin",
            email: "admin@example.com",
            role: "admin",
            status: "active",
            last_login_at: "2026-09-05T10:00:00.000Z",
            created_at: "2026-09-01T10:00:00.000Z",
            updated_at: "2026-09-05T10:00:00.000Z"
          },
          {
            id: 2,
            full_name: "Test Captain",
            email: "captain@example.com",
            role: "captain",
            status: "active",
            last_login_at: null,
            created_at: "2026-09-02T10:00:00.000Z",
            updated_at: "2026-09-02T10:00:00.000Z"
          }
        ]
      ]);

    const response = await request(app)
      .get("/api/users");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);

    expect(response.body.data[0]).toEqual({
      id: 1,
      fullName: "Test Admin",
      email: "admin@example.com",
      role: "admin",
      status: "active",
      lastLoginAt: "2026-09-05T10:00:00.000Z",
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: "2026-09-05T10:00:00.000Z"
    });

    expect(JSON.stringify(response.body)).not.toContain("password_hash");
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  test("POST /api/users rejects missing required fields", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Full name, email, password, and role are required."
    });

    expect(pool.execute).toHaveBeenCalledTimes(1);
  });

  test("POST /api/users prevents an Admin from creating a Super Admin", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({
        fullName: "New Super Admin",
        email: "newadmin@example.com",
        password: "StrongPassword123!",
        role: "super_admin"
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "Only a Super Admin can create a Super Admin account."
    });

    expect(pool.execute).toHaveBeenCalledTimes(1);
  });

  test("DELETE /api/users/:id prevents an Admin from deleting a Super Admin", async () => {
    pool.execute
      .mockResolvedValueOnce([
        [{
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }]
      ])
      .mockResolvedValueOnce([
        [{
          id: 99,
          full_name: "System Owner",
          email: "owner@example.com",
          role: "super_admin",
          status: "active"
        }]
      ]);

    const response = await request(app)
      .delete("/api/users/99");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "Administrators cannot delete a Super Admin."
    });

    expect(pool.execute).toHaveBeenCalledTimes(2);
  });
});
