(function () {
  "use strict";

  const state = {
    listings: [],
    enquiries: [],
    incomingEnquiries: [],
    page: 1,
    limit: 20,
    incomingPage: 1,
    incomingLimit: 20,
    incomingTotal: 0,
    incomingTotalPages: 0,
    incomingStatus: "",
    loadingListings: false,
    loadingEnquiries: false,
    loadingIncomingEnquiries: false,
    adminListings: [],
    loadingAdminListings: false,
    creatingAdminListing: false
  };

  function formatLabel(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function formatRate(amount, currencyCode, rateUnit) {
    if (
      amount === null ||
      amount === undefined ||
      amount === ""
    ) {
      return "Rate on enquiry";
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
      return "Rate on enquiry";
    }

    const currency = String(currencyCode || "USD");

    return `${currency} ${numericAmount.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })} / ${formatLabel(rateUnit || "lump_sum")}`;
  }

  function setListingsMessage(message) {
    const body = $("marketplaceListingsBody");

    if (!body) return;

    body.innerHTML = `
      <div class="marketplace-empty muted">
        ${escapeHtml(message)}
      </div>
    `;
  }

  function setEnquiriesMessage(message) {
    const body = $("charterEnquiriesBody");

    if (!body) return;

    body.innerHTML = `
      <div class="marketplace-empty muted">
        ${escapeHtml(message)}
      </div>
    `;
  }

  async function loadMarketplaceListings() {
    if (state.loadingListings) return;

    const body = $("marketplaceListingsBody");

    state.loadingListings = true;

    if (body) {
      body.innerHTML = `
        <div class="marketplace-empty muted">
          Loading available vessels...
        </div>
      `;
    }

    try {
      const params = new URLSearchParams();

      const cargoType = $("marketplaceCargoType")?.value?.trim();
      const charterType = $("marketplaceCharterType")?.value?.trim();
      const vesselType = $("marketplaceVesselType")?.value?.trim();
      const minCapacity = $("marketplaceMinCapacity")?.value?.trim();
      const maxCapacity = $("marketplaceMaxCapacity")?.value?.trim();

      if (cargoType) params.set("cargoType", cargoType);
      if (charterType) params.set("charterType", charterType);
      if (vesselType) params.set("vesselType", vesselType);
      if (minCapacity) params.set("minCapacity", minCapacity);
      if (maxCapacity) params.set("maxCapacity", maxCapacity);

      const query = params.toString();

      const response = await fetch(
        `${API_BASE}/api/marketplace/vessels${query ? `?${query}` : ""}`,
        {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        }
      );

      if (!response.ok) {
        throw new Error(
          `Marketplace API returned HTTP ${response.status}`
        );
      }

      const result = await response.json();

      if (
        !result.success ||
        !result.data ||
        !Array.isArray(result.data)
      ) {
        throw new Error("Invalid marketplace API response");
      }

      state.listings = result.data;

      renderMarketplaceListings();

      const count = $("marketplaceListingCount");

      if (count) {
        count.textContent = String(
          result.count ?? state.listings.length
        );
      }

      console.log(
        "Marketplace listings loaded:",
        state.listings
      );

    } catch (error) {
      console.error("Marketplace listings error:", error);

      state.listings = [];

      setListingsMessage(
        "Unable to load marketplace vessels."
      );

      const count = $("marketplaceListingCount");

      if (count) {
        count.textContent = "0";
      }
    } finally {
      state.loadingListings = false;
    }
  }

  function renderMarketplaceListings() {
    const body = $("marketplaceListingsBody");

    if (!body) return;

    if (!state.listings.length) {
      setListingsMessage(
        "No verified vessels are currently available for charter."
      );
      return;
    }

    body.innerHTML = state.listings.map(listing => `
      <article class="marketplace-listing-card">
        <div class="marketplace-listing-head">
          <div>
            <strong>
              ${escapeHtml(
                listing.title ||
                listing.vesselName ||
                "Vessel Listing"
              )}
            </strong>

            <div class="muted small">
              ${escapeHtml(listing.vesselCode || "")}
              ${listing.vesselName
                ? ` • ${escapeHtml(listing.vesselName)}`
                : ""}
            </div>
          </div>

          <span class="marketplace-status verified">
            Verified
          </span>
        </div>

        <div class="marketplace-listing-grid">
          <div>
            <span class="muted small">Vessel type</span>
            <strong>
              ${escapeHtml(
                formatLabel(listing.vesselType)
              )}
            </strong>
          </div>

          <div>
            <span class="muted small">Capacity</span>
            <strong>
              ${escapeHtml(
                Number(listing.capacityTons || 0).toLocaleString()
              )} tons
            </strong>
          </div>

          <div>
            <span class="muted small">Charter type</span>
            <strong>
              ${escapeHtml(
                formatLabel(listing.charterType)
              )}
            </strong>
          </div>

          <div>
            <span class="muted small">Cargo</span>
            <strong>
              ${escapeHtml(listing.cargoType || "Any")}
            </strong>
          </div>

          <div>
            <span class="muted small">Available from</span>
            <strong>
              ${escapeHtml(
                formatDate(listing.availableFrom)
              )}
            </strong>
          </div>

          <div>
            <span class="muted small">Indicative rate</span>
            <strong>
              ${escapeHtml(
                formatRate(
                  listing.indicativeRate,
                  listing.currencyCode,
                  listing.rateUnit
                )
              )}
            </strong>
          </div>
        </div>

        ${
          listing.description
            ? `
              <p class="muted small marketplace-description">
                ${escapeHtml(listing.description)}
              </p>
            `
            : ""
        }

        <div class="marketplace-listing-footer">
          <span class="muted small">
            ${listing.minimumCharterDays
              ? `Minimum ${escapeHtml(listing.minimumCharterDays)} day(s)`
              : "Flexible charter duration"}
          </span>

          <button
            type="button"
            class="btn marketplace-enquire-btn"
            data-listing-id="${escapeHtml(listing.id)}"
          >
            Request Charter
          </button>
        </div>
      </article>
    `).join("");

    body.querySelectorAll(".marketplace-enquire-btn")
      .forEach(button => {
        button.addEventListener("click", () => {
          openEnquiryForm(button.dataset.listingId);
        });
      });
  }

  async function loadCharterPorts() {
    const originSelect = $("charterEnquiryOriginPortId");
    const destinationSelect = $("charterEnquiryDestinationPortId");

    if (!originSelect && !destinationSelect) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/ports`,
        {
          method: "GET",
          headers: {
            "Accept": "application/json"
          },
          credentials: "include"
        }
      );

      const result = await response.json();

      if (
        !response.ok ||
        !result.success ||
        !Array.isArray(result.data)
      ) {
        throw new Error(
          result.error ||
          result.message ||
          `Ports API returned HTTP ${response.status}`
        );
      }

      const ports = result.data;

      [originSelect, destinationSelect].forEach((select) => {
        if (!select) {
          return;
        }

        const placeholder =
          select.id === "charterEnquiryOriginPortId"
            ? "Select origin port (optional)"
            : "Select destination port (optional)";

        select.innerHTML = "";

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = placeholder;
        select.appendChild(defaultOption);

        ports.forEach((port) => {
          const option = document.createElement("option");
          option.value = String(port.id);

          const location = [
            port.name,
            port.country
          ]
            .filter(Boolean)
            .join(" — ");

          option.textContent =
            location || `Port #${port.id}`;

          select.appendChild(option);
        });
      });
    } catch (error) {
      console.error("Charter ports error:", error);
    }
  }

  async function loadCharterEnquiries() {
    if (state.loadingEnquiries) return;

    const body = $("charterEnquiriesBody");

    state.loadingEnquiries = true;

    if (body) {
      body.innerHTML = `
        <div class="marketplace-empty muted">
          Loading your charter enquiries...
        </div>
      `;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/charter/enquiries?page=${state.page}&limit=${state.limit}`,
        {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        }
      );

      if (!response.ok) {
        throw new Error(
          `Charter enquiries API returned HTTP ${response.status}`
        );
      }

      const result = await response.json();

      if (
        !result.success ||
        !Array.isArray(result.data)
      ) {
        throw new Error(
          "Invalid charter enquiries API response"
        );
      }

      state.enquiries = result.data;

      renderCharterEnquiries();

      console.log(
        "Charter enquiries loaded:",
        state.enquiries
      );

    } catch (error) {
      console.error("Charter enquiries error:", error);

      state.enquiries = [];

      setEnquiriesMessage(
        "Unable to load your charter enquiries."
      );
    } finally {
      state.loadingEnquiries = false;
    }
  }

  async function loadIncomingCharterEnquiries() {
    if (state.loadingIncomingEnquiries) return;

    const body = $("incomingCharterEnquiriesBody");

    state.loadingIncomingEnquiries = true;

    if (body) {
      body.innerHTML = `
        <div class="marketplace-empty muted">
          Loading incoming charter enquiries...
        </div>
      `;
    }

    try {
      const params = new URLSearchParams({
        page: String(state.incomingPage),
        limit: String(state.incomingLimit)
      });

      if (state.incomingStatus) {
        params.set("status", state.incomingStatus);
      }

      const response = await fetch(
        `${API_BASE}/api/charter/incoming-enquiries?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        }
      );

      if (!response.ok) {
        throw new Error(
          `Incoming charter enquiries API returned HTTP ${response.status}`
        );
      }

      const result = await response.json();

      if (
        !result.success ||
        !Array.isArray(result.data)
      ) {
        throw new Error(
          "Invalid incoming charter enquiries API response"
        );
      }

      state.incomingEnquiries = result.data;

      const pagination = result.pagination || {};

      state.incomingTotal = Number(pagination.total || 0);
      state.incomingTotalPages = Number(pagination.totalPages || 0);
      state.incomingPage = Number(
        pagination.page || state.incomingPage
      );
      state.incomingLimit = Number(
        pagination.limit || state.incomingLimit
      );

      renderIncomingCharterEnquiries();

      console.log(
        "Incoming charter enquiries loaded:",
        state.incomingEnquiries
      );

    } catch (error) {
      console.error("Incoming charter enquiries error:", error);

      state.incomingEnquiries = [];
      state.incomingTotal = 0;
      state.incomingTotalPages = 0;

      const body = $("incomingCharterEnquiriesBody");

      if (body) {
        body.innerHTML = `
          <div class="marketplace-empty muted">
            Unable to load incoming charter enquiries.
          </div>
        `;
      }
    } finally {
      state.loadingIncomingEnquiries = false;
    }
  }

  function renderIncomingCharterEnquiries() {
    const body = $("incomingCharterEnquiriesBody");

    if (!body) return;

    if (!state.incomingEnquiries.length) {
      body.innerHTML = `
        <div class="marketplace-empty muted">
          No incoming charter enquiries for your marketplace listings.
        </div>
      `;
      return;
    }

    body.innerHTML = state.incomingEnquiries.map(enquiry => `
      <article class="marketplace-enquiry-card marketplace-incoming-enquiry">
        <div class="marketplace-enquiry-header">
          <div>
            <div class="card-title">
              ${escapeHtml(enquiry.listingTitle || "Charter enquiry")}
            </div>
            <div class="muted small">
              ${escapeHtml(enquiry.vesselName || "Unknown vessel")}
              ${enquiry.vesselCode
                ? ` · ${escapeHtml(enquiry.vesselCode)}`
                : ""}
            </div>
          </div>

          <span class="badge">
            ${escapeHtml(formatLabel(enquiry.status))}
          </span>
        </div>

        <div class="marketplace-enquiry-details">
          <div>
            <span class="muted small">Requester</span>
            <strong>
              User #${escapeHtml(enquiry.requesterUserId)}
            </strong>
          </div>

          <div>
            <span class="muted small">Cargo</span>
            <strong>
              ${escapeHtml(enquiry.cargoType || "Not specified")}
            </strong>
          </div>

          <div>
            <span class="muted small">Quantity</span>
            <strong>
              ${enquiry.cargoQuantityTons != null
                ? `${escapeHtml(enquiry.cargoQuantityTons)} tons`
                : "Not specified"}
            </strong>
          </div>

          <div>
            <span class="muted small">Requested dates</span>
            <strong>
              ${formatDate(enquiry.requestedStartDate)}
              ${enquiry.requestedEndDate
                ? ` → ${formatDate(enquiry.requestedEndDate)}`
                : ""}
            </strong>
          </div>

          <div>
            <span class="muted small">Received</span>
            <strong>
              ${formatDate(enquiry.createdAt)}
            </strong>
          </div>
        </div>

        ${
          enquiry.message
            ? `
              <div class="marketplace-enquiry-message">
                <span class="muted small">Message</span>
                <p>${escapeHtml(enquiry.message)}</p>
              </div>
            `
            : ""
        }
      </article>
    `).join("");

    renderIncomingPagination();
  }

  function renderIncomingPagination() {
    const body = $("incomingCharterEnquiriesBody");

    if (!body) return;

    const totalPages = Number(state.incomingTotalPages || 0);

    if (totalPages <= 1) return;

    const pagination = document.createElement("div");
    pagination.className = "marketplace-pagination";

    pagination.innerHTML = `
      <button
        type="button"
        class="btn secondary"
        id="incomingCharterPrevious"
        ${state.incomingPage <= 1 ? "disabled" : ""}
      >
        Previous
      </button>

      <span class="muted small">
        Page ${state.incomingPage} of ${totalPages}
        · ${state.incomingTotal} total
      </span>

      <button
        type="button"
        class="btn secondary"
        id="incomingCharterNext"
        ${state.incomingPage >= totalPages ? "disabled" : ""}
      >
        Next
      </button>
    `;

    body.appendChild(pagination);
  }

  function renderCharterEnquiries() {
    const body = $("charterEnquiriesBody");

    if (!body) return;

    if (!state.enquiries.length) {
      setEnquiriesMessage(
        "You have no charter enquiries yet."
      );
      return;
    }

    body.innerHTML = `
      <div class="marketplace-enquiry-list">
        ${state.enquiries.map(enquiry => `
          <article class="marketplace-enquiry-card">
            <div>
              <strong>
                ${escapeHtml(
                  enquiry.listingTitle ||
                  enquiry.vesselName ||
                  "Charter enquiry"
                )}
              </strong>

              <div class="muted small">
                ${escapeHtml(enquiry.vesselCode || "")}
                • ${escapeHtml(
                  formatLabel(enquiry.status)
                )}
              </div>
            </div>

            <div class="marketplace-enquiry-meta">
              <span>
                ${escapeHtml(
                  enquiry.cargoType || "Cargo not specified"
                )}
              </span>

              <span>
                ${
                  enquiry.cargoQuantityTons
                    ? `${escapeHtml(enquiry.cargoQuantityTons)} tons`
                    : "Quantity pending"
                }
              </span>

              <span>
                ${
                  enquiry.requestedStartDate
                    ? escapeHtml(
                        formatDate(enquiry.requestedStartDate)
                      )
                    : "Start date pending"
                }
              </span>
            </div>

            <div class="marketplace-listing-footer">
              <span class="muted small">
                Submitted ${escapeHtml(
                  formatDate(enquiry.createdAt)
                )}
              </span>

              <span class="marketplace-status ${escapeHtml(
                enquiry.status || "submitted"
              )}">
                ${escapeHtml(
                  formatLabel(enquiry.status)
                )}
              </span>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function openEnquiryForm(listingId) {
    const listing = state.listings.find(
      item => String(item.id) === String(listingId)
    );

    const form = $("charterEnquiryForm");

    if (!form) {
      console.warn(
        "Charter enquiry form is not present in the dashboard."
      );
      return;
    }

    const listingInput = $("charterEnquiryListingId");

    if (listingInput) {
      listingInput.value = String(listingId);
    }

    const selected = $("charterSelectedVessel");

    if (selected) {
      selected.textContent = listing
        ? `${listing.vesselName || listing.vesselCode || "Vessel"} — ${listing.title || "Charter listing"}`
        : `Listing #${listingId}`;
    }

    form.hidden = false;

    form.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function closeEnquiryForm() {
    const form = $("charterEnquiryForm");

    if (!form) return;

    form.hidden = true;
  }

  async function submitCharterEnquiry(event) {
    event.preventDefault();

    const form = event.currentTarget;

    const listingId = Number(
      $("charterEnquiryListingId")?.value
    );

    const cargoType =
      $("charterEnquiryCargoType")?.value?.trim() || null;

    const cargoQuantityValue =
      $("charterEnquiryCargoQuantity")?.value?.trim();

    const cargoQuantityTons =
      cargoQuantityValue
        ? Number(cargoQuantityValue)
        : null;

    const originPortIdValue =
      $("charterEnquiryOriginPortId")?.value?.trim();

    const destinationPortIdValue =
      $("charterEnquiryDestinationPortId")?.value?.trim();

    const requestedStartDate =
      $("charterEnquiryStartDate")?.value || null;

    const requestedEndDate =
      $("charterEnquiryEndDate")?.value || null;

    const message =
      $("charterEnquiryMessage")?.value?.trim() || null;

    if (!Number.isInteger(listingId) || listingId <= 0) {
      alert("Please select a valid vessel listing.");
      return;
    }

    if (
      cargoQuantityValue &&
      (!Number.isFinite(cargoQuantityTons) ||
        cargoQuantityTons <= 0)
    ) {
      alert("Cargo quantity must be greater than zero.");
      return;
    }

    const originPortId = originPortIdValue
      ? Number(originPortIdValue)
      : null;

    const destinationPortId = destinationPortIdValue
      ? Number(destinationPortIdValue)
      : null;

    if (
      originPortId !== null &&
      (!Number.isInteger(originPortId) || originPortId <= 0)
    ) {
      alert("Origin port ID must be a valid positive number.");
      return;
    }

    if (
      destinationPortId !== null &&
      (!Number.isInteger(destinationPortId) ||
        destinationPortId <= 0)
    ) {
      alert(
        "Destination port ID must be a valid positive number."
      );
      return;
    }

    const submitButton =
      form.querySelector("button[type='submit']");

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/charter/enquiries`,
        {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            listingId,
            cargoType,
            cargoQuantityTons,
            originPortId,
            destinationPortId,
            requestedStartDate,
            requestedEndDate,
            message
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
          `Charter enquiry returned HTTP ${response.status}`
        );
      }

      alert("Charter enquiry submitted successfully.");

      form.reset();

      const listingInput = $("charterEnquiryListingId");

      if (listingInput) {
        listingInput.value = "";
      }

      closeEnquiryForm();

      await loadCharterEnquiries();

    } catch (error) {
      console.error(
        "Charter enquiry submission error:",
        error
      );

      alert(
        error.message ||
        "Unable to submit charter enquiry."
      );

    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Charter Enquiry";
      }
    }
  }

  function currentMarketplaceUser() {
    try {
      const raw = localStorage.getItem("marine_session");
      if (!raw) return null;

      const session = JSON.parse(raw);

      return session?.user || null;

    } catch (error) {
      console.error(
        "Unable to read current dashboard user:",
        error
      );

      return null;
    }
  }

  function canManageMarketplace() {
    const user = currentMarketplaceUser();

    return Boolean(
      user &&
      ["super_admin", "admin"].includes(user.role)
    );
  }

  function setAdminMarketplaceMessage(message) {
    const element =
      $("marketplaceCreateListingMessage");

    if (!element) return;

    element.textContent = message || "";
  }

  function populateMarketplaceVesselOptions() {
    const select =
      $("marketplaceListingVesselId");

    if (!select) return;

    const vessels = Array.isArray(window.LIVE?.vessels)
      ? window.LIVE.vessels
      : [];

    const currentValue = select.value;

    select.innerHTML = `
      <option value="">Select vessel</option>
      ${vessels
        .filter(vessel => {
          const status =
            String(vessel.status || "").toLowerCase();

          return ![
            "retired",
            "out_of_service"
          ].includes(status);
        })
        .map(vessel => `
          <option value="${escapeHtml(
            String(vessel.id)
          )}">
            ${escapeHtml(
              vessel.name ||
              vessel.vesselName ||
              vessel.vessel_code ||
              vessel.vesselCode ||
              `Vessel #${vessel.id}`
            )}
            ${
              vessel.vessel_code || vessel.vesselCode
                ? ` — ${escapeHtml(
                    vessel.vessel_code ||
                    vessel.vesselCode
                  )}`
                : ""
            }
          </option>
        `)
        .join("")}
    `;

    if (
      currentValue &&
      Array.from(select.options).some(
        option => option.value === currentValue
      )
    ) {
      select.value = currentValue;
    }
  }

  function renderAdminMarketplaceStatus(listing) {
    return `
      <div class="marketplace-admin-statuses">
        <span class="marketplace-status ${escapeHtml(
          listing.verificationStatus || "pending"
        )}">
          Verification: ${escapeHtml(
            formatLabel(
              listing.verificationStatus || "pending"
            )
          )}
        </span>

        <span class="marketplace-status ${escapeHtml(
          listing.listingStatus || "draft"
        )}">
          Listing: ${escapeHtml(
            formatLabel(
              listing.listingStatus || "draft"
            )
          )}
        </span>

        <span class="marketplace-status ${escapeHtml(
          listing.availabilityStatus || "unavailable"
        )}">
          Availability: ${escapeHtml(
            formatLabel(
              listing.availabilityStatus ||
              "unavailable"
            )
          )}
        </span>
      </div>
    `;
  }

  function renderAdminMarketplaceActions(listing) {
    const actions = [];

    if (listing.verificationStatus === "pending") {
      actions.push(`
        <button
          type="button"
          class="btn marketplace-admin-action"
          data-marketplace-action="verify"
          data-marketplace-listing-id="${escapeHtml(
            String(listing.id)
          )}"
        >
          Verify
        </button>
      `);

      actions.push(`
        <button
          type="button"
          class="btn ghost marketplace-admin-action"
          data-marketplace-action="reject"
          data-marketplace-listing-id="${escapeHtml(
            String(listing.id)
          )}"
        >
          Reject
        </button>
      `);
    }

    if (
      listing.verificationStatus === "verified" &&
      listing.listingStatus === "draft"
    ) {
      actions.push(`
        <button
          type="button"
          class="btn marketplace-admin-action"
          data-marketplace-action="publish"
          data-marketplace-listing-id="${escapeHtml(
            String(listing.id)
          )}"
        >
          Publish
        </button>
      `);
    }

    if (
      listing.verificationStatus === "verified" &&
      listing.listingStatus === "published"
    ) {
      actions.push(`
        <button
          type="button"
          class="btn ghost marketplace-admin-action"
          data-marketplace-action="suspend"
          data-marketplace-listing-id="${escapeHtml(
            String(listing.id)
          )}"
        >
          Suspend
        </button>
      `);
    }

    if (
      listing.verificationStatus === "verified" &&
      listing.listingStatus === "suspended"
    ) {
      actions.push(`
        <button
          type="button"
          class="btn marketplace-admin-action"
          data-marketplace-action="resume"
          data-marketplace-listing-id="${escapeHtml(
            String(listing.id)
          )}"
        >
          Resume
        </button>
      `);
    }

    if (!actions.length) {
      return `
        <span class="muted small">
          No lifecycle action available
        </span>
      `;
    }

    return actions.join("");
  }

  function renderAdminMarketplaceListings() {
    const body =
      $("marketplaceAdminListingsBody");

    if (!body) return;

    if (!state.adminListings.length) {
      body.innerHTML = `
        <div class="marketplace-empty muted">
          No marketplace listings found.
        </div>
      `;

      return;
    }

    body.innerHTML = `
      <div class="marketplace-admin-list">
        ${state.adminListings.map(listing => `
          <article class="marketplace-admin-listing">
            <div class="marketplace-admin-listing-head">
              <div>
                <strong>
                  ${escapeHtml(
                    listing.title ||
                    `Listing #${listing.id}`
                  )}
                </strong>

                <div class="muted small">
                  ${escapeHtml(
                    listing.vesselName ||
                    listing.vesselCode ||
                    "Vessel"
                  )}
                  ${
                    listing.vesselCode
                      ? ` • ${escapeHtml(
                          listing.vesselCode
                        )}`
                      : ""
                  }
                </div>
              </div>

              <div class="muted small">
                #${escapeHtml(String(listing.id))}
              </div>
            </div>

            ${renderAdminMarketplaceStatus(listing)}

            <div class="marketplace-admin-listing-grid">
              <div>
                <span class="muted small">
                  Charter Type
                </span>

                <strong>
                  ${escapeHtml(
                    formatLabel(listing.charterType)
                  )}
                </strong>
              </div>

              <div>
                <span class="muted small">
                  Cargo
                </span>

                <strong>
                  ${escapeHtml(
                    listing.cargoType ||
                    "Not specified"
                  )}
                </strong>
              </div>

              <div>
                <span class="muted small">
                  Capacity
                </span>

                <strong>
                  ${escapeHtml(
                    Number(
                      listing.capacityTons || 0
                    ).toLocaleString()
                  )} tons
                </strong>
              </div>

              <div>
                <span class="muted small">
                  Rate
                </span>

                <strong>
                  ${escapeHtml(
                    formatRate(
                      listing.indicativeRate,
                      listing.currencyCode,
                      listing.rateUnit
                    )
                  )}
                </strong>
              </div>

              <div>
                <span class="muted small">
                  Available From
                </span>

                <strong>
                  ${escapeHtml(
                    formatDate(
                      listing.availableFrom
                    )
                  )}
                </strong>
              </div>

              <div>
                <span class="muted small">
                  Available Until
                </span>

                <strong>
                  ${escapeHtml(
                    formatDate(
                      listing.availableUntil
                    )
                  )}
                </strong>
              </div>
            </div>

            ${
              listing.description
                ? `
                  <div class="muted small marketplace-admin-description">
                    ${escapeHtml(
                      listing.description
                    )}
                  </div>
                `
                : ""
            }

            <div class="marketplace-listing-footer">
              <span class="muted small">
                Updated ${escapeHtml(
                  formatDate(listing.updatedAt)
                )}
              </span>

              <div class="marketplace-admin-actions">
                ${renderAdminMarketplaceActions(
                  listing
                )}
              </div>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  async function loadAdminMarketplaceListings() {
    if (!canManageMarketplace()) return;
    if (state.loadingAdminListings) return;

    const body =
      $("marketplaceAdminListingsBody");

    state.loadingAdminListings = true;

    if (body) {
      body.innerHTML = `
        <div class="marketplace-empty muted">
          Loading marketplace management listings...
        </div>
      `;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/marketplace/listings`,
        {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        }
      );

      if (!response.ok) {
        throw new Error(
          `Marketplace management API returned HTTP ${response.status}`
        );
      }

      const result = await response.json();

      if (
        !result.success ||
        !Array.isArray(result.data)
      ) {
        throw new Error(
          "Invalid marketplace management API response"
        );
      }

      state.adminListings = result.data;

      renderAdminMarketplaceListings();

      const count =
        $("marketplaceAdminListingCount");

      if (count) {
        count.textContent = String(
          result.count ??
          state.adminListings.length
        );
      }

    } catch (error) {
      console.error(
        "Marketplace management listings error:",
        error
      );

      state.adminListings = [];

      if (body) {
        body.innerHTML = `
          <div class="marketplace-error">
            Unable to load marketplace management listings.
          </div>
        `;
      }

      const count =
        $("marketplaceAdminListingCount");

      if (count) {
        count.textContent = "0";
      }

    } finally {
      state.loadingAdminListings = false;
    }
  }

  async function createAdminMarketplaceListing(event) {
    event.preventDefault();

    if (!canManageMarketplace()) return;
    if (state.creatingAdminListing) return;

    const vesselId = Number(
      $("marketplaceListingVesselId")?.value
    );

    const title =
      $("marketplaceListingTitle")
        ?.value?.trim() || "";

    const description =
      $("marketplaceListingDescription")
        ?.value?.trim() || null;

    const charterType =
      $("marketplaceListingCharterType")
        ?.value?.trim() || "";

    const cargoType =
      $("marketplaceListingCargoType")
        ?.value?.trim() || null;

    const availabilityStatus =
      $("marketplaceListingAvailabilityStatus")
        ?.value?.trim() || "available";

    const availableFrom =
      $("marketplaceListingAvailableFrom")
        ?.value || "";

    const availableUntil =
      $("marketplaceListingAvailableUntil")
        ?.value || null;

    const minimumDaysValue =
      $("marketplaceListingMinimumDays")
        ?.value?.trim();

    const maximumDaysValue =
      $("marketplaceListingMaximumDays")
        ?.value?.trim();

    const indicativeRateValue =
      $("marketplaceListingIndicativeRate")
        ?.value?.trim();

    const minimumCharterDays =
      minimumDaysValue
        ? Number(minimumDaysValue)
        : null;

    const maximumCharterDays =
      maximumDaysValue
        ? Number(maximumDaysValue)
        : null;

    const indicativeRate =
      indicativeRateValue
        ? Number(indicativeRateValue)
        : null;

    const rateUnit =
      $("marketplaceListingRateUnit")
        ?.value?.trim() || "per_day";

    const currencyCode =
      $("marketplaceListingCurrency")
        ?.value?.trim()
        .toUpperCase() || "USD";

    if (!Number.isInteger(vesselId) || vesselId <= 0) {
      setAdminMarketplaceMessage(
        "Please select a valid vessel."
      );

      return;
    }

    if (!title) {
      setAdminMarketplaceMessage(
        "Listing title is required."
      );

      return;
    }

    if (!charterType) {
      setAdminMarketplaceMessage(
        "Please select a charter type."
      );

      return;
    }

    if (!availableFrom) {
      setAdminMarketplaceMessage(
        "Available-from date is required."
      );

      return;
    }

    if (
      minimumCharterDays !== null &&
      (!Number.isInteger(minimumCharterDays) ||
        minimumCharterDays <= 0)
    ) {
      setAdminMarketplaceMessage(
        "Minimum charter days must be a positive whole number."
      );

      return;
    }

    if (
      maximumCharterDays !== null &&
      (!Number.isInteger(maximumCharterDays) ||
        maximumCharterDays <= 0)
    ) {
      setAdminMarketplaceMessage(
        "Maximum charter days must be a positive whole number."
      );

      return;
    }

    if (
      minimumCharterDays !== null &&
      maximumCharterDays !== null &&
      minimumCharterDays > maximumCharterDays
    ) {
      setAdminMarketplaceMessage(
        "Minimum charter days cannot exceed maximum charter days."
      );

      return;
    }

    if (
      indicativeRate !== null &&
      (!Number.isFinite(indicativeRate) ||
        indicativeRate < 0)
    ) {
      setAdminMarketplaceMessage(
        "Indicative rate must be zero or greater."
      );

      return;
    }

    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      setAdminMarketplaceMessage(
        "Currency must be a three-letter code such as USD."
      );

      return;
    }

    const form =
      $("marketplaceCreateListingForm");

    const submitButton =
      $("marketplaceCreateListingBtn");

    state.creatingAdminListing = true;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Creating...";
    }

    setAdminMarketplaceMessage(
      "Creating marketplace listing..."
    );

    try {
      const response = await fetch(
        `${API_BASE}/api/marketplace/listings`,
        {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            vesselId,
            title,
            description,
            charterType,
            cargoType,
            availabilityStatus,
            availableFrom,
            availableUntil,
            minimumCharterDays,
            maximumCharterDays,
            indicativeRate,
            rateUnit,
            currencyCode
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
          result.message ||
          `Marketplace listing creation returned HTTP ${response.status}`
        );
      }

      if (form) {
        form.reset();
      }

      const currencyInput =
        $("marketplaceListingCurrency");

      if (currencyInput) {
        currencyInput.value = "USD";
      }

      setAdminMarketplaceMessage(
        "Marketplace listing created successfully. It is now pending verification."
      );

      populateMarketplaceVesselOptions();

      await loadAdminMarketplaceListings();

    } catch (error) {
      console.error(
        "Marketplace listing creation error:",
        error
      );

      setAdminMarketplaceMessage(
        error.message ||
        "Unable to create marketplace listing."
      );

    } finally {
      state.creatingAdminListing = false;

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Create Listing";
      }
    }
  }

  async function updateAdminMarketplaceListing(
    listingId,
    action
  ) {
    if (!canManageMarketplace()) return;

    const endpoints = {
      verify: {
        method: "PATCH",
        path:
          `/api/marketplace/listings/${listingId}/verification`,
        body: {
          verificationStatus: "verified"
        },
        message:
          "Listing verified successfully."
      },

      reject: {
        method: "PATCH",
        path:
          `/api/marketplace/listings/${listingId}/verification`,
        body: {
          verificationStatus: "rejected"
        },
        message:
          "Listing rejected successfully."
      },

      publish: {
        method: "PATCH",
        path:
          `/api/marketplace/listings/${listingId}/publish`,
        body: {},
        message:
          "Listing published successfully."
      },

      suspend: {
        method: "PATCH",
        path:
          `/api/marketplace/listings/${listingId}/suspend`,
        body: {},
        message:
          "Listing suspended successfully."
      },

      resume: {
        method: "PATCH",
        path:
          `/api/marketplace/listings/${listingId}/resume`,
        body: {},
        message:
          "Listing resumed successfully."
      }
    };

    const configuration = endpoints[action];

    if (!configuration) return;

    const actionLabels = {
      verify: "Verify",
      reject: "Reject",
      publish: "Publish",
      suspend: "Suspend",
      resume: "Resume"
    };

    const label =
      actionLabels[action] || "Update";

    if (
      !window.confirm(
        `${label} marketplace listing #${listingId}?`
      )
    ) {
      return;
    }

    const buttons = document.querySelectorAll(
      `[data-marketplace-listing-id="${listingId}"]`
    );

    buttons.forEach(button => {
      button.disabled = true;
    });

    try {
      const response = await fetch(
        `${API_BASE}${configuration.path}`,
        {
          method: configuration.method,
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify(
            configuration.body
          )
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
          result.message ||
          `Marketplace listing update returned HTTP ${response.status}`
        );
      }

      setAdminMarketplaceMessage(
        configuration.message
      );

      await loadAdminMarketplaceListings();

    } catch (error) {
      console.error(
        "Marketplace listing lifecycle update error:",
        error
      );

      setAdminMarketplaceMessage(
        error.message ||
        "Unable to update marketplace listing."
      );

    } finally {
      buttons.forEach(button => {
        button.disabled = false;
      });
    }
  }

  function bindMarketplaceEvents() {
    const adminCreateForm =
      $("marketplaceCreateListingForm");

    if (adminCreateForm) {
      adminCreateForm.addEventListener(
        "submit",
        createAdminMarketplaceListing
      );
    }

    const adminListingsBody =
      $("marketplaceAdminListingsBody");

    if (adminListingsBody) {
      adminListingsBody.addEventListener(
        "click",
        event => {
          const actionButton =
            event.target.closest(
              "[data-marketplace-action]"
            );

          if (!actionButton) return;

          const action =
            actionButton.dataset.marketplaceAction;

          const listingId =
            actionButton.dataset.marketplaceListingId;

          if (!action || !listingId) return;

          updateAdminMarketplaceListing(
            listingId,
            action
          );
        }
      );
    }

    const filterButton =
      $("marketplaceApplyFilters");

    if (filterButton) {
      filterButton.addEventListener(
        "click",
        loadMarketplaceListings
      );
    }

    const clearButton =
      $("marketplaceClearFilters");

    if (clearButton) {
      clearButton.addEventListener(
        "click",
        () => {
          [
            "marketplaceCargoType",
            "marketplaceCharterType",
            "marketplaceVesselType",
            "marketplaceMinCapacity",
            "marketplaceMaxCapacity"
          ].forEach(id => {
            const input = $(id);

            if (input) {
              input.value = "";
            }
          });

          loadMarketplaceListings();
        }
      );
    }

    const enquiryForm =
      $("charterEnquirySubmitForm");

    if (enquiryForm) {
      enquiryForm.addEventListener(
        "submit",
        submitCharterEnquiry
      );
    }

    [
      $("charterEnquiryCancel"),
      $("charterEnquiryCancelBottom")
    ].forEach(button => {
      if (button) {
        button.addEventListener(
          "click",
          closeEnquiryForm
        );
      }
    });

    const incomingStatus = $("incomingCharterStatus");
    if (incomingStatus) {
      incomingStatus.addEventListener("change", () => {
        state.incomingStatus = incomingStatus.value;
        state.incomingPage = 1;
        loadIncomingCharterEnquiries();
      });
    }

    const incomingBody = $("incomingCharterEnquiriesBody");
    if (incomingBody) {
      incomingBody.addEventListener("click", event => {
        const previousButton = event.target.closest("#incomingCharterPrevious");
        const nextButton = event.target.closest("#incomingCharterNext");

        if (previousButton && state.incomingPage > 1) {
          state.incomingPage -= 1;
          loadIncomingCharterEnquiries();
          return;
        }

        if (nextButton && state.incomingPage < state.incomingTotalPages) {
          state.incomingPage += 1;
          loadIncomingCharterEnquiries();
        }
      });
    }
  }

  function initMarketplace() {
    bindMarketplaceEvents();

    loadMarketplaceListings();
    loadCharterPorts();
    loadCharterEnquiries();
    loadIncomingCharterEnquiries();

    const adminManagement =
      $("marketplaceAdminManagement");

    if (adminManagement && canManageMarketplace()) {
      adminManagement.hidden = false;

      populateMarketplaceVesselOptions();
      loadAdminMarketplaceListings();
    }
  }

  window.MarineMarketplace = {
    init: initMarketplace,
    loadListings: loadMarketplaceListings,
    loadEnquiries: loadCharterEnquiries,
    loadIncomingEnquiries: loadIncomingCharterEnquiries,
    openEnquiryForm,
    closeEnquiryForm
  };
})();
