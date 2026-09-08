ALTER TABLE vessel_positions
    ADD CONSTRAINT chk_vessel_positions_latitude
        CHECK (latitude BETWEEN -90 AND 90),
    ADD CONSTRAINT chk_vessel_positions_longitude
        CHECK (longitude BETWEEN -180 AND 180),
    ADD CONSTRAINT chk_vessel_positions_speed
        CHECK (speed_knots IS NULL OR speed_knots >= 0),
    ADD CONSTRAINT chk_vessel_positions_heading
        CHECK (
            heading_degrees IS NULL
            OR (heading_degrees >= 0 AND heading_degrees < 360)
        );
