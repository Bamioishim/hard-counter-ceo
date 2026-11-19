# Landscape/portrait HUD screenshots mid-fight. Usage: python3 tests/hudshots.py <prefix> [url]
import asyncio, sys
from playwright.async_api import async_playwright
PFX = sys.argv[1]; URL = sys.argv[2] if len(sys.argv) > 2 else 'http://127.0.0.1:4173/'
ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
SIZES = [('844x390', 844, 390), ('932x430', 932, 430), ('portrait-390x664', 390, 664)]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        for name, w, h in SIZES:
            ctx = await b.new_context(**{**p.devices['iPhone 13'], 'viewport': {'width': w, 'height': h}, 'screen': {'width': w, 'height': h}})
            pg = await ctx.new_page(); await pg.goto(URL); await pg.wait_for_timeout(2500)
            await pg.tap('.card:nth-child(1)'); await pg.wait_for_timeout(200); await pg.tap('.card:nth-child(2)')
            await pg.wait_for_function("window.__hc.match.phase==='fight'", timeout=15000)
            await pg.evaluate("window.__hc.cpuOn(false)")
            await pg.evaluate("(()=>{const m=window.__hc.match; m.f[0].x=-1.2; m.f[1].x=1.2; m.f[0].knock=46; m.f[1].knock=82; m.f[0].stamina=64; m.f[0].hype=40; m.f[1].hype=70; m.f[1].stamina=30;})()")
            await pg.wait_for_timeout(1200)
            await pg.evaluate("window.__hc.match.f[0].intent.heavy=1")
            await pg.wait_for_function("document.getElementById('status1').textContent.length>0", timeout=3000)
            info = await pg.evaluate("""(()=>{const r=(s)=>document.querySelector(s).getBoundingClientRect(); const a=r('.hud-side.p1'), t=r('.top'), c=r('.hud-center'), pd=r('.pad-left'); return {hudBottom:Math.round(Math.max(a.bottom,c.bottom)), topRow:Math.round(t.bottom), padTop:Math.round(pd.top), h:innerHeight}})()""")
            print(name, info, 'hud % of height:', round(100*info['hudBottom']/info['h']))
            await pg.screenshot(path=f'shots/{PFX}-{name}.png'); await ctx.close()
        await b.close()
asyncio.run(main())
