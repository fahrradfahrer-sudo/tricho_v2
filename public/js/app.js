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

        this.authMode = 'login'; // 'login' or 'register'
        this.currentUser = null;

        this.fpSidebar = document.getElementById('flightplan-sidebar');
        this.closeFPSidebar = document.getElementById('close-fp-sidebar');
        this.btnGenerateFP = document.getElementById('btn-generate-fp');
        this.btnManualSplit = document.getElementById('btn-manual-split');
        this.btnReverseFP = document.getElementById('btn-reverse-fp');
        this.btnExportFPKML = document.getElementById('btn-export-fp-kml');
        this.btnExportFPKMZ = document.getElementById('btn-export-fp-kmz');
        this.terrainFollowingCheckbox = document.getElementById('fp-terrain-following');
        this.showWPHeightCheckbox = document.getElementById('fp-show-wp-height');
        this.editWaypointsCheckbox = document.getElementById('fp-edit-waypoints');

        this.waypointTableBody = document.querySelector('#waypoint-table tbody');
        this.waypointTableContainer = document.getElementById('waypoint-table-container');

        this.fields = []; // Local storage for fields data
        this.history = []; // History for undo
        this.currentFlightPath = null;
        this.fpUpdateTimeout = null;
        this.isTakeoffHeightManuallySet = false;
        this.currentCustomerId = null;
        this.colors = ['red', 'blue', 'green', 'orange', 'purple', 'cyan'];
        this.manualSplitMode = false;
        this.manualSplitLine = null;
        this.splitMarkers = [];

        this.initMap();
        this.initModeToggle();
        this.attachEventListeners();
        this.updateFieldList();
        this.checkSession();
        this.initNotifications();
    }

    colorToHex(color) {
        const colors = {
            'red': '#ff0000',
            'blue': '#0000ff',
            'green': '#008000',
            'orange': '#ffa500',
            'purple': '#800080',
            'cyan': '#00ffff'
        };
        return colors[color] || color;
    }

    interpolateColor(color1, color2, factor = 0.5) {
        const hex = (x) => {
            const h = Math.round(x).toString(16);
            return h.length === 1 ? '0' + h : h;
        };

        const r1 = parseInt(this.colorToHex(color1).substring(1, 3), 16);
        const g1 = parseInt(this.colorToHex(color1).substring(3, 5), 16);
        const b1 = parseInt(this.colorToHex(color1).substring(5, 7), 16);

        const r2 = parseInt(this.colorToHex(color2).substring(1, 3), 16);
        const g2 = parseInt(this.colorToHex(color2).substring(3, 5), 16);
        const b2 = parseInt(this.colorToHex(color2).substring(5, 7), 16);

        const r = r1 + factor * (r2 - r1);
        const g = g1 + factor * (g2 - g1);
        const b = b1 + factor * (b2 - b1);

        return `#${hex(r)}${hex(g)}${hex(b)}`;
    }

    initNotifications() {
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.className = 'notification-container';
        document.body.appendChild(this.notificationContainer);
    }

    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const text = document.createElement('span');
        text.textContent = message;
        notification.appendChild(text);

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.className = 'notification-ok';
        okBtn.onclick = () => {
            notification.remove();
        };
        notification.appendChild(okBtn);

        this.notificationContainer.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.add('fade-out');
                notification.addEventListener('animationend', () => {
                    notification.remove();
                });
            }
        }, duration);
    }

    initModeToggle() {
        this.modeSwitch = document.getElementById('mode-switch');
        this.modeLabel = document.getElementById('mode-label');

        // Load preference - default to admin if not set
        const savedMode = localStorage.getItem('appMode') || 'admin';
        this.isAdminMode = (savedMode === 'admin');

        this.modeSwitch.checked = this.isAdminMode;
        // this.updateModeUI(); // Removed here, will be called by updateUserUI/checkSession

        this.modeSwitch.addEventListener('change', () => {
            this.isAdminMode = this.modeSwitch.checked;
            localStorage.setItem('appMode', this.isAdminMode ? 'admin' : 'benutzer');
            this.updateModeUI();
        });
    }


    updateModeUI() {
        const adminToggleContainer = document.getElementById('admin-toggle-container');
        if (this.currentUser && (this.currentUser.email === 'mwitt3d@gmail.com' || this.currentUser.email === 'feldanmeldung@gmail.com')) {
            if (adminToggleContainer) adminToggleContainer.classList.remove('hidden');
            // Check if we just logged in (sessionStorage flag)
            const justLoggedIn = sessionStorage.getItem('justLoggedIn');
            if (justLoggedIn) {
                this.isAdminMode = true;
                localStorage.setItem('appMode', 'admin');
                sessionStorage.removeItem('justLoggedIn');
            } else {
                // Use the value from localStorage or default to admin
                const savedMode = localStorage.getItem('appMode') || 'admin';
                this.isAdminMode = (savedMode === 'admin');
            }
            if (this.modeSwitch) this.modeSwitch.checked = this.isAdminMode;
        } else {
            if (adminToggleContainer) adminToggleContainer.classList.add('hidden');
            this.isAdminMode = false;
            if (this.modeSwitch) this.modeSwitch.checked = false;
        }

        if (this.modeLabel) {
            this.modeLabel.textContent = this.isAdminMode ? 'Admin-Modus' : 'Benutzer-Modus';
        }

        // Elements to hide/show
        const adminElements = [
            document.getElementById('kundenverwaltung-heading'),
            document.querySelector('.customer-tools'),
            document.querySelector('.customer-tools + hr'),
            document.getElementById('customer-data-section'),
            document.getElementById('customer-data-hr')
        ];

        adminElements.forEach(el => {
            if (el) {
                if (this.isAdminMode) {
                    // Only show section if we actually have a customer selected
                    if (el.id === 'customer-data-section' || el.id === 'customer-data-hr') {
                        if (this.currentCustomerId) el.classList.remove('hidden');
                    } else {
                        el.classList.remove('hidden');
                    }
                } else {
                    el.classList.add('hidden');
                }
            }
        });

        this.updateFieldList();
        this.updateFlightPlanVisibility();

        // Close flightplan sidebar if entering Benutzer mode
        if (!this.isAdminMode && !this.fpSidebar.classList.contains('hidden')) {
            this.closeFPSidebar.click();
        }
    }

    updateFlightPlanVisibility() {
        if (this.isAdminMode) {
            // In Admin mode, always show the current flight path and markers
            if (this.currentFlightPath && !this.mapManager.drawnItems.hasLayer(this.currentFlightPath)) {
                this.mapManager.drawnItems.addLayer(this.currentFlightPath);
            }
            if (!this.mapManager.map.hasLayer(this.wpLayerGroup)) {
                this.wpLayerGroup.addTo(this.mapManager.map);
            }
        } else {
            // In Benutzer mode, hide current flight path and markers
            if (this.currentFlightPath && this.mapManager.drawnItems.hasLayer(this.currentFlightPath)) {
                this.mapManager.drawnItems.removeLayer(this.currentFlightPath);
            }
            if (this.mapManager.map.hasLayer(this.wpLayerGroup)) {
                this.mapManager.map.removeLayer(this.wpLayerGroup);
            }
        }
    }

    initMap() {
        this.mapManager = new MapManager('map');
        this.wpLayerGroup = L.layerGroup().addTo(this.mapManager.map);

        this.mapManager.map.on('zoomend', () => {
            this.updateWaypointMarkers();
        });

        this.mapManager.onFieldAdded = (layer, name) => {
            this.saveHistory();
            let geojson = layer.toGeoJSON();
            // Strip Z-coordinates
            if (geojson.geometry && geojson.geometry.coordinates) {
                const strip = (c) => (typeof c[0] === 'number') ? [c[0], c[1]] : c.map(strip);
                geojson.geometry.coordinates = strip(geojson.geometry.coordinates);
            }
            const field = {
                id: L.stamp(layer),
                name: name || `Schlag ${this.fields.length + 1}`,
                geometry: JSON.stringify(geojson.geometry),
                area: L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]) / 10000, // In Hectares (Ha)
                // Default FP parameters
                fp_path_distance: 10,
                fp_border_distance: 5,
                fp_min_dist: 5,
                fp_orientation: 0,
                fp_speed: 10,
                fp_height: 15,
                fp_mode: 'zigzag',
                fp_clip_corners: 1,
                fp_terrain_following: 0,
                fp_show_wp_height: 0,
                fp_height_mode: 'relativeToStartPoint',
                fp_drone_info: '60',
                fp_payload_info: 'none',
                fp_finish_action: 'goHome',
                fp_rc_lost_action: 'executeLostAction',
                fp_execute_rc_lost_action: 'goBack',
                fp_fly_to_wayline_mode: 'safely',
                fp_takeoff_security_height: 15,
                fp_waypoint_turn_mode: 'coordinateTurn',
                fp_waypoint_heading_mode: 'followWayline'
            };
            this.fields.push(field);
            this.updateFieldList();
        };

        this.mapManager.onFieldDeleted = (layer) => {
            this.saveHistory();
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

            this.saveHistory();
            const field = this.fields.find(f => f.id === id);
            if (field) {
                field.geometry = JSON.stringify(layer.toGeoJSON().geometry);
                field.area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]) / 10000;
                this.updateFieldList();
            }
        };
    }

    attachEventListeners() {
        document.getElementById('btn-show-login').addEventListener('click', () => this.switchAuthMode('login'));
        document.getElementById('btn-show-register').addEventListener('click', () => this.switchAuthMode('register'));
        document.getElementById('btn-auth-submit').addEventListener('click', () => this.handleAuthSubmit());
        document.getElementById('link-logout').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
        document.getElementById('link-change-data').addEventListener('click', (e) => {
            e.preventDefault();
            this.switchStep(1);
        });
        document.getElementById('link-forgot-password').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleForgotPassword();
        });

        const userDropdown = document.querySelector('.user-dropdown');
        if (userDropdown) {
            userDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('active');
            });
        }

        document.addEventListener('click', () => {
            if (userDropdown) userDropdown.classList.remove('active');
        });

        this.btnNextStep.addEventListener('click', () => {
            if (this.currentUser) return; // Handled by onclick override in updateStep1Button
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

        document.getElementById('btn-undo').addEventListener('click', () => {
            this.undo();
        });

        // Customer Management Listeners
        document.getElementById('btn-load-customer').addEventListener('click', () => {
            const id = document.getElementById('customer-select').value;
            if (id === 'all') {
                this.loadAllCustomers();
            } else if (id) {
                this.loadCustomerData(id);
            }
        });

        document.getElementById('btn-delete-customer').addEventListener('click', () => {
            const id = document.getElementById('customer-select').value;
            if (id) this.deleteCustomer(id);
        });

        document.getElementById('btn-new-customer').addEventListener('click', () => {
            this.resetToNewCustomer();
        });

        document.getElementById('btn-draw-field').addEventListener('click', () => {
            // Find the Leaflet Draw polygon handler and enable it
            const drawControl = this.mapManager.map._toolbars.draw;
            if (drawControl) {
                const polygonHandler = drawControl._modes.polygon.handler;
                if (polygonHandler) {
                    polygonHandler.enable();
                }
            }
        });

        this.importFileInput.addEventListener('change', (e) => {
            this.handleImport(e.target.files);
        });

        this.btnSearchPlz.addEventListener('click', () => {
            this.mapManager.centerMapByPostalCode(this.searchPlzInput.value);
        });

        this.closeFPSidebar.addEventListener('click', () => {
            this.fpSidebar.classList.add('hidden');
            document.getElementById('right-resizer').classList.add('hidden');
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
        this.initSidebarLogic();

        // Check for instructional arrow on load
        this.checkShowDrawArrow();

        document.getElementById('toggle-customer-data').addEventListener('click', () => {
            const section = document.getElementById('customer-data-section');
            section.classList.toggle('collapsed');
        });

        this.btnExportFPKML.addEventListener('click', () => {
            this.exportFlightPlanKML();
        });

        this.btnExportFPKMZ.addEventListener('click', () => {
            this.exportFlightPlanKMZ();
        });

        this.btnReverseFP.addEventListener('click', () => {
            this.reverseFlightPlan();
        });

        this.btnManualSplit.addEventListener('click', () => {
            this.toggleManualSplit();
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
            this.showNotification('Bitte füllen Sie Nachname und E-Mail aus.');
            return false;
        }

        if (!this.currentUser) {
            const password = document.getElementById('password').value;
            const passwordConfirm = document.getElementById('password_confirm').value;

            if (this.authMode === 'register' && password !== passwordConfirm) {
                this.showNotification('Passwörter stimmen nicht überein.', 'error');
                return false;
            }

            if (!dsgvo) {
                this.showNotification('Bitte akzeptieren Sie die Datenschutzbestimmungen (DSGVO).');
                return false;
            }
        }

        return true;
    }

    switchStep(step) {
        if (step === 2) {
            this.refreshCustomerList();
            this.mirrorStep1ToStep2();
        }
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

                this.checkShowDrawArrow();
            }, 100);
        }
    }

    checkShowDrawArrow() {
        const hasSeenArrow = localStorage.getItem('hasSeenDrawArrow');
        if (!hasSeenArrow) {
            const drawBtn = document.querySelector('.leaflet-draw-draw-polygon');
            if (drawBtn) {
                const rect = drawBtn.getBoundingClientRect();
                const arrow = document.createElement('div');
                arrow.className = 'draw-arrow';
                arrow.innerHTML = '←'; // Left arrow
                arrow.style.top = (rect.top + rect.height / 2 - 20) + 'px';
                arrow.style.left = (rect.right + 15) + 'px';
                document.body.appendChild(arrow);

                // Add a text tip next to the arrow
                const tip = document.createElement('div');
                tip.className = 'draw-tip';
                tip.textContent = 'Hier Schlag zeichnen';
                tip.style.position = 'absolute';
                tip.style.top = (rect.top + rect.height / 2 - 10) + 'px';
                tip.style.left = (rect.right + 45) + 'px';
                tip.style.background = '#ffcc00';
                tip.style.padding = '5px 10px';
                tip.style.borderRadius = '5px';
                tip.style.fontWeight = 'bold';
                tip.style.zIndex = '2000';
                document.body.appendChild(tip);

                const removeArrow = () => {
                    arrow.remove();
                    tip.remove();
                    localStorage.setItem('hasSeenDrawArrow', 'true');
                    document.removeEventListener('mousedown', removeArrow);
                };

                document.addEventListener('mousedown', removeArrow);
                // Also remove if the draw button is clicked
                drawBtn.addEventListener('click', removeArrow);
            }
        }
    }

    switchAuthMode(mode) {
        this.authMode = mode;
        const btnLogin = document.getElementById('btn-show-login');
        const btnRegister = document.getElementById('btn-show-register');
        const registerOnly = document.querySelectorAll('.register-only');
        const loginOnly = document.querySelectorAll('.login-only');
        const btnAuthSubmit = document.getElementById('btn-auth-submit');
        const step1Title = document.getElementById('step-1-title');

        if (mode === 'login') {
            btnLogin.classList.add('active');
            btnRegister.classList.remove('active');
            registerOnly.forEach(el => el.classList.add('hidden'));
            loginOnly.forEach(el => el.classList.remove('hidden'));
            btnAuthSubmit.textContent = 'Anmelden';
            step1Title.textContent = 'Anmelden';
        } else {
            btnLogin.classList.remove('active');
            btnRegister.classList.add('active');
            registerOnly.forEach(el => el.classList.remove('hidden'));
            loginOnly.forEach(el => el.classList.add('hidden'));
            btnAuthSubmit.textContent = 'Registrieren';
            step1Title.textContent = 'Benutzerkonto erstellen';
        }
    }

    async handleForgotPassword() {
        const email = document.getElementById('email').value;
        if (!email) {
            this.showNotification('Bitte geben Sie Ihre E-Mail-Adresse ein.', 'error');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('email', email);
            const response = await fetch('../api/forgot_password.php', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.success) {
                this.showNotification(result.message, 'success');
            } else {
                this.showNotification(result.message, 'error');
            }
        } catch (err) {
            console.error(err);
            this.showNotification('Fehler beim Senden der Anfrage.', 'error');
        }
    }

    async handleAuthSubmit() {
        const form = document.getElementById('customer-form');
        const formData = new FormData(form);

        if (this.authMode === 'register') {
            const password = document.getElementById('password').value;
            const passwordConfirm = document.getElementById('password_confirm').value;
            if (password !== passwordConfirm) {
                this.showNotification('Passwörter stimmen nicht überein.', 'error');
                return;
            }
        }

        const url = this.authMode === 'login' ? '../api/login.php' : '../api/register.php';

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (result.success) {
                this.showNotification(result.message, 'success');
                sessionStorage.setItem('justLoggedIn', 'true');
                await this.checkSession();
                if (this.currentCustomerId) {
                    await this.loadCustomerData(this.currentCustomerId);
                }
                this.switchStep(2);
                this.updateStep1Button();
            } else {
                this.showNotification(result.message, 'error');
            }
        } catch (err) {
            console.error(err);
            this.showNotification('Authentifizierung fehlgeschlagen.', 'error');
        }
    }

    async checkSession() {
        try {
            const response = await fetch('../api/check_session.php');
            const result = await response.json();

            if (result.logged_in) {
                this.currentUser = result.customer;
                this.currentCustomerId = this.currentUser.id;
                this.updateUserUI();
                // Automatically load user's fields
                if (this.currentCustomerId) {
                    await this.loadCustomerData(this.currentCustomerId);
                    this.switchStep(2);
                }
                this.updateStep1Button();
            } else {
                this.currentUser = null;
                this.currentCustomerId = null;
                this.updateUserUI();
            }
        } catch (err) {
            console.error('Session check failed', err);
        }
    }

    updateStep1Button() {
        const btnNextStep = document.getElementById('btn-next-step');
        if (this.currentUser) {
            btnNextStep.textContent = 'Speichern';
            btnNextStep.onclick = async () => {
                if (this.validateStep1()) {
                    await this.submitApplication();
                    this.switchStep(2);
                }
            };
        } else {
            btnNextStep.textContent = 'Nächster Schritt';
            btnNextStep.onclick = null; // Use original listener
        }
    }

    updateUserUI() {
        const userInfo = document.getElementById('user-info');
        const usernameDisplay = document.getElementById('username-display');
        const btnAuthSubmit = document.getElementById('btn-auth-submit');
        const btnNextStep = document.getElementById('btn-next-step');
        const authToggle = document.querySelector('.auth-toggle');

        if (this.currentUser) {
            if (userInfo) userInfo.classList.remove('hidden');
            if (usernameDisplay) {
                const username = this.currentUser.email ? this.currentUser.email.split('@')[0] : 'User';
                usernameDisplay.textContent = username;
            }

            // Fill Step 1 form (safely)
            const fields = {
                'first_name': this.currentUser.first_name,
                'name': this.currentUser.name,
                'company': this.currentUser.company,
                'street': this.currentUser.street,
                'house_number': this.currentUser.house_number,
                'postal_code': this.currentUser.postal_code,
                'city': this.currentUser.city,
                'email': this.currentUser.email,
                'phone': this.currentUser.phone,
                'comments': this.currentUser.comments
            };

            for (const [id, value] of Object.entries(fields)) {
                const el = document.getElementById(id);
                if (el) el.value = value || '';
            }

            const dsgvo = document.getElementById('dsgvo');
            if (dsgvo) dsgvo.checked = this.currentUser.dsgvo_accepted == 1;

            if (btnAuthSubmit) btnAuthSubmit.classList.add('hidden');
            if (btnNextStep) btnNextStep.classList.remove('hidden');
            if (authToggle) authToggle.classList.add('hidden');

            const step1Title = document.getElementById('step-1-title');
            if (step1Title) step1Title.textContent = 'Persönliche Daten';

            document.querySelectorAll('.register-only').forEach(el => el.classList.remove('hidden'));
        } else {
            if (userInfo) userInfo.classList.add('hidden');
            if (btnAuthSubmit) btnAuthSubmit.classList.remove('hidden');
            if (btnNextStep) btnNextStep.classList.add('hidden');
            if (authToggle) authToggle.classList.remove('hidden');
            this.switchAuthMode(this.authMode);
        }
        this.updateModeUI();
    }

    async handleFieldStatusChange(field, type, checked) {
        field[type] = checked ? 1 : 0;

        // Prepare data for submission
        const formData = new FormData();
        const cid = document.getElementById('cd-id').value || this.currentCustomerId;
        if (!cid || cid === 'all') {
            this.showNotification('Kunde konnte nicht identifiziert werden.', 'error');
            return;
        }

        formData.append('customer_id', cid);

        this.fields.forEach((f, index) => {
            formData.append(`fields[${index}][customer_id]`, cid);
            formData.append(`fields[${index}][name]`, f.name);
            formData.append(`fields[${index}][geometry]`, f.geometry);
            formData.append(`fields[${index}][area]`, f.area);
            formData.append(`fields[${index}][is_checked]`, f.is_checked || 0);
            formData.append(`fields[${index}][is_done]`, f.is_done || 0);
            if (f.flight_path) formData.append(`fields[${index}][flight_path]`, f.flight_path);

            // Append other necessary FP params to avoid losing them
            const fpParams = [
                'fp_path_distance', 'fp_border_distance', 'fp_min_dist', 'fp_orientation',
                'fp_speed', 'fp_height', 'fp_mode', 'fp_clip_corners', 'fp_terrain_following',
                'fp_show_wp_height', 'fp_height_mode', 'fp_drone_info', 'fp_payload_info', 'fp_finish_action',
                'fp_rc_lost_action', 'fp_execute_rc_lost_action', 'fp_fly_to_wayline_mode',
                'fp_takeoff_security_height', 'fp_waypoint_turn_mode', 'fp_waypoint_heading_mode'
            ];
            fpParams.forEach(param => {
                if (f[param] !== undefined && f[param] !== null) formData.append(`fields[${index}][${param}]`, f[param]);
            });
        });

        const isStep2 = !this.step2.classList.contains('hidden');
        const sourcePrefix = isStep2 ? 'cd-' : '';
        const email = document.getElementById(sourcePrefix + 'email').value;
        const name = document.getElementById(sourcePrefix + 'name').value;

        if (!email || !name) {
            this.showNotification('Kundendaten fehlen für Auto-Save.', 'error');
            return;
        }

        formData.append('customer_email', email);
        formData.append('customer_name', name);
        formData.append('customer_first_name', document.getElementById(sourcePrefix + 'first_name').value);
        formData.append('customer_company', document.getElementById(sourcePrefix + 'company').value);
        formData.append('customer_street', document.getElementById(sourcePrefix + 'street').value);
        formData.append('customer_house_number', document.getElementById(sourcePrefix + 'house_number').value);
        formData.append('customer_postal_code', document.getElementById(sourcePrefix + 'postal_code').value);
        formData.append('customer_city', document.getElementById(sourcePrefix + 'city').value);
        formData.append('customer_phone', document.getElementById(sourcePrefix + 'phone').value);
        formData.append('customer_comments', document.getElementById(sourcePrefix + 'comments').value);
        formData.append('customer_dsgvo_accepted', document.getElementById('dsgvo').checked ? 1 : 0);
        formData.append('website', ''); // Honeypot empty

        try {
            const response = await fetch('../api/submit_application.php', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.success) {
                this.showNotification('Status aktualisiert.', 'success', 2000);
            } else {
                this.showNotification('Fehler beim Aktualisieren: ' + result.message, 'error');
            }
        } catch (err) {
            console.error(err);
            this.showNotification('Verbindungsfehler beim Aktualisieren.', 'error');
        }
    }

    async logout() {
        try {
            await fetch('../api/logout.php');
            this.currentUser = null;
            this.currentCustomerId = null;
            this.updateUserUI();
            this.switchStep(1);
            // Clear map and fields
            this.mapManager.drawnItems.clearLayers();
            this.fields = [];
            this.updateFieldList();
        } catch (err) {
            console.error('Logout failed', err);
        }
    }

    updateActiveFieldParam(key, val) {
        const fieldId = document.getElementById('fp-field-id').value;
        const field = this.fields.find(f => String(f.id) === String(fieldId));
        if (field) {
            field[key] = val;
        }
    }

    initFPInputs() {
        const syncInput = (sliderId, inputId, valSpanId, paramKey, isOrientation = false) => {
            const slider = document.getElementById(sliderId);
            const input = document.getElementById(inputId);
            const valSpan = document.getElementById(valSpanId);

            const update = (val, source) => {
                if (source !== 'slider' && slider) slider.value = val;
                if (source !== 'input' && input) input.value = val;

                if (isOrientation && (val == 0 || val === "" || val === "0")) {
                    if (valSpan) valSpan.textContent = "Auto";
                    if (input) input.value = ""; // Empty for auto
                } else {
                    if (valSpan) valSpan.textContent = val;
                }
                this.updateActiveFieldParam(paramKey, val);
                this.scheduleFPUpdate();
            };

            if (slider) slider.addEventListener('input', (e) => update(e.target.value, 'slider'));
            if (input) input.addEventListener('change', (e) => update(e.target.value, 'input'));
        };

        syncInput('slider-fp-path-distance', 'fp-path-distance', 'val-fp-path-distance', 'fp_path_distance');
        syncInput('slider-fp-min-dist', 'fp-min-dist', 'val-fp-min-dist', 'fp_min_dist');
        syncInput('slider-fp-border-distance', 'fp-border-distance', 'val-fp-border-distance', 'fp_border_distance');
        syncInput('slider-fp-orientation', 'fp-orientation', 'val-fp-orientation', 'fp_orientation', true);
        syncInput('slider-fp-speed', 'fp-speed', 'val-fp-speed', 'fp_speed');

        // Custom sync for fp-height to also update takeoff height
        const heightSlider = document.getElementById('slider-fp-height');
        const heightInput = document.getElementById('fp-height');
        const heightValSpan = document.getElementById('val-fp-height');

        const updateHeight = (val, source) => {
            if (source !== 'slider' && heightSlider) heightSlider.value = val;
            if (source !== 'input' && heightInput) heightInput.value = val;
            if (heightValSpan) heightValSpan.textContent = val;

            this.updateActiveFieldParam('fp_height', val);

            // Automatically update takeoff security height if not manually set
            if (!this.isTakeoffHeightManuallySet) {
                const takeoffInput = document.getElementById('fp-takeoff-security-height');
                if (takeoffInput) {
                    takeoffInput.value = val;
                    this.updateActiveFieldParam('fp_takeoff_security_height', val);
                }
            }
            this.scheduleFPUpdate();
        };

        if (heightSlider) heightSlider.addEventListener('input', (e) => updateHeight(e.target.value, 'slider'));
        if (heightInput) heightInput.addEventListener('input', (e) => updateHeight(e.target.value, 'input'));

        document.getElementById('fp-mode').addEventListener('change', (e) => {
            this.updateActiveFieldParam('fp_mode', e.target.value);
            this.generateFlightPlan();
        });

        document.getElementById('fp-clip-corners').addEventListener('change', (e) => {
            this.updateActiveFieldParam('fp_clip_corners', e.target.checked ? 1 : 0);
            this.generateFlightPlan();
        });

        this.terrainFollowingCheckbox.addEventListener('change', (e) => {
            const heightModeContainer = document.getElementById('fp-height-mode-container');
            const heightModeSelect = document.getElementById('fp-height-mode');
            const checked = e.target.checked;
            this.updateActiveFieldParam('fp_terrain_following', checked ? 1 : 0);

            if (checked) {
                heightModeContainer.classList.remove('hidden');
                heightModeSelect.value = 'absolute';
                this.updateActiveFieldParam('fp_height_mode', 'absolute');
                this.showWPHeightCheckbox.disabled = false;
                this.showWPHeightCheckbox.checked = true;
                this.updateActiveFieldParam('fp_show_wp_height', 1);
            } else {
                heightModeContainer.classList.add('hidden');
                this.showWPHeightCheckbox.disabled = true;
                this.showWPHeightCheckbox.checked = false;
                this.updateActiveFieldParam('fp_show_wp_height', 0);
            }
            this.scheduleFPUpdate();
        });

        this.showWPHeightCheckbox.addEventListener('change', (e) => {
            this.updateActiveFieldParam('fp_show_wp_height', e.target.checked ? 1 : 0);
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

        const simpleDropdowns = [
            ['fp-height-mode', 'fp_height_mode'],
            ['fp-drone-info', 'fp_drone_info'],
            ['fp-payload-info', 'fp_payload_info'],
            ['fp-finish-action', 'fp_finish_action'],
            ['fp-rc-lost-action', 'fp_rc_lost_action'],
            ['fp-execute-rc-lost-action', 'fp_execute_rc_lost_action'],
            ['fp-fly-to-wayline-mode', 'fp_fly_to_wayline_mode'],
            ['fp-waypoint-turn-mode', 'fp_waypoint_turn_mode'],
            ['fp-waypoint-heading-mode', 'fp_waypoint_heading_mode']
        ];

        simpleDropdowns.forEach(([id, param]) => {
            document.getElementById(id).addEventListener('change', (e) => {
                this.updateActiveFieldParam(param, e.target.value);
            });
        });

        document.getElementById('fp-takeoff-security-height').addEventListener('change', (e) => {
            this.isTakeoffHeightManuallySet = true;
            this.updateActiveFieldParam('fp_takeoff_security_height', e.target.value);
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
                <div class="field-info-row">
                    <span class="field-name" title="${field.name}" data-field-id="${field.id}">${field.name}</span>
                    <span class="field-area">${field.area.toFixed(2)} ha</span>
                    <div class="field-status">
                        ${this.isAdminMode ? `
                            <input type="checkbox" class="status-checkbox checked-status" ${field.is_checked == 1 ? 'checked' : ''} title="Flugplan geprüft" data-field-id="${field.id}">
                        ` : ''}
                        <input type="checkbox" class="status-checkbox done-status" ${field.is_done == 1 ? 'checked' : ''} title="Erledigt" data-field-id="${field.id}" ${this.isAdminMode ? '' : 'disabled'}>
                    </div>
                </div>
                <div class="field-actions-row">
                    <button class="action-icon action-zoom" title="Zoom">🔍</button>
                    ${this.isAdminMode ? `
                        <button class="action-icon action-fp" title="Flugplan">✈️</button>
                        <button class="action-icon action-kml" title="KML">KML</button>
                    ` : ''}
                    <button class="action-icon action-rename" title="Umbenennen">✏️</button>
                    <button class="action-icon action-delete" title="Löschen">🗑️</button>
                </div>
            `;

            div.querySelector('.action-zoom').addEventListener('click', () => {
                this.zoomToField(field.id);
                if (this.currentCustomerId === 'all' && field.customer_id) {
                    const cust = this.allCustomersData.find(c => String(c.id) === String(field.customer_id));
                    if (cust) this.displayCustomerData(cust);
                }
            });

            if (this.isAdminMode) {
                div.querySelector('.action-fp').addEventListener('click', () => {
                    this.openFlightPlanSidebar(field.id);
                    if (this.currentCustomerId === 'all' && field.customer_id) {
                        const cust = this.allCustomersData.find(c => String(c.id) === String(field.customer_id));
                        if (cust) this.displayCustomerData(cust);
                    }
                });
                div.querySelector('.action-kml').addEventListener('click', () => this.exportFieldKML(field.id));
            }

            if (this.isAdminMode) {
                const checkedBox = div.querySelector('.checked-status');
                checkedBox.addEventListener('change', (e) => {
                    this.handleFieldStatusChange(field, 'is_checked', e.target.checked);
                });
            }

            const doneBox = div.querySelector('.done-status');
            doneBox.addEventListener('change', (e) => {
                if (this.isAdminMode) {
                    this.handleFieldStatusChange(field, 'is_done', e.target.checked);
                }
            });

            div.querySelector('.action-rename').addEventListener('click', () => this.editFieldName(field.id));
            div.querySelector('.action-delete').addEventListener('click', () => this.deleteField(field.id));

            div.addEventListener('mouseenter', () => this.highlightField(field.id));
            div.addEventListener('mouseleave', () => this.unhighlightField(field.id));

            this.fieldList.appendChild(div);
        });
    }

    zoomToField(id) {
        const layer = this.mapManager.drawnItems.getLayer(id);
        if (layer) {
            this.mapManager.map.fitBounds(layer.getBounds(), { maxZoom: 18 });
        }
    }

    highlightField(id) {
        const layer = this.mapManager.drawnItems.getLayer(id);
        if (layer && typeof layer.setStyle === 'function') {
            layer.setStyle({
                weight: 8,
                color: '#ffcc00',
                className: 'glow-effect'
            });
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                layer.bringToFront();
            }
        }
    }

    unhighlightField(id) {
        const layer = this.mapManager.drawnItems.getLayer(id);
        if (layer && typeof layer.setStyle === 'function') {
            layer.setStyle({
                weight: 3,
                color: '#3388ff',
                className: ''
            });
        }
    }

    openFlightPlanSidebar(id) {
        const prevId = document.getElementById('fp-field-id').value;
        const field = this.fields.find(f => String(f.id) === String(id));
        if (!field) return;

        if (prevId !== id) {
            this.isTakeoffHeightManuallySet = false;
        }

        document.getElementById('fp-field-id').value = id;
        this.fpSidebar.classList.remove('hidden');
        this.fpSidebar.classList.remove('collapsed');
        document.getElementById('right-resizer').classList.remove('hidden');
        this.mapManager.map.invalidateSize();
        this.zoomToField(id);

        if (prevId !== id) {
            // Load saved parameters into UI if they exist
            if (field.fp_path_distance !== undefined && field.fp_path_distance !== null) {
                this.loadFPParametersIntoUI(field);
            }

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

            if (field.flight_path) {
                const latlngs = JSON.parse(field.flight_path).map(p => L.latLng(p.lat, p.lng, p.alt));
                this.currentFlightPath = L.polyline(latlngs, { color: 'red', weight: 3 });
                if (this.isAdminMode) {
                    this.mapManager.drawnItems.addLayer(this.currentFlightPath);
                }
                this.updateWaypointMarkers();
                this.updateWaypointTable();
                this.updateFPStats(field.fp_speed || 10);
                document.getElementById('fp-stats').classList.remove('hidden');
                this.btnExportFPKML.classList.remove('hidden');
                this.btnExportFPKMZ.classList.remove('hidden');
                this.btnReverseFP.classList.remove('hidden');
            } else {
                this.generateFlightPlan();
            }
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

    getMiteredOffset(poly, distance, clip, originalBoundary = null, smartPathSpacing = null) {
        if (distance <= 0 && smartPathSpacing === null) return poly;

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

                const isPrevShared = originalBoundary ? this.isSharedEdge(pPrev, pCurr, originalBoundary) : false;
                const isNextShared = originalBoundary ? this.isSharedEdge(pCurr, pNext, originalBoundary) : false;

                const b1 = turf.bearing(pPrev, pCurr);
                const b2 = turf.bearing(pCurr, pNext);
                const n1 = b1 - 90;
                const n2 = b2 - 90;

                let d1 = distance;
                let d2 = distance;

                if (isPrevShared) {
                    d1 = smartPathSpacing !== null ? (smartPathSpacing / 2) : 0;
                }
                if (isNextShared) {
                    d2 = smartPathSpacing !== null ? (smartPathSpacing / 2) : 0;
                }

                if (d1 === 0 && d2 === 0) {
                    newRing.push(pCurr);
                    continue;
                }

                const pPrevOffset = turf.destination(turf.point(pPrev), d1, n1, {units: 'meters'});
                const pCurrOffset1 = turf.destination(turf.point(pCurr), d1, n1, {units: 'meters'});
                const pCurrOffset2 = turf.destination(turf.point(pCurr), d2, n2, {units: 'meters'});
                const pNextOffset = turf.destination(turf.point(pNext), d2, n2, {units: 'meters'});

                const intersect = this.intersectLines(
                    pPrevOffset.geometry.coordinates, pCurrOffset1.geometry.coordinates,
                    pCurrOffset2.geometry.coordinates, pNextOffset.geometry.coordinates
                );

                if (intersect) {
                    const distToOrig = turf.distance(turf.point(pCurr), turf.point(intersect), {units: 'meters'});
                    const maxD = Math.max(d1, d2);
                    // Increased spike clipping threshold from 2.5 to 4.0 to prevent over-clipping sharp corners
                    if (clip && distToOrig > maxD * 4.0) {
                        if (d1 > 0) newRing.push(pCurrOffset1.geometry.coordinates);
                        if (d2 > 0) newRing.push(pCurrOffset2.geometry.coordinates);
                        if (d1 === 0 && d2 === 0) newRing.push(pCurr);
                    } else {
                        newRing.push(intersect);
                    }
                } else {
                    newRing.push(pCurr);
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
        if (!geojson) return geojson;
        // Strip Z if present
        if (geojson.type === 'Feature' && geojson.geometry && geojson.geometry.coordinates) {
            if (geojson.geometry.type === 'Polygon') {
                geojson.geometry.coordinates = geojson.geometry.coordinates.map(ring => ring.map(c => [c[0], c[1]]));
            } else if (geojson.geometry.type === 'MultiPolygon') {
                geojson.geometry.coordinates = geojson.geometry.coordinates.map(poly => poly.map(ring => ring.map(c => [c[0], c[1]])));
            }
        }
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

        let latlngs = this.getCurrentFlightPathLatLngs();

        latlngs.forEach((ll, idx) => {
            const absHeight = ll.alt !== undefined ? Math.round(ll.alt) : '';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td><input type="text" value="${ll.lat.toFixed(6)}" data-idx="${idx}" data-type="lat"></td>
                <td><input type="text" value="${ll.lng.toFixed(6)}" data-idx="${idx}" data-type="lng"></td>
                <td><input type="text" value="${absHeight}" data-idx="${idx}" data-type="alt" ${this.terrainFollowingCheckbox.checked ? '' : 'disabled'}></td>
                <td><button type="button" class="btn secondary action-delete-wp" title="Löschen">×</button></td>
            `;
            tr.querySelector('.action-delete-wp').addEventListener('click', () => this.removeWaypoint(idx));
            this.waypointTableBody.appendChild(tr);
        });

        this.waypointTableBody.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const type = e.target.dataset.type;
                const val = parseFloat(e.target.value);
                if (isNaN(val)) return;

                if (this.currentFlightPath instanceof L.FeatureGroup) {
                    const layers = [];
                    this.currentFlightPath.eachLayer(l => layers.push(l));
                    layers.sort((a, b) => a.segmentIndex - b.segmentIndex);

                    let currentGlobalIdx = 0;
                    layers.forEach((l, i) => {
                        const lls = l.getLatLngs();
                        let layerUpdated = false;
                        for (let j = 0; j < lls.length; j++) {
                            let pointGlobalIdx;
                            if (i > 0 && j === 0) {
                                pointGlobalIdx = currentGlobalIdx - 1;
                            } else {
                                pointGlobalIdx = currentGlobalIdx;
                                currentGlobalIdx++;
                            }

                            if (pointGlobalIdx === idx) {
                                if (type === 'lat') lls[j].lat = val;
                                else if (type === 'lng') lls[j].lng = val;
                                else if (type === 'alt') lls[j].alt = Math.round(val);
                                layerUpdated = true;
                            }
                        }
                        if (layerUpdated) l.setLatLngs(lls);
                    });
                } else {
                    const currentLatLngs = this.currentFlightPath.getLatLngs();
                    if (type === 'lat') currentLatLngs[idx].lat = val;
                    else if (type === 'lng') currentLatLngs[idx].lng = val;
                    else if (type === 'alt') currentLatLngs[idx].alt = Math.round(val);
                    this.currentFlightPath.setLatLngs(currentLatLngs);
                }
                this.updateWaypointMarkers();
                this.updateFPStats(parseFloat(document.getElementById('fp-speed').value) || 10);
            });
        });
    }

    removeWaypoint(idx) {
        if (this.currentFlightPath instanceof L.FeatureGroup) {
            const layers = [];
            this.currentFlightPath.eachLayer(l => layers.push(l));
            layers.sort((a, b) => a.segmentIndex - b.segmentIndex);

            let currentGlobalIdx = 0;
            let removedAny = false;
            layers.forEach((l, i) => {
                const lls = l.getLatLngs();
                let layerUpdated = false;
                for (let j = 0; j < lls.length; j++) {
                    let pointGlobalIdx;
                    if (i > 0 && j === 0) {
                        pointGlobalIdx = currentGlobalIdx - 1;
                    } else {
                        pointGlobalIdx = currentGlobalIdx;
                        currentGlobalIdx++;
                    }

                    if (pointGlobalIdx === idx) {
                        if (lls.length <= 2) {
                            console.warn("Cannot remove point from segment with only 2 points");
                            continue;
                        }
                        lls.splice(j, 1);
                        layerUpdated = true;
                        removedAny = true;
                        j--;
                    }
                }
                if (layerUpdated) l.setLatLngs(lls);
            });
            if (!removedAny) {
                this.showNotification("Punkt konnte nicht gelöscht werden.");
                return;
            }
        } else {
            const latlngs = this.currentFlightPath.getLatLngs();
            if (latlngs.length <= 2) {
                this.showNotification("Ein Flugplan muss mindestens 2 Punkte haben.");
                return;
            }
            latlngs.splice(idx, 1);
            this.currentFlightPath.setLatLngs(latlngs);
        }
        this.updateWaypointMarkers();
        this.updateWaypointTable();
        this.updateFPStats(parseFloat(document.getElementById('fp-speed').value) || 10);
    }

    async generateFlightPlan() {
        const id = document.getElementById('fp-field-id').value;
        const field = this.fields.find(f => String(f.id) === String(id));
        if (!field) {
            console.error("generateFlightPlan: Field not found", id);
            return;
        }

        console.log("Generating flight plan", {
            id,
            mode: document.getElementById('fp-mode').value,
            pathDist: document.getElementById('fp-path-distance').value,
            borderDist: document.getElementById('fp-border-distance').value
        });

        const pathDistance = parseFloat(document.getElementById('fp-path-distance').value) || 10;
        const borderDistance = parseFloat(document.getElementById('fp-border-distance').value) || 5;
        const minPointDist = parseFloat(document.getElementById('fp-min-dist').value) || 3;
        let orientation = document.getElementById('fp-orientation').value;
        const speed = parseFloat(document.getElementById('fp-speed').value) || 10;
        const fpMode = document.getElementById('fp-mode').value;
        const clipCorners = document.getElementById('fp-clip-corners').checked;

        const geoJson = JSON.parse(field.geometry);
        let originalPoly = turf.rewind(turf.polygon(geoJson.coordinates));

        // 1. Virtual Border (Mitered Inward Offset)
        let virtualBorder = this.getMiteredOffset(originalPoly, borderDistance, clipCorners);

        if (!virtualBorder) {
            console.error("Virtual border generation failed (null)");
            this.showNotification('Abstand zum Rand ist zu groß für diesen Schlag oder der Schlag ist zu klein.');
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
            console.error("Virtual border is empty after intersection");
            this.showNotification('Abstand zum Rand ist zu groß für diesen Schlag oder der Schlag ist zu klein.');
            return;
        }

        // Soften boundary slightly
        virtualBorder = this.simplifyGeo(virtualBorder, 0.1);
        let pathPoints = [];

        let smartResult = null;
        if (fpMode === 'smart' || fpMode === 'smartplus' || fpMode === 'genius') {
            smartResult = this.calculateSmartPath(virtualBorder, pathDistance, minPointDist, originalPoly);
            pathPoints = smartResult.points;

            if (smartResult && smartResult.orientation === "Smart") {
                if (fpMode === 'smartplus') document.getElementById('val-fp-orientation').textContent = "Smart+";
                else if (fpMode === 'genius') document.getElementById('val-fp-orientation').textContent = "Genius";
                else document.getElementById('val-fp-orientation').textContent = "Smart";
            } else if (smartResult && smartResult.orientation !== undefined) {
                document.getElementById('val-fp-orientation').textContent = Math.round(smartResult.orientation);
            } else {
                if (fpMode === 'smartplus') document.getElementById('val-fp-orientation').textContent = "Smart+";
                else if (fpMode === 'genius') document.getElementById('val-fp-orientation').textContent = "Genius";
                else document.getElementById('val-fp-orientation').textContent = "Smart";
            }

            if (pathPoints.length === 0) {
                // Fallback to Intelligent if Smart fails
                const fallback = this.calculateIntelligentPath(virtualBorder, pathDistance, minPointDist);
                pathPoints = fallback.points;
                document.getElementById('val-fp-orientation').textContent = Math.round(fallback.orientation);
            }
        } else if (fpMode === 'curved') {
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
            } else {
                // Intelligent logic used for both 'intelligent' and 'zigzag' (if orientation is Auto)
                const result = this.calculateIntelligentPath(virtualBorder, pathDistance, minPointDist);
                pathPoints = result.points;
                finalOrientation = result.orientation;
                document.getElementById('val-fp-orientation').textContent = Math.round(finalOrientation);
            }

            if (pathPoints.length === 0) {
                this.showNotification('Konnte keinen Flugplan generieren. Prüfen Sie die Parameter (Abstand zum Rand evtl. zu groß).');
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
                    if (terrainData[idx] && terrainData[idx].elevation !== undefined) {
                        const terrainHeight = terrainData[idx].elevation;
                        ll.alt = terrainHeight + flightHeight;
                    } else {
                        console.warn(`No terrain data for waypoint ${idx}, using relative height.`);
                        ll.alt = flightHeight;
                    }
                });
            } catch (err) {
                console.error("Terrain following failed:", err);
                this.showNotification('Geländehöhen konnten nicht geladen werden. Der Flugplan wurde mit relativen Höhen erstellt.');
                // Don't uncheck, let the user decide. But we need to ensure altitudes exist.
                const flightHeight = parseFloat(document.getElementById('fp-height').value) || 15;
                latlngs.forEach(ll => { if (ll.alt === undefined) ll.alt = flightHeight; });
            } finally {
                this.btnGenerateFP.textContent = originalBtnText;
                this.btnGenerateFP.disabled = false;
            }
        }

        if ((fpMode === 'smart' || fpMode === 'genius') && smartResult && smartResult.multiPath && smartResult.multiPath.length > 1) {
            const group = L.featureGroup();
            smartResult.multiPath.forEach((path, idx) => {
                const poly = L.polyline(path.latlngs, {
                    color: path.color,
                    weight: 3,
                    dashArray: path.dashArray || null
                });
                poly.segmentIndex = idx;
                poly.addTo(group);
            });
            this.currentFlightPath = group;
        } else {
            this.currentFlightPath = L.polyline(latlngs, { color: 'red', weight: 3 });
        }

        // Default takeoff security height to first waypoint height if not manually set
        if (!this.isTakeoffHeightManuallySet && latlngs.length > 0) {
            const takeoffInput = document.getElementById('fp-takeoff-security-height');
            const firstWpHeight = latlngs[0].alt !== undefined ? Math.round(latlngs[0].alt) : parseFloat(document.getElementById('fp-height').value) || 15;
            if (takeoffInput) {
                takeoffInput.value = firstWpHeight;
                this.updateActiveFieldParam('fp_takeoff_security_height', firstWpHeight);
            }
        }

        this.updateWaypointMarkers();
        this.updateWaypointTable();

        // Update the field object with the new flight path and parameters
        field.flight_path = JSON.stringify(this.getCurrentFlightPathLatLngs());
        field.fp_mode = fpMode;
        field.fp_path_distance = pathDistance;
        field.fp_border_distance = borderDistance;
        field.fp_min_dist = minPointDist;
        field.fp_orientation = orientation === "" ? 0 : parseFloat(orientation);
        field.fp_speed = speed;
        field.fp_height = parseFloat(document.getElementById('fp-height').value) || 15;
        field.fp_clip_corners = clipCorners ? 1 : 0;
        field.fp_terrain_following = this.terrainFollowingCheckbox.checked ? 1 : 0;
        field.fp_show_wp_height = this.showWPHeightCheckbox.checked ? 1 : 0;
        field.fp_height_mode = document.getElementById('fp-height-mode').value;
        field.fp_drone_info = document.getElementById('fp-drone-info').value;
        field.fp_payload_info = document.getElementById('fp-payload-info').value;
        field.fp_finish_action = document.getElementById('fp-finish-action').value;
        field.fp_rc_lost_action = document.getElementById('fp-rc-lost-action').value;
        field.fp_execute_rc_lost_action = document.getElementById('fp-execute-rc-lost-action').value;
        field.fp_fly_to_wayline_mode = document.getElementById('fp-fly-to-wayline-mode').value;
        field.fp_takeoff_security_height = document.getElementById('fp-takeoff-security-height').value;
        field.fp_waypoint_turn_mode = document.getElementById('fp-waypoint-turn-mode').value;
        field.fp_waypoint_heading_mode = document.getElementById('fp-waypoint-heading-mode').value;

        if (this.isAdminMode) {
            this.mapManager.drawnItems.addLayer(this.currentFlightPath);
        }
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

    getCurrentFlightPathLatLngs() {
        if (!this.currentFlightPath) return [];
        if (this.currentFlightPath instanceof L.FeatureGroup) {
            let latlngs = [];
            this.currentFlightPath.eachLayer(l => {
                if (l.getLatLngs) {
                    const segment = l.getLatLngs();
                    if (latlngs.length > 0 && segment.length > 0) {
                        const last = latlngs[latlngs.length - 1];
                        const first = segment[0];
                        if (last.lat === first.lat && last.lng === first.lng) {
                            latlngs = latlngs.concat(segment.slice(1));
                        } else {
                            latlngs = latlngs.concat(segment);
                        }
                    } else {
                        latlngs = latlngs.concat(segment);
                    }
                }
            });
            return latlngs;
        } else if (this.currentFlightPath.getLatLngs) {
            return this.currentFlightPath.getLatLngs();
        }
        return [];
    }

    setCurrentFlightPathLatLngs(latlngs) {
        if (!this.currentFlightPath) return;
        if (this.currentFlightPath instanceof L.FeatureGroup) {
            let count = 0;
            this.currentFlightPath.eachLayer(l => {
                if (l.getLatLngs && l.setLatLngs) {
                    const len = l.getLatLngs().length;
                    l.setLatLngs(latlngs.slice(count, count + len));
                    count += len;
                }
            });
        } else if (this.currentFlightPath.setLatLngs) {
            this.currentFlightPath.setLatLngs(latlngs);
        }
    }

    reverseFlightPlan() {
        if (!this.currentFlightPath) return;
        if (this.currentFlightPath instanceof L.FeatureGroup) {
            const layers = [];
            this.currentFlightPath.eachLayer(l => layers.push(l));
            layers.sort((a, b) => a.segmentIndex - b.segmentIndex);
            layers.reverse();

            this.currentFlightPath.clearLayers();
            layers.forEach((l, idx) => {
                const lls = l.getLatLngs();
                lls.reverse();
                l.setLatLngs(lls);
                l.segmentIndex = idx;
                this.currentFlightPath.addLayer(l);
            });
        } else {
            const latlngs = this.currentFlightPath.getLatLngs();
            latlngs.reverse();
            this.currentFlightPath.setLatLngs(latlngs);
        }
        this.updateWaypointMarkers();
        this.updateWaypointTable();
    }

    updateWaypointMarkers() {
        if (!this.currentFlightPath) return;
        this.wpLayerGroup.clearLayers();
        const latlngs = this.getCurrentFlightPathLatLngs();
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
        // Ensure 2D coordinates for all operations
        p1 = [p1[0], p1[1]];
        p2 = [p2[0], p2[1]];
        const line = turf.lineString([p1, p2]);
        const len = turf.length(line, { units: 'meters' });
        if (len < 0.1) return true;

        const features = (polygon.type === 'FeatureCollection') ? polygon.features : [polygon];

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

        // Increased sampling density for sharp concave corners
        const numSamples = Math.max(40, Math.min(400, Math.ceil(len / 0.1)));
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
                if (minBorderDist > tolerance + 0.005) return false;
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
                if (this.isPathInside(simplified[simplified.length - 1], points[target], polygon, 0.05) && this.isCollinear(simplified[simplified.length - 1], points[target - 1], points[target])) {
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
        const fpMode = document.getElementById('fp-mode').value;
        const center = turf.center(virtualBorder);
        const rotatedVB = turf.transformRotate(virtualBorder, -orientation, { pivot: center });
        const bbox = turf.bbox(rotatedVB);

        const pStart = [bbox[0], bbox[1]];
        const pNext = turf.destination(turf.point(pStart), pathDistance, 0, { units: 'meters' }).geometry.coordinates;
        const latSpacing = Math.abs(pNext[1] - pStart[1]);

        let currentY = bbox[1] + latSpacing / 2;
        let rows = [];

        while (currentY < bbox[3]) {
            const line = turf.lineString([[bbox[0] - 100, currentY], [bbox[2] + 100, currentY]]);
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

    intersectLines(p1, p2, p3, p4) {
        const x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1];
        const x3 = p3[0], y3 = p3[1], x4 = p4[0], y4 = p4[1];
        const den = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        if (den === 0) return null;
        const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / den;
        return [x1 + ua * (x2 - x1), y1 + ua * (y2 - y1)];
    }

    isSharedEdge(p1, p2, originalBoundary) {
        if (!originalBoundary) return false;
        const mid = turf.midpoint(p1, p2);

        const nearestMid = turf.nearestPointOnLine(originalBoundary, mid, { units: 'meters' });
        const nearestP1 = turf.nearestPointOnLine(originalBoundary, p1, { units: 'meters' });
        const nearestP2 = turf.nearestPointOnLine(originalBoundary, p2, { units: 'meters' });

        const distMid = turf.distance(mid, nearestMid, { units: 'meters' });
        const distP1 = turf.distance(p1, nearestP1, { units: 'meters' });
        const distP2 = turf.distance(p2, nearestP2, { units: 'meters' });

        // If distance to original boundary is significant (>0.25m) at all checked points, it's a shared (internal) edge
        // Using a slightly larger threshold to account for numeric drift during decomposition
        return distMid > 0.25 && distP1 > 0.25 && distP2 > 0.25;
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

        // If even the best candidate is empty (should not happen if candidates exists)
        if (candidates.length === 0 || candidates[0].points.length === 0) {
            return { points: [], orientation: 0 };
        }

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

    calculateSmartPath(virtualBorder, pathDistance, minPointDist, originalPoly) {
        let parts = [];
        const pathSpacing = parseFloat(document.getElementById('fp-path-distance').value) || 10;
        const fieldId = document.getElementById('fp-field-id').value;
        const field = this.fields.find(f => String(f.id) === String(fieldId));
        const fpMode = document.getElementById('fp-mode').value;

        console.log("calculateSmartPath started", { fieldId, hasManualParts: !!(field && field.manualParts), fpMode });
        if (field && field.manualParts) {
            parts = field.manualParts.map(p => turf.polygon(p.geometry.coordinates));
            console.log("Using manual parts:", parts.length);
        } else {
            parts = this.decomposePolygon(originalPoly, 0, fpMode === 'smartplus' || fpMode === 'genius');
            console.log("Decomposed into parts:", parts.length);
        }

        if (parts.length <= 1) {
            console.log("Only one part, falling back to Intelligent path");
            return this.calculateIntelligentPath(virtualBorder, pathDistance, minPointDist);
        }

        const borderDistance = parseFloat(document.getElementById('fp-border-distance').value) || 5;
        const clipCorners = document.getElementById('fp-clip-corners').checked;
        const originalBoundary = turf.polygonToLine(originalPoly);

        let sectionPaths = [];
        parts.forEach((part, idx) => {
            console.log(`Processing part ${idx}`);
            let partVirtualBorder = this.getMiteredOffset(part, borderDistance, clipCorners, originalBoundary, pathSpacing);

            if (!partVirtualBorder && borderDistance > 1) {
                console.log(`Part ${idx}: getMiteredOffset failed at ${borderDistance}m, trying 1m fallback`);
                partVirtualBorder = this.getMiteredOffset(part, 1, clipCorners, originalBoundary, pathSpacing);
            }

            if (!partVirtualBorder) {
                console.log(`Part ${idx}: getMiteredOffset failed`);
                return;
            }

            try {
                partVirtualBorder = turf.intersect(partVirtualBorder, part);
            } catch (e) {
                console.warn("Part intersection failed", e);
            }

            if (!partVirtualBorder || (partVirtualBorder.type === 'FeatureCollection' && partVirtualBorder.features.length === 0)) {
                console.log(`Part ${idx}: virtual border empty after intersection`);
                return;
            }

            partVirtualBorder = this.simplifyGeo(partVirtualBorder, 0.1);
            const result = this.calculateIntelligentPath(partVirtualBorder, pathDistance, minPointDist);
            console.log(`Part ${idx}: Intelligent path generated ${result.points.length} points`);

            if (result.points.length > 0) {
                sectionPaths.push({
                    points: result.points,
                    color: this.colors[idx % this.colors.length]
                });
            }
        });

        if (sectionPaths.length === 0) {
            return this.calculateIntelligentPath(virtualBorder, pathDistance, minPointDist);
        }

        let allPoints = [];
        let multiPath = [];

        sectionPaths.forEach((section, idx) => {
            let points = [...section.points];

            if (idx === 0) {
                allPoints = [...points];
                multiPath.push({
                    latlngs: points.map(p => L.latLng(p[1], p[0])),
                    color: section.color
                });
            } else {
                const lastPt = allPoints[allPoints.length - 1];
                const startPt = points[0];
                const endPt = points[points.length - 1];

                const distNormal = turf.distance(turf.point(lastPt), turf.point(startPt), { units: 'meters' });
                const distReversed = turf.distance(turf.point(lastPt), turf.point(endPt), { units: 'meters' });

                if (distReversed < distNormal) {
                    points.reverse();
                    console.log(`Section ${idx} reversed for shorter connection.`);
                }

                const connection = this.getBorderPath(lastPt, points[0], virtualBorder);
                const connectionLatLngs = [L.latLng(lastPt[1], lastPt[0])];
                connection.forEach(p => {
                    const ll = L.latLng(p[1], p[0]);
                    if (ll.distanceTo(connectionLatLngs[connectionLatLngs.length - 1]) > 0.1) {
                        connectionLatLngs.push(ll);
                    }
                });

                if (connectionLatLngs.length >= 2) {
                    const prevColor = sectionPaths[idx - 1].color;
                    const transitionColor = this.interpolateColor(prevColor, section.color);

                    multiPath.push({
                        latlngs: connectionLatLngs,
                        color: transitionColor,
                        dashArray: '5, 5'
                    });

                    connection.forEach(p => {
                        if (turf.distance(allPoints[allPoints.length - 1], p, { units: 'meters' }) > 0.1) {
                            allPoints.push(p);
                        }
                    });
                }

                points.forEach(p => {
                    if (allPoints.length === 0 || turf.distance(allPoints[allPoints.length - 1], p, { units: 'meters' }) > 0.1) {
                        allPoints.push(p);
                    }
                });

                multiPath.push({
                    latlngs: points.map(p => L.latLng(p[1], p[0])),
                    color: section.color
                });
            }
        });

        allPoints = this.simplifyPath(allPoints, minPointDist, virtualBorder);

        if (fpMode === 'genius') {
            console.log("Applying final simplified pass for Genius mode");
            allPoints = this.simplifyPath(allPoints, minPointDist, virtualBorder);
        }

        return { points: allPoints, multiPath: multiPath, orientation: "Smart" };
    }

    estimateWaypointsFast(poly, pathDistance) {
        const fpMode = document.getElementById('fp-mode').value;
        let minPoints = Infinity;
        const angles = new Set();
        // 5 degree resolution
        let step = 5;
        if (fpMode === 'genius') step = 2; // Finer resolution for Genius mode

        for (let a = 0; a < 180; a += step) {
            angles.add(a);
        }
        // Edge bearings
        const geom = poly.geometry || poly;
        const coords = geom.coordinates[0];
        if (coords) {
            for (let i = 0; i < coords.length - 1; i++) {
                let b = turf.bearing(coords[i], coords[i + 1]);
                // Normalize to 0-180
                while (b < 0) b += 180;
                while (b >= 180) b -= 180;
                angles.add(Math.round(b));
            }
        }

        for (let angle of angles) {
            try {
                const points = this.calculateZigzagPoints(poly, angle, pathDistance);
                if (points.length > 0 && points.length < minPoints) {
                    minPoints = points.length;
                }
            } catch (e) {}
        }
        return minPoints;
    }

    decomposePolygon(poly, depth = 0, smartPlus = false) {
        const fpMode = document.getElementById('fp-mode').value;
        if (depth > 15) return [poly];

        // Ensure 2D coordinates
        if (poly.geometry && poly.geometry.coordinates) {
            const strip = (c) => (typeof c[0] === 'number') ? [c[0], c[1]] : c.map(strip);
            poly.geometry.coordinates = strip(poly.geometry.coordinates);
        }

        const pathDistance = parseFloat(document.getElementById('fp-path-distance').value) || 10;
        const currentScore = this.estimateWaypointsFast(poly, pathDistance);

        // If parent polygon cannot be covered, we must try to split it to find coverable parts
        // or accept that it might be impossible. However, the goal is full coverage.
        const splitResult = this.findBestSplit(poly, smartPlus);
        if (splitResult && splitResult.parts) {
            const splitScore = splitResult.score;

            // If currentScore is Infinity (no coverage), any valid split (splitScore < Infinity) is an improvement
            let isImprovement = (currentScore === Infinity && splitScore < Infinity) ||
                                 (splitScore < currentScore * 0.95);

            // In Genius mode, we prioritize coverage (getting out of Infinity) and more aggressive splitting
            if (fpMode === 'genius') {
                // Any split that leads to a finite score when current is Infinity is an improvement.
                // Otherwise, even a 1% improvement or simply resolving a complex polygon is preferred.
                // We force split if currentScore is Infinity to try to find coverable parts.
                isImprovement = (currentScore === Infinity && splitScore < Infinity) || (splitScore < currentScore * 0.995) || (currentScore === Infinity);
            }

            if (isImprovement) {
                console.log(`Decomposition improvement found at depth ${depth}. Splitting into ${splitResult.parts.length} parts.`);
                let allSubParts = [];
                for (const part of splitResult.parts) {
                    allSubParts = allSubParts.concat(this.decomposePolygon(part, depth + 1, smartPlus));
                }
                return allSubParts;
            }
        }
        return [poly];
    }

    findBestSplit(poly, smartPlus = false) {
        const fpMode = document.getElementById('fp-mode').value;
        // Ensure standard CCW orientation for consistent reflex vertex detection
        const cleanPoly = turf.rewind(poly);
        const geom = cleanPoly.geometry || cleanPoly;
        const coords = geom.coordinates[0];
        const boundary = turf.polygonToLine(cleanPoly);
        const pathDistance = parseFloat(document.getElementById('fp-path-distance').value) || 10;

        let bestSplitResult = null;
        let minScore = Infinity;

        // Identify reflex vertices (concave corners)
        for (let i = 0; i < coords.length - 1; i++) {
            const pPrev = i === 0 ? coords[coords.length - 2] : coords[i - 1];
            const pCurr = coords[i];
            const pNext = coords[i + 1];

            const b1 = turf.bearing(pPrev, pCurr);
            const b2 = turf.bearing(pCurr, pNext);
            let diff = b2 - b1;
            while (diff > 180) diff -= 360;
            while (diff < -180) diff += 360;

            // In a CCW polygon, a reflex vertex has a turn to the Right (positive diff)
            if (diff > 5) {
                let candidates = [];

                // 1. Extensions (Continuing adjacent edges)
                // Extension of (pPrev -> pCurr) into the polygon is direction b1
                // Extension of (pNext -> pCurr) into the polygon is direction b2 + 180
                const directions = [b1, (b2 + 180) % 360];
                for (const angle of directions) {
                    const line = turf.lineString([
                        pCurr,
                        turf.destination(turf.point(pCurr), 10, angle, { units: 'kilometers' }).geometry.coordinates
                    ]);
                    const intersects = turf.lineIntersect(line, boundary);
                    const sorted = intersects.features
                        .filter(f => turf.distance(f, pCurr, { units: 'meters' }) > 0.1)
                        .sort((a, b) => turf.distance(a, pCurr, { units: 'meters' }) - turf.distance(b, pCurr, { units: 'meters' }));

                    if (sorted.length > 0) {
                        const splitPt = sorted[0].geometry.coordinates;
                        if (this.isPathInside(pCurr, splitPt, cleanPoly, 0.15)) {
                            // Extend split line slightly to ensure clean intersection during difference operation
                            const bearing = turf.bearing(pCurr, splitPt);
                            const extStart = turf.destination(turf.point(pCurr), 0.001, bearing + 180, { units: 'kilometers' }).geometry.coordinates;
                            const extEnd = turf.destination(turf.point(splitPt), 0.001, bearing, { units: 'kilometers' }).geometry.coordinates;
                            candidates.push({ line: [extStart, extEnd], weight: 0.8 });
                        }
                    }
                }

                // 2. Vertex connections (fallback, only for Smart and Genius)
                if (!smartPlus || fpMode === 'genius') {
                    for (let j = 0; j < coords.length - 1; j++) {
                        if (Math.abs(i - j) <= 1 || (i === 0 && j === coords.length - 2) || (j === 0 && i === coords.length - 2)) continue;
                        const pTarget = coords[j];
                        if (this.isPathInside(pCurr, pTarget, cleanPoly, 0.15)) {
                            // In Genius mode, we weight vertex connections same as extensions to explore more options
                            const weight = (fpMode === 'genius') ? 0.8 : 1.0;
                            candidates.push({ line: [pCurr, pTarget], weight: weight });
                        }
                    }
                }

                for (const cand of candidates) {
                    try {
                        const splitLine = turf.lineString(cand.line);
                        const bufferedLine = turf.buffer(splitLine, 0.01, { units: 'meters' });
                        const remaining = turf.difference(cleanPoly, bufferedLine);

                        let parts = [];
                        if (remaining) {
                            const flattened = turf.flatten(remaining);
                            parts = flattened.features.filter(f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));
                        }

                        if (parts.length >= 2) {
                            let totalScore = 0;
                            let allCovered = true;
                            let coverablePartsCount = 0;
                            for (const part of parts) {
                                const partScore = this.estimateWaypointsFast(part, pathDistance);
                                if (partScore === Infinity) {
                                    allCovered = false;
                                } else {
                                    totalScore += partScore;
                                    coverablePartsCount++;
                                }
                            }

                            // In Genius mode, we accept the split even if some parts are uncoverable,
                            // as long as at least one part is coverable and the total score is finite.
                            const isValidSplit = (fpMode === 'genius') ? (coverablePartsCount > 0) : allCovered;

                            if (isValidSplit) {
                                const weightedScore = totalScore * cand.weight;
                                if (weightedScore < minScore) {
                                    minScore = weightedScore;
                                    bestSplitResult = { parts: parts, score: totalScore };
                                }
                            }
                        }
                    } catch (e) {
                        console.warn("Split evaluation failed", e);
                    }
                }
            }
        }
        return bestSplitResult;
    }

    updateFPStats(speed) {
        const latlngs = this.getCurrentFlightPathLatLngs();
        let totalDist = 0;
        for (let i = 0; i < latlngs.length - 1; i++) {
            const p1 = latlngs[i];
            const p2 = latlngs[i+1];
            if (p1 && p2) {
                totalDist += L.latLng(p1).distanceTo(L.latLng(p2));
            }
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

        const defaultHeight = Math.round(parseFloat(document.getElementById('fp-height').value)) || 15;
        const latlngs = this.getCurrentFlightPathLatLngs();
        const terrainFollowing = this.terrainFollowingCheckbox.checked;
        const altitudeMode = terrainFollowing ? 'absolute' : 'relativeToGround';
        const coords = latlngs.map(ll => {
            const h = (terrainFollowing && ll.alt !== undefined) ? Math.round(ll.alt) : defaultHeight;
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
        const takeOffSecurityHeight = Math.round(parseFloat(document.getElementById('fp-takeoff-security-height').value));
        const waypointTurnMode = document.getElementById('fp-waypoint-turn-mode').value;
        const waypointHeadingMode = document.getElementById('fp-waypoint-heading-mode').value;

        const speed = parseFloat(document.getElementById('fp-speed').value) || 12;
        const globalHeight = Math.round(parseFloat(document.getElementById('fp-height').value)) || 15;

        const terrainFollowing = this.terrainFollowingCheckbox.checked;
        const heightMode = terrainFollowing ? document.getElementById('fp-height-mode').value : 'relativeToStartPoint';

        let latlngs = this.getCurrentFlightPathLatLngs();

        // Filter waypoints to ensure minimum 3m distance
        if (latlngs.length > 1) {
            let filtered = [latlngs[0]];
            for (let i = 1; i < latlngs.length; i++) {
                const prev = filtered[filtered.length - 1];
                const curr = latlngs[i];
                const dist = turf.distance(
                    turf.point([prev.lng, prev.lat]),
                    turf.point([curr.lng, curr.lat]),
                    { units: 'meters' }
                );

                if (dist >= 3.0) {
                    filtered.push(curr);
                } else if (i === latlngs.length - 1 && filtered.length > 1) {
                    // Always keep the last point. Replace previous if too close.
                    // But then we must ensure the new last point is 3m from the NEW previous point.
                    filtered[filtered.length - 1] = curr;

                    // Recursive-like check: if now the last two are too close, remove the second-to-last
                    while (filtered.length >= 2) {
                        const pLast = filtered[filtered.length - 1];
                        const pPrev = filtered[filtered.length - 2];
                        const d = turf.distance(
                            turf.point([pPrev.lng, pPrev.lat]),
                            turf.point([pLast.lng, pLast.lat]),
                            { units: 'meters' }
                        );
                        if (d < 3.0) {
                            filtered.splice(filtered.length - 2, 1);
                        } else {
                            break;
                        }
                    }
                }
            }
            latlngs = filtered;
        }

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
            const h = (ll.alt !== undefined) ? Math.round(ll.alt) : globalHeight;
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

        const finishActionTag = finishAction ? `<wpml:finishAction>${finishAction}</wpml:finishAction>` : '<wpml:finishAction/>';
        const headingModeTag = waypointHeadingMode ? `<wpml:waypointHeadingMode>${waypointHeadingMode}</wpml:waypointHeadingMode>` : '<wpml:waypointHeadingMode/>';
        const gimbalPitchModeTag = '<wpml:gimbalPitchMode/>'; // Matching example's empty gimbalPitchMode

        const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
  <Document>
    <wpml:author>UAV</wpml:author>
    <wpml:createTime>${createTime}</wpml:createTime>
    <wpml:updateTime>${updateTime}</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:droneInfo>
        <wpml:droneEnumValue>${droneEnumValue}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>${droneEnumValue === '77' ? '1' : '0'}</wpml:droneSubEnumValue>
      </wpml:droneInfo>
      ${document.getElementById('fp-payload-info').value !== 'none' ? `
      <wpml:payloadInfo>
        <wpml:payloadEnumValue>${document.getElementById('fp-payload-info').value}</wpml:payloadEnumValue>
        <wpml:payloadSubEnumValue>0</wpml:payloadSubEnumValue>
        <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
      </wpml:payloadInfo>` : ''}
      ${finishActionTag}
      <wpml:exitOnRCLost>${exitOnRCLost}</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>${executeRCLostAction}</wpml:executeRCLostAction>
      <wpml:flyToWaylineMode>${flyToWaylineMode}</wpml:flyToWaylineMode>
      <wpml:takeOffSecurityHeight>${takeOffSecurityHeight}</wpml:takeOffSecurityHeight>
      <wpml:globalTransitionalSpeed>0.0</wpml:globalTransitionalSpeed>
    </wpml:missionConfig>
    <Folder>
      <wpml:globalHeight>0.0</wpml:globalHeight>
      <wpml:caliFlightEnable>0</wpml:caliFlightEnable>
      <wpml:autoFlightSpeed>0.0</wpml:autoFlightSpeed>
      <wpml:globalWaypointHeadingParam>
        ${headingModeTag}
      </wpml:globalWaypointHeadingParam>
      <wpml:globalWaypointTurnMode>${waypointTurnMode}</wpml:globalWaypointTurnMode>
      <wpml:globalUseStraightLine>1</wpml:globalUseStraightLine>
      <wpml:waylineCoordinateSysParam>
        <wpml:coordinateMode>WGS84</wpml:coordinateMode>
        <wpml:heightMode>${heightMode}</wpml:heightMode>
        <wpml:positioningType>GPS</wpml:positioningType>
      </wpml:waylineCoordinateSysParam>
      ${gimbalPitchModeTag}
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
            this.showNotification("Fehler bei der KMZ-Erstellung: " + err.message);
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
        if (!field) return;

        const nameSpan = document.querySelector(`.field-name[data-field-id="${id}"]`);
        if (!nameSpan) return;
        const currentName = field.name;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'field-name-edit-input';
        input.value = currentName;
        input.style.width = '120px';

        let isCancelled = false;
        const save = () => {
            if (isCancelled) return;
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                this.saveHistory();
                field.name = newName;
            }
            this.updateFieldList();
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                save();
            } else if (e.key === 'Escape') {
                isCancelled = true;
                this.updateFieldList();
            }
        });

        input.addEventListener('blur', save);

        nameSpan.replaceWith(input);
        input.focus();
        input.select();
    }

    deleteField(id) {
        if (!confirm('Sind Sie sicher, dass Sie diesen Schlag löschen möchten?')) return;
        const field = this.fields.find(f => String(f.id) === String(id));
        if (field) {
            this.saveHistory();
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

    saveHistory() {
        // Store current fields state
        const state = JSON.stringify(this.fields);
        this.history.push(state);
        if (this.history.length > 20) this.history.shift(); // Max 20 undo steps
        document.getElementById('btn-undo').disabled = false;
    }

    undo() {
        if (this.history.length === 0) return;

        const currentFpId = document.getElementById('fp-field-id').value;
        let activeFieldName = null;
        if (currentFpId) {
            const activeField = this.fields.find(f => String(f.id) === String(currentFpId));
            if (activeField) activeFieldName = activeField.name;
        }

        const lastState = JSON.parse(this.history.pop());
        this.fields = lastState;

        // Sync map
        this.mapManager.drawnItems.clearLayers();
        this.fields.forEach(field => {
            const layer = L.geoJSON(JSON.parse(field.geometry), {
                style: { color: '#3388ff', weight: 3, opacity: 0.5 }
            });
            layer.eachLayer(l => {
                this.mapManager.drawnItems.addLayer(l);
                field.id = L.stamp(l); // Update ID to match new layer
            });
        });

        this.updateFieldList();
        if (this.history.length === 0) {
            document.getElementById('btn-undo').disabled = true;
        }

        // Try to restore FP sidebar if active field still exists
        if (activeFieldName) {
            const restoredField = this.fields.find(f => f.name === activeFieldName);
            if (restoredField) {
                document.getElementById('fp-field-id').value = restoredField.id;
                // Re-generate flight plan for the restored field state
                this.generateFlightPlan();
            } else {
                this.closeFPSidebar.click();
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
                const prjString = fileMap['prj'] ? await fileMap['prj'].text() : null;

                const shpObj = shp.parseShp(shpBuffer, shxBuffer);
                const dbfObj = dbfBuffer ? shp.parseDbf(dbfBuffer) : null;
                const geoJson = await shp.combine([shpObj, dbfObj]);

                if (prjString) {
                    try {
                        const fromProj = prjString;
                        const toProj = 'EPSG:4326'; // WGS84

                        const reprojectCoords = (coords) => {
                            if (typeof coords[0] === 'number') {
                                return proj4(fromProj, toProj, coords);
                            }
                            return coords.map(reprojectCoords);
                        };

                        geoJson.features.forEach(feature => {
                            if (feature.geometry && feature.geometry.coordinates) {
                                feature.geometry.coordinates = reprojectCoords(feature.geometry.coordinates);
                            }
                        });
                    } catch (projErr) {
                        console.error('Reprojection failed', projErr);
                        this.showNotification('Koordinatentransformation fehlgeschlagen. .prj Datei wird evtl. nicht unterstützt.', 'warning');
                    }
                }

                this.addImportedGeoJson(geoJson);
            } catch (err) {
                console.error(err);
                this.showNotification('Fehler beim Verarbeiten der SHP-Datei: ' + err.message);
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
                } else if (extension === 'geojson' || extension === 'json') {
                    const geoJson = JSON.parse(e.target.result);
                    this.addImportedGeoJson(geoJson);
                } else if (extension === 'xml') {
                    this.parseISOXML(e.target.result);
                } else {
                    this.showNotification('Nicht unterstütztes Dateiformat.');
                }
            } catch (err) {
                console.error(err);
                this.showNotification('Fehler beim Verarbeiten der Datei: ' + err.message);
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
        const importedLayers = [];
        features.forEach(feature => {
            if (feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
                // Strip Z-coordinates
                const strip = (c) => (typeof c[0] === 'number') ? [c[0], c[1]] : c.map(strip);
                feature.geometry.coordinates = strip(feature.geometry.coordinates);

                // Create a clean 2D GeoJSON feature
                const cleanFeature = {
                    type: 'Feature',
                    properties: feature.properties || {},
                    geometry: {
                        type: feature.geometry.type,
                        coordinates: feature.geometry.coordinates
                    }
                };

                const layer = L.geoJSON(cleanFeature);
                layer.eachLayer(l => {
                    this.mapManager.drawnItems.addLayer(l);
                    this.mapManager.onFieldAdded(l, cleanFeature.properties.name || cleanFeature.properties.Name || null);
                    importedLayers.push(l);
                });
            }
        });
        if (importedLayers.length > 0) {
            const group = L.featureGroup(importedLayers);
            this.mapManager.map.fitBounds(group.getBounds());
        }
    }

    async refreshCustomerList() {
        try {
            const response = await fetch('../api/get_customers.php');
            const result = await response.json();
            if (result.success) {
                const select = document.getElementById('customer-select');
                const currentValue = select.value;
                select.innerHTML = '<option value="">-- Kunde wählen --</option>';

                const allOption = document.createElement('option');
                allOption.value = 'all';
                allOption.textContent = '-- Gesamt (Alle Kunden) --';
                select.appendChild(allOption);

                result.customers.forEach(c => {
                    const option = document.createElement('option');
                    option.value = c.id;
                    option.textContent = `${c.name}, ${c.first_name} ${c.company ? '(' + c.company + ')' : ''}`;
                    select.appendChild(option);
                });
                select.value = currentValue;
            }
        } catch (err) {
            console.error('Failed to refresh customer list', err);
        }
    }

    async loadAllCustomers() {
        try {
            const response = await fetch('../api/get_all_data.php');
            const result = await response.json();
            if (result.success) {
                this.currentCustomerId = 'all';
                this.mapManager.drawnItems.clearLayers();
                this.fields = [];
                this.allCustomersData = result.customers; // Store for lookup

                result.fields.forEach(f => {
                    const geoJson = JSON.parse(f.geometry);
                    this.mapManager.addFieldToMap({
                        type: 'Feature',
                        geometry: geoJson,
                        properties: { name: f.name }
                    }, f.name);

                    const fieldInApp = this.fields.find(fApp => fApp.name === f.name);
                    if (fieldInApp) {
                        fieldInApp.customer_id = f.customer_id;
                        fieldInApp.fp_path_distance = f.fp_path_distance;
                        fieldInApp.fp_border_distance = f.fp_border_distance;
                        fieldInApp.fp_min_dist = f.fp_min_dist;
                        fieldInApp.fp_orientation = f.fp_orientation;
                        fieldInApp.fp_speed = f.fp_speed;
                        fieldInApp.fp_height = f.fp_height;
                        fieldInApp.fp_mode = f.fp_mode;
                        fieldInApp.fp_clip_corners = f.fp_clip_corners;
                        fieldInApp.fp_terrain_following = f.fp_terrain_following;
                        fieldInApp.fp_show_wp_height = f.fp_show_wp_height;
                        fieldInApp.fp_height_mode = f.fp_height_mode;
                        fieldInApp.fp_drone_info = f.fp_drone_info;
                        fieldInApp.fp_payload_info = f.fp_payload_info;
                        fieldInApp.fp_finish_action = f.fp_finish_action;
                        fieldInApp.fp_rc_lost_action = f.fp_rc_lost_action;
                        fieldInApp.fp_execute_rc_lost_action = f.fp_execute_rc_lost_action;
                        fieldInApp.fp_fly_to_wayline_mode = f.fp_fly_to_wayline_mode;
                        fieldInApp.fp_takeoff_security_height = f.fp_takeoff_security_height;
                        fieldInApp.fp_waypoint_turn_mode = f.fp_waypoint_turn_mode;
                        fieldInApp.fp_waypoint_heading_mode = f.fp_waypoint_heading_mode;
                        fieldInApp.flight_path = f.flight_path;
                        fieldInApp.is_checked = f.is_checked;
                        fieldInApp.is_done = f.is_done;
                    }
                });

                this.updateFieldList();
                this.hideCustomerDataSection();
                this.showNotification('Alle Kunden und Schläge geladen.');
            }
        } catch (err) {
            console.error(err);
            this.showNotification('Fehler beim Laden aller Daten.');
        }
    }

    async loadCustomerData(id) {
        try {
            const response = await fetch(`../api/get_customer_data.php?id=${id}`);
            const result = await response.json();
            if (result.success) {
                this.currentCustomerId = id;
                const c = result.customer;

                // Populate Step 1
                document.getElementById('first_name').value = c.first_name;
                document.getElementById('name').value = c.name;
                document.getElementById('company').value = c.company;
                document.getElementById('street').value = c.street;
                document.getElementById('house_number').value = c.house_number;
                document.getElementById('postal_code').value = c.postal_code;
                document.getElementById('city').value = c.city;
                document.getElementById('email').value = c.email;
                document.getElementById('phone').value = c.phone;
                document.getElementById('comments').value = c.comments;
                document.getElementById('dsgvo').checked = c.dsgvo_accepted == 1;

                // Load Fields
                this.mapManager.drawnItems.clearLayers();
                this.fields = [];
                result.fields.forEach(f => {
                    const geoJson = JSON.parse(f.geometry);
                    this.mapManager.addFieldToMap({
                        type: 'Feature',
                        geometry: geoJson,
                        properties: { name: f.name }
                    }, f.name);
                });

                // Hydrate fields with saved FP parameters if they exist
                result.fields.forEach(f => {
                    const fieldInApp = this.fields.find(fApp => fApp.name === f.name);
                    if (fieldInApp) {
                        fieldInApp.fp_path_distance = f.fp_path_distance;
                        fieldInApp.fp_border_distance = f.fp_border_distance;
                        fieldInApp.fp_min_dist = f.fp_min_dist;
                        fieldInApp.fp_orientation = f.fp_orientation;
                        fieldInApp.fp_speed = f.fp_speed;
                        fieldInApp.fp_height = f.fp_height;
                        fieldInApp.fp_mode = f.fp_mode;
                        fieldInApp.fp_clip_corners = f.fp_clip_corners;
                        fieldInApp.fp_terrain_following = f.fp_terrain_following;
                        fieldInApp.fp_show_wp_height = f.fp_show_wp_height;
                        fieldInApp.fp_height_mode = f.fp_height_mode;
                        fieldInApp.fp_drone_info = f.fp_drone_info;
                        fieldInApp.fp_payload_info = f.fp_payload_info;
                        fieldInApp.fp_finish_action = f.fp_finish_action;
                        fieldInApp.fp_rc_lost_action = f.fp_rc_lost_action;
                        fieldInApp.fp_execute_rc_lost_action = f.fp_execute_rc_lost_action;
                        fieldInApp.fp_fly_to_wayline_mode = f.fp_fly_to_wayline_mode;
                        fieldInApp.fp_takeoff_security_height = f.fp_takeoff_security_height;
                        fieldInApp.fp_waypoint_turn_mode = f.fp_waypoint_turn_mode;
                        fieldInApp.fp_waypoint_heading_mode = f.fp_waypoint_heading_mode;
                        fieldInApp.flight_path = f.flight_path;
                        fieldInApp.is_checked = f.is_checked;
                        fieldInApp.is_done = f.is_done;

                        // Draw saved flight plan if it exists
                        if (f.flight_path) {
                            try {
                                const latlngs = JSON.parse(f.flight_path).map(p => L.latLng(p.lat, p.lng, p.alt));
                                if (latlngs.length > 0) {
                                    const fpLayer = L.polyline(latlngs, { color: 'red', weight: 2, opacity: 0.7, dashArray: '5, 5' });
                                    this.mapManager.drawnItems.addLayer(fpLayer);
                                }
                            } catch (e) {
                                console.warn("Failed to parse flight path for field " + f.name, e);
                            }
                        }
                    }
                });

                this.updateFieldList();
                this.displayCustomerData(c);

                this.showNotification(`Daten von ${c.name} geladen.`);
            }
        } catch (err) {
            console.error(err);
            this.showNotification('Fehler beim Laden der Kundendaten.');
        }
    }

    async deleteCustomer(id) {
        if (!confirm('Möchten Sie diesen Kunden und alle seine Schläge wirklich löschen?')) return;
        try {
            const response = await fetch('../api/delete_customer.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id })
            });
            const result = await response.json();
            if (result.success) {
                if (this.currentCustomerId == id) {
                    this.resetToNewCustomer();
                }
                this.refreshCustomerList();
                this.showNotification('Kunde gelöscht.');
            }
        } catch (err) {
            console.error(err);
        }
    }

    resetToNewCustomer() {
        this.currentCustomerId = null;
        document.getElementById('customer-form').reset();
        this.mapManager.drawnItems.clearLayers();
        this.fields = [];
        this.updateFieldList();
        this.hideCustomerDataSection();
        document.getElementById('customer-select').value = "";
        this.switchStep(1);
    }

    mirrorStep1ToStep2() {
        // Only mirror if we are not editing an existing customer
        if (this.currentCustomerId && this.currentCustomerId !== 'all') return;

        document.getElementById('cd-first_name').value = document.getElementById('first_name').value;
        document.getElementById('cd-name').value = document.getElementById('name').value;
        document.getElementById('cd-company').value = document.getElementById('company').value;
        document.getElementById('cd-street').value = document.getElementById('street').value;
        document.getElementById('cd-house_number').value = document.getElementById('house_number').value;
        document.getElementById('cd-postal_code').value = document.getElementById('postal_code').value;
        document.getElementById('cd-city').value = document.getElementById('city').value;
        document.getElementById('cd-email').value = document.getElementById('email').value;
        document.getElementById('cd-phone').value = document.getElementById('phone').value;
        document.getElementById('cd-comments').value = document.getElementById('comments').value;

        // Show customer data section in sidebar if it's not hidden by mode UI
        if (this.isAdminMode) {
            document.getElementById('customer-data-section').classList.remove('hidden');
            document.getElementById('customer-data-hr').classList.remove('hidden');
        }
    }

    displayCustomerData(c) {
        document.getElementById('customer-data-section').classList.remove('hidden');
        // document.getElementById('customer-data-section').classList.remove('collapsed'); // Should stay collapsed by default
        document.getElementById('customer-data-hr').classList.remove('hidden');

        document.getElementById('cd-id').value = c.id;
        document.getElementById('cd-first_name').value = c.first_name || '';
        document.getElementById('cd-name').value = c.name || '';
        document.getElementById('cd-company').value = c.company || '';
        document.getElementById('cd-street').value = c.street || '';
        document.getElementById('cd-house_number').value = c.house_number || '';
        document.getElementById('cd-postal_code').value = c.postal_code || '';
        document.getElementById('cd-city').value = c.city || '';
        document.getElementById('cd-email').value = c.email || '';
        document.getElementById('cd-phone').value = c.phone || '';
        document.getElementById('cd-comments').value = c.comments || '';
    }

    hideCustomerDataSection() {
        document.getElementById('customer-data-section').classList.add('hidden');
        document.getElementById('customer-data-hr').classList.add('hidden');
    }

    initSidebarLogic() {
        const leftSidebar = document.getElementById('left-sidebar');
        const rightSidebar = document.getElementById('flightplan-sidebar');
        const leftResizer = document.getElementById('left-resizer');
        const rightResizer = document.getElementById('right-resizer');
        const toggleLeft = document.getElementById('toggle-left-sidebar');
        const toggleRight = document.getElementById('toggle-right-sidebar');

        // Restore state from sessionStorage
        if (sessionStorage.getItem('leftSidebarCollapsed') === 'true') {
            leftSidebar.classList.add('collapsed');
            leftResizer.classList.add('hidden');
        }
        if (sessionStorage.getItem('rightSidebarCollapsed') === 'true' && !rightSidebar.classList.contains('hidden')) {
            rightSidebar.classList.add('collapsed');
            rightResizer.classList.add('hidden');
        }

        // Toggles
        toggleLeft.addEventListener('click', (e) => {
            e.stopPropagation();
            leftSidebar.classList.toggle('collapsed');
            const collapsed = leftSidebar.classList.contains('collapsed');
            leftResizer.classList.toggle('hidden', collapsed);
            sessionStorage.setItem('leftSidebarCollapsed', collapsed);
            setTimeout(() => this.mapManager.map.invalidateSize(), 300);
        });

        toggleRight.addEventListener('click', (e) => {
            e.stopPropagation();
            rightSidebar.classList.toggle('collapsed');
            const collapsed = rightSidebar.classList.contains('collapsed');
            rightResizer.classList.toggle('hidden', collapsed);
            sessionStorage.setItem('rightSidebarCollapsed', collapsed);
            setTimeout(() => this.mapManager.map.invalidateSize(), 300);
        });

        // Resizing
        const initResizer = (resizer, sidebar, side) => {
            let x = 0;
            let w = 0;

            const mouseDownHandler = (e) => {
                x = e.clientX;
                const styles = window.getComputedStyle(sidebar);
                w = parseInt(styles.width, 10);
                document.addEventListener('mousemove', mouseMoveHandler);
                document.addEventListener('mouseup', mouseUpHandler);
                resizer.classList.add('resizing');
            };

            const mouseMoveHandler = (e) => {
                const dx = e.clientX - x;
                const newWidth = side === 'left' ? w + dx : w - dx;
                if (newWidth > 100 && newWidth < 600) {
                    sidebar.style.width = `${newWidth}px`;
                    this.mapManager.map.invalidateSize();
                }
            };

            const mouseUpHandler = () => {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                resizer.classList.remove('resizing');
            };

            resizer.addEventListener('mousedown', mouseDownHandler);
        };

        initResizer(leftResizer, leftSidebar, 'left');
        initResizer(rightResizer, rightSidebar, 'right');
    }

    loadFPParametersIntoUI(field) {
        const setVal = (sliderId, inputId, valSpanId, val, isOrientation = false) => {
            const slider = document.getElementById(sliderId);
            const input = document.getElementById(inputId);
            const valSpan = document.getElementById(valSpanId);

            if (slider) slider.value = val;
            if (input) input.value = isOrientation && (val == 0 || val === "" || val === null) ? "" : val;
            if (valSpan) {
                if (isOrientation && (val == 0 || val === "" || val === null)) valSpan.textContent = "Auto";
                else valSpan.textContent = val;
            }
        };

        setVal('slider-fp-path-distance', 'fp-path-distance', 'val-fp-path-distance', field.fp_path_distance);
        setVal('slider-fp-border-distance', 'fp-border-distance', 'val-fp-border-distance', field.fp_border_distance);
        setVal('slider-fp-min-dist', 'fp-min-dist', 'val-fp-min-dist', field.fp_min_dist);
        setVal('slider-fp-orientation', 'fp-orientation', 'val-fp-orientation', field.fp_orientation, true);
        setVal('slider-fp-speed', 'fp-speed', 'val-fp-speed', field.fp_speed);
        setVal('slider-fp-height', 'fp-height', 'val-fp-height', field.fp_height);

        if (field.fp_mode === 'smartplus') {
            document.getElementById('fp-mode').value = 'smartplus';
        } else {
            document.getElementById('fp-mode').value = field.fp_mode || 'zigzag';
        }
        document.getElementById('fp-clip-corners').checked = field.fp_clip_corners == 1;
        document.getElementById('fp-terrain-following').checked = field.fp_terrain_following == 1;
        document.getElementById('fp-show-wp-height').checked = field.fp_show_wp_height == 1;
        document.getElementById('fp-height-mode').value = field.fp_height_mode || 'relativeToStartPoint';
        document.getElementById('fp-drone-info').value = field.fp_drone_info || '60';
        document.getElementById('fp-payload-info').value = field.fp_payload_info || 'none';
        document.getElementById('fp-finish-action').value = field.fp_finish_action || 'goHome';
        document.getElementById('fp-rc-lost-action').value = field.fp_rc_lost_action || 'executeLostAction';
        document.getElementById('fp-execute-rc-lost-action').value = field.fp_execute_rc_lost_action || 'goBack';
        document.getElementById('fp-fly-to-wayline-mode').value = field.fp_fly_to_wayline_mode || 'safely';
        document.getElementById('fp-takeoff-security-height').value = field.fp_takeoff_security_height || field.fp_height || '15';
        document.getElementById('fp-waypoint-turn-mode').value = field.fp_waypoint_turn_mode || 'coordinateTurn';
        document.getElementById('fp-waypoint-heading-mode').value = field.fp_waypoint_heading_mode || 'followWayline';

        // Trigger UI updates
        this.terrainFollowingCheckbox.dispatchEvent(new Event('change'));
        document.getElementById('fp-rc-lost-action').dispatchEvent(new Event('change'));
    }

    async submitApplication() {
        if (this.fields.length === 0) {
            if (!confirm('Keine Schläge hinzugefügt. Trotzdem absenden?')) return;
        }

        const formData = new FormData();

        const getFieldCustomerId = (f) => {
            if (this.currentCustomerId === 'all') return f.customer_id;
            return this.currentCustomerId;
        };

        if (this.currentCustomerId === 'all') {
            formData.append('is_multi_customer', '1');
        }

        const isStep2 = !this.step2.classList.contains('hidden');
        const prefix = isStep2 ? 'cd-' : '';
        const cid = isStep2 ? document.getElementById('cd-id').value : this.currentCustomerId;

        if (cid && cid !== 'all') {
            formData.append('customer_id', cid);
        }

        // Always use Step 2 data if available and we're on Step 2
        const sourcePrefix = isStep2 ? 'cd-' : '';
        formData.append('customer_first_name', document.getElementById(sourcePrefix + 'first_name').value);
        formData.append('customer_name', document.getElementById(sourcePrefix + 'name').value);
        formData.append('customer_company', document.getElementById(sourcePrefix + 'company').value);
        formData.append('customer_street', document.getElementById(sourcePrefix + 'street').value);
        formData.append('customer_house_number', document.getElementById(sourcePrefix + 'house_number').value);
        formData.append('customer_postal_code', document.getElementById(sourcePrefix + 'postal_code').value);
        formData.append('customer_city', document.getElementById(sourcePrefix + 'city').value);
        formData.append('customer_email', document.getElementById(sourcePrefix + 'email').value);
        if (document.getElementById(sourcePrefix + 'password')) {
            formData.append('customer_password', document.getElementById(sourcePrefix + 'password').value);
        }
        if (document.getElementById(sourcePrefix + 'password_confirm')) {
            formData.append('password_confirm', document.getElementById(sourcePrefix + 'password_confirm').value);
        }
        formData.append('customer_phone', document.getElementById(sourcePrefix + 'phone').value);
        formData.append('customer_comments', document.getElementById(sourcePrefix + 'comments').value);
        formData.append('customer_dsgvo_accepted', document.getElementById('dsgvo').checked ? 1 : 0);

        // Honeypot
        formData.append('website', document.getElementById('website').value);

        this.fields.forEach((field, index) => {
            formData.append(`fields[${index}][customer_id]`, getFieldCustomerId(field));
            formData.append(`fields[${index}][name]`, field.name);
            formData.append(`fields[${index}][geometry]`, field.geometry);
            formData.append(`fields[${index}][area]`, field.area);

            // Add FP parameters from the field object
            formData.append(`fields[${index}][fp_path_distance]`, field.fp_path_distance ?? 10);
            formData.append(`fields[${index}][fp_border_distance]`, field.fp_border_distance ?? 5);
            formData.append(`fields[${index}][fp_min_dist]`, field.fp_min_dist ?? 5);
            formData.append(`fields[${index}][fp_orientation]`, field.fp_orientation ?? 0);
            formData.append(`fields[${index}][fp_speed]`, field.fp_speed ?? 10);
            formData.append(`fields[${index}][fp_height]`, field.fp_height ?? 15);
            formData.append(`fields[${index}][fp_mode]`, field.fp_mode ?? 'zigzag');
            formData.append(`fields[${index}][fp_clip_corners]`, field.fp_clip_corners ?? 1);
            formData.append(`fields[${index}][fp_terrain_following]`, field.fp_terrain_following ?? 0);
            formData.append(`fields[${index}][fp_show_wp_height]`, field.fp_show_wp_height ?? 0);
            formData.append(`fields[${index}][fp_height_mode]`, field.fp_height_mode ?? 'relativeToStartPoint');
            formData.append(`fields[${index}][fp_drone_info]`, field.fp_drone_info ?? '60');
            formData.append(`fields[${index}][fp_payload_info]`, field.fp_payload_info ?? 'none');
            formData.append(`fields[${index}][fp_finish_action]`, field.fp_finish_action ?? 'goHome');
            formData.append(`fields[${index}][fp_rc_lost_action]`, field.fp_rc_lost_action ?? 'executeLostAction');
            formData.append(`fields[${index}][fp_execute_rc_lost_action]`, field.fp_execute_rc_lost_action ?? 'goBack');
            formData.append(`fields[${index}][fp_fly_to_wayline_mode]`, field.fp_fly_to_wayline_mode ?? 'safely');
            formData.append(`fields[${index}][fp_takeoff_security_height]`, field.fp_takeoff_security_height ?? 2);
            formData.append(`fields[${index}][fp_waypoint_turn_mode]`, field.fp_waypoint_turn_mode ?? 'coordinateTurn');
            formData.append(`fields[${index}][fp_waypoint_heading_mode]`, field.fp_waypoint_heading_mode ?? 'followWayline');

            const currentId = document.getElementById('fp-field-id').value;
            if (String(field.id) === String(currentId) && this.currentFlightPath) {
                const latlngs = this.getCurrentFlightPathLatLngs();
                const points = latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng, alt: ll.alt }));
                formData.append(`fields[${index}][flight_path]`, JSON.stringify(points));
            } else if (field.flight_path) {
                // Already a JSON string
                formData.append(`fields[${index}][flight_path]`, field.flight_path);
            }
        });

        try {
            const response = await fetch('../api/submit_application.php', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.success) {
                this.showNotification('Antrag erfolgreich abgesendet! Ihre Daten und Schläge wurden gespeichert.', 'success');
                // location.reload(); // Removed to stay on page
            } else {
                this.showNotification('Fehler: ' + result.message, 'error');
            }
        } catch (err) {
            console.error(err);
            this.showNotification('Beim Absenden ist ein Fehler aufgetreten.', 'error');
        }
    }

    toggleManualSplit() {
        this.manualSplitMode = !this.manualSplitMode;
        if (this.manualSplitMode) {
            this.btnManualSplit.classList.add('success');
            this.btnManualSplit.textContent = 'Fertig';
            this.mapManager.map.on('click', this.onMapSplitClick, this);
            // Disable other interactions if needed
        } else {
            this.btnManualSplit.classList.remove('success');
            this.btnManualSplit.textContent = 'Teilung manuell';
            this.mapManager.map.off('click', this.onMapSplitClick, this);

            if (this.splitMarkers.length === 2) {
                this.performManualSplit();
            }

            this.splitMarkers.forEach(m => this.mapManager.map.removeLayer(m));
            this.splitMarkers = [];
            if (this.manualSplitLine) {
                this.mapManager.map.removeLayer(this.manualSplitLine);
                this.manualSplitLine = null;
            }
        }
    }

    onMapSplitClick(e) {
        if (this.splitMarkers.length >= 2) return;

        const marker = L.marker(e.latlng, { draggable: true }).addTo(this.mapManager.map);
        marker.on('drag', () => this.updateManualSplitLine());
        this.splitMarkers.push(marker);

        this.updateManualSplitLine();

        if (this.splitMarkers.length === 2) {
            // Automatically finalize split after two markers
            setTimeout(() => this.toggleManualSplit(), 200);
        }
    }

    updateManualSplitLine() {
        const latlngs = this.splitMarkers.map(m => m.getLatLng());
        if (this.manualSplitLine) {
            this.manualSplitLine.setLatLngs(latlngs);
        } else if (latlngs.length > 0) {
            this.manualSplitLine = L.polyline(latlngs, { color: 'yellow', dashArray: '5, 10' }).addTo(this.mapManager.map);
        }
    }

    performManualSplit() {
        const latlngs = this.splitMarkers.map(m => m.getLatLng());
        if (latlngs.length < 2) return;

        const fieldId = document.getElementById('fp-field-id').value;
        const field = this.fields.find(f => String(f.id) === String(fieldId));
        if (!field) return;

        const poly = turf.polygon(JSON.parse(field.geometry).coordinates);
        const p1 = turf.point([latlngs[0].lng, latlngs[0].lat]);
        const p2 = turf.point([latlngs[1].lng, latlngs[1].lat]);
        const angle = turf.bearing(p1, p2);

        try {
            const extendedLine = turf.lineString([
                turf.destination(p1, 10, angle + 180, { units: 'kilometers' }).geometry.coordinates,
                turf.destination(p2, 10, angle, { units: 'kilometers' }).geometry.coordinates
            ]);

            const bufferedLine = turf.buffer(extendedLine, 0.01, { units: 'meters' });
            const remaining = turf.difference(poly, bufferedLine);

            console.log("Split attempt:", {
                poly: poly,
                line: extendedLine,
                result: remaining
            });

            let parts = [];
            if (remaining) {
                if (remaining.geometry && remaining.geometry.type === 'MultiPolygon') {
                    parts = remaining.geometry.coordinates.map(c => turf.polygon(c));
                } else if (remaining.geometry && remaining.geometry.type === 'Polygon') {
                    parts = [remaining];
                } else if (remaining.type === 'FeatureCollection') {
                    parts = remaining.features.filter(f => f.geometry.type === 'Polygon');
                } else if (remaining.type === 'MultiPolygon') {
                    parts = remaining.coordinates.map(c => turf.polygon(c));
                }
            }

            console.log("Split parts found:", parts.length);

            if (parts.length >= 2) {
                field.manualParts = parts;
                document.getElementById('fp-mode').value = 'smart';
                this.generateFlightPlan();
            } else {
            this.showNotification("Teilung fehlgeschlagen. Die Linie muss den Schlag komplett schneiden. Gefundene Teile: " + parts.length, 'error');
            }
        } catch (e) {
            console.error("Split failed", e);
        this.showNotification("Fehler bei der Teilung: " + e.message, 'error');
        }
    }
}

const app = new App();
window.app = app;
