import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto('http://localhost:8000')

        # Test Step 1 Postal Code Enter
        print("Testing Step 1 Postal Code Enter...")
        postal_code_input = await page.query_selector('#postal_code')
        await postal_code_input.fill('10115')
        await postal_code_input.press('Enter')

        # Check if we moved to step 2 or anything happened
        step2_visible = await page.is_visible('#step-2')
        print(f"Step 2 visible after Step 1 Postal Code Enter: {step2_visible}")

        # Fill step 1 and move to step 2 manually
        await page.fill('#name', 'Test')
        await page.fill('#email', 'test@example.com')
        await page.check('#dsgvo')
        await page.click('#btn-next-step')

        # Test Step 2 Postal Code Search
        print("Testing Step 2 Postal Code Search...")
        await page.fill('#search-postal-code', '67245')
        await page.press('#search-postal-code', 'Enter')

        # Take a screenshot to see if map moved (manually check)
        await page.wait_for_timeout(2000)
        await page.screenshot(path='step2_search_enter.png')
        print("Screenshot 'step2_search_enter.png' taken.")

        # Test Field Area Sum
        print("Testing Field Area Sum...")
        # Manually draw a polygon via JS to simulate drawing
        await page.evaluate("""
            const latlngs = [[49.56, 8.24], [49.57, 8.24], [49.57, 8.25], [49.56, 8.25]];
            const polygon = L.polygon(latlngs);
            window.app.mapManager.onFieldAdded(polygon, "Test-Schlag");
        """)

        await page.wait_for_timeout(500)
        total_area_text = await page.inner_text('#field-list')
        print(f"Field list content after drawing: {total_area_text}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
