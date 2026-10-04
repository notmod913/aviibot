use inspection_system;
INSERT INTO ngos (ngo_name)
VALUES ('Green Earth Foundation');

INSERT INTO inspectors (name, assigned_ngo_id)
VALUES ('Rahul Sharma', 1);

INSERT INTO inspections (
    inspector_id,
    ngo_id,
    inspection_status,
    latitude,
    longitude,
    inspector_reached_location,
    inspection_completed,
    evidence_timestamp
)
VALUES (
    1,
    1,
    'Completed',
    30.70464900,
    76.71787300,
    TRUE,
    TRUE,
    NOW()
);

INSERT INTO inspection_evidence (
    inspection_id,
    evidence_type,
    file_url,
    evidence_timestamp,
    latitude,
    longitude
)
VALUES (
    1,
    'Photo',
    'uploads/inspection1/photo1.jpg',
    NOW(),
    30.70464900,
    76.71787300
);