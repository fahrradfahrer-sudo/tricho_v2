<?php
header('Content-Type: application/json');
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
    $stmt = $db->prepare("SELECT id, email, password FROM customers WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user && password_verify($password, $user['password'])) {
        $_SESSION['customer_id'] = $user['id'];
        $_SESSION['customer_email'] = $user['email'];
        echo json_encode(['success' => true, 'message' => 'Login erfolgreich.', 'customer_id' => $user['id']]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ungültige E-Mail oder Passwort.']);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
