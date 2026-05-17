import asyncio
from playwright.async_api import async_playwright

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Start the PHP server
        process = await asyncio.create_subprocess_exec(
            "php", "-S", "localhost:8000", "-t", "public",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        try:
            await asyncio.sleep(2)
            await page.goto("http://localhost:8000")

            # Screenshot 1: Login View (Default)
            await page.screenshot(path="verify_login.png")

            # Screenshot 2: Registration View
            await page.click("text=Benutzerkonto erstellen")
            await page.screenshot(path="verify_registration.png")

            # Screenshot 3: Step 2 (Manually switch if possible)
            # Since we can't easily bypass login without valid data, let's try to inject a switch
            await page.evaluate("switchStep(2)")
            await asyncio.sleep(1)
            # Open the sidebar if needed
            await page.screenshot(path="verify_step2.png")

        finally:
            process.terminate()
            await process.wait()

asyncio.run(verify())
