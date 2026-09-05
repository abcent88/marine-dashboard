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

function openVesselManagementModal(){
  const existing = document.getElementById("vesselManagementModal");

  if(existing){
    existing.remove();
  }

  const modal = document.createElement("div");
  modal.id = "vesselManagementModal";
  modal.className = "vessel-management-modal";
  modal.innerHTML = `
    <div
      class="vessel-management-backdrop"
      data-vessel-modal-close
    ></div>

    <div
      class="vessel-management-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vesselManagementTitle"
    >
      <div class="vessel-management-dialog-head">
        <div>
          <div
            class="card-title"
            id="vesselManagementTitle"
          >
            Add Vessel
          </div>

          <div class="muted small">
            Create a new vessel in the live fleet database.
          </div>
        </div>

        <button
          type="button"
          class="badge"
          data-vessel-modal-close
        >
          Close
        </button>
      </div>

      <form id="addVesselForm" class="vessel-management-form">
        <div class="vessel-form-grid">

          <label>
            <span>Vessel Code *</span>
            <input
              type="text"
              name="vesselCode"
              maxlength="50"
              required
              placeholder="e.g. MD-008"
            >
          </label>

          <label>
            <span>Vessel Name *</span>
            <input
              type="text"
              name="name"
              maxlength="150"
              required
              placeholder="e.g. Ocean Guardian"
            >
          </label>

          <label>
            <span>Vessel Type *</span>
            <input
              type="text"
              name="vesselType"
              maxlength="100"
              required
              placeholder="e.g. Fishing Vessel"
            >
          </label>

          <label>
            <span>Flag Country</span>
            <input
              type="text"
              name="flagCountry"
              maxlength="100"
              placeholder="e.g. Nigeria"
            >
          </label>

          <label>
            <span>IMO Number</span>
            <input
              type="text"
              name="imoNumber"
              maxlength="20"
              placeholder="Optional"
            >
          </label>

          <label>
            <span>Call Sign</span>
            <input
              type="text"
              name="callSign"
              maxlength="50"
              placeholder="Optional"
            >
          </label>

          <label>
            <span>Capacity (tons) *</span>
            <input
              type="number"
              name="capacityTons"
              min="0"
              step="0.01"
              value="0"
              required
            >
          </label>

          <label>
            <span>Status *</span>
            <select name="status" required>
              <option value="active">Active</option>
              <option value="restricted">Restricted</option>
              <option value="maintenance">Maintenance</option>
              <option value="out_of_service">Out of Service</option>
            </select>
          </label>

          <label>
            <span>Home Port ID</span>
            <input
              type="number"
              name="homePortId"
              min="1"
              step="1"
              placeholder="Optional"
            >
          </label>

          <label>
            <span>Commissioned Date</span>
            <input
              type="date"
              name="commissionedDate"
            >
          </label>

        </div>

        <div
          id="addVesselMessage"
          class="vessel-management-message"
          aria-live="polite"
        ></div>

        <div class="vessel-management-form-actions">
          <button
            type="button"
            class="fleet-management-btn vessel-modal-cancel"
            data-vessel-modal-close
          >
            Cancel
          </button>

          <button
            type="submit"
            class="fleet-management-btn"
            id="saveVesselBtn"
          >
            Create Vessel
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = document.getElementById("addVesselForm");
  const message = document.getElementById("addVesselMessage");
  const saveButton = document.getElementById("saveVesselBtn");

  const closeModal = () => {
    modal.remove();
  };

  modal.querySelectorAll("[data-vessel-modal-close]")
    .forEach(element => {
      element.addEventListener("click", closeModal);
    });

  document.addEventListener("keydown", function handleEscape(event){
    if(event.key === "Escape"){
      closeModal();
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if(saveButton){
      saveButton.disabled = true;
      saveButton.textContent = "Creating...";
    }

    if(message){
      message.textContent = "";
      message.className = "vessel-management-message";
    }

    const formData = new FormData(form);

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
        `${API_BASE}/api/vessels`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json();

      if(!response.ok || !result.success){
        throw new Error(
          result.error ||
          result.message ||
          `Vessel API returned HTTP ${response.status}`
        );
      }

      if(message){
        message.textContent =
          "Vessel created successfully.";

        message.className =
          "vessel-management-message success";
      }

      await loadVessels();

      setTimeout(() => {
        closeModal();
      }, 700);

    } catch(error) {
      console.error(
        "Create vessel failed:",
        error
      );

      if(message){
        message.textContent =
          error.message ||
          "Unable to create vessel.";

        message.className =
          "vessel-management-message error";
      }

      if(saveButton){
        saveButton.disabled = false;
        saveButton.textContent = "Create Vessel";
      }
    }
  });

  const firstInput =
    form.querySelector("input");

  if(firstInput){
    firstInput.focus();
  }
}

function initVesselManagement(){
  const addButton =
    document.getElementById("addVesselBtn");

  if(!addButton){
    console.warn(
      "Add Vessel button not found."
    );
    return;
  }

  addButton.addEventListener(
    "click",
    openVesselManagementModal
  );
}


/*
 * User & Access Management
 * Only Super Admin and Admin users can access this module.
 */

let LIVE_USERS = [];

function currentDashboardUser(){
  try {
    const raw = localStorage.getItem("marine_session");

    if(!raw){
      return null;
    }

    const session = JSON.parse(raw);

    return session?.user || null;
  } catch(error) {
    console.error("Unable to read current dashboard user:", error);
    return null;
  }
}

function canManageUsers(){
  const user = currentDashboardUser();

  return Boolean(
    user &&
    ["super_admin", "admin"].includes(user.role)
  );
}

function formatUserDate(value){
  if(!value){
    return "Never";
  }

  const date = new Date(value);

  if(Number.isNaN(date.getTime())){
    return "—";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function userRoleLabel(role){
  const labels = {
    super_admin: "Super Admin",
    admin: "Admin",
    manager: "Manager",
    captain: "Captain",
    crew: "Crew",
    operator: "Operator",
    viewer: "Viewer"
  };

  return labels[role] || role || "Unknown";
}

function userStatusClass(status){
  if(status === "inactive"){
    return "inactive";
  }

  if(status === "suspended"){
    return "suspended";
  }

  if(status === "deleted"){
    return "deleted";
  }

  return "";
}

const USER_ROLES = [
  "super_admin",
  "admin",
  "manager",
  "captain",
  "crew",
  "operator",
  "viewer"
];

const USER_STATUSES = [
  "active",
  "inactive",
  "suspended"
];

function renderUsers(){
  const body = document.getElementById("usersBody");

  if(!body){
    return;
  }

  if(!LIVE_USERS.length){
    body.innerHTML = `
      <tr>
        <td colspan="7" class="muted user-management-empty">
          No users found.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML = LIVE_USERS.map(user => `
    <tr>
      <td>
        <strong>${escapeHtml(user.fullName)}</strong>
      </td>

      <td>
        ${escapeHtml(user.email)}
      </td>

      <td>
        <span class="user-role-badge">
          ${escapeHtml(userRoleLabel(user.role))}
        </span>
      </td>

      <td>
        <span class="user-status-badge ${escapeHtml(userStatusClass(user.status))}">
          ${escapeHtml(user.status || "unknown")}
        </span>
      </td>

      <td>
        ${escapeHtml(formatUserDate(user.lastLoginAt))}
      </td>

      <td>
        ${escapeHtml(formatUserDate(user.createdAt))}
      </td>

      <td>
        <button
          type="button"
          class="user-management-action-btn"
          data-user-manage-id="${Number(user.id)}"
          title="Manage this user"
        >
          Manage
        </button>
      </td>
    </tr>
  `).join("");
}

function applyUserSummary(){
  const total = LIVE_USERS.length;

  const active = LIVE_USERS.filter(
    user => user.status === "active"
  ).length;

  const inactive = LIVE_USERS.filter(
    user => user.status === "inactive"
  ).length;

  const suspended = LIVE_USERS.filter(
    user => user.status === "suspended"
  ).length;

  const totalElement = document.getElementById("usersTotal");
  const activeElement = document.getElementById("usersActive");
  const inactiveElement = document.getElementById("usersInactive");
  const suspendedElement = document.getElementById("usersSuspended");

  if(totalElement){
    totalElement.textContent = total;
  }

  if(activeElement){
    activeElement.textContent = active;
  }

  if(inactiveElement){
    inactiveElement.textContent = inactive;
  }

  if(suspendedElement){
    suspendedElement.textContent = suspended;
  }
}

function applyUserManagementVisibility(){
  const section = document.querySelector(
    ".user-management-operations"
  );

  if(!section){
    return;
  }

  if(!canManageUsers()){
    section.style.display = "none";
  } else {
    section.style.display = "";
  }
}

async function loadUsers(){
  const section = document.querySelector(
    ".user-management-operations"
  );

  if(!section){
    return false;
  }

  applyUserManagementVisibility();

  if(!canManageUsers()){
    return false;
  }

  const body = document.getElementById("usersBody");
  const badge = document.getElementById("usersLiveBadge");

  try {
    if(badge){
      badge.textContent = "Loading";
    }

    const response = await fetch(
      `${API_BASE}/api/users`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if(response.status === 401){
      window.location.href = "./login.html";
      return false;
    }

    if(response.status === 403){
      section.style.display = "none";
      return false;
    }

    if(!response.ok){
      throw new Error(
        `Users API returned HTTP ${response.status}`
      );
    }

    const result = await response.json();

    if(!result.success || !Array.isArray(result.data)){
      throw new Error("Invalid users API response");
    }

    LIVE_USERS = result.data;

    applyUserSummary();
    renderUsers();

    if(badge){
      badge.textContent = "Live";
    }

    console.log("Live user data loaded:", LIVE_USERS);

    return true;
  } catch(error) {
    console.error("Unable to load live user data:", error);

    if(badge){
      badge.textContent = "Error";
    }

    if(body){
      body.innerHTML = `
        <tr>
          <td colspan="7" class="muted user-management-empty">
            Unable to load users. Please try again.
          </td>
        </tr>
      `;
    }

    return false;
  }
}


function initEditUserManagement(){
  const modal = document.getElementById("editUserModal");
  const closeButton = document.getElementById("closeEditUserModal");
  const cancelButton = document.getElementById("cancelEditUser");
  const form = document.getElementById("editUserForm");
  const message = document.getElementById("editUserMessage");
  const submitButton = document.getElementById("submitEditUser");

  const idInput = document.getElementById("editUserId");
  const nameInput = document.getElementById("editUserFullName");
  const emailInput = document.getElementById("editUserEmail");
  const roleSelect = document.getElementById("editUserRole");
  const statusSelect = document.getElementById("editUserStatus");
  const roleHelp = document.getElementById("editUserRoleHelp");

  if(
    !modal ||
    !form ||
    !idInput ||
    !nameInput ||
    !emailInput ||
    !roleSelect ||
    !statusSelect
  ){
    return;
  }

  if(!canManageUsers()){
    return;
  }

  const currentUser = currentDashboardUser();

  let editingUser = null;

  function showMessage(text, type = "error"){
    if(!message){
      return;
    }

    message.textContent = text;
    message.className = `user-form-message is-visible is-${type}`;
  }

  function clearMessage(){
    if(!message){
      return;
    }

    message.textContent = "";
    message.className = "user-form-message";
  }

  function updateRoleOptions(){
    const isSuperAdmin = currentUser?.role === "super_admin";

    const superAdminOption = roleSelect.querySelector(
      'option[value="super_admin"]'
    );

    if(superAdminOption){
      superAdminOption.disabled = !isSuperAdmin;
    }

    if(
      !isSuperAdmin &&
      roleSelect.value === "super_admin"
    ){
      roleSelect.value = editingUser?.role || "";
    }

    if(roleHelp){
      roleHelp.textContent = isSuperAdmin
        ? "Super Admin can assign any supported dashboard role."
        : "Admin can change roles except Super Admin.";
    }
  }

  function openModal(user){
    if(!user){
      return;
    }

    editingUser = user;

    clearMessage();

    idInput.value = String(user.id);
    nameInput.value = user.fullName || "";
    emailInput.value = user.email || "";
    roleSelect.value = user.role || "";
    statusSelect.value = user.status || "active";

    updateRoleOptions();

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    setTimeout(() => {
      nameInput.focus();
    }, 50);
  }

  function closeModal(){
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");

    clearMessage();

    form.reset();

    editingUser = null;

    if(submitButton){
      submitButton.disabled = false;
      submitButton.textContent = "Save Changes";
    }
  }

  function getUserById(userId){
    return LIVE_USERS.find(
      user => Number(user.id) === Number(userId)
    );
  }

  document.addEventListener("click", event => {
    const manageButton = event.target.closest(
      "[data-user-manage-id]"
    );

    if(!manageButton){
      return;
    }

    const userId = Number(
      manageButton.getAttribute("data-user-manage-id")
    );

    const user = getUserById(userId);

    if(!user){
      console.error("Unable to find user for management:", userId);
      return;
    }

    openModal(user);
  });

  if(closeButton){
    closeButton.addEventListener("click", closeModal);
  }

  if(cancelButton){
    cancelButton.addEventListener("click", closeModal);
  }

  modal.addEventListener("click", event => {
    if(event.target === modal){
      closeModal();
    }
  });

  document.addEventListener("keydown", event => {
    if(
      event.key === "Escape" &&
      modal.classList.contains("is-open")
    ){
      closeModal();
    }
  });

  updateRoleOptions();

  form.addEventListener("submit", async event => {
    event.preventDefault();

    clearMessage();

    const userId = Number(idInput.value);

    const fullName = String(
      nameInput.value || ""
    ).trim();

    const email = String(
      emailInput.value || ""
    ).trim().toLowerCase();

    const role = String(
      roleSelect.value || ""
    ).trim();

    const status = String(
      statusSelect.value || ""
    ).trim();

    if(!Number.isInteger(userId) || userId <= 0){
      showMessage("Invalid user selected.");
      return;
    }

    if(!fullName){
      showMessage("Please enter the user's full name.");
      nameInput.focus();
      return;
    }

    if(fullName.length > 150){
      showMessage("Full name must not exceed 150 characters.");
      nameInput.focus();
      return;
    }

    if(!email || !email.includes("@") || email.length > 255){
      showMessage("Please enter a valid email address.");
      emailInput.focus();
      return;
    }

    const allowedRoles = USER_ROLES;

    if(!allowedRoles.includes(role)){
      showMessage("Please select a valid user role.");
      roleSelect.focus();
      return;
    }

    const allowedStatuses = USER_STATUSES;

    if(!allowedStatuses.includes(status)){
      showMessage("Please select a valid account status.");
      statusSelect.focus();
      return;
    }

    if(
      role === "super_admin" &&
      currentUser?.role !== "super_admin"
    ){
      showMessage(
        "Only a Super Admin can assign the Super Admin role."
      );
      roleSelect.focus();
      return;
    }

    if(
      editingUser &&
      Number(editingUser.id) === Number(currentUser?.id)
    ){
      if(role !== editingUser.role){
        showMessage(
          "You cannot change your own role while signed in."
        );
        roleSelect.focus();
        return;
      }

      if(status !== editingUser.status){
        showMessage(
          "You cannot change your own account status while signed in."
        );
        statusSelect.focus();
        return;
      }
    }

    if(submitButton){
      submitButton.disabled = true;
      submitButton.textContent = "Saving...";
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/users/${encodeURIComponent(userId)}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fullName,
            email,
            role,
            status
          })
        }
      );

      let result = null;

      try {
        result = await response.json();
      } catch(parseError) {
        result = null;
      }

      if(response.status === 401){
        window.location.href = "./login.html";
        return;
      }

      if(response.status === 403){
        showMessage(
          result?.message ||
          "You do not have permission to edit this user."
        );
        return;
      }

      if(response.status === 404){
        showMessage(
          result?.message ||
          "User not found."
        );
        return;
      }

      if(response.status === 409){
        showMessage(
          result?.message ||
          "A user with that email already exists."
        );
        emailInput.focus();
        return;
      }

      if(!response.ok || !result?.success){
        throw new Error(
          result?.message ||
          `Unable to update user. HTTP ${response.status}`
        );
      }

      showMessage(
        result.message || "User updated successfully.",
        "success"
      );

      await loadUsers();

      setTimeout(() => {
        closeModal();
      }, 900);

    } catch(error) {
      console.error("Unable to update user:", error);

      showMessage(
        error.message ||
        "Unable to update user. Please try again."
      );
    } finally {
      if(submitButton){
        submitButton.disabled = false;
        submitButton.textContent = "Save Changes";
      }
    }
  });

  const resetPasswordButton = document.getElementById("resetUserPasswordBtn");
  const resetPasswordInput = document.getElementById("resetUserPassword");
  const resetPasswordConfirmInput = document.getElementById("resetUserPasswordConfirm");
  const resetPasswordMessage = document.getElementById("resetUserPasswordMessage");

  function showResetPasswordMessage(text, type = "error"){
    if(!resetPasswordMessage){
      return;
    }

    resetPasswordMessage.textContent = text;
    resetPasswordMessage.className =
      `user-form-message is-visible is-${type}`;
  }

  function clearResetPasswordMessage(){
    if(!resetPasswordMessage){
      return;
    }

    resetPasswordMessage.textContent = "";
    resetPasswordMessage.className = "user-form-message";
  }

  if(resetPasswordButton){
    resetPasswordButton.addEventListener("click", async () => {
      clearResetPasswordMessage();

      const userId = Number(idInput.value);

      const newPassword = String(
        resetPasswordInput?.value || ""
      );

      const confirmPassword = String(
        resetPasswordConfirmInput?.value || ""
      );

      if(!editingUser){
        showResetPasswordMessage(
          "Please select a user before resetting the password."
        );
        return;
      }

      if(!Number.isInteger(userId) || userId <= 0){
        showResetPasswordMessage("Invalid user selected.");
        return;
      }

      if(newPassword.length < 8){
        showResetPasswordMessage(
          "New password must be at least 8 characters."
        );
        resetPasswordInput?.focus();
        return;
      }

      if(newPassword !== confirmPassword){
        showResetPasswordMessage(
          "The new passwords do not match."
        );
        resetPasswordConfirmInput?.focus();
        return;
      }

      if(
        currentUser?.role === "admin" &&
        editingUser.role === "super_admin"
      ){
        showResetPasswordMessage(
          "Administrators cannot reset a Super Admin password."
        );
        return;
      }

      resetPasswordButton.disabled = true;
      resetPasswordButton.textContent = "Resetting...";

      try {
        const response = await fetch(
          `${API_BASE}/api/users/${encodeURIComponent(userId)}/password`,
          {
            method: "PUT",
            credentials: "include",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              newPassword
            })
          }
        );

        let result = null;

        try {
          result = await response.json();
        } catch(parseError) {
          result = null;
        }

        if(response.status === 401){
          window.location.href = "./login.html";
          return;
        }

        if(response.status === 403){
          showResetPasswordMessage(
            result?.message ||
            "You do not have permission to reset this password."
          );
          return;
        }

        if(response.status === 404){
          showResetPasswordMessage(
            result?.message ||
            "User not found."
          );
          return;
        }

        if(!response.ok || !result?.success){
          throw new Error(
            result?.message ||
            `Unable to reset password. HTTP ${response.status}`
          );
        }

        showResetPasswordMessage(
          result.message ||
          "User password reset successfully.",
          "success"
        );

        if(resetPasswordInput){
          resetPasswordInput.value = "";
        }

        if(resetPasswordConfirmInput){
          resetPasswordConfirmInput.value = "";
        }

      } catch(error) {
        console.error("Unable to reset user password:", error);

        showResetPasswordMessage(
          error.message ||
          "Unable to reset password. Please try again."
        );
      } finally {
        resetPasswordButton.disabled = false;
        resetPasswordButton.textContent = "Reset Password";
      }
    });
  }

  const deleteUserButton = document.getElementById("deleteUserBtn");
  const deleteUserMessage = document.getElementById("deleteUserMessage");

  function showDeleteUserMessage(text, type = "error"){
    if(!deleteUserMessage){
      return;
    }

    deleteUserMessage.textContent = text;
    deleteUserMessage.className =
      `user-form-message is-visible is-${type}`;
  }

  function clearDeleteUserMessage(){
    if(!deleteUserMessage){
      return;
    }

    deleteUserMessage.textContent = "";
    deleteUserMessage.className = "user-form-message";
  }

  if(deleteUserButton){
    deleteUserButton.addEventListener("click", async () => {
      clearDeleteUserMessage();

      if(!editingUser){
        showDeleteUserMessage(
          "Please select a user before deleting the account."
        );
        return;
      }

      const userId = Number(idInput.value);
      const currentUserId = Number(currentUser?.id);
      const currentUserRole = currentUser?.role;

      if(!Number.isInteger(userId) || userId <= 0){
        showDeleteUserMessage("Invalid user selected.");
        return;
      }

      if(userId === currentUserId){
        showDeleteUserMessage(
          "You cannot delete your own account."
        );
        return;
      }

      if(
        currentUserRole === "admin" &&
        editingUser.role === "super_admin"
      ){
        showDeleteUserMessage(
          "Administrators cannot delete a Super Admin."
        );
        return;
      }

      if(editingUser.status === "deleted"){
        showDeleteUserMessage(
          "This user is already deleted."
        );
        return;
      }

      const confirmed = window.confirm(
        `Delete user "${editingUser.fullName}" (${editingUser.email})?\n\n` +
        "This is a soft delete. The user record and historical audit " +
        "information will be retained, but the account will be marked as deleted " +
        "and should no longer be allowed to access the dashboard.\n\n" +
        "Click OK to continue or Cancel to keep the account."
      );

      if(!confirmed){
        return;
      }

      deleteUserButton.disabled = true;
      deleteUserButton.textContent = "Deleting...";

      try {
        const response = await fetch(
          `${API_BASE}/api/users/${encodeURIComponent(userId)}`,
          {
            method: "DELETE",
            credentials: "include",
            headers: {
              "Accept": "application/json"
            }
          }
        );

        let result = null;

        try {
          result = await response.json();
        } catch(parseError) {
          result = null;
        }

        if(response.status === 401){
          window.location.href = "./login.html";
          return;
        }

        if(response.status === 403){
          showDeleteUserMessage(
            result?.message ||
            "You do not have permission to delete this user."
          );
          return;
        }

        if(response.status === 404){
          showDeleteUserMessage(
            result?.message ||
            "User not found."
          );
          return;
        }

        if(response.status === 409){
          showDeleteUserMessage(
            result?.message ||
            "This user is already deleted."
          );
          return;
        }

        if(!response.ok || !result?.success){
          throw new Error(
            result?.message ||
            `Unable to delete user. HTTP ${response.status}`
          );
        }

        showDeleteUserMessage(
          result.message ||
          "User deleted successfully.",
          "success"
        );

        await loadUsers();

        setTimeout(() => {
          closeModal();
        }, 900);

      } catch(error) {
        console.error("Unable to delete user:", error);

        showDeleteUserMessage(
          error.message ||
          "Unable to delete user. Please try again."
        );
      } finally {
        deleteUserButton.disabled = false;
        deleteUserButton.textContent = "Delete User";
      }
    });
  }
}

function initUserManagement(){
  const addButton = document.getElementById("addUserBtn");
  const modal = document.getElementById("addUserModal");
  const closeButton = document.getElementById("closeAddUserModal");
  const cancelButton = document.getElementById("cancelAddUser");
  const form = document.getElementById("addUserForm");
  const message = document.getElementById("addUserMessage");
  const submitButton = document.getElementById("submitAddUser");
  const roleSelect = document.getElementById("addUserRole");
  const roleHelp = document.getElementById("addUserRoleHelp");

  if(!addButton || !modal || !form){
    return;
  }

  if(!canManageUsers()){
    addButton.style.display = "none";
    return;
  }

  const currentUser = currentDashboardUser();

  function showMessage(text, type = "error"){
    if(!message){
      return;
    }

    message.textContent = text;
    message.className = `user-form-message is-visible is-${type}`;
  }

  function clearMessage(){
    if(!message){
      return;
    }

    message.textContent = "";
    message.className = "user-form-message";
  }

  function updateRoleOptions(){
    if(!roleSelect){
      return;
    }

    const superAdminOption = roleSelect.querySelector(
      'option[value="super_admin"]'
    );

    if(superAdminOption){
      const isSuperAdmin = currentUser?.role === "super_admin";

      superAdminOption.disabled = !isSuperAdmin;

      if(!isSuperAdmin && roleSelect.value === "super_admin"){
        roleSelect.value = "";
      }

      if(roleHelp){
        roleHelp.textContent = isSuperAdmin
          ? "Super Admin can create any supported dashboard role."
          : "Admin can create all supported roles except Super Admin.";
      }
    }
  }

  function openModal(){
    clearMessage();

    form.reset();
    updateRoleOptions();

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    const nameInput = document.getElementById("addUserFullName");

    if(nameInput){
      setTimeout(() => nameInput.focus(), 50);
    }
  }

  function closeModal(){
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    clearMessage();

    form.reset();
    updateRoleOptions();

    if(submitButton){
      submitButton.disabled = false;
      submitButton.textContent = "Create User";
    }
  }

  addButton.addEventListener("click", openModal);

  if(closeButton){
    closeButton.addEventListener("click", closeModal);
  }

  if(cancelButton){
    cancelButton.addEventListener("click", closeModal);
  }

  modal.addEventListener("click", event => {
    if(event.target === modal){
      closeModal();
    }
  });

  document.addEventListener("keydown", event => {
    if(event.key === "Escape" && modal.classList.contains("is-open")){
      closeModal();
    }
  });

  updateRoleOptions();

  form.addEventListener("submit", async event => {
    event.preventDefault();

    clearMessage();

    const fullName = String(
      document.getElementById("addUserFullName")?.value || ""
    ).trim();

    const email = String(
      document.getElementById("addUserEmail")?.value || ""
    ).trim().toLowerCase();

    const password = String(
      document.getElementById("addUserPassword")?.value || ""
    );

    const confirmPassword = String(
      document.getElementById("addUserConfirmPassword")?.value || ""
    );

    const role = String(
      document.getElementById("addUserRole")?.value || ""
    ).trim();

    if(!fullName){
      showMessage("Please enter the user's full name.");
      document.getElementById("addUserFullName")?.focus();
      return;
    }

    if(fullName.length > 150){
      showMessage("Full name must not exceed 150 characters.");
      return;
    }

    if(!email){
      showMessage("Please enter the user's email address.");
      document.getElementById("addUserEmail")?.focus();
      return;
    }

    if(!email.includes("@") || email.length > 255){
      showMessage("Please enter a valid email address.");
      document.getElementById("addUserEmail")?.focus();
      return;
    }

    if(password.length < 8){
      showMessage("Password must be at least 8 characters.");
      document.getElementById("addUserPassword")?.focus();
      return;
    }

    if(password !== confirmPassword){
      showMessage("Passwords do not match.");
      document.getElementById("addUserConfirmPassword")?.focus();
      return;
    }

    const allowedRoles = USER_ROLES;

    if(!allowedRoles.includes(role)){
      showMessage("Please select a valid user role.");
      document.getElementById("addUserRole")?.focus();
      return;
    }

    if(
      role === "super_admin" &&
      currentUser?.role !== "super_admin"
    ){
      showMessage(
        "Only a Super Admin can create a Super Admin account."
      );
      roleSelect?.focus();
      return;
    }

    if(submitButton){
      submitButton.disabled = true;
      submitButton.textContent = "Creating...";
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/users`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fullName,
            email,
            password,
            role
          })
        }
      );

      let result = null;

      try {
        result = await response.json();
      } catch(parseError) {
        result = null;
      }

      if(response.status === 401){
        window.location.href = "./login.html";
        return;
      }

      if(response.status === 403){
        showMessage(
          result?.message ||
          "You do not have permission to create users."
        );
        return;
      }

      if(response.status === 409){
        showMessage(
          result?.message ||
          "A user with that email already exists."
        );
        return;
      }

      if(!response.ok || !result?.success){
        throw new Error(
          result?.message ||
          `Unable to create user. HTTP ${response.status}`
        );
      }

      showMessage(
        result.message || "User created successfully.",
        "success"
      );

      await loadUsers();

      setTimeout(() => {
        closeModal();
      }, 900);

    } catch(error) {
      console.error("Unable to create user:", error);

      showMessage(
        error.message ||
        "Unable to create user. Please try again."
      );
    } finally {
      if(submitButton){
        submitButton.disabled = false;
        submitButton.textContent = "Create User";
      }
    }
  });
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
