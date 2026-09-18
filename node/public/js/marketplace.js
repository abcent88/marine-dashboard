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
    loadingIncomingEnquiries: false
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
        !Array.isArray(result.data.listings)
      ) {
        throw new Error("Invalid marketplace API response");
      }

      state.listings = result.data.listings;

      renderMarketplaceListings();

      const count = $("marketplaceListingCount");

      if (count) {
        count.textContent = String(
          result.data.count ?? state.listings.length
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
        !result.data ||
        !Array.isArray(result.data.enquiries)
      ) {
        throw new Error(
          "Invalid charter enquiries API response"
        );
      }

      state.enquiries = result.data.enquiries;

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
        !result.data ||
        !Array.isArray(result.data.enquiries)
      ) {
        throw new Error(
          "Invalid incoming charter enquiries API response"
        );
      }

      state.incomingEnquiries = result.data.enquiries;

      const pagination = result.data.pagination || {};

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

  function bindMarketplaceEvents() {
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
    loadCharterEnquiries();
    loadIncomingCharterEnquiries();
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
