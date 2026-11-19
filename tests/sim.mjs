import { Match, CPU } from '../src/game.js';
import { ROSTER } from '../src/roster.js';
const N = +process.argv[2] || 6;
const wins = {}, games = {}; let rounds = [], koPct = [], timeouts = 0, totalR = 0;
for (const a of ROSTER) for (const b of ROSTER) {
  if (a === b) continue;
  for (let n = 0; n < N; n++) {
    let ev = [];
    const m = new Match(a, b, (t, d) => ev.push([t, d]));
    m.startRound();
    const ai = [new CPU(0.7), new CPU(0.7)];
    let t = 0, rs = 0;
    while (m.phase !== 'over' && t < 400) {
      for (let i = 0; i < 2; i++) ai[i].update(m, m.f[i], m.f[1 - i], 1 / 120);
      m.step(1 / 120); t += 1 / 120;
      for (const [k, d] of ev) { if (k === 'fight') rs = t; if (k === 'roundEnd') { totalR++; rounds.push(t - rs); if (d.why === 'time') timeouts++; else koPct.push(m.f[d.loser].knock); } }
      ev = [];
    }
    games[a.id] = (games[a.id] || 0) + 1; games[b.id] = (games[b.id] || 0) + 1;
    if (m.winner >= 0) { const w = m.winner === 0 ? a.id : b.id; wins[w] = (wins[w] || 0) + 1; }
  }
}
const avg = (x) => (x.reduce((s, v) => s + v, 0) / x.length).toFixed(1);
console.log('lowKO', koPct.filter(v=>v<10).length); console.log('rounds', totalR, 'avg round s', avg(rounds), 'timeouts', timeouts, 'avg KO%', avg(koPct), 'min', Math.min(...koPct), 'max', Math.max(...koPct));
for (const k of Object.keys(games)) console.log(k.padEnd(8), ((wins[k] || 0) / games[k] * 100).toFixed(0) + '%');
