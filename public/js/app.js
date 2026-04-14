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
        this.btnExportFPKMZ = document.getElementById('btn-export-fp-kmz');
        this.terrainFollowingCheckbox = document.getElementById('fp-terrain-following');
        this.showWPHeightCheckbox = document.getElementById('fp-show-wp-height');
        this.editWaypointsCheckbox = document.getElementById('fp-edit-waypoints');

        this.waypointTableBody = document.querySelector('#waypoint-table tbody');
        this.waypointTableContainer = document.getElementById('waypoint-table-container');

        this.fields = []; // Local storage for fields data
        this.currentFlightPath = null;
        this.fpUpdateTimeout = null;

        this.initMap();
        this.attachEventListeners();
        this.updateFieldList();
    }

    initMap() {
        this.mapManager = new MapManager('map');
        this.wpLayerGroup = L.layerGroup().addTo(this.mapManager.map);

        this.mapManager.map.on('zoomend', () => {
            this.updateWaypointMarkers();
        });

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
                this.updateWaypointTable();
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
            this.waypointTableContainer.classList.add('hidden');
            if (this.currentFlightPath && this.currentFlightPath.editing) {
                this.currentFlightPath.editing.disable();
            }
            setTimeout(() => this.mapManager.map.invalidateSize(), 300);
        });

        this.btnGenerateFP.addEventListener('click', () => {
            this.generateFlightPlan();
        });

        this.initFPInputs();

        this.btnExportFPKML.addEventListener('click', () => {
            this.exportFlightPlanKML();
        });

        this.btnExportFPKMZ.addEventListener('click', () => {
            this.exportFlightPlanKMZ();
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

                if (isOrientation && (val == 0 || val === "" || val === "0")) {
                    valSpan.textContent = "Auto";
                    input.value = ""; // Empty for auto
                } else {
                    valSpan.textContent = val;
                }
                this.scheduleFPUpdate();
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

        document.getElementById('fp-mode').addEventListener('change', () => {
            this.generateFlightPlan();
        });

        document.getElementById('fp-clip-corners').addEventListener('change', () => {
            this.generateFlightPlan();
        });

        this.terrainFollowingCheckbox.addEventListener('change', () => {
            const heightModeContainer = document.getElementById('fp-height-mode-container');
            if (this.terrainFollowingCheckbox.checked) {
                heightModeContainer.classList.remove('hidden');
                this.showWPHeightCheckbox.disabled = false;
                this.showWPHeightCheckbox.checked = true;
            } else {
                heightModeContainer.classList.add('hidden');
                this.showWPHeightCheckbox.disabled = true;
                this.showWPHeightCheckbox.checked = false;
            }
            this.scheduleFPUpdate();
        });

        this.showWPHeightCheckbox.addEventListener('change', () => {
            this.updateWaypointMarkers();
        });

        this.editWaypointsCheckbox.addEventListener('change', () => {
            if (!this.currentFlightPath) return;
            if (this.editWaypointsCheckbox.checked) {
                if (this.currentFlightPath.editing) this.currentFlightPath.editing.enable();
            } else {
                if (this.currentFlightPath.editing) this.currentFlightPath.editing.disable();
            }
        });

        document.getElementById('fp-rc-lost-action').addEventListener('change', (e) => {
            const container = document.getElementById('fp-execute-rc-lost-action-container');
            if (e.target.value === 'executeLostAction') {
                container.classList.remove('hidden');
            } else {
                container.classList.add('hidden');
            }
        });
    }

    scheduleFPUpdate() {
        if (this.fpUpdateTimeout) clearTimeout(this.fpUpdateTimeout);
        this.fpUpdateTimeout = setTimeout(() => this.generateFlightPlan(), 500);
    }

    async fetchTerrainHeights(latlngs) {
        if (!latlngs || latlngs.length === 0) return [];
        const locations = latlngs.map(ll => ({ latitude: ll.lat, longitude: ll.lng }));
        const results = [];
        const batchSize = 100;

        const tryFetch = async (dataset, batch) => {
            const response = await fetch(`../api/get_terrain.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dataset: dataset,
                    locations: batch
                })
            });
            const data = await response.json();
            if (data.status === 'OK') {
                return data.results;
            }
            throw new Error(data.error || 'Unbekannter Fehler');
        };

        for (let i = 0; i < locations.length; i += batchSize) {
            const batch = locations.slice(i, i + batchSize);
            let batchResults;
            try {
                batchResults = await tryFetch('eudem25m', batch);
            } catch (err) {
                console.warn(`Primary dataset (eudem25m) failed: ${err.message}. Trying fallback...`);
                try {
                    batchResults = await tryFetch('srtm30m', batch);
                } catch (fallbackErr) {
                    throw new Error('Fehler beim Abrufen der Geländehöhen (auch Fallback fehlgeschlagen): ' + fallbackErr.message);
                }
            }
            results.push(...batchResults);

            // Rate limit handling for public API
            if (i + batchSize < locations.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return results;
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
                    <button class="btn secondary action-zoom">Zoom</button>
                    <button class="btn secondary action-fp">Flugplan</button>
                    <button class="btn secondary action-kml">KML</button>
                    <button class="btn secondary action-rename">Umbenennen</button>
                    <button class="btn action-delete">Löschen</button>
                </div>
            `;
            div.querySelector('.action-zoom').addEventListener('click', () => this.zoomToField(field.id));
            div.querySelector('.action-fp').addEventListener('click', () => this.openFlightPlanSidebar(field.id));
            div.querySelector('.action-kml').addEventListener('click', () => this.exportFieldKML(field.id));
            div.querySelector('.action-rename').addEventListener('click', () => this.editFieldName(field.id));
            div.querySelector('.action-delete').addEventListener('click', () => this.deleteField(field.id));
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
            this.btnExportFPKMZ.classList.add('hidden');
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
            this.updateWaypointTable();
            if (this.currentFlightPath.editing) {
                if (this.editWaypointsCheckbox.checked) this.currentFlightPath.editing.enable();
                else this.currentFlightPath.editing.disable();
            }
        } else {
            this.generateFlightPlan();
        }
    }

    getMiteredOffset(poly, distance, clip) {
        if (distance <= 0) return poly;

        // Use turf.rewind to ensure consistent winding order:
        // Outer ring: Counter-Clockwise (CCW)
        // Holes: Clockwise (CW)
        const rewound = turf.rewind(poly);
        const geom = rewound.geometry || rewound;

        const processRing = (ring) => {
            const newRing = [];
            const len = ring.length;
            if (len < 4) return null;

            for (let i = 0; i < len - 1; i++) {
                const pPrev = i === 0 ? ring[len - 2] : ring[i - 1];
                const pCurr = ring[i];
                const pNext = ring[i + 1];

                const b1 = turf.bearing(pPrev, pCurr);
                const b2 = turf.bearing(pCurr, pNext);

                // Normal direction (90 degrees to the left of the segment)
                // For CCW outer ring, this points INWARD.
                // For CW inner ring (hole), this points OUTWARD (into the field).
                let n1 = b1 - 90;
                let n2 = b2 - 90;

                let diff = n2 - n1;
                while (diff > 180) diff -= 360;
                while (diff < -180) diff += 360;

                const bisector = n1 + diff / 2;
                const phi = (diff / 2) * Math.PI / 180;
                const cosPhi = Math.cos(phi);

                let miterDist = distance;
                const miterLimit = 2.5;

                if (Math.abs(cosPhi) > 0.01) {
                    miterDist = distance / cosPhi;
                }

                if (clip && Math.abs(miterDist) > Math.abs(distance) * miterLimit) {
                    const cp1 = turf.destination(turf.point(pCurr), distance, n1, {units:'meters'});
                    const cp2 = turf.destination(turf.point(pCurr), distance, n2, {units:'meters'});
                    newRing.push(cp1.geometry.coordinates);
                    newRing.push(cp2.geometry.coordinates);
                } else {
                    const newPt = turf.destination(turf.point(pCurr), miterDist, bisector, {units: 'meters'}).geometry.coordinates;
                    newRing.push(newPt);
                }
            }
            if (newRing.length < 3) return null;
            newRing.push(newRing[0]);
            return newRing;
        };

        const resultPolygons = [];
        const polySet = (geom.type === 'Polygon') ? [geom.coordinates] : geom.coordinates;

        polySet.forEach(rings => {
            const newRings = rings.map(ring => processRing(ring)).filter(r => r !== null);
            if (newRings.length > 0) {
                try {
                    let p = turf.polygon(newRings);
                    // Clean up potential self-intersections
                    p = turf.buffer(p, 0);
                    if (p) {
                        if (p.type === 'FeatureCollection') {
                            p.features.forEach(f => resultPolygons.push(f));
                        } else {
                            resultPolygons.push(p);
                        }
                    }
                } catch (e) {
                    console.warn("Could not create offset polygon", e);
                }
            }
        });

        if (resultPolygons.length === 0) return null;
        if (resultPolygons.length === 1) return resultPolygons[0];
        return turf.featureCollection(resultPolygons);
    }
    simplifyGeo(geojson, toleranceMeters) {
        const merc = turf.toMercator(geojson);
        const simplified = turf.simplify(merc, { tolerance: toleranceMeters, highQuality: true });
        return turf.toWgs84(simplified);
    }

    updateWaypointTable() {
        if (!this.currentFlightPath) {
            this.waypointTableContainer.classList.add('hidden');
            return;
        }
        this.waypointTableContainer.classList.remove('hidden');
        this.waypointTableBody.innerHTML = '';
        const latlngs = this.currentFlightPath.getLatLngs();

        latlngs.forEach((ll, idx) => {
            const absHeight = ll.alt !== undefined ? ll.alt.toFixed(1) : '-';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td><input type="number" step="0.000001" value="${ll.lat.toFixed(6)}" data-idx="${idx}" data-type="lat"></td>
                <td><input type="number" step="0.000001" value="${ll.lng.toFixed(6)}" data-idx="${idx}" data-type="lng"></td>
                <td><input type="number" step="0.1" value="${absHeight}" data-idx="${idx}" data-type="alt" ${this.terrainFollowingCheckbox.checked ? '' : 'disabled'}></td>
                <td><button type="button" class="btn secondary small action-delete-wp">Löschen</button></td>
            `;
            tr.querySelector('.action-delete-wp').addEventListener('click', () => this.removeWaypoint(idx));
            this.waypointTableBody.appendChild(tr);
        });

        this.waypointTableBody.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const type = e.target.dataset.type;
                const val = parseFloat(e.target.value);
                const currentLatLngs = this.currentFlightPath.getLatLngs();
                if (type === 'lat') currentLatLngs[idx].lat = val;
                else if (type === 'lng') currentLatLngs[idx].lng = val;
                else if (type === 'alt') currentLatLngs[idx].alt = val;

                this.currentFlightPath.setLatLngs(currentLatLngs);
                this.updateWaypointMarkers();
                this.updateFPStats(parseFloat(document.getElementById('fp-speed').value) || 10);
            });
        });
    }

    removeWaypoint(idx) {
        const latlngs = this.currentFlightPath.getLatLngs();
        if (latlngs.length <= 2) {
            alert("Ein Flugplan muss mindestens 2 Punkte haben.");
            return;
        }
        latlngs.splice(idx, 1);
        this.currentFlightPath.setLatLngs(latlngs);
        this.updateWaypointMarkers();
        this.updateWaypointTable();
        this.updateFPStats(parseFloat(document.getElementById('fp-speed').value) || 10);
    }

    async generateFlightPlan() {
        const id = document.getElementById('fp-field-id').value;
        const field = this.fields.find(f => String(f.id) === String(id));
        if (!field) return;

        const pathDistance = parseFloat(document.getElementById('fp-path-distance').value) || 10;
        const borderDistance = parseFloat(document.getElementById('fp-border-distance').value) || 5;
        const minPointDist = parseFloat(document.getElementById('fp-min-dist').value) || 5;
        let orientation = document.getElementById('fp-orientation').value;
        const speed = parseFloat(document.getElementById('fp-speed').value) || 10;
        const fpMode = document.getElementById('fp-mode').value;
        const clipCorners = document.getElementById('fp-clip-corners').checked;

        const geoJson = JSON.parse(field.geometry);
        let originalPoly = turf.rewind(turf.polygon(geoJson.coordinates));

        // 1. Virtual Border (Mitered Inward Offset)
        let virtualBorder = this.getMiteredOffset(originalPoly, borderDistance, clipCorners);

        if (!virtualBorder) {
            alert('Abstand zum Rand ist zu groß für diesen Schlag oder der Schlag ist zu klein.');
            return;
        }

        // Ensure virtual border is within original poly
        try {
            if (virtualBorder.type === 'FeatureCollection') {
                const combined = virtualBorder.features.reduce((acc, f) => acc ? turf.union(acc, f) : f, null);
                virtualBorder = turf.intersect(combined, originalPoly);
            } else {
                virtualBorder = turf.intersect(virtualBorder, originalPoly);
            }
        } catch(e) {
            console.warn("Intersection failed", e);
        }

        if (!virtualBorder || (virtualBorder.type === 'FeatureCollection' && virtualBorder.features.length === 0)) {
            alert('Abstand zum Rand ist zu groß für diesen Schlag oder der Schlag ist zu klein.');
            return;
        }

        // Soften boundary slightly
        virtualBorder = this.simplifyGeo(virtualBorder, 0.1);
        let pathPoints = [];

        if (fpMode === 'curved') {
            // Keep existing curved logic but use the new virtual border
            let currentBufferDist = 0;
            let direction = 1;
            let lastPoint = null;
            let bufferBase = virtualBorder;

            while (true) {
                let currentBuffered = turf.buffer(bufferBase, -currentBufferDist, { units: 'meters' });
                if (!currentBuffered || (currentBuffered.type === 'Feature' && (!currentBuffered.geometry || currentBuffered.geometry.coordinates.length === 0)) || (currentBuffered.type === 'FeatureCollection' && currentBuffered.features.length === 0)) {
                    break;
                }

                const features = currentBuffered.type === 'FeatureCollection' ? currentBuffered.features : [currentBuffered];
                features.forEach(feature => {
                    const coords = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
                    coords.forEach(polyCoords => {
                        let ring = polyCoords[0];
                        if (direction === -1) ring = [...ring].reverse();

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

                            // Transition to new ring
                            const p1 = ring[0];
                            let borderPath = this.getBorderPath(lastPoint, p1, virtualBorder);
                            borderPath.forEach(p => {
                                if (pathPoints.length === 0 || turf.distance(pathPoints[pathPoints.length - 1], p, { units: 'meters' }) > 0.1) {
                                    pathPoints.push(p);
                                }
                            });
                        }

                        ring.forEach(p => {
                            if (pathPoints.length === 0 || turf.distance(pathPoints[pathPoints.length - 1], p, { units: 'meters' }) > 0.1) {
                                pathPoints.push(p);
                            }
                        });
                        lastPoint = pathPoints[pathPoints.length - 1];
                    });
                });

                currentBufferDist += pathDistance;
                direction *= -1;
                if (currentBufferDist > 10000) break;
            }
            pathPoints = this.simplifyPath(pathPoints, minPointDist, virtualBorder);
        } else {
            // Zigzag or Intelligent Logic
            let finalOrientation;
            if (orientation !== "" && orientation !== null && orientation !== "0") {
                finalOrientation = parseFloat(orientation);
                pathPoints = this.calculateZigzagPoints(virtualBorder, finalOrientation, pathDistance);
                pathPoints = this.simplifyPath(pathPoints, minPointDist, virtualBorder);
            } else if (fpMode === 'intelligent') {
                const result = this.calculateIntelligentPath(virtualBorder, pathDistance, minPointDist);
                pathPoints = result.points;
                finalOrientation = result.orientation;
                // orientation for display/stats
                document.getElementById('val-fp-orientation').textContent = Math.round(finalOrientation);
            } else {
                // Default Zigzag (Auto)
                finalOrientation = this.calculateOptimalOrientation(virtualBorder);
                pathPoints = this.calculateZigzagPoints(virtualBorder, finalOrientation, pathDistance);
                pathPoints = this.simplifyPath(pathPoints, minPointDist, virtualBorder);
                document.getElementById('val-fp-orientation').textContent = Math.round(finalOrientation);
            }

            if (pathPoints.length === 0) {
                alert('Konnte keinen Flugplan generieren. Prüfen Sie die Parameter (Abstand zum Rand evtl. zu groß).');
                return;
            }
        }

        // Display
        if (this.currentFlightPath) {
            this.mapManager.drawnItems.removeLayer(this.currentFlightPath);
        }
        this.wpLayerGroup.clearLayers();

        let latlngs = pathPoints.map(p => L.latLng(p[1], p[0]));

        if (this.terrainFollowingCheckbox.checked) {
            const originalBtnText = this.btnGenerateFP.textContent;
            this.btnGenerateFP.textContent = "Höhendaten laden...";
            this.btnGenerateFP.disabled = true;

            try {
                const terrainData = await this.fetchTerrainHeights(latlngs);
                const flightHeight = parseFloat(document.getElementById('fp-height').value) || 15;
                latlngs.forEach((ll, idx) => {
                    const terrainHeight = terrainData[idx].elevation;
                    ll.alt = terrainHeight + flightHeight;
                });
            } catch (err) {
                alert(err.message);
                this.terrainFollowingCheckbox.checked = false;
            } finally {
                this.btnGenerateFP.textContent = originalBtnText;
                this.btnGenerateFP.disabled = false;
            }
        }

        this.currentFlightPath = L.polyline(latlngs, { color: 'red', weight: 3 });

        this.updateWaypointMarkers();
        this.updateWaypointTable();

        this.mapManager.drawnItems.addLayer(this.currentFlightPath);
        if (this.currentFlightPath.editing) {
            if (this.editWaypointsCheckbox.checked) this.currentFlightPath.editing.enable();
            else this.currentFlightPath.editing.disable();
        }

        this.updateFPStats(speed);

        document.getElementById('fp-stats').classList.remove('hidden');
        this.btnExportFPKML.classList.remove('hidden');
        this.btnExportFPKMZ.classList.remove('hidden');
        this.btnReverseFP.classList.remove('hidden');
    }

    reverseFlightPlan() {
        if (!this.currentFlightPath) return;
        const latlngs = this.currentFlightPath.getLatLngs();
        latlngs.reverse();
        this.currentFlightPath.setLatLngs(latlngs);
        this.updateWaypointMarkers();
        this.updateWaypointTable();
    }

    updateWaypointMarkers() {
        if (!this.currentFlightPath) return;
        this.wpLayerGroup.clearLayers();
        const latlngs = this.currentFlightPath.getLatLngs();
        const total = latlngs.length;
        const terrainFollowing = this.terrainFollowingCheckbox.checked;
        const showWPHeight = this.showWPHeightCheckbox.checked;
        const zoom = this.mapManager.map.getZoom();

        // Dynamic density based on zoom
        let step = 1;
        if (zoom < 15) {
            step = total > 100 ? 10 : 5;
        } else if (zoom < 17) {
            step = total > 100 ? 5 : 2;
        } else if (zoom < 19) {
            step = total > 300 ? 2 : 1;
        }

        latlngs.forEach((ll, idx) => {
            const isLast = idx === total - 1;
            const isFirst = idx === 0;
            const shouldShow = isFirst || isLast || ((idx + 1) % step === 0);

            if (shouldShow) {
                let html = `<div class="wp-num">${idx + 1}</div>`;
                const hasAlt = ll.alt !== undefined;

                if (hasAlt && terrainFollowing && (showWPHeight || isFirst || isLast)) {
                    const roundedHeight = Math.round(ll.alt);
                    html += `<div class="wp-height">(${roundedHeight} m)</div>`;
                }

                const icon = L.divIcon({
                    className: 'wp-number-icon' + (isFirst ? ' wp-start' : '') + (isLast ? ' wp-end' : ''),
                    html: html,
                    iconSize: null,
                    iconAnchor: [0, 0]
                });
                L.marker(ll, { icon: icon, interactive: false }).addTo(this.wpLayerGroup);
            }
        });
    }

    isCollinear(p1, p2, p3, threshold = 2.5) {
        const b1 = turf.bearing(p1, p2);
        const b2 = turf.bearing(p2, p3);
        let diff = b1 - b2;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        return Math.abs(diff) < threshold;
    }

    isPathInside(p1, p2, polygon, tolerance = 0.05) {
        const line = turf.lineString([p1, p2]);
        const len = turf.length(line, { units: 'meters' });
        if (len < 0.1) return true;

        const features = polygon.type === 'FeatureCollection' ? polygon.features : [polygon];

        for (const feature of features) {
            const boundary = turf.polygonToLine(feature);
            const intersects = turf.lineIntersect(line, boundary);

            const significantIntersects = intersects.features.filter(f => {
                const d1 = turf.distance(f, p1, { units: 'meters' });
                const d2 = turf.distance(f, p2, { units: 'meters' });
                return d1 > 0.1 && d2 > 0.1;
            });

            if (significantIntersects.length > 0) return false;
        }

        const numSamples = Math.max(10, Math.min(100, Math.ceil(len / 0.5)));
        for (let i = 0; i <= numSamples; i++) {
            const dist = (i / numSamples) * len;
            const p = turf.along(line, dist, { units: 'meters' });

            let isInside = false;
            for (const feature of features) {
                if (turf.booleanPointInPolygon(p, feature)) {
                    isInside = true;
                    break;
                }
            }
            if (!isInside) {
                let minBorderDist = Infinity;
                for (const feature of features) {
                    const boundary = turf.polygonToLine(feature);
                    const nearest = turf.nearestPointOnLine(boundary, p, { units: 'meters' });
                    const distToBorder = turf.distance(p, nearest, { units: 'meters' });
                    if (distToBorder < minBorderDist) minBorderDist = distToBorder;
                }
                if (minBorderDist > tolerance) return false;
            }
        }
        return true;
    }

    getBorderPath(p1, p2, polygon) {
        if (this.isPathInside(p1, p2, polygon, 0.05)) return [p2];
        return this.getBorderPathOnBoundary(p1, p2, polygon);
    }
    getBorderPathOnBoundary(p1, p2, polygon) {
        const boundary = turf.flatten(turf.polygonToLine(polygon));
        let bestPath = [p2];
        let minDist = Infinity;

        for (const feature of boundary.features) {
            const line = feature.geometry;
            const coords = line.coordinates;
            const pt1 = turf.nearestPointOnLine(line, p1, { units: 'meters' });
            const pt2 = turf.nearestPointOnLine(line, p2, { units: 'meters' });

            const idx1 = pt1.properties.index;
            const idx2 = pt2.properties.index;

            const pathF = this.walkRing(coords, idx1, idx2, 1, pt1.geometry.coordinates, pt2.geometry.coordinates);
            const pathB = this.walkRing(coords, idx1, idx2, -1, pt1.geometry.coordinates, pt2.geometry.coordinates);

            const dF = turf.length(turf.lineString(pathF));
            const dB = turf.length(turf.lineString(pathB));

            if (dF < minDist) { minDist = dF; bestPath = pathF; }
            if (dB < minDist) { minDist = dB; bestPath = pathB; }
        }

        return bestPath;
    }

    walkRing(coords, idx1, idx2, direction, startPt, endPt) {
        let path = [startPt];
        let i = direction === 1 ? (idx1 + 1) % coords.length : idx1;
        const targetIdx = direction === 1 ? (idx2 + 1) % coords.length : idx2;
        let safety = 0;

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

        let simplified = [points[0]];
        let current = 0;

        while (current < points.length - 1) {
            let furthestTarget = current + 1;
            for (let target = current + 2; target < points.length; target++) {
                if (this.isPathInside(simplified[simplified.length - 1], points[target], polygon, 0.1) && this.isCollinear(simplified[simplified.length - 1], points[target - 1], points[target])) {
                    furthestTarget = target;
                } else {
                    break;
                }
            }
            simplified.push(points[furthestTarget]);
            current = furthestTarget;
        }

        let finalPath = [simplified[0]];
        for (let i = 1; i < simplified.length; i++) {
            const prev = finalPath[finalPath.length - 1];
            const curr = simplified[i];
            const d = turf.distance(prev, curr, { units: "meters" });
            if (d >= Math.max(0.5, minDistance)) {
                finalPath.push(curr);
            } else if (i === simplified.length - 1 && finalPath.length > 1) {
                finalPath[finalPath.length - 1] = curr;
            }
        }

        return finalPath;
    }

    // Skip old simplifyPath implementation
    calculateZigzagPoints(virtualBorder, orientation, pathDistance) {
        const center = turf.center(virtualBorder);
        const rotatedVB = turf.transformRotate(virtualBorder, -orientation, { pivot: center });
        const bbox = turf.bbox(rotatedVB);

        const pStart = [bbox[0], bbox[1]];
        const pNext = turf.destination(turf.point(pStart), pathDistance, 0, { units: 'meters' }).geometry.coordinates;
        const latSpacing = Math.abs(pNext[1] - pStart[1]);

        let currentY = bbox[1] + latSpacing / 2;
        let rows = [];

        while (currentY < bbox[3]) {
            const line = turf.lineString([[bbox[0] - 0.01, currentY], [bbox[2] + 0.01, currentY]]);
            const intersects = turf.lineIntersect(line, rotatedVB);

            if (intersects.features.length >= 2) {
                let pts = intersects.features.map(f => f.geometry.coordinates);
                pts.sort((a, b) => a[0] - b[0]);

                let rowSegments = [];
                for (let j = 0; j < pts.length - 1; j++) {
                    let p1 = pts[j];
                    let p2 = pts[j + 1];
                    let mid = turf.midpoint(p1, p2);
                    if (turf.booleanPointInPolygon(mid, rotatedVB)) {
                        rowSegments.push([p1, p2]);
                    }
                }
                if (rowSegments.length > 0) {
                    rows.push(rowSegments);
                }
            }
            currentY += latSpacing;
        }

        if (rows.length === 0) return [];

        let rotatedPath = [];
        rows.forEach((row, i) => {
            const isForward = (i % 2 === 0);
            const segments = isForward ? row : [...row].reverse();

            segments.forEach(seg => {
                const p1 = isForward ? seg[0] : seg[1];
                const p2 = isForward ? seg[1] : seg[0];

                if (rotatedPath.length > 0) {
                    const prev = rotatedPath[rotatedPath.length - 1];
                    let connection = this.getBorderPath(prev, p1, rotatedVB);
                    connection.forEach(p => {
                        if (turf.distance(rotatedPath[rotatedPath.length - 1], p, { units: 'meters' }) > 0.1) {
                            rotatedPath.push(p);
                        }
                    });
                }

                if (rotatedPath.length === 0 || turf.distance(rotatedPath[rotatedPath.length - 1], p1, { units: 'meters' }) > 0.1) {
                    rotatedPath.push(p1);
                }
                if (turf.distance(rotatedPath[rotatedPath.length - 1], p2, { units: 'meters' }) > 0.1) {
                    rotatedPath.push(p2);
                }
            });
        });

        const pathLine = turf.lineString(rotatedPath);
        const unrotatedPath = turf.transformRotate(pathLine, orientation, { pivot: center });
        return unrotatedPath.geometry.coordinates;
    }

    calculateIntelligentPath(virtualBorder, pathDistance, minPointDist) {
        let results = [];
        let minDistance = Infinity;

        // Sample orientations from 0 to 175 degrees in steps of 5
        for (let angle = 0; angle < 180; angle += 5) {
            let points = this.calculateZigzagPoints(virtualBorder, angle, pathDistance);
            if (points.length === 0) continue;

            points = this.simplifyPath(points, minPointDist, virtualBorder);

            let totalDist = 0;
            for (let i = 0; i < points.length - 1; i++) {
                totalDist += turf.distance(points[i], points[i+1], { units: 'meters' });
            }

            if (totalDist < minDistance) minDistance = totalDist;

            results.push({
                orientation: angle,
                points: points,
                distance: totalDist,
                pointCount: points.length
            });
        }

        if (results.length === 0) return { points: [], orientation: 0 };

        // Threshold is 10% more than minDistance
        const threshold = minDistance * 1.1;

        // Filter results that are within 10% of minDistance
        const candidates = results.filter(r => r.distance <= threshold);

        // Sort candidates by point count (ascending)
        candidates.sort((a, b) => a.pointCount - b.pointCount);

        return {
            points: candidates[0].points,
            orientation: candidates[0].orientation
        };
    }

    calculateOptimalOrientation(polygon) {
        const hull = turf.convex(polygon);
        if (!hull) return 0;
        let maxDist = 0;
        let bestAngle = 0;
        const coords = hull.geometry.coordinates[0];
        for (let i = 0; i < coords.length - 1; i++) {
            const d = turf.distance(coords[i], coords[i+1]);
            if (d > maxDist) {
                maxDist = d;
                bestAngle = turf.bearing(coords[i], coords[i+1]);
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

        const defaultHeight = parseFloat(document.getElementById('fp-height').value) || 15;
        const latlngs = this.currentFlightPath.getLatLngs();
        const terrainFollowing = this.terrainFollowingCheckbox.checked;
        const altitudeMode = terrainFollowing ? 'absolute' : 'relativeToGround';
        const coords = latlngs.map(ll => {
            const h = (terrainFollowing && ll.alt !== undefined) ? ll.alt : defaultHeight;
            return `${ll.lng},${ll.lat},${h}`;
        }).join(' ');

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
        <altitudeMode>${altitudeMode}</altitudeMode>
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

    async exportFlightPlanKMZ() {
        if (!this.currentFlightPath) return;

        const id = document.getElementById('fp-field-id').value;
        const field = this.fields.find(f => String(f.id) === String(id));
        const name = (field ? field.name : 'Flugplan');

        const droneEnumValue = document.getElementById('fp-drone-info').value;
        const finishAction = document.getElementById('fp-finish-action').value;
        const exitOnRCLost = document.getElementById('fp-rc-lost-action').value;
        const executeRCLostAction = document.getElementById('fp-execute-rc-lost-action').value;
        const flyToWaylineMode = document.getElementById('fp-fly-to-wayline-mode').value;
        const takeOffSecurityHeight = document.getElementById('fp-takeoff-security-height').value;
        const waypointTurnMode = document.getElementById('fp-waypoint-turn-mode').value;
        const waypointHeadingMode = document.getElementById('fp-waypoint-heading-mode').value;

        const speed = parseFloat(document.getElementById('fp-speed').value) || 12;
        const globalHeight = parseFloat(document.getElementById('fp-height').value) || 15;

        const terrainFollowing = this.terrainFollowingCheckbox.checked;
        const heightMode = terrainFollowing ? document.getElementById('fp-height-mode').value : 'relativeToStartPoint';

        const latlngs = this.currentFlightPath.getLatLngs();
        const createTime = Date.now();
        const updateTime = createTime;

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

        let placemarks = '';
        latlngs.forEach((ll, idx) => {
            const h = (ll.alt !== undefined) ? ll.alt.toFixed(2) : globalHeight.toFixed(2);
            placemarks += `
      <Placemark>
        <Point>
          <coordinates>${ll.lng},${ll.lat}</coordinates>
        </Point>
        <wpml:index>${idx}</wpml:index>
        <wpml:useGlobalHeight>0</wpml:useGlobalHeight>
        <wpml:ellipsoidHeight>${h}</wpml:ellipsoidHeight>
        <wpml:height>${h}</wpml:height>
        <wpml:waypointSpeed>${speed}</wpml:waypointSpeed>
        <wpml:useGlobalSpeed>0</wpml:useGlobalSpeed>
        <wpml:useStraightLine>1</wpml:useStraightLine>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
          <wpml:waypointTurnMode>${waypointTurnMode}</wpml:waypointTurnMode>
        </wpml:waypointTurnParam>
        <wpml:waypointHeadingParam>
          <wpml:useGlobalHeadingParam>0</wpml:useGlobalHeadingParam>
          <wpml:waypointHeadingMode>${waypointHeadingMode}</wpml:waypointHeadingMode>
          <wpml:waypointHeadingYawPathMode>followBadArc</wpml:waypointHeadingYawPathMode>
        </wpml:waypointHeadingParam>
      </Placemark>`;
        });

        const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
  <Document>
    <wpml:author>UAV</wpml:author>
    <wpml:createTime>${createTime}</wpml:createTime>
    <wpml:updateTime>${updateTime}</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:droneInfo>
        <wpml:droneEnumValue>${droneEnumValue}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
      <wpml:finishAction>${finishAction}</wpml:finishAction>
      <wpml:exitOnRCLost>${exitOnRCLost}</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>${executeRCLostAction}</wpml:executeRCLostAction>
      <wpml:flyToWaylineMode>${flyToWaylineMode}</wpml:flyToWaylineMode>
      <wpml:takeOffSecurityHeight>${takeOffSecurityHeight}</wpml:takeOffSecurityHeight>
      <wpml:globalTransitionalSpeed>${speed}</wpml:globalTransitionalSpeed>
    </wpml:missionConfig>
    <Folder>
      <wpml:globalHeight>${globalHeight}</wpml:globalHeight>
      <wpml:caliFlightEnable>0</wpml:caliFlightEnable>
      <wpml:autoFlightSpeed>${speed}</wpml:autoFlightSpeed>
      <wpml:globalWaypointHeadingParam>
        <wpml:waypointHeadingMode>${waypointHeadingMode}</wpml:waypointHeadingMode>
      </wpml:globalWaypointHeadingParam>
      <wpml:globalWaypointTurnMode>${waypointTurnMode}</wpml:globalWaypointTurnMode>
      <wpml:globalUseStraightLine>1</wpml:globalUseStraightLine>
      <wpml:waylineCoordinateSysParam>
        <wpml:coordinateMode>WGS84</wpml:coordinateMode>
        <wpml:heightMode>${heightMode}</wpml:heightMode>
        <wpml:positioningType>GPS</wpml:positioningType>
      </wpml:waylineCoordinateSysParam>
      <wpml:gimbalPitchMode>manual</wpml:gimbalPitchMode>
      <wpml:templateType>waypoint</wpml:templateType>
      <wpml:templateId>0</wpml:templateId>
      ${placemarks}
    </Folder>
  </Document>
</kml>`;

        try {
            const zip = new JSZip();
            const wpmz = zip.folder("wpmz");
            wpmz.file("template.kml", kmlContent);

            const content = await zip.generateAsync({type:"blob"});
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${name}.kmz`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert("Fehler bei der KMZ-Erstellung: " + err.message);
        }
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

        const fileMap = {};
        for (let i = 0; i < files.length; i++) {
            const ext = files[i].name.split('.').pop().toLowerCase();
            fileMap[ext] = files[i];
        }

        if (fileMap['shp']) {
            try {
                const shpBuffer = await fileMap['shp'].arrayBuffer();
                const dbfBuffer = fileMap['dbf'] ? await fileMap['dbf'].arrayBuffer() : null;
                const shxBuffer = fileMap['shx'] ? await fileMap['shx'].arrayBuffer() : null;

                const shpObj = shp.parseShp(shpBuffer, shxBuffer);
                const dbfObj = dbfBuffer ? shp.parseDbf(dbfBuffer) : null;
                const geoJson = await shp.combine([shpObj, dbfObj]);

                this.addImportedGeoJson(geoJson);
            } catch (err) {
                console.error(err);
                alert('Fehler beim Verarbeiten der SHP-Datei: ' + err.message);
            }
            return;
        }

        const file = files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const extension = file.name.split('.').pop().toLowerCase();
                if (extension === 'zip') {
                    const geoJson = await shp(e.target.result);
                    this.addImportedGeoJson(geoJson);
                } else if (extension === 'kml') {
                    const kmlLayer = omnivore.kml.parse(e.target.result);
                    this.addImportedGeoJson(kmlLayer.toGeoJSON());
                } else if (extension === 'xml') {
                    this.parseISOXML(e.target.result);
                } else {
                    alert('Nicht unterstütztes Dateiformat.');
                }
            } catch (err) {
                console.error(err);
                alert('Fehler beim Verarbeiten der Datei: ' + err.message);
            }
        };

        if (file.name.endsWith('.zip')) reader.readAsArrayBuffer(file);
        else reader.readAsText(file);
    }

    parseISOXML(xmlString) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "text/xml");
            const partfields = xmlDoc.getElementsByTagName("PFD");

            for (let i = 0; i < partfields.length; i++) {
                const pfd = partfields[i];
                const name = pfd.getAttribute("C") || `Schlag ${this.fields.length + 1}`;
                const polygons = pfd.getElementsByTagName("PLN");

                for (let j = 0; j < polygons.length; j++) {
                    const pln = polygons[j];
                    const points = pln.getElementsByTagName("PNT");
                    const latlngs = [];

                    for (let k = 0; k < points.length; k++) {
                        const pnt = points[k];
                        const lat = parseFloat(pnt.getAttribute("A"));
                        const lng = parseFloat(pnt.getAttribute("B"));
                        if (!isNaN(lat) && !isNaN(lng)) latlngs.push([lat, lng]);
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
        }
    }

    addImportedGeoJson(geoJson) {
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
                alert('Antrag erfolgreich abgesendet!');
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
