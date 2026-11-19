// Fight simulation. Pure logic (no three.js), so it can be tested headless.
export const W = 5.4;            // roof half-width
const G = 32, JUMP_V = 11.5;
export const ROUND_TIME = 60;
const PERFECT = 0.14, PARRY_T = 0.40, WHIFF_T = 0.22, STAGGER_T = 0.55, BUFFER_T = 0.22;
export const COST = { light: 10, heavy: 18, parry: 12, feint: 6, jump: 6, sig: 28 };

export function makeIntent() { return { left: false, right: false, down: false, charge: false, up: 0, light: 0, heavy: 0, parry: 0, feint: 0, special: 0 }; }
export function clearEdges(it) { it.up = it.light = it.heavy = it.parry = it.feint = it.special = 0; }

export class Fighter {
  constructor(def, side) {
    this.def = def; this.side = side; this.intent = makeIntent();
    const s = def.stats;
    this.sp = 1.25 - s.speed * 0.045;             // move-time multiplier
    this.reach = 0.95 + s.reach * 0.08;           // lance length (matches the model)
    this.mass = 1.3 - s.rigidity * 0.05;          // knockback taken multiplier
    this.walkV = 3.2 + s.speed * 0.18;
    this.regen = 18 + s.stamina * 1.6;
    this.recov = s.recovery;
    this.reset();
  }
  reset() {
    this.x = this.side === 0 ? -1.6 : 1.6; this.y = 0; this.vx = 0; this.vy = 0;
    this.facing = this.side === 0 ? 1 : -1; this.grounded = true; this.airJump = 1;
    this.knock = 0; this.stamina = 100; this.hype = 0; this.spendT = 0;
    this.state = 'idle'; this.t = 0; this.move = null; this.charge = 0; this.buffer = null;
    this.crouch = false; this.walk = 0; this.out = false; this.label = ''; this.labelT = 0; this.baited = false;
  }
  busy() { return ['move', 'parry', 'whiff', 'hit', 'stagger', 'charge', 'feint'].includes(this.state); }
  spend(n) { if (this.stamina < n) return false; this.stamina -= n; this.spendT = 0.45; return true; }
  say(l, t = 0.6) { this.label = l; this.labelT = t; }
}

function moveDef(f, kind, c = 0) {
  const sp = f.sp, R = f.reach, sig = f.def.signature.type, fin = f.def.finisher.type;
  switch (kind) {
    case 'light': return { kind, su: .10 * sp, ac: .08, re: .18 * sp, dmg: 8, base: 3.0, gr: .11, reach: R * .9, up: .45, high: true, label: 'LIGHT ATTACK' };
    case 'heavy': return { kind, su: .28 * sp, ac: .10, re: .32 * sp, dmg: 18, base: 4.5, gr: .185, reach: R, up: .6, crush: true, label: 'HEAVY ATTACK' };
    case 'release': return { kind, su: .05, ac: .12, re: .30 * sp, dmg: Math.round(8 + 10 * c), base: 4 + 4 * c, gr: .11 + .05 * c, reach: R * (1 + .25 * c), up: .5, dash: 6 * c, label: c > .95 ? 'FULL CHARGE' : 'CHARGED THRUST' };
    case 'sig': {
      const m = { kind, sub: sig, dmg: 18, base: 5, gr: .175, reach: R * 1.1, up: .55, label: f.def.signature.name, named: true };
      if (sig === 'lunge') Object.assign(m, { su: .16 * sp, ac: .2, re: .3 * sp, dash: 12 });
      if (sig === 'spin') Object.assign(m, { su: .1 * sp, ac: .35, re: .25 * sp, both: true, reach: R * .95 });
      if (sig === 'spiral') Object.assign(m, { su: .18 * sp, ac: .12, re: .3 * sp, warp: true });
      if (sig === 'ram') Object.assign(m, { su: .2 * sp, ac: .3, re: .35 * sp, dash: 9, up: .95, reach: R * .9 });
      return m; }
    case 'fin': {
      const m = { kind, sub: fin, dmg: 30, base: 9, gr: .2, reach: R * 1.3, up: .6, label: f.def.finisher.name, named: true, fin: true, crush: true };
      if (fin === 'extend') Object.assign(m, { su: .22, ac: .22, re: .5, reach: R * 1.9 });
      if (fin === 'spin') Object.assign(m, { su: .15, ac: .45, re: .4, both: true, reach: R * 1.25 });
      if (fin === 'spiral') Object.assign(m, { su: .2, ac: .16, re: .45, warp: true });
      if (fin === 'launch') Object.assign(m, { su: .22, ac: .3, re: .5, dash: 10, up: 1.15 });
      return m; }
  }
}

export class Match {
  constructor(defA, defB, emit = () => {}) {
    this.f = [new Fighter(defA, 0), new Fighter(defB, 1)];
    this.emit = emit; this.round = 1; this.wins = [0, 0];
    this.phase = 'intro'; this.phaseT = 0; this.time = ROUND_TIME; this.hitstop = 0; this.slow = 0; this.winner = -1;
  }
  startRound() {
    for (const f of this.f) f.reset();
    this.time = ROUND_TIME; this.phase = 'intro'; this.phaseT = 0; this.hitstop = 0; this.slow = 0; this.roundWinner = -1;
    this.emit('round', { round: this.round });
  }
  step(dt) {
    this.phaseT += dt;
    if (this.phase === 'intro') { if (this.phaseT > 2.0) { this.phase = 'fight'; this.phaseT = 0; this.emit('fight'); } this.physicsOnly(dt); return; }
    if (this.phase === 'roundEnd') {
      this.physicsOnly(dt);
      if (this.phaseT > 2.6) {
        if (this.wins[0] >= 2 || this.wins[1] >= 2) { this.phase = 'over'; this.winner = this.wins[0] >= 2 ? 0 : 1; this.emit('matchEnd', { winner: this.winner }); }
        else { this.round++; this.startRound(); }
      }
      return;
    }
    if (this.phase !== 'fight') { this.physicsOnly(dt); return; }
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    if (this.slow > 0) { this.slow -= dt; dt *= 0.3; }
    this.time -= dt;
    for (const f of this.f) this.updateFighter(f, this.f[1 - f.side], dt);
    this.separate();
    for (const f of this.f) this.checkHits(f, this.f[1 - f.side]);
    for (const f of this.f) clearEdges(f.intent);
    // ring out
    for (const f of this.f) {
      if (!f.out && (f.y < -3.5 || Math.abs(f.x) > W + 9 || f.y > 15)) { f.out = true; this.endRound(1 - f.side, 'ringout', f); return; }
    }
    if (this.time <= 0) {
      this.time = 0;
      const [a, b] = this.f;
      if (Math.abs(a.knock - b.knock) < 0.5) { this.emit('draw'); this.slow = 0; this.hitstop = 0; this.phase = 'roundEnd'; this.phaseT = 0.6; this.roundWinner = -1; this.round--; }
      else this.endRound(a.knock < b.knock ? 0 : 1, 'time');
    }
  }
  endRound(w, why, loser) {
    this.wins[w]++; this.phase = 'roundEnd'; this.phaseT = 0; this.roundWinner = w; this.slow = 0; this.hitstop = 0;
    this.emit('roundEnd', { winner: w, why, loser: loser ? loser.side : 1 - w });
  }
  physicsOnly(dt) { for (const f of this.f) { clearEdges(f.intent); f.state = f.out ? f.state : (f.state === 'move' ? 'idle' : f.state); this.integrate(f, dt, true); } }

  integrate(f, dt, passive) {
    f.vy -= G * dt; f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.grounded && f.state !== 'hit' && Math.abs(f.x) > W - 0.05) { f.x = Math.sign(f.x) * (W - 0.05); f.vx = 0; } // only hits can push you off
    const onRoof = Math.abs(f.x) <= W;
    if (f.y <= 0 && onRoof && f.vy <= 0 && f.y > -0.6) {
      if (!f.grounded && f.vy < -6) this.emit('land', { f });
      f.y = 0; f.vy = 0; f.grounded = true; f.airJump = 1;
    } else if (f.y > 0.001 || !onRoof) f.grounded = false;
    if (f.grounded) f.vx *= Math.exp(-(f.state === 'hit' ? 5 : 14) * dt);
    else f.vx *= Math.exp(-(f.state === 'hit' ? 0.9 : 0.4) * dt);
    if (passive && f.grounded) f.vx *= 0.9;
  }

  updateFighter(f, o, dt) {
    const it = f.intent;
    f.t += dt; f.labelT -= dt;
    if (f.spendT > 0) f.spendT -= dt; else f.stamina = Math.min(100, f.stamina + f.regen * dt);
    if (f.buffer) { f.buffer.t -= dt; if (f.buffer.t <= 0) f.buffer = null; }
    // edge-triggered actions get buffered when busy
    const pressed = ['light', 'heavy', 'parry', 'feint', 'special'].find((k) => it[k]);
    if (pressed && f.busy() && f.state !== 'charge') f.buffer = { act: pressed, t: BUFFER_T };

    switch (f.state) {
      case 'hit': if (f.t >= f.hitstun) this.toIdle(f); break;
      case 'stagger': if (f.t >= STAGGER_T) this.toIdle(f); break;
      case 'whiff': if (f.t >= WHIFF_T) this.toIdle(f); break;
      case 'parry': if (f.t >= PARRY_T) { f.state = 'whiff'; f.t = 0; } break;
      case 'feint': if (f.t >= 0.22 * f.sp) { this.toIdle(f); if (o.state === 'parry' && o.t < 0.35) { f.hype = Math.min(100, f.hype + 8); this.emit('callout', { text: 'BAITED!', color: 'pink' }); } } break;
      case 'charge': {
        f.charge = Math.min(1, f.charge + dt / (0.9 * f.sp));
        f.stamina = Math.max(0, f.stamina - 45 * dt); f.spendT = 0.45;
        f.vx = 0; f.say(`CHARGING ${Math.round(f.charge * 100)}%`, 0.1);
        if (!it.charge || f.stamina <= 0) this.startMove(f, o, 'release', f.charge);
        break; }
      case 'move': this.updateMove(f, o, dt); break;
    }
    if (!f.busy()) {
      // facing
      if (f.grounded) f.facing = o.x >= f.x ? 1 : -1;
      const act = pressed || (f.buffer && f.buffer.act);
      if (act) { f.buffer = null; this.doAction(f, o, act); }
      else if (it.charge && f.stamina > 8) { f.state = 'charge'; f.t = 0; f.charge = 0; this.emit('sfx', 'charge'); }
    }
    if (!f.busy()) {
      f.crouch = f.grounded && it.down;
      const dir = (it.right ? 1 : 0) - (it.left ? 1 : 0);
      if (f.grounded) {
        if (f.crouch) f.vx = 0;
        else {
          f.vx = dir * f.walkV;
          const nx = f.x + f.vx * dt; if (Math.abs(nx) > W - 0.12 && Math.sign(nx) === Math.sign(f.vx)) f.vx = 0; // ledge stop
        }
        f.walk = f.crouch ? 0 : dir;
        if (it.up && f.spend(COST.jump)) { f.vy = JUMP_V; f.grounded = false; f.y = 0.01; this.emit('sfx', 'jump'); }
      } else {
        const acc = 14 * (0.6 + f.recov * 0.04), maxV = 4.2 + f.recov * 0.12;
        if (dir) f.vx = Math.max(-maxV, Math.min(maxV, f.vx + dir * acc * dt)) * (Math.abs(f.vx) > maxV && Math.sign(f.vx) === dir ? 1 : 1);
        if (it.up && f.airJump > 0 && f.stamina >= COST.jump) { f.spend(COST.jump); f.airJump--; f.vy = 8.5 + f.recov * 0.35; this.emit('sfx', 'jump'); }
        f.walk = 0;
      }
    } else { f.crouch = false; f.walk = 0; }
    if (f.state === 'hit' && !f.grounded) {
      // DI-lite: recovery stat lets you steer a little while launched
      const dir = (it.right ? 1 : 0) - (it.left ? 1 : 0); f.vx += dir * f.recov * 0.25 * dt * 6;
    }
    this.integrate(f, dt);
  }

  toIdle(f) { f.state = 'idle'; f.t = 0; f.move = null; }

  doAction(f, o, act) {
    if (act === 'parry') { if (!f.spend(COST.parry)) return this.denied(f); f.state = 'parry'; f.t = 0; f.say('PARRY'); this.emit('sfx', 'whoosh'); return; }
    if (act === 'feint') { if (!f.spend(COST.feint)) return this.denied(f); f.state = 'feint'; f.t = 0; f.say('FEINT'); return; }
    if (act === 'special') {
      if (f.hype >= 100) { f.hype = 0; this.startMove(f, o, 'fin'); this.emit('finisherStart', { f }); return; }
      if (!f.spend(COST.sig)) return this.denied(f);
      this.startMove(f, o, 'sig'); return;
    }
    if (!f.spend(COST[act])) return this.denied(f);
    this.startMove(f, o, act);
  }
  denied(f) { f.say('OUT OF GAS'); this.emit('sfx', 'denied'); }

  startMove(f, o, kind, c = 0) {
    f.state = 'move'; f.t = 0; f.move = moveDef(f, kind, c); f.move.hit = false; f.charge = 0;
    f.say(f.move.named ? f.move.label : f.move.label, f.move.su + f.move.ac + 0.2);
    if (f.move.named) this.emit('callout', { text: f.move.label, color: 'pink' });
    this.emit('sfx', kind === 'fin' ? 'finisher' : kind === 'sig' ? 'sig' : 'whoosh');
  }

  phaseOf(f) {
    const m = f.move; if (!m) return null;
    if (f.t < m.su) return ['startup', f.t / m.su];
    if (f.t < m.su + m.ac) return ['active', (f.t - m.su) / m.ac];
    if (f.t < m.su + m.ac + m.re) return ['recovery', (f.t - m.su - m.ac) / m.re];
    return null;
  }

  updateMove(f, o, dt) {
    const m = f.move, ph = this.phaseOf(f);
    if (!ph) { this.toIdle(f); return; }
    if (m.warp && ph[0] === 'active' && !m.warped) {
      m.warped = true; // corkscrew behind the rival (stays on the roof)
      const side = f.x < o.x ? 1 : -1;
      f.x = Math.max(-W + 0.3, Math.min(W - 0.3, o.x + side * 1.0)); f.facing = -side; this.emit('warp', { f });
    }
    if (m.dash && ph[0] === 'active') { f.vx = f.facing * m.dash; if (Math.abs(f.x + f.vx * dt) > W - 0.12) f.vx = 0; }
    else if (f.grounded && ph[0] !== 'active') f.vx *= 0.8;
  }

  separate() {
    const [a, b] = this.f; const dx = b.x - a.x;
    if (Math.abs(dx) < 0.62 && Math.abs(a.y - b.y) < 1.4) {
      const push = (0.62 - Math.abs(dx)) / 2 * (dx >= 0 ? 1 : -1);
      a.x -= push; b.x += push;
    }
    for (const f of this.f) if (f.grounded && f.state !== 'hit' && Math.abs(f.x) > W - 0.05) f.x = Math.sign(f.x) * (W - 0.05);
  }

  inRange(f, o, m) {
    if (Math.abs((o.y + 0.9) - (f.y + 0.6)) > (o.crouch ? 0.9 : 1.25)) return false;
    const d = (o.x - f.x) * (m.both ? Math.sign(o.x - f.x) || 1 : f.facing);
    return d > -0.15 && d < m.reach + 0.35;
  }

  checkHits(f, o) {
    if (f.state !== 'move') return;
    const m = f.move, ph = this.phaseOf(f);
    if (!ph || ph[0] !== 'active' || m.hit || o.out) return;
    if (!this.inRange(f, o, m)) return;
    m.hit = true;
    const ex = o.x - f.facing * 0.3, ey = o.y + 0.9;
    // parry
    if (o.state === 'parry') {
      if (o.t <= PERFECT) {
        f.state = 'stagger'; f.t = 0; f.move = null; f.vx = -f.facing * 3;
        o.hype = Math.min(100, o.hype + 22); o.stamina = Math.min(100, o.stamina + 10);
        this.hitstop = 0.12; o.state = 'idle'; o.t = 0;
        this.emit('parry', { perfect: true, x: ex, y: ey, by: o }); return;
      }
      if (!m.crush) { o.knock += 2; o.vx = f.facing * 2.5; this.emit('parry', { perfect: false, x: ex, y: ey, by: o }); this.hitstop = 0.05; return; }
      this.applyHit(f, o, m, 0.5, 'GUARD CRUSHED'); return;
    }
    if (o.crouch && m.high) { this.emit('callout', { text: 'DUCKED', color: 'white' }); return; }
    let mult = 1, text = null;
    if (o.state === 'stagger' || (o.state === 'move' && this.phaseOf(o)?.[0] === 'startup')) { mult = 1.25; text = 'COUNTERPOINT!'; }
    if (o.crouch && !m.high) { mult *= 1.2; text = text || 'SIT DOWN!'; }
    this.applyHit(f, o, m, mult, text);
  }

  applyHit(f, o, m, mult, text) {
    o.knock = Math.round(o.knock + m.dmg * mult);
    const kb = (m.base + o.knock * m.gr) * o.mass * mult;
    const dir = m.both ? (Math.sign(o.x - f.x) || f.facing) : f.facing;
    o.vx = dir * kb; o.vy = kb * m.up + 2.5; o.grounded = false; o.y = Math.max(o.y, 0.02);
    o.state = 'hit'; o.t = 0; o.move = null; o.crouch = false;
    o.hitstun = (0.12 + kb * 0.025) * (1.25 - o.recov * 0.04);
    o.facing = -dir;
    f.hype = Math.min(100, f.hype + (m.kind === 'light' ? 8 : 16)); o.hype = Math.min(100, o.hype + (m.kind === 'light' ? 4 : 8));
    this.hitstop = m.fin ? 0.2 : m.kind === 'light' ? 0.05 : 0.09;
    if (m.fin) this.slow = 0.5;
    if (!text && !m.named) text = m.kind === 'light' ? null : kb > 9.5 ? 'SIT DOWN!' : 'BONK!';
    this.emit('hit', { f, o, m, kb, text, x: o.x, y: o.y + 0.9, heavy: m.kind !== 'light' });
  }

  // status line under the hype bar, like the original
  status(f) {
    const busyRec = ['hit', 'stagger', 'whiff'].includes(f.state) || (f.state === 'move' && this.phaseOf(f)?.[0] === 'recovery');
    if (f.buffer && busyRec) return 'INPUT BUFFERED / RECOVERING';
    if (f.buffer) return 'INPUT BUFFERED';
    if (busyRec) return f.state === 'stagger' ? 'STAGGERED / RECOVERING' : 'RECOVERING';
    if (f.labelT > 0) return f.label;
    if (f.hype >= 100) return 'HYPE FULL / PRESS T';
    return '';
  }
  pose(f) {
    const ph = this.phaseOf(f) || ['', 0];
    let state = f.state;
    if (state === 'move') state = f.move.kind; if (state === 'feint') { ph[0] = 'startup'; ph[1] = Math.min(1, f.t / (0.22 * f.sp)); }
    const kind = f.move?.sub;
    return { state, phase: ph[0], q: ph[1], kind, walk: f.walk, crouch: f.crouch, air: !f.grounded, charge: f.charge, glow: f.hype >= 100 ? 0.9 : f.state === 'charge' ? f.charge * 0.8 : 0 };
  }
}

// ---------------- CPU ----------------
export class CPU {
  constructor(level = 0.7) { this.level = level; this.think = 0; this.hold = null; this.plan = null; this.chargeT = 0; }
  update(m, me, o, dt) {
    const it = me.intent;
    this.think -= dt;
    if (m.phase !== 'fight') { it.left = it.right = it.down = it.charge = false; return; }
    // charge hold management
    if (me.state === 'charge') { this.chargeT -= dt; it.charge = this.chargeT > 0; return; }
    if (this.think > 0) return;
    this.think = 0.07 + Math.random() * 0.1 * (1.4 - this.level);
    it.left = it.right = it.down = false; it.charge = false;
    const dx = o.x - me.x, ad = Math.abs(dx), toward = Math.sign(dx) || 1;
    const R = me.reach + 0.3;
    // 1) recovery when off the roof
    if (!me.grounded && (Math.abs(me.x) > W - 0.2 || me.y < 0.2)) {
      const home = -Math.sign(me.x) || 1; if (home > 0) it.right = true; else it.left = true;
      if (me.vy < 1 && me.airJump > 0 && (me.y < 0.6 || Math.abs(me.x) > W + 1.5)) it.up = 1;
      return;
    }
    if (me.busy()) return;
    // 2) react to incoming attacks
    const oph = o.state === 'move' ? m.phaseOf(o) : null;
    const threat = (oph && oph[0] === 'startup' && ad < o.move.reach + 0.6) || (o.state === 'feint' && ad < o.reach + 0.5);
    if (threat) {
      const r = Math.random();
      const remain = oph ? (o.move.su - o.t) : 0.12;
      if (o.move && o.move.high && r < 0.25 * this.level) { it.down = true; return; }
      if (r < 0.55 * this.level && me.stamina > 14 && remain < 0.2) { it.parry = 1; return; }
      if (r < 0.75) { if (toward > 0) it.left = true; else it.right = true; if (Math.abs(me.x - toward * 0.8) > W - 0.5) { it.up = 1; } return; }
    }
    // 3) punish
    if (o.state === 'stagger' || o.state === 'whiff' || (oph && oph[0] === 'recovery')) {
      if (ad < R) { it[Math.random() < 0.6 ? 'heavy' : 'light'] = 1; return; }
    }
    // 4) finisher
    if (me.hype >= 100 && ad < me.reach * 1.4) { it.special = 1; return; }
    // edge danger: don't fight with your back to the edge
    const backToEdge = Math.abs(me.x) > W - 1.3 && Math.sign(me.x) === -toward;
    if (backToEdge && Math.random() < 0.5) { if (me.stamina > 30 && Math.random() < 0.4) { it.up = 1; } if (toward > 0) it.right = true; else it.left = true; return; }
    if (me.stamina < 20 && ad < R + 0.8) { if (toward > 0) it.left = true; else it.right = true; return; }
    if (ad <= R) {
      const r = Math.random();
      const oEdge = Math.abs(o.x) > W - 2.2 && Math.sign(o.x) === toward;
      if (o.crouch) { it.heavy = 1; return; }
      if (r < 0.10) { it.feint = 1; return; }
      if (r < 0.20 && me.stamina > 40) { it.special = 1; return; }
      if (r < (oEdge ? 0.55 : 0.42)) { it.heavy = 1; return; }
      if (r < 0.80) { it.light = 1; return; }
      if (r < 0.88) { it.parry = 1; return; }
      return;
    }
    if (ad > R + 1.4 && me.stamina > 70 && Math.random() < 0.12) { it.charge = true; this.chargeT = 0.4 + Math.random() * 0.6; return; }
    if (toward > 0) it.right = true; else it.left = true;
    if (Math.random() < 0.03 && me.stamina > 50) it.up = 1;
  }
}
