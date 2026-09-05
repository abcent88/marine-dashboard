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

