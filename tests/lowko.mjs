import { Match, CPU } from '../src/game.js';
import { ROSTER } from '../src/roster.js';
let c = {};
for (const a of ROSTER) for (const b of ROSTER) for (let n = 0; n < 6; n++) {
  if (a === b) continue;
  let ev = []; const m = new Match(a, b, (t, d) => ev.push([t, d])); m.startRound();
  const ai = [new CPU(0.7), new CPU(0.7)]; let t = 0; const hist = [[], []];
  while (m.phase !== 'over' && t < 400) {
    for (let i = 0; i < 2; i++) { ai[i].update(m, m.f[i], m.f[1 - i], 1 / 120); }
    m.step(1 / 120); t += 1 / 120;
    for (let i = 0; i < 2; i++) { const f = m.f[i]; const s = f.state + (f.move ? ':' + f.move.kind : ''); if (hist[i].at(-1) !== s) hist[i].push(s); if (hist[i].length > 6) hist[i].shift(); }
    for (const [k, d] of ev) if (k === 'roundEnd' && d.why === 'ringout' && m.f[d.loser].knock < 10) { const key = hist[d.loser].join('>'); c[key] = (c[key] || 0) + 1; }
    ev = [];
  }
}
console.log(c);
