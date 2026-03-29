class MapManager {
    constructor(mapId) {
        this.map = L.map(mapId).setView([49.5634, 8.2478], 14); // Dirmstein, Germany
        this.drawnItems = new L.FeatureGroup();
        this.map.addLayer(this.drawnItems);

        // Layers
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap-Mitwirkende'
        });

        // Google Satellite (XYZ Tiles)
        const googleSat = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{
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

        googleSat.addTo(this.map);

        const baseMaps = {
            "Google Satellit": googleSat,
            "Satellit WMS (EOX)": satelliteWMS,
            "OpenStreetMap": osm
        };

        const overlayMaps = {
            "Eingezeichnete Schläge": this.drawnItems
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

        // Leaflet Draw Control
        const drawControl = new L.Control.Draw({
            edit: {
                featureGroup: this.drawnItems
            },
            draw: {
                polygon: {
                    allowIntersection: false,
                    showArea: true
                },
                polyline: false,
                circle: false,
                marker: false,
                circlemarker: false,
                rectangle: true
            }
        });
        this.map.addControl(drawControl);

        // Geocoder Control
        L.Control.geocoder({
            defaultMarkGeocode: false,
            placeholder: 'Suche nach Ort...',
            errorMessage: 'Nichts gefunden.'
        })
        .on('markgeocode', (e) => {
            const bbox = e.geocode.bbox;
            const poly = L.polygon([
                bbox.getSouthEast(),
                bbox.getNorthEast(),
                bbox.getNorthWest(),
                bbox.getSouthWest()
            ]);
            this.map.fitBounds(poly.getBounds());
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

    addFieldToMap(geoJson, name) {
        const layer = L.geoJSON(geoJson, {
            style: { color: '#3388ff', weight: 3, opacity: 0.5 }
        });
        layer.eachLayer((l) => {
            this.drawnItems.addLayer(l);
            this.onFieldAdded(l, name);
        });
        this.map.fitBounds(this.drawnItems.getBounds());
    }

    clearFields() {
        this.drawnItems.clearLayers();
    }
}
