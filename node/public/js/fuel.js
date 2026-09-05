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
