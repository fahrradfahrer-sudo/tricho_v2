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

        this.fields = []; // Local storage for fields data

        this.initMap();
        this.attachEventListeners();
    }

    initMap() {
        this.mapManager = new MapManager('map');

        this.mapManager.onFieldAdded = (layer, name) => {
            const field = {
                id: L.stamp(layer),
                name: name || `Field ${this.fields.length + 1}`,
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
            this.handleImport(e.target.files[0]);
        });
    }

    validateStep1() {
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        if (!name || !email) {
            alert('Please fill in name and email.');
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
            }, 100);
        }
    }

    updateFieldList() {
        this.fieldList.innerHTML = '';
        if (this.fields.length === 0) {
            this.fieldList.innerHTML = '<p>No fields added yet.</p>';
            return;
        }

        this.fields.forEach(field => {
            const div = document.createElement('div');
            div.className = 'field-item';
            div.innerHTML = `
                <h4>${field.name}</h4>
                <p>Area: ${field.area.toFixed(2)} Ha</p>
                <div class="actions">
                    <button onclick="app.editFieldName('${field.id}')" class="btn secondary">Rename</button>
                    <button onclick="app.deleteField('${field.id}')" class="btn">Delete</button>
                </div>
            `;
            this.fieldList.appendChild(div);
        });
    }

    editFieldName(id) {
        const field = this.fields.find(f => String(f.id) === String(id));
        if (field) {
            const newName = prompt('Enter new field name:', field.name);
            if (newName) {
                field.name = newName;
                this.updateFieldList();
            }
        }
    }

    deleteField(id) {
        if (!confirm('Are you sure you want to delete this field?')) return;
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

    async handleImport(file) {
        if (!file) return;

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
                    // Use omnivore.kml.parse from global scope if available
                    const kmlLayer = omnivore.kml.parse(e.target.result);
                    this.addImportedGeoJson(kmlLayer.toGeoJSON());
                } else {
                    alert('Unsupported file format. Please use .zip (for SHP) or .kml.');
                }
            } catch (err) {
                console.error(err);
                alert('Error processing file: ' + err.message);
            }
        };

        if (file.name.endsWith('.zip')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
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
            if (!confirm('No fields added. Do you want to submit anyway?')) return;
        }

        const formData = new FormData();
        formData.append('customer_name', document.getElementById('name').value);
        formData.append('customer_email', document.getElementById('email').value);
        formData.append('customer_phone', document.getElementById('phone').value);

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
                alert('Application submitted successfully! Customer ID: ' + result.customerId);
                location.reload();
            } else {
                alert('Error: ' + result.message);
            }
        } catch (err) {
            console.error(err);
            alert('An error occurred while submitting.');
        }
    }
}

const app = new App();
window.app = app;
