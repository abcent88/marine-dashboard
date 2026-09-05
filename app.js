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
