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


  const userManagementContext = {
    idInput,
    currentUser,
    getEditingUser: () => editingUser,
    closeModal,
    loadUsers
  };

  initUserPasswordReset(userManagementContext);
  initUserDelete(userManagementContext);

}
