# Mobile + desktop regression test for stuck buttons and stuck zoom. Needs `npm run preview` on :4173.
import asyncio, sys
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/'
ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
fails = []
def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{info}]' if info else ''))
    if not ok: fails.append(name)

async def center(pg, sel):
    bb = await pg.locator(sel).bounding_box(); return bb['x'] + bb['width']/2, bb['y'] + bb['height']/2, bb

async def touch(cdp, typ, pts):
    await cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in pts]})

async def tap_sel(pg, cdp, sel):
    x, y, _ = await center(pg, sel)
    await touch(cdp, 'touchStart', [(0, (x, y))]); await pg.wait_for_timeout(40); await touch(cdp, 'touchEnd', [])

async def intent(pg): return await pg.evaluate("JSON.stringify(window.__hc.match.f[0].intent)")
async def held(pg): return await pg.evaluate("(()=>{const i=window.__hc.match.f[0].intent;return [i.left,i.right,i.down,i.charge].some(Boolean)})()")
async def scale(pg): return await pg.evaluate("window.visualViewport ? visualViewport.scale : 1")

async def pads_hittable(pg, tag):
    bad = await pg.evaluate("""() => [...document.querySelectorAll('.pad-grid button')].filter(b => b.offsetParent).flatMap(b => {
      const r = b.getBoundingClientRect(); const out = [];
      for (const [fx, fy] of [[.5,.5],[.15,.15],[.85,.85],[.5,.92],[.1,.9]]) { const el = document.elementFromPoint(r.left + r.width*fx, r.top + r.height*fy); if (!el || !b.contains(el)) out.push(b.dataset.k + '@' + fx + ',' + fy + '->' + (el ? (el.id || el.className || el.tagName) : 'null')); }
      return out; })""")
    check(f'{tag}: every pad button fully tappable (no overlay)', not bad, bad[:6])

async def wait_phase(pg, ph, t=20000): await pg.wait_for_function(f"window.__hc.match && window.__hc.match.phase === '{ph}'", timeout=t)

async def fight_checks(pg, cdp, tag):
    await wait_phase(pg, 'fight')
    await pg.evaluate("window.__hc.cpuOn(false)")
    await pads_hittable(pg, tag)
    L = await center(pg, '[data-k=left]'); R = await center(pg, '[data-k=right]'); C = await center(pg, '[data-k=charge]')
    LI = await center(pg, '[data-k=light]'); H = await center(pg, '[data-k=heavy]'); J = await center(pg, '[data-k=up]')
    # two fingers: hold LEFT + CHARGE, then lift both
    await touch(cdp, 'touchStart', [(0, L[:2])]); await touch(cdp, 'touchStart', [(0, L[:2]), (1, C[:2])]); await pg.wait_for_timeout(120)
    it = await intent(pg); check(f'{tag}: 2-finger hold left+charge registers', '"left":true' in it and '"charge":true' in it, it)
    await touch(cdp, 'touchEnd', [(1, C[:2])]); await pg.wait_for_timeout(30); await touch(cdp, 'touchEnd', [])
    await pg.wait_for_timeout(60); check(f'{tag}: both released after lift', not await held(pg), await intent(pg))
    # finger slides off the button and lifts elsewhere
    await touch(cdp, 'touchStart', [(0, R[:2])]); await touch(cdp, 'touchMove', [(0, (R[0], R[1] - 200))]); await touch(cdp, 'touchEnd', [])
    await pg.wait_for_timeout(60); check(f'{tag}: slide-off then lift releases RIGHT', not await held(pg), await intent(pg))
    # touch cancelled by the OS
    await touch(cdp, 'touchStart', [(0, C[:2])]); await pg.wait_for_timeout(60); await touch(cdp, 'touchCancel', [])
    await pg.wait_for_timeout(60); check(f'{tag}: touchcancel releases CHARGE', not await held(pg), await intent(pg))
    # app goes to background while holding
    await touch(cdp, 'touchStart', [(0, L[:2])]); await pg.wait_for_timeout(60)
    await pg.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden")
    check(f'{tag}: hidden tab releases + pauses', not await held(pg) and await pg.evaluate("window.__hc.S.paused"), await intent(pg))
    await touch(cdp, 'touchEnd', []); await tap_sel(pg, cdp, '#btnResume'); await pg.wait_for_timeout(150)
    check(f'{tag}: resume works by tap', not await pg.evaluate("window.__hc.S.paused"))
    # rapid multi-touch mash: 3 fingers, 25 bursts
    for k in range(25):
        await touch(cdp, 'touchStart', [(0, LI[:2])]); await touch(cdp, 'touchStart', [(0, LI[:2]), (1, H[:2])]); await touch(cdp, 'touchStart', [(0, LI[:2]), (1, H[:2]), (2, J[:2])])
        await touch(cdp, 'touchEnd', [(1, H[:2]), (2, J[:2])]); await touch(cdp, 'touchEnd', [(2, J[:2])]); await touch(cdp, 'touchEnd', [])
        await pg.wait_for_timeout(15)
    await pg.wait_for_timeout(150)
    check(f'{tag}: after mash nothing stuck', not await held(pg) and await pg.evaluate("window.__hc.padHeld().length===0"), await intent(pg))
    check(f'{tag}: after mash no .on buttons', await pg.evaluate("document.querySelectorAll('.pad-grid button.on').length===0"))
    # buttons still drive the fighter
    await pg.evaluate("(()=>{const f=window.__hc.match.f[0]; f.stamina=100; f.state='idle'; f.buffer=null;})()")
    await pg.wait_for_timeout(500)
    x0 = await pg.evaluate("window.__hc.match.f[0].x")
    await touch(cdp, 'touchStart', [(0, R[:2])]); await pg.wait_for_timeout(500); await touch(cdp, 'touchEnd', [])
    x1 = await pg.evaluate("window.__hc.match.f[0].x"); check(f'{tag}: RIGHT still moves fighter', x1 > x0 + 0.2, f'{x0:.2f}->{x1:.2f}')
    await pg.evaluate("(()=>{const f=window.__hc.match.f[0]; f.stamina=100; f.state='idle'; f.buffer=null;})()")
    await touch(cdp, 'touchStart', [(0, LI[:2])])
    ok = await pg.wait_for_function("['move','whiff','hit'].includes(window.__hc.match.f[0].state) || window.__hc.match.f[0].stamina < 95", timeout=2000)
    await touch(cdp, 'touchEnd', []); check(f'{tag}: LIGHT still attacks', bool(ok))
    # double-tap on HUD / canvas must not zoom
    for sel in ['#timer', '#scene', '.pad-left']:
        x, y, _ = await center(pg, sel)
        for _ in range(2):
            await touch(cdp, 'touchStart', [(0, (x, y))]); await touch(cdp, 'touchEnd', []); await pg.wait_for_timeout(90)
    await pg.wait_for_timeout(400); s = await scale(pg); check(f'{tag}: double-taps keep scale 1', abs(s - 1) < 0.01, s)

async def finisher_ko(pg, tag):
    # force a finisher that rings the CPU out, and make sure the slow-mo camera zoom eases back
    await pg.evaluate("window.__hc.cpuOn(false)")
    await pg.evaluate("""(()=>{const m=window.__hc.match,a=m.f[0],b=m.f[1]; a.x=4.0; a.facing=1; b.x=4.8; b.knock=260; a.hype=100; a.stamina=100; a.state='idle'; a.buffer=null; a.intent.special=1;})()""")
    seen = await pg.wait_for_function("window.__hc.cam.fin < 0.97 || window.__hc.match.phase !== 'fight'", timeout=5000)
    zoomed = await pg.evaluate("window.__hc.cam.fin")
    await pg.wait_for_function("window.__hc.match.phase !== 'fight'", timeout=8000)
    await pg.wait_for_timeout(1500)
    c = await pg.evaluate("window.__hc.cam"); check(f'{tag}: finisher KO zoom resets (fin back to 1)', c['fin'] > 0.995 and c['slow'] == 0, f'peak {zoomed:.3f} now {c}')

async def run(p, tag, ctx_opts):
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    ctx = await b.new_context(**ctx_opts); pg = await ctx.new_page(); cdp = await ctx.new_cdp_session(pg)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(2500)
    vp = await pg.evaluate("document.querySelector('meta[name=viewport]').content")
    check(f'{tag}: viewport locks zoom', 'maximum-scale=1' in vp and 'user-scalable=no' in vp, vp)
    ta = await pg.evaluate("[getComputedStyle(document.body).touchAction, getComputedStyle(document.getElementById('scene')).touchAction, getComputedStyle(document.querySelector('.pad-grid button')).touchAction]")
    check(f'{tag}: touch-action none on body/canvas/pads', all(t == 'none' for t in ta), ta)
    tapper = (lambda sel: tap_sel(pg, cdp, sel)) if ctx_opts.get('has_touch') else (lambda sel: pg.click(sel))
    await tapper('.card:nth-child(1)'); await pg.wait_for_timeout(200); await tapper('.card:nth-child(2)')
    await pg.wait_for_timeout(300)
    if ctx_opts.get('has_touch'):
        await fight_checks(pg, cdp, tag + ' match1')
        await finisher_ko(pg, tag + ' match1')
    else:
        await wait_phase(pg, 'fight'); await pads_hittable(pg, tag)
        await pg.keyboard.down('KeyD'); await pg.keyboard.down('KeyE'); await pg.wait_for_timeout(100)
        await pg.evaluate("window.dispatchEvent(new Event('blur'))"); check(f'{tag}: window blur clears held keys', not await held(pg))
        await pg.keyboard.up('KeyD'); await pg.keyboard.up('KeyE')
        # mouse on pads, drag off and release outside
        x, y, _ = await center(pg, '[data-k=right]'); await pg.mouse.move(x, y); await pg.mouse.down(); await pg.mouse.move(x, y - 300); await pg.mouse.up()
        await pg.wait_for_timeout(50); check(f'{tag}: mouse drag-off releases', not await held(pg))
        await finisher_ko(pg, tag + ' match1')
    # play the rest of the match quickly with auto P1, through to the win screen
    await pg.evaluate("window.__hc.cpuOn(true); window.__hc.autoP1(true); window.__hc.setSpeed(6)")
    await wait_phase(pg, 'over', 120000)
    await pg.wait_for_timeout(800)
    c = await pg.evaluate("window.__hc.cam"); check(f'{tag}: win screen camera not zoomed', c['fin'] > 0.995, c)
    await pg.evaluate("window.__hc.autoP1(false); window.__hc.setSpeed(1)")
    await pg.screenshot(path=f'shots/fix-{tag}-win.png')
    await tapper('#btnAgain'); await pg.wait_for_timeout(300)
    check(f'{tag}: RUN IT BACK starts a new match', await pg.evaluate("window.__hc.match.round===1 && window.__hc.match.phase!=='over'"))
    if ctx_opts.get('has_touch'): await fight_checks(pg, cdp, tag + ' rematch')
    # back to menu and a fresh match
    await tapper('#btnRoster'); await pg.wait_for_timeout(300)
    check(f'{tag}: back to roster', await pg.evaluate("window.__hc.S.screen==='select'"))
    await tapper('.card:nth-child(3)'); await pg.wait_for_timeout(200); await tapper('.card:nth-child(4)'); await pg.wait_for_timeout(300)
    if ctx_opts.get('has_touch'):
        await fight_checks(pg, cdp, tag + ' match3')
        await finisher_ko(pg, tag + ' match3')
    else:
        await wait_phase(pg, 'fight'); await pg.keyboard.press('KeyF'); await pg.wait_for_timeout(200)
        check(f'{tag}: keyboard attack after menu', await pg.evaluate("window.__hc.match.f[0].stamina<100"))
    await pg.screenshot(path=f'shots/fix-{tag}-fight.png')
    s = await scale(pg); check(f'{tag}: final scale 1', abs(s - 1) < 0.01, s)
    check(f'{tag}: no page errors', not errs, errs[:3])
    await b.close()

async def main():
    async with async_playwright() as p:
        iphone = p.devices['iPhone 13']
        await run(p, 'iphone-landscape', {**iphone, 'viewport': {'width': 844, 'height': 390}, 'screen': {'width': 844, 'height': 390}})
        await run(p, 'iphone-portrait', dict(iphone))
        await run(p, 'desktop', {'viewport': {'width': 1280, 'height': 720}})
    print('\nFAILURES:', fails if fails else 'none')
asyncio.run(main())
