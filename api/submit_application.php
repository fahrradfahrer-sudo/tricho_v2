<?php
header('Content-Type: application/json');
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

$db = include __DIR__ . '/../includes/db.php';

try {
    // Honeypot check
    if (!empty($_POST['website'])) {
        echo json_encode(['success' => false, 'message' => 'Spam detected.']);
        exit;
    }

    $db->beginTransaction();

    $isMultiCustomer = isset($_POST['is_multi_customer']) && $_POST['is_multi_customer'] == '1';
    $customerId = $_POST['customer_id'] ?? null;

    // Security check: Only allow updates if logged in as the customer or admin
    if ($customerId) {
        $isAdmin = (isset($_SESSION['customer_email']) && $_SESSION['customer_email'] === 'mwitt3d@gmail.com');
        $isOwnAccount = (isset($_SESSION['customer_id']) && $_SESSION['customer_id'] == $customerId);

        if (!$isAdmin && !$isOwnAccount) {
            echo json_encode(['success' => false, 'message' => 'Unauthorized to update this customer.']);
            exit;
        }
    }

    if (!$isMultiCustomer) {
        if ($customerId) {
            // Update existing customer
            $stmt = $db->prepare("UPDATE customers SET first_name=?, name=?, company=?, street=?, house_number=?, postal_code=?, city=?, email=?, phone=?, comments=?, dsgvo_accepted=? WHERE id=?");
            $stmt->execute([
                $_POST['customer_first_name'] ?? '',
                $_POST['customer_name'] ?? '',
                $_POST['customer_company'] ?? '',
                $_POST['customer_street'] ?? '',
                $_POST['customer_house_number'] ?? '',
                $_POST['customer_postal_code'] ?? '',
                $_POST['customer_city'] ?? '',
                $_POST['customer_email'] ?? '',
                $_POST['customer_phone'] ?? '',
                $_POST['customer_comments'] ?? '',
                $_POST['customer_dsgvo_accepted'] ?? 0,
                $customerId
            ]);

            // Delete old fields for this customer to replace them
            $stmtDeleteFields = $db->prepare("DELETE FROM fields WHERE customer_id = ?");
            $stmtDeleteFields->execute([$customerId]);
        } else {
        // Insert new customer
        $stmt = $db->prepare("INSERT INTO customers (first_name, name, company, street, house_number, postal_code, city, email, phone, comments, dsgvo_accepted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $_POST['customer_first_name'] ?? '',
            $_POST['customer_name'] ?? '',
            $_POST['customer_company'] ?? '',
            $_POST['customer_street'] ?? '',
            $_POST['customer_house_number'] ?? '',
            $_POST['customer_postal_code'] ?? '',
            $_POST['customer_city'] ?? '',
            $_POST['customer_email'] ?? '',
            $_POST['customer_phone'] ?? '',
            $_POST['customer_comments'] ?? '',
            $_POST['customer_dsgvo_accepted'] ?? 0
        ]);
            $customerId = $db->lastInsertId();
        }
    }

    // Insert Fields
    if (isset($_POST['fields']) && is_array($_POST['fields'])) {
        if ($isMultiCustomer) {
            // Collect all involved customer IDs and delete their fields first
            $involvedCustomerIds = [];
            foreach ($_POST['fields'] as $field) {
                if (isset($field['customer_id'])) $involvedCustomerIds[$field['customer_id']] = true;
            }
            if (!empty($involvedCustomerIds)) {
                $ids = implode(',', array_map('intval', array_keys($involvedCustomerIds)));
                $db->exec("DELETE FROM fields WHERE customer_id IN ($ids)");
            }
        }

        $stmtField = $db->prepare("INSERT INTO fields (
            customer_id, name, geometry, area,
            fp_path_distance, fp_border_distance, fp_min_dist, fp_orientation,
            fp_speed, fp_height, fp_mode, fp_clip_corners,
            fp_terrain_following, fp_show_wp_height, fp_height_mode,
            fp_drone_info, fp_finish_action, fp_rc_lost_action,
            fp_execute_rc_lost_action, fp_fly_to_wayline_mode,
            fp_takeoff_security_height, fp_waypoint_turn_mode, fp_waypoint_heading_mode, flight_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

        foreach ($_POST['fields'] as $field) {
            $fCustomerId = $isMultiCustomer ? ($field['customer_id'] ?? null) : $customerId;
            if (!$fCustomerId) continue;

            $stmtField->execute([
                $fCustomerId,
                $field['name'] ?? 'Untitled Field',
                $field['geometry'] ?? '{}',
                $field['area'] ?? 0.0,
                $field['fp_path_distance'] ?? null,
                $field['fp_border_distance'] ?? null,
                $field['fp_min_dist'] ?? null,
                $field['fp_orientation'] ?? null,
                $field['fp_speed'] ?? null,
                $field['fp_height'] ?? null,
                $field['fp_mode'] ?? null,
                isset($field['fp_clip_corners']) ? ($field['fp_clip_corners'] === 'true' || $field['fp_clip_corners'] == 1 ? 1 : 0) : null,
                isset($field['fp_terrain_following']) ? ($field['fp_terrain_following'] === 'true' || $field['fp_terrain_following'] == 1 ? 1 : 0) : null,
                isset($field['fp_show_wp_height']) ? ($field['fp_show_wp_height'] === 'true' || $field['fp_show_wp_height'] == 1 ? 1 : 0) : null,
                $field['fp_height_mode'] ?? null,
                $field['fp_drone_info'] ?? null,
                $field['fp_finish_action'] ?? null,
                $field['fp_rc_lost_action'] ?? null,
                $field['fp_execute_rc_lost_action'] ?? null,
                $field['fp_fly_to_wayline_mode'] ?? null,
                $field['fp_takeoff_security_height'] ?? null,
                $field['fp_waypoint_turn_mode'] ?? null,
                $field['fp_waypoint_heading_mode'] ?? null,
                $field['flight_path'] ?? null
            ]);
        }
    }

    $db->commit();

    // Send Email Notification
    sendEmailNotification($_POST);

    echo json_encode(['success' => true, 'customerId' => $customerId]);

} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

/**
 * Sends an email notification to the customer.
 * Note: For real SMTP, it is recommended to use a library like PHPMailer.
 * This implementation uses the PHP mail() function as a starting point.
 */
function sendEmailNotification($data) {
    $to = $data['customer_email'];
    if (empty($to)) return;

    $subject = "Ihr Kundenantrag - Schlagverwaltung";

    $firstName = $data['customer_first_name'] ?? '';
    $lastName = $data['customer_name'] ?? '';
    $company = $data['customer_company'] ?? '';
    $email = $data['customer_email'] ?? '';
    $phone = $data['customer_phone'] ?? '';
    $street = $data['customer_street'] ?? '';
    $houseNumber = $data['customer_house_number'] ?? '';
    $postalCode = $data['customer_postal_code'] ?? '';
    $city = $data['customer_city'] ?? '';
    $comments = $data['customer_comments'] ?? '';

    $message = "Hallo $firstName $lastName,\n\n";
    $message .= "Vielen Dank für Ihren Antrag. Hier ist eine Zusammenfassung Ihrer Daten:\n\n";
    $message .= "--- Persönliche Daten ---\n";
    $message .= "Name: $firstName $lastName\n";
    if (!empty($company)) $message .= "Firma: $company\n";
    $message .= "Straße: $street $houseNumber\n";
    $message .= "Ort: $postalCode $city\n";
    $message .= "E-Mail: $email\n";
    $message .= "Telefon: $phone\n";
    if (!empty($comments)) $message .= "Anmerkungen: $comments\n";
    $message .= "\n";

    $totalArea = 0;
    if (isset($data['fields']) && is_array($data['fields'])) {
        $message .= "--- Schläge ---\n";
        foreach ($data['fields'] as $field) {
            $name = $field['name'] ?? 'Unbenannt';
            $area = floatval($field['area'] ?? 0);
            $message .= "- $name: " . number_format($area, 2, ',', '.') . " Ha\n";
            $totalArea += $area;
        }
        $message .= "\nGesamtfläche: " . number_format($totalArea, 2, ',', '.') . " Ha\n";
    }

    $message .= "\nMit freundlichen Grüßen,\nIhr Team";

    $headers = "From: no-reply@witt3d.de\r\n";
    $headers .= "Reply-To: no-reply@witt3d.de\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();

    // Use mail() - for SMTP configuration, set SMTP and smtp_port in php.ini
    // or use a library like PHPMailer for more robust SMTP support.
    @mail($to, $subject, $message, $headers);
}
