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
