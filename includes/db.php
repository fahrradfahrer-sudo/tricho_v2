<?php
$dbDir = __DIR__ . '/../data';
$dbPath = $dbDir . '/app.sqlite';

if (!is_dir($dbDir)) {
    mkdir($dbDir, 0777, true);
}

try {
    $db = new PDO("sqlite:$dbPath");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Create customers table
    $db->exec("CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT,
        name TEXT NOT NULL,
        company TEXT,
        street TEXT,
        house_number TEXT,
        postal_code TEXT,
        city TEXT,
        email TEXT NOT NULL,
        password TEXT,
        phone TEXT,
        comments TEXT,
        dsgvo_accepted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // Migration: Add password column to customers if it doesn't exist
    try {
        $db->exec("ALTER TABLE customers ADD COLUMN password TEXT");
    } catch (PDOException $e) {
        // Column might already exist
    }

    // Create fields table
    $db->exec("CREATE TABLE IF NOT EXISTS fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        name TEXT,
        geometry TEXT, -- JSON string of GeoJSON
        area REAL,
        fp_path_distance REAL,
        fp_border_distance REAL,
        fp_min_dist REAL,
        fp_orientation REAL,
        fp_speed REAL,
        fp_height REAL,
        fp_mode TEXT,
        fp_clip_corners INTEGER,
        fp_terrain_following INTEGER,
        fp_show_wp_height INTEGER,
        fp_height_mode TEXT,
        fp_drone_info TEXT,
        fp_finish_action TEXT,
        fp_rc_lost_action TEXT,
        fp_execute_rc_lost_action TEXT,
        fp_fly_to_wayline_mode TEXT,
        fp_takeoff_security_height REAL,
        fp_height_offset REAL,
        fp_damping_distance REAL,
        fp_waypoint_turn_mode TEXT,
        fp_waypoint_heading_mode TEXT,
        flight_path TEXT, -- JSON string of waypoints
        is_checked INTEGER DEFAULT 0,
        is_done INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )");

    // Migration: Add columns if they don't exist
    $columns = [
        'fp_path_distance' => 'REAL',
        'fp_border_distance' => 'REAL',
        'fp_min_dist' => 'REAL',
        'fp_orientation' => 'REAL',
        'fp_speed' => 'REAL',
        'fp_height' => 'REAL',
        'fp_mode' => 'TEXT',
        'fp_clip_corners' => 'INTEGER',
        'fp_terrain_following' => 'INTEGER',
        'fp_show_wp_height' => 'INTEGER',
        'fp_height_mode' => 'TEXT',
        'fp_drone_info' => 'TEXT',
        'fp_payload_info' => 'TEXT',
        'fp_finish_action' => 'TEXT',
        'fp_rc_lost_action' => 'TEXT',
        'fp_execute_rc_lost_action' => 'TEXT',
        'fp_fly_to_wayline_mode' => 'TEXT',
        'fp_takeoff_security_height' => 'REAL',
        'fp_height_offset' => 'REAL',
        'fp_damping_distance' => 'REAL',
        'fp_waypoint_turn_mode' => 'TEXT',
        'fp_waypoint_heading_mode' => 'TEXT',
        'flight_path' => 'TEXT',
        'is_checked' => 'INTEGER DEFAULT 0',
        'is_done' => 'INTEGER DEFAULT 0'
    ];

    foreach ($columns as $col => $type) {
        try {
            $db->exec("ALTER TABLE fields ADD COLUMN $col $type");
        } catch (PDOException $e) {
            // Column might already exist
        }
    }

    // Create password_reset_tokens table
    $db->exec("CREATE TABLE IF NOT EXISTS password_reset_tokens (
        email TEXT NOT NULL,
        token TEXT NOT NULL,
        expires_at DATETIME NOT NULL
    )");

} catch (PDOException $e) {
    if (php_sapi_name() !== 'cli') {
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => "Database connection failed: " . $e->getMessage()]);
        exit;
    } else {
        throw $e;
    }
}

return $db;
