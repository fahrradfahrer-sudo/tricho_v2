import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Test Step 1 Enter Key
        await page.goto("http://localhost:8000")
        await page.fill("#name", "Test Name")
        await page.fill("#email", "test@example.com")
        await page.check("#dsgvo")
        await page.fill("#postal_code", "67245")

        print("Pressing Enter in Step 1...")
        await page.press("#postal_code", "Enter")

        # Wait a bit for transition
        await asyncio.sleep(2)

        # Check if step 2 is visible
        is_step2_visible = await page.is_visible("#step-2")
        print(f"Step 2 visible after Step 1 Enter: {is_step2_visible}")
        await page.screenshot(path="step1_enter_result.png")

        # Test Step 2 Search Enter Key
        if is_step2_visible:
            await page.fill("#search-postal-code", "10115")
            print("Pressing Enter in Step 2 Search...")
            await page.press("#search-postal-code", "Enter")
            await asyncio.sleep(2)
            await page.screenshot(path="step2_search_result.png")
            print("Step 2 search screenshot saved.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
