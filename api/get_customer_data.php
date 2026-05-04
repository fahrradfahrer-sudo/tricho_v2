<?php
header('Content-Type: application/json');

if (!isset($_GET['id'])) {
    echo json_encode(['success' => false, 'message' => 'Missing customer ID.']);
    exit;
}

$db = include __DIR__ . '/../includes/db.php';

try {
    $stmt = $db->prepare("SELECT * FROM customers WHERE id = ?");
    $stmt->execute([$_GET['id']]);
    $customer = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$customer) {
        echo json_encode(['success' => false, 'message' => 'Customer not found.']);
        exit;
    }

    $stmtFields = $db->prepare("SELECT * FROM fields WHERE customer_id = ?");
    $stmtFields->execute([$_GET['id']]);
    $fields = $stmtFields->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'customer' => $customer,
        'fields' => $fields
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
