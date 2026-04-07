class App {
    constructor() {
        this.step1 = document.getElementById('step-1');
        this.step2 = document.getElementById('step-2');
        this.step1Indicator = document.getElementById('step-1-indicator');
        this.step2Indicator = document.getElementById('step-2-indicator');
        this.btnNextStep = document.getElementById('btn-next-step');
        this.btnPrevStep = document.getElementById('btn-prev-step');
        this.btnSubmit = document.getElementById('btn-submit');
        this.fieldList = document.getElementById('field-list');
        this.importFileInput = document.getElementById('import-file');
        this.btnSearchPlz = document.getElementById('btn-search-plz');
        this.searchPlzInput = document.getElementById('search-postal-code');

        this.fpSidebar = document.getElementById('flightplan-sidebar');
        this.closeFPSidebar = document.getElementById('close-fp-sidebar');
        this.btnGenerateFP = document.getElementById('btn-generate-fp');
        this.btnReverseFP = document.getElementById('btn-reverse-fp');
        this.btnExportFPKML = document.getElementById('btn-export-fp-kml');

        this.fields = []; // Local storage for fields data
        this.currentFlightPath = null;

        this.initMap();
        this.attachEventListeners();
        this.updateFieldList();
    }

    initMap() {
        this.mapManager = new MapManager('map');
        this.wpLayerGroup = L.layerGroup().addTo(this.mapManager.map);

        this.mapManager.onFieldAdded = (layer, name) => {
            const field = {
                id: L.stamp(layer),
                name: name || `Schlag ${this.fields.length + 1}`,
                geometry: JSON.stringify(layer.toGeoJSON().geometry),
                area: L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]) / 10000 // In Hectares (Ha)
            };
            this.fields.push(field);
            this.updateFieldList();
        };

        this.mapManager.onFieldDeleted = (layer) => {
            const id = L.stamp(layer);
            this.fields = this.fields.filter(f => f.id !== id);
            this.updateFieldList();
        };

        this.mapManager.onFieldEdited = (layer) => {
            const id = L.stamp(layer);

            // Handle flight path editing
            if (this.currentFlightPath && L.stamp(this.currentFlightPath) === id) {
                const speed = parseFloat(document.getElementById('fp-speed').value) || 10;
                this.updateFPStats(speed);
                this.updateWaypointMarkers();
                return;
            }

            const field = this.fields.find(f => f.id === id);
            if (field) {
                field.geometry = JSON.stringify(layer.toGeoJSON().geometry);
                field.area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]) / 10000;
                this.updateFieldList();
            }
        };
    }

    attachEventListeners() {
        this.btnNextStep.addEventListener('click', () => {
            if (this.validateStep1()) {
                this.switchStep(2);
            }
        });

        this.btnPrevStep.addEventListener('click', () => {
            this.switchStep(1);
        });

        this.btnSubmit.addEventListener('click', () => {
            this.submitApplication();
        });

        this.importFileInput.addEventListener('change', (e) => {
            this.handleImport(e.target.files);
        });

        this.btnSearchPlz.addEventListener('click', () => {
            this.mapManager.centerMapByPostalCode(this.searchPlzInput.value);
        });

        this.closeFPSidebar.addEventListener('click', () => {
            this.fpSidebar.classList.add('hidden');
            setTimeout(() => this.mapManager.map.invalidateSize(), 300);
        });

        this.btnGenerateFP.addEventListener('click', () => {
            this.generateFlightPlan();
        });

        this.initFPInputs();

        this.btnExportFPKML.addEventListener('click', () => {
            this.exportFlightPlanKML();
        });

        this.btnReverseFP.addEventListener('click', () => {
            this.reverseFlightPlan();
        });

        this.searchPlzInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.mapManager.centerMapByPostalCode(this.searchPlzInput.value);
            }
        });

        const postalCodeInput = document.getElementById('postal_code');
        postalCodeInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await this.handlePostalCodeLookup(postalCodeInput.value);

                if (this.validateStep1()) {
                    this.switchStep(2);
                }
            }
        });

        postalCodeInput.addEventListener('blur', () => {
            this.handlePostalCodeLookup(postalCodeInput.value);
        });
    }

    async handlePostalCodeLookup(plz) {
        if (!plz || plz.length < 5) return;

        const result = await this.mapManager.geocodePostalCode(plz);
        if (result && result.address) {
            const address = result.address;
            const cityInput = document.getElementById('city');
            const city = address.city || address.town || address.village || address.suburb;
            if (city && !cityInput.value) {
                cityInput.value = city;
            }
        }
    }

    validateStep1() {
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const dsgvo = document.getElementById('dsgvo').checked;

        if (!name || !email) {
            alert('Bitte füllen Sie Nachname und E-Mail aus.');
            return false;
        }

        if (!dsgvo) {
            alert('Bitte akzeptieren Sie die Datenschutzbestimmungen (DSGVO).');
            return false;
        }

        return true;
    }

    switchStep(step) {
        if (step === 1) {
            this.step1.classList.remove('hidden');
            this.step2.classList.add('hidden');
            this.step1Indicator.classList.add('active');
            this.step2Indicator.classList.remove('active');
        } else {
            this.step1.classList.add('hidden');
            this.step2.classList.remove('hidden');
            this.step2Indicator.classList.add('active');
            this.step1Indicator.classList.remove('active');

            // Force map resize
            setTimeout(() => {
                this.mapManager.map.invalidateSize();

                // Center map based on Step 1 postal code after resize
                const postalCode = document.getElementById('postal_code').value;
                this.mapManager.centerMapByPostalCode(postalCode);
            }, 100);
        }
    }

    initFPInputs() {
        const syncInput = (sliderId, inputId, valSpanId, isOrientation = false) => {
            const slider = document.getElementById(sliderId);
            const input = document.getElementById(inputId);
            const valSpan = document.getElementById(valSpanId);

            const update = (val, source) => {
                if (source !== 'slider') slider.value = val;
                if (source !== 'input') input.value = val;

                if (isOrientation && val == 0) {
                    valSpan.textContent = "Auto";
                    input.value = ""; // Empty for auto
                } else {
                    valSpan.textContent = val;
                }
                this.generateFlightPlan();
            };

            slider.addEventListener('input', (e) => update(e.target.value, 'slider'));
            input.addEventListener('change', (e) => update(e.target.value, 'input'));
        };

        syncInput('slider-fp-path-distance', 'fp-path-distance', 'val-fp-path-distance');
        syncInput('slider-fp-min-dist', 'fp-min-dist', 'val-fp-min-dist');
        syncInput('slider-fp-border-distance', 'fp-border-distance', 'val-fp-border-distance');
        syncInput('slider-fp-orientation', 'fp-orientation', 'val-fp-orientation', true);
        syncInput('slider-fp-speed', 'fp-speed', 'val-fp-speed');
        syncInput('slider-fp-height', 'fp-height', 'val-fp-height');

        document.getElementById('fp-curved').addEventListener('change', () => {
            this.generateFlightPlan();
        });
    }

    updateFieldList() {
        this.fieldList.innerHTML = '';

        const totalArea = this.fields.reduce((sum, field) => sum + field.area, 0);
        const totalAreaDiv = document.createElement('div');
        totalAreaDiv.className = 'total-area';
        totalAreaDiv.innerHTML = `<strong>Gesamtfläche: ${totalArea.toFixed(2)} Ha</strong>`;
        this.fieldList.appendChild(totalAreaDiv);

        if (this.fields.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.textContent = 'Noch keine Schläge hinzugefügt.';
            this.fieldList.appendChild(emptyMsg);
            return;
        }

        this.fields.forEach(field => {
            const div = document.createElement('div');
            div.className = 'field-item';
            div.innerHTML = `
                <h4>${field.name}</h4>
                <p>Fläche: ${field.area.toFixed(2)} Ha</p>
                <div class="actions">
                    <button onclick="app.zoomToField('${field.id}')" class="btn secondary">Zoom</button>
                    <button onclick="app.openFlightPlanSidebar('${field.id}')" class="btn secondary">Flugplan</button>
                    <button onclick="app.exportFieldKML('${field.id}')" class="btn secondary">KML</button>
                    <button onclick="app.editFieldName('${field.id}')" class="btn secondary">Umbenennen</button>
                    <button onclick="app.deleteField('${field.id}')" class="btn">Löschen</button>
                </div>
            `;
            this.fieldList.appendChild(div);
        });
    }

    zoomToField(id) {
        const layer = this.mapManager.drawnItems.getLayer(id);
        if (layer) {
            this.mapManager.map.fitBounds(layer.getBounds(), { maxZoom: 18 });
        }
    }

    openFlightPlanSidebar(id) {
        const prevId = document.getElementById('fp-field-id').value;
        document.getElementById('fp-field-id').value = id;
        this.fpSidebar.classList.remove('hidden');
        this.mapManager.map.invalidateSize();
        this.zoomToField(id);

        if (prevId !== id) {
            // Reset stats and export button for new field
            document.getElementById('fp-stats').classList.add('hidden');
            this.btnExportFPKML.classList.add('hidden');
            this.btnReverseFP.classList.add('hidden');

            if (this.currentFlightPath) {
                this.mapManager.drawnItems.removeLayer(this.currentFlightPath);
                this.currentFlightPath = null;
                this.wpLayerGroup.clearLayers();
            }
            this.generateFlightPlan();
        } else if (this.currentFlightPath) {
            // Same field, show stats and export button if path exists
            document.getElementById('fp-stats').classList.remove('hidden');
            this.btnExportFPKML.classList.remove('hidden');
            this.btnReverseFP.classList.remove('hidden');
            const speed = parseFloat(document.getElementById('fp-speed').value) || 10;
            this.updateFPStats(speed);
            this.updateWaypointMarkers();
        } else {
            this.generateFlightPlan();
        }
    }

    generateFlightPlan() {
        const id = document.getElementById('fp-field-id').value;
        const field = this.fields.find(f => String(f.id) === String(id));
        if (!field) return;

        this.zoomToField(id);

        const pathDistance = parseFloat(document.getElementById('fp-path-distance').value) || 10;
        const borderDistance = parseFloat(document.getElementById('fp-border-distance').value) || 5;
        let orientation = document.getElementById('fp-orientation').value;
        const speed = parseFloat(document.getElementById('fp-speed').value) || 10;
        const isCurved = document.getElementById('fp-curved').checked;

        const geoJson = JSON.parse(field.geometry);
        let turfPoly = turf.rewind(turf.polygon(geoJson.coordinates));

        // 1. Buffer inward
        let buffered = turf.buffer(turfPoly, -borderDistance, { units: 'meters' });
        if (!buffered || (buffered.type === 'Feature' && (!buffered.geometry || buffered.geometry.coordinates.length === 0)) || (buffered.type === 'FeatureCollection' && buffered.features.length === 0)) {
            alert('Abstand zum Rand ist zu groß für diesen Schlag.');
            return;
        }

        let pathPoints = [];

        if (isCurved) {
            // Curved / Offset-based generation
            let currentBufferDist = 0;
            let direction = 1;
            let lastPoint = null;

            while (true) {
                let currentBuffered = turf.buffer(buffered, -currentBufferDist, { units: 'meters' });
                if (!currentBuffered || (currentBuffered.type === 'Feature' && (!currentBuffered.geometry || currentBuffered.geometry.coordinates.length === 0)) || (currentBuffered.type === 'FeatureCollection' && currentBuffered.features.length === 0)) {
                    break;
                }

                // Get coordinates of all polygons in this buffer level
                const features = currentBuffered.type === 'FeatureCollection' ? currentBuffered.features : [currentBuffered];
                features.forEach(feature => {
                    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                        const coords = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
                        coords.forEach(polyCoords => {
                            let ring = polyCoords[0]; // Outer ring
                            if (direction === -1) ring = [...ring].reverse();

                            // Find point closest to last added point to minimize jumps
                            if (lastPoint) {
                                let closestIdx = 0;
                                let minDist = Infinity;
                                ring.forEach((p, idx) => {
                                    const d = turf.distance(lastPoint, p, { units: 'meters' });
                                    if (d < minDist) {
                                        minDist = d;
                                        closestIdx = idx;
                                    }
                                });
                                ring = ring.slice(closestIdx).concat(ring.slice(0, closestIdx));

                                // Connection to the new ring/polygon
                                const p1 = ring[0];
                                if (!this.isPathInside(lastPoint, p1, buffered)) {
                                    let borderPath = this.getBorderPath(lastPoint, p1, buffered, null, turfPoly); // Pass original poly for validation
                                    borderPath.forEach(p => {
                                        if (turf.distance(pathPoints[pathPoints.length - 1], p, { units: 'meters' }) > 0.1) {
                                            pathPoints.push(p);
                                        }
                                    });
                                }
                            }

                            ring.forEach(p => {
                                if (pathPoints.length === 0 || turf.distance(pathPoints[pathPoints.length - 1], p, { units: 'meters' }) > 0.1) {
                                    pathPoints.push(p);
                                }
                            });
                            lastPoint = pathPoints[pathPoints.length - 1];
                        });
                    }
                });

                currentBufferDist += pathDistance;
                direction *= -1; // Reverse direction for zigzag effect
                if (currentBufferDist > 5000) break; // Safety break
            }
        } else {
            // Standard Zigzag Generation
            // 2. Orientation
            if (orientation === "") {
                orientation = this.calculateOptimalOrientation(buffered);
            } else {
                orientation = parseFloat(orientation);
            }

            // 3. Generate grid
            const bbox = turf.bbox(buffered);
            const diag = turf.distance(turf.point([bbox[0], bbox[1]]), turf.point([bbox[2], bbox[3]]), { units: 'meters' });
            const center = turf.center(buffered);

            // Create a grid of lines larger than the bbox to account for rotation
            const gridLines = [];
            const numLines = Math.ceil(diag * 1.5 / pathDistance) + 4;
            const startOffset = -(numLines * pathDistance) / 2;

            for (let i = 0; i <= numLines; i++) {
                const offset = startOffset + i * pathDistance;
                // Line parallel to orientation
                const line = turf.lineString([
                    turf.destination(center, diag, orientation, { units: 'meters' }).geometry.coordinates,
                    turf.destination(center, diag, orientation + 180, { units: 'meters' }).geometry.coordinates
                ]);
                // Translate line perpendicular to orientation
                const translatedLine = turf.transformTranslate(line, offset, orientation + 90, { units: 'meters' });
                gridLines.push(translatedLine);
            }

            // 4. Intersect grid lines with buffered polygon and find segments
            let lineSegments = [];
            const bufferedFeatures = buffered.type === 'FeatureCollection' ? buffered.features : [buffered];

            gridLines.forEach((line) => {
                const intersect = turf.lineIntersect(line, buffered);
                if (intersect.features.length >= 2) {
                    let coords = intersect.features.map(f => f.geometry.coordinates);
                    const refPoint = line.geometry.coordinates[0];
                    coords.sort((a, b) => turf.distance(refPoint, a) - turf.distance(refPoint, b));

                    let segmentsOnLine = [];
                    for (let j = 0; j < coords.length - 1; j++) {
                        let p1 = coords[j];
                        let p2 = coords[j + 1];
                        let midpoint = turf.midpoint(p1, p2);

                        let isInside = false;
                        for (const f of bufferedFeatures) {
                            if (turf.booleanPointInPolygon(midpoint, f)) {
                                isInside = true;
                                break;
                            }
                        }

                        if (isInside) {
                            segmentsOnLine.push([p1, p2]);
                        }
                    }
                    if (segmentsOnLine.length > 0) {
                        lineSegments.push(segmentsOnLine);
                    }
                }
            });

            if (lineSegments.length === 0) {
                alert('Konnte keinen Flugplan generieren. Prüfen Sie die Parameter.');
                return;
            }

            // 5. Connect segments in zigzag
            lineSegments.forEach((segments, i) => {
                const isForward = (i % 2 === 0);
                const orderedSegments = isForward ? segments : [...segments].reverse();

                orderedSegments.forEach((seg) => {
                    const p1 = isForward ? seg[0] : seg[1];
                    const p2 = isForward ? seg[1] : seg[0];

                    if (pathPoints.length > 0) {
                        const prev = pathPoints[pathPoints.length - 1];
                        // If p1 is same as prev, skip connection check
                        if (turf.distance(prev, p1, { units: 'meters' }) > 0.1) {
                            if (!this.isPathInside(prev, p1, buffered)) {
                                let borderPath = this.getBorderPath(prev, p1, buffered, orientation, turfPoly); // Pass original poly for validation
                                borderPath.forEach(p => {
                                    if (turf.distance(pathPoints[pathPoints.length - 1], p, { units: 'meters' }) > 0.1) {
                                        pathPoints.push(p);
                                    }
                                });
                            }
                        }
                    }

                    if (pathPoints.length === 0 || turf.distance(pathPoints[pathPoints.length - 1], p1, { units: 'meters' }) > 0.1) {
                        pathPoints.push(p1);
                    }
                    if (turf.distance(pathPoints[pathPoints.length - 1], p2, { units: 'meters' }) > 0.1) {
                        pathPoints.push(p2);
                    }
                });
            });
        }

        if (pathPoints.length < 2) {
            alert('Konnte keinen Flugplan generieren. Prüfen Sie die Parameter.');
            return;
        }

        // 6. Simplify path to respect minimum distance between points
        // User requested "at best the same value like distance between flightpath (lane spacing)"
        // "at least 0.5m"
        const minPointDist = parseFloat(document.getElementById('fp-min-dist').value) || 5;
        pathPoints = this.simplifyPath(pathPoints, minPointDist, buffered);

        // 7. Display path
        if (this.currentFlightPath) {
            this.mapManager.drawnItems.removeLayer(this.currentFlightPath);
        }
        this.wpLayerGroup.clearLayers();

        const latlngs = pathPoints.map(p => [p[1], p[0]]);
        this.currentFlightPath = L.polyline(latlngs, { color: 'red', weight: 3 });

        // Add waypoint markers
        this.updateWaypointMarkers();

        // For Leaflet.draw editing, the layer must be in the featureGroup
        this.mapManager.drawnItems.addLayer(this.currentFlightPath);

        this.updateFPStats(speed);

        document.getElementById('fp-stats').classList.remove('hidden');
        this.btnExportFPKML.classList.remove('hidden');
        this.btnReverseFP.classList.remove('hidden');
    }

    reverseFlightPlan() {
        if (!this.currentFlightPath) return;
        const latlngs = this.currentFlightPath.getLatLngs();
        latlngs.reverse();
        this.currentFlightPath.setLatLngs(latlngs);
        this.updateWaypointMarkers();
    }

    updateWaypointMarkers() {
        if (!this.currentFlightPath) return;
        this.wpLayerGroup.clearLayers();
        const latlngs = this.currentFlightPath.getLatLngs();
        const total = latlngs.length;

        // Skip markers if too many to avoid visual clutter, but always keep start/end
        let step = 1;
        if (total > 100) step = 2;
        if (total > 300) step = 5;
        if (total > 1000) step = 10;

        latlngs.forEach((ll, idx) => {
            const isLast = idx === total - 1;
            const isFirst = idx === 0;
            const shouldShow = isFirst || isLast || ((idx + 1) % step === 0);

            if (shouldShow) {
                const icon = L.divIcon({
                    className: 'wp-number-icon' + (isFirst ? ' wp-start' : '') + (isLast ? ' wp-end' : ''),
                    html: `<span>${idx + 1}</span>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });
                L.marker(ll, { icon: icon, interactive: false }).addTo(this.wpLayerGroup);
            }
        });
    }

    isPathInside(p1, p2, polygon, tolerance = 0.05) {
        const line = turf.lineString([p1, p2]);
        const len = turf.length(line, { units: 'meters' });
        if (len < 0.1) return true;

        const features = polygon.type === 'FeatureCollection' ? polygon.features : [polygon];

        // 1. Check for intersections with the boundaries of all polygons
        for (const feature of features) {
            const boundary = turf.polygonToLine(feature);
            const intersects = turf.lineIntersect(line, boundary);

            const significantIntersects = intersects.features.filter(f => {
                const d1 = turf.distance(f, p1, { units: 'meters' });
                const d2 = turf.distance(f, p2, { units: 'meters' });
                return d1 > tolerance && d2 > tolerance;
            });

            if (significantIntersects.length > 0) {
                return false;
            }
        }

        // 2. Sample points to check if the entire segment is inside
        const numSamples = Math.max(5, Math.min(100, Math.ceil(len / 0.5)));
        for (let i = 0; i <= numSamples; i++) {
            const dist = (i / numSamples) * len;
            const p = turf.along(line, dist, { units: 'meters' });

            let isInside = false;
            let minDistToAnyBoundary = Infinity;

            for (const feature of features) {
                if (turf.booleanPointInPolygon(p, feature)) {
                    isInside = true;
                    break;
                }
                const boundary = turf.polygonToLine(feature);
                const ptOnLine = turf.nearestPointOnLine(boundary, p, { units: 'meters' });
                if (ptOnLine.properties.dist < minDistToAnyBoundary) {
                    minDistToAnyBoundary = ptOnLine.properties.dist;
                }
            }

            if (!isInside && minDistToAnyBoundary > tolerance) {
                return false;
            }
        }
        return true;
    }

    getSquareConnection(p1, p2, polygon, orientation) {
        const angles = [orientation, (orientation + 90) % 360, (orientation + 180) % 360, (orientation + 270) % 360];

        for (const a1 of angles) {
            for (const a2 of angles) {
                if (Math.abs(a1 - a2) % 180 === 0) continue;

                const line1 = turf.lineString([
                    turf.destination(turf.point(p1), 1000, a1, { units: 'meters' }).geometry.coordinates,
                    turf.destination(turf.point(p1), 1000, a1 + 180, { units: 'meters' }).geometry.coordinates
                ]);
                const line2 = turf.lineString([
                    turf.destination(turf.point(p2), 1000, a2, { units: 'meters' }).geometry.coordinates,
                    turf.destination(turf.point(p2), 1000, a2 + 180, { units: 'meters' }).geometry.coordinates
                ]);
                const intersect = turf.lineIntersect(line1, line2);

                if (intersect.features.length > 0) {
                    const corner = intersect.features[0].geometry.coordinates;
                    if (this.isPathInside(p1, corner, polygon) && this.isPathInside(corner, p2, polygon)) {
                        return [corner, p2];
                    }
                }
            }
        }

        return null;
    }

    getSimpleCornerConnection(p1, p2, polygon, originalPoly) {
        // Option B: Find a single intermediate point (corner) that is safe
        // First try to find a corner within the safety buffer (polygon)
        let corner = this._findBestCorner(p1, p2, polygon, polygon);
        if (corner) return [corner, p2];

        // If no safe corner within the buffer, try finding one that is at least within the field (originalPoly)
        if (originalPoly) {
            corner = this._findBestCorner(p1, p2, polygon, originalPoly);
            if (corner) return [corner, p2];
        }

        return null;
    }

    _findBestCorner(p1, p2, boundaryPoly, safetyPoly) {
        const pathOnBoundary = this.getBorderPathOnBoundary(p1, p2, boundaryPoly);
        if (pathOnBoundary.length <= 2) return null;

        let bestCorner = null;
        let maxDist = -1;
        const directLine = turf.lineString([p1, p2]);

        for (let i = 1; i < pathOnBoundary.length - 1; i++) {
            const pt = pathOnBoundary[i];
            const dist = turf.pointToLineDistance(pt, directLine, {units:'meters'});
            if (dist > maxDist) {
                // For the corner to be "better", we just need it to be safe.
                // We check if p1->pt and pt->p2 are within safetyPoly.
                if (this.isPathInside(p1, pt, safetyPoly) && this.isPathInside(pt, p2, safetyPoly)) {
                    maxDist = dist;
                    bestCorner = pt;
                }
            }
        }
        return bestCorner;
    }

    getBorderPath(p1, p2, polygon, orientation = null, originalPoly = null) {
        try {
            const dist = turf.distance(p1, p2, { units: 'meters' });
            if (dist < 0.1) return [p2];

            // Check if direct path is inside the safety buffer
            if (this.isPathInside(p1, p2, polygon)) return [p2];

            if (orientation !== null) {
                const square = this.getSquareConnection(p1, p2, polygon, orientation);
                if (square) return square;

                // Try square connection within original boundary if it clips safety buffer
                if (originalPoly) {
                    const squareField = this.getSquareConnection(p1, p2, originalPoly, orientation);
                    if (squareField) return squareField;
                }
            }

            // Fallback: Check if direct path is at least inside the original field boundary
            if (originalPoly && this.isPathInside(p1, p2, originalPoly)) {
                return [p2];
            }

            const simpleCorner = this.getSimpleCornerConnection(p1, p2, polygon, originalPoly);
            if (simpleCorner) return simpleCorner;

            const line = turf.lineString([p1, p2]);
            const boundary = turf.flatten(turf.polygonToLine(polygon));
            const intersect = turf.lineIntersect(line, boundary);

            // Get all intersection points on the line
            let pts = intersect.features.map(f => f.geometry.coordinates);
            pts.push(p1);
            pts.push(p2);

            // Sort them along the line from p1 to p2
            pts.sort((a, b) => turf.distance(p1, a) - turf.distance(p1, b));

            // Unique points
            let uniquePts = [];
            pts.forEach(p => {
                if (uniquePts.length === 0 || turf.distance(uniquePts[uniquePts.length - 1], p, { units: 'meters' }) > 0.05) {
                    uniquePts.push(p);
                }
            });

            let resultPath = [];
            for (let i = 0; i < uniquePts.length - 1; i++) {
                const curr = uniquePts[i];
                const next = uniquePts[i + 1];

                if (this.isPathInside(curr, next, polygon)) {
                    if (resultPath.length === 0 || turf.distance(resultPath[resultPath.length - 1], next, { units: 'meters' }) > 0.05) {
                        resultPath.push(next);
                    }
                } else {
                    const bPath = this.getBorderPathOnBoundary(curr, next, polygon);
                    bPath.forEach(p => {
                        if (resultPath.length === 0 || turf.distance(resultPath[resultPath.length - 1], p, { units: 'meters' }) > 0.05) {
                            resultPath.push(p);
                        }
                    });
                }
            }
            return resultPath;
        } catch (e) {
            console.error("Error in getBorderPath", e);
            return [p2];
        }
    }

    getBorderPathOnBoundary(p1, p2, polygon) {
        const boundary = turf.flatten(turf.polygonToLine(polygon));
        let bestPath = [p2];
        let minDist = Infinity;

        for (const feature of boundary.features) {
            const line = feature.geometry;
            const coords = line.coordinates;
            if (!coords || coords.length < 2) continue;

            const pt1 = turf.nearestPointOnLine(line, p1, { units: 'meters' });
            const pt2 = turf.nearestPointOnLine(line, p2, { units: 'meters' });

            // Only consider this ring if both points are reasonably close to it
            if (pt1.properties.dist > 1.0 || pt2.properties.dist > 1.0) continue;

            const idx1 = pt1.properties.index;
            const idx2 = pt2.properties.index;

            const pathF = this.walkRing(coords, idx1, idx2, 1, pt1.geometry.coordinates, pt2.geometry.coordinates);
            const pathB = this.walkRing(coords, idx1, idx2, -1, pt1.geometry.coordinates, pt2.geometry.coordinates);

            const dF = turf.length(turf.lineString(pathF));
            const dB = turf.length(turf.lineString(pathB));

            // Pick shorter path
            if (dF < minDist) {
                minDist = dF;
                bestPath = pathF;
            }
            if (dB < minDist) {
                minDist = dB;
                bestPath = pathB;
            }
        }

        // Simplify boundary path to remove jitter
        if (bestPath.length > 2) {
            const simplified = turf.simplify(turf.lineString(bestPath), { tolerance: 0.1, highQuality: true });
            return simplified.geometry.coordinates;
        }

        return bestPath;
    }

    walkRing(coords, idx1, idx2, direction, startPt, endPt) {
        let path = [startPt];
        let i = direction === 1 ? (idx1 + 1) % coords.length : idx1;
        const targetIdx = direction === 1 ? (idx2 + 1) % coords.length : idx2;
        let safety = 0;

        // Optimization: if direct move on boundary is small, just take end point
        if (idx1 === idx2) {
            path.push(endPt);
            return path;
        }

        while (i !== targetIdx && safety < coords.length * 2) {
            path.push(coords[i]);
            i = direction === 1 ? (i + 1) % coords.length : (i - 1 + coords.length) % coords.length;
            safety++;
        }
        path.push(endPt);
        return path;
    }

    simplifyPath(points, minDistance, polygon) {
        if (points.length < 2) return points;

        // Pass 1: Greedy "Visibility" simplification
        let simplified = [points[0]];
        let current = 0;

        while (current < points.length - 1) {
            let furthestTarget = current + 1;
            for (let target = current + 2; target < points.length; target++) {
                // Use a slightly larger tolerance (0.1m) for visibility checks during simplification
                // This allows bypassing minor boundary fluctuations that are well within the field.
                if (this.isPathInside(simplified[simplified.length - 1], points[target], polygon, 0.1)) {
                    furthestTarget = target;
                } else {
                    break;
                }
            }
            simplified.push(points[furthestTarget]);
            current = furthestTarget;
        }

        // Pass 2: Collinear point removal
        let result = [simplified[0]];
        for (let i = 1; i < simplified.length - 1; i++) {
            const pPrev = result[result.length - 1];
            const pCurr = simplified[i];
            const pNext = simplified[i + 1];

            const b1 = turf.bearing(pPrev, pCurr);
            const b2 = turf.bearing(pCurr, pNext);
            let diff = Math.abs(b1 - b2);
            if (diff > 180) diff = 360 - diff;

            // Increase collinearity threshold to 2.5 degrees for more aggressive pruning
            if (diff < 2.5) {
                if (this.isPathInside(pPrev, pNext, polygon, 0.1)) {
                    continue;
                }
            }
            result.push(pCurr);
        }
        result.push(simplified[simplified.length - 1]);

        // Pass 3: DJI-mandated minimum distance (0.5m)
        let finalPath = [result[0]];
        for (let i = 1; i < result.length; i++) {
            const prev = finalPath[finalPath.length - 1];
            const curr = result[i];
            const dist = turf.distance(prev, curr, { units: 'meters' });

            if (dist >= 0.5) {
                finalPath.push(curr);
            } else if (i === result.length - 1 && finalPath.length > 1) {
                finalPath[finalPath.length - 1] = curr;
            }
        }

        return finalPath;
    }

    calculateOptimalOrientation(polygon) {
        // Simple heuristic: find the longest side of the convex hull
        const hull = turf.convex(polygon);
        let maxDist = 0;
        let bestAngle = 0;
        const coords = hull.geometry.coordinates[0];
        for (let i = 0; i < coords.length - 1; i++) {
            const p1 = coords[i];
            const p2 = coords[i+1];
            const dist = turf.distance(p1, p2);
            if (dist > maxDist) {
                maxDist = dist;
                bestAngle = turf.bearing(p1, p2);
            }
        }
        return bestAngle;
    }

    updateFPStats(speed) {
        const latlngs = this.currentFlightPath.getLatLngs();
        let totalDist = 0;
        for (let i = 0; i < latlngs.length - 1; i++) {
            totalDist += latlngs[i].distanceTo(latlngs[i+1]);
        }

        document.getElementById('fp-length').textContent = totalDist.toFixed(1);
        const durationMin = (totalDist / speed) / 60;
        document.getElementById('fp-duration').textContent = durationMin.toFixed(1);
    }

    exportFlightPlanKML() {
        if (!this.currentFlightPath) return;

        const id = document.getElementById('fp-field-id').value;
        const field = this.fields.find(f => String(f.id) === String(id));
        const name = (field ? field.name : 'Flugplan') + '_DJI';

        const height = parseFloat(document.getElementById('fp-height').value) || 15;
        const latlngs = this.currentFlightPath.getLatLngs();
        const coords = latlngs.map(ll => `${ll.lng},${ll.lat},${height}`).join(' ');

        const escapeXml = (unsafe) => {
            return unsafe.replace(/[<>&'"]/g, (c) => {
                switch (c) {
                    case '<': return '&lt;';
                    case '>': return '&gt;';
                    case '&': return '&amp;';
                    case '\'': return '&apos;';
                    case '"': return '&quot;';
                }
            });
        };

        const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
  <Document>
    <name>${escapeXml(name)}</name>
    <Placemark>
      <name>Waypoints</name>
      <LineString>
        <coordinates>${coords}</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

        const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.kml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    exportFieldKML(id) {
        const field = this.fields.find(f => String(f.id) === String(id));
        if (field) {
            const geoJson = JSON.parse(field.geometry);
            const kmlContent = this.convertToKML(geoJson, field.name);
            const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${field.name}.kml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    convertToKML(geometry, name) {
        const escapeXml = (unsafe) => {
            return unsafe.replace(/[<>&'"]/g, (c) => {
                switch (c) {
                    case '<': return '&lt;';
                    case '>': return '&gt;';
                    case '&': return '&amp;';
                    case '\'': return '&apos;';
                    case '"': return '&quot;';
                }
            });
        };

        const renderPolygon = (coords) => {
            const outerBoundary = coords[0].map(coord => `${coord[0]},${coord[1]},0`).join(' ');
            let innerBoundaries = '';
            if (coords.length > 1) {
                for (let i = 1; i < coords.length; i++) {
                    const innerBoundary = coords[i].map(coord => `${coord[0]},${coord[1]},0`).join(' ');
                    innerBoundaries += `
        <innerBoundaryIs>
          <LinearRing>
            <coordinates>${innerBoundary}</coordinates>
          </LinearRing>
        </innerBoundaryIs>`;
                }
            }
            return `
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${outerBoundary}</coordinates>
          </LinearRing>
        </outerBoundaryIs>${innerBoundaries}
      </Polygon>`;
        };

        let geometryKml = '';
        if (geometry.type === 'Polygon') {
            geometryKml = renderPolygon(geometry.coordinates);
        } else if (geometry.type === 'MultiPolygon') {
            geometryKml = `
      <MultiGeometry>${geometry.coordinates.map(polyCoords => renderPolygon(polyCoords)).join('')}
      </MultiGeometry>`;
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>${escapeXml(name)}</name>${geometryKml}
    </Placemark>
  </Document>
</kml>`;
    }

    editFieldName(id) {
        const field = this.fields.find(f => String(f.id) === String(id));
        if (field) {
            const newName = prompt('Neuen Schlagnamen eingeben:', field.name);
            if (newName) {
                field.name = newName;
                this.updateFieldList();
            }
        }
    }

    deleteField(id) {
        if (!confirm('Sind Sie sicher, dass Sie diesen Schlag löschen möchten?')) return;
        const field = this.fields.find(f => String(f.id) === String(id));
        if (field) {
            const layer = this.mapManager.drawnItems.getLayer(id);
            if (layer) {
                const currentFpId = document.getElementById('fp-field-id').value;
                if (String(currentFpId) === String(id)) {
                    if (this.currentFlightPath) {
                        this.mapManager.drawnItems.removeLayer(this.currentFlightPath);
                        this.currentFlightPath = null;
                    }
                    this.wpLayerGroup.clearLayers();
                    this.fpSidebar.classList.add('hidden');
                }

                this.mapManager.drawnItems.removeLayer(layer);
                this.fields = this.fields.filter(f => String(f.id) !== String(id));
                this.updateFieldList();
            }
        }
    }

    async handleImport(files) {
        if (!files || files.length === 0) return;

        // Check if multiple files are selected (unzipped SHP)
        const fileMap = {};
        for (let i = 0; i < files.length; i++) {
            const ext = files[i].name.split('.').pop().toLowerCase();
            fileMap[ext] = files[i];
        }

        if (fileMap['shp']) {
            // Unzipped SHP
            try {
                const shpBuffer = await fileMap['shp'].arrayBuffer();
                const dbfBuffer = fileMap['dbf'] ? await fileMap['dbf'].arrayBuffer() : null;
                const shxBuffer = fileMap['shx'] ? await fileMap['shx'].arrayBuffer() : null;
                const prjBuffer = fileMap['prj'] ? await fileMap['prj'].arrayBuffer() : null;

                // shp.parseShp also takes shx as second argument
                const shpObj = shp.parseShp(shpBuffer, shxBuffer);
                const dbfObj = dbfBuffer ? shp.parseDbf(dbfBuffer) : null;

                // shpjs handles prj if passed in certain ways, but for combine we mostly need geometry
                const geoJson = await shp.combine([shpObj, dbfObj]);

                this.addImportedGeoJson(geoJson);
            } catch (err) {
                console.error(err);
                alert('Fehler beim Verarbeiten der SHP-Datei: ' + err.message);
            }
            return;
        }

        // Single file import
        const file = files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const extension = file.name.split('.').pop().toLowerCase();
                if (extension === 'zip') {
                    // SHP file (zipped)
                    const geoJson = await shp(e.target.result);
                    this.addImportedGeoJson(geoJson);
                } else if (extension === 'kml') {
                    // KML file
                    const kmlLayer = omnivore.kml.parse(e.target.result);
                    this.addImportedGeoJson(kmlLayer.toGeoJSON());
                } else if (extension === 'xml') {
                    // Digital Field Record Book (ISO-XML)
                    this.parseISOXML(e.target.result);
                } else {
                    alert('Nicht unterstütztes Dateiformat. Bitte verwenden Sie .zip (für SHP), .kml, .xml (ISO-XML) oder wählen Sie alle SHP-Einzeldateien aus.');
                }
            } catch (err) {
                console.error(err);
                alert('Fehler beim Verarbeiten der Datei: ' + err.message);
            }
        };

        if (file.name.endsWith('.zip')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    }

    parseISOXML(xmlString) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "text/xml");
            const partfields = xmlDoc.getElementsByTagName("PFD"); // Partfield

            if (partfields.length === 0) {
                alert('Keine Schläge in der XML-Datei gefunden.');
                return;
            }

            for (let i = 0; i < partfields.length; i++) {
                const pfd = partfields[i];
                const name = pfd.getAttribute("C") || `Schlag ${this.fields.length + 1}`;
                const polygons = pfd.getElementsByTagName("PLN"); // Polygon

                for (let j = 0; j < polygons.length; j++) {
                    const pln = polygons[j];
                    const points = pln.getElementsByTagName("PNT"); // Point
                    const latlngs = [];

                    for (let k = 0; k < points.length; k++) {
                        const pnt = points[k];
                        const lat = parseFloat(pnt.getAttribute("A")); // Latitude
                        const lng = parseFloat(pnt.getAttribute("B")); // Longitude
                        if (!isNaN(lat) && !isNaN(lng)) {
                            latlngs.push([lat, lng]);
                        }
                    }

                    if (latlngs.length > 2) {
                        const geoJson = {
                            type: "Feature",
                            properties: { name: name },
                            geometry: {
                                type: "Polygon",
                                coordinates: [latlngs.map(ll => [ll[1], ll[0]])]
                            }
                        };
                        this.addImportedGeoJson(geoJson);
                    }
                }
            }
        } catch (err) {
            console.error(err);
            alert('Fehler beim Parsen der ISO-XML Datei: ' + err.message);
        }
    }

    addImportedGeoJson(geoJson) {
        // Handle FeatureCollection or single Feature
        const features = geoJson.features || (geoJson.type === 'Feature' ? [geoJson] : []);
        features.forEach(feature => {
            if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                this.mapManager.addFieldToMap(feature, feature.properties.name || null);
            }
        });
    }

    async submitApplication() {
        if (this.fields.length === 0) {
            if (!confirm('Keine Schläge hinzugefügt. Trotzdem absenden?')) return;
        }

        const formData = new FormData();
        formData.append('customer_first_name', document.getElementById('first_name').value);
        formData.append('customer_name', document.getElementById('name').value);
        formData.append('customer_company', document.getElementById('company').value);
        formData.append('customer_street', document.getElementById('street').value);
        formData.append('customer_house_number', document.getElementById('house_number').value);
        formData.append('customer_postal_code', document.getElementById('postal_code').value);
        formData.append('customer_city', document.getElementById('city').value);
        formData.append('customer_email', document.getElementById('email').value);
        formData.append('customer_phone', document.getElementById('phone').value);
        formData.append('customer_comments', document.getElementById('comments').value);
        formData.append('customer_dsgvo_accepted', document.getElementById('dsgvo').checked ? 1 : 0);

        this.fields.forEach((field, index) => {
            formData.append(`fields[${index}][name]`, field.name);
            formData.append(`fields[${index}][geometry]`, field.geometry);
            formData.append(`fields[${index}][area]`, field.area);
        });

        try {
            const response = await fetch('../api/submit_application.php', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.success) {
                alert('Antrag erfolgreich abgesendet! Kunden-ID: ' + result.customerId);
                location.reload();
            } else {
                alert('Fehler: ' + result.message);
            }
        } catch (err) {
            console.error(err);
            alert('Beim Absenden ist ein Fehler aufgetreten.');
        }
    }
}

const app = new App();
window.app = app;
