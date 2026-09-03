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

async function loadCrew(){
  const body = $("crewBody");

  try {
    const response = await fetch(
      `${API_BASE}/api/crew`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if(!response.ok){
      throw new Error(
        `Crew API returned HTTP ${response.status}`
      );
    }

    const result = await response.json();

    if(
      !result.success ||
      !result.data ||
      !result.data.summary ||
      !Array.isArray(result.data.crew)
    ){
      throw new Error("Invalid crew API response");
    }

    const summary = result.data.summary;
    const crew = result.data.crew;

    const total = $("crewTotal");
    const active = $("crewActive");
    const onLeave = $("crewOnLeave");
    const assignedVessels = $("crewAssignedVessels");

    if(total){
      total.textContent = String(summary.totalCrew || 0);
    }

    if(active){
      active.textContent = String(summary.active || 0);
    }

    if(onLeave){
      onLeave.textContent = String(summary.onLeave || 0);
    }

    if(assignedVessels){
      assignedVessels.textContent = String(summary.assignedVessels || 0);
    }

    if(!crew.length){
      if(body){
        body.innerHTML = `
          <tr>
            <td colspan="6" class="muted">
              No crew records available.
            </td>
          </tr>
        `;
      }

      console.log("Crew data loaded: no crew records");
      return;
    }

    if(body){
      body.innerHTML = crew.map(member => {
        const statusLabel = String(member.status || "")
          .replace(/_/g, " ")
          .replace(/\b\w/g, letter => letter.toUpperCase());

        return `
          <tr>
            <td>
              <strong>${escapeHtml(member.fullName || "Unknown")}</strong>
              <div class="muted small">
                ${escapeHtml(member.employeeCode || "")}
              </div>
            </td>

            <td>
              ${escapeHtml(member.position || "—")}
            </td>

            <td>
              ${
                member.vesselName
                  ? `
                    <strong>${escapeHtml(member.vesselName)}</strong>
                    <div class="muted small">
                      ${escapeHtml(member.vesselCode || "")}
                    </div>
                  `
                  : `<span class="muted">Unassigned</span>`
              }
            </td>

            <td>
              ${escapeHtml(member.certification || "—")}
            </td>

            <td>
              <span class="crew-status-badge ${escapeHtml(member.status || "")}">
                ${escapeHtml(statusLabel)}
              </span>
            </td>

            <td>
              ${escapeHtml(formatVoyageDate(member.joinedAt))}
            </td>
          </tr>
        `;
      }).join("");
    }

    console.log("Crew data loaded:", crew);

  } catch(error){
    console.error("Crew data error:", error);

    if(body){
      body.innerHTML = `
        <tr>
          <td colspan="6" class="muted">
            Unable to load crew data.
          </td>
        </tr>
      `;
    }
  }
}

async function loadCatch(){
  const badge = document.getElementById("catchLiveBadge");
  const totalEl = document.getElementById("catchTotalKg");
  const targetEl = document.getElementById("catchTargetKg");
  const progressEl = document.getElementById("catchProgressPercent");
  const recordsEl = document.getElementById("catchRecordCount");
  const speciesCountEl = document.getElementById("catchSpeciesCount");
  const vesselsReportingEl = document.getElementById("catchVesselsReporting");
  const speciesGrid = document.getElementById("catchSpeciesGrid");
  const vesselGrid = document.getElementById("catchVesselGrid");
  const body = document.getElementById("catchBody");

  try {
    const response = await fetch(`${API_BASE}/api/catch`);

    if(!response.ok){
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if(!result.success || !result.data){
      throw new Error("Invalid catch API response");
    }

    const summary = result.data.summary || {};
    const speciesBreakdown = Array.isArray(result.data.speciesBreakdown)
      ? result.data.speciesBreakdown
      : [];
    const vesselBreakdown = Array.isArray(result.data.vesselBreakdown)
      ? result.data.vesselBreakdown
      : [];
    const catches = Array.isArray(result.data.catches)
      ? result.data.catches
      : [];

    if(totalEl){
      totalEl.textContent = `${Number(summary.totalCatchKg || 0).toLocaleString()} kg`;
    }

    if(targetEl){
      targetEl.textContent = `${Number(summary.targetKg || 0).toLocaleString()} kg`;
    }

    if(progressEl){
      progressEl.textContent = `${Number(summary.targetProgressPercent || 0).toFixed(1)}%`;
    }

    if(recordsEl){
      recordsEl.textContent = Number(summary.recordCount || 0).toLocaleString();
    }

    if(speciesCountEl){
      speciesCountEl.textContent = Number(summary.speciesCount || 0).toLocaleString();
    }

    if(vesselsReportingEl){
      vesselsReportingEl.textContent = Number(summary.vesselsReporting || 0).toLocaleString();
    }

    if(speciesGrid){
      if(speciesBreakdown.length === 0){
        speciesGrid.innerHTML = '<div class="muted small">No species data available.</div>';
      } else {
        speciesGrid.innerHTML = speciesBreakdown.map(item => `
          <div class="catch-stat-card">
            <div class="catch-stat-name">${escapeHtml(item.species)}</div>
            <strong>${Number(item.quantityKg || 0).toLocaleString()} kg</strong>
            <div class="muted small">
              ${Number(item.recordCount || 0).toLocaleString()} record${Number(item.recordCount || 0) === 1 ? "" : "s"}
            </div>
          </div>
        `).join("");
      }
    }

    if(vesselGrid){
      if(vesselBreakdown.length === 0){
        vesselGrid.innerHTML = '<div class="muted small">No vessel production data available.</div>';
      } else {
        vesselGrid.innerHTML = vesselBreakdown.map(item => `
          <div class="catch-stat-card">
            <div class="catch-stat-name">${escapeHtml(item.vesselName || "Unassigned")}</div>
            <strong>${Number(item.quantityKg || 0).toLocaleString()} kg</strong>
            <div class="muted small">
              ${escapeHtml(item.vesselCode || "")}
              ${item.recordCount ? ` · ${Number(item.recordCount).toLocaleString()} record${Number(item.recordCount) === 1 ? "" : "s"}` : ""}
            </div>
          </div>
        `).join("");
      }
    }

    if(body){
      if(catches.length === 0){
        body.innerHTML = `
          <tr>
            <td colspan="7" class="muted">No catch records found.</td>
          </tr>
        `;
      } else {
        body.innerHTML = catches.map(item => {
          const latitude = item.latitude === null || item.latitude === undefined
            ? "—"
            : Number(item.latitude).toFixed(4);

          const longitude = item.longitude === null || item.longitude === undefined
            ? "—"
            : Number(item.longitude).toFixed(4);

          return `
            <tr>
              <td>
                <strong>${escapeHtml(item.vesselName || "Unassigned")}</strong>
                <div class="muted small">${escapeHtml(item.vesselCode || "")}</div>
              </td>

              <td>
                <strong>${escapeHtml(item.voyageNumber || "—")}</strong>
                <div class="muted small">${escapeHtml(item.voyageStatus || "")}</div>
              </td>

              <td>${escapeHtml(item.species || "Unknown")}</td>

              <td>
                <strong>${Number(item.quantityKg || 0).toLocaleString()} kg</strong>
              </td>

              <td>${formatVoyageDate(item.recordedAt)}</td>

              <td>
                <span class="muted small">
                  ${latitude}, ${longitude}
                </span>
              </td>

              <td>${escapeHtml(item.notes || "—")}</td>
            </tr>
          `;
        }).join("");
      }
    }

    if(badge){
      badge.textContent = "Live";
    }

  } catch(error){
    console.error("Catch load error:", error);

    if(badge){
      badge.textContent = "Error";
    }

    if(speciesGrid){
      speciesGrid.innerHTML = '<div class="muted small">Unable to load species data.</div>';
    }

    if(vesselGrid){
      vesselGrid.innerHTML = '<div class="muted small">Unable to load vessel production data.</div>';
    }

    if(body){
      body.innerHTML = `
        <tr>
          <td colspan="7" class="muted">
            Unable to load catch records.
          </td>
        </tr>
      `;
    }
  }
}

async function loadAlerts(){
  const body = $("alertsBody");
  const severityGrid = $("alertsSeverityGrid");

  try {
    const response = await fetch(
      `${API_BASE}/api/alerts`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if(!response.ok){
      throw new Error(
        `Alerts API returned HTTP ${response.status}`
      );
    }

    const result = await response.json();

    if(
      !result.success ||
      !result.data ||
      !result.data.summary ||
      !Array.isArray(result.data.alerts)
    ){
      throw new Error("Invalid alerts API response");
    }

    const summary = result.data.summary;
    const alerts = result.data.alerts;

    const total = $("alertsTotal");
    const open = $("alertsOpen");
    const acknowledged = $("alertsAcknowledged");
    const critical = $("alertsCritical");

    if(total){
      total.textContent = String(summary.totalAlerts || 0);
    }

    if(open){
      open.textContent = String(summary.open || 0);
    }

    if(acknowledged){
      acknowledged.textContent = String(summary.acknowledged || 0);
    }

    if(critical){
      critical.textContent = String(summary.critical || 0);
    }

    if(severityGrid){
      const severities = [
        {
          label: "Critical",
          value: summary.critical || 0,
          className: "critical"
        },
        {
          label: "Warning",
          value: summary.warning || 0,
          className: "warning"
        },
        {
          label: "Info",
          value: summary.info || 0,
          className: "info"
        }
      ];

      severityGrid.innerHTML = severities.map(severity => `
        <div class="alerts-severity-card ${severity.className}">
          <span class="muted small">${escapeHtml(severity.label)}</span>
          <strong>${escapeHtml(severity.value)}</strong>
        </div>
      `).join("");
    }

    if(!alerts.length){
      if(body){
        body.innerHTML = `
          <tr>
            <td colspan="6" class="muted">
              No alerts available.
            </td>
          </tr>
        `;
      }

      console.log("Alerts data loaded: no alerts");
      return;
    }

    if(body){
      body.innerHTML = alerts.map(alert => {
        const statusLabel = String(alert.status || "")
          .replace(/_/g, " ")
          .replace(/\b\w/g, letter => letter.toUpperCase());

        const typeLabel = String(alert.alertType || "")
          .replace(/_/g, " ")
          .replace(/\b\w/g, letter => letter.toUpperCase());

        const severityLabel = String(alert.severity || "")
          .replace(/\b\w/g, letter => letter.toUpperCase());

        return `
          <tr>
            <td>
              <strong>${escapeHtml(alert.title || "Alert")}</strong>
              <div class="muted small">
                ${escapeHtml(alert.message || "")}
              </div>
            </td>

            <td>
              ${
                alert.vesselName
                  ? `
                    <strong>${escapeHtml(alert.vesselName)}</strong>
                    <div class="muted small">
                      ${escapeHtml(alert.vesselCode || "")}
                    </div>
                  `
                  : `<span class="muted">Fleet-wide</span>`
              }
            </td>

            <td>${escapeHtml(typeLabel)}</td>

            <td>
              <span class="alert-severity-badge ${escapeHtml(alert.severity || "")}">
                ${escapeHtml(severityLabel)}
              </span>
            </td>

            <td>
              <span class="alert-status-badge ${escapeHtml(alert.status || "")}">
                ${escapeHtml(statusLabel)}
              </span>
            </td>

            <td>
              ${escapeHtml(formatVoyageDate(alert.createdAt))}
            </td>
          </tr>
        `;
      }).join("");
    }

    console.log("Alerts data loaded:", alerts);

  } catch(error){
    console.error("Alerts data error:", error);

    if(body){
      body.innerHTML = `
        <tr>
          <td colspan="6" class="muted">
            Unable to load alerts.
          </td>
        </tr>
      `;
    }

    if(severityGrid){
      severityGrid.innerHTML = `
        <div class="muted">
          Alert severity summary unavailable.
        </div>
      `;
    }
  }
}

async function loadMaintenance(){
  const body = $("maintenanceBody");
  const priorityGrid = $("maintenancePriorityGrid");

  try {
    const response = await fetch(
      `${API_BASE}/api/maintenance`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if(!response.ok){
      throw new Error(
        `Maintenance API returned HTTP ${response.status}`
      );
    }

    const result = await response.json();

    if(
      !result.success ||
      !result.data ||
      !result.data.summary ||
      !Array.isArray(result.data.records)
    ){
      throw new Error("Invalid maintenance API response");
    }

    const summary = result.data.summary;
    const records = result.data.records;

    const totalRecords = $("maintenanceTotalRecords");
    const scheduled = $("maintenanceScheduled");
    const inProgress = $("maintenanceInProgress");
    const completed = $("maintenanceCompleted");
    const totalCost = $("maintenanceTotalCost");

    if(totalRecords){
      totalRecords.textContent = String(summary.totalRecords || 0);
    }

    if(scheduled){
      scheduled.textContent = String(summary.scheduled || 0);
    }

    if(inProgress){
      inProgress.textContent = String(summary.inProgress || 0);
    }

    if(completed){
      completed.textContent = String(summary.completed || 0);
    }

    if(totalCost){
      totalCost.textContent =
        `₦${Number(summary.totalCost || 0).toLocaleString()}`;
    }

    if(priorityGrid){
      const priorities = [
        {
          label: "Critical",
          value: summary.criticalPriority || 0,
          className: "critical"
        },
        {
          label: "High",
          value: summary.highPriority || 0,
          className: "high"
        },
        {
          label: "Medium",
          value: summary.mediumPriority || 0,
          className: "medium"
        },
        {
          label: "Low",
          value: summary.lowPriority || 0,
          className: "low"
        }
      ];

      priorityGrid.innerHTML = priorities.map(priority => `
        <div class="maintenance-priority-card ${priority.className}">
          <span class="muted small">${escapeHtml(priority.label)} Priority</span>
          <strong>${escapeHtml(priority.value)}</strong>
        </div>
      `).join("");
    }

    if(!records.length){
      if(body){
        body.innerHTML = `
          <tr>
            <td colspan="7" class="muted">
              No maintenance records available.
            </td>
          </tr>
        `;
      }

      console.log("Maintenance data loaded: no records");
      return;
    }

    if(body){
      body.innerHTML = records.map(record => {
        const statusLabel = String(record.status || "")
          .replace(/_/g, " ")
          .replace(/\b\w/g, letter => letter.toUpperCase());

        const typeLabel = String(record.maintenanceType || "")
          .replace(/_/g, " ")
          .replace(/\b\w/g, letter => letter.toUpperCase());

        const priorityLabel = String(record.priority || "")
          .replace(/\b\w/g, letter => letter.toUpperCase());

        return `
          <tr>
            <td>
              <strong>${escapeHtml(record.title || "Maintenance")}</strong>
              <div class="muted small">
                ${escapeHtml(record.description || "")}
              </div>
            </td>

            <td>
              <strong>${escapeHtml(record.vesselName || "Unknown vessel")}</strong>
              <div class="muted small">
                ${escapeHtml(record.vesselCode || "")}
              </div>
            </td>

            <td>${escapeHtml(typeLabel)}</td>

            <td>
              <span class="maintenance-priority-badge ${escapeHtml(record.priority || "")}">
                ${escapeHtml(priorityLabel)}
              </span>
            </td>

            <td>
              <span class="maintenance-status-badge ${escapeHtml(record.status || "")}">
                ${escapeHtml(statusLabel)}
              </span>
            </td>

            <td>
              ${escapeHtml(formatVoyageDate(record.scheduledAt))}
            </td>

            <td>
              <strong>
                ₦${Number(record.cost || 0).toLocaleString()}
              </strong>
            </td>
          </tr>
        `;
      }).join("");
    }

    console.log("Maintenance data loaded:", records);

  } catch(error){
    console.error("Maintenance data error:", error);

    if(body){
      body.innerHTML = `
        <tr>
          <td colspan="7" class="muted">
            Unable to load maintenance records.
          </td>
        </tr>
      `;
    }

    if(priorityGrid){
      priorityGrid.innerHTML = `
        <div class="muted">
          Maintenance summary unavailable.
        </div>
      `;
    }
  }
}

async function loadFuel(){
  const body = $("fuelBody");
  const vesselGrid = $("fuelVesselGrid");

  try {
    const response = await fetch(
      `${API_BASE}/api/fuel`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if(!response.ok){
      throw new Error(
        `Fuel API returned HTTP ${response.status}`
      );
    }

    const result = await response.json();

    if(
      !result.success ||
      !result.data ||
      !Array.isArray(result.data.records) ||
      !Array.isArray(result.data.byVessel)
    ){
      throw new Error("Invalid fuel API response");
    }

    const summary = result.data.summary || {};
    const records = result.data.records;
    const byVessel = result.data.byVessel;

    const totalLiters = $("fuelTotalLiters");
    const recordCount = $("fuelRecordCount");
    const vesselsReporting = $("fuelVesselsReporting");

    if(totalLiters){
      totalLiters.textContent =
        `${Number(summary.totalLiters || 0).toLocaleString()} L`;
    }

    if(recordCount){
      recordCount.textContent =
        Number(summary.recordCount || 0).toLocaleString();
    }

    if(vesselsReporting){
      vesselsReporting.textContent =
        byVessel.length.toLocaleString();
    }

    if(vesselGrid){
      if(byVessel.length === 0){
        vesselGrid.innerHTML = `
          <div class="muted">
            No vessel fuel data available.
          </div>
        `;
      } else {
        vesselGrid.innerHTML = byVessel.map(vessel => `
          <div class="fuel-vessel-card">
            <div class="fuel-vessel-card-head">
              <div>
                <div class="fuel-vessel-name">
                  ${escapeHtml(vessel.vesselName)}
                </div>
                <div class="muted small">
                  ${escapeHtml(vessel.vesselCode)}
                  • ${escapeHtml(vessel.vesselType)}
                </div>
              </div>

              <div class="fuel-vessel-total">
                ${Number(vessel.totalLiters || 0).toLocaleString()} L
              </div>
            </div>

            <div class="fuel-vessel-records muted small">
              ${Number(vessel.records || 0).toLocaleString()}
              fuel record${Number(vessel.records || 0) === 1 ? "" : "s"}
            </div>
          </div>
        `).join("");
      }
    }

    if(body){
      if(records.length === 0){
        body.innerHTML = `
          <tr>
            <td colspan="5" class="muted">
              No fuel records available.
            </td>
          </tr>
        `;
      } else {
        body.innerHTML = records.map(record => `
          <tr>
            <td>
              <div class="fuel-vessel-name">
                ${escapeHtml(record.vesselName)}
              </div>
              <div class="fuel-vessel-code muted">
                ${escapeHtml(record.vesselCode)}
              </div>
            </td>

            <td>
              ${escapeHtml(record.fuelType || "—")}
            </td>

            <td>
              <strong>
                ${Number(record.quantityLiters || 0).toLocaleString()} L
              </strong>
            </td>

            <td>
              ${escapeHtml(
                formatVoyageDate(record.recordedAt)
              )}
            </td>

            <td>
              ${escapeHtml(record.notes || "—")}
            </td>
          </tr>
        `).join("");
      }
    }

    console.log(
      "Fuel data loaded:",
      result.data
    );

  } catch(error) {
    console.error("Unable to load fuel data:", error);

    if(body){
      body.innerHTML = `
        <tr>
          <td colspan="5" class="muted">
            Unable to load fuel data.
          </td>
        </tr>
      `;
    }

    if(vesselGrid){
      vesselGrid.innerHTML = `
        <div class="muted">
          Unable to load vessel fuel data.
        </div>
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

    const editButton =
      row.querySelector(".fleet-vessel-edit-btn");

    if(editButton){
      editButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        const vesselId =
          editButton.dataset.editVesselId ||
          row.dataset.vesselId;

        if(vesselId){
          openEditVesselModal(vesselId);
        }
      });
    }

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
          <td colspan="8" class="muted">
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

            <td>
              <button
                type="button"
                class="fleet-vessel-edit-btn"
                data-edit-vessel-id="${escapeHtml(vessel.id)}"
                aria-label="Edit ${vesselName}"
              >
                Edit
              </button>
            </td>
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

async function loadReports(){
  const badge = document.getElementById("reportsLiveBadge");

  try{
    const response = await fetch("/api/reports/summary");
    const result = await response.json();

    if(!response.ok || !result.success){
      throw new Error(result.message || "Failed to load reports.");
    }

    const data = result.data || {};
    const fleet = data.fleet || {};
    const production = data.production || {};
    const fuel = data.fuel || {};
    const voyages = data.voyages || {};
    const maintenance = data.maintenance || {};
    const alerts = data.alerts || {};
    const crew = data.crew || {};

    const setText = (id, value) => {
      const element = document.getElementById(id);
      if(element) element.textContent = value;
    };

    const formatNumber = (value, decimals = 0) => {
      const number = Number(value || 0);
      return number.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    };

    const formatCurrency = (value) => {
      return "₦" + formatNumber(value, 0);
    };

    setText("reportFleetCapacity", `${formatNumber(fleet.totalCapacityTons)} tons`);
    setText("reportTotalCatch", `${formatNumber(production.totalCatchKg)} kg`);
    setText("reportCatchProgress", `${formatNumber(production.catchProgressPercent, 1)}%`);
    setText("reportFuelTotal", `${formatNumber(fuel.totalLiters)} L`);
    setText("reportCatchEfficiency", `${formatNumber(production.catchPerLiterKg, 2)} kg/L`);
    setText("reportMaintenanceCost", formatCurrency(maintenance.totalCost));

    const fleetGrid = document.getElementById("reportFleetGrid");
    if(fleetGrid){
      fleetGrid.innerHTML = `
        <div class="report-stat-card">
          <span class="muted small">Total Vessels</span>
          <strong>${formatNumber(fleet.total)}</strong>
        </div>
        <div class="report-stat-card">
          <span class="muted small">Active</span>
          <strong>${formatNumber(fleet.active)}</strong>
        </div>
        <div class="report-stat-card">
          <span class="muted small">Restricted</span>
          <strong>${formatNumber(fleet.restricted)}</strong>
        </div>
        <div class="report-stat-card">
          <span class="muted small">Maintenance</span>
          <strong>${formatNumber(fleet.maintenance)}</strong>
        </div>
        <div class="report-stat-card">
          <span class="muted small">Out of Service</span>
          <strong>${formatNumber(fleet.outOfService)}</strong>
        </div>
      `;
    }

    const voyageGrid = document.getElementById("reportVoyageGrid");
    if(voyageGrid){
      voyageGrid.innerHTML = `
        <div class="report-stat-card">
          <span class="muted small">Total Voyages</span>
          <strong>${formatNumber(voyages.total)}</strong>
        </div>
        <div class="report-stat-card">
          <span class="muted small">In Progress</span>
          <strong>${formatNumber(voyages.inProgress)}</strong>
        </div>
        <div class="report-stat-card">
          <span class="muted small">Planned</span>
          <strong>${formatNumber(voyages.planned)}</strong>
        </div>
        <div class="report-stat-card">
          <span class="muted small">Completed</span>
          <strong>${formatNumber(voyages.completed)}</strong>
        </div>
        <div class="report-stat-card">
          <span class="muted small">Cancelled</span>
          <strong>${formatNumber(voyages.cancelled)}</strong>
        </div>
      `;
    }

    const alertGrid = document.getElementById("reportAlertGrid");
    if(alertGrid){
      alertGrid.innerHTML = `
        <div class="report-stat-card">
          <span class="muted small">Total Alerts</span>
          <strong>${formatNumber(alerts.total)}</strong>
        </div>
        <div class="report-stat-card">
          <span class="muted small">Open</span>
          <strong>${formatNumber(alerts.open)}</strong>
        </div>
        <div class="report-stat-card">
          <span class="muted small">Critical</span>
          <strong>${formatNumber(alerts.critical)}</strong>
        </div>
        <div class="report-stat-card">
          <span class="muted small">Warning</span>
          <strong>${formatNumber(alerts.warning)}</strong>
        </div>
        <div class="report-stat-card">
          <span class="muted small">Acknowledged</span>
          <strong>${formatNumber(alerts.acknowledged)}</strong>
        </div>
      `;
    }

    const crewGrid = document.getElementById("reportCrewGrid");
    if(crewGrid){
      crewGrid.innerHTML = `
        <div class="report-stat-card">
          <span class="muted small">Total Crew</span>
          <strong>${formatNumber(crew.total)}</strong>
        </div>
        <div class="report-stat-card">
          <span class="muted small">Active</span>
          <strong>${formatNumber(crew.active)}</strong>
        </div>
        <div class="report-stat-card">
          <span class="muted small">On Leave</span>
          <strong>${formatNumber(crew.onLeave)}</strong>
        </div>
        <div class="report-stat-card">
          <span class="muted small">Assigned Vessels</span>
          <strong>${formatNumber(crew.assignedVessels)}</strong>
        </div>
      `;
    }

    const speciesGrid = document.getElementById("reportSpeciesGrid");
    if(speciesGrid){
      const species = production.bySpecies || [];

      speciesGrid.innerHTML = species.length
        ? species.map(item => `
            <div class="report-list-item">
              <div>
                <strong>${escapeHtml(item.species)}</strong>
                <span class="muted small">${formatNumber(item.recordCount)} record${Number(item.recordCount) === 1 ? "" : "s"}</span>
              </div>
              <strong>${formatNumber(item.quantityKg)} kg</strong>
            </div>
          `).join("")
        : '<div class="muted small">No production data available.</div>';
    }

    const catchVesselGrid = document.getElementById("reportCatchVesselGrid");
    if(catchVesselGrid){
      const vessels = production.byVessel || [];

      catchVesselGrid.innerHTML = vessels.length
        ? vessels.map(item => `
            <div class="report-list-item">
              <div>
                <strong>${escapeHtml(item.vesselName)}</strong>
                <span class="muted small">${escapeHtml(item.vesselCode)} · ${formatNumber(item.recordCount)} record${Number(item.recordCount) === 1 ? "" : "s"}</span>
              </div>
              <strong>${formatNumber(item.quantityKg)} kg</strong>
            </div>
          `).join("")
        : '<div class="muted small">No vessel production data available.</div>';
    }

    const fuelVesselGrid = document.getElementById("reportFuelVesselGrid");
    if(fuelVesselGrid){
      const vessels = fuel.byVessel || [];

      fuelVesselGrid.innerHTML = vessels.length
        ? vessels.map(item => `
            <div class="report-list-item">
              <div>
                <strong>${escapeHtml(item.vesselName)}</strong>
                <span class="muted small">${escapeHtml(item.vesselCode)} · ${formatNumber(item.recordCount)} record${Number(item.recordCount) === 1 ? "" : "s"}</span>
              </div>
              <strong>${formatNumber(item.fuelLiters)} L</strong>
            </div>
          `).join("")
        : '<div class="muted small">No fuel data available.</div>';
    }

    const maintenanceVesselGrid = document.getElementById("reportMaintenanceVesselGrid");
    if(maintenanceVesselGrid){
      const vessels = maintenance.byVessel || [];

      maintenanceVesselGrid.innerHTML = vessels.length
        ? vessels.map(item => `
            <div class="report-list-item">
              <div>
                <strong>${escapeHtml(item.vesselName)}</strong>
                <span class="muted small">${escapeHtml(item.vesselCode)} · ${formatNumber(item.recordCount)} record${Number(item.recordCount) === 1 ? "" : "s"}</span>
              </div>
              <strong>${formatCurrency(item.totalCost)}</strong>
            </div>
          `).join("")
        : '<div class="muted small">No maintenance data available.</div>';
    }

    const dailyBody = document.getElementById("reportDailyBody");
    if(dailyBody){
      const metrics = data.dailyMetrics || [];

      dailyBody.innerHTML = metrics.length
        ? metrics.map(item => `
            <tr>
              <td>${escapeHtml(item.metricDate)}</td>
              <td>${formatCurrency(item.salesAmount)}</td>
              <td>${formatNumber(item.captureKg)} kg</td>
              <td>${formatNumber(item.targetCaptureKg)} kg</td>
              <td>${formatNumber(item.activeVessels)}</td>
              <td>${formatNumber(item.fuelConsumedLiters)} L</td>
              <td>${formatNumber(item.performancePercent, 2)}%</td>
            </tr>
          `).join("")
        : `
            <tr>
              <td colspan="7" class="muted">
                No daily performance data available.
              </td>
            </tr>
          `;
    }

    if(badge){
      badge.textContent = "Live";
    }

  }catch(error){
    console.error("Reports load failed:", error);

    if(badge){
      badge.textContent = "Unavailable";
    }

    const dailyBody = document.getElementById("reportDailyBody");
    if(dailyBody){
      dailyBody.innerHTML = `
        <tr>
          <td colspan="7" class="muted">
            Unable to load reports right now.
          </td>
        </tr>
      `;
    }
  }
}


function openEditVesselModal(vesselId){
  const vessel = Array.isArray(LIVE.vessels)
    ? LIVE.vessels.find(
        item => String(item.id) === String(vesselId)
      )
    : null;

  if(!vessel){
    console.error(
      "Unable to edit vessel: vessel not found.",
      vesselId
    );
    return;
  }

  const existing =
    document.getElementById("editVesselModal");

  if(existing){
    existing.remove();
  }

  const modal = document.createElement("div");

  modal.id = "editVesselModal";
  modal.className = "vessel-management-modal";

  const vesselName =
    escapeHtml(vessel.name || "");

  const vesselCode =
    escapeHtml(vessel.vesselCode || "");

  const vesselType =
    escapeHtml(vessel.vesselType || "");

  const flagCountry =
    escapeHtml(vessel.flagCountry || "");

  const imoNumber =
    escapeHtml(vessel.imoNumber || "");

  const callSign =
    escapeHtml(vessel.callSign || "");

  const capacityTons =
    Number(vessel.capacityTons || 0);

  const status =
    String(vessel.status || "active");

  const homePortId =
    vessel.homePort && vessel.homePort.id
      ? Number(vessel.homePort.id)
      : "";

  const commissionedDate =
    vessel.commissionedDate
      ? String(vessel.commissionedDate).slice(0, 10)
      : "";

  modal.innerHTML = `
    <div
      class="vessel-management-backdrop"
      data-edit-vessel-modal-close
    ></div>

    <div
      class="vessel-management-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editVesselTitle"
    >
      <div class="vessel-management-dialog-head">
        <div>
          <div
            class="card-title"
            id="editVesselTitle"
          >
            Edit Vessel
          </div>

          <div class="muted small">
            Update the selected vessel in the live fleet database.
          </div>
        </div>

        <button
          type="button"
          class="badge"
          data-edit-vessel-modal-close
        >
          Close
        </button>
      </div>

      <form
        id="editVesselForm"
        class="vessel-management-form"
      >
        <div class="vessel-form-grid">

          <label>
            <span>Vessel Code *</span>
            <input
              type="text"
              name="vesselCode"
              maxlength="50"
              required
              value="${vesselCode}"
            >
          </label>

          <label>
            <span>Vessel Name *</span>
            <input
              type="text"
              name="name"
              maxlength="150"
              required
              value="${vesselName}"
            >
          </label>

          <label>
            <span>Vessel Type *</span>
            <input
              type="text"
              name="vesselType"
              maxlength="100"
              required
              value="${vesselType}"
            >
          </label>

          <label>
            <span>Flag Country</span>
            <input
              type="text"
              name="flagCountry"
              maxlength="100"
              value="${flagCountry}"
            >
          </label>

          <label>
            <span>IMO Number</span>
            <input
              type="text"
              name="imoNumber"
              maxlength="20"
              value="${imoNumber}"
            >
          </label>

          <label>
            <span>Call Sign</span>
            <input
              type="text"
              name="callSign"
              maxlength="50"
              value="${callSign}"
            >
          </label>

          <label>
            <span>Capacity (tons) *</span>
            <input
              type="number"
              name="capacityTons"
              min="0"
              step="0.01"
              required
              value="${capacityTons}"
            >
          </label>

          <label>
            <span>Status *</span>
            <select name="status" required>
              <option
                value="active"
                ${status === "active" ? "selected" : ""}
              >
                Active
              </option>

              <option
                value="restricted"
                ${status === "restricted" ? "selected" : ""}
              >
                Restricted
              </option>

              <option
                value="maintenance"
                ${status === "maintenance" ? "selected" : ""}
              >
                Maintenance
              </option>

              <option
                value="out_of_service"
                ${status === "out_of_service" ? "selected" : ""}
              >
                Out of Service
              </option>

              <option
                value="retired"
                ${status === "retired" ? "selected" : ""}
              >
                Retired
              </option>
            </select>
          </label>

          <label>
            <span>Home Port ID</span>
            <input
              type="number"
              name="homePortId"
              min="1"
              step="1"
              value="${homePortId}"
              placeholder="Optional"
            >
          </label>

          <label>
            <span>Commissioned Date</span>
            <input
              type="date"
              name="commissionedDate"
              value="${commissionedDate}"
            >
          </label>

        </div>

        <div
          id="editVesselMessage"
          class="vessel-management-message"
          aria-live="polite"
        ></div>

        <div class="vessel-management-form-actions">

          <button
            type="button"
            class="fleet-management-btn vessel-modal-cancel"
            data-edit-vessel-modal-close
          >
            Cancel
          </button>

          <button
            type="submit"
            class="fleet-management-btn"
            id="updateVesselBtn"
          >
            Update Vessel
          </button>

        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form =
    document.getElementById("editVesselForm");

  const message =
    document.getElementById("editVesselMessage");

  const updateButton =
    document.getElementById("updateVesselBtn");

  const closeModal = () => {
    modal.remove();
  };

  modal
    .querySelectorAll("[data-edit-vessel-modal-close]")
    .forEach(element => {
      element.addEventListener(
        "click",
        closeModal
      );
    });

  const handleEscape = event => {
    if(event.key === "Escape"){
      closeModal();

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    }
  };

  document.addEventListener(
    "keydown",
    handleEscape
  );

  form.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      if(updateButton){
        updateButton.disabled = true;
        updateButton.textContent = "Updating...";
      }

      if(message){
        message.textContent = "";
        message.className =
          "vessel-management-message";
      }

      const formData =
        new FormData(form);

      const payload = {
        vesselCode: String(
          formData.get("vesselCode") || ""
        ).trim(),

        name: String(
          formData.get("name") || ""
        ).trim(),

        vesselType: String(
          formData.get("vesselType") || ""
        ).trim(),

        flagCountry: String(
          formData.get("flagCountry") || ""
        ).trim() || null,

        imoNumber: String(
          formData.get("imoNumber") || ""
        ).trim() || null,

        callSign: String(
          formData.get("callSign") || ""
        ).trim() || null,

        capacityTons: Number(
          formData.get("capacityTons") || 0
        ),

        status: String(
          formData.get("status") || "active"
        ),

        homePortId:
          formData.get("homePortId")
            ? Number(formData.get("homePortId"))
            : null,

        commissionedDate:
          String(
            formData.get("commissionedDate") || ""
          ).trim() || null
      };

      try {
        const response = await fetch(
          `${API_BASE}/api/vessels/${encodeURIComponent(vesselId)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify(payload)
          }
        );

        const result =
          await response.json();

        if(
          !response.ok ||
          !result.success
        ){
          throw new Error(
            result.error ||
            result.message ||
            `Vessel API returned HTTP ${response.status}`
          );
        }

        if(message){
          message.textContent =
            "Vessel updated successfully.";

          message.className =
            "vessel-management-message success";
        }

        await loadVessels();

        setTimeout(() => {
          closeModal();
        }, 700);

      } catch(error) {
        console.error(
          "Update vessel failed:",
          error
        );

        if(message){
          message.textContent =
            error.message ||
            "Unable to update vessel.";

          message.className =
            "vessel-management-message error";
        }

        if(updateButton){
          updateButton.disabled = false;
          updateButton.textContent =
            "Update Vessel";
        }
      }
    }
  );

  const firstInput =
    form.querySelector("input");

  if(firstInput){
    firstInput.focus();
  }
}

function openVesselManagementModal(){
  const existing = document.getElementById("vesselManagementModal");

  if(existing){
    existing.remove();
  }

  const modal = document.createElement("div");
  modal.id = "vesselManagementModal";
  modal.className = "vessel-management-modal";
  modal.innerHTML = `
    <div
      class="vessel-management-backdrop"
      data-vessel-modal-close
    ></div>

    <div
      class="vessel-management-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vesselManagementTitle"
    >
      <div class="vessel-management-dialog-head">
        <div>
          <div
            class="card-title"
            id="vesselManagementTitle"
          >
            Add Vessel
          </div>

          <div class="muted small">
            Create a new vessel in the live fleet database.
          </div>
        </div>

        <button
          type="button"
          class="badge"
          data-vessel-modal-close
        >
          Close
        </button>
      </div>

      <form id="addVesselForm" class="vessel-management-form">
        <div class="vessel-form-grid">

          <label>
            <span>Vessel Code *</span>
            <input
              type="text"
              name="vesselCode"
              maxlength="50"
              required
              placeholder="e.g. MD-008"
            >
          </label>

          <label>
            <span>Vessel Name *</span>
            <input
              type="text"
              name="name"
              maxlength="150"
              required
              placeholder="e.g. Ocean Guardian"
            >
          </label>

          <label>
            <span>Vessel Type *</span>
            <input
              type="text"
              name="vesselType"
              maxlength="100"
              required
              placeholder="e.g. Fishing Vessel"
            >
          </label>

          <label>
            <span>Flag Country</span>
            <input
              type="text"
              name="flagCountry"
              maxlength="100"
              placeholder="e.g. Nigeria"
            >
          </label>

          <label>
            <span>IMO Number</span>
            <input
              type="text"
              name="imoNumber"
              maxlength="20"
              placeholder="Optional"
            >
          </label>

          <label>
            <span>Call Sign</span>
            <input
              type="text"
              name="callSign"
              maxlength="50"
              placeholder="Optional"
            >
          </label>

          <label>
            <span>Capacity (tons) *</span>
            <input
              type="number"
              name="capacityTons"
              min="0"
              step="0.01"
              value="0"
              required
            >
          </label>

          <label>
            <span>Status *</span>
            <select name="status" required>
              <option value="active">Active</option>
              <option value="restricted">Restricted</option>
              <option value="maintenance">Maintenance</option>
              <option value="out_of_service">Out of Service</option>
            </select>
          </label>

          <label>
            <span>Home Port ID</span>
            <input
              type="number"
              name="homePortId"
              min="1"
              step="1"
              placeholder="Optional"
            >
          </label>

          <label>
            <span>Commissioned Date</span>
            <input
              type="date"
              name="commissionedDate"
            >
          </label>

        </div>

        <div
          id="addVesselMessage"
          class="vessel-management-message"
          aria-live="polite"
        ></div>

        <div class="vessel-management-form-actions">
          <button
            type="button"
            class="fleet-management-btn vessel-modal-cancel"
            data-vessel-modal-close
          >
            Cancel
          </button>

          <button
            type="submit"
            class="fleet-management-btn"
            id="saveVesselBtn"
          >
            Create Vessel
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = document.getElementById("addVesselForm");
  const message = document.getElementById("addVesselMessage");
  const saveButton = document.getElementById("saveVesselBtn");

  const closeModal = () => {
    modal.remove();
  };

  modal.querySelectorAll("[data-vessel-modal-close]")
    .forEach(element => {
      element.addEventListener("click", closeModal);
    });

  document.addEventListener("keydown", function handleEscape(event){
    if(event.key === "Escape"){
      closeModal();
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if(saveButton){
      saveButton.disabled = true;
      saveButton.textContent = "Creating...";
    }

    if(message){
      message.textContent = "";
      message.className = "vessel-management-message";
    }

    const formData = new FormData(form);

    const payload = {
      vesselCode: String(
        formData.get("vesselCode") || ""
      ).trim(),

      name: String(
        formData.get("name") || ""
      ).trim(),

      vesselType: String(
        formData.get("vesselType") || ""
      ).trim(),

      flagCountry: String(
        formData.get("flagCountry") || ""
      ).trim() || null,

      imoNumber: String(
        formData.get("imoNumber") || ""
      ).trim() || null,

      callSign: String(
        formData.get("callSign") || ""
      ).trim() || null,

      capacityTons: Number(
        formData.get("capacityTons") || 0
      ),

      status: String(
        formData.get("status") || "active"
      ),

      homePortId:
        formData.get("homePortId")
          ? Number(formData.get("homePortId"))
          : null,

      commissionedDate:
        String(
          formData.get("commissionedDate") || ""
        ).trim() || null
    };

    try {
      const response = await fetch(
        `${API_BASE}/api/vessels`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json();

      if(!response.ok || !result.success){
        throw new Error(
          result.error ||
          result.message ||
          `Vessel API returned HTTP ${response.status}`
        );
      }

      if(message){
        message.textContent =
          "Vessel created successfully.";

        message.className =
          "vessel-management-message success";
      }

      await loadVessels();

      setTimeout(() => {
        closeModal();
      }, 700);

    } catch(error) {
      console.error(
        "Create vessel failed:",
        error
      );

      if(message){
        message.textContent =
          error.message ||
          "Unable to create vessel.";

        message.className =
          "vessel-management-message error";
      }

      if(saveButton){
        saveButton.disabled = false;
        saveButton.textContent = "Create Vessel";
      }
    }
  });

  const firstInput =
    form.querySelector("input");

  if(firstInput){
    firstInput.focus();
  }
}

function initVesselManagement(){
  const addButton =
    document.getElementById("addVesselBtn");

  if(!addButton){
    console.warn(
      "Add Vessel button not found."
    );
    return;
  }

  addButton.addEventListener(
    "click",
    openVesselManagementModal
  );
}


/*
 * User & Access Management
 * Only Super Admin and Admin users can access this module.
 */

let LIVE_USERS = [];

function currentDashboardUser(){
  try {
    const raw = localStorage.getItem("marine_session");

    if(!raw){
      return null;
    }

    const session = JSON.parse(raw);

    return session?.user || null;
  } catch(error) {
    console.error("Unable to read current dashboard user:", error);
    return null;
  }
}

function canManageUsers(){
  const user = currentDashboardUser();

  return Boolean(
    user &&
    ["super_admin", "admin"].includes(user.role)
  );
}

function formatUserDate(value){
  if(!value){
    return "Never";
  }

  const date = new Date(value);

  if(Number.isNaN(date.getTime())){
    return "—";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function userRoleLabel(role){
  const labels = {
    super_admin: "Super Admin",
    admin: "Admin",
    manager: "Manager",
    captain: "Captain",
    crew: "Crew",
    operator: "Operator",
    viewer: "Viewer"
  };

  return labels[role] || role || "Unknown";
}

function userStatusClass(status){
  if(status === "inactive"){
    return "inactive";
  }

  if(status === "suspended"){
    return "suspended";
  }

  if(status === "deleted"){
    return "deleted";
  }

  return "";
}

const USER_ROLES = [
  "super_admin",
  "admin",
  "manager",
  "captain",
  "crew",
  "operator",
  "viewer"
];

const USER_STATUSES = [
  "active",
  "inactive",
  "suspended"
];

function renderUsers(){
  const body = document.getElementById("usersBody");

  if(!body){
    return;
  }

  if(!LIVE_USERS.length){
    body.innerHTML = `
      <tr>
        <td colspan="7" class="muted user-management-empty">
          No users found.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML = LIVE_USERS.map(user => `
    <tr>
      <td>
        <strong>${escapeHtml(user.fullName)}</strong>
      </td>

      <td>
        ${escapeHtml(user.email)}
      </td>

      <td>
        <span class="user-role-badge">
          ${escapeHtml(userRoleLabel(user.role))}
        </span>
      </td>

      <td>
        <span class="user-status-badge ${escapeHtml(userStatusClass(user.status))}">
          ${escapeHtml(user.status || "unknown")}
        </span>
      </td>

      <td>
        ${escapeHtml(formatUserDate(user.lastLoginAt))}
      </td>

      <td>
        ${escapeHtml(formatUserDate(user.createdAt))}
      </td>

      <td>
        <button
          type="button"
          class="user-management-action-btn"
          data-user-manage-id="${Number(user.id)}"
          title="Manage this user"
        >
          Manage
        </button>
      </td>
    </tr>
  `).join("");
}

function applyUserSummary(){
  const total = LIVE_USERS.length;

  const active = LIVE_USERS.filter(
    user => user.status === "active"
  ).length;

  const inactive = LIVE_USERS.filter(
    user => user.status === "inactive"
  ).length;

  const suspended = LIVE_USERS.filter(
    user => user.status === "suspended"
  ).length;

  const totalElement = document.getElementById("usersTotal");
  const activeElement = document.getElementById("usersActive");
  const inactiveElement = document.getElementById("usersInactive");
  const suspendedElement = document.getElementById("usersSuspended");

  if(totalElement){
    totalElement.textContent = total;
  }

  if(activeElement){
    activeElement.textContent = active;
  }

  if(inactiveElement){
    inactiveElement.textContent = inactive;
  }

  if(suspendedElement){
    suspendedElement.textContent = suspended;
  }
}

function applyUserManagementVisibility(){
  const section = document.querySelector(
    ".user-management-operations"
  );

  if(!section){
    return;
  }

  if(!canManageUsers()){
    section.style.display = "none";
  } else {
    section.style.display = "";
  }
}

async function loadUsers(){
  const section = document.querySelector(
    ".user-management-operations"
  );

  if(!section){
    return false;
  }

  applyUserManagementVisibility();

  if(!canManageUsers()){
    return false;
  }

  const body = document.getElementById("usersBody");
  const badge = document.getElementById("usersLiveBadge");

  try {
    if(badge){
      badge.textContent = "Loading";
    }

    const response = await fetch(
      `${API_BASE}/api/users`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if(response.status === 401){
      window.location.href = "./login.html";
      return false;
    }

    if(response.status === 403){
      section.style.display = "none";
      return false;
    }

    if(!response.ok){
      throw new Error(
        `Users API returned HTTP ${response.status}`
      );
    }

    const result = await response.json();

    if(!result.success || !Array.isArray(result.data)){
      throw new Error("Invalid users API response");
    }

    LIVE_USERS = result.data;

    applyUserSummary();
    renderUsers();

    if(badge){
      badge.textContent = "Live";
    }

    console.log("Live user data loaded:", LIVE_USERS);

    return true;
  } catch(error) {
    console.error("Unable to load live user data:", error);

    if(badge){
      badge.textContent = "Error";
    }

    if(body){
      body.innerHTML = `
        <tr>
          <td colspan="7" class="muted user-management-empty">
            Unable to load users. Please try again.
          </td>
        </tr>
      `;
    }

    return false;
  }
}


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
      } catch(parseError) {
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

      const userId = Number(idInput.value);

      const newPassword = String(
        resetPasswordInput?.value || ""
      );

      const confirmPassword = String(
        resetPasswordConfirmInput?.value || ""
      );

      if(!editingUser){
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
        currentUser?.role === "admin" &&
        editingUser.role === "super_admin"
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
        } catch(parseError) {
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

      if(!editingUser){
        showDeleteUserMessage(
          "Please select a user before deleting the account."
        );
        return;
      }

      const userId = Number(idInput.value);
      const currentUserId = Number(currentUser?.id);
      const currentUserRole = currentUser?.role;

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
        editingUser.role === "super_admin"
      ){
        showDeleteUserMessage(
          "Administrators cannot delete a Super Admin."
        );
        return;
      }

      if(editingUser.status === "deleted"){
        showDeleteUserMessage(
          "This user is already deleted."
        );
        return;
      }

      const confirmed = window.confirm(
        `Delete user "${editingUser.fullName}" (${editingUser.email})?\n\n` +
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
        } catch(parseError) {
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

        await loadUsers();

        setTimeout(() => {
          closeModal();
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
      } catch(parseError) {
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
