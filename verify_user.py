import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()

        # Go to the app - root which redirects to index.php or public/index.html
        await page.goto("http://localhost:8000/public/index.html")

        # Wait for the form to be visible
        try:
            await page.wait_for_selector("#auth-form", state="visible", timeout=10000)
        except:
            print("Auth form not found")
            await page.screenshot(path="no_form.png")
            content = await page.content()
            print(content[:1000])
            await browser.close()
            return

        # Take a screenshot of the login page
        await page.screenshot(path="login_page.png")

        # Login as a regular user
        await page.fill("#email", "test@example.com")
        await page.fill("#password", "test")

        # Click the login button using ID
        await page.click("#auth-submit-btn")

        # Wait for Step 2
        try:
            await page.wait_for_selector("#step2", state="visible", timeout=10000)
            print("Logged in successfully, Step 2 visible")
        except:
            print("Step 2 not visible, login might have failed")
            await page.screenshot(path="login_failed.png")
            await browser.close()
            return

        # Check if Kundenverwaltung is hidden
        is_visible = await page.is_visible("#kundenverwaltung-heading")
        print(f"User Kundenverwaltung heading visible: {is_visible}")

        # Take screenshot of Step 2
        await page.screenshot(path="user_step2.png")

        # Logout
        await page.click(".user-dropdown")
        await page.click("text=Abmelden")

        # Wait for Step 1
        await page.wait_for_selector("#step1", state="visible")
        print("Logged out successfully, Step 1 visible")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
