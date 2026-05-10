<?php
// SMTP Configuration
define('SMTP_HOST', 'smtp.example.com');
define('SMTP_PORT', 587);
define('SMTP_USER', 'user@example.com');
define('SMTP_PASS', 'password');
define('SMTP_FROM', 'no-reply@witt3d.de');
define('SMTP_FROM_NAME', 'Schlagverwaltung');

// Session Configuration (German data safety compliance)
// Ensure sessions are only accessible via HTTP and use secure cookies if possible
ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_samesite', 'Lax');
// In a real environment with HTTPS, you should also set:
// ini_set('session.cookie_secure', 1);
