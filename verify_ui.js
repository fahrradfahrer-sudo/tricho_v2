const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to the app (assuming server is running on 8000)
    await page.goto('http://localhost:8000/public/index.html');

    // Check default mode (Admin)
    const modeLabel = await page.innerText('#mode-label');
    console.log('Current mode:', modeLabel);

    // Verify Kundendaten is present but hidden initially
    const customerDataSection = await page.$('#customer-data-section');
    const isHidden = await customerDataSection.evaluate(el => el.classList.contains('hidden'));
    console.log('Kundendaten hidden initially:', isHidden);

    const isCollapsed = await customerDataSection.evaluate(el => el.classList.contains('collapsed'));
    console.log('Kundendaten collapsed initially:', isCollapsed);

    // Switch to Step 2
    await page.fill('#name', 'Tester');
    await page.fill('#email', 'test@example.com');
    await page.click('#dsgvo');
    await page.click('#btn-next-step');

    // Wait for step 2 to load
    await page.waitForSelector('#step-2:not(.hidden)');

    // Take Admin screenshot
    await page.screenshot({ path: 'admin_step2.png' });

    // Switch to Benutzer mode
    await page.click('#mode-switch');
    const newModeLabel = await page.innerText('#mode-label');
    console.log('New mode:', newModeLabel);

    // Wait for UI update
    await page.waitForTimeout(500);

    // Check if Kundenverwaltung and Kundendaten are hidden
    const kundenVerwaltung = await page.$('.customer-tools');
    const isKVHidden = await kundenVerwaltung.evaluate(el => el.classList.contains('hidden'));
    console.log('Kundenverwaltung hidden in Benutzer mode:', isKVHidden);

    const isCDHidden = await customerDataSection.evaluate(el => el.classList.contains('hidden'));
    console.log('Kundendaten hidden in Benutzer mode:', isCDHidden);

    // Take Benutzer screenshot
    await page.screenshot({ path: 'benutzer_step2.png' });

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();
