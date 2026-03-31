import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        await page.goto("http://localhost:8000/public/index.html")
        print("App content:")
        content = await page.content()
        # Just print the first 500 chars to avoid clutter
        print(content[:500])

        # Take a screenshot to be sure
        await page.screenshot(path="debug_index.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
