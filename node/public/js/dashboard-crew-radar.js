async function setCaptainsImpl(){
  const select = $("crewStatusSelect");
  const list = $("captainsList");

  if(!select || !list) return;

  list.innerHTML =
    `<div class="muted small">Loading live crew data...</div>`;

  try {
    const response = await fetch(`${API_BASE}/api/crew`, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if(!response.ok){
      throw new Error(`Crew API returned HTTP ${response.status}`);
    }

    const result = await response.json();

    if(!result.success || !result.data || !Array.isArray(result.data.crew)){
      throw new Error("Invalid crew API response");
    }

    const crew = result.data.crew.filter(member =>
      String(member.position || "").toLowerCase() === "captain"
    );

    const render = () => {
      const status = select.value;

      const filtered = crew.filter(member =>
        status === "all" ||
        member.status === status
      );

      if(filtered.length === 0){
        list.innerHTML =
          `<div class="muted small">No captains match this status.</div>`;
        return;
      }

      list.innerHTML =
        filtered.map(member => {
          const initials =
            String(member.fullName || "?")
              .trim()
              .split(/\\s+/)
              .map(part => part[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

          const statusLabel =
            String(member.status || "unknown")
              .replace(/_/g, " ")
              .replace(/\\b\\w/g, char => char.toUpperCase());

          const pillClass =
            member.status === "active"
              ? "ok"
              : "warn";

          const vesselLabel =
            member.vesselCode && member.vesselName
              ? `${escapeHtml(member.vesselCode)} • ${escapeHtml(member.vesselName)}`
              : "No vessel assigned";

          const vesselStatus =
            member.vesselStatus
              ? String(member.vesselStatus)
                  .replace(/_/g, " ")
                  .replace(/\\b\\w/g, char => char.toUpperCase())
              : "Unknown";

          const certification =
            member.certification
              ? escapeHtml(member.certification)
              : "Certification not recorded";

          return `
            <div class="cap">
              <div class="avatar">${escapeHtml(initials)}</div>

              <div>
                <div class="name">${escapeHtml(member.fullName || "Unknown")}</div>
                <div class="meta">
                  ${escapeHtml(member.position || "Crew")} • ${vesselLabel}
                </div>
                <div class="meta">
                  Vessel status: ${escapeHtml(vesselStatus)}
                </div>
              </div>

              <div class="right">
                <div class="pill ${pillClass}">
                  ${escapeHtml(statusLabel)}
                </div>

                <div class="meta">
                  ${certification}
                </div>
              </div>
            </div>
          `;
        }).join("");
    };

    select.onchange = render;
    render();

  } catch(error) {
    console.error("Unable to load live crew data:", error);

    list.innerHTML =
      `<div class="muted small">Live crew data unavailable</div>`;
  }
}

function formatPositionTimestampImpl(value){
  if(!value) return "time unavailable";

  const date = new Date(String(value).replace(" ", "T"));

  if(Number.isNaN(date.getTime())){
    return String(value);
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function setRadarImpl(){
  const tracking = LIVE.summary?.tracking;
  const positions = tracking?.positions || [];

  const zone = $("radarZone");
  const ocean = $("radarOcean");
  const annual = $("radarAnnual");
  const meta = $("radarMeta");
  const canvas = $("radarCanvas");

  if(!canvas) return;

  if(zone){
    zone.textContent = positions.length > 0
      ? "Latest vessel positions"
      : "No vessel positions";
  }

  if(ocean){
    ocean.textContent = "Coordinates";
  }

  if(annual){
    annual.textContent = tracking
      ? `${tracking.trackedVessels} tracked`
      : "—";
  }

  if(meta){
    const latest = positions[0];
    const source = latest?.positionSource || "unknown";
    const timestamp = latest?.sourceTimestamp || latest?.recordedAt;
    const formattedTimestamp = formatPositionTimestampImpl(timestamp);

    meta.textContent = latest
      ? `${positions.length} vessel${positions.length === 1 ? "" : "s"} • ${source.toUpperCase()} • ${formattedTimestamp}`
      : "No vessel positions available";
  }

  const ctx = canvas.getContext("2d");

  const draw = () => {
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1;

    for(let i = 1; i <= 4; i++){
      ctx.beginPath();

      ctx.arc(
        w * 0.52,
        h * 0.55,
        i * 40,
        0,
        Math.PI * 2
      );

      ctx.strokeStyle =
        "rgba(255,255,255,.10)";

      ctx.stroke();
    }

    ctx.beginPath();

    ctx.moveTo(
      w * 0.52,
      0
    );

    ctx.lineTo(
      w * 0.52,
      h
    );

    ctx.moveTo(
      0,
      h * 0.55
    );

    ctx.lineTo(
      w,
      h * 0.55
    );

    ctx.strokeStyle =
      "rgba(255,255,255,.08)";

    ctx.stroke();

    if(positions.length === 0){
      ctx.font =
        "12px Inter, Arial";

      ctx.fillStyle =
        "rgba(255,255,255,.55)";

      ctx.textAlign = "center";

      ctx.fillText(
        "No vessel positions available",
        w * 0.52,
        h * 0.55
      );

      ctx.textAlign = "start";
      return;
    }

    const latitudes =
      positions.map(position => Number(position.latitude));

    const longitudes =
      positions.map(position => Number(position.longitude));

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);

    const latRange = Math.max(maxLat - minLat, 0.01);
    const lonRange = Math.max(maxLon - minLon, 0.01);

    const padding = 30;

    const toCanvas = position => ({
      x:
        padding +
        ((Number(position.longitude) - minLon) / lonRange) *
        (w - padding * 2),
      y:
        h -
        padding -
        ((Number(position.latitude) - minLat) / latRange) *
        (h - padding * 2)
    });

    positions.forEach(position => {
      const point = toCanvas(position);

      ctx.beginPath();

      ctx.arc(
        point.x,
        point.y,
        6,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        "rgba(140,255,200,.85)";

      ctx.fill();

      ctx.font =
        "12px Inter, Arial";

      ctx.fillStyle =
        "rgba(255,255,255,.75)";

      ctx.fillText(
        position.vesselCode || "Vessel",
        point.x + 10,
        point.y + 4
      );
    });
  };


  draw();
}

window.formatPositionTimestampImpl = formatPositionTimestampImpl;
window.setCaptainsImpl = setCaptainsImpl;
window.setRadarImpl = setRadarImpl;
