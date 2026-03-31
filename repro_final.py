import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Go to the app
        await page.goto('http://localhost:8000/public/index.html')

        # Step 1: Fill in details
        print("Testing Step 1 Enter...")
        await page.fill('#first_name', 'Test')
        await page.fill('#name', 'User') # Corrected from #last_name to #name
        await page.fill('#email', 'test@example.com')
        await page.fill('#postal_code', '67245')
        await page.check('#dsgvo')

        # Press Enter on postal code
        await page.focus('#postal_code')
        await page.keyboard.press('Enter')

        # Wait a bit to see if step 2 becomes visible
        await asyncio.sleep(1)
        step2_visible = await page.is_visible('#step-2')
        print(f"Step 2 visible after Enter in Step 1: {step2_visible}")

        # Now test Step 2 search
        if not step2_visible:
            # Click next button manually to proceed if Enter didn't work
            await page.click('#btn-next-step')
            await asyncio.sleep(1)

        print("Testing Step 2 Postal Code Search...")
        await page.fill('#search-postal-code', '10115') # Berlin
        await page.focus('#search-postal-code')

        # Intercept console logs
        logs = []
        page.on("console", lambda msg: logs.append(msg.text))

        await page.keyboard.press('Enter')

        # Wait for potential geocoding
        await asyncio.sleep(2)

        # Take a screenshot to see if map moved (center should not be Dirmstein)
        await page.screenshot(path='step2_search_result.png')
        print(f"Console logs: {logs}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
