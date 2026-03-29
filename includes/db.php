<?php
$dbPath = __DIR__ . '/../data/app.sqlite';

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
        phone TEXT,
        comments TEXT,
        dsgvo_accepted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // Create fields table
    $db->exec("CREATE TABLE IF NOT EXISTS fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        name TEXT,
        geometry TEXT, -- JSON string of GeoJSON
        area REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )");

} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}

return $db;
