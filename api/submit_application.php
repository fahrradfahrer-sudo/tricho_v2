<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

$db = include __DIR__ . '/../includes/db.php';

try {
    $db->beginTransaction();

    // 1. Insert Customer Data
    $stmt = $db->prepare("INSERT INTO customers (first_name, name, company, street, house_number, postal_code, city, email, phone, comments, dsgvo_accepted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $_POST['customer_first_name'] ?? '',
        $_POST['customer_name'] ?? '',
        $_POST['customer_company'] ?? '',
        $_POST['customer_street'] ?? '',
        $_POST['customer_house_number'] ?? '',
        $_POST['customer_postal_code'] ?? '',
        $_POST['customer_city'] ?? '',
        $_POST['customer_email'] ?? '',
        $_POST['customer_phone'] ?? '',
        $_POST['customer_comments'] ?? '',
        $_POST['customer_dsgvo_accepted'] ?? 0
    ]);
    $customerId = $db->lastInsertId();

    // 2. Insert Fields (if provided)
    if (isset($_POST['fields']) && is_array($_POST['fields'])) {
        $stmtField = $db->prepare("INSERT INTO fields (customer_id, name, geometry, area) VALUES (?, ?, ?, ?)");
        foreach ($_POST['fields'] as $field) {
            $stmtField->execute([
                $customerId,
                $field['name'] ?? 'Untitled Field',
                $field['geometry'] ?? '{}',
                $field['area'] ?? 0.0
            ]);
        }
    }

    $db->commit();
    echo json_encode(['success' => true, 'customerId' => $customerId]);

} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
