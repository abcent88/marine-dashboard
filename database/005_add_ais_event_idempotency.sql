ALTER TABLE vessel_positions
    ADD COLUMN source_event_id VARCHAR(150) NULL AFTER source_device_id;

CREATE UNIQUE INDEX uq_vessel_positions_source_event
    ON vessel_positions (source_device_id, source_event_id);
