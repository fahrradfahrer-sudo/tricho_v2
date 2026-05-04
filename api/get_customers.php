<?php
header('Content-Type: application/json');

$db = include __DIR__ . '/../includes/db.php';

try {
    $stmt = $db->query("SELECT id, name, first_name, company FROM customers ORDER BY created_at DESC");
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'customers' => $customers]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
