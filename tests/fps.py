import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1280,'height':650})
        await pg.goto('http://127.0.0.1:4173/'); await pg.wait_for_timeout(2000)
        await pg.keyboard.press('Enter'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(3000)
        a = await pg.evaluate("window.__hc.S.frames"); await pg.wait_for_timeout(2000); c = await pg.evaluate("window.__hc.S.frames")
        print('fps', (c-a)/2)
        await pg.evaluate("window.__hc.cpuOn(false)")
        await pg.evaluate("(() => { const f = window.__hc.match.f[0]; f.x=-2; f.state='idle'; f.stamina=100; })()")
        await pg.keyboard.down('a'); await pg.wait_for_timeout(300); await pg.keyboard.up('a')
        print(await pg.evaluate("(() => { const f = window.__hc.match.f[0]; return [f.x, f.state, f.grounded, JSON.stringify(f.intent), window.__hc.match.phase] })()"))
        await pg.keyboard.press('r'); await pg.wait_for_timeout(40)
        print(await pg.evaluate("(() => { const f = window.__hc.match.f[0]; return [f.state, f.t, f.stamina, f.label] })()"))
        await b.close()
asyncio.run(main())
