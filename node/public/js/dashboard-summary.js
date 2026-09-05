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
      update.textContent = "Using fallback data";
    }

    return false;
  }
}

/*
 * Apply live API data to the existing dashboard.
 */
function applyLiveSummary(){
  if(!LIVE.summary) return;

  const s = LIVE.summary;

  /*
   * Fleet
   */
  if(s.vessels){
    const vessels = s.vessels;

    $("activeShips").textContent = vessels.active;
    $("activeShipsSub").textContent =
      `${vessels.active} / ${vessels.total}`;

    $("totalCapacity").textContent =
      Number(vessels.totalCapacityTons).toLocaleString();

    $("statPracticable").textContent =
      vessels.active;

    $("statRestricted").textContent =
      vessels.restricted;

    $("statOut").textContent =
      vessels.outOfService;

    /*
     * The capacity gauge currently represents fleet capacity.
     * Until vessel utilization telemetry is connected, we use
     * active-vessel capacity as the operational indicator.
     */
    const operationalPct = pct(
      vessels.active,
      vessels.total
    );

    $("capacityPct").textContent = `${operationalPct}%`;
    $("capacityTons").textContent =
      `${Number(vessels.totalCapacityTons).toLocaleString()} t`;

    if(capacityChart){
      capacityChart.destroy();
    }

    capacityChart = makeDoughnut(
      "capacityGauge",
      vessels.active,
      vessels.total,
      78
    );
  }

  /*
   * Operations
   */
  if(s.operations){
    const operations = s.operations;

    /*
     * Database stores capture in kilograms.
     * Existing UI displays pounds.
     */
    const captureKg = Number(operations.captureKg || 0);
    const captureLb = Math.round(captureKg * 2.2046226218);

    $("captureNow").textContent =
      captureLb.toLocaleString();

    /*
     * The existing mock target remains temporarily until
     * daily_metrics is exposed by the API.
     */
    const targetLb = Number(
      window.MOCK?.capture?.targetLb || 30000
    );

    $("captureTarget").textContent =
      targetLb.toLocaleString();

    const capturePct = Math.min(
      100,
      (captureLb / targetLb) * 100
    );

    $("captureBar").style.width =
      `${capturePct}%`;

    /*
     * Display the live alert count.
     */
    const alertsBadge = $("alertsBadge");

    if(alertsBadge){
      alertsBadge.textContent =
        `Alerts ${operations.openAlerts}`;
    }

    /*
     * Store live operational values for console/debugging
     * and future dashboard cards.
     */
    LIVE.captureKg = captureKg;
    LIVE.captureLb = captureLb;
    LIVE.fuelConsumedLiters =
      Number(operations.fuelConsumedLiters || 0);
    LIVE.openAlerts =
      Number(operations.openAlerts || 0);
  }
}

