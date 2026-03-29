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

        this.fields = []; // Local storage for fields data

        this.initMap();
        this.attachEventListeners();
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

            // Center map based on Step 1 postal code
            const postalCode = document.getElementById('postal_code').value;
            this.mapManager.centerMapByPostalCode(postalCode);

            // Force map resize
            setTimeout(() => {
                this.mapManager.map.invalidateSize();
            }, 100);
        }
    }

    updateFieldList() {
        this.fieldList.innerHTML = '';
        if (this.fields.length === 0) {
            this.fieldList.innerHTML = '<p>Noch keine Schläge hinzugefügt.</p>';
            return;
        }

        this.fields.forEach(field => {
            const div = document.createElement('div');
            div.className = 'field-item';
            div.innerHTML = `
                <h4>${field.name}</h4>
                <p>Fläche: ${field.area.toFixed(2)} Ha</p>
                <div class="actions">
                    <button onclick="app.editFieldName('${field.id}')" class="btn secondary">Umbenennen</button>
                    <button onclick="app.deleteField('${field.id}')" class="btn">Löschen</button>
                </div>
            `;
            this.fieldList.appendChild(div);
        });
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
