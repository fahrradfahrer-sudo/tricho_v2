<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

$db = include __DIR__ . '/../includes/db.php';

$fieldId = $_POST['field_id'] ?? null;
$column = $_POST['column'] ?? ''; // 'is_checked' or 'is_done'
$value = isset($_POST['value']) ? intval($_POST['value']) : 0;

if (!$fieldId || !in_array($column, ['is_checked', 'is_done'])) {
    echo json_encode(['success' => false, 'message' => 'Ungültige Parameter.']);
    exit;
}

try {
    $stmt = $db->prepare("UPDATE fields SET $column = ? WHERE id = ?");
    $stmt->execute([$value, $fieldId]);
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
