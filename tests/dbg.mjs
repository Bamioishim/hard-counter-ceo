import { Match, CPU } from '../src/game.js';
import { ROSTER } from '../src/roster.js';
let shown = 0;
for (const a of ROSTER) for (const b of ROSTER) for (let n = 0; n < 6 && shown < 3; n++) {
  if (a === b) continue;
  let ev = []; const m = new Match(a, b, (t, d) => ev.push([t, d])); m.startRound();
  const ai = [new CPU(0.7), new CPU(0.7)]; let t = 0; const log = [[], []];
  while (m.phase !== 'over' && t < 400) {
    for (let i = 0; i < 2; i++) ai[i].update(m, m.f[i], m.f[1 - i], 1 / 120);
    const its = m.f.map(f => JSON.stringify(f.intent));
    m.step(1 / 120); t += 1 / 120;
    for (let i = 0; i < 2; i++) { const f = m.f[i]; log[i].push(`${f.state} x${f.x.toFixed(2)} y${f.y.toFixed(2)} vx${f.vx.toFixed(1)} vy${f.vy.toFixed(1)} g${+f.grounded} ${its[i]}`); if (log[i].length > 40) log[i].shift(); }
    for (const [k, d] of ev) if (k === 'roundEnd' && d.why === 'ringout' && m.f[d.loser].knock < 10 && shown < 3) { shown++; console.log('----', a.id, b.id, 'loser', d.loser); console.log(log[d.loser].filter((_, i) => i % 3 == 0).join('\n')); }
    ev = [];
  }
}
