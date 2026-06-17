class MapManager {
    constructor(mapId) {
        this.map = L.map(mapId).setView([49.5634, 8.2478], 14); // Dirmstein, Germany
        this.drawnItems = new L.FeatureGroup();
        this.map.addLayer(this.drawnItems);

        // Layers
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap-Mitwirkende'
        });

        // Google Hybrid (Satellite + Labels)
        const googleHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',{
            maxZoom: 20,
            subdomains:['mt0','mt1','mt2','mt3'],
            attribution: '© Google'
        });

        // Satellite WMS (Sentinel-2 via EOX)
        const satelliteWMS = L.tileLayer.wms('https://tiles.maps.eox.at/wms?', {
            layers: 's2cloudless-2020_3857',
            format: 'image/jpeg',
            attribution: '© EOX IT Services GmbH'
        });

        // Hybrid WMS (Satellite + Labels)
        const hybridWMS = L.layerGroup([
            L.tileLayer.wms('https://tiles.maps.eox.at/wms?', {
                layers: 's2cloudless-2020_3857',
                format: 'image/jpeg',
                attribution: '© EOX IT Services GmbH'
            }),
            L.tileLayer.wms('https://tiles.maps.eox.at/wms?', {
                layers: 'overlay_base_3857',
                format: 'image/png',
                transparent: true,
                attribution: '© EOX IT Services GmbH'
            })
        ]);

        googleHybrid.addTo(this.map);

        this.labelLayer = new L.LayerGroup();
        this.map.addLayer(this.labelLayer);

        const baseMaps = {
            "Google Satellit": googleHybrid,
            "Satellit WMS (EOX)": satelliteWMS,
            "Satellit mit Beschriftung": hybridWMS,
            "OpenStreetMap": osm
        };

        const overlayMaps = {
            "Eingezeichnete Schläge": this.drawnItems,
            "Beschriftungen": this.labelLayer
        };

        L.control.layers(baseMaps, overlayMaps).addTo(this.map);

        // Localize Leaflet Draw
        L.drawLocal.draw.toolbar.buttons.polygon = 'Einen Schlag zeichnen';
        L.drawLocal.draw.toolbar.buttons.rectangle = 'Ein Rechteck zeichnen';
        L.drawLocal.draw.toolbar.actions.title = 'Zeichnen abbrechen';
        L.drawLocal.draw.toolbar.actions.text = 'Abbrechen';
        L.drawLocal.draw.toolbar.finish.title = 'Zeichnen beenden';
        L.drawLocal.draw.toolbar.finish.text = 'Beenden';
        L.drawLocal.draw.toolbar.undo.title = 'Zuletzt gezeichneten Punkt löschen';
        L.drawLocal.draw.toolbar.undo.text = 'Letzten Punkt löschen';
        L.drawLocal.draw.handlers.polygon.tooltip.start = 'Klicken Sie, um mit dem Zeichnen zu beginnen.';
        L.drawLocal.draw.handlers.polygon.tooltip.cont = 'Klicken Sie, um das Zeichnen fortzusetzen.';
        L.drawLocal.draw.handlers.polygon.tooltip.end = 'Klicken Sie auf den ersten Punkt, um die Fläche zu schließen.';
        L.drawLocal.draw.handlers.rectangle.tooltip.start = 'Klicken und ziehen Sie, um ein Rechteck zu zeichnen.';
        L.drawLocal.draw.handlers.simpleshape.tooltip.end = 'Lassen Sie die Maustaste los, um das Zeichnen zu beenden.';

        L.drawLocal.edit.toolbar.actions.save.title = 'Änderungen speichern';
        L.drawLocal.edit.toolbar.actions.save.text = 'Speichern';
        L.drawLocal.edit.toolbar.actions.cancel.title = 'Bearbeitung abbrechen, alle Änderungen verwerfen';
        L.drawLocal.edit.toolbar.actions.cancel.text = 'Abbrechen';
        L.drawLocal.edit.toolbar.buttons.edit = 'Schläge bearbeiten';
        L.drawLocal.edit.toolbar.buttons.editDisabled = 'Keine Schläge zum Bearbeiten vorhanden';
        L.drawLocal.edit.toolbar.buttons.remove = 'Schläge löschen';
        L.drawLocal.edit.toolbar.buttons.removeDisabled = 'Keine Schläge zum Löschen vorhanden';
        L.drawLocal.edit.handlers.edit.tooltip.text = 'Griffe ziehen oder Markierungen verschieben, um Funktionen zu ändern.';
        L.drawLocal.edit.handlers.edit.tooltip.subtext = 'Klicken Sie auf Abbrechen, um die Änderungen rückgängig zu machen.';
        L.drawLocal.edit.handlers.remove.tooltip.text = 'Klicken Sie auf eine Funktion, um sie zu entfernen.';

        // Fix for mobile "shape edges cannot cross" error
        if (L.Browser.touch) {
            if (L.Draw && L.Draw.Polyline && L.Draw.Polyline.prototype.options) {
                L.Draw.Polyline.prototype.options.touchExtend = false;
            }
            if (L.Draw && L.Draw.Polygon && L.Draw.Polygon.prototype.options) {
                L.Draw.Polygon.prototype.options.touchExtend = false;
            }

            // Also override the Edit.Poly to be safe
            if (L.Edit && L.Edit.Poly && L.Edit.Poly.prototype.options) {
                L.Edit.Poly.prototype.options.touchExtend = false;
            }
        }

        // Leaflet Draw Control
        const drawControl = new L.Control.Draw({
            edit: {
                featureGroup: this.drawnItems
            },
            draw: {
                polygon: {
                    allowIntersection: false,
                    showArea: true,
                    touchExtend: false,
                    guidelineDistance: 20 // Help avoiding accidental self-intersections on touch
                },
                polyline: false,
                circle: false,
                marker: false,
                circlemarker: false,
                rectangle: {
                    touchExtend: false
                }
            }
        });
        this.map.addControl(drawControl);

        // Geocoder instance for programmatic use
        this.geocoder = L.Control.Geocoder.nominatim({
            geocodingQueryParams: { addressdetails: 1 }
        });

        // Geocoder Control
        L.Control.geocoder({
            geocoder: this.geocoder,
            defaultMarkGeocode: false,
            placeholder: 'Suche nach Ort...',
            errorMessage: 'Nichts gefunden.'
        })
        .on('markgeocode', (e) => {
            const bbox = e.geocode.bbox;
            this.map.fitBounds(bbox, { maxZoom: 16 });
        })
        .addTo(this.map);

        // Event listeners for drawing
        this.map.on(L.Draw.Event.CREATED, (e) => {
            const layer = e.layer;
            this.drawnItems.addLayer(layer);
            this.onFieldAdded(layer);
        });

        this.map.on(L.Draw.Event.EDITED, (e) => {
            const layers = e.layers;
            layers.eachLayer((layer) => {
                this.onFieldEdited(layer);
            });
        });

        this.map.on(L.Draw.Event.DELETED, (e) => {
            const layers = e.layers;
            layers.eachLayer((layer) => {
                this.onFieldDeleted(layer);
            });
        });
    }

    // Callbacks to be overridden in app.js
    onFieldAdded(layer) {}
    onFieldEdited(layer) {}
    onFieldDeleted(layer) {}

    addFieldToMap(geoJson, name, fitBounds = true) {
        const layer = L.geoJSON(geoJson, {
            style: { color: '#3388ff', weight: 3, opacity: 0.5 }
        });
        layer.eachLayer((l) => {
            this.drawnItems.addLayer(l);
            this.onFieldAdded(l, name);
        });
        if (fitBounds && this.drawnItems.getLayers().length > 0) {
            this.map.fitBounds(this.drawnItems.getBounds());
        }
    }

    clearFields() {
        this.drawnItems.clearLayers();
    }

    async geocodePostalCode(postalCode) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(postalCode + ", Germany")}&limit=1`;
        try {
            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' }
            });
            const data = await response.json();
            return data && data.length > 0 ? data[0] : null;
        } catch (err) {
            console.error("Geocoding fetch error:", err);
            return null;
        }
    }

    async centerMapByPostalCode(postalCode) {
        if (!postalCode) {
            this.map.setView([49.5634, 8.2478], 14); // Dirmstein
            return;
        }

        const result = await this.geocodePostalCode(postalCode);
        if (result) {
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);

            if (result.boundingbox) {
                const bbox = result.boundingbox;
                // Nominatim returns [lat_min, lat_max, lon_min, lon_max]
                this.map.fitBounds([
                    [parseFloat(bbox[0]), parseFloat(bbox[2])],
                    [parseFloat(bbox[1]), parseFloat(bbox[3])]
                ], { maxZoom: 16 });
            } else {
                this.map.setView([lat, lon], 16);
            }
        } else {
            console.warn("PLZ nicht gefunden: " + postalCode);
            this.map.setView([49.5634, 8.2478], 14);
        }
    }
}
