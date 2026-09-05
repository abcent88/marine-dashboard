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

