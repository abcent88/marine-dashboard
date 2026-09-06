const $ = (id) => document.getElementById(id);

const API_BASE = "";

let capacityChart;
let sustainChart;

/*
 * Live dashboard state.
 *
 * We start with the existing mock data so the dashboard
 * can still render if the API is temporarily unavailable.
 */
const LIVE = {
  summary: null,
  vessels: []
};


function startLiveRefresh(){
  setInterval(() => {
    loadDashboardSummary();
    loadVessels();
    loadVoyages();
    loadFuel();
    loadMaintenance();
    loadAlerts();
    loadCrew();
    loadCatch();
    loadReports();
    loadUsers();
  }, 30000);
}

async function init(){
  /*
   * Server-side authentication guard.
   * The dashboard must verify the active session
   * before rendering protected dashboard data.
   */
  try {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
      headers: {
        "Accept": "application/json"
      }
    });

    if(!response.ok){
      window.location.href = "./login.html";
      return;
    }

    const result = await response.json();

    if(!result.success || !result.data){
      window.location.href = "./login.html";
      return;
    }

    /*
     * Keep the current user available to existing
     * frontend code while server session remains
     * the authentication authority.
     */
    localStorage.setItem(
      "marine_session",
      JSON.stringify({
        user: result.data,
        createdAt: Date.now()
      })
    );
  } catch(error) {
    console.error(
      "Authentication check failed:",
      error
    );

    window.location.href = "./login.html";
    return;
  }

  /*
   * Render existing interface first.
   * This guarantees the UI appears immediately.
   */
  setHeader();
  setShips();
  setBothShips();
  setAI();
  setCapture("mackerel");
  setCaptains();
  setRadar();
  wireCaptureTabs();

  /*
   * Logout
   */
  const logoutBtn =
    document.getElementById("logoutBtn");

  if(logoutBtn){
    logoutBtn.addEventListener("click", async () => {
      logoutBtn.disabled = true;

      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          headers: {
            "Accept": "application/json"
          }
        });

        if(!response.ok){
          throw new Error("Logout request failed.");
        }

        localStorage.removeItem(
          "marine_session"
        );

        window.location.href =
          "./login.html";
      } catch(error) {
        console.error(
          "Logout error:",
          error
        );

        logoutBtn.disabled = false;

        alert(
          "Unable to log out. Please try again."
        );
      }
    });
  }

  /*
   * Load real vessel records from MariaDB.
   */
  await loadVessels();

  /*
   * Enable vessel management controls.
   */
  initVesselManagement();

  /*
   * Replace mock fleet/operations figures
   * with the real database-backed API data.
   */
  await loadDashboardSummary();

  /*
   * Load real voyage records from MariaDB.
   */
  await loadVoyages();

  /*
   * Load real fuel consumption records from MariaDB.
   */
  await loadFuel();

  /*
   * Load real maintenance records from MariaDB.
   */
  await loadMaintenance();

  /*
   * Load real alerts and notifications from MariaDB.
   */
  await loadAlerts();

  /*
   * Load real crew records from MariaDB.
   */
  await loadCrew();

  /*
   * Load real catch and production records from MariaDB.
   */
  await loadCatch();

  /*
   * Load live user management data.
   * The module remains hidden for unauthorized roles.
   */
  await loadUsers();
  initUserManagement();
  initEditUserManagement();

  /*
   * Refresh live data every 30 seconds.
   */
  loadReports();
  startLiveRefresh();
}

init();
