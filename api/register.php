<?php
header('Content-Type: application/json');
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

$db = include __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$email = $_POST['email'] ?? '';
$password = $_POST['password'] ?? '';
$passwordConfirm = $_POST['password_confirm'] ?? '';
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

if ($password !== $passwordConfirm) {
    echo json_encode(['success' => false, 'message' => 'Passwörter stimmen nicht überein.']);
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

    // Send registration confirmation email
    $subject = "Willkommen bei der Schlagverwaltung - Ihre Registrierung";
    $message = "Hallo $firstName $name,\n\n";
    $message .= "Vielen Dank für Ihre Registrierung bei der Schlagverwaltung.\n\n";
    $message .= "Ihre Zugangsdaten:\n";
    $message .= "E-Mail: $email\n\n";
    $message .= "Mit freundlichen Grüßen,\nIhr Team";

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USER;
        $mail->Password   = SMTP_PASS;
        $mail->SMTPSecure = SMTP_SECURE;
        $mail->Port       = SMTP_PORT;
        $mail->CharSet    = 'UTF-8';

        $mail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
        $mail->addAddress($email, "$firstName $name");
        $mail->addAddress('feldanmeldung@gmail.com', 'Admin-Kopie');

        $mail->isHTML(false);
        $mail->Subject = $subject;
        $mail->Body    = $message;

        $mail->send();
    } catch (Exception $e) {
        error_log("Registration email could not be sent. Mailer Error: {$mail->ErrorInfo}");
    }

    echo json_encode(['success' => true, 'message' => 'Registrierung erfolgreich.', 'customer_id' => $userId]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
