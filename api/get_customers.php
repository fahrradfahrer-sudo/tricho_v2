<?php
header('Content-Type: application/json');
session_start();

$db = include __DIR__ . '/../includes/db.php';

// Only allow admin (specific email) to get all customers
if (!isset($_SESSION['customer_id']) || $_SESSION['customer_email'] !== 'mwitt3d@gmail.com') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized.']);
    exit;
}

try {
    $stmt = $db->query("SELECT id, name, first_name, company FROM customers ORDER BY name ASC, first_name ASC");
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'customers' => $customers]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
