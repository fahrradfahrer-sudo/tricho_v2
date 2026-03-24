# Project: Customer Field Management Application

## Overview
This application allows customers to:
1. Provide personal data (Name, Email, Phone).
2. Draw or import (SHP/KML) fields on a map.
3. Manage fields (Add, Rename, Delete).
4. View fields on a Google Satellite basemap.

## Local Development
- Requirement: PHP 7.4+ with SQLite extension.
- Run: `php -S localhost:8000`
- Access: `http://localhost:8000`

## Structure
- `/public`: Frontend assets (index.html, css/style.css, js/app.js, js/map.js).
- `/api`: PHP endpoints for data submission and file uploads.
- `/includes`: Database connection and schema.
- `/data`: SQLite database (`app.sqlite`) and uploads.

## WordPress Integration
To integrate this application into WordPress:
1. **Shortcode/Template**: Create a custom WordPress page template or a shortcode.
2. **Assets**: Enqueue the Leaflet and custom JS/CSS files using `wp_enqueue_script` and `wp_enqueue_style`.
3. **API Endpoints**: You can either:
   - Use the existing `/api` directory by placing it in the WordPress root.
   - Or, rewrite the API logic into the WordPress `functions.php` using the REST API (`register_rest_route`).
4. **Data**: The current SQLite database is standalone. For better WordPress integration, consider moving the `customers` and `fields` tables into the WordPress MySQL database using `$wpdb`.

## Dependencies (CDN used)
- Leaflet
- Leaflet.draw
- shpjs (for SHP import)
- leaflet-omnivore (for KML import)
