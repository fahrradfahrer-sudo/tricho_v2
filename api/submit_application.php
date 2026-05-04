<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

$db = include __DIR__ . '/../includes/db.php';

try {
    $db->beginTransaction();

    $customerId = $_POST['customer_id'] ?? null;

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

        // Delete old fields to replace them with new ones
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

    // Insert Fields
    if (isset($_POST['fields']) && is_array($_POST['fields'])) {
        $stmtField = $db->prepare("INSERT INTO fields (
            customer_id, name, geometry, area,
            fp_path_distance, fp_border_distance, fp_min_dist, fp_orientation,
            fp_speed, fp_height, fp_mode, fp_clip_corners,
            fp_terrain_following, fp_show_wp_height, fp_height_mode,
            fp_drone_info, fp_finish_action, fp_rc_lost_action,
            fp_execute_rc_lost_action, fp_fly_to_wayline_mode,
            fp_takeoff_security_height, fp_waypoint_turn_mode, fp_waypoint_heading_mode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

        foreach ($_POST['fields'] as $field) {
            $stmtField->execute([
                $customerId,
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
                $field['fp_waypoint_heading_mode'] ?? null
            ]);
        }
    }

    $db->commit();
    echo json_encode(['success' => true, 'customerId' => $customerId]);

} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
