const ALLOWED_ROLES = [
  "super_admin",
  "admin",
  "manager",
  "captain",
  "crew",
  "operator",
  "viewer"
];

const ALLOWED_STATUSES = [
  "active",
  "inactive",
  "suspended"
];

function validateUserId(value) {
  const userId = Number(value);

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return userId;
}

function normalizeUserCreateInput(body = {}) {
  return {
    fullName: String(body.fullName || "").trim(),
    email: String(body.email || "").trim().toLowerCase(),
    password: String(body.password || ""),
    role: String(body.role || "").trim()
  };
}

function normalizeUserUpdateInput(body = {}) {
  return {
    fullName: String(body.fullName || "").trim(),
    email: String(body.email || "").trim().toLowerCase(),
    role: String(body.role || "").trim(),
    status: String(body.status || "").trim()
  };
}

function validateUserCreateInput(input) {
  const { fullName, email, password, role } = input;

  if (!fullName || !email || !password || !role) {
    return "Full name, email, password, and role are required.";
  }

  if (fullName.length > 150) {
    return "Full name must not exceed 150 characters.";
  }

  if (email.length > 255 || !email.includes("@")) {
    return "Please provide a valid email address.";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return "Invalid user role.";
  }

  return null;
}

function validateUserUpdateInput(input) {
  const { fullName, email, role, status } = input;

  if (!fullName || !email || !role || !status) {
    return "Full name, email, role, and status are required.";
  }

  if (fullName.length > 150) {
    return "Full name must not exceed 150 characters.";
  }

  if (email.length > 255 || !email.includes("@")) {
    return "Please provide a valid email address.";
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return "Invalid user role.";
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    return "Invalid user status.";
  }

  return null;
}

function serializeUser(user) {
  return {
    id: Number(user.id),
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    status: user.status,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

module.exports = {
  ALLOWED_ROLES,
  ALLOWED_STATUSES,
  validateUserId,
  normalizeUserCreateInput,
  normalizeUserUpdateInput,
  validateUserCreateInput,
  validateUserUpdateInput,
  serializeUser
};
