# HARD COUNTER: CEO EDITION

A parody remake of **Hard Counter by [@0xileri](https://x.com/0xileri)**: an absurd 3D versus fighter where 8 tech/crypto CEO caricatures try to knock each other off a rooftop. Best of three, no health bars. Hits raise your knockback %, and leaving the roof loses the round.

Static Vite + Three.js app. No backend, no external assets, WebAudio sound effects.

**Live:** https://hard-counter-ceo.vercel.app

## Run it

    npm install
    npm run dev       # local dev server
    npm run build     # static build -> dist/
    npm run preview   # serve dist on :4173

## Controls

**Phone:** on-screen pads. Left pad moves, jumps and crouches. Right pad does light, heavy, parry, feint, special and charge (hold).

**Player 1 (keyboard)**
- A / D move, W jump (W again in the air), S crouch
- F light, G heavy, H parry, R feint
- T special (finisher at full hype), hold E to charge
- P pause, Esc back to roster

**Player 2 (2P local)**
- Arrow keys move, jump and crouch
- J light, K heavy, L parry, U feint, I special, O charge

**Select screen:** arrows browse, Enter selects, Tab moves to the next control, Esc goes back.

## Tests

- `node tests/sim.mjs 12`: headless CPU-vs-CPU balance sim over all matchups.
- `python3 tests/e2e.py`: Playwright flow and controls test (needs `npm run preview` running).
- `python3 tests/touch.py`: mobile (iPhone, multi-touch) and desktop regression test for stuck buttons and zoom.

Parody. Not affiliated with anyone portrayed.
