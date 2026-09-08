function initUserPasswordReset(context){
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

      const userId = Number(context.idInput.value);

      const newPassword = String(
        resetPasswordInput?.value || ""
      );

      const confirmPassword = String(
        resetPasswordConfirmInput?.value || ""
      );

      if(!context.getEditingUser()){
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
        context.currentUser?.role === "admin" &&
        context.getEditingUser().role === "super_admin"
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

}
