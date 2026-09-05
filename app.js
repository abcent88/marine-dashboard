const $ = (id) => document.getElementById(id);

const API_BASE = "http://127.0.0.1:3001";

let capacityChart;
let sustainChart;

/*
 * Live dashboard state.
 *
 * We start with the existing mock data so the dashboard
 * can still render if the API is temporarily unavailable.
 */
const LIVE = {
  summary: null,
  vessels: []
};


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

function openEditVesselModal(vesselId){
  const vessel = Array.isArray(LIVE.vessels)
    ? LIVE.vessels.find(
        item => String(item.id) === String(vesselId)
      )
    : null;

  if(!vessel){
    console.error(
      "Unable to edit vessel: vessel not found.",
      vesselId
    );
    return;
  }

  const existing =
    document.getElementById("editVesselModal");

  if(existing){
    existing.remove();
  }

  const modal = document.createElement("div");

  modal.id = "editVesselModal";
  modal.className = "vessel-management-modal";

  const vesselName =
    escapeHtml(vessel.name || "");

  const vesselCode =
    escapeHtml(vessel.vesselCode || "");

  const vesselType =
    escapeHtml(vessel.vesselType || "");

  const flagCountry =
    escapeHtml(vessel.flagCountry || "");

  const imoNumber =
    escapeHtml(vessel.imoNumber || "");

  const callSign =
    escapeHtml(vessel.callSign || "");

  const capacityTons =
    Number(vessel.capacityTons || 0);

  const status =
    String(vessel.status || "active");

  const homePortId =
    vessel.homePort && vessel.homePort.id
      ? Number(vessel.homePort.id)
      : "";

  const commissionedDate =
    vessel.commissionedDate
      ? String(vessel.commissionedDate).slice(0, 10)
      : "";

  modal.innerHTML = `
    <div
      class="vessel-management-backdrop"
      data-edit-vessel-modal-close
    ></div>

    <div
      class="vessel-management-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editVesselTitle"
    >
      <div class="vessel-management-dialog-head">
        <div>
          <div
            class="card-title"
            id="editVesselTitle"
          >
            Edit Vessel
          </div>

          <div class="muted small">
            Update the selected vessel in the live fleet database.
          </div>
        </div>

        <button
          type="button"
          class="badge"
          data-edit-vessel-modal-close
        >
          Close
        </button>
      </div>

      <form
        id="editVesselForm"
        class="vessel-management-form"
      >
        <div class="vessel-form-grid">

          <label>
            <span>Vessel Code *</span>
            <input
              type="text"
              name="vesselCode"
              maxlength="50"
              required
              value="${vesselCode}"
            >
          </label>

          <label>
            <span>Vessel Name *</span>
            <input
              type="text"
              name="name"
              maxlength="150"
              required
              value="${vesselName}"
            >
          </label>

          <label>
            <span>Vessel Type *</span>
            <input
              type="text"
              name="vesselType"
              maxlength="100"
              required
              value="${vesselType}"
            >
          </label>

          <label>
            <span>Flag Country</span>
            <input
              type="text"
              name="flagCountry"
              maxlength="100"
              value="${flagCountry}"
            >
          </label>

          <label>
            <span>IMO Number</span>
            <input
              type="text"
              name="imoNumber"
              maxlength="20"
              value="${imoNumber}"
            >
          </label>

          <label>
            <span>Call Sign</span>
            <input
              type="text"
              name="callSign"
              maxlength="50"
              value="${callSign}"
            >
          </label>

          <label>
            <span>Capacity (tons) *</span>
            <input
              type="number"
              name="capacityTons"
              min="0"
              step="0.01"
              required
              value="${capacityTons}"
            >
          </label>

          <label>
            <span>Status *</span>
            <select name="status" required>
              <option
                value="active"
                ${status === "active" ? "selected" : ""}
              >
                Active
              </option>

              <option
                value="restricted"
                ${status === "restricted" ? "selected" : ""}
              >
                Restricted
              </option>

              <option
                value="maintenance"
                ${status === "maintenance" ? "selected" : ""}
              >
                Maintenance
              </option>

              <option
                value="out_of_service"
                ${status === "out_of_service" ? "selected" : ""}
              >
                Out of Service
              </option>

              <option
                value="retired"
                ${status === "retired" ? "selected" : ""}
              >
                Retired
              </option>
            </select>
          </label>

          <label>
            <span>Home Port ID</span>
            <input
              type="number"
              name="homePortId"
              min="1"
              step="1"
              value="${homePortId}"
              placeholder="Optional"
            >
          </label>

          <label>
            <span>Commissioned Date</span>
            <input
              type="date"
              name="commissionedDate"
              value="${commissionedDate}"
            >
          </label>

        </div>

        <div
          id="editVesselMessage"
          class="vessel-management-message"
          aria-live="polite"
        ></div>

        <div class="vessel-management-form-actions">

          <button
            type="button"
            class="fleet-management-btn vessel-modal-cancel"
            data-edit-vessel-modal-close
          >
            Cancel
          </button>

          <button
            type="submit"
            class="fleet-management-btn"
            id="updateVesselBtn"
          >
            Update Vessel
          </button>

        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form =
    document.getElementById("editVesselForm");

  const message =
    document.getElementById("editVesselMessage");

  const updateButton =
    document.getElementById("updateVesselBtn");

  const closeModal = () => {
    modal.remove();
  };

  modal
    .querySelectorAll("[data-edit-vessel-modal-close]")
    .forEach(element => {
      element.addEventListener(
        "click",
        closeModal
      );
    });

  const handleEscape = event => {
    if(event.key === "Escape"){
      closeModal();

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    }
  };

  document.addEventListener(
    "keydown",
    handleEscape
  );

  form.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      if(updateButton){
        updateButton.disabled = true;
        updateButton.textContent = "Updating...";
      }

      if(message){
        message.textContent = "";
        message.className =
          "vessel-management-message";
      }

      const formData =
        new FormData(form);

      const payload = {
        vesselCode: String(
          formData.get("vesselCode") || ""
        ).trim(),

        name: String(
          formData.get("name") || ""
        ).trim(),

        vesselType: String(
          formData.get("vesselType") || ""
        ).trim(),

        flagCountry: String(
          formData.get("flagCountry") || ""
        ).trim() || null,

        imoNumber: String(
          formData.get("imoNumber") || ""
        ).trim() || null,

        callSign: String(
          formData.get("callSign") || ""
        ).trim() || null,

        capacityTons: Number(
          formData.get("capacityTons") || 0
        ),

        status: String(
          formData.get("status") || "active"
        ),

        homePortId:
          formData.get("homePortId")
            ? Number(formData.get("homePortId"))
            : null,

        commissionedDate:
          String(
            formData.get("commissionedDate") || ""
          ).trim() || null
      };

      try {
        const response = await fetch(
          `${API_BASE}/api/vessels/${encodeURIComponent(vesselId)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify(payload)
          }
        );

        const result =
          await response.json();

        if(
          !response.ok ||
          !result.success
        ){
          throw new Error(
            result.error ||
            result.message ||
            `Vessel API returned HTTP ${response.status}`
          );
        }

        if(message){
          message.textContent =
            "Vessel updated successfully.";

          message.className =
            "vessel-management-message success";
        }

        await loadVessels();

        setTimeout(() => {
          closeModal();
        }, 700);

      } catch(error) {
        console.error(
          "Update vessel failed:",
          error
        );

        if(message){
          message.textContent =
            error.message ||
            "Unable to update vessel.";

          message.className =
            "vessel-management-message error";
        }

        if(updateButton){
          updateButton.disabled = false;
          updateButton.textContent =
            "Update Vessel";
        }
      }
    }
  );

  const firstInput =
    form.querySelector("input");

  if(firstInput){
    firstInput.focus();
  }
}

function startLiveRefresh(){
  setInterval(() => {
    loadDashboardSummary();
    loadVessels();
    loadVoyages();
    loadFuel();
    loadMaintenance();
    loadAlerts();
    loadCrew();
    loadCatch();
    loadReports();
    loadUsers();
  }, 30000);
}

async function init(){
  /*
   * Server-side authentication guard.
   * The dashboard must verify the active session
   * before rendering protected dashboard data.
   */
  try {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
      headers: {
        "Accept": "application/json"
      }
    });

    if(!response.ok){
      window.location.href = "./login.html";
      return;
    }

    const result = await response.json();

    if(!result.success || !result.data){
      window.location.href = "./login.html";
      return;
    }

    /*
     * Keep the current user available to existing
     * frontend code while server session remains
     * the authentication authority.
     */
    localStorage.setItem(
      "marine_session",
      JSON.stringify({
        user: result.data,
        createdAt: Date.now()
      })
    );
  } catch(error) {
    console.error(
      "Authentication check failed:",
      error
    );

    window.location.href = "./login.html";
    return;
  }

  /*
   * Render existing interface first.
   * This guarantees the UI appears immediately.
   */
  setHeader();
  setShips();
  setBothShips();
  setAI();
  setCapture("mackerel");
  setCaptains();
  setRadar();
  wireCaptureTabs();

  /*
   * Logout
   */
  const logoutBtn =
    document.getElementById("logoutBtn");

  if(logoutBtn){
    logoutBtn.addEventListener("click", async () => {
      logoutBtn.disabled = true;

      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          headers: {
            "Accept": "application/json"
          }
        });

        if(!response.ok){
          throw new Error("Logout request failed.");
        }

        localStorage.removeItem(
          "marine_session"
        );

        window.location.href =
          "./login.html";
      } catch(error) {
        console.error(
          "Logout error:",
          error
        );

        logoutBtn.disabled = false;

        alert(
          "Unable to log out. Please try again."
        );
      }
    });
  }

  /*
   * Load real vessel records from MariaDB.
   */
  await loadVessels();

  /*
   * Enable vessel management controls.
   */
  initVesselManagement();

  /*
   * Replace mock fleet/operations figures
   * with the real database-backed API data.
   */
  await loadDashboardSummary();

  /*
   * Load real voyage records from MariaDB.
   */
  await loadVoyages();

  /*
   * Load real fuel consumption records from MariaDB.
   */
  await loadFuel();

  /*
   * Load real maintenance records from MariaDB.
   */
  await loadMaintenance();

  /*
   * Load real alerts and notifications from MariaDB.
   */
  await loadAlerts();

  /*
   * Load real crew records from MariaDB.
   */
  await loadCrew();

  /*
   * Load real catch and production records from MariaDB.
   */
  await loadCatch();

  /*
   * Load live user management data.
   * The module remains hidden for unauthorized roles.
   */
  await loadUsers();
  initUserManagement();
  initEditUserManagement();

  /*
   * Refresh live data every 30 seconds.
   */
  loadReports();
  startLiveRefresh();
}

init();
