function setHeader(){
  /*
   * Header values still use the existing mock data for now.
   * We will connect sales, performance, port and weather
   * to real sources in the next API expansion.
   */
  const h = window.MOCK.header;

  $("kpiSales").textContent =
    moneyShort(h.salesMonth);

  $("kpiPerf").textContent =
    `${h.performance.toFixed(1)}%`;

  $("kpiPort").textContent =
    h.port;

  $("kpiTemp").textContent =
    `${h.tempF}°F`;
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
  const s = window.MOCK.ships;

  $("activeShips").textContent =
    s.active;

  $("activeShipsSub").textContent =
    `${s.active} / ${s.total}`;

  $("totalCapacity").textContent =
    s.totalCapacityTons.toLocaleString();

  $("statPracticable").textContent =
    s.status.practicable;

  $("statRestricted").textContent =
    s.status.restricted;

  $("statOut").textContent =
    s.status.outOfService;

  const usedPct =
    pct(s.usedCapacityTons, s.totalCapacityTons);

  $("capacityPct").textContent =
    `${usedPct}%`;

  $("capacityTons").textContent =
    `${s.usedCapacityTons.toLocaleString()} t`;

  if(capacityChart){
    capacityChart.destroy();
  }

  capacityChart = makeDoughnut(
    "capacityGauge",
    s.usedCapacityTons,
    s.totalCapacityTons,
    78
  );
}

function setBothShips(){
  const b = window.MOCK.bothShips;

  $("bothShipsBar").style.width =
    `${b.capacityPct}%`;

  $("recoveryPct").textContent =
    `${b.recoveryPct}%`;
}

function setAI(){
  const ai = window.MOCK.ai;

  $("fishName").textContent =
    ai.fishName;

  $("fishMeta").textContent =
    ai.meta;

  $("fishShare").textContent =
    `${ai.marketShare}%`;

  $("fishAnnual").textContent =
    `${ai.annualTons}K tons`;

  $("sustainScore").textContent =
    `${ai.sustainabilityScore}/100`;

  if(sustainChart){
    sustainChart.destroy();
  }

  const ctx =
    $("sustainGauge").getContext("2d");

  sustainChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Score", "Remaining"],
      datasets: [{
        data: [
          ai.sustainabilityScore,
          100 - ai.sustainabilityScore
        ],
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

function setCapture(typeKey="mackerel"){
  const c = window.MOCK.capture;

  $("captureTrend").textContent =
    `+${c.trendPct.toFixed(1)}%`;

  /*
   * Fallback/mock display.
   * Live capture values are applied by applyLiveSummary().
   */
  $("captureNow").textContent =
    c.nowLb.toLocaleString();

  $("captureTarget").textContent =
    c.targetLb.toLocaleString();

  const p =
    Math.min(
      100,
      (c.nowLb / c.targetLb) * 100
    );

  $("captureBar").style.width =
    `${p}%`;

  const items =
    c.byType[typeKey] || [];

  const wrap =
    $("typeBreakdown");

  wrap.innerHTML =
    items.map(x => `
      <div class="break">
        <div class="label">${x.label}</div>
        <div class="val">${x.valueLb.toLocaleString()} lb</div>
      </div>
    `).join("");
}

function setCaptains(){
  const {
    zones,
    list
  } = window.MOCK.captains;

  const zoneSelect =
    $("zoneSelect");

  zoneSelect.innerHTML =
    `<option value="all">Zone: All</option>` +
    zones.map(z =>
      `<option value="${z}">${z}</option>`
    ).join("");

  const render = () => {
    const shift =
      $("shiftSelect").value;

    const zone =
      $("zoneSelect").value;

    const filtered =
      list.filter(c => {
        const okShift =
          shift === "all" ||
          c.shift === shift;

        const okZone =
          zone === "all" ||
          c.zone === zone;

        return okShift && okZone;
      });

    $("captainsList").innerHTML =
      filtered.map(c => {
        const initials =
          c.name
            .split(" ")
            .map(p => p[0])
            .slice(0, 2)
            .join("");

        const pillClass =
          c.status === "Active"
            ? "ok"
            : "warn";

        const navText =
          c.nav
            ? "In Navigation"
            : "Docked";

        return `
          <div class="cap">
            <div class="avatar">${initials}</div>

            <div>
              <div class="name">${c.name}</div>
              <div class="meta">
                ${c.zone} • ${c.shift.toUpperCase()} shift
              </div>
              <div class="meta">
                ${navText}
              </div>
            </div>

            <div class="right">
              <div class="pill ${pillClass}">
                ${c.status}
              </div>

              <div class="meta">
                Utilization:
                <b>${c.util}%</b>
              </div>
            </div>
          </div>
        `;
      }).join("");
  };

  $("shiftSelect")
    .addEventListener("change", render);

  $("zoneSelect")
    .addEventListener("change", render);

  render();
}

function setRadar(){
  const r = window.MOCK.radar;

  $("radarZone").textContent =
    r.zoneTitle;

  $("radarOcean").textContent =
    r.ocean;

  $("radarAnnual").textContent =
    r.annual;

  $("radarMeta").textContent =
    `${r.ships.length} ships • 1 route`;

  const canvas =
    $("radarCanvas");

  const ctx =
    canvas.getContext("2d");

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

    ctx.beginPath();

    r.route.forEach((p, idx) => {
      if(idx === 0){
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    });

    ctx.strokeStyle =
      "rgba(140,220,255,.45)";

    ctx.lineWidth = 3;
    ctx.stroke();

    r.ships.forEach(s => {
      ctx.beginPath();

      ctx.arc(
        s.x,
        s.y,
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
        s.label,
        s.x + 10,
        s.y + 4
      );
    });
  };

  draw();
}

function wireCaptureTabs(){
  document
    .querySelectorAll(".seg-btn")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".seg-btn")
          .forEach(b =>
            b.classList.remove("active")
          );

        btn.classList.add("active");

        setCapture(
          btn.dataset.type
        );

        /*
         * Reapply live total after changing tabs.
         */
        if(LIVE.summary){
          applyLiveSummary();
        }
      });
    });
}

/*
 * No more fake random database values.
 *
 * We periodically refresh the real API instead.
 */
