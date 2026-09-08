const {
  ALLOWED_ROLES,
  ALLOWED_STATUSES,
  validateUserId,
  normalizeUserCreateInput,
  normalizeUserUpdateInput,
  validateUserCreateInput,
  validateUserUpdateInput,
  serializeUser
} = require("../user-helpers");

describe("User helpers", () => {
  test("exports supported roles and statuses", () => {
    expect(ALLOWED_ROLES).toContain("super_admin");
    expect(ALLOWED_STATUSES).toEqual(["active", "inactive", "suspended"]);
  });

  test("validates user IDs", () => {
    expect(validateUserId("12")).toBe(12);
    expect(validateUserId("0")).toBeNull();
    expect(validateUserId("-1")).toBeNull();
    expect(validateUserId("abc")).toBeNull();
    expect(validateUserId("1.5")).toBeNull();
  });

  test("normalizes create input", () => {
    expect(normalizeUserCreateInput({
      fullName: "  Test User  ",
      email: " TEST@EXAMPLE.COM ",
      password: "password123",
      role: " admin "
    })).toEqual({
      fullName: "Test User",
      email: "test@example.com",
      password: "password123",
      role: "admin"
    });
  });

  test("normalizes update input", () => {
    expect(normalizeUserUpdateInput({
      fullName: "  Test User  ",
      email: " TEST@EXAMPLE.COM ",
      role: " admin ",
      status: " active "
    })).toEqual({
      fullName: "Test User",
      email: "test@example.com",
      role: "admin",
      status: "active"
    });
  });

  test("validates valid create input", () => {
    expect(validateUserCreateInput({
      fullName: "Test User",
      email: "test@example.com",
      password: "password123",
      role: "admin"
    })).toBeNull();
  });

  test("rejects invalid create input", () => {
    expect(validateUserCreateInput({})).toBe("Full name, email, password, and role are required.");
    expect(validateUserCreateInput({
      fullName: "A".repeat(151),
      email: "test@example.com",
      password: "password123",
      role: "admin"
    })).toBe("Full name must not exceed 150 characters.");
    expect(validateUserCreateInput({
      fullName: "Test",
      email: "invalid",
      password: "password123",
      role: "admin"
    })).toBe("Please provide a valid email address.");
    expect(validateUserCreateInput({
      fullName: "Test",
      email: "test@example.com",
      password: "short",
      role: "admin"
    })).toBe("Password must be at least 8 characters.");
    expect(validateUserCreateInput({
      fullName: "Test",
      email: "test@example.com",
      password: "password123",
      role: "invalid"
    })).toBe("Invalid user role.");
  });

  test("validates valid update input", () => {
    expect(validateUserUpdateInput({
      fullName: "Test User",
      email: "test@example.com",
      role: "admin",
      status: "active"
    })).toBeNull();
  });

  test("rejects invalid update input", () => {
    expect(validateUserUpdateInput({})).toBe("Full name, email, role, and status are required.");
    expect(validateUserUpdateInput({
      fullName: "A".repeat(151),
      email: "test@example.com",
      role: "admin",
      status: "active"
    })).toBe("Full name must not exceed 150 characters.");
    expect(validateUserUpdateInput({
      fullName: "Test",
      email: "invalid",
      role: "admin",
      status: "active"
    })).toBe("Please provide a valid email address.");
    expect(validateUserUpdateInput({
      fullName: "Test",
      email: "test@example.com",
      role: "invalid",
      status: "active"
    })).toBe("Invalid user role.");
    expect(validateUserUpdateInput({
      fullName: "Test",
      email: "test@example.com",
      role: "admin",
      status: "deleted"
    })).toBe("Invalid user status.");
  });

  test("serializes a database user", () => {
    expect(serializeUser({
      id: "7",
      full_name: "Test User",
      email: "test@example.com",
      role: "admin",
      status: "active",
      last_login_at: "2026-09-08T10:00:00.000Z",
      created_at: "2026-09-01T10:00:00.000Z",
      updated_at: "2026-09-08T10:00:00.000Z"
    })).toEqual({
      id: 7,
      fullName: "Test User",
      email: "test@example.com",
      role: "admin",
      status: "active",
      lastLoginAt: "2026-09-08T10:00:00.000Z",
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: "2026-09-08T10:00:00.000Z"
    });
  });
});
