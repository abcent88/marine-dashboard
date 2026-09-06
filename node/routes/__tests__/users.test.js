const express = require("express");
const session = require("express-session");
const request = require("supertest");

jest.mock("bcrypt", () => ({
  hash: jest.fn().mockResolvedValue("mock-password-hash")
}));

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

  test("GET /api/users returns 500 when the database fails", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockRejectedValueOnce(new Error("database unavailable"));

    const response = await request(app)
      .get("/api/users");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: "Unable to load users."
    });
  });

  test("POST /api/users rejects an overlong full name", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({
        fullName: "A".repeat(151),
        email: "new@example.com",
        password: "StrongPassword123!",
        role: "captain"
      });

    expect(response.status).toBe(400);
    expect(response.body.message)
      .toBe("Full name must not exceed 150 characters.");
  });

  test("POST /api/users rejects an invalid email", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({
        fullName: "New Captain",
        email: "invalid-email",
        password: "StrongPassword123!",
        role: "captain"
      });

    expect(response.status).toBe(400);
    expect(response.body.message)
      .toBe("Please provide a valid email address.");
  });

  test("POST /api/users rejects a short password", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({
        fullName: "New Captain",
        email: "new@example.com",
        password: "short",
        role: "captain"
      });

    expect(response.status).toBe(400);
    expect(response.body.message)
      .toBe("Password must be at least 8 characters.");
  });

  test("POST /api/users rejects an invalid role", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({
        fullName: "New User",
        email: "new@example.com",
        password: "StrongPassword123!",
        role: "invalid_role"
      });

    expect(response.status).toBe(400);
    expect(response.body.message)
      .toBe("Invalid user role.");
  });

  test("POST /api/users rejects a duplicate email", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[{ id: 77 }]]);

    const response = await request(app)
      .post("/api/users")
      .send({
        fullName: "Existing User",
        email: "existing@example.com",
        password: "StrongPassword123!",
        role: "captain"
      });

    expect(response.status).toBe(409);
    expect(response.body.message)
      .toBe("A user with that email already exists.");
    expect(pool.execute).toHaveBeenCalledTimes(2);
  });

  test("POST /api/users creates a user and audit record", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 42 }])
      .mockResolvedValueOnce([[]]);

    const response = await request(app)
      .post("/api/users")
      .send({
        fullName: "New Captain",
        email: "NEW@example.com",
        password: "StrongPassword123!",
        role: "captain"
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      message: "User created successfully.",
      data: {
        id: 42,
        fullName: "New Captain",
        email: "new@example.com",
        role: "captain",
        status: "active"
      }
    });

    expect(pool.execute).toHaveBeenCalledTimes(4);
  });

  test("POST /api/users allows a Super Admin to create a Super Admin", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Super Admin",
          email: "owner@example.com",
          role: "super_admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 43 }])
      .mockResolvedValueOnce([[]]);

    const response = await request(app)
      .post("/api/users")
      .send({
        fullName: "Second Super Admin",
        email: "second@example.com",
        password: "StrongPassword123!",
        role: "super_admin"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.role).toBe("super_admin");
  });

  test("POST /api/users returns 500 when creation fails", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockRejectedValueOnce(new Error("database failure"));

    const response = await request(app)
      .post("/api/users")
      .send({
        fullName: "New Captain",
        email: "new@example.com",
        password: "StrongPassword123!",
        role: "captain"
      });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Unable to create user.");
  });

  test.each(["bad", "0", "-1"])(
    "PUT /api/users/:id rejects invalid ID %s",
    async id => {
      const response = await request(app)
        .put(`/api/users/${id}`)
        .send({
          fullName: "Updated User",
          email: "updated@example.com",
          role: "captain",
          status: "active"
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid user ID.");
    }
  );

  test("PUT /api/users/:id rejects missing required fields", async () => {
    const response = await request(app)
      .put("/api/users/2")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message)
      .toBe("Full name, email, role, and status are required.");
  });

  test("PUT /api/users/:id rejects an overlong full name", async () => {
    const response = await request(app)
      .put("/api/users/2")
      .send({
        fullName: "A".repeat(151),
        email: "updated@example.com",
        role: "captain",
        status: "active"
      });

    expect(response.status).toBe(400);
    expect(response.body.message)
      .toBe("Full name must not exceed 150 characters.");
  });

  test("PUT /api/users/:id rejects an invalid email", async () => {
    const response = await request(app)
      .put("/api/users/2")
      .send({
        fullName: "Updated User",
        email: "invalid-email",
        role: "captain",
        status: "active"
      });

    expect(response.status).toBe(400);
    expect(response.body.message)
      .toBe("Please provide a valid email address.");
  });

  test("PUT /api/users/:id rejects an invalid role", async () => {
    const response = await request(app)
      .put("/api/users/2")
      .send({
        fullName: "Updated User",
        email: "updated@example.com",
        role: "invalid_role",
        status: "active"
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid user role.");
  });

  test("PUT /api/users/:id rejects an invalid status", async () => {
    const response = await request(app)
      .put("/api/users/2")
      .send({
        fullName: "Updated User",
        email: "updated@example.com",
        role: "captain",
        status: "invalid_status"
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid user status.");
  });

  test("PUT /api/users/:id returns 404 for an unknown user", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[]]);

    const response = await request(app)
      .put("/api/users/999")
      .send({
        fullName: "Updated User",
        email: "updated@example.com",
        role: "captain",
        status: "active"
      });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found.");
  });

  test("PUT /api/users/:id rejects editing a deleted account", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[
        {
          id: 2,
          full_name: "Deleted User",
          email: "deleted@example.com",
          role: "captain",
          status: "deleted"
        }
      ]]);

    const response = await request(app)
      .put("/api/users/2")
      .send({
        fullName: "Updated User",
        email: "updated@example.com",
        role: "captain",
        status: "active"
      });

    expect(response.status).toBe(409);
    expect(response.body.message)
      .toBe("Deleted accounts cannot be edited.");
  });

  test("PUT /api/users/:id prevents Admin from editing a Super Admin", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[
        {
          id: 99,
          full_name: "System Owner",
          email: "owner@example.com",
          role: "super_admin",
          status: "active"
        }
      ]]);

    const response = await request(app)
      .put("/api/users/99")
      .send({
        fullName: "Changed Owner",
        email: "owner@example.com",
        role: "super_admin",
        status: "active"
      });

    expect(response.status).toBe(403);
    expect(response.body.message)
      .toBe("Only a Super Admin can edit a Super Admin account.");
  });

  test("PUT /api/users/:id prevents Admin from assigning Super Admin", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[
        {
          id: 2,
          full_name: "Regular User",
          email: "user@example.com",
          role: "captain",
          status: "active"
        }
      ]]);

    const response = await request(app)
      .put("/api/users/2")
      .send({
        fullName: "Regular User",
        email: "user@example.com",
        role: "super_admin",
        status: "active"
      });

    expect(response.status).toBe(403);
    expect(response.body.message)
      .toBe("Only a Super Admin can assign the Super Admin role.");
  });

  test("PUT /api/users/:id prevents a user from changing their own role", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]]);

    const response = await request(app)
      .put("/api/users/1")
      .send({
        fullName: "Test Admin",
        email: "admin@example.com",
        role: "captain",
        status: "active"
      });

    expect(response.status).toBe(400);
    expect(response.body.message)
      .toBe("You cannot change your own role while signed in.");
  });

  test("PUT /api/users/:id prevents a user from changing their own status", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]]);

    const response = await request(app)
      .put("/api/users/1")
      .send({
        fullName: "Test Admin",
        email: "admin@example.com",
        role: "admin",
        status: "suspended"
      });

    expect(response.status).toBe(400);
    expect(response.body.message)
      .toBe("You cannot change your own account status while signed in.");
  });

  test("PUT /api/users/:id rejects a duplicate email", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[
        {
          id: 2,
          full_name: "Captain",
          email: "captain@example.com",
          role: "captain",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[{ id: 3 }]]);

    const response = await request(app)
      .put("/api/users/2")
      .send({
        fullName: "Captain",
        email: "other@example.com",
        role: "captain",
        status: "active"
      });

    expect(response.status).toBe(409);
    expect(response.body.message)
      .toBe("A user with that email already exists.");
  });

  test("PUT /api/users/:id updates a user and writes audit record", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[
        {
          id: 2,
          full_name: "Old Captain",
          email: "old@example.com",
          role: "captain",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);

    const response = await request(app)
      .put("/api/users/2")
      .send({
        fullName: "Updated Captain",
        email: "updated@example.com",
        role: "captain",
        status: "suspended"
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "User updated successfully.",
      data: {
        id: 2,
        fullName: "Updated Captain",
        email: "updated@example.com",
        role: "captain",
        status: "suspended"
      }
    });

    expect(pool.execute).toHaveBeenCalledTimes(5);
  });

  test("PUT /api/users/:id returns 500 when update fails", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockRejectedValueOnce(new Error("database failure"));

    const response = await request(app)
      .put("/api/users/2")
      .send({
        fullName: "Updated User",
        email: "updated@example.com",
        role: "captain",
        status: "active"
      });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Unable to update user.");
  });

  test.each(["bad", "0", "-1"])(
    "PUT /api/users/:id/password rejects invalid ID %s",
    async id => {
      const response = await request(app)
        .put(`/api/users/${id}/password`)
        .send({ newPassword: "NewStrongPassword123!" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid user ID.");
    }
  );

  test("PUT /api/users/:id/password rejects a short password", async () => {
    const response = await request(app)
      .put("/api/users/2/password")
      .send({ newPassword: "short" });

    expect(response.status).toBe(400);
    expect(response.body.message)
      .toBe("New password must be at least 8 characters.");
  });

  test("PUT /api/users/:id/password returns 404 for an unknown user", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[]]);

    const response = await request(app)
      .put("/api/users/999/password")
      .send({ newPassword: "NewStrongPassword123!" });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found.");
  });

  test("PUT /api/users/:id/password rejects a deleted account", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[
        {
          id: 2,
          full_name: "Deleted User",
          email: "deleted@example.com",
          role: "captain",
          status: "deleted"
        }
      ]]);

    const response = await request(app)
      .put("/api/users/2/password")
      .send({ newPassword: "NewStrongPassword123!" });

    expect(response.status).toBe(409);
    expect(response.body.message)
      .toBe("Password changes are not allowed for a deleted account.");
  });

  test("PUT /api/users/:id/password prevents Admin from resetting Super Admin password", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[
        {
          id: 99,
          full_name: "System Owner",
          email: "owner@example.com",
          role: "super_admin",
          status: "active"
        }
      ]]);

    const response = await request(app)
      .put("/api/users/99/password")
      .send({ newPassword: "NewStrongPassword123!" });

    expect(response.status).toBe(403);
    expect(response.body.message)
      .toBe("Administrators cannot reset a Super Admin password.");
  });

  test("PUT /api/users/:id/password resets password and writes audit record", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[
        {
          id: 2,
          full_name: "Test Captain",
          email: "captain@example.com",
          role: "captain",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);

    const response = await request(app)
      .put("/api/users/2/password")
      .send({ newPassword: "NewStrongPassword123!" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "User password reset successfully.",
      user: {
        id: 2,
        fullName: "Test Captain",
        email: "captain@example.com",
        role: "captain",
        status: "active"
      }
    });

    expect(pool.execute).toHaveBeenCalledTimes(4);
  });

  test("PUT /api/users/:id/password returns 500 when reset fails", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockRejectedValueOnce(new Error("database failure"));

    const response = await request(app)
      .put("/api/users/2/password")
      .send({ newPassword: "NewStrongPassword123!" });

    expect(response.status).toBe(500);
    expect(response.body.message)
      .toBe("Unable to reset user password.");
  });

  test.each(["bad", "0", "-1"])(
    "DELETE /api/users/:id rejects invalid ID %s",
    async id => {
      const response = await request(app)
        .delete(`/api/users/${id}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid user ID.");
    }
  );

  test("DELETE /api/users/:id prevents self deletion", async () => {
    const response = await request(app)
      .delete("/api/users/1");

    expect(response.status).toBe(403);
    expect(response.body.message)
      .toBe("You cannot delete your own account.");
  });

  test("DELETE /api/users/:id returns 404 for an unknown user", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[]]);

    const response = await request(app)
      .delete("/api/users/999");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found.");
  });

  test("DELETE /api/users/:id rejects an already deleted user", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[
        {
          id: 2,
          full_name: "Deleted User",
          email: "deleted@example.com",
          role: "captain",
          status: "deleted"
        }
      ]]);

    const response = await request(app)
      .delete("/api/users/2");

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("User is already deleted.");
  });

  test("DELETE /api/users/:id soft-deletes a user and writes audit record", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[
        {
          id: 2,
          full_name: "Test Captain",
          email: "captain@example.com",
          role: "captain",
          status: "active"
        }
      ]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);

    const response = await request(app)
      .delete("/api/users/2");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "User deleted successfully.",
      user: {
        id: 2,
        fullName: "Test Captain",
        email: "captain@example.com",
        role: "captain",
        status: "deleted"
      }
    });

    expect(pool.execute).toHaveBeenCalledTimes(4);
  });

  test("DELETE /api/users/:id returns 500 when deletion fails", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 1,
          full_name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
          status: "active"
        }
      ]])
      .mockRejectedValueOnce(new Error("database failure"));

    const response = await request(app)
      .delete("/api/users/2");

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Unable to delete user.");
  });

});
