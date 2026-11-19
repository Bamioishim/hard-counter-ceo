import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1280,'height':650})
        errs=[]
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
        await pg.goto('http://127.0.0.1:4173/'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path='shots/dev-select.png')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300); await pg.keyboard.press('Enter')
        await pg.wait_for_timeout(4500)
        await pg.screenshot(path='shots/dev-fight.png')
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
