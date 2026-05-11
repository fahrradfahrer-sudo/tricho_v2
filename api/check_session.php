<?php
header('Content-Type: application/json');
session_start();

if (isset($_SESSION['customer_id'])) {
    $db = include __DIR__ . '/../includes/db.php';
    $stmt = $db->prepare("SELECT * FROM customers WHERE id = ?");
    $stmt->execute([$_SESSION['customer_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        unset($user['password']); // Don't send the password back
        echo json_encode(['logged_in' => true, 'customer' => $user]);
    } else {
        echo json_encode(['logged_in' => false]);
    }
} else {
    echo json_encode(['logged_in' => false]);
}
