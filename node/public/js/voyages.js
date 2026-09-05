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
