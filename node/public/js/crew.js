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

