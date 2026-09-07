/* global setHeader, setShips, setBothShips, setCapture, setRadar */
async function loadDashboardSummary(){
  try {
    const response = await fetch(`${API_BASE}/api/dashboard/summary`, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if(!response.ok){
      throw new Error(`API returned HTTP ${response.status}`);
    }

    const result = await response.json();

    if(!result.success || !result.data){
      throw new Error("Invalid dashboard API response");
    }

    LIVE.summary = result.data;

    console.log("Live dashboard data loaded:", LIVE.summary);

    applyLiveSummary();

    const update = document.getElementById("lastUpdate");
    if(update){
      update.textContent = `Updated ${nowTime()}`;
    }

    return true;

  } catch(error) {
    console.error("Unable to load live dashboard data:", error);

    const update = document.getElementById("lastUpdate");
    if(update){
      update.textContent = "Live data unavailable";
    }

    return false;
  }
}

/*
 * Apply live API data to the existing dashboard.
 */
function applyLiveSummary(){
  if(!LIVE.summary) return;

  setHeader();
  setShips();
  setBothShips();

  /*
   * Operations and capture card.
   *
   * setCapture() uses only the live dashboard summary,
   * including todayMetric and todaySpeciesBreakdown.
   */
  setCapture();
  setRadar();

}

