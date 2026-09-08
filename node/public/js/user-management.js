let LIVE_USERS = [];

function currentDashboardUser(){
  try {
    const raw = localStorage.getItem("marine_session");

    if(!raw){
      return null;
    }

    const session = JSON.parse(raw);

    return session?.user || null;
  } catch(error) {
    console.error("Unable to read current dashboard user:", error);
    return null;
  }
}

function canManageUsers(){
  const user = currentDashboardUser();

  return Boolean(
    user &&
    ["super_admin", "admin"].includes(user.role)
  );
}

function formatUserDate(value){
  if(!value){
    return "Never";
  }

  const date = new Date(value);

  if(Number.isNaN(date.getTime())){
    return "—";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function userRoleLabel(role){
  const labels = {
    super_admin: "Super Admin",
    admin: "Admin",
    manager: "Manager",
    captain: "Captain",
    crew: "Crew",
    operator: "Operator",
    viewer: "Viewer"
  };

  return labels[role] || role || "Unknown";
}

function userStatusClass(status){
  if(status === "inactive"){
    return "inactive";
  }

  if(status === "suspended"){
    return "suspended";
  }

  if(status === "deleted"){
    return "deleted";
  }

  return "";
}

const USER_ROLES = [
  "super_admin",
  "admin",
  "manager",
  "captain",
  "crew",
  "operator",
  "viewer"
];

const USER_STATUSES = [
  "active",
  "inactive",
  "suspended"
];

function renderUsers(){
  const body = document.getElementById("usersBody");

  if(!body){
    return;
  }

  if(!LIVE_USERS.length){
    body.innerHTML = `
      <tr>
        <td colspan="7" class="muted user-management-empty">
          No users found.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML = LIVE_USERS.map(user => `
    <tr>
      <td>
        <strong>${escapeHtml(user.fullName)}</strong>
      </td>

      <td>
        ${escapeHtml(user.email)}
      </td>

      <td>
        <span class="user-role-badge">
          ${escapeHtml(userRoleLabel(user.role))}
        </span>
      </td>

      <td>
        <span class="user-status-badge ${escapeHtml(userStatusClass(user.status))}">
          ${escapeHtml(user.status || "unknown")}
        </span>
      </td>

      <td>
        ${escapeHtml(formatUserDate(user.lastLoginAt))}
      </td>

      <td>
        ${escapeHtml(formatUserDate(user.createdAt))}
      </td>

      <td>
        <button
          type="button"
          class="user-management-action-btn"
          data-user-manage-id="${Number(user.id)}"
          title="Manage this user"
        >
          Manage
        </button>
      </td>
    </tr>
  `).join("");
}

function applyUserSummary(){
  const total = LIVE_USERS.length;

  const active = LIVE_USERS.filter(
    user => user.status === "active"
  ).length;

  const inactive = LIVE_USERS.filter(
    user => user.status === "inactive"
  ).length;

  const suspended = LIVE_USERS.filter(
    user => user.status === "suspended"
  ).length;

  const totalElement = document.getElementById("usersTotal");
  const activeElement = document.getElementById("usersActive");
  const inactiveElement = document.getElementById("usersInactive");
  const suspendedElement = document.getElementById("usersSuspended");

  if(totalElement){
    totalElement.textContent = total;
  }

  if(activeElement){
    activeElement.textContent = active;
  }

  if(inactiveElement){
    inactiveElement.textContent = inactive;
  }

  if(suspendedElement){
    suspendedElement.textContent = suspended;
  }
}

function applyUserManagementVisibility(){
  const section = document.querySelector(
    ".user-management-operations"
  );

  if(!section){
    return;
  }

  if(!canManageUsers()){
    section.style.display = "none";
  } else {
    section.style.display = "";
  }
}

async function loadUsers(){
  const section = document.querySelector(
    ".user-management-operations"
  );

  if(!section){
    return false;
  }

  applyUserManagementVisibility();

  if(!canManageUsers()){
    return false;
  }

  const body = document.getElementById("usersBody");
  const badge = document.getElementById("usersLiveBadge");

  try {
    if(badge){
      badge.textContent = "Loading";
    }

    const response = await fetch(
      `${API_BASE}/api/users`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if(response.status === 401){
      window.location.href = "./login.html";
      return false;
    }

    if(response.status === 403){
      section.style.display = "none";
      return false;
    }

    if(!response.ok){
      throw new Error(
        `Users API returned HTTP ${response.status}`
      );
    }

    const result = await response.json();

    if(!result.success || !Array.isArray(result.data)){
      throw new Error("Invalid users API response");
    }

    LIVE_USERS = result.data;

    applyUserSummary();
    renderUsers();

    if(badge){
      badge.textContent = "Live";
    }

    console.log("Live user data loaded:", LIVE_USERS);

    return true;
  } catch(error) {
    console.error("Unable to load live user data:", error);

    if(badge){
      badge.textContent = "Error";
    }

    if(body){
      body.innerHTML = `
        <tr>
          <td colspan="7" class="muted user-management-empty">
            Unable to load users. Please try again.
          </td>
        </tr>
      `;
    }

    return false;
  }
}
