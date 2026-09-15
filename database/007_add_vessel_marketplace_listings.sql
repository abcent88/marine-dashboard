CREATE TABLE vessel_marketplace_listings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vessel_id BIGINT UNSIGNED NOT NULL,
    listed_by_user_id BIGINT UNSIGNED NOT NULL,

    title VARCHAR(200) NOT NULL,
    description TEXT NULL,

    charter_type ENUM(
        'voyage_charter',
        'time_charter',
        'bareboat',
        'contract_of_affreightment'
    ) NOT NULL DEFAULT 'voyage_charter',

    cargo_type VARCHAR(100) NULL,
    availability_status ENUM(
        'available',
        'under_enquiry',
        'under_negotiation',
        'chartered',
        'unavailable'
    ) NOT NULL DEFAULT 'available',

    available_from DATE NULL,
    available_until DATE NULL,

    minimum_charter_days INT UNSIGNED NULL,
    maximum_charter_days INT UNSIGNED NULL,

    indicative_rate DECIMAL(15,2) NULL,
    rate_unit ENUM(
        'per_day',
        'per_voyage',
        'per_metric_ton',
        'lump_sum'
    ) NULL,
    currency_code CHAR(3) NOT NULL DEFAULT 'USD',

    verification_status ENUM(
        'pending',
        'verified',
        'rejected'
    ) NOT NULL DEFAULT 'pending',

    listing_status ENUM(
        'draft',
        'published',
        'suspended',
        'closed'
    ) NOT NULL DEFAULT 'draft',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_marketplace_vessel (vessel_id),
    INDEX idx_marketplace_status (listing_status, availability_status),
    INDEX idx_marketplace_charter_type (charter_type),
    INDEX idx_marketplace_cargo_type (cargo_type),
    INDEX idx_marketplace_availability (available_from, available_until),

    CONSTRAINT fk_marketplace_vessel
        FOREIGN KEY (vessel_id)
        REFERENCES vessels(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_marketplace_listed_by
        FOREIGN KEY (listed_by_user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
