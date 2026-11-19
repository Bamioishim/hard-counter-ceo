import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1600,'height':760})
        await pg.goto('http://127.0.0.1:4173/?lineup'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path='shots/weapons-lineup.png')
        await b.close()
asyncio.run(main())
