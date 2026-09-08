function initUserDelete(context){
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

      if(!context.getEditingUser()){
        showDeleteUserMessage(
          "Please select a user before deleting the account."
        );
        return;
      }

      const userId = Number(context.idInput.value);
      const currentUserId = Number(context.currentUser?.id);
      const currentUserRole = context.currentUser?.role;

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
        context.getEditingUser().role === "super_admin"
      ){
        showDeleteUserMessage(
          "Administrators cannot delete a Super Admin."
        );
        return;
      }

      if(context.getEditingUser().status === "deleted"){
        showDeleteUserMessage(
          "This user is already deleted."
        );
        return;
      }

      const confirmed = window.confirm(
        `Delete user "${context.getEditingUser().fullName}" (${context.getEditingUser().email})?\n\n` +
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

        await context.loadUsers();

        setTimeout(() => {
          context.closeModal();
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
