const $ = (id) => document.getElementById(id);
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
function rand(min, max){ return Math.random() * (max - min) + min; }
function nowTime(){
  const d = new Date();
  return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
}

function moneyShort(n){
  // 25798000 => $25.798M
  const abs = Math.abs(n);
  if(abs >= 1e9) return `$${(n/1e9).toFixed(3)}B`;
  if(abs >= 1e6) return `$${(n/1e6).toFixed(3)}M`;
  if(abs >= 1e3) return `$${(n/1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function pct(a,b){ return b === 0 ? 0 : Math.round((a/b)*100); }

function setHeader(){
  const h = window.MOCK.header;
  $("kpiSales").textContent = moneyShort(h.salesMonth);
  $("kpiPerf").textContent = `${h.performance.toFixed(1)}%`;
  $("kpiPort").textContent = h.port;
  $("kpiTemp").textContent = `${h.tempF}°F`;
}

let capacityChart, sustainChart;

function makeDoughnut(canvasId, value, max, cutout=72){
  const ctx = $(canvasId).getContext("2d");
  return new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Used", "Remaining"],
      datasets: [{
        data: [value, Math.max(0, max - value)],
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: `${cutout}%`,
      plugins: {
        legend: { display:false },
        tooltip: { enabled:true }
      }
    }
  });
}

function setShips(){
  const s = window.MOCK.ships;
  $("activeShips").textContent = s.active;
  $("activeShipsSub").textContent = `${s.active} / ${s.total}`;
  $("totalCapacity").textContent = s.totalCapacityTons.toLocaleString();
  $("statPracticable").textContent = s.status.practicable;
  $("statRestricted").textContent = s.status.restricted;
  $("statOut").textContent = s.status.outOfService;

  const usedPct = pct(s.usedCapacityTons, s.totalCapacityTons);
  $("capacityPct").textContent = `${usedPct}%`;
  $("capacityTons").textContent = `${s.usedCapacityTons.toLocaleString()} t`;

  if(capacityChart) capacityChart.destroy();
  capacityChart = makeDoughnut("capacityGauge", s.usedCapacityTons, s.totalCapacityTons, 78);
}

function setBothShips(){
  const b = window.MOCK.bothShips;
  $("bothShipsBar").style.width = `${b.capacityPct}%`;
  $("recoveryPct").textContent = `${b.recoveryPct}%`;
}

function setAI(){
  const ai = window.MOCK.ai;
  $("fishName").textContent = ai.fishName;
  $("fishMeta").textContent = ai.meta;
  $("fishShare").textContent = `${ai.marketShare}%`;
  $("fishAnnual").textContent = `${ai.annualTons}K tons`;
  $("sustainScore").textContent = `${ai.sustainabilityScore}/100`;

  if(sustainChart) sustainChart.destroy();

  // A small semi-gauge using doughnut chart
  const ctx = $("sustainGauge").getContext("2d");
  sustainChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Score", "Remaining"],
      datasets: [{
        data: [ai.sustainabilityScore, 100 - ai.sustainabilityScore],
        borderWidth: 0,
      }]
    },
    options: {
      rotation: -90,
      circumference: 180,
      cutout: "78%",
      plugins: { legend: { display:false }, tooltip: { enabled:false } }
    }
  });
}

function setCapture(typeKey="mackerel"){
  const c = window.MOCK.capture;
  $("captureTrend").textContent = `+${c.trendPct.toFixed(1)}%`;

  $("captureNow").textContent = c.nowLb.toLocaleString();
  $("captureTarget").textContent = c.targetLb.toLocaleString();
  const p = Math.min(100, (c.nowLb / c.targetLb) * 100);
  $("captureBar").style.width = `${p}%`;

  const items = c.byType[typeKey] || [];
  const wrap = $("typeBreakdown");
  wrap.innerHTML = items.map(x => `
    <div class="break">
      <div class="label">${x.label}</div>
      <div class="val">${x.valueLb.toLocaleString()} lb</div>
    </div>
  `).join("");
}

function setCaptains(){
  const { zones, list } = window.MOCK.captains;

  const zoneSelect = $("zoneSelect");
  zoneSelect.innerHTML = `<option value="all">Zone: All</option>` +
    zones.map(z => `<option value="${z}">${z}</option>`).join("");

  const render = () => {
    const shift = $("shiftSelect").value;
    const zone = $("zoneSelect").value;

    const filtered = list.filter(c => {
      const okShift = (shift === "all") || (c.shift === shift);
      const okZone  = (zone === "all") || (c.zone === zone);
      return okShift && okZone;
    });

    $("captainsList").innerHTML = filtered.map(c => {
      const initials = c.name.split(" ").map(p => p[0]).slice(0,2).join("");
      const pillClass = c.status === "Active" ? "ok" : "warn";
      const navText = c.nav ? "In Navigation" : "Docked";
      return `
        <div class="cap">
          <div class="avatar">${initials}</div>
          <div>
            <div class="name">${c.name}</div>
            <div class="meta">${c.zone} • ${c.shift.toUpperCase()} shift</div>
            <div class="meta">${navText}</div>
          </div>
          <div class="right">
            <div class="pill ${pillClass}">${c.status}</div>
            <div class="meta">Utilization: <b>${c.util}%</b></div>
          </div>
        </div>
      `;
    }).join("");
  };

  $("shiftSelect").addEventListener("change", render);
  $("zoneSelect").addEventListener("change", render);
  render();
}

function setRadar(){
  const r = window.MOCK.radar;
  $("radarZone").textContent = r.zoneTitle;
  $("radarOcean").textContent = r.ocean;
  $("radarAnnual").textContent = r.annual;
  $("radarMeta").textContent = `${r.ships.length} ships • 1 route`;

  const canvas = $("radarCanvas");
  const ctx = canvas.getContext("2d");

  const draw = () => {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);

    // background grid
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1;

    for(let i=1;i<=4;i++){
      ctx.beginPath();
      ctx.arc(w*0.52, h*0.55, i*40, 0, Math.PI*2);
      ctx.strokeStyle = "rgba(255,255,255,.10)";
      ctx.stroke();
    }

    // cross lines
    ctx.beginPath();
    ctx.moveTo(w*0.52, 0); ctx.lineTo(w*0.52, h);
    ctx.moveTo(0, h*0.55); ctx.lineTo(w, h*0.55);
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.stroke();

    // route line
    ctx.beginPath();
    r.route.forEach((p, idx) => {
      if(idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = "rgba(140,220,255,.45)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // ships points
    r.ships.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI*2);
      ctx.fillStyle = "rgba(140,255,200,.85)";
      ctx.fill();

      ctx.font = "12px Inter, Arial";
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.fillText(s.label, s.x + 10, s.y + 4);
    });
  };

  draw();
}
function simulateRealtime(){
  // Update every 5 seconds
  setInterval(() => {
    const M = window.MOCK;

    // Sales month slowly increases
    M.header.salesMonth += Math.round(rand(2500, 12000));

    // Performance fluctuates
    M.header.performance = clamp(M.header.performance + rand(-0.4, 0.4), 70, 99);

    // Temp small changes
    M.header.tempF = Math.round(clamp(M.header.tempF + rand(-1, 1), 40, 85));

    // Capture changes (towards target)
    const step = Math.round(rand(-180, 320));
    M.capture.nowLb = clamp(M.capture.nowLb + step, 0, M.capture.targetLb + 2500);

    // Trend
    M.capture.trendPct = clamp(M.capture.trendPct + rand(-0.3, 0.3), -5, 12);

    // Capacity used changes a bit
    const deltaTons = Math.round(rand(-20, 35));
    M.ships.usedCapacityTons = clamp(M.ships.usedCapacityTons + deltaTons, 0, M.ships.totalCapacityTons);

    // Both-ships capacity bar
    M.bothShips.capacityPct = clamp(M.bothShips.capacityPct + rand(-2, 2), 20, 95);

    // Sustainability tiny drift
    M.ai.sustainabilityScore = Math.round(clamp(M.ai.sustainabilityScore + rand(-1, 1), 45, 95));

    // “Last update” chip
    const u = document.getElementById("lastUpdate");
    if(u) u.textContent = `Updated ${nowTime()}`;

    // Re-render UI pieces
    setHeader();
    setShips();
    setBothShips();
    setAI();

    // Respect selected capture tab
    const activeTab = document.querySelector(".seg-btn.active");
    const key = activeTab ? activeTab.dataset.type : "mackerel";
    setCapture(key);

  }, 5000);
}
function wireCaptureTabs(){
  document.querySelectorAll(".seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      setCapture(btn.dataset.type);
    });
  });
}

function init(){
  setHeader();
  setShips();
  setBothShips();
  setAI();
  setCapture("mackerel");
  setCaptains();
  setRadar();
  wireCaptureTabs();

  // Logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("marine_session");
      window.location.href = "./login.html";
    });
  }

  // Start realtime updates
  simulateRealtime();
}

// RUN init
init();
