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
