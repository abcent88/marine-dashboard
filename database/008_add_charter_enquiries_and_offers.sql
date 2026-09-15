CREATE TABLE charter_enquiries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    listing_id BIGINT UNSIGNED NOT NULL,
    requester_user_id BIGINT UNSIGNED NOT NULL,

    cargo_type VARCHAR(100) NULL,
    cargo_quantity_tons DECIMAL(14,2) NULL,

    origin_port_id BIGINT UNSIGNED NULL,
    destination_port_id BIGINT UNSIGNED NULL,

    requested_start_date DATE NULL,
    requested_end_date DATE NULL,

    message TEXT NULL,

    status ENUM(
        'submitted',
        'under_review',
        'offer_made',
        'negotiating',
        'accepted',
        'rejected',
        'withdrawn',
        'closed'
    ) NOT NULL DEFAULT 'submitted',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_charter_enquiries_listing_status (
        listing_id,
        status
    ),
    INDEX idx_charter_enquiries_requester (
        requester_user_id,
        status
    ),
    INDEX idx_charter_enquiries_dates (
        requested_start_date,
        requested_end_date
    ),

    CONSTRAINT fk_charter_enquiries_listing
        FOREIGN KEY (listing_id)
        REFERENCES vessel_marketplace_listings(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_charter_enquiries_requester
        FOREIGN KEY (requester_user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_charter_enquiries_origin_port
        FOREIGN KEY (origin_port_id)
        REFERENCES ports(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT fk_charter_enquiries_destination_port
        FOREIGN KEY (destination_port_id)
        REFERENCES ports(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


CREATE TABLE charter_offers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    enquiry_id BIGINT UNSIGNED NOT NULL,
    offered_by_user_id BIGINT UNSIGNED NOT NULL,
    parent_offer_id BIGINT UNSIGNED NULL,

    amount DECIMAL(15,2) NULL,
    currency_code CHAR(3) NOT NULL DEFAULT 'USD',

    rate_unit ENUM(
        'per_day',
        'per_voyage',
        'per_metric_ton',
        'lump_sum'
    ) NULL,

    charter_days INT UNSIGNED NULL,

    terms TEXT NULL,

    status ENUM(
        'pending',
        'accepted',
        'rejected',
        'countered',
        'withdrawn',
        'expired'
    ) NOT NULL DEFAULT 'pending',

    expires_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_charter_offers_enquiry_status (
        enquiry_id,
        status
    ),
    INDEX idx_charter_offers_user (
        offered_by_user_id
    ),
    INDEX idx_charter_offers_parent (
        parent_offer_id
    ),

    CONSTRAINT fk_charter_offers_enquiry
        FOREIGN KEY (enquiry_id)
        REFERENCES charter_enquiries(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_charter_offers_user
        FOREIGN KEY (offered_by_user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_charter_offers_parent
        FOREIGN KEY (parent_offer_id)
        REFERENCES charter_offers(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
