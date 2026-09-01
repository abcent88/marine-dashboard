CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('super_admin','admin','manager','captain','crew','operator','viewer') NOT NULL DEFAULT 'viewer',
    status ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
    last_login_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vessels (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vessel_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    vessel_type VARCHAR(100) NOT NULL,
    flag_country VARCHAR(100) NULL,
    imo_number VARCHAR(20) NULL UNIQUE,
    call_sign VARCHAR(50) NULL,
    capacity_tons DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM('active','restricted','maintenance','out_of_service','retired') NOT NULL DEFAULT 'active',
    home_port_id BIGINT UNSIGNED NULL,
    commissioned_date DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ports (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    country VARCHAR(100) NOT NULL,
    code VARCHAR(20) NULL UNIQUE,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE vessels
    ADD CONSTRAINT fk_vessels_home_port
    FOREIGN KEY (home_port_id) REFERENCES ports(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE crew_members (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    vessel_id BIGINT UNSIGNED NULL,
    employee_code VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    position VARCHAR(100) NOT NULL,
    phone VARCHAR(50) NULL,
    certification VARCHAR(255) NULL,
    status ENUM('active','inactive','on_leave') NOT NULL DEFAULT 'active',
    joined_at DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_crew_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_crew_vessel
        FOREIGN KEY (vessel_id) REFERENCES vessels(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE voyages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vessel_id BIGINT UNSIGNED NOT NULL,
    voyage_number VARCHAR(50) NOT NULL UNIQUE,
    departure_port_id BIGINT UNSIGNED NULL,
    destination_port_id BIGINT UNSIGNED NULL,
    status ENUM('planned','in_progress','completed','cancelled') NOT NULL DEFAULT 'planned',
    departure_at DATETIME NULL,
    expected_arrival_at DATETIME NULL,
    actual_arrival_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_voyages_vessel
        FOREIGN KEY (vessel_id) REFERENCES vessels(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_voyages_departure_port
        FOREIGN KEY (departure_port_id) REFERENCES ports(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_voyages_destination_port
        FOREIGN KEY (destination_port_id) REFERENCES ports(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vessel_positions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vessel_id BIGINT UNSIGNED NOT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    speed_knots DECIMAL(8,2) NULL,
    heading_degrees DECIMAL(8,2) NULL,
    recorded_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_vessel_positions_vessel_time (vessel_id, recorded_at),
    CONSTRAINT fk_positions_vessel
        FOREIGN KEY (vessel_id) REFERENCES vessels(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vessel_fuel_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vessel_id BIGINT UNSIGNED NOT NULL,
    fuel_type VARCHAR(50) NOT NULL,
    quantity_liters DECIMAL(12,2) NOT NULL,
    recorded_at DATETIME NOT NULL,
    notes VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_fuel_vessel_time (vessel_id, recorded_at),
    CONSTRAINT fk_fuel_vessel
        FOREIGN KEY (vessel_id) REFERENCES vessels(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_records (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vessel_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    maintenance_type ENUM('preventive','corrective','inspection','emergency') NOT NULL,
    status ENUM('scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
    priority ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
    scheduled_at DATETIME NULL,
    completed_at DATETIME NULL,
    cost DECIMAL(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_maintenance_vessel_status (vessel_id, status),
    CONSTRAINT fk_maintenance_vessel
        FOREIGN KEY (vessel_id) REFERENCES vessels(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE catch_records (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vessel_id BIGINT UNSIGNED NOT NULL,
    voyage_id BIGINT UNSIGNED NULL,
    species VARCHAR(150) NOT NULL,
    quantity_kg DECIMAL(14,2) NOT NULL DEFAULT 0,
    recorded_at DATETIME NOT NULL,
    location_latitude DECIMAL(10,7) NULL,
    location_longitude DECIMAL(10,7) NULL,
    notes VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_catch_vessel_time (vessel_id, recorded_at),
    INDEX idx_catch_species (species),
    CONSTRAINT fk_catch_vessel
        FOREIGN KEY (vessel_id) REFERENCES vessels(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_catch_voyage
        FOREIGN KEY (voyage_id) REFERENCES voyages(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE alerts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vessel_id BIGINT UNSIGNED NULL,
    alert_type VARCHAR(100) NOT NULL,
    severity ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at DATETIME NULL,
    resolved_at DATETIME NULL,
    INDEX idx_alerts_status_created (status, created_at),
    CONSTRAINT fk_alerts_vessel
        FOREIGN KEY (vessel_id) REFERENCES vessels(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE daily_metrics (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    metric_date DATE NOT NULL UNIQUE,
    sales_amount DECIMAL(16,2) NOT NULL DEFAULT 0,
    capture_kg DECIMAL(14,2) NOT NULL DEFAULT 0,
    target_capture_kg DECIMAL(14,2) NOT NULL DEFAULT 0,
    active_vessels INT UNSIGNED NOT NULL DEFAULT 0,
    fuel_consumed_liters DECIMAL(14,2) NOT NULL DEFAULT 0,
    performance_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NULL,
    entity_id BIGINT UNSIGNED NULL,
    details JSON NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_user_time (user_id, created_at),
    INDEX idx_audit_entity (entity_type, entity_id),
    CONSTRAINT fk_audit_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
