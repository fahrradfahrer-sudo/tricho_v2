<?php
try {
    $dbPath = __DIR__ . '/data/app.sqlite';
    $db = new PDO("sqlite:$dbPath");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $pass = password_hash('test', PASSWORD_DEFAULT);
    $stmt = $db->prepare("UPDATE customers SET password = ? WHERE email = ?");
    $stmt->execute([$pass, 'test@example.com']);
    echo "Password for test@example.com set successfully\n";

    $passAdmin = password_hash('password', PASSWORD_DEFAULT);
    $stmt->execute([$passAdmin, 'mwitt3d@gmail.com']);
    echo "Password for mwitt3d@gmail.com set successfully\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
