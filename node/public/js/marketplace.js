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
    creatingAdminListing: false,
    editingEnquiryId: null,
    viewingEnquiryOffersId: null,
    incomingViewingOffersId: null,
      counteringOfferId: null
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
            ${
              listing.minimumCharterDays !== null &&
              listing.minimumCharterDays !== undefined &&
              listing.maximumCharterDays !== null &&
              listing.maximumCharterDays !== undefined
                ? `${escapeHtml(listing.minimumCharterDays)}–${escapeHtml(listing.maximumCharterDays)} day charter`
                : listing.minimumCharterDays !== null &&
                  listing.minimumCharterDays !== undefined
                  ? `Minimum ${escapeHtml(listing.minimumCharterDays)} day charter`
                  : listing.maximumCharterDays !== null &&
                    listing.maximumCharterDays !== undefined
                    ? `Up to ${escapeHtml(listing.maximumCharterDays)} day charter`
                    : "Flexible charter duration"
            }
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

  async function loadCharterEnquiryOffers(enquiryId) {
    const enquiry = state.enquiries.find(
      item => String(item.id) === String(enquiryId)
    );

    if (!enquiry) {
      throw new Error(
        "Charter enquiry could not be found."
      );
    }

    state.viewingEnquiryOffersId = Number(enquiryId);

    try {
      const response = await fetch(
        `${API_BASE}/api/charter/enquiries/${encodeURIComponent(enquiryId)}/offers`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Accept": "application/json"
          }
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
          result.message ||
          `Charter offers API returned HTTP ${response.status}`
        );
      }

      enquiry.offers = Array.isArray(result.data)
        ? result.data
        : [];

      renderCharterEnquiries();

    } catch (error) {
      console.error(
        "Charter enquiry offers error:",
        error
      );

      state.viewingEnquiryOffersId = null;

      alert(
        error.message ||
        "Unable to load charter offers."
      );
    }
  }

  async function loadIncomingCharterEnquiryOffers(enquiryId) {
    const enquiry = state.incomingEnquiries.find(
      item => String(item.id) === String(enquiryId)
    );

    if (!enquiry) {
      throw new Error(
        "Incoming charter enquiry could not be found."
      );
    }

    state.incomingViewingOffersId = Number(enquiryId);

    try {
      const response = await fetch(
        `${API_BASE}/api/charter/enquiries/${encodeURIComponent(enquiryId)}/offers`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Accept": "application/json"
          }
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
          result.message ||
          `Charter offers API returned HTTP ${response.status}`
        );
      }

      enquiry.offers = Array.isArray(result.data)
        ? result.data
        : [];

      renderIncomingCharterEnquiries();

    } catch (error) {
      console.error(
        "Incoming charter enquiry offers error:",
        error
      );

      state.incomingViewingOffersId = null;

      alert(
        error.message ||
        "Unable to load charter offers."
      );
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

    body.innerHTML = state.incomingEnquiries.map(enquiry => {
      const closedStatuses = [
        "accepted",
        "rejected",
        "withdrawn",
        "closed",
        "offer_made"
      ];

      const canMakeOffer =
        !closedStatuses.includes(enquiry.status);

      return `
        <article
          class="marketplace-enquiry-card marketplace-incoming-enquiry"
          data-charter-enquiry-id="${escapeHtml(enquiry.id)}"
        >
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

          ${
            canMakeOffer
              ? `
                <div class="marketplace-enquiry-actions">
                  <button
                    type="button"
                    class="btn secondary marketplace-offer-toggle"
                    data-charter-offer-toggle
                    data-charter-enquiry-id="${escapeHtml(enquiry.id)}"
                  >
                    Make Offer
                  </button>
                </div>

                <form
                  class="marketplace-offer-form"
                  data-charter-offer-form
                  data-charter-enquiry-id="${escapeHtml(enquiry.id)}"
                  hidden
                >
                  <div class="marketplace-form-head">
                    <div>
                      <strong>Make Charter Offer</strong>
                      <div class="muted small">
                        Submit the initial commercial offer for this enquiry.
                      </div>
                    </div>

                    <button
                      type="button"
                      class="btn ghost"
                      data-charter-offer-cancel
                    >
                      Cancel
                    </button>
                  </div>

                  <div class="marketplace-form-grid">
                    <div class="marketplace-field">
                      <label class="muted small">
                        Offer Amount
                      </label>
                      <input
                        type="number"
                        name="amount"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 8500"
                      >
                    </div>

                    <div class="marketplace-field">
                      <label class="muted small">
                        Currency
                      </label>
                      <input
                        type="text"
                        name="currencyCode"
                        value="USD"
                        maxlength="3"
                        placeholder="USD"
                      >
                    </div>

                    <div class="marketplace-field">
                      <label class="muted small">
                        Rate Unit
                      </label>
                      <select name="rateUnit">
                        <option value="">Select rate unit</option>
                        <option value="per_day">Per day</option>
                        <option value="per_voyage">Per voyage</option>
                        <option value="per_metric_ton">Per metric ton</option>
                        <option value="lump_sum">Lump sum</option>
                      </select>
                    </div>

                    <div class="marketplace-field">
                      <label class="muted small">
                        Charter Days
                      </label>
                      <input
                        type="number"
                        name="charterDays"
                        min="1"
                        step="1"
                        placeholder="e.g. 7"
                      >
                    </div>

                    <div class="marketplace-field">
                      <label class="muted small">
                        Offer Expires
                      </label>
                      <input
                        type="datetime-local"
                        name="expiresAt"
                      >
                    </div>

                    <div class="marketplace-field marketplace-field-wide">
                      <label class="muted small">
                        Terms
                      </label>
                      <textarea
                        name="terms"
                        rows="4"
                        placeholder="Enter the commercial terms, conditions or other important details."
                      ></textarea>
                    </div>
                  </div>

                  <div
                    class="marketplace-form-message muted small"
                    data-charter-offer-message
                  ></div>


              <div class="marketplace-form-actions">
                    <button
                      type="submit"
                      class="btn"
                    >
                      Submit Offer
                    </button>

                    <button
                      type="button"
                      class="btn ghost"
                      data-charter-offer-cancel
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              `
              : ""
          }

          ${
            ["offer_made", "negotiating"].includes(
              enquiry.status
            )
              ? `
                <div class="marketplace-enquiry-actions">
                  <button
                    type="button"
                    class="btn secondary"
                    data-charter-incoming-offers
                    data-charter-enquiry-id="${escapeHtml(enquiry.id)}"
                  >
                    ${
                      state.incomingViewingOffersId === Number(enquiry.id)
                        ? "Refresh Negotiation"
                        : "View Negotiation"
                    }
                  </button>
                </div>

                ${
                  state.incomingViewingOffersId === Number(enquiry.id)
                    ? `
                      <div class="marketplace-offer-history">
                        <div class="marketplace-form-head">
                          <div>
                            <strong>Charter Negotiation</strong>
                            <div class="muted small">
                              Review the offer history and respond to the latest requester offer.
                            </div>
                          </div>
                        </div>

                        ${
                          Array.isArray(enquiry.offers) &&
                          enquiry.offers.length
                            ? enquiry.offers.map((offer, index) => {
                                const isLatest =
                                  index === enquiry.offers.length - 1;

                                const isPending =
                                  offer.status === "pending";

                                const isRequesterOffer =
                                  Number(offer.offeredByUserId) ===
                                  Number(enquiry.requesterUserId);

                                return `
                                  <div
                                    class="marketplace-offer-card"
                                    data-charter-incoming-offer-id="${escapeHtml(offer.id)}"
                                  >
                                    <div class="marketplace-enquiry-header">
                                      <div>
                                        <strong>
                                          ${
                                            isRequesterOffer
                                              ? "Requester Offer"
                                              : "Your Offer"
                                          }
                                        </strong>

                                        <div class="muted small">
                                          Offer #${escapeHtml(offer.id)}
                                          ${
                                            offer.createdAt
                                              ? ` · ${formatDate(offer.createdAt)}`
                                              : ""
                                          }
                                        </div>
                                      </div>

                                      <span class="badge">
                                        ${escapeHtml(
                                          formatLabel(offer.status)
                                        )}
                                      </span>
                                    </div>

                                    <div class="marketplace-enquiry-details">
                                      <div>
                                        <span class="muted small">Rate</span>
                                        <strong>
                                          ${escapeHtml(
                                            formatRate(
                                              offer.amount,
                                              offer.currencyCode,
                                              offer.rateUnit
                                            )
                                          )}
                                        </strong>
                                      </div>

                                      <div>
                                        <span class="muted small">Charter Days</span>
                                        <strong>
                                          ${
                                            offer.charterDays != null
                                              ? escapeHtml(offer.charterDays)
                                              : "—"
                                          }
                                        </strong>
                                      </div>

                                      <div>
                                        <span class="muted small">Expires</span>
                                        <strong>
                                          ${
                                            offer.expiresAt
                                              ? formatDate(offer.expiresAt)
                                              : "—"
                                          }
                                        </strong>
                                      </div>
                                    </div>

                                    ${
                                      offer.terms
                                        ? `
                                          <div class="marketplace-enquiry-message">
                                            <span class="muted small">Terms</span>
                                            <p>${escapeHtml(offer.terms)}</p>
                                          </div>
                                        `
                                        : ""
                                    }

                                    ${
                                      isLatest &&
                                      isPending &&
                                      isRequesterOffer
                                        ? `
                                          <div class="marketplace-form-actions">
                                            <button
                                              type="button"
                                              class="btn"
                                              data-charter-incoming-offer-accept
                                              data-charter-offer-id="${escapeHtml(offer.id)}"
                                            >
                                              Accept
                                            </button>

                                            <button
                                              type="button"
                                              class="btn ghost"
                                              data-charter-incoming-offer-reject
                                              data-charter-offer-id="${escapeHtml(offer.id)}"
                                            >
                                              Reject
                                            </button>

                                            <button
                                              type="button"
                                              class="btn ghost"
                                              data-charter-incoming-offer-counter
                                              data-charter-offer-id="${escapeHtml(offer.id)}"
                                            >
                                              Counter
                                            </button>
                                          </div>

                                          ${
                                            state.counteringOfferId === Number(offer.id)
                                              ? `
                                                <form
                                                  class="marketplace-form"
                                                  data-charter-incoming-counter-form
                                                  data-charter-offer-id="${escapeHtml(offer.id)}"
                                                  data-charter-enquiry-id="${escapeHtml(enquiry.id)}"
                                                  hidden
                                                >
                                                  <div class="marketplace-form-head">
                                                    <div>
                                                      <strong>Counter Requester Offer</strong>
                                                      <div class="muted small">
                                                        Send a revised offer to the requester.
                                                      </div>
                                                    </div>
                                                  </div>

                                                  <div class="marketplace-form-grid">
                                                    <label>
                                                      Amount
                                                      <input
                                                        type="number"
                                                        name="amount"
                                                        min="0.01"
                                                        step="0.01"
                                                        placeholder="e.g. 25000"
                                                      >
                                                    </label>

                                                    <label>
                                                      Currency
                                                      <input
                                                        type="text"
                                                        name="currencyCode"
                                                        maxlength="3"
                                                        value="USD"
                                                        placeholder="USD"
                                                      >
                                                    </label>

                                                    <label>
                                                      Rate Unit
                                                      <select name="rateUnit">
                                                        <option value="">Select rate unit</option>
                                                        <option value="per_day">Per Day</option>
                                                        <option value="per_voyage">Per Voyage</option>
                                                        <option value="per_metric_ton">Per Metric Ton</option>
                                                        <option value="lump_sum">Lump Sum</option>
                                                      </select>
                                                    </label>

                                                    <label>
                                                      Charter Days
                                                      <input
                                                        type="number"
                                                        name="charterDays"
                                                        min="1"
                                                        step="1"
                                                        placeholder="e.g. 14"
                                                      >
                                                    </label>

                                                    <label>
                                                      Expires At
                                                      <input
                                                        type="datetime-local"
                                                        name="expiresAt"
                                                      >
                                                    </label>
                                                  </div>

                                                  <label>
                                                    Terms
                                                    <textarea
                                                      name="terms"
                                                      rows="4"
                                                      placeholder="Enter revised terms or conditions..."
                                                    ></textarea>
                                                  </label>

                                                  <div
                                                    class="marketplace-form-message muted small"
                                                    data-charter-incoming-counter-message
                                                  ></div>

                                                  <div class="marketplace-form-actions">
                                                    <button
                                                      type="submit"
                                                      class="btn"
                                                    >
                                                      Submit Counter
                                                    </button>

                                                    <button
                                                      type="button"
                                                      class="btn ghost"
                                                      data-charter-incoming-counter-cancel
                                                    >
                                                      Cancel
                                                    </button>
                                                  </div>
                                                </form>
                                              `
                                              : ""
                                          }
                                        `
                                        : ""
                                    }
                                  </div>
                                `;
                              }).join("")
                            : `
                              <div class="marketplace-empty muted">
                                No charter offers were found for this enquiry.
                              </div>
                            `
                        }
                      </div>
                    `
                    : ""
                }
              `
              : ""
          }
        </article>
      `;
    }).join("");

    renderIncomingPagination();
  }

  function openIncomingCharterCounterForm(offer) {
    if (!offer || !offer.id) {
      alert("Charter offer could not be found.");
      return;
    }

    state.counteringOfferId = Number(offer.id);

    renderIncomingCharterEnquiries();

    const form = document.querySelector(
      `[data-charter-incoming-counter-form][data-charter-offer-id="${CSS.escape(String(offer.id))}"]`
    );

    if (!form) {
      console.warn(
        "Incoming charter counter form could not be found."
      );
      return;
    }

    const amountInput = form.elements.amount;
    if (amountInput) {
      amountInput.value =
        offer.amount === null || offer.amount === undefined
          ? ""
          : String(offer.amount);
    }

    const currencyInput = form.elements.currencyCode;
    if (currencyInput) {
      currencyInput.value =
        offer.currencyCode || "USD";
    }

    const rateUnitInput = form.elements.rateUnit;
    if (rateUnitInput) {
      rateUnitInput.value =
        offer.rateUnit || "";
    }

    const charterDaysInput = form.elements.charterDays;
    if (charterDaysInput) {
      charterDaysInput.value =
        offer.charterDays === null ||
        offer.charterDays === undefined
          ? ""
          : String(offer.charterDays);
    }

    const termsInput = form.elements.terms;
    if (termsInput) {
      termsInput.value =
        offer.terms || "";
    }

    const expiresAtInput = form.elements.expiresAt;
    if (expiresAtInput && offer.expiresAt) {
      const expiry = new Date(offer.expiresAt);

      if (!Number.isNaN(expiry.getTime())) {
        const localValue =
          new Date(
            expiry.getTime() -
            expiry.getTimezoneOffset() * 60000
          )
            .toISOString()
            .slice(0, 16);

        expiresAtInput.value = localValue;
      }
    }

    form.hidden = false;

    form.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  async function acceptIncomingCharterOffer(offerId) {
    if (!offerId) return;

    if (!confirm("Accept this charter offer?")) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/charter/offers/${encodeURIComponent(offerId)}/accept`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Accept": "application/json"
          }
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
          result.message ||
          `Unable to accept charter offer (HTTP ${response.status})`
        );
      }

      alert("Charter offer accepted successfully.");

      state.incomingViewingOffersId = null;

      await loadIncomingCharterEnquiries();

    } catch (error) {
      console.error(
        "Incoming charter offer acceptance error:",
        error
      );

      alert(
        error.message ||
        "Unable to accept charter offer."
      );
    }
  }

  async function rejectIncomingCharterOffer(offerId) {
    if (!offerId) return;

    if (!confirm("Reject this charter offer?")) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/charter/offers/${encodeURIComponent(offerId)}/reject`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Accept": "application/json"
          }
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
          result.message ||
          `Unable to reject charter offer (HTTP ${response.status})`
        );
      }

      alert("Charter offer rejected successfully.");

      state.incomingViewingOffersId = null;

      await loadIncomingCharterEnquiries();

    } catch (error) {
      console.error(
        "Incoming charter offer rejection error:",
        error
      );

      alert(
        error.message ||
        "Unable to reject charter offer."
      );
    }
  }

  async function submitIncomingCharterCounterOffer(event) {
    event.preventDefault();

    const form = event.target.closest(
      "[data-charter-incoming-counter-form]"
    );

    if (!form) return;

    const offerId =
      form.dataset.charterOfferId;

    const enquiryId =
      form.dataset.charterEnquiryId;

    const message =
      form.querySelector(
        "[data-charter-incoming-counter-message]"
      );

    const submitButton =
      form.querySelector('button[type="submit"]');

    if (!offerId || !enquiryId) {
      if (message) {
        message.textContent =
          "Missing charter offer or enquiry.";
      }
      return;
    }

    const amountInput =
      form.elements.amount;

    const currencyInput =
      form.elements.currencyCode;

    const rateUnitInput =
      form.elements.rateUnit;

    const charterDaysInput =
      form.elements.charterDays;

    const termsInput =
      form.elements.terms;

    const expiresAtInput =
      form.elements.expiresAt;

    const amountValue =
      amountInput?.value.trim() || "";

    const currencyCode =
      currencyInput?.value.trim().toUpperCase() || "USD";

    const rateUnit =
      rateUnitInput?.value.trim() || "";

    const charterDaysValue =
      charterDaysInput?.value.trim() || "";

    const terms =
      termsInput?.value.trim() || "";

    const expiresAt =
      expiresAtInput?.value.trim() || "";

    if (
      amountValue &&
      (!Number.isFinite(Number(amountValue)) ||
        Number(amountValue) <= 0)
    ) {
      if (message) {
        message.textContent =
          "Counter amount must be a positive number.";
      }
      return;
    }

    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      if (message) {
        message.textContent =
          "Currency must be a 3-letter code such as USD.";
      }
      return;
    }

    if (
      charterDaysValue &&
      (!Number.isInteger(Number(charterDaysValue)) ||
        Number(charterDaysValue) <= 0)
    ) {
      if (message) {
        message.textContent =
          "Charter days must be a positive whole number.";
      }
      return;
    }

    const payload = {
      amount: amountValue
        ? Number(amountValue)
        : null,
      currencyCode,
      rateUnit: rateUnit || null,
      charterDays: charterDaysValue
        ? Number(charterDaysValue)
        : null,
      terms: terms || null,
      expiresAt: expiresAt || null
    };

    try {
      if (message) {
        message.textContent =
          "Submitting counter-offer...";
      }

      if (submitButton) {
        submitButton.disabled = true;
      }

      const response = await fetch(
        `${API_BASE}/api/charter/offers/${encodeURIComponent(offerId)}/counter`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
          result.message ||
          `Unable to create incoming charter counter-offer (HTTP ${response.status})`
        );
      }

      alert(
        "Charter counter-offer submitted successfully."
      );

      state.counteringOfferId = null;

      await loadIncomingCharterEnquiryOffers(enquiryId);

    } catch (error) {
      console.error(
        "Incoming charter counter-offer submission error:",
        error
      );

      if (message) {
        message.textContent =
          error.message ||
          "Unable to submit charter counter-offer.";
      }

    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  }

  async function submitCharterOffer(event) {
    event.preventDefault();

    const form = event.target.closest(
      "[data-charter-offer-form]"
    );

    if (!form) return;

    const enquiryId =
      form.dataset.charterEnquiryId;

    const message =
      form.querySelector("[data-charter-offer-message]");

    const submitButton =
      form.querySelector('button[type="submit"]');

    if (!enquiryId) {
      if (message) {
        message.textContent =
          "Missing charter enquiry.";
      }
      return;
    }

    const amountInput =
      form.elements.amount;

    const currencyInput =
      form.elements.currencyCode;

    const rateUnitInput =
      form.elements.rateUnit;

    const charterDaysInput =
      form.elements.charterDays;

    const termsInput =
      form.elements.terms;

    const expiresAtInput =
      form.elements.expiresAt;

    const amountValue =
      amountInput?.value.trim() || "";

    const currencyCode =
      currencyInput?.value.trim().toUpperCase() || "USD";

    const rateUnit =
      rateUnitInput?.value.trim() || "";

    const charterDaysValue =
      charterDaysInput?.value.trim() || "";

    const terms =
      termsInput?.value.trim() || "";

    const expiresAt =
      expiresAtInput?.value.trim() || "";

    if (
      amountValue &&
      (!Number.isFinite(Number(amountValue)) ||
        Number(amountValue) <= 0)
    ) {
      if (message) {
        message.textContent =
          "Offer amount must be a positive number.";
      }
      return;
    }

    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      if (message) {
        message.textContent =
          "Currency must be a 3-letter code such as USD.";
      }
      return;
    }

    if (
      charterDaysValue &&
      (!Number.isInteger(Number(charterDaysValue)) ||
        Number(charterDaysValue) <= 0)
    ) {
      if (message) {
        message.textContent =
          "Charter days must be a positive whole number.";
      }
      return;
    }

    const payload = {
      amount: amountValue
        ? Number(amountValue)
        : null,
      currencyCode,
      rateUnit: rateUnit || null,
      charterDays: charterDaysValue
        ? Number(charterDaysValue)
        : null,
      terms: terms || null,
      expiresAt: expiresAt || null
    };

    try {
      if (message) {
        message.textContent =
          "Submitting offer...";
      }

      if (submitButton) {
        submitButton.disabled = true;
      }

      const response = await fetch(
        `/api/charter/enquiries/${encodeURIComponent(enquiryId)}/offers`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
          "Unable to create charter offer."
        );
      }

      alert("Charter offer submitted successfully.");

      await loadIncomingCharterEnquiries();

    } catch (error) {
      console.error(
        "Charter offer submission error:",
        error
      );

      if (message) {
        message.textContent =
          error.message ||
          "Unable to submit charter offer.";
      }

    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
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

  async function acceptCharterOffer(offerId) {
    if (!offerId) return;

    if (!confirm("Accept this charter offer?")) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/charter/offers/${encodeURIComponent(offerId)}/accept`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Accept": "application/json"
          }
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
          result.message ||
          `Unable to accept charter offer (HTTP ${response.status})`
        );
      }

      alert("Charter offer accepted successfully.");

      state.viewingEnquiryOffersId = null;

      await loadCharterEnquiries();

    } catch (error) {
      console.error(
        "Charter offer acceptance error:",
        error
      );

      alert(
        error.message ||
        "Unable to accept charter offer."
      );
    }
  }

  async function rejectCharterOffer(offerId) {
    if (!offerId) return;

    if (!confirm("Reject this charter offer?")) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/charter/offers/${encodeURIComponent(offerId)}/reject`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Accept": "application/json"
          }
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
          result.message ||
          `Unable to reject charter offer (HTTP ${response.status})`
        );
      }

      alert("Charter offer rejected successfully.");

      state.viewingEnquiryOffersId = null;

      await loadCharterEnquiries();

    } catch (error) {
      console.error(
        "Charter offer rejection error:",
        error
      );

      alert(
        error.message ||
        "Unable to reject charter offer."
      );
    }
  }
  function openCharterCounterForm(offer) {
    if (!offer || !offer.id) {
      alert("Charter offer could not be found.");
      return;
    }

    state.counteringOfferId = Number(offer.id);

    renderCharterEnquiries();

    const form = document.querySelector(
      `[data-charter-counter-form][data-charter-offer-id="${CSS.escape(String(offer.id))}"]`
    );

    if (!form) {
      console.warn(
        "Charter counter form could not be found."
      );
      return;
    }

    const amountInput = form.elements.amount;
    if (amountInput) {
      amountInput.value =
        offer.amount === null || offer.amount === undefined
          ? ""
          : String(offer.amount);
    }

    const currencyInput = form.elements.currencyCode;
    if (currencyInput) {
      currencyInput.value =
        offer.currencyCode || "USD";
    }

    const rateUnitInput = form.elements.rateUnit;
    if (rateUnitInput) {
      rateUnitInput.value =
        offer.rateUnit || "";
    }

    const charterDaysInput = form.elements.charterDays;
    if (charterDaysInput) {
      charterDaysInput.value =
        offer.charterDays === null ||
        offer.charterDays === undefined
          ? ""
          : String(offer.charterDays);
    }

    const termsInput = form.elements.terms;
    if (termsInput) {
      termsInput.value =
        offer.terms || "";
    }

    const expiresAtInput = form.elements.expiresAt;
    if (expiresAtInput && offer.expiresAt) {
      const expiry = new Date(offer.expiresAt);

      if (!Number.isNaN(expiry.getTime())) {
        const localValue =
          new Date(
            expiry.getTime() -
            expiry.getTimezoneOffset() * 60000
          )
            .toISOString()
            .slice(0, 16);

        expiresAtInput.value = localValue;
      }
    }

    form.hidden = false;

    form.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }


  async function submitCharterCounterOffer(event) {
  event.preventDefault();

  const form = event.target.closest(
    "[data-charter-counter-form]"
  );

  if (!form) return;

  const offerId =
    form.dataset.charterOfferId;

  const enquiryId =
    form.dataset.charterEnquiryId;

  const message =
    form.querySelector("[data-charter-counter-message]");

  const submitButton =
    form.querySelector('button[type="submit"]');

  if (!offerId || !enquiryId) {
    if (message) {
      message.textContent =
        "Missing charter offer or enquiry.";
    }
    return;
  }

  const amountInput =
    form.elements.amount;

  const currencyInput =
    form.elements.currencyCode;

  const rateUnitInput =
    form.elements.rateUnit;

  const charterDaysInput =
    form.elements.charterDays;

  const termsInput =
    form.elements.terms;

  const expiresAtInput =
    form.elements.expiresAt;

  const amountValue =
    amountInput?.value.trim() || "";

  const currencyCode =
    currencyInput?.value.trim().toUpperCase() || "USD";

  const rateUnit =
    rateUnitInput?.value.trim() || "";

  const charterDaysValue =
    charterDaysInput?.value.trim() || "";

  const terms =
    termsInput?.value.trim() || "";

  const expiresAt =
    expiresAtInput?.value.trim() || "";

  if (
    amountValue &&
    (!Number.isFinite(Number(amountValue)) ||
      Number(amountValue) <= 0)
  ) {
    if (message) {
      message.textContent =
        "Counter amount must be a positive number.";
    }
    return;
  }

  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    if (message) {
      message.textContent =
        "Currency must be a 3-letter code such as USD.";
    }
    return;
  }

  if (
    charterDaysValue &&
    (!Number.isInteger(Number(charterDaysValue)) ||
      Number(charterDaysValue) <= 0)
  ) {
    if (message) {
      message.textContent =
        "Charter days must be a positive whole number.";
    }
    return;
  }

  const payload = {
    amount: amountValue
      ? Number(amountValue)
      : null,
    currencyCode,
    rateUnit: rateUnit || null,
    charterDays: charterDaysValue
      ? Number(charterDaysValue)
      : null,
    terms: terms || null,
    expiresAt: expiresAt || null
  };

  try {
    if (message) {
      message.textContent =
        "Submitting counter-offer...";
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    const response = await fetch(
      `${API_BASE}/api/charter/offers/${encodeURIComponent(offerId)}/counter`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.error ||
        result.message ||
        `Unable to create charter counter-offer (HTTP ${response.status})`
      );
    }

    alert(
      "Charter counter-offer submitted successfully."
    );

    state.counteringOfferId = null;

    await loadCharterEnquiryOffers(enquiryId);

  } catch (error) {
    console.error(
      "Charter counter-offer submission error:",
      error
    );

    if (message) {
      message.textContent =
        error.message ||
        "Unable to submit charter counter-offer.";
    }

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

function renderCharterEnquiries() {
    const body = $("charterEnquiriesBody");

    if (!body) return;

    const currentUser = currentDashboardUser();
    const currentUserId = Number(currentUser?.id);

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

                  ${
                state.viewingEnquiryOffersId === Number(enquiry.id)
                  ? `
                    <div class="marketplace-enquiry-offers">
                      <div class="marketplace-enquiry-header">
                        <strong>Charter Offers</strong>
                      </div>

                      ${
                        Array.isArray(enquiry.offers) &&
                        enquiry.offers.length
                          ? enquiry.offers.map(offer => `
                              <div class="marketplace-enquiry-card">
                                <div class="marketplace-enquiry-details">
                                  <strong>
                                    ${escapeHtml(
                                      formatRate(
                                        offer.amount,
                                        offer.currencyCode,
                                        offer.rateUnit
                                      )
                                    )}
                                  </strong>

                                  <div class="muted small">
                                    ${
                                      offer.charterDays
                                        ? `${escapeHtml(offer.charterDays)} charter days`
                                        : "Charter days not specified"
                                    }
                                  </div>
                                </div>

                                ${
                                  offer.terms
                                    ? `
                                      <div class="marketplace-enquiry-message">
                                        ${escapeHtml(offer.terms)}
                                      </div>
                                    `
                                    : ""
                                }

                                <div class="marketplace-listing-footer">
                                  <span class="muted small">
                                    Offered ${escapeHtml(
                                      formatDate(offer.createdAt)
                                    )}
                                  </span>

                                  <span class="marketplace-status ${escapeHtml(
                                    offer.status || "pending"
                                  )}">
                                    ${escapeHtml(
                                      formatLabel(offer.status)
                                    )}
                                  </span>
                                </div>

                                ${
                                  offer.expiresAt
                                    ? `
                                      <div class="muted small">
                                        Expires ${escapeHtml(
                                          formatDate(offer.expiresAt)
                                        )}
                                      </div>
                                    `
                                    : ""
                                }

                                ${
                                  Number(offer.offeredByUserId) !== currentUserId &&
                                  offer.status === "pending" &&
                                  Array.isArray(enquiry.offers) &&
                                  offer.id === enquiry.offers[enquiry.offers.length - 1]?.id
                                    ? `
                                      <div class="marketplace-form-actions">
                                        <button
                                          type="button"
                                          class="btn"
                                          data-charter-offer-accept
                                          data-charter-offer-id="${escapeHtml(offer.id)}"
                                        >
                                          Accept
                                        </button>

                                        <button
                                          type="button"
                                          class="btn ghost"
                                          data-charter-offer-reject
                                          data-charter-offer-id="${escapeHtml(offer.id)}"
                                        >
                                          Reject
                                        </button>

                                        <button
                                          type="button"
                                          class="btn ghost"
                                          data-charter-offer-counter
                                          data-charter-offer-id="${escapeHtml(offer.id)}"
                                        >
                                          Counter
                                        </button>
                                      </div>
                                        ${
                                          state.counteringOfferId === Number(offer.id)
                                            ? `
                                              <form
                                                class="marketplace-form"
                                                data-charter-counter-form
                                                data-charter-offer-id="${escapeHtml(offer.id)}"
                                                data-charter-enquiry-id="${escapeHtml(enquiry.id)}"
                                              >
                                                <div class="marketplace-form-head">
                                                  <strong>Counter Offer</strong>
                                                </div>

                                                <div class="marketplace-form-grid">
                                                  <div class="marketplace-field">
                                                    <label class="muted small">Offer Amount</label>
                                                    <input
                                                      type="number"
                                                      name="amount"
                                                      min="0"
                                                      step="0.01"
                                                      placeholder="e.g. 8500"
                                                    >
                                                  </div>

                                                  <div class="marketplace-field">
                                                    <label class="muted small">Currency</label>
                                                    <input
                                                      type="text"
                                                      name="currencyCode"
                                                      value="USD"
                                                      maxlength="3"
                                                      placeholder="USD"
                                                    >
                                                  </div>

                                                  <div class="marketplace-field">
                                                    <label class="muted small">Rate Unit</label>
                                                    <select name="rateUnit">
                                                      <option value="">Select rate unit</option>
                                                      <option value="per_day">Per day</option>
                                                      <option value="per_voyage">Per voyage</option>
                                                      <option value="per_metric_ton">Per metric ton</option>
                                                      <option value="lump_sum">Lump sum</option>
                                                    </select>
                                                  </div>

                                                  <div class="marketplace-field">
                                                    <label class="muted small">Charter Days</label>
                                                    <input
                                                      type="number"
                                                      name="charterDays"
                                                      min="1"
                                                      step="1"
                                                      placeholder="e.g. 7"
                                                    >
                                                  </div>

                                                  <div class="marketplace-field">
                                                    <label class="muted small">Offer Expires</label>
                                                    <input
                                                      type="datetime-local"
                                                      name="expiresAt"
                                                    >
                                                  </div>

                                                  <div class="marketplace-field marketplace-field-wide">
                                                    <label class="muted small">Terms</label>
                                                    <textarea
                                                      name="terms"
                                                      rows="4"
                                                      placeholder="Enter the counter-offer terms, conditions or other important details."
                                                    ></textarea>
                                                  </div>
                                                </div>

                                                <div
                                                  class="marketplace-form-message muted small"
                                                  data-charter-counter-message
                                                ></div>

                                                <div class="marketplace-form-actions">
                                                  <button
                                                    type="submit"
                                                    class="btn"
                                                  >
                                                    Submit Counter
                                                  </button>

                                                  <button
                                                    type="button"
                                                    class="btn ghost"
                                                    data-charter-counter-cancel
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </form>
                                            `
                                            : ""
                                        }
                                    `
                                    : ""
                                }
                              </div>
                            `).join("")
                          : `
                            <div class="marketplace-empty muted">
                              No charter offers are available yet.
                            </div>
                          `
                      }
                    </div>
                  `
                  : ""
              }

            <div class="marketplace-form-actions">
              ${
                ["submitted", "under_review"].includes(
                  enquiry.status
                )
                  ? `
                    <button
                      type="button"
                      class="btn ghost"
                      data-charter-enquiry-edit
                      data-charter-enquiry-id="${escapeHtml(enquiry.id)}"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      class="btn ghost"
                      data-charter-enquiry-withdraw
                      data-charter-enquiry-id="${escapeHtml(enquiry.id)}"
                    >
                      Withdraw
                    </button>
                  `
                  : ""
              }

              ${
                ["offer_made", "negotiating"].includes(
                  enquiry.status
                )
                  ? `
                    <button
                      type="button"
                      class="btn ghost"
                      data-charter-enquiry-offers
                      data-charter-enquiry-id="${escapeHtml(enquiry.id)}"
                    >
                      View Offer
                    </button>
                  `
                  : ""
              }
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

    function openEnquiryEditForm(enquiryId) {
      const enquiry = state.enquiries.find(
        item => String(item.id) === String(enquiryId)
      );

      if (!enquiry) {
        alert("Charter enquiry could not be found.");
        return;
      }

      const form = $("charterEnquiryForm");

      if (!form) {
        console.warn(
          "Charter enquiry form is not present in the dashboard."
        );
        return;
      }

      state.editingEnquiryId = Number(enquiry.id);

      const listingInput = $("charterEnquiryListingId");
      if (listingInput) {
        listingInput.value = String(enquiry.listingId || "");
      }

      const selected = $("charterSelectedVessel");
      if (selected) {
        selected.textContent = `${enquiry.vesselName || enquiry.vesselCode || "Vessel"} — ${enquiry.listingTitle || "Charter listing"}`;
      }

      const cargoType = $("charterEnquiryCargoType");
      if (cargoType) {
        cargoType.value = enquiry.cargoType || "";
      }

      const cargoQuantity = $("charterEnquiryCargoQuantity");
      if (cargoQuantity) {
        cargoQuantity.value = enquiry.cargoQuantityTons ?? "";
      }

      const originPort = $("charterEnquiryOriginPortId");
      if (originPort) {
        originPort.value = enquiry.originPortId ?? "";
      }

      const destinationPort = $("charterEnquiryDestinationPortId");
      if (destinationPort) {
        destinationPort.value = enquiry.destinationPortId ?? "";
      }

      const startDate = $("charterEnquiryStartDate");
      if (startDate) {
        startDate.value = enquiry.requestedStartDate || "";
      }

      const endDate = $("charterEnquiryEndDate");
      if (endDate) {
        endDate.value = enquiry.requestedEndDate || "";
      }

      const message = $("charterEnquiryMessage");
      if (message) {
        message.value = enquiry.message || "";
      }

      const heading = form.querySelector(".marketplace-form-head strong");
      if (heading) {
        heading.textContent = "Edit Charter Enquiry";
      }

      const submitButton = form.querySelector(
        "button[type='submit']"
      );

      if (submitButton) {
        submitButton.textContent = "Save Changes";
      }

      form.hidden = false;

      form.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  function openEnquiryForm(listingId) {
    state.editingEnquiryId = null;
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

    state.editingEnquiryId = null;

    const heading = form.querySelector(
      ".marketplace-form-head strong"
    );

    if (heading) {
      heading.textContent = "Request Charter";
    }

    const submitButton = form.querySelector(
      "button[type='submit']"
    );

    if (submitButton) {
      submitButton.textContent = "Submit Charter Enquiry";
    }

    form.hidden = true;
  }

  async function submitCharterEnquiry(event) {
      event.preventDefault();

      const form = event.currentTarget;

      const editingEnquiryId = state.editingEnquiryId;

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

      if (
        !editingEnquiryId &&
        (!Number.isInteger(listingId) || listingId <= 0)
      ) {
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
        submitButton.textContent = editingEnquiryId
          ? "Saving..."
          : "Submitting...";
      }

      const payload = {
        cargoType,
        cargoQuantityTons,
        originPortId,
        destinationPortId,
        requestedStartDate,
        requestedEndDate,
        message
      };

      try {
        const url = editingEnquiryId
          ? `${API_BASE}/api/charter/enquiries/${editingEnquiryId}`
          : `${API_BASE}/api/charter/enquiries`;

        const method = editingEnquiryId
          ? "PATCH"
          : "POST";

        if (!editingEnquiryId) {
          payload.listingId = listingId;
        }

        const response = await fetch(
          url,
          {
            method,
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error ||
            result.message ||
            `Charter enquiry returned HTTP ${response.status}`
          );
        }

        alert(
          editingEnquiryId
            ? "Charter enquiry updated successfully."
            : "Charter enquiry submitted successfully."
        );

        state.editingEnquiryId = null;

        form.reset();

        const listingInput = $("charterEnquiryListingId");

        if (listingInput) {
          listingInput.value = "";
        }

        const heading =
          form.querySelector(".marketplace-form-head strong");

        if (heading) {
          heading.textContent = "Request Charter";
        }

        if (submitButton) {
          submitButton.textContent = "Submit Charter Enquiry";
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
          submitButton.textContent = state.editingEnquiryId
            ? "Save Changes"
            : "Submit Charter Enquiry";
        }
      }
    }
  async function withdrawCharterEnquiry(enquiryId) {
    if (!enquiryId) return;

    const confirmed = window.confirm(
      "Withdraw this charter enquiry? This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_BASE}/api/charter/enquiries/${enquiryId}/withdraw`,
        {
          method: "POST",
          headers: {
            "Accept": "application/json"
          }
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
          result.message ||
          `Unable to withdraw charter enquiry (HTTP ${response.status})`
        );
      }

      alert("Charter enquiry withdrawn successfully.");

      await loadCharterEnquiries();

    } catch (error) {
      console.error(
        "Charter enquiry withdrawal error:",
        error
      );

      alert(
        error.message ||
        "Unable to withdraw charter enquiry."
      );
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

    const charterEnquiriesBody = $("charterEnquiriesBody");

    if (charterEnquiriesBody) {
      charterEnquiriesBody.addEventListener("click", event => {
        const editButton =
          event.target.closest("[data-charter-enquiry-edit]");

        if (!editButton) return;

        const enquiryId =
          editButton.dataset.charterEnquiryId;

        if (!enquiryId) return;

        openEnquiryEditForm(enquiryId);
      });
    }

      if (charterEnquiriesBody) {
        charterEnquiriesBody.addEventListener("click", event => {
          const withdrawButton =
            event.target.closest("[data-charter-enquiry-withdraw]");

          if (!withdrawButton) return;

          const enquiryId =
            withdrawButton.dataset.charterEnquiryId;

          if (!enquiryId) return;

          withdrawCharterEnquiry(enquiryId);
        });
      }

    if (charterEnquiriesBody) {
        charterEnquiriesBody.addEventListener("click", event => {
          const offersButton =
            event.target.closest("[data-charter-enquiry-offers]");

          if (!offersButton) return;

          const enquiryId =
            offersButton.dataset.charterEnquiryId;

          if (!enquiryId) return;

          loadCharterEnquiryOffers(enquiryId);
        });
      }

      if (charterEnquiriesBody) {

        charterEnquiriesBody.addEventListener("click", event => {

          const acceptButton =

            event.target.closest("[data-charter-offer-accept]");


          if (!acceptButton) return;


          const offerId =

            acceptButton.dataset.charterOfferId;


          if (!offerId) return;


          acceptCharterOffer(offerId);

        });

      }


      if (charterEnquiriesBody) {

        charterEnquiriesBody.addEventListener("click", event => {

          const rejectButton =

            event.target.closest("[data-charter-offer-reject]");


          if (!rejectButton) return;


          const offerId =

            rejectButton.dataset.charterOfferId;


          if (!offerId) return;


          rejectCharterOffer(offerId);

        });

      }


        if (charterEnquiriesBody) {

          charterEnquiriesBody.addEventListener("click", event => {

            const counterButton =
              event.target.closest("[data-charter-offer-counter]");

            if (!counterButton) return;

            const offerId =
              counterButton.dataset.charterOfferId;

            if (!offerId) return;

            const enquiry = state.enquiries.find(
              item =>
                Array.isArray(item.offers) &&
                item.offers.some(
                  offer =>
                    String(offer.id) === String(offerId)
                )
            );

            if (!enquiry) {
              alert(
                "Charter enquiry could not be found."
              );
              return;
            }

            const offer = enquiry.offers.find(
              item =>
                String(item.id) === String(offerId)
            );

            if (!offer) {
              alert(
                "Charter offer could not be found."
              );
              return;
            }

            openCharterCounterForm(offer);

          });

        }

        charterEnquiriesBody.addEventListener("submit", event => {
          if (
            event.target.matches(
              "[data-charter-counter-form]"
            )
          ) {
            submitCharterCounterOffer(event);
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

        const offerToggle =
          event.target.closest("[data-charter-offer-toggle]");

        const offerCancel =
          event.target.closest("[data-charter-offer-cancel]");

          const incomingOffersButton =
            event.target.closest("[data-charter-incoming-offers]");

          const incomingAcceptButton =
            event.target.closest(
              "[data-charter-incoming-offer-accept]"
            );

          const incomingRejectButton =
            event.target.closest(
              "[data-charter-incoming-offer-reject]"
            );

          const incomingCounterButton =
            event.target.closest(
              "[data-charter-incoming-offer-counter]"
            );

          const incomingCounterCancel =
            event.target.closest(
              "[data-charter-incoming-counter-cancel]"
            );

          if (incomingOffersButton) {
            const enquiryId =
              incomingOffersButton.dataset.charterEnquiryId;

            if (!enquiryId) return;

            loadIncomingCharterEnquiryOffers(enquiryId);
            return;
          }

          if (incomingAcceptButton) {
            const offerId =
              incomingAcceptButton.dataset.charterOfferId;

            if (!offerId) return;

            acceptIncomingCharterOffer(offerId);
            return;
          }

          if (incomingRejectButton) {
            const offerId =
              incomingRejectButton.dataset.charterOfferId;

            if (!offerId) return;

            rejectIncomingCharterOffer(offerId);
            return;
          }

          if (incomingCounterButton) {
            const offerId =
              incomingCounterButton.dataset.charterOfferId;

            if (!offerId) return;

            const enquiryId =
              incomingCounterButton.closest(
                "[data-charter-enquiry-id]"
              )?.dataset.charterEnquiryId;

            const enquiry =
              state.incomingEnquiries.find(
                item => String(item.id) === String(enquiryId)
              );

            const offer =
              enquiry?.offers?.find(
                item => String(item.id) === String(offerId)
              );

            if (!offer) {
              alert("Charter offer could not be found.");
              return;
            }

            openIncomingCharterCounterForm(offer);
            return;
          }

          if (incomingCounterCancel) {
            state.counteringOfferId = null;
            renderIncomingCharterEnquiries();
            return;
          }

        if (offerToggle) {
          const enquiryId =
            offerToggle.dataset.charterEnquiryId;

          const form =
            incomingBody.querySelector(
              `[data-charter-offer-form][data-charter-enquiry-id="${CSS.escape(enquiryId)}"]`
            );

          if (form) {
            form.hidden = !form.hidden;

            if (!form.hidden) {
              form.scrollIntoView({
                behavior: "smooth",
                block: "nearest"
              });
            }
          }

          return;
        }

        if (offerCancel) {
          const form =
            offerCancel.closest(
              "[data-charter-offer-form]"
            );

          if (form) {
            form.hidden = true;
          }

          return;
        }

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

      incomingBody.addEventListener("submit", event => {
        if (
          event.target.matches(
            "[data-charter-offer-form]"
          )
        ) {
          submitCharterOffer(event);
          return;
        }

        if (
          event.target.matches(
            "[data-charter-incoming-counter-form]"
          )
        ) {
          submitIncomingCharterCounterOffer(event);
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
