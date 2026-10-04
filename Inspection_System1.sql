CREATE DATABASE inspection_system;
USE inspection_system;

CREATE TABLE ngos (
    ngo_id INT AUTO_INCREMENT PRIMARY KEY,
    ngo_name VARCHAR(200) NOT NULL
);

CREATE TABLE inspectors (
    inspector_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    assigned_ngo_id INT,
    
    FOREIGN KEY (assigned_ngo_id)
        REFERENCES ngos(ngo_id)
);

CREATE TABLE inspections (
    inspection_id INT AUTO_INCREMENT PRIMARY KEY,

    inspector_id INT NOT NULL,
    ngo_id INT NOT NULL,

    inspection_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    inspection_status ENUM(
        'Scheduled',
        'In Progress',
        'Completed',
        'Cancelled'
    ) NOT NULL,

    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,

    location POINT SRID 4326 NOT NULL,

    inspector_reached_location BOOLEAN DEFAULT FALSE,

    inspection_completed BOOLEAN DEFAULT FALSE,

    evidence_timestamp DATETIME,

    FOREIGN KEY (inspector_id)
        REFERENCES inspectors(inspector_id),

    FOREIGN KEY (ngo_id)
        REFERENCES ngos(ngo_id)
);

CREATE TABLE inspection_evidence (
    evidence_id INT AUTO_INCREMENT PRIMARY KEY,

    inspection_id INT NOT NULL,

    evidence_type ENUM('Photo', 'Video') NOT NULL,

    file_url VARCHAR(500) NOT NULL,

    evidence_timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),

    FOREIGN KEY (inspection_id)
        REFERENCES inspections(inspection_id)
        ON DELETE CASCADE
);

