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
