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
$firstName = $_POST['first_name'] ?? '';
$name = $_POST['name'] ?? '';
$company = $_POST['company'] ?? '';
$street = $_POST['street'] ?? '';
$houseNumber = $_POST['house_number'] ?? '';
$postalCode = $_POST['postal_code'] ?? '';
$city = $_POST['city'] ?? '';
$phone = $_POST['phone'] ?? '';
$comments = $_POST['comments'] ?? '';
$dsgvo = isset($_POST['dsgvo']) ? 1 : 0;

if (empty($email) || empty($password) || empty($name)) {
    echo json_encode(['success' => false, 'message' => 'Bitte füllen Sie alle erforderlichen Felder aus (E-Mail, Passwort, Nachname).']);
    exit;
}

try {
    // Check if user already exists
    $stmt = $db->prepare("SELECT id FROM customers WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Diese E-Mail-Adresse ist bereits registriert.']);
        exit;
    }

    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $db->prepare("INSERT INTO customers (first_name, name, company, street, house_number, postal_code, city, email, password, phone, comments, dsgvo_accepted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $firstName,
        $name,
        $company,
        $street,
        $houseNumber,
        $postalCode,
        $city,
        $email,
        $hashedPassword,
        $phone,
        $comments,
        $dsgvo
    ]);

    $userId = $db->lastInsertId();
    $_SESSION['customer_id'] = $userId;
    $_SESSION['customer_email'] = $email;

    echo json_encode(['success' => true, 'message' => 'Registrierung erfolgreich.', 'customer_id' => $userId]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
