class MapManager {
    constructor(mapId) {
        this.map = L.map(mapId).setView([48.1351, 11.5820], 13); // Default view
        this.drawnItems = new L.FeatureGroup();
        this.map.addLayer(this.drawnItems);

        // Layers
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
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
            "Google Satellite": googleSat,
            "Satellite WMS (EOX)": satelliteWMS,
            "OpenStreetMap": osm
        };

        const overlayMaps = {
            "Drawn Fields": this.drawnItems
        };

        L.control.layers(baseMaps, overlayMaps).addTo(this.map);

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
