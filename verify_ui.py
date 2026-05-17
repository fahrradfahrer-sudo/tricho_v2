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
            await asyncio.sleep(2)  # Wait for server to start
            await page.goto("http://localhost:8000")

            # 1. Check for "Passwort vergessen" link
            forgot_password = await page.query_selector("text=Passwort vergessen?")
            if forgot_password:
                print("SUCCESS: 'Passwort vergessen?' link found.")
            else:
                print("FAILURE: 'Passwort vergessen?' link NOT found.")

            # 2. Check for "Passwort wiederholen" field in registration
            # Toggle to registration
            await page.click("text=Benutzerkonto erstellen")
            repeat_password = await page.query_selector("input[name='password_confirm']")
            if repeat_password:
                print("SUCCESS: 'Passwort wiederholen' field found in registration.")
            else:
                print("FAILURE: 'Passwort wiederholen' field NOT found in registration.")

            # Take a screenshot of Step 1
            await page.screenshot(path="verify_step1.png")
            print("Screenshot verify_step1.png saved.")

            # 3. Check that password fields are NOT in Step 2 sidebar
            # We need to log in or bypass to Step 2.
            # Since we can't easily log in without a real DB entry, let's just check the HTML or try to switch step if possible.
            # Actually, I can just check if the fields exist in the DOM at all.
            cd_password = await page.query_selector("#cd-password")
            if not cd_password:
                print("SUCCESS: #cd-password NOT found (as expected).")
            else:
                print("FAILURE: #cd-password found in Step 2 sidebar.")

            # 4. Check Flight Mode dropdown for "Genius"
            # Switch to Step 2 manually by triggering the function if possible, or just look at the HTML
            # The dropdown is in Step 2, which might be hidden.
            genius_option = await page.query_selector("select#fp-mode option[value='genius']")
            if genius_option:
                print("SUCCESS: 'Genius' flight mode option found.")
            else:
                print("FAILURE: 'Genius' flight mode option NOT found.")

        finally:
            process.terminate()
            await process.wait()

asyncio.run(verify())
