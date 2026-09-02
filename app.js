const $ = (id) => document.getElementById(id);

const API_BASE = "http://127.0.0.1:3001";

function clamp(n, min, max){
  return Math.max(min, Math.min(max, n));
}

function nowTime(){
  const d = new Date();
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function moneyShort(n){
  const abs = Math.abs(n);

  if(abs >= 1e9) return `$${(n/1e9).toFixed(3)}B`;
  if(abs >= 1e6) return `$${(n/1e6).toFixed(3)}M`;
  if(abs >= 1e3) return `$${(n/1e3).toFixed(1)}K`;

  return `$${n.toFixed(0)}`;
}

function pct(a, b){
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

let capacityChart;
let sustainChart;

/*
 * Live dashboard state.
 *
 * We start with the existing mock data so the dashboard
 * can still render if the API is temporarily unavailable.
 */
/*
 * Safely escape database values before inserting them
 * into dynamically generated HTML.
 */
function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const LIVE = {
  summary: null,
  vessels: []
};


function formatVoyageDate(value){
  if(!value){
    return "—";
  }

  const date = new Date(value);

  if(Number.isNaN(date.getTime())){
    return "—";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function voyageStatusLabel(status){
  return String(status || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function voyageStatusClass(status){
  const value = String(status || "unknown");

  if(value === "in_progress"){
    return "in-progress";
  }

  if(value === "planned"){
    return "planned";
  }

  if(value === "completed"){
    return "completed";
  }

  if(value === "cancelled"){
    return "cancelled";
  }

  return "unknown";
}

function renderVoyages(voyages){
  const body = $("voyagesBody");

  if(!body){
    console.error("Voyages table body not found.");
    return;
  }

  if(!Array.isArray(voyages) || voyages.length === 0){
    body.innerHTML = `
      <tr>
        <td colspan="6" class="muted">
          No voyage records found.
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = voyages.map(voyage => {
    const voyageNumber =
      escapeHtml(voyage.voyageNumber || "—");

    const vesselName =
      escapeHtml(
        voyage.vessel && voyage.vessel.name
          ? voyage.vessel.name
          : "—"
      );

    const vesselCode =
      escapeHtml(
        voyage.vessel && voyage.vessel.code
          ? voyage.vessel.code
          : "—"
      );

    const departurePort =
      voyage.departurePort && voyage.departurePort.name
        ? escapeHtml(voyage.departurePort.name)
        : "—";

    const destinationPort =
      voyage.destinationPort && voyage.destinationPort.name
        ? escapeHtml(voyage.destinationPort.name)
        : "—";

    const status =
      String(voyage.status || "unknown");

    const statusLabel =
      escapeHtml(voyageStatusLabel(status));

    const statusClass =
      voyageStatusClass(status);

    const departureAt =
      escapeHtml(formatVoyageDate(voyage.departureAt));

    const expectedArrivalAt =
      escapeHtml(
        formatVoyageDate(voyage.expectedArrivalAt)
      );

    return `
      <tr>
        <td>
          <div class="voyage-number">
            ${voyageNumber}
          </div>
        </td>

        <td>
          <div class="voyage-vessel-name">
            ${vesselName}
          </div>
          <div class="voyage-vessel-code muted">
            ${vesselCode}
          </div>
        </td>

        <td>
          <div class="voyage-route">
            <span>${departurePort}</span>
            <span class="voyage-route-arrow">→</span>
            <span>${destinationPort}</span>
          </div>
        </td>

        <td>
          <span class="voyage-status ${statusClass}">
            <span class="voyage-status-dot"></span>
            ${statusLabel}
          </span>
        </td>

        <td>
          ${departureAt}
        </td>

        <td>
          ${expectedArrivalAt}
        </td>
      </tr>
    `;
  }).join("");
}

async function loadVoyages(){
  const body = $("voyagesBody");

  try {
    const response = await fetch(
      `${API_BASE}/api/voyages`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if(!response.ok){
      throw new Error(
        `Voyages API returned HTTP ${response.status}`
      );
    }

    const result = await response.json();

    if(!result.success || !Array.isArray(result.data)){
      throw new Error("Invalid voyages API response");
    }

    const voyages = result.data;

    const counts = {
      total: voyages.length,
      inProgress: 0,
      planned: 0,
      completed: 0,
      cancelled: 0
    };

    voyages.forEach(voyage => {
      switch(voyage.status){
        case "in_progress":
          counts.inProgress++;
          break;

        case "planned":
          counts.planned++;
          break;

        case "completed":
          counts.completed++;
          break;

        case "cancelled":
          counts.cancelled++;
          break;
      }
    });

    const total = $("voyagesTotal");
    const inProgress = $("voyagesInProgress");
    const planned = $("voyagesPlanned");
    const completed = $("voyagesCompleted");
    const cancelled = $("voyagesCancelled");

    if(total){
      total.textContent = counts.total;
    }

    if(inProgress){
      inProgress.textContent = counts.inProgress;
    }

    if(planned){
      planned.textContent = counts.planned;
    }

    if(completed){
      completed.textContent = counts.completed;
    }

    if(cancelled){
      cancelled.textContent = counts.cancelled;
    }

    renderVoyages(voyages);

    console.log(
      "Voyages loaded:",
      voyages
    );

  } catch(error) {
    console.error("Unable to load voyages:", error);

    if(body){
      body.innerHTML = `
        <tr>
          <td colspan="6" class="muted">
            Unable to load voyage data.
          </td>
        </tr>
      `;
    }
  }
}

async function loadVessels(){
  try {
    const response = await fetch(`${API_BASE}/api/vessels`, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if(!response.ok){
      throw new Error(`Vessels API returned HTTP ${response.status}`);
    }

    const result = await response.json();

    if(!result.success || !Array.isArray(result.data)){
      throw new Error("Invalid vessels API response");
    }

    LIVE.vessels = result.data;

    console.log("Live vessel data loaded:", LIVE.vessels);

    applyLiveVessels();

    return true;
  } catch(error) {
    console.error("Unable to load live vessel data:", error);
    return false;
  }
}


/*
 * Load and display one vessel's complete database record.
 */
async function loadVesselDetails(vesselId){
  const detailsContent = $("vesselDetailsContent");
  const detailsSubtitle = $("vesselDetailsSubtitle");
  const closeButton = $("closeVesselDetails");

  if(!detailsContent){
    console.error("Vessel Details content container not found.");
    return;
  }

  detailsContent.innerHTML = `
    <div class="vessel-details-loading muted">
      Loading vessel details...
    </div>
  `;

  if(closeButton){
    closeButton.hidden = false;
  }

  const detailsSection = $("vesselDetails");

  if(detailsSection){
    detailsSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/vessels/${encodeURIComponent(vesselId)}`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if(!response.ok){
      throw new Error(
        `Vessel API returned HTTP ${response.status}`
      );
    }

    const result = await response.json();

    if(!result.success || !result.data){
      throw new Error("Invalid vessel details API response");
    }

    const vessel = result.data;

    let position = null;

    try {
      const positionResponse = await fetch(
        `${API_BASE}/api/vessels/${encodeURIComponent(vesselId)}/position`,
        {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        }
      );

      if(positionResponse.ok){
        const positionResult = await positionResponse.json();

        if(positionResult.success && positionResult.data){
          position = positionResult.data;
        }
      }
    } catch(positionError) {
      console.warn(
        "Unable to load vessel position:",
        positionError
      );
    }

    const vesselName =
      escapeHtml(vessel.name || "Unnamed Vessel");

    const vesselCode =
      escapeHtml(vessel.vesselCode || "—");

    const vesselType =
      escapeHtml(vessel.vesselType || "—");

    const flagCountry =
      escapeHtml(vessel.flagCountry || "—");

    const imoNumber =
      escapeHtml(vessel.imoNumber || "—");

    const callSign =
      escapeHtml(vessel.callSign || "—");

    const capacity =
      Number(vessel.capacityTons || 0).toLocaleString();

    const status =
      String(vessel.status || "unknown");

    const statusLabel = status
      .replace(/_/g, " ")
      .replace(/\b\w/g, char => char.toUpperCase());

    const statusClass =
      status === "out_of_service"
        ? "out-of-service"
        : status;

    const homePort =
      vessel.homePort && vessel.homePort.name
        ? escapeHtml(vessel.homePort.name)
        : "—";

    const homePortCountry =
      vessel.homePort && vessel.homePort.country
        ? escapeHtml(vessel.homePort.country)
        : "—";

    const homePortCode =
      vessel.homePort && vessel.homePort.code
        ? escapeHtml(vessel.homePort.code)
        : "—";

    const commissionedDate =
      vessel.commissionedDate
        ? new Date(vessel.commissionedDate).toLocaleDateString(
            undefined,
            {
              year: "numeric",
              month: "long",
              day: "numeric"
            }
          )
        : "—";

    const latitude =
      position
        ? Number(position.latitude).toFixed(4)
        : "—";

    const longitude =
      position
        ? Number(position.longitude).toFixed(4)
        : "—";

    const speedKnots =
      position
        ? `${Number(position.speedKnots).toFixed(1)} kn`
        : "—";

    const headingDegrees =
      position
        ? `${Number(position.headingDegrees).toFixed(0)}°`
        : "—";

    const positionRecordedAt =
      position && position.recordedAt
        ? new Date(position.recordedAt).toLocaleString(
            undefined,
            {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            }
          )
        : "Position unavailable";

    if(detailsSubtitle){
      detailsSubtitle.textContent =
        `${vesselName} • ${vesselCode}`;
    }

    detailsContent.innerHTML = `
      <div class="vessel-profile">

        <div class="vessel-profile-header">
          <div>
            <div class="vessel-profile-name">
              ${vesselName}
            </div>

            <div class="muted small">
              ${vesselCode} • ${vesselType}
            </div>
          </div>

          <span class="fleet-status ${statusClass}">
            <span class="fleet-status-dot"></span>
            ${statusLabel}
          </span>
        </div>

        <div class="vessel-details-grid">

          <div class="vessel-detail-item">
            <span class="muted small">Vessel Code</span>
            <strong>${vesselCode}</strong>
          </div>

          <div class="vessel-detail-item">
            <span class="muted small">Vessel Type</span>
            <strong>${vesselType}</strong>
          </div>

          <div class="vessel-detail-item">
            <span class="muted small">Flag Country</span>
            <strong>${flagCountry}</strong>
          </div>

          <div class="vessel-detail-item">
            <span class="muted small">IMO Number</span>
            <strong>${imoNumber}</strong>
          </div>

          <div class="vessel-detail-item">
            <span class="muted small">Call Sign</span>
            <strong>${callSign}</strong>
          </div>

          <div class="vessel-detail-item">
            <span class="muted small">Capacity</span>
            <strong>${capacity} t</strong>
          </div>

          <div class="vessel-detail-item">
            <span class="muted small">Home Port</span>
            <strong>${homePort}</strong>
          </div>

          <div class="vessel-detail-item">
            <span class="muted small">Port Country</span>
            <strong>${homePortCountry}</strong>
          </div>

          <div class="vessel-detail-item">
            <span class="muted small">Port Code</span>
            <strong>${homePortCode}</strong>
          </div>

          <div class="vessel-detail-item">
            <span class="muted small">Commissioned</span>
            <strong>${escapeHtml(commissionedDate)}</strong>
          </div>

        </div>

        <div class="divider"></div>

        <div class="vessel-position-section">

          <div class="card-title">
            Current Position
          </div>

          <div class="muted small vessel-position-status">
            ${
              position
                ? "Latest recorded GPS position"
                : "No GPS position recorded for this vessel"
            }
          </div>

          <div class="vessel-details-grid vessel-position-grid">

            <div class="vessel-detail-item">
              <span class="muted small">Latitude</span>
              <strong>${escapeHtml(latitude)}</strong>
            </div>

            <div class="vessel-detail-item">
              <span class="muted small">Longitude</span>
              <strong>${escapeHtml(longitude)}</strong>
            </div>

            <div class="vessel-detail-item">
              <span class="muted small">Speed</span>
              <strong>${escapeHtml(speedKnots)}</strong>
            </div>

            <div class="vessel-detail-item">
              <span class="muted small">Heading</span>
              <strong>${escapeHtml(headingDegrees)}</strong>
            </div>

            <div class="vessel-detail-item">
              <span class="muted small">Last Position Update</span>
              <strong>${escapeHtml(positionRecordedAt)}</strong>
            </div>

          </div>

        </div>

      </div>
    `;

    console.log("Vessel details loaded:", vessel);

  } catch(error) {
    console.error("Unable to load vessel details:", error);

    detailsContent.innerHTML = `
      <div class="vessel-details-error">
        Unable to load vessel details.
      </div>
    `;
  }
}

/*
 * Connect the Vessel Details Close button.
 */
const closeVesselButton = $("closeVesselDetails");

if(closeVesselButton){
  closeVesselButton.addEventListener("click", closeVesselDetails);
}

/*
 * Close the Vessel Details panel and restore its
 * initial empty state.
 */
function closeVesselDetails(){
  const detailsContent = $("vesselDetailsContent");
  const detailsSubtitle = $("vesselDetailsSubtitle");
  const closeButton = $("closeVesselDetails");

  if(detailsSubtitle){
    detailsSubtitle.textContent =
      "Select a vessel from Fleet Operations";
  }

  if(detailsContent){
    detailsContent.innerHTML = `
      <div class="vessel-details-empty muted">
        Select a vessel from the Fleet Operations table to view
        its operational profile.
      </div>
    `;
  }

  if(closeButton){
    closeButton.hidden = true;
  }
}

/*
 * Attach click handlers to the live vessel rows.
 */
function bindVesselRowClicks(){
  const fleetBody = $("fleetVesselsBody");

  if(!fleetBody) return;

  const rows = fleetBody.querySelectorAll(
    "tr[data-vessel-id]"
  );

  rows.forEach(row => {
    const openDetails = () => {
      const vesselId = row.dataset.vesselId;

      if(vesselId){
        loadVesselDetails(vesselId);
      }
    };

    row.addEventListener("click", openDetails);

    row.addEventListener("keydown", event => {
      if(event.key === "Enter" || event.key === " "){
        event.preventDefault();
        openDetails();
      }
    });
  });
}

function applyLiveVessels(){
  if(!Array.isArray(LIVE.vessels)) return;

  const active = LIVE.vessels.filter(
    vessel => vessel.status === "active"
  ).length;

  const restricted = LIVE.vessels.filter(
    vessel => vessel.status === "restricted"
  ).length;

  const maintenance = LIVE.vessels.filter(
    vessel => vessel.status === "maintenance"
  ).length;

  const outOfService = LIVE.vessels.filter(
    vessel => vessel.status === "out_of_service"
  ).length;

  const total = LIVE.vessels.length;

  const totalCapacity = LIVE.vessels.reduce(
    (sum, vessel) =>
      sum + Number(vessel.capacityTons || 0),
    0
  );

  /*
   * Update the existing Active Ships card.
   */
  $("activeShips").textContent = active;
  $("activeShipsSub").textContent = `${active} / ${total}`;

  $("statPracticable").textContent = active;
  $("statRestricted").textContent = restricted;
  $("statOut").textContent = outOfService;

  $("totalCapacity").textContent =
    totalCapacity.toLocaleString();

  const activePct = pct(active, total);

  $("capacityPct").textContent = `${activePct}%`;

  $("capacityTons").textContent =
    `${totalCapacity.toLocaleString()} t`;

  if(capacityChart){
    capacityChart.destroy();
  }

  capacityChart = makeDoughnut(
    "capacityGauge",
    active,
    total,
    78
  );

  /*
   * Update Fleet Operations summary cards.
   */
  const fleetTotal = $("fleetTotalVessels");
  const fleetActive = $("fleetActiveVessels");
  const fleetRestricted = $("fleetRestrictedVessels");
  const fleetMaintenance = $("fleetMaintenanceVessels");
  const fleetOut = $("fleetOutVessels");
  const fleetCapacity = $("fleetTotalCapacity");

  if(fleetTotal) fleetTotal.textContent = total;
  if(fleetActive) fleetActive.textContent = active;
  if(fleetRestricted) fleetRestricted.textContent = restricted;
  if(fleetMaintenance) fleetMaintenance.textContent = maintenance;
  if(fleetOut) fleetOut.textContent = outOfService;

  if(fleetCapacity){
    fleetCapacity.textContent =
      `${totalCapacity.toLocaleString()} t`;
  }

  /*
   * Render real vessel records into Fleet Operations.
   */
  const fleetBody = $("fleetVesselsBody");

  if(fleetBody){
    if(LIVE.vessels.length === 0){
      fleetBody.innerHTML = `
        <tr>
          <td colspan="7" class="muted">
            No vessel records found.
          </td>
        </tr>
      `;
    } else {
      fleetBody.innerHTML = LIVE.vessels.map(vessel => {
        const status = String(vessel.status || "unknown");

        const statusLabel = status
          .replace(/_/g, " ")
          .replace(/\b\w/g, char => char.toUpperCase());

        const statusClass = status === "out_of_service"
          ? "out-of-service"
          : status;

        const vesselName =
          escapeHtml(vessel.name || "Unnamed Vessel");

        const vesselCode =
          escapeHtml(vessel.vesselCode || "—");

        const vesselType =
          escapeHtml(vessel.vesselType || "—");

        const flagCountry =
          escapeHtml(vessel.flagCountry || "—");

        const homePort =
          escapeHtml(
            vessel.homePort && vessel.homePort.name
              ? vessel.homePort.name
              : "—"
          );

        const capacity =
          Number(vessel.capacityTons || 0).toLocaleString();

        return `
          <tr
            data-vessel-id="${escapeHtml(vessel.id)}"
            class="fleet-vessel-row"
            tabindex="0"
            role="button"
            aria-label="View details for ${vesselName}"
          >
            <td>
              <div class="fleet-vessel-name">${vesselName}</div>
            </td>

            <td>
              <span class="fleet-vessel-code">${vesselCode}</span>
            </td>

            <td>${vesselType}</td>

            <td>${flagCountry}</td>

            <td>${capacity} t</td>

            <td>
              <span class="fleet-status ${statusClass}">
                <span class="fleet-status-dot"></span>
                ${statusLabel}
              </span>
            </td>

            <td>${homePort}</td>
          </tr>
        `;
      }).join("");
    }

    bindVesselRowClicks();
  }

  /*
   * Keep the Fleet Operations badge explicitly live.
   */
  const fleetBadge = $("fleetLiveBadge");

  if(fleetBadge){
    fleetBadge.textContent = "Live";
  }

  console.log("Live fleet summary:", {
    total,
    active,
    restricted,
    maintenance,
    outOfService,
    totalCapacity
  });
}

/*
 * Load the real dashboard summary from Node/Express.
 */
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

function setHeader(){
  /*
   * Header values still use the existing mock data for now.
   * We will connect sales, performance, port and weather
   * to real sources in the next API expansion.
   */
  const h = window.MOCK.header;

  $("kpiSales").textContent =
    moneyShort(h.salesMonth);

  $("kpiPerf").textContent =
    `${h.performance.toFixed(1)}%`;

  $("kpiPort").textContent =
    h.port;

  $("kpiTemp").textContent =
    `${h.tempF}°F`;
}

function makeDoughnut(canvasId, value, max, cutout=72){
  const canvas = $(canvasId);

  if(!canvas) return null;

  const ctx = canvas.getContext("2d");

  return new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Active", "Remaining"],
      datasets: [{
        data: [
          value,
          Math.max(0, max - value)
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: `${cutout}%`,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true
        }
      }
    }
  });
}

function setShips(){
  const s = window.MOCK.ships;

  $("activeShips").textContent =
    s.active;

  $("activeShipsSub").textContent =
    `${s.active} / ${s.total}`;

  $("totalCapacity").textContent =
    s.totalCapacityTons.toLocaleString();

  $("statPracticable").textContent =
    s.status.practicable;

  $("statRestricted").textContent =
    s.status.restricted;

  $("statOut").textContent =
    s.status.outOfService;

  const usedPct =
    pct(s.usedCapacityTons, s.totalCapacityTons);

  $("capacityPct").textContent =
    `${usedPct}%`;

  $("capacityTons").textContent =
    `${s.usedCapacityTons.toLocaleString()} t`;

  if(capacityChart){
    capacityChart.destroy();
  }

  capacityChart = makeDoughnut(
    "capacityGauge",
    s.usedCapacityTons,
    s.totalCapacityTons,
    78
  );
}

function setBothShips(){
  const b = window.MOCK.bothShips;

  $("bothShipsBar").style.width =
    `${b.capacityPct}%`;

  $("recoveryPct").textContent =
    `${b.recoveryPct}%`;
}

function setAI(){
  const ai = window.MOCK.ai;

  $("fishName").textContent =
    ai.fishName;

  $("fishMeta").textContent =
    ai.meta;

  $("fishShare").textContent =
    `${ai.marketShare}%`;

  $("fishAnnual").textContent =
    `${ai.annualTons}K tons`;

  $("sustainScore").textContent =
    `${ai.sustainabilityScore}/100`;

  if(sustainChart){
    sustainChart.destroy();
  }

  const ctx =
    $("sustainGauge").getContext("2d");

  sustainChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Score", "Remaining"],
      datasets: [{
        data: [
          ai.sustainabilityScore,
          100 - ai.sustainabilityScore
        ],
        borderWidth: 0
      }]
    },
    options: {
      rotation: -90,
      circumference: 180,
      cutout: "78%",
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      }
    }
  });
}

function setCapture(typeKey="mackerel"){
  const c = window.MOCK.capture;

  $("captureTrend").textContent =
    `+${c.trendPct.toFixed(1)}%`;

  /*
   * Fallback/mock display.
   * Live capture values are applied by applyLiveSummary().
   */
  $("captureNow").textContent =
    c.nowLb.toLocaleString();

  $("captureTarget").textContent =
    c.targetLb.toLocaleString();

  const p =
    Math.min(
      100,
      (c.nowLb / c.targetLb) * 100
    );

  $("captureBar").style.width =
    `${p}%`;

  const items =
    c.byType[typeKey] || [];

  const wrap =
    $("typeBreakdown");

  wrap.innerHTML =
    items.map(x => `
      <div class="break">
        <div class="label">${x.label}</div>
        <div class="val">${x.valueLb.toLocaleString()} lb</div>
      </div>
    `).join("");
}

function setCaptains(){
  const {
    zones,
    list
  } = window.MOCK.captains;

  const zoneSelect =
    $("zoneSelect");

  zoneSelect.innerHTML =
    `<option value="all">Zone: All</option>` +
    zones.map(z =>
      `<option value="${z}">${z}</option>`
    ).join("");

  const render = () => {
    const shift =
      $("shiftSelect").value;

    const zone =
      $("zoneSelect").value;

    const filtered =
      list.filter(c => {
        const okShift =
          shift === "all" ||
          c.shift === shift;

        const okZone =
          zone === "all" ||
          c.zone === zone;

        return okShift && okZone;
      });

    $("captainsList").innerHTML =
      filtered.map(c => {
        const initials =
          c.name
            .split(" ")
            .map(p => p[0])
            .slice(0, 2)
            .join("");

        const pillClass =
          c.status === "Active"
            ? "ok"
            : "warn";

        const navText =
          c.nav
            ? "In Navigation"
            : "Docked";

        return `
          <div class="cap">
            <div class="avatar">${initials}</div>

            <div>
              <div class="name">${c.name}</div>
              <div class="meta">
                ${c.zone} • ${c.shift.toUpperCase()} shift
              </div>
              <div class="meta">
                ${navText}
              </div>
            </div>

            <div class="right">
              <div class="pill ${pillClass}">
                ${c.status}
              </div>

              <div class="meta">
                Utilization:
                <b>${c.util}%</b>
              </div>
            </div>
          </div>
        `;
      }).join("");
  };

  $("shiftSelect")
    .addEventListener("change", render);

  $("zoneSelect")
    .addEventListener("change", render);

  render();
}

function setRadar(){
  const r = window.MOCK.radar;

  $("radarZone").textContent =
    r.zoneTitle;

  $("radarOcean").textContent =
    r.ocean;

  $("radarAnnual").textContent =
    r.annual;

  $("radarMeta").textContent =
    `${r.ships.length} ships • 1 route`;

  const canvas =
    $("radarCanvas");

  const ctx =
    canvas.getContext("2d");

  const draw = () => {
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1;

    for(let i = 1; i <= 4; i++){
      ctx.beginPath();

      ctx.arc(
        w * 0.52,
        h * 0.55,
        i * 40,
        0,
        Math.PI * 2
      );

      ctx.strokeStyle =
        "rgba(255,255,255,.10)";

      ctx.stroke();
    }

    ctx.beginPath();

    ctx.moveTo(
      w * 0.52,
      0
    );

    ctx.lineTo(
      w * 0.52,
      h
    );

    ctx.moveTo(
      0,
      h * 0.55
    );

    ctx.lineTo(
      w,
      h * 0.55
    );

    ctx.strokeStyle =
      "rgba(255,255,255,.08)";

    ctx.stroke();

    ctx.beginPath();

    r.route.forEach((p, idx) => {
      if(idx === 0){
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    });

    ctx.strokeStyle =
      "rgba(140,220,255,.45)";

    ctx.lineWidth = 3;
    ctx.stroke();

    r.ships.forEach(s => {
      ctx.beginPath();

      ctx.arc(
        s.x,
        s.y,
        6,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        "rgba(140,255,200,.85)";

      ctx.fill();

      ctx.font =
        "12px Inter, Arial";

      ctx.fillStyle =
        "rgba(255,255,255,.75)";

      ctx.fillText(
        s.label,
        s.x + 10,
        s.y + 4
      );
    });
  };

  draw();
}

function wireCaptureTabs(){
  document
    .querySelectorAll(".seg-btn")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".seg-btn")
          .forEach(b =>
            b.classList.remove("active")
          );

        btn.classList.add("active");

        setCapture(
          btn.dataset.type
        );

        /*
         * Reapply live total after changing tabs.
         */
        if(LIVE.summary){
          applyLiveSummary();
        }
      });
    });
}

/*
 * No more fake random database values.
 *
 * We periodically refresh the real API instead.
 */
function startLiveRefresh(){
  setInterval(() => {
    loadDashboardSummary();
  }, 30000);
}

async function init(){
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
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem(
        "marine_session"
      );

      window.location.href =
        "./login.html";
    });
  }

  /*
   * Load real vessel records from MariaDB.
   */
  await loadVessels();

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
   * Refresh live data every 30 seconds.
   */
  startLiveRefresh();
}

init();
