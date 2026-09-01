const DEMO = { email: "admin@marine.io", password: "admin123" };

function setSession(user){
  localStorage.setItem("marine_session", JSON.stringify({
    user,
    createdAt: Date.now()
  }));
}

function goDashboard(){
  window.location.href = "./index.html";
}

document.getElementById("loginBtn").addEventListener("click", () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const err = document.getElementById("err");

  const ok = (email === DEMO.email && password === DEMO.password);

  if(!ok){
    err.style.display = "block";
    return;
  }

  err.style.display = "none";
  setSession({ email, role: "admin" });
  goDashboard();
});

document.getElementById("demoBtn").addEventListener("click", () => {
  setSession({ email: DEMO.email, role: "admin" });
  goDashboard();
});