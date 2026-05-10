<?php
header('Content-Type: application/json');
include_once __DIR__ . '/../includes/config.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

$db = include __DIR__ . '/../includes/db.php';

$email = $_POST['email'] ?? '';
$password = $_POST['password'] ?? '';

if (empty($email) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'E-Mail und Passwort sind erforderlich.']);
    exit;
}

try {
    $stmt = $db->prepare("SELECT * FROM customers WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user && $user['password'] && password_verify($password, $user['password'])) {
        // Secure session regeneration
        session_regenerate_id(true);
        $_SESSION['customer_id'] = $user['id'];

        echo json_encode(['success' => true, 'customerId' => $user['id']]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ungültige E-Mail oder Passwort.']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
