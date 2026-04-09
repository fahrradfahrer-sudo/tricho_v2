<?php
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['locations']) || !isset($input['dataset'])) {
    http_response_code(400);
    echo json_encode(['status' => 'INVALID_REQUEST', 'error' => 'Missing parameters.']);
    exit;
}

$dataset = $input['dataset'];
$locations = $input['locations']; // Expected to be an array of objects {latitude, longitude}

// Format locations for OpenTopoData (comma separated lat,lng and piped between points)
$formattedLocations = array_map(function($loc) {
    return $loc['latitude'] . ',' . $loc['longitude'];
}, $locations);

$locationsString = implode('|', $formattedLocations);
$url = "https://api.opentopodata.org/v1/{$dataset}?locations=" . urlencode($locationsString);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false) {
    http_response_code(500);
    echo json_encode(['status' => 'ERROR', 'error' => 'Failed to reach terrain API.']);
    exit;
}

http_response_code($httpCode);
echo $response;
