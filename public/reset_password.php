<?php
$db = include __DIR__ . '/includes/db.php';
$token = $_GET['token'] ?? '';
$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = $_POST['token'] ?? '';
    $password = $_POST['password'] ?? '';
    $passwordConfirm = $_POST['password_confirm'] ?? '';

    if (empty($password) || $password !== $passwordConfirm) {
        $error = 'Passwörter stimmen nicht überein.';
    } else {
        try {
            $stmt = $db->prepare("SELECT email FROM password_reset_tokens WHERE token = ? AND expires_at > DATETIME('now')");
            $stmt->execute([$token]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row) {
                $email = $row['email'];
                $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

                $stmt = $db->prepare("UPDATE customers SET password = ? WHERE email = ?");
                $stmt->execute([$hashedPassword, $email]);

                $stmt = $db->prepare("DELETE FROM password_reset_tokens WHERE email = ?");
                $stmt->execute([$email]);

                $success = 'Passwort erfolgreich zurückgesetzt. Sie können sich jetzt anmelden.';
            } else {
                $error = 'Ungültiger oder abgelaufener Token.';
            }
        } catch (Exception $e) {
            $error = $e->getMessage();
        }
    }
}

$isValidToken = false;
if ($token) {
    $stmt = $db->prepare("SELECT email FROM password_reset_tokens WHERE token = ? AND expires_at > DATETIME('now')");
    $stmt->execute([$token]);
    if ($stmt->fetch()) {
        $isValidToken = true;
    }
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Passwort zurücksetzen</title>
    <link rel="stylesheet" href="css/style.css">
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f2f5; }
        .reset-container { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
        h2 { margin-top: 0; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; }
        input { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        .btn { width: 100%; padding: 0.75rem; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .btn-success { background: #28a745; color: white; }
        .error { color: #dc3545; margin-bottom: 1rem; }
        .success { color: #28a745; margin-bottom: 1rem; }
    </style>
</head>
<body>
    <div class="reset-container">
        <h2>Passwort zurücksetzen</h2>
        <?php if ($error): ?><div class="error"><?php echo htmlspecialchars($error); ?></div><?php endif; ?>
        <?php if ($success): ?>
            <div class="success"><?php echo htmlspecialchars($success); ?></div>
            <a href="index.html">Zum Login</a>
        <?php elseif ($isValidToken): ?>
            <form method="POST">
                <input type="hidden" name="token" value="<?php echo htmlspecialchars($token); ?>">
                <div class="form-group">
                    <label>Neues Passwort:</label>
                    <input type="password" name="password" required>
                </div>
                <div class="form-group">
                    <label>Passwort wiederholen:</label>
                    <input type="password" name="password_confirm" required>
                </div>
                <button type="submit" class="btn btn-success">Passwort speichern</button>
            </form>
        <?php else: ?>
            <div class="error">Ungültiger oder abgelaufener Link zum Zurücksetzen des Passworts.</div>
            <a href="index.html">Zurück zum Login</a>
        <?php endif; ?>
    </div>
</body>
</html>
