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

        this.modal = document.getElementById('flightplan-modal');
        this.closeModal = document.getElementById('close-modal');
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

        this.closeModal.addEventListener('click', () => {
            this.modal.classList.add('hidden');
        });

        this.btnGenerateFP.addEventListener('click', () => {
            this.generateFlightPlan();
        });

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
                    <button onclick="app.openFlightPlanModal('${field.id}')" class="btn secondary">Flugplan</button>
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

    openFlightPlanModal(id) {
        const prevId = document.getElementById('fp-field-id').value;
        document.getElementById('fp-field-id').value = id;
        this.modal.classList.remove('hidden');
        this.zoomToField(id);

        if (prevId !== id) {
            // Reset stats and export button for new field
            document.getElementById('fp-stats').classList.add('hidden');
            this.btnExportFPKML.classList.add('hidden');
            this.btnReverseFP.classList.add('hidden');

            if (this.currentFlightPath) {
                this.mapManager.drawnItems.removeLayer(this.currentFlightPath);
                this.currentFlightPath = null;
            }
        } else if (this.currentFlightPath) {
            // Same field, show stats and export button if path exists
            document.getElementById('fp-stats').classList.remove('hidden');
            this.btnExportFPKML.classList.remove('hidden');
            this.btnReverseFP.classList.remove('hidden');
            const speed = parseFloat(document.getElementById('fp-speed').value) || 10;
            this.updateFPStats(speed);
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

        const geoJson = JSON.parse(field.geometry);
        let turfPoly = turf.polygon(geoJson.coordinates);

        // 1. Buffer inward
        let buffered = turf.buffer(turfPoly, -borderDistance, { units: 'meters' });
        if (!buffered || (buffered.type === 'Feature' && (!buffered.geometry || buffered.geometry.coordinates.length === 0)) || (buffered.type === 'FeatureCollection' && buffered.features.length === 0)) {
            alert('Abstand zum Rand ist zu groß für diesen Schlag.');
            return;
        }

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
        const numLines = Math.ceil(diag / pathDistance) + 2;
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
        gridLines.forEach((line) => {
            const intersect = turf.lineIntersect(line, buffered);
            if (intersect.features.length >= 2) {
                let coords = intersect.features.map(f => f.geometry.coordinates);
                const refPoint = line.geometry.coordinates[0];
                coords.sort((a, b) => turf.distance(refPoint, a) - turf.distance(refPoint, b));

                let segmentsOnLine = [];
                for (let j = 0; j < coords.length - 1; j++) {
                    let p1 = coords[j];
                    let p2 = coords[j+1];
                    let midpoint = turf.midpoint(p1, p2);
                    if (turf.booleanPointInPolygon(midpoint, buffered)) {
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
        let pathPoints = [];
        lineSegments.forEach((segments, i) => {
            const isForward = (i % 2 === 0);
            const orderedSegments = isForward ? segments : [...segments].reverse();

            orderedSegments.forEach((seg) => {
                const p1 = isForward ? seg[0] : seg[1];
                const p2 = isForward ? seg[1] : seg[0];

                if (pathPoints.length > 0) {
                    const prev = pathPoints[pathPoints.length - 1];
                    const connection = turf.lineString([prev, p1]);
                    // Check if connection is inside.
                    if (!turf.booleanWithin(connection, buffered)) {
                        const borderPath = this.getBorderPath(prev, p1, buffered);
                        borderPath.forEach(p => {
                            if (turf.distance(pathPoints[pathPoints.length - 1], p) > 0.00001) {
                                pathPoints.push(p);
                            }
                        });
                    }
                }

                if (pathPoints.length === 0 || turf.distance(pathPoints[pathPoints.length - 1], p1) > 0.00001) {
                    pathPoints.push(p1);
                }
                if (turf.distance(pathPoints[pathPoints.length - 1], p2) > 0.00001) {
                    pathPoints.push(p2);
                }
            });
        });

        if (pathPoints.length < 2) {
            alert('Konnte keinen Flugplan generieren. Prüfen Sie die Parameter.');
            return;
        }

        // 6. Display path
        if (this.currentFlightPath) {
            this.mapManager.drawnItems.removeLayer(this.currentFlightPath);
        }

        const latlngs = pathPoints.map(p => [p[1], p[0]]);
        this.currentFlightPath = L.polyline(latlngs, { color: 'red', weight: 3 });

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
        // Stats don't change, but we could trigger an update if needed
    }

    getBorderPath(p1, p2, polygon) {
        try {
            const boundary = turf.polygonToLine(polygon);
            const lines = (boundary.type === 'FeatureCollection') ? boundary.features : [boundary];

            let bestPath = [p2];
            let minDist = Infinity;

            lines.forEach(lineFeature => {
                const line = lineFeature.geometry || lineFeature;
                const pt1 = turf.nearestPointOnLine(line, p1);
                const pt2 = turf.nearestPointOnLine(line, p2);

                if (pt1.properties.dist < 1 && pt2.properties.dist < 1) {
                    const sliced = turf.lineSlice(pt1, pt2, line);
                    const coords = sliced.geometry.coordinates;
                    const dist = turf.length(sliced);
                    if (dist < minDist) {
                        minDist = dist;
                        bestPath = coords;
                    }
                }
            });
            return bestPath;
        } catch (e) {
            return [p2];
        }
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

        const latlngs = this.currentFlightPath.getLatLngs();
        const coords = latlngs.map(ll => `${ll.lng},${ll.lat},0`).join(' ');

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
