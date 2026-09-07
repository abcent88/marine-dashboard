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
            <span>MMSI</span>
            <input
              type="text"
              name="mmsi"
              maxlength="9"
              inputmode="numeric"
              pattern="[0-9]{9}"
              placeholder="9-digit MMSI"
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

      mmsi: String(
        formData.get("mmsi") || ""
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

  const mmsi =
    escapeHtml(vessel.mmsi || "");

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
            <span>MMSI</span>
            <input
              type="text"
              name="mmsi"
              maxlength="9"
              inputmode="numeric"
              pattern="[0-9]{9}"
              value="${mmsi}"
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

        mmsi: String(
          formData.get("mmsi") || ""
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
