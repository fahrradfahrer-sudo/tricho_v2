<?php
header('Content-Type: application/json');
include_once __DIR__ . '/../includes/config.php';
session_start();

if (isset($_SESSION['customer_id'])) {
    echo json_encode(['success' => true, 'customerId' => $_SESSION['customer_id']]);
} else {
    echo json_encode(['success' => false]);
}
