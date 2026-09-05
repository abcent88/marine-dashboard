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


function initEditUserManagement(){
  const modal = document.getElementById("editUserModal");
  const closeButton = document.getElementById("closeEditUserModal");
  const cancelButton = document.getElementById("cancelEditUser");
  const form = document.getElementById("editUserForm");
  const message = document.getElementById("editUserMessage");
  const submitButton = document.getElementById("submitEditUser");

  const idInput = document.getElementById("editUserId");
  const nameInput = document.getElementById("editUserFullName");
  const emailInput = document.getElementById("editUserEmail");
  const roleSelect = document.getElementById("editUserRole");
  const statusSelect = document.getElementById("editUserStatus");
  const roleHelp = document.getElementById("editUserRoleHelp");

  if(
    !modal ||
    !form ||
    !idInput ||
    !nameInput ||
    !emailInput ||
    !roleSelect ||
    !statusSelect
  ){
    return;
  }

  if(!canManageUsers()){
    return;
  }

  const currentUser = currentDashboardUser();

  let editingUser = null;

  function showMessage(text, type = "error"){
    if(!message){
      return;
    }

    message.textContent = text;
    message.className = `user-form-message is-visible is-${type}`;
  }

  function clearMessage(){
    if(!message){
      return;
    }

    message.textContent = "";
    message.className = "user-form-message";
  }

  function updateRoleOptions(){
    const isSuperAdmin = currentUser?.role === "super_admin";

    const superAdminOption = roleSelect.querySelector(
      'option[value="super_admin"]'
    );

    if(superAdminOption){
      superAdminOption.disabled = !isSuperAdmin;
    }

    if(
      !isSuperAdmin &&
      roleSelect.value === "super_admin"
    ){
      roleSelect.value = editingUser?.role || "";
    }

    if(roleHelp){
      roleHelp.textContent = isSuperAdmin
        ? "Super Admin can assign any supported dashboard role."
        : "Admin can change roles except Super Admin.";
    }
  }

  function openModal(user){
    if(!user){
      return;
    }

    editingUser = user;

    clearMessage();

    idInput.value = String(user.id);
    nameInput.value = user.fullName || "";
    emailInput.value = user.email || "";
    roleSelect.value = user.role || "";
    statusSelect.value = user.status || "active";

    updateRoleOptions();

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    setTimeout(() => {
      nameInput.focus();
    }, 50);
  }

  function closeModal(){
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");

    clearMessage();

    form.reset();

    editingUser = null;

    if(submitButton){
      submitButton.disabled = false;
      submitButton.textContent = "Save Changes";
    }
  }

  function getUserById(userId){
    return LIVE_USERS.find(
      user => Number(user.id) === Number(userId)
    );
  }

  document.addEventListener("click", event => {
    const manageButton = event.target.closest(
      "[data-user-manage-id]"
    );

    if(!manageButton){
      return;
    }

    const userId = Number(
      manageButton.getAttribute("data-user-manage-id")
    );

    const user = getUserById(userId);

    if(!user){
      console.error("Unable to find user for management:", userId);
      return;
    }

    openModal(user);
  });

  if(closeButton){
    closeButton.addEventListener("click", closeModal);
  }

  if(cancelButton){
    cancelButton.addEventListener("click", closeModal);
  }

  modal.addEventListener("click", event => {
    if(event.target === modal){
      closeModal();
    }
  });

  document.addEventListener("keydown", event => {
    if(
      event.key === "Escape" &&
      modal.classList.contains("is-open")
    ){
      closeModal();
    }
  });

  updateRoleOptions();

  form.addEventListener("submit", async event => {
    event.preventDefault();

    clearMessage();

    const userId = Number(idInput.value);

    const fullName = String(
      nameInput.value || ""
    ).trim();

    const email = String(
      emailInput.value || ""
    ).trim().toLowerCase();

    const role = String(
      roleSelect.value || ""
    ).trim();

    const status = String(
      statusSelect.value || ""
    ).trim();

    if(!Number.isInteger(userId) || userId <= 0){
      showMessage("Invalid user selected.");
      return;
    }

    if(!fullName){
      showMessage("Please enter the user's full name.");
      nameInput.focus();
      return;
    }

    if(fullName.length > 150){
      showMessage("Full name must not exceed 150 characters.");
      nameInput.focus();
      return;
    }

    if(!email || !email.includes("@") || email.length > 255){
      showMessage("Please enter a valid email address.");
      emailInput.focus();
      return;
    }

    const allowedRoles = USER_ROLES;

    if(!allowedRoles.includes(role)){
      showMessage("Please select a valid user role.");
      roleSelect.focus();
      return;
    }

    const allowedStatuses = USER_STATUSES;

    if(!allowedStatuses.includes(status)){
      showMessage("Please select a valid account status.");
      statusSelect.focus();
      return;
    }

    if(
      role === "super_admin" &&
      currentUser?.role !== "super_admin"
    ){
      showMessage(
        "Only a Super Admin can assign the Super Admin role."
      );
      roleSelect.focus();
      return;
    }

    if(
      editingUser &&
      Number(editingUser.id) === Number(currentUser?.id)
    ){
      if(role !== editingUser.role){
        showMessage(
          "You cannot change your own role while signed in."
        );
        roleSelect.focus();
        return;
      }

      if(status !== editingUser.status){
        showMessage(
          "You cannot change your own account status while signed in."
        );
        statusSelect.focus();
        return;
      }
    }

    if(submitButton){
      submitButton.disabled = true;
      submitButton.textContent = "Saving...";
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/users/${encodeURIComponent(userId)}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fullName,
            email,
            role,
            status
          })
        }
      );

      let result = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if(response.status === 401){
        window.location.href = "./login.html";
        return;
      }

      if(response.status === 403){
        showMessage(
          result?.message ||
          "You do not have permission to edit this user."
        );
        return;
      }

      if(response.status === 404){
        showMessage(
          result?.message ||
          "User not found."
        );
        return;
      }

      if(response.status === 409){
        showMessage(
          result?.message ||
          "A user with that email already exists."
        );
        emailInput.focus();
        return;
      }

      if(!response.ok || !result?.success){
        throw new Error(
          result?.message ||
          `Unable to update user. HTTP ${response.status}`
        );
      }

      showMessage(
        result.message || "User updated successfully.",
        "success"
      );

      await loadUsers();

      setTimeout(() => {
        closeModal();
      }, 900);

    } catch(error) {
      console.error("Unable to update user:", error);

      showMessage(
        error.message ||
        "Unable to update user. Please try again."
      );
    } finally {
      if(submitButton){
        submitButton.disabled = false;
        submitButton.textContent = "Save Changes";
      }
    }
  });

  const resetPasswordButton = document.getElementById("resetUserPasswordBtn");
  const resetPasswordInput = document.getElementById("resetUserPassword");
  const resetPasswordConfirmInput = document.getElementById("resetUserPasswordConfirm");
  const resetPasswordMessage = document.getElementById("resetUserPasswordMessage");

  function showResetPasswordMessage(text, type = "error"){
    if(!resetPasswordMessage){
      return;
    }

    resetPasswordMessage.textContent = text;
    resetPasswordMessage.className =
      `user-form-message is-visible is-${type}`;
  }

  function clearResetPasswordMessage(){
    if(!resetPasswordMessage){
      return;
    }

    resetPasswordMessage.textContent = "";
    resetPasswordMessage.className = "user-form-message";
  }

  if(resetPasswordButton){
    resetPasswordButton.addEventListener("click", async () => {
      clearResetPasswordMessage();

      const userId = Number(idInput.value);

      const newPassword = String(
        resetPasswordInput?.value || ""
      );

      const confirmPassword = String(
        resetPasswordConfirmInput?.value || ""
      );

      if(!editingUser){
        showResetPasswordMessage(
          "Please select a user before resetting the password."
        );
        return;
      }

      if(!Number.isInteger(userId) || userId <= 0){
        showResetPasswordMessage("Invalid user selected.");
        return;
      }

      if(newPassword.length < 8){
        showResetPasswordMessage(
          "New password must be at least 8 characters."
        );
        resetPasswordInput?.focus();
        return;
      }

      if(newPassword !== confirmPassword){
        showResetPasswordMessage(
          "The new passwords do not match."
        );
        resetPasswordConfirmInput?.focus();
        return;
      }

      if(
        currentUser?.role === "admin" &&
        editingUser.role === "super_admin"
      ){
        showResetPasswordMessage(
          "Administrators cannot reset a Super Admin password."
        );
        return;
      }

      resetPasswordButton.disabled = true;
      resetPasswordButton.textContent = "Resetting...";

      try {
        const response = await fetch(
          `${API_BASE}/api/users/${encodeURIComponent(userId)}/password`,
          {
            method: "PUT",
            credentials: "include",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              newPassword
            })
          }
        );

        let result = null;

        try {
          result = await response.json();
        } catch {
          result = null;
        }

        if(response.status === 401){
          window.location.href = "./login.html";
          return;
        }

        if(response.status === 403){
          showResetPasswordMessage(
            result?.message ||
            "You do not have permission to reset this password."
          );
          return;
        }

        if(response.status === 404){
          showResetPasswordMessage(
            result?.message ||
            "User not found."
          );
          return;
        }

        if(!response.ok || !result?.success){
          throw new Error(
            result?.message ||
            `Unable to reset password. HTTP ${response.status}`
          );
        }

        showResetPasswordMessage(
          result.message ||
          "User password reset successfully.",
          "success"
        );

        if(resetPasswordInput){
          resetPasswordInput.value = "";
        }

        if(resetPasswordConfirmInput){
          resetPasswordConfirmInput.value = "";
        }

      } catch(error) {
        console.error("Unable to reset user password:", error);

        showResetPasswordMessage(
          error.message ||
          "Unable to reset password. Please try again."
        );
      } finally {
        resetPasswordButton.disabled = false;
        resetPasswordButton.textContent = "Reset Password";
      }
    });
  }

  const deleteUserButton = document.getElementById("deleteUserBtn");
  const deleteUserMessage = document.getElementById("deleteUserMessage");

  function showDeleteUserMessage(text, type = "error"){
    if(!deleteUserMessage){
      return;
    }

    deleteUserMessage.textContent = text;
    deleteUserMessage.className =
      `user-form-message is-visible is-${type}`;
  }

  function clearDeleteUserMessage(){
    if(!deleteUserMessage){
      return;
    }

    deleteUserMessage.textContent = "";
    deleteUserMessage.className = "user-form-message";
  }

  if(deleteUserButton){
    deleteUserButton.addEventListener("click", async () => {
      clearDeleteUserMessage();

      if(!editingUser){
        showDeleteUserMessage(
          "Please select a user before deleting the account."
        );
        return;
      }

      const userId = Number(idInput.value);
      const currentUserId = Number(currentUser?.id);
      const currentUserRole = currentUser?.role;

      if(!Number.isInteger(userId) || userId <= 0){
        showDeleteUserMessage("Invalid user selected.");
        return;
      }

      if(userId === currentUserId){
        showDeleteUserMessage(
          "You cannot delete your own account."
        );
        return;
      }

      if(
        currentUserRole === "admin" &&
        editingUser.role === "super_admin"
      ){
        showDeleteUserMessage(
          "Administrators cannot delete a Super Admin."
        );
        return;
      }

      if(editingUser.status === "deleted"){
        showDeleteUserMessage(
          "This user is already deleted."
        );
        return;
      }

      const confirmed = window.confirm(
        `Delete user "${editingUser.fullName}" (${editingUser.email})?\n\n` +
        "This is a soft delete. The user record and historical audit " +
        "information will be retained, but the account will be marked as deleted " +
        "and should no longer be allowed to access the dashboard.\n\n" +
        "Click OK to continue or Cancel to keep the account."
      );

      if(!confirmed){
        return;
      }

      deleteUserButton.disabled = true;
      deleteUserButton.textContent = "Deleting...";

      try {
        const response = await fetch(
          `${API_BASE}/api/users/${encodeURIComponent(userId)}`,
          {
            method: "DELETE",
            credentials: "include",
            headers: {
              "Accept": "application/json"
            }
          }
        );

        let result = null;

        try {
          result = await response.json();
        } catch {
          result = null;
        }

        if(response.status === 401){
          window.location.href = "./login.html";
          return;
        }

        if(response.status === 403){
          showDeleteUserMessage(
            result?.message ||
            "You do not have permission to delete this user."
          );
          return;
        }

        if(response.status === 404){
          showDeleteUserMessage(
            result?.message ||
            "User not found."
          );
          return;
        }

        if(response.status === 409){
          showDeleteUserMessage(
            result?.message ||
            "This user is already deleted."
          );
          return;
        }

        if(!response.ok || !result?.success){
          throw new Error(
            result?.message ||
            `Unable to delete user. HTTP ${response.status}`
          );
        }

        showDeleteUserMessage(
          result.message ||
          "User deleted successfully.",
          "success"
        );

        await loadUsers();

        setTimeout(() => {
          closeModal();
        }, 900);

      } catch(error) {
        console.error("Unable to delete user:", error);

        showDeleteUserMessage(
          error.message ||
          "Unable to delete user. Please try again."
        );
      } finally {
        deleteUserButton.disabled = false;
        deleteUserButton.textContent = "Delete User";
      }
    });
  }
}

function initUserManagement(){
  const addButton = document.getElementById("addUserBtn");
  const modal = document.getElementById("addUserModal");
  const closeButton = document.getElementById("closeAddUserModal");
  const cancelButton = document.getElementById("cancelAddUser");
  const form = document.getElementById("addUserForm");
  const message = document.getElementById("addUserMessage");
  const submitButton = document.getElementById("submitAddUser");
  const roleSelect = document.getElementById("addUserRole");
  const roleHelp = document.getElementById("addUserRoleHelp");

  if(!addButton || !modal || !form){
    return;
  }

  if(!canManageUsers()){
    addButton.style.display = "none";
    return;
  }

  const currentUser = currentDashboardUser();

  function showMessage(text, type = "error"){
    if(!message){
      return;
    }

    message.textContent = text;
    message.className = `user-form-message is-visible is-${type}`;
  }

  function clearMessage(){
    if(!message){
      return;
    }

    message.textContent = "";
    message.className = "user-form-message";
  }

  function updateRoleOptions(){
    if(!roleSelect){
      return;
    }

    const superAdminOption = roleSelect.querySelector(
      'option[value="super_admin"]'
    );

    if(superAdminOption){
      const isSuperAdmin = currentUser?.role === "super_admin";

      superAdminOption.disabled = !isSuperAdmin;

      if(!isSuperAdmin && roleSelect.value === "super_admin"){
        roleSelect.value = "";
      }

      if(roleHelp){
        roleHelp.textContent = isSuperAdmin
          ? "Super Admin can create any supported dashboard role."
          : "Admin can create all supported roles except Super Admin.";
      }
    }
  }

  function openModal(){
    clearMessage();

    form.reset();
    updateRoleOptions();

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    const nameInput = document.getElementById("addUserFullName");

    if(nameInput){
      setTimeout(() => nameInput.focus(), 50);
    }
  }

  function closeModal(){
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    clearMessage();

    form.reset();
    updateRoleOptions();

    if(submitButton){
      submitButton.disabled = false;
      submitButton.textContent = "Create User";
    }
  }

  addButton.addEventListener("click", openModal);

  if(closeButton){
    closeButton.addEventListener("click", closeModal);
  }

  if(cancelButton){
    cancelButton.addEventListener("click", closeModal);
  }

  modal.addEventListener("click", event => {
    if(event.target === modal){
      closeModal();
    }
  });

  document.addEventListener("keydown", event => {
    if(event.key === "Escape" && modal.classList.contains("is-open")){
      closeModal();
    }
  });

  updateRoleOptions();

  form.addEventListener("submit", async event => {
    event.preventDefault();

    clearMessage();

    const fullName = String(
      document.getElementById("addUserFullName")?.value || ""
    ).trim();

    const email = String(
      document.getElementById("addUserEmail")?.value || ""
    ).trim().toLowerCase();

    const password = String(
      document.getElementById("addUserPassword")?.value || ""
    );

    const confirmPassword = String(
      document.getElementById("addUserConfirmPassword")?.value || ""
    );

    const role = String(
      document.getElementById("addUserRole")?.value || ""
    ).trim();

    if(!fullName){
      showMessage("Please enter the user's full name.");
      document.getElementById("addUserFullName")?.focus();
      return;
    }

    if(fullName.length > 150){
      showMessage("Full name must not exceed 150 characters.");
      return;
    }

    if(!email){
      showMessage("Please enter the user's email address.");
      document.getElementById("addUserEmail")?.focus();
      return;
    }

    if(!email.includes("@") || email.length > 255){
      showMessage("Please enter a valid email address.");
      document.getElementById("addUserEmail")?.focus();
      return;
    }

    if(password.length < 8){
      showMessage("Password must be at least 8 characters.");
      document.getElementById("addUserPassword")?.focus();
      return;
    }

    if(password !== confirmPassword){
      showMessage("Passwords do not match.");
      document.getElementById("addUserConfirmPassword")?.focus();
      return;
    }

    const allowedRoles = USER_ROLES;

    if(!allowedRoles.includes(role)){
      showMessage("Please select a valid user role.");
      document.getElementById("addUserRole")?.focus();
      return;
    }

    if(
      role === "super_admin" &&
      currentUser?.role !== "super_admin"
    ){
      showMessage(
        "Only a Super Admin can create a Super Admin account."
      );
      roleSelect?.focus();
      return;
    }

    if(submitButton){
      submitButton.disabled = true;
      submitButton.textContent = "Creating...";
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/users`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fullName,
            email,
            password,
            role
          })
        }
      );

      let result = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if(response.status === 401){
        window.location.href = "./login.html";
        return;
      }

      if(response.status === 403){
        showMessage(
          result?.message ||
          "You do not have permission to create users."
        );
        return;
      }

      if(response.status === 409){
        showMessage(
          result?.message ||
          "A user with that email already exists."
        );
        return;
      }

      if(!response.ok || !result?.success){
        throw new Error(
          result?.message ||
          `Unable to create user. HTTP ${response.status}`
        );
      }

      showMessage(
        result.message || "User created successfully.",
        "success"
      );

      await loadUsers();

      setTimeout(() => {
        closeModal();
      }, 900);

    } catch(error) {
      console.error("Unable to create user:", error);

      showMessage(
        error.message ||
        "Unable to create user. Please try again."
      );
    } finally {
      if(submitButton){
        submitButton.disabled = false;
        submitButton.textContent = "Create User";
      }
    }
  });
}
