window.loadVesselsImpl = async function(){
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
 * Attach click handlers to the live vessel rows.
 */
window.bindVesselRowClicksImpl = function(){
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

window.applyLiveVesselsImpl = function(){
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
