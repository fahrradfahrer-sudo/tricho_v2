<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../vendor/autoload.php';
$db = include __DIR__ . '/../includes/db.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

$email = $_POST['email'] ?? '';

if (empty($email)) {
    echo json_encode(['success' => false, 'message' => 'E-Mail ist erforderlich.']);
    exit;
}

try {
    // Check if user exists
    $stmt = $db->prepare("SELECT name FROM customers WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        // Generate token
        $token = bin2hex(random_bytes(32));
        $expires = date('Y-m-d H:i:s', strtotime('+1 hour'));

        // Store token
        $stmt = $db->prepare("DELETE FROM password_reset_tokens WHERE email = ?");
        $stmt->execute([$email]);

        $stmt = $db->prepare("INSERT INTO password_reset_tokens (email, token, expires_at) VALUES (?, ?, ?)");
        $stmt->execute([$email, $token, $expires]);

        // Send email
        $resetLink = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://$_SERVER[HTTP_HOST]/reset_password.php?token=$token";

        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USER;
        $mail->Password   = SMTP_PASS;
        $mail->SMTPSecure = SMTP_SECURE;
        $mail->Port       = SMTP_PORT;
        $mail->CharSet    = 'UTF-8';

        $mail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
        $mail->addAddress($email);

        $mail->isHTML(true);
        $mail->Subject = 'Passwort zurücksetzen - Schlagverwaltung';
        $mail->Body    = "Klicken Sie auf den folgenden Link, um Ihr Passwort zurückzusetzen: <a href=\"$resetLink\">$resetLink</a><br>Dieser Link ist 1 Stunde gültig.";

        $mail->send();
    }

    // Always return success to prevent user enumeration
    echo json_encode(['success' => true, 'message' => 'Wenn diese E-Mail-Adresse registriert ist, wurde ein Link zum Zurücksetzen des Passworts gesendet.']);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
