ALTER TABLE vessels
    ADD COLUMN mmsi VARCHAR(20) NULL UNIQUE AFTER call_sign;

ALTER TABLE vessel_positions
    ADD COLUMN position_source ENUM('gps','ais','manual') NOT NULL DEFAULT 'manual' AFTER heading_degrees;

ALTER TABLE vessel_positions
    ADD COLUMN source_device_id VARCHAR(100) NULL AFTER position_source;

ALTER TABLE vessel_positions
    ADD COLUMN source_timestamp DATETIME NULL AFTER source_device_id;

CREATE INDEX idx_vessel_positions_source_time
    ON vessel_positions (position_source, recorded_at);

CREATE INDEX idx_vessel_positions_device_time
    ON vessel_positions (source_device_id, recorded_at);
