import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        await page.goto('http://localhost:8000')

        # Step 1: Fill postal code and press Enter
        print("Testing Step 1 Enter...")
        await page.fill('#postal_code', '67245')
        await page.press('#postal_code', 'Enter')
        await asyncio.sleep(1)

        # Check if we moved to Step 2
        is_step2_visible = await page.is_visible('#step2')
        print(f"Step 2 visible after Enter in Step 1: {is_step2_visible}")

        # If not visible, click the button to go to Step 2
        if not is_step2_visible:
            # Fill required fields first
            await page.fill('#first_name', 'Jules')
            await page.fill('#last_name', 'Engineer')
            await page.check('#dsgvo')
            await page.click('button:has-text("Weiter zu Schritt 2")')
            print("Moved to Step 2 by clicking button.")

        # Step 2: Test postal code search Enter
        print("Testing Step 2 Enter...")
        await page.wait_for_selector('#search-postal-code')
        await page.fill('#search-postal-code', '10115')

        # Get map center before search
        center_before = await page.evaluate("() => { return {lat: app.mapManager.map.getCenter().lat, lng: app.mapManager.map.getCenter().lng} }")
        print(f"Center before: {center_before}")

        await page.press('#search-postal-code', 'Enter')
        print("Pressed Enter in Step 2 search.")
        await asyncio.sleep(3) # Wait for geocoding

        center_after = await page.evaluate("() => { return {lat: app.mapManager.map.getCenter().lat, lng: app.mapManager.map.getCenter().lng} }")
        print(f"Center after: {center_after}")

        if center_before['lat'] != center_after['lat'] or center_before['lng'] != center_after['lng']:
            print("Map moved!")
        else:
            print("Map did NOT move.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
