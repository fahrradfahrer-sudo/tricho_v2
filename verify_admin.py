import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()

        # Go to the app
        await page.goto("http://localhost:8000")

        # Login as admin
        await page.fill("#email", "mwitt3d@gmail.com")
        await page.fill("#password", "password")
        await page.click("button[type='submit']")

        # Wait for Step 2
        await page.wait_for_selector("#step2", state="visible")

        # Check if Kundenverwaltung is visible
        is_visible = await page.is_visible("h3:has-text('Kundenverwaltung')")
        print(f"Admin Kundenverwaltung visible: {is_visible}")

        # Take screenshot
        await page.screenshot(path="admin_view.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
