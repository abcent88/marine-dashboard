USE marine_dashboard;

-- ------------------------------------------------------------
-- PORTS
-- ------------------------------------------------------------

INSERT INTO ports
    (id, name, country, code, latitude, longitude)
VALUES
    (1, 'Port of Rotterdam', 'Netherlands', 'RTM', 51.9496, 4.1453),
    (2, 'Port of Singapore', 'Singapore', 'SGP', 1.2644, 103.8400),
    (3, 'Port of Mombasa', 'Kenya', 'MBA', -4.0435, 39.6682),
    (4, 'Port of Lagos', 'Nigeria', 'LOS', 6.4550, 3.3841);

-- ------------------------------------------------------------
-- VESSELS
-- ------------------------------------------------------------

INSERT INTO vessels
    (id, vessel_code, name, vessel_type, flag_country, imo_number,
     call_sign, capacity_tons, status, home_port_id, commissioned_date)
VALUES
    (1, 'MD-001', 'Ocean Pioneer', 'Fishing Vessel', 'Nigeria',
     'IMO9000001', '5NPA1', 320.00, 'active', 4, '2018-05-12'),

    (2, 'MD-002', 'Atlantic Star', 'Fishing Vessel', 'Ghana',
     'IMO9000002', '9GAS2', 280.00, 'active', 4, '2019-08-21'),

    (3, 'MD-003', 'Marine Horizon', 'Cargo Vessel', 'Nigeria',
     'IMO9000003', '5NPA3', 450.00, 'active', 4, '2017-03-18'),

    (4, 'MD-004', 'Blue Current', 'Fishing Vessel', 'Kenya',
     'IMO9000004', '5YBC4', 220.00, 'restricted', 3, '2020-11-04'),

    (5, 'MD-005', 'Sea Guardian', 'Supply Vessel', 'Singapore',
     'IMO9000005', '9VSG5', 180.00, 'maintenance', 2, '2016-07-30'),

    (6, 'MD-006', 'Pacific Voyager', 'Research Vessel', 'Netherlands',
     'IMO9000006', 'PVP6', 150.00, 'out_of_service', 1, '2015-02-14');

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------

INSERT INTO users
    (id, full_name, email, password_hash, role, status)
VALUES
    (1, 'Marine Super Administrator', 'admin@marine.io',
     '$2b$10$O6JLzhEztcYuCSzkgPdrr.7TD60K039wz3CYNi2/0ZjKBxkkxC2O6',
     'super_admin', 'active'),

    (2, 'Fleet Manager', 'manager@marine.io',
     '$2b$10$demo.marine.dashboard.manager.password.placeholder',
     'manager', 'active'),

    (3, 'Operations Officer', 'operator@marine.io',
     '$2b$10$demo.marine.dashboard.operator.password.placeholder',
     'operator', 'active');

-- ------------------------------------------------------------
-- CREW
-- ------------------------------------------------------------

INSERT INTO crew_members
    (id, user_id, vessel_id, employee_code, full_name, position,
     phone, certification, status, joined_at)
VALUES
    (1, NULL, 1, 'CR-001', 'David Okoro', 'Captain',
     '+234800000001', 'Master Mariner', 'active', '2021-01-15'),

    (2, NULL, 1, 'CR-002', 'Samuel Ade', 'Chief Engineer',
     '+234800000002', 'Marine Engineering Certificate', 'active', '2021-06-20'),

    (3, NULL, 2, 'CR-003', 'Michael Mensah', 'Captain',
     '+233200000003', 'Master Mariner', 'active', '2020-09-10'),

    (4, NULL, 3, 'CR-004', 'Ibrahim Musa', 'Captain',
     '+234800000004', 'Master Mariner', 'active', '2019-04-08'),

    (5, NULL, 4, 'CR-005', 'Joseph Mwangi', 'Captain',
     '+254700000005', 'Master Mariner', 'active', '2022-02-11'),

    (6, NULL, 5, 'CR-006', 'Daniel Tan', 'Engineer',
     '+65900000006', 'Marine Engineering Certificate', 'on_leave', '2019-11-19');

-- ------------------------------------------------------------
-- VOYAGES
-- ------------------------------------------------------------

INSERT INTO voyages
    (id, vessel_id, voyage_number, departure_port_id,
     destination_port_id, status, departure_at, expected_arrival_at)
VALUES
    (1, 1, 'VOY-2026-001', 4, 3, 'in_progress',
     '2026-09-01 06:00:00', '2026-09-03 18:00:00'),

    (2, 2, 'VOY-2026-002', 4, 3, 'in_progress',
     '2026-09-01 08:30:00', '2026-09-04 12:00:00'),

    (3, 3, 'VOY-2026-003', 4, 2, 'planned',
     '2026-09-03 09:00:00', '2026-09-12 15:00:00');

-- ------------------------------------------------------------
-- VESSEL POSITIONS
-- ------------------------------------------------------------

INSERT INTO vessel_positions
    (vessel_id, latitude, longitude, speed_knots,
     heading_degrees, recorded_at)
VALUES
    (1, 4.8123000, 4.9012000, 12.50, 118.00, '2026-09-01 22:00:00'),
    (2, 3.9045000, 5.2187000, 10.80, 132.00, '2026-09-01 22:00:00'),
    (3, 5.3312000, 3.7214000, 14.20, 95.00, '2026-09-01 22:00:00'),
    (4, -3.2145000, 39.8821000, 7.20, 210.00, '2026-09-01 22:00:00');

-- ------------------------------------------------------------
-- FUEL LOGS
-- ------------------------------------------------------------

INSERT INTO vessel_fuel_logs
    (vessel_id, fuel_type, quantity_liters, recorded_at, notes)
VALUES
    (1, 'Marine Diesel', 1850.00, '2026-09-01 08:00:00', 'Daily fuel consumption'),
    (2, 'Marine Diesel', 1620.00, '2026-09-01 08:15:00', 'Daily fuel consumption'),
    (3, 'Marine Diesel', 2400.00, '2026-09-01 09:00:00', 'Daily fuel consumption'),
    (4, 'Marine Diesel', 980.00, '2026-09-01 09:30:00', 'Restricted operations');

-- ------------------------------------------------------------
-- MAINTENANCE
-- ------------------------------------------------------------

INSERT INTO maintenance_records
    (vessel_id, title, description, maintenance_type,
     status, priority, scheduled_at, cost)
VALUES
    (5, 'Main Engine Inspection',
     'Scheduled inspection of main propulsion system',
     'preventive', 'in_progress', 'high',
     '2026-09-01 08:00:00', 18500.00),

    (4, 'Navigation System Check',
     'Inspection of navigation and communications equipment',
     'inspection', 'scheduled', 'medium',
     '2026-09-02 10:00:00', 6200.00),

    (1, 'Routine Hull Inspection',
     'Scheduled hull and deck inspection',
     'preventive', 'completed', 'low',
     '2026-08-28 09:00:00', 4500.00);

-- ------------------------------------------------------------
-- CATCH RECORDS
-- ------------------------------------------------------------

INSERT INTO catch_records
    (vessel_id, voyage_id, species, quantity_kg,
     recorded_at, location_latitude, location_longitude, notes)
VALUES
    (1, 1, 'Tuna', 4200.00, '2026-09-01 10:00:00',
     4.8123000, 4.9012000, 'Morning catch'),

    (1, 1, 'Mackerel', 3100.00, '2026-09-01 15:00:00',
     4.7211000, 5.1023000, 'Afternoon catch'),

    (2, 2, 'Tuna', 3600.00, '2026-09-01 11:30:00',
     3.9045000, 5.2187000, 'Morning catch'),

    (2, 2, 'Sardine', 2400.00, '2026-09-01 16:20:00',
     3.8112000, 5.4011000, 'Afternoon catch');

-- ------------------------------------------------------------
-- ALERTS
-- ------------------------------------------------------------

INSERT INTO alerts
    (vessel_id, alert_type, severity, title, message, status)
VALUES
    (4, 'navigation', 'warning',
     'Restricted Navigation',
     'Blue Current is operating under restricted navigation status.',
     'open'),

    (5, 'maintenance', 'critical',
     'Maintenance Required',
     'Sea Guardian requires immediate maintenance attention.',
     'open'),

    (1, 'fuel', 'info',
     'Fuel Consumption Logged',
     'Daily fuel consumption record received.',
     'acknowledged');

-- ------------------------------------------------------------
-- DAILY METRICS
-- ------------------------------------------------------------

INSERT INTO daily_metrics
    (metric_date, sales_amount, capture_kg, target_capture_kg,
     active_vessels, fuel_consumed_liters, performance_percent)
VALUES
    ('2026-09-01', 25798000.00, 13300.00, 15000.00,
     3, 6850.00, 88.67);

-- ------------------------------------------------------------
-- AUDIT LOG
-- ------------------------------------------------------------

INSERT INTO audit_logs
    (user_id, action, entity_type, entity_id, details, ip_address)
VALUES
    (1, 'seed_demo_data', 'system', NULL,
     JSON_OBJECT('source', '002_seed_demo_data.sql'),
     '127.0.0.1');
