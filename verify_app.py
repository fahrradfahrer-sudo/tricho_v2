import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # 1. Load Step 1
        await page.goto("http://localhost:8000/public/index.html")
        await page.wait_for_selector("#customer-form")
        print("Step 1 loaded.")

        # Capture screenshot of Step 1
        await page.screenshot(path="step1.png")

        # 2. Fill Step 1
        await page.fill("#name", "John Doe")
        await page.fill("#email", "john.doe@example.com")
        await page.fill("#phone", "123456789")
        await page.click("#btn-next-step")
        print("Navigated to Step 2.")

        # 3. Verify Step 2 (Map)
        await page.wait_for_selector("#map")
        # Wait a bit for Leaflet to initialize
        await asyncio.sleep(2)
        print("Step 2 (Map) loaded.")

        # Capture screenshot of Step 2
        await page.screenshot(path="step2.png")

        # 4. Simulate adding a field (via JS because drawing manually in playwright is tricky)
        # We'll call the internal addFieldToMap method
        test_geojson = {
            "type": "Feature",
            "properties": {"name": "Test Field"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[11.58, 48.13], [11.59, 48.13], [11.59, 48.14], [11.58, 48.14], [11.58, 48.13]]]
            }
        }
        await page.evaluate(f"app.addImportedGeoJson({test_geojson})")
        print("Field added via JS simulation.")

        # Wait for field list to update
        await page.wait_for_selector(".field-item")
        print("Field list updated.")

        # 5. Submit Application
        # Mocking alert to avoid blocking
        await page.evaluate("window.alert = () => {}")
        await page.click("#btn-submit")
        print("Application submitted.")

        # Wait for reload (simulated by checking if step 1 is back)
        await page.wait_for_selector("#step-1")
        print("Application reset after submission.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
