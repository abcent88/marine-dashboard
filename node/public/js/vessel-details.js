window.loadVesselDetailsImpl = async function(vesselId){
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
  closeVesselButton.addEventListener("click", () => {
    window.closeVesselDetailsImpl();
  });
}

/*
 * Close the Vessel Details panel and restore its
 * initial empty state.
 */
window.closeVesselDetailsImpl = function(){
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
