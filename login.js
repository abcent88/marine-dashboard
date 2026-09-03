function setSession(user){
  localStorage.setItem("marine_session", JSON.stringify({
    user,
    createdAt: Date.now()
  }));
}

function goDashboard(){
  window.location.href = "./index.html";
}

async function login(){
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const err = document.getElementById("err");
  const loginBtn = document.getElementById("loginBtn");

  err.style.display = "none";

  if(!email || !password){
    err.textContent = "Please enter your email and password.";
    err.style.display = "block";
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in...";

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const result = await response.json();

    if(!response.ok || !result.success){
      err.textContent =
        result.message || "Unable to sign in.";
      err.style.display = "block";
      return;
    }

    setSession(result.data);
    goDashboard();
  } catch(error) {
    console.error("Login error:", error);

    err.textContent =
      "Unable to connect to the authentication service.";
    err.style.display = "block";
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign In";
  }
}

document.getElementById("loginBtn").addEventListener(
  "click",
  login
);

document.getElementById("password").addEventListener(
  "keydown",
  event => {
    if(event.key === "Enter"){
      login();
    }
  }
);
