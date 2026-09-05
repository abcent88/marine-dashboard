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
