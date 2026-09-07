function setHeader(){
  const metric = LIVE.summary?.dailyMetric;

  if(!metric){
    $("kpiSales").textContent = "—";
    $("kpiPerf").textContent = "—";
    $("kpiPort").textContent = "—";
    $("kpiTemp").textContent = "—";
    return;
  }

  $("kpiSales").textContent =
    moneyShort(Number(metric.salesAmount || 0));

  $("kpiPerf").textContent =
    `${Number(metric.performancePercent || 0).toFixed(1)}%`;

  $("kpiPort").textContent = "—";
  $("kpiTemp").textContent = "—";
}

function makeDoughnut(canvasId, value, max, cutout=72){
  const canvas = $(canvasId);

  if(!canvas) return null;

  const ctx = canvas.getContext("2d");

  return new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Active", "Remaining"],
      datasets: [{
        data: [
          value,
          Math.max(0, max - value)
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: `${cutout}%`,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true
        }
      }
    }
  });
}

function setShips(){
  const vessels = LIVE.summary?.vessels;

  if(!vessels){
    $("activeShips").textContent = "—";
    $("activeShipsSub").textContent = "—";
    $("totalCapacity").textContent = "—";
    $("statPracticable").textContent = "—";
    $("statRestricted").textContent = "—";
    $("statOut").textContent = "—";
    $("capacityPct").textContent = "—";
    $("capacityTons").textContent = "—";
    return;
  }

  const totalCapacityTons = Number(vessels.totalCapacityTons || 0);
  const activeCapacityTons = Number(vessels.activeCapacityTons || 0);
  const operationalPct = pct(
    activeCapacityTons,
    totalCapacityTons
  );

  $("activeShips").textContent = vessels.active;
  $("activeShipsSub").textContent =
    `${vessels.active} / ${vessels.total}`;

  $("totalCapacity").textContent =
    totalCapacityTons.toLocaleString();

  $("statPracticable").textContent =
    vessels.active;

  $("statRestricted").textContent =
    vessels.restricted;

  $("statOut").textContent =
    vessels.outOfService;

  $("capacityPct").textContent =
    `${operationalPct}%`;

  $("capacityTons").textContent =
    `${activeCapacityTons.toLocaleString()} t active`;

  if(capacityChart){
    capacityChart.destroy();
  }

  capacityChart = makeDoughnut(
    "capacityGauge",
    activeCapacityTons,
    totalCapacityTons,
    78
  );
}

function setBothShips(){
  const vessels = LIVE.summary?.vessels;

  if(!vessels){
    $("bothShipsBar").style.width = "0%";
    $("recoveryPct").textContent = "—";
    return;
  }

  const totalCapacityTons =
    Number(vessels.totalCapacityTons || 0);

  const activeCapacityTons =
    Number(vessels.activeCapacityTons || 0);

  const capacityPct =
    totalCapacityTons > 0
      ? Math.min(
          100,
          (activeCapacityTons / totalCapacityTons) * 100
        )
      : 0;

  $("bothShipsBar").style.width =
    `${capacityPct}%`;

  $("recoveryPct").textContent =
    `${vessels.active} / ${vessels.total}`;
}

async function setCatchInsight(){
  const name = $("fishName");
  const meta = $("fishMeta");
  const share = $("fishShare");
  const total = $("fishAnnual");
  const score = $("sustainScore");

  try {
    const response = await fetch(`${API_BASE}/api/catch`, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if(!response.ok){
      throw new Error(`Catch API returned HTTP ${response.status}`);
    }

    const result = await response.json();

    if(!result.success || !result.data){
      throw new Error("Invalid catch API response");
    }

    const breakdown = Array.isArray(result.data.speciesBreakdown)
      ? result.data.speciesBreakdown
      : [];

    if(!breakdown.length || Number(result.data.summary?.totalCatchKg || 0) <= 0){
      name.textContent = "No catch recorded";
      meta.textContent = "Live catch data";
      share.textContent = "0%";
      total.textContent = "0 kg";
      score.textContent = "0%";
      renderCatchGauge(0);
      return;
    }

    const leading = breakdown[0];
    const totalCatchKg = Number(result.data.summary.totalCatchKg || 0);
    const leadingCatchKg = Number(leading.quantityKg || 0);
    const catchShare = totalCatchKg > 0
      ? Math.round((leadingCatchKg / totalCatchKg) * 100)
      : 0;

    name.textContent = leading.species;
    meta.textContent = "Leading species • all recorded catch";
    share.textContent = `${catchShare}%`;
    total.textContent = `${leadingCatchKg.toLocaleString()} kg`;
    score.textContent = `${catchShare}%`;
    renderCatchGauge(catchShare);

  } catch(error) {
    console.error("Unable to load catch insight:", error);

    name.textContent = "Catch data unavailable";
    meta.textContent = "Live catch data could not be loaded";
    share.textContent = "—";
    total.textContent = "—";
    score.textContent = "—";
    renderCatchGauge(0);
  }
}

function renderCatchGauge(value){
  if(sustainChart){
    sustainChart.destroy();
  }

  const ctx = $("sustainGauge").getContext("2d");

  sustainChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Catch share", "Remaining"],
      datasets: [{
        data: [value, 100 - value],
        borderWidth: 0
      }]
    },
    options: {
      rotation: -90,
      circumference: 180,
      cutout: "78%",
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      }
    }
  });
}

function setCapture(){
  const summary = LIVE.summary;

  if(!summary){
    $("captureTrend").textContent = "—";
    $("captureNow").textContent = "—";
    $("captureTarget").textContent = "—";
    $("captureBar").style.width = "0%";

    const wrap = $("typeBreakdown");
    if(wrap){
      wrap.innerHTML = `<div class="break"><div class="label">Live data unavailable</div><div class="val">—</div></div>`;
    }
    return;
  }

  const operations = summary.operations || {};
  const todayMetric = summary.todayMetric;
  const species = summary.todaySpeciesBreakdown || [];

  const captureKg = Number(operations.captureKg || 0);
  const captureLb = Math.round(captureKg * 2.2046226218);

  $("captureNow").textContent =
    captureLb.toLocaleString();

  if(todayMetric){
    const targetKg = Number(todayMetric.targetCaptureKg || 0);
    const targetLb = Math.round(targetKg * 2.2046226218);

    $("captureTarget").textContent =
      targetLb.toLocaleString();

    const progress =
      targetLb > 0
        ? Math.min(100, (captureLb / targetLb) * 100)
        : 0;

    $("captureBar").style.width =
      `${progress}%`;
  } else {
    $("captureTarget").textContent = "—";
    $("captureBar").style.width = "0%";
  }

  $("captureTrend").textContent = "—";

  const wrap = $("typeBreakdown");

  if(!wrap) return;

  if(species.length === 0){
    wrap.innerHTML = `
      <div class="break">
        <div class="label">No catch recorded today</div>
        <div class="val">0 lb</div>
      </div>
    `;
    return;
  }

  wrap.innerHTML =
    species.map(item => {
      const quantityKg = Number(item.quantityKg || 0);
      const quantityLb = Math.round(quantityKg * 2.2046226218);

      return `
        <div class="break">
          <div class="label">${escapeHtml(item.species || "Unknown")}</div>
          <div class="val">${quantityLb.toLocaleString()} lb</div>
        </div>
      `;
    }).join("");
}

async function setCaptains(){
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

function formatPositionTimestamp(value){
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

function setRadar(){
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
    const formattedTimestamp = formatPositionTimestamp(timestamp);

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


/*
 * No more fake random database values.
 *
 * We periodically refresh the real API instead.
 */
