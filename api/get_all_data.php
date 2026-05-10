<?php
header('Content-Type: application/json');

$db = include __DIR__ . '/../includes/db.php';

try {
    $stmt = $db->query("SELECT * FROM customers");
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmtFields = $db->query("SELECT * FROM fields");
    $fields = $stmtFields->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'customers' => $customers,
        'fields' => $fields
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
