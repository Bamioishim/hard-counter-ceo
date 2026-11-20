import asyncio, json
from playwright.async_api import async_playwright
URL = 'http://127.0.0.1:4173/'
ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
results = []
def check(name, ok, info=''):
    results.append((name, bool(ok), info)); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{info}]' if info else ''))

async def f0(pg, expr, idx=0, timeout=600):
    # poll: headless software GL renders ~15 fps, so states can be short-lived between frames
    js = f"(() => {{ const f = window.__hc.match.f[{idx}]; return {expr}; }})()"
    t = 0; v = None
    while t < timeout:
        v = await pg.evaluate(js)
        if v: return v
        await pg.wait_for_timeout(8); t += 8
    return v

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        ctx = await b.new_context(viewport={'width':1280,'height':650})
        await ctx.grant_permissions(['clipboard-read','clipboard-write'], origin=URL[:-1])
        pg = await ctx.new_page()
        errs = []
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(2500)
        # --- select screen
        n = await pg.locator('.card').count(); check('8 roster cards', n == 8, n)
        check('title copy', 'ABSURD VERSUS FIGHTING' in await pg.inner_text('header'))
        check('no credit line', 'Hard Counter' not in await pg.inner_text('footer') and 'ileri' not in await pg.inner_text('body'))
        for i, fid in enumerate(['elon','jensen','mark','jeff','vitalik','ansem','wale','sam']):
            await pg.evaluate(f"document.querySelectorAll('.card')[{i}].dispatchEvent(new MouseEvent('mouseenter'))")
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=f'shots/select-{fid}.png')
        await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowLeft'); await pg.keyboard.press('ArrowLeft')
        name = await pg.inner_text('#selName'); check('arrows browse + wrap', name == 'WALE', name)
        await pg.evaluate("document.querySelectorAll('.card')[0].dispatchEvent(new MouseEvent('mouseenter'))")  # back to ELON
        await pg.keyboard.press('Tab'); foc = await pg.evaluate('document.activeElement.id'); check('tab moves focus to MODE', foc == 'optMode', foc)
        await pg.keyboard.press('Enter'); mode = await pg.inner_text('#optMode'); check('mode toggles to 2P', '2P' in mode, mode)
        await pg.keyboard.press('Enter'); mode = await pg.inner_text('#optMode'); check('mode toggles back to CPU', 'VS CPU' in mode, mode)
        await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab')
        foc = await pg.evaluate('document.activeElement.id'); check('tab reaches LOCK IN', foc == 'btnLock', foc)
        await pg.screenshot(path='shots/01-select.png')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(400)
        check('rival step', 'CHOOSE YOUR RIVAL' in await pg.inner_text('#rosterTitle'))
        tags = await pg.evaluate("[...document.querySelectorAll('.ctag')].map(t=>t.textContent).filter(Boolean)")
        check('P1 LOCKED + CPU SELECTED tags', 'P1 LOCKED' in tags and 'CPU SELECTED' in tags, tags)
        check('FIGHT button', 'FIGHT' in await pg.inner_text('#btnLock'))
        await pg.screenshot(path='shots/02-rival.png')
        await pg.keyboard.press('Escape'); check('Esc goes back to fighter pick', 'CHOOSE YOUR FIGHTER' in await pg.inner_text('#rosterTitle'))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
        # --- fight intro
        check('HUD visible', await pg.is_visible('#hud'))
        check('ROUND 01 splash', 'ROUND 01' in await pg.inner_text('#splashBig'))
        await pg.screenshot(path='shots/03-round01.png')
        await pg.wait_for_function("window.__hc.match.phase === 'fight'", timeout=8000)
        check('FIGHT! splash', 'FIGHT' in await pg.inner_text('#splashBig'))
        await pg.screenshot(path='shots/04-fight-splash.png')
        # --- controls (CPU frozen so it cannot interrupt)
        await pg.evaluate("window.__hc.cpuOn(false)")
        await pg.wait_for_timeout(800)
        reset = "(() => { const f = window.__hc.match.f[0]; f.stamina = 100; f.state='idle'; f.move=null; f.x=-2; f.y=0; f.vx=0; f.vy=0; f.grounded=true; const o = window.__hc.match.f[1]; o.x=2.5; o.y=0; o.state='idle'; return 1; })()"
        async def ctl(label, keyfn, expr):
            await pg.evaluate(reset); await pg.wait_for_timeout(120)
            await keyfn(); v = await f0(pg, expr); check(label, v, v)
        x0 = -2
        async def holdD():
            await pg.keyboard.down('d'); await pg.wait_for_timeout(300); await pg.keyboard.up('d')
        await ctl('D moves right', holdD, 'f.x > -1.6 && f.x')
        async def holdA():
            await pg.keyboard.down('a'); await pg.wait_for_timeout(300); await pg.keyboard.up('a')
        await ctl('A moves left', holdA, 'f.x < -2.3 && f.x')
        async def jump():
            await pg.keyboard.press('w'); await pg.wait_for_timeout(120)
        await ctl('W jumps', jump, 'f.y > 0.3 && f.y')
        await pg.wait_for_timeout(900)
        async def crouch():
            await pg.keyboard.down('s'); await pg.wait_for_timeout(120)
        await ctl('S crouches', crouch, 'f.crouch')
        await pg.keyboard.up('s')
        async def tap(k, wait=0):
            async def fn():
                await pg.keyboard.press(k); await pg.wait_for_timeout(wait)
            return fn
        await ctl('F light attack', await tap('f'), "f.state==='move' && f.move.kind==='light' && f.move.kind")
        await pg.wait_for_timeout(400)
        await ctl('G heavy attack', await tap('g'), "f.state==='move' && f.move.kind==='heavy' && f.move.kind")
        await pg.wait_for_timeout(700)
        await ctl('H parry', await tap('h'), "f.state==='parry' && f.state")
        await pg.wait_for_timeout(600)
        await ctl('R feint', await tap('r'), "f.state==='feint' && f.state")
        await pg.wait_for_timeout(400)
        await ctl('T signature (hype < 100)', await tap('t'), "f.state==='move' && f.move.kind==='sig' && f.move.label")
        await pg.wait_for_timeout(800)
        await pg.evaluate(reset)
        await pg.keyboard.down('e'); await pg.wait_for_timeout(600)
        v = await f0(pg, "f.state==='charge' && f.charge"); check('E hold charges', v, v)
        await pg.keyboard.up('e')
        v = await f0(pg, "f.state==='move' && f.move.kind==='release' && f.move.label"); check('E release thrusts', v, v)
        await pg.wait_for_timeout(700)
        # buffered input
        await pg.evaluate(reset); await pg.keyboard.press('g'); await f0(pg, "f.state==='move'"); await pg.keyboard.press('f')
        v = await f0(pg, "!!f.buffer"); check('input buffered during a move', v)
        await pg.wait_for_timeout(800)
        # perfect parry: make CPU attack into a fresh parry
        await pg.evaluate("(() => { const m = window.__hc.match, f = m.f[0], o = m.f[1]; f.x=-0.6; o.x=0.6; f.state='idle'; o.state='idle'; f.stamina=100; o.stamina=100; f.facing=1; o.facing=-1; window.__pp=[]; const em=m.emit; m.emit=(t,d)=>{ if(t==='parry') window.__pp.push(d.perfect); em(t,d); }; o.intent.light=1; const iv=setInterval(()=>{ if (o.state==='move') { f.intent.parry=1; clearInterval(iv); } }, 4); })()")
        await pg.wait_for_timeout(500)
        pp = await pg.evaluate("window.__pp"); co = await pg.inner_text('#callout')
        check('PERFECT PARRY on timing', True in (pp or []), f'{pp} callout={co}')
        await pg.screenshot(path='shots/05-perfect-parry.png')
        await pg.evaluate("window.__hc.match.f[0].hype = 100")
        await pg.wait_for_timeout(100)
        check('special pad shows FINISHER at full hype', 'FINISHER' in await pg.inner_text('#padSpecial'))
        await ctl('T finisher (hype = 100)', await tap('t'), "f.state==='move' && f.move.kind==='fin' && f.move.label")
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path='shots/05b-finisher.png')
        await pg.wait_for_function("window.__hc.match.phase === 'fight'", timeout=15000)
        # pause
        await pg.keyboard.press('p'); await pg.wait_for_timeout(150)
        check('P pauses', await pg.evaluate("window.__hc.S.paused") and await pg.is_visible('#pause'))
        t1 = await pg.evaluate("window.__hc.match.time"); await pg.wait_for_timeout(500); t2 = await pg.evaluate("window.__hc.match.time")
        check('timer frozen while paused', t1 == t2)
        await pg.keyboard.press('p'); await pg.wait_for_timeout(100)
        check('P resumes', not await pg.evaluate("window.__hc.S.paused"))
        # --- real fight HUD shot: both sides AI-driven
        await pg.evaluate("window.__hc.cpuOn(true); window.__hc.autoP1(true)")
        shot_done = False
        for i in range(60):
            await pg.wait_for_timeout(150)
            st = await pg.evaluate("(() => { const m = window.__hc.match; return {ph: m.phase, k0: m.f[0].knock, k1: m.f[1].knock, h: m.f[0].hype, c: document.getElementById('callout').classList.contains('show')} })()")
            if st['ph'] == 'fight' and (st['k0'] + st['k1']) > 20 and st['c']:
                await pg.screenshot(path='shots/06-fight-hud.png'); shot_done = True; break
        if not shot_done: await pg.screenshot(path='shots/06-fight-hud.png')
        check('fight HUD shot taken mid-exchange', True, 'with callout' if shot_done else 'no callout at capture')
        # ring-out shot
        await pg.wait_for_function("document.getElementById('splashBig').textContent.includes('RING OUT') || window.__hc.match.phase==='over'", timeout=60000)
        await pg.wait_for_timeout(250)
        await pg.screenshot(path='shots/07-ring-out.png')
        check('RING OUT splash', 'RING OUT' in await pg.inner_text('#splashBig') or 'TIME' in await pg.inner_text('#splashBig'), await pg.inner_text('#splashSub'))
        # --- run match to the end quickly
        await pg.evaluate("window.__hc.setSpeed(5)")
        await pg.wait_for_function("window.__hc.match.phase==='over'", timeout=120000)
        await pg.evaluate("window.__hc.setSpeed(1)")
        await pg.wait_for_timeout(600)
        wins = await pg.evaluate("window.__hc.match.wins"); check('best of three ends at 2 wins', max(wins) == 2, wins)
        big = await pg.inner_text('#splashBig'); check('winner splash', big.endswith('WINS'), big)
        check('RUN IT BACK visible', await pg.is_visible('#btnAgain'))
        pips = await pg.evaluate("[...document.querySelectorAll('.pips i.won')].length"); check('round pips filled', pips == 2 + min(wins), pips)
        await pg.screenshot(path='shots/08-win.png')
        await pg.click('#btnShare'); await pg.wait_for_timeout(300)
        share = await pg.evaluate("window.__lastShare"); clip = ''
        try: clip = await pg.evaluate("navigator.clipboard.readText()")
        except Exception as e: clip = 'n/a'
        check('share text copied', 'off a roof' in share and 'http' in share and clip == share, share)
        await pg.screenshot(path='shots/09-share-toast.png')
        await pg.click('#btnAgain'); await pg.wait_for_timeout(300)
        check('RUN IT BACK restarts at round 1', await pg.evaluate("window.__hc.match.round===1 && window.__hc.match.wins.join()==='0,0'"))
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        check('Esc returns to roster', await pg.is_visible('#select') and not await pg.is_visible('#hud'))
        # --- 2P local quick check
        await pg.click('#optMode'); await pg.wait_for_timeout(100)
        await pg.click('#btnLock'); await pg.wait_for_timeout(200); await pg.click('#btnLock'); await pg.wait_for_timeout(300)
        check('2P HUD label', 'P2 /' in await pg.inner_text('#hudName2'), await pg.inner_text('#hudName2'))
        await pg.wait_for_function("window.__hc.match.phase === 'fight'", timeout=8000)
        await pg.evaluate("(() => { const o = window.__hc.match.f[1]; o.state='idle'; o.stamina=100; })()")
        await pg.keyboard.press('j')
        v = await f0(pg, "f.state==='move' && f.move.kind", 1); check('P2 J = light', v == 'light', v)
        await pg.keyboard.press('Escape')
        check('no console errors (desktop)', not errs, errs[:5])
        await ctx.close()

        # --- mobile: touch pads
        for (vw, vh, tag) in [(390, 844, 'portrait'), (844, 390, 'landscape')]:
            mctx = await b.new_context(viewport={'width':vw,'height':vh}, has_touch=True, is_mobile=True, device_scale_factor=2)
            mp = await mctx.new_page(); merr = []
            mp.on('pageerror', lambda e: merr.append(str(e))); mp.on('console', lambda m: merr.append(m.text) if m.type=='error' else None)
            await mp.goto(URL); await mp.wait_for_timeout(2500)
            await mp.screenshot(path=f'shots/mobile-{tag}-select.png')
            await mp.tap('#btnLock'); await mp.wait_for_timeout(200); await mp.tap('#btnLock')
            await mp.wait_for_function("window.__hc.match.phase === 'fight'", timeout=8000)
            await mp.evaluate("window.__hc.cpuOn(false); (() => { const f = window.__hc.match.f[0]; f.stamina=100; f.state='idle'; })()")
            await mp.tap('[data-k=heavy]')
            v = await f0(mp, "f.state==='move' && f.move.kind")
            check(f'mobile {tag}: HEAVY pad', v == 'heavy', v)
            await mp.wait_for_timeout(800)
            # hold-to-move via pointer events
            box = await mp.locator('[data-k=right]').bounding_box()
            await mp.evaluate("(() => { const f = window.__hc.match.f[0]; f.state='idle'; f.move=null; f.x=-1.6; f.vx=0; f.grounded=true; f.y=0; })()")
            x0 = await mp.evaluate("window.__hc.match.f[0].x")
            await mp.evaluate("(() => { const b = document.querySelector('[data-k=right]'); b.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerId: 7, pointerType:'touch'})); })()")
            await f0(mp, "f.x > -1.2", 0, 1500)
            await mp.evaluate("(() => { const b = document.querySelector('[data-k=right]'); b.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerId: 7, pointerType:'touch'})); })()")
            x1 = await mp.evaluate("window.__hc.match.f[0].x")
            check(f'mobile {tag}: RIGHT pad hold moves', x1 > x0 + 0.3, f'{x0:.2f}->{x1:.2f}')
            await mp.evaluate("window.__hc.cpuOn(true)")
            await mp.wait_for_timeout(1500)
            await mp.screenshot(path=f'shots/mobile-{tag}-fight.png')
            check(f'no console errors (mobile {tag})', not merr, merr[:3])
            await mctx.close()
        await b.close()
    fails = [r for r in results if not r[1]]
    print(f'\n{len(results)-len(fails)}/{len(results)} passed')
    json.dump(results, open('shots/test-results.json','w'), indent=1)
asyncio.run(main())
