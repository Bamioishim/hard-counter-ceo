import * as THREE from 'three';
import '@fontsource/anton/400.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import './style.css';
import { ROSTER, STAT_KEYS, RINGOUT_QUIPS, ARCHETYPES } from './roster.js';
import { buildFighter, animate, box, mat } from './models.js';
import { Match, CPU, W, COST } from './game.js';
import { initAudio, sfx, setMuted, isMuted } from './audio.js';

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches;

// ---------- three.js scene ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a0c1a');
scene.fog = new THREE.Fog('#0a0c1a', 18, 60);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);

scene.add(new THREE.HemisphereLight('#6c76c9', '#0b0c18', 0.85));
const key = new THREE.DirectionalLight('#dfe3ff', 1.6); key.position.set(3, 9, 8); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -9, right: 9, top: 8, bottom: -4, near: 1, far: 30 });
scene.add(key);
const rim = new THREE.DirectionalLight('#a48bff', 0.9); rim.position.set(-6, 5, -8); scene.add(rim);
const pinkFill = new THREE.PointLight('#ff5d8f', 6, 14, 2); pinkFill.position.set(W, 1, 2); scene.add(pinkFill);
const limeFill = new THREE.PointLight('#d6ff3a', 3, 12, 2); limeFill.position.set(-W, 1, 2); scene.add(limeFill);

// moon + city
const moon = new THREE.Mesh(new THREE.SphereGeometry(4, 32, 16), new THREE.MeshBasicMaterial({ color: '#262b46', fog: false }));
moon.position.set(4, 11, -38); scene.add(moon);
const city = new THREE.Group(); scene.add(city);
const winMat = new THREE.MeshBasicMaterial({ color: '#4a527f' });
const winGeo = new THREE.PlaneGeometry(0.18, 0.12);
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 46; i++) {
  const w = 1.5 + rnd() * 3, h = 4 + rnd() * 13, d = 2 + rnd() * 2;
  const z = -14 - rnd() * 26, x = -34 + i * 1.5 + rnd() * 1.2;
  const b = box(w, h, d, new THREE.MeshStandardMaterial({ color: '#12152a', roughness: 1 }), x, h / 2 - 7, z); b.castShadow = false; city.add(b);
  const wins = new THREE.InstancedMesh(winGeo, winMat, 12); let n = 0;
  for (let k = 0; k < 12; k++) { if (rnd() < 0.45) continue; const m = new THREE.Matrix4().makeTranslation(x - w / 2 + 0.3 + rnd() * (w - 0.6), -7 + 1 + rnd() * (h - 2), z + d / 2 + 0.01); wins.setMatrixAt(n++, m); }
  wins.count = n; city.add(wins);
}
// falling dust
const dustN = 260, dustGeo = new THREE.BufferGeometry(), dustPos = new Float32Array(dustN * 3);
for (let i = 0; i < dustN; i++) { dustPos[i * 3] = (rnd() - 0.5) * 40; dustPos[i * 3 + 1] = rnd() * 16 - 3; dustPos[i * 3 + 2] = -rnd() * 20 + 3; }
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#7a81b8', size: 0.06, transparent: true, opacity: 0.6 }));
scene.add(dust);

// roof platform
const roof = new THREE.Group(); scene.add(roof);
const roofW = W * 2 + 0.3;
const top = box(roofW, 0.4, 3.4, new THREE.MeshStandardMaterial({ color: '#23263a', roughness: 0.85 }), 0, -0.2, 0); top.receiveShadow = true; roof.add(top);
roof.add(box(roofW + 0.15, 0.12, 3.55, '#1a1c2c', 0, -0.46, 0));
const base = box(roofW + 0.6, 1.4, 3.9, new THREE.MeshStandardMaterial({ color: '#14162a', roughness: 1 }), 0, -1.2, -0.1); base.receiveShadow = true; roof.add(base);
roof.add(box(roofW, 0.03, 0.05, '#3a3e5c', 0, 0.005, 1.68));
roof.add(box(roofW + 0.15, 0.05, 0.06, '#565b80', 0, -0.4, 1.78, { emissive: '#2a2d48' }));
for (const s of [-1, 1]) {
  roof.add(box(0.1, 0.06, 3.4, '#ff5d8f', s * (W + 0.1), 0.01, 0, { emissive: '#ff5d8f', ei: 1.2 }));
  const dashCol = s < 0 ? '#ffd23a' : '#ff5d8f';
  for (let i = 0; i < 9; i++) roof.add(box(0.34, 0.02, 0.1, dashCol, s * (W - 0.32), 0.01, -1.45 + i * 0.36, { emissive: dashCol, ei: 0.9 }));
}

// sparks pool
const sparks = [];
const sparkGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: '#fff' })); m.visible = false; scene.add(m); sparks.push({ m, v: new THREE.Vector3(), life: 0 }); }
function burst(x, y, color, n = 14, speed = 6) {
  let made = 0;
  for (const s of sparks) {
    if (s.life > 0) continue; s.life = 0.35 + Math.random() * 0.3; s.m.visible = true; s.m.material.color.set(color);
    s.m.position.set(x, y, 0.3); s.v.set((Math.random() - 0.5) * speed * 2, Math.random() * speed, (Math.random() - 0.3) * speed);
    if (++made >= n) break;
  }
}

// ---------- portraits ----------
const portraits = {};
(function makePortraits() {
  const pr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  pr.setSize(96, 96); pr.outputColorSpace = THREE.SRGBColorSpace;
  const ps = new THREE.Scene(); ps.add(new THREE.HemisphereLight('#ffffff', '#445', 1.6)); const d = new THREE.DirectionalLight('#fff', 1.4); d.position.set(2, 3, 4); ps.add(d);
  const pc = new THREE.PerspectiveCamera(28, 1, 0.1, 20); pc.position.set(0.25, 1.55, 2.6); pc.lookAt(0, 1.45, 0);
  for (const def of ROSTER) {
    const r = buildFighter(def); r.weapon.visible = false; r.g.rotation.y = 0.25; ps.add(r.g);
    pr.render(ps, pc); portraits[def.id] = pr.domElement.toDataURL('image/png'); ps.remove(r.g);
  }
  pr.dispose();
})();

// ---------- UI: select ----------
const S = { screen: 'select', step: 1, cursor: 0, p1: null, p2: null, mode: 'cpu', focus: 0, match: null, paused: false, speed: 1, autoP1: false };
const rosterEl = $('roster');
ROSTER.forEach((def, i) => {
  const b = document.createElement('button'); b.className = 'card'; b.dataset.i = i;
  b.innerHTML = `<img alt="" src="${portraits[def.id]}"><span class="cname">${def.name}</span><span class="cnum">${String(i + 1).padStart(2, '0')}</span><span class="ctag"></span>`;
  b.addEventListener('mouseenter', () => { if (S.screen === 'select') { setCursor(i); } });
  b.addEventListener('click', () => { initAudio(); setCursor(i); confirmPick(); });
  rosterEl.appendChild(b);
});
const statList = $('statList');
function renderSelect() {
  const def = ROSTER[S.cursor];
  $('selKicker').textContent = S.step === 1 ? '01 / ME' : (S.mode === 'cpu' ? '02 / RIVAL' : '02 / PLAYER 02');
  $('selName').innerHTML = def.name.length > 6 ? def.name : def.name;
  $('selSub').textContent = def.title;
  $('selBio').textContent = def.bio;
  const arch = ARCHETYPES[def.archetype];
  $('selTrait').textContent = `${def.trait} · ${arch.from} LANCE`;
  $('selQuote').innerHTML = def.quote.replace('\n', '<br>');
  $('dataIdx').textContent = `${String(S.cursor + 1).padStart(2, '0')} / 08`;
  const best = Math.max(...Object.values(def.stats));
  statList.innerHTML = STAT_KEYS.map(([k, label], idx) => {
    const v = def.stats[k];
    return `<div class="stat ${idx === 0 ? 'hl' : ''}"><div class="srow"><span>${label}</span><b>${idx === 0 ? `<em>${v}</em>` : v} / 10</b></div><div class="segs">${Array.from({ length: 10 }, (_, j) => `<i class="${j < v ? 'on' : ''}"></i>`).join('')}</div></div>`;
  }).join('');
  $('sigName').textContent = def.signature.name; $('finName').textContent = def.finisher.name;
  $('rosterTitle').textContent = S.step === 1 ? '01 / CHOOSE YOUR FIGHTER' : '02 / CHOOSE YOUR RIVAL';
  $('selReady').innerHTML = `<i class="dot"></i>${S.step === 1 ? 'PLAYER 01' : S.mode === 'cpu' ? 'CPU RIVAL' : 'PLAYER 02'} / READY TO SELECT`;
  $('ctaCopy').textContent = S.step === 1 ? 'YOUR CEO. YOUR PROBLEM.' : 'FIRST TO TWO. NO BAILOUTS.';
  $('btnLock').innerHTML = S.step === 1 ? 'LOCK IN <span>→</span>' : 'FIGHT <span>→</span>';
  $('optMode').innerHTML = `${S.mode === 'cpu' ? 'VS CPU' : '2P LOCAL'} <b>↻</b>`;
  [...rosterEl.children].forEach((c, i) => {
    c.classList.toggle('cur', i === S.cursor);
    c.classList.toggle('p1lock', S.step === 2 && i === S.p1);
    c.classList.toggle('cpu', S.step === 2 && i === S.cursor);
    let tag = '';
    if (S.step === 1 && i === S.cursor) tag = 'P1 SELECTED';
    if (S.step === 2 && i === S.p1) tag = 'P1 LOCKED';
    if (S.step === 2 && i === S.cursor) tag = S.mode === 'cpu' ? 'CPU SELECTED' : 'P2 SELECTED';
    if (S.step === 2 && i === S.p1 && i === S.cursor) tag = S.mode === 'cpu' ? 'MIRROR MATCH' : 'MIRROR MATCH';
    c.querySelector('.ctag').textContent = tag;
  });
  setPreview(def);
}
function setCursor(i) { if (i !== S.cursor) sfx.blip(); S.cursor = (i + ROSTER.length) % ROSTER.length; renderSelect(); }
function confirmPick() {
  initAudio();
  if (S.step === 1) { S.p1 = S.cursor; S.step = 2; sfx.lock(); if (S.cursor === S.p1) S.cursor = (S.p1 + 1) % ROSTER.length; renderSelect(); }
  else { S.p2 = S.cursor; sfx.lock(); startMatch(); }
}
$('btnLock').addEventListener('click', confirmPick);
$('optMode').addEventListener('click', () => { S.mode = S.mode === 'cpu' ? '2p' : 'cpu'; sfx.select(); renderSelect(); });
$('optStage').addEventListener('click', () => { sfx.denied(); toast('ONE ROOF. THE BUDGET WENT TO GPUS.'); });

// preview model on select screen
let preview = null;
function setPreview(def) {
  if (preview && preview.def === def) return;
  if (preview) scene.remove(preview.g);
  preview = buildFighter(def); preview.g.position.set(0, 0, 0); scene.add(preview.g);
}

// ---------- fight ----------
let rigs = [], cpu = null, cam = { x: 0, z: 16, shake: 0, fin: 1 };
function startMatch() {
  if (preview) { scene.remove(preview.g); preview = null; }
  for (const r of rigs) scene.remove(r.g);
  const a = ROSTER[S.p1], b = ROSTER[S.p2];
  S.match = new Match(a, b, onEvent);
  rigs = [buildFighter(a), buildFighter(b)]; rigs.forEach((r) => scene.add(r.g));
  cpu = S.mode === 'cpu' ? new CPU(0.72) : null;
  S.autoCPU1 = S.autoP1 ? new CPU(0.72) : null;
  S.screen = 'fight'; S.paused = false;
  cam.x = 0; cam.z = 16; cam.shake = 0; cam.fin = 1; releaseAllPads();
  document.body.classList.add('in-fight');
  $('select').classList.add('hidden'); $('hud').classList.remove('hidden');
  $('hudName1').textContent = `P1 / ${a.name}`; $('hudName2').textContent = `${S.mode === 'cpu' ? 'CPU' : 'P2'} / ${b.name}`;
  $('footHint').textContent = 'A D MOVE · W JUMP · S CROUCH · F LIGHT · G HEAVY · H PARRY · R FEINT · T SPECIAL · HOLD E CHARGE · P PAUSE';
  hideSplash(); S.match.startRound();
}
function toSelect() {
  S.screen = 'select'; S.step = 1; S.match = null; S.paused = false;
  cam.x = 0; cam.z = 16; cam.shake = 0; cam.fin = 1; releaseAllPads(); resetViewportZoom();
  for (const r of rigs) scene.remove(r.g); rigs = [];
  document.body.classList.remove('in-fight');
  $('hud').classList.add('hidden'); $('select').classList.remove('hidden'); $('pause').classList.add('hidden');
  $('footHint').textContent = 'ARROWS / BROWSE · ENTER / SELECT · TAB / NEXT CONTROL';
  if (S.p1 != null) S.cursor = S.p1;
  renderSelect();
}

// callouts / splash
const COLORS = { pink: '#ff5d8f', cyan: '#86f4ff', white: '#cfeaff', lime: '#d6ff3a' };
let calloutTimer = null;
function callout(text, color = 'white') {
  const el = $('callout'); el.textContent = text; el.style.color = COLORS[color] || color;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(calloutTimer); calloutTimer = setTimeout(() => el.classList.remove('show'), 950);
}
function splash(big, sub = '', extra = '', final = false) {
  const el = $('splash'); el.classList.add('show'); el.classList.toggle('final', final);
  $('splashBig').textContent = big; $('splashSub').textContent = sub; $('splashExtra').textContent = extra;
  const bigEl = $('splashBig'); bigEl.style.animation = 'none'; void bigEl.offsetWidth; bigEl.style.animation = '';
}
function hideSplash() { $('splash').classList.remove('show', 'final'); }
const nameOf = (i) => ROSTER[i === 0 ? S.p1 : S.p2].name;

function onEvent(type, d) {
  const m = S.match;
  switch (type) {
    case 'round': splash(`ROUND ${String(d.round).padStart(2, '0')}`, d.round === 1 ? 'WINNIE ARENA · STAY ON THE ROOF. SEND THEM OFF.' : 'STAY ON THE ROOF. SEND THEM OFF.'); sfx.bell(); updatePips(); break;
    case 'fight': splash('FIGHT!'); sfx.fight(); setTimeout(() => { if (S.match === m && m.phase === 'fight') hideSplash(); }, 700); break;
    case 'hit': {
      const col = d.m.fin ? '#d6ff3a' : d.heavy ? '#ff5d8f' : '#ffffff';
      burst(d.x, d.y, col, d.m.fin ? 40 : d.heavy ? 18 : 8, d.m.fin ? 11 : 6);
      cam.shake = d.m.fin ? 0.6 : d.heavy ? 0.25 : 0.08;
      if (d.text) callout(d.text, d.text === 'COUNTERPOINT!' ? 'pink' : 'white');
      if (d.m.fin) { sfx.bonk(); } else if (d.heavy) (d.text === 'BONK!' ? sfx.bonk : sfx.heavy)(); else sfx.light();
      break; }
    case 'parry':
      burst(d.x, d.y, d.perfect ? '#86f4ff' : '#cfeaff', d.perfect ? 22 : 8, 7);
      if (d.perfect) { callout('PERFECT PARRY', 'cyan'); sfx.parry(); cam.shake = 0.15; } else { callout('BLOCKED', 'white'); sfx.block(); }
      break;
    case 'callout': callout(d.text, d.color); break;
    case 'sfx': sfx[d]?.(); break;
    case 'land': sfx.land(); break;
    case 'warp': burst(d.f.x, 1, d.f.def.accent, 12, 4); break;
    case 'finisherStart': cam.shake = 0.3; break;
    case 'roundEnd': {
      updatePips();
      if (d.why === 'ringout') { sfx.ringout(); cam.shake = 0.5; splash('RING OUT!', `${nameOf(d.winner)} TAKES THE ROUND`, RINGOUT_QUIPS[Math.floor(Math.random() * RINGOUT_QUIPS.length)]); }
      else { sfx.bell(); splash('TIME!', `${nameOf(d.winner)} TAKES THE ROUND`, 'LOWER KNOCKBACK WINS. BORING, BUT LEGAL.'); }
      break; }
    case 'draw': splash('DRAW', 'NOBODY GETS A BONUS. RUN IT AGAIN.'); break;
    case 'matchEnd': {
      resetViewportZoom();
      const w = d.winner, human = S.mode === 'cpu' ? w === 0 : true;
      splash(`${nameOf(w)} WINS`, 'NO REFUNDS. NO HARD FEELINGS.', '', true);
      $('btnShare').textContent = S.mode === 'cpu' && w !== 0 ? 'SHARE THE L ↗' : 'SHARE THE W ↗';
      (human ? sfx.win : sfx.lose)();
      break; }
  }
}
function updatePips() {
  const m = S.match; if (!m) return;
  for (let s = 0; s < 2; s++) [...$(`pips${s + 1}`).children].forEach((p, i) => p.classList.toggle('won', i < m.wins[s]));
}
$('btnAgain').addEventListener('click', () => { initAudio(); startMatch(); });
$('btnRoster2').addEventListener('click', () => toSelect());
$('btnShare').addEventListener('click', share);

function shareText() {
  const m = S.match; if (!m) return '';
  const w = nameOf(m.winner), l = nameOf(1 - m.winner);
  const url = location.href.split('#')[0];
  let line;
  if (S.mode === 'cpu') line = m.winner === 0 ? `I just ring-outed ${cap(l)} off a roof as ${cap(w)} 🏙️💥` : `${cap(w)} just ring-outed me off a roof. Avenge me 😤`;
  else line = `${cap(w)} just ring-outed ${cap(l)} off a roof 🏙️💥`;
  return `${line} WINNIE ARENA ${url}`;
}
const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
async function share() {
  const text = shareText(); window.__lastShare = text;
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } ta.remove();
  }
  if (isTouch && navigator.share) { try { await navigator.share({ text }); return; } catch (e) { /* cancelled */ } }
  toast(ok ? 'COPIED. GO RUIN A GROUP CHAT.' : text);
}
let toastT = null;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200); }

// pause / modals
function setPause(p) { if (S.screen !== 'fight' || !S.match || S.match.phase === 'over') return; S.paused = p; $('pause').classList.toggle('hidden', !p); if (p) releaseAllPads(); }
$('btnPause').addEventListener('click', () => setPause(!S.paused));
$('btnResume').addEventListener('click', () => setPause(false));
$('btnQuit').addEventListener('click', () => toSelect());
$('btnRoster').addEventListener('click', () => { if (S.screen === 'fight') toSelect(); else if (S.step === 2) { S.step = 1; renderSelect(); } });
$('btnHow').addEventListener('click', () => { $('how').classList.remove('hidden'); if (S.screen === 'fight' && !S.paused) { S.howPaused = true; S.paused = true; } });
$('btnHowClose').addEventListener('click', () => { $('how').classList.add('hidden'); if (S.howPaused) { S.paused = false; S.howPaused = false; } });
$('btnControls').addEventListener('click', () => { const min = document.body.classList.toggle('controls-min'); $('btnControls').textContent = `CONTROLS: ${min ? 'MIN' : 'FULL'}`; });
$('btnSound').addEventListener('click', () => { setMuted(!isMuted()); $('btnSound').textContent = `SOUND: ${isMuted() ? 'OFF' : 'ON'}`; });

// ---------- input ----------
const P1 = { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', KeyF: 'light', KeyG: 'heavy', KeyH: 'parry', KeyR: 'feint', KeyT: 'special', KeyE: 'charge' };
const P2 = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyJ: 'light', KeyK: 'heavy', KeyL: 'parry', KeyU: 'feint', KeyI: 'special', KeyO: 'charge' };
const HELD = ['left', 'right', 'down', 'charge'];
function press(it, a, down) {
  if (!it) return;
  if (HELD.includes(a)) it[a] = down;
  else if (down) it[a] = 1;
}
const focusables = () => [rosterEl.children[S.cursor], $('optMode'), $('optStage'), $('btnLock')];
window.addEventListener('keydown', (e) => {
  initAudio();
  if (!$('how').classList.contains('hidden')) { if (e.code === 'Escape' || e.code === 'Enter') $('btnHowClose').click(); return; }
  if (S.screen === 'select') {
    const cols = innerWidth <= 900 ? 4 : 8;
    if (e.code === 'ArrowRight') setCursor(S.cursor + 1);
    else if (e.code === 'ArrowLeft') setCursor(S.cursor - 1);
    else if (e.code === 'ArrowDown') setCursor(S.cursor + cols);
    else if (e.code === 'ArrowUp') setCursor(S.cursor - cols);
    else if (e.code === 'Tab') { e.preventDefault(); S.focus = (S.focus + (e.shiftKey ? 3 : 1)) % 4; focusables()[S.focus].focus(); sfx.blip(); return; }
    else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      const f = S.focus; if (f === 1) $('optMode').click(); else if (f === 2) $('optStage').click(); else confirmPick();
      return;
    } else if (e.code === 'Escape') { if (S.step === 2) { S.step = 1; S.cursor = S.p1; sfx.blip(); renderSelect(); } return; }
    else return;
    e.preventDefault(); S.focus = 0;
    return;
  }
  if (S.screen === 'fight') {
    if (e.code === 'KeyP') { setPause(!S.paused); return; }
    if (e.code === 'Escape') { toSelect(); return; }
    if (S.match?.phase === 'over' && (e.code === 'Enter')) { startMatch(); return; }
    if (e.repeat) return;
    const m = S.match; if (!m) return;
    if (P1[e.code]) { e.preventDefault(); press(m.f[0].intent, P1[e.code], true); padFlash(P1[e.code], true); }
    if (S.mode === '2p' && P2[e.code]) { e.preventDefault(); press(m.f[1].intent, P2[e.code], true); }
  }
});
window.addEventListener('keyup', (e) => {
  const m = S.match; if (!m || S.screen !== 'fight') return;
  if (P1[e.code]) { press(m.f[0].intent, P1[e.code], false); padFlash(P1[e.code], false); }
  if (S.mode === '2p' && P2[e.code]) press(m.f[1].intent, P2[e.code], false);
});
// on-screen pads (mouse + touch). Each button tracks the pointers holding it, and every
// release path (up, cancel, lost capture, a finger lifted elsewhere, app hidden, screen change)
// clears it, so a held direction or CHARGE can never get stuck and lock out the other buttons.
const padBtns = {};
const padHeld = new Map(); // pointerId -> action
function padRelease(a) {
  const b = padBtns[a]; if (!b) return;
  for (const [id, act] of padHeld) if (act === a) return; // still held by another finger
  b.classList.remove('on'); if (S.match) press(S.match.f[0].intent, a, false);
}
function releasePointer(id) { const a = padHeld.get(id); if (a == null) return; padHeld.delete(id); padRelease(a); }
function releaseAllPads() {
  const acts = new Set(padHeld.values()); padHeld.clear();
  for (const a of acts) padRelease(a);
}
function releaseAllInput() {
  releaseAllPads();
  const m = S.match; if (m) for (const f of m.f) { f.intent.left = f.intent.right = f.intent.down = f.intent.charge = false; }
}
document.querySelectorAll('.pad-grid button').forEach((b) => {
  const a = b.dataset.k; padBtns[a] = b;
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault(); initAudio();
    if (padHeld.has(e.pointerId)) releasePointer(e.pointerId);
    padHeld.set(e.pointerId, a);
    try { b.setPointerCapture?.(e.pointerId); } catch (err) { /* synthetic or already released */ }
    b.classList.add('on'); if (S.match) press(S.match.f[0].intent, a, true);
  });
  const up = (e) => { if (e.cancelable) e.preventDefault(); releasePointer(e.pointerId); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});
// safety nets: release wherever the finger lifts, and on any touch that ends with no fingers left
for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, (e) => releasePointer(e.pointerId), true);
window.addEventListener('touchend', (e) => { if (e.touches.length === 0 && padHeld.size) releaseAllPads(); }, true);
window.addEventListener('touchcancel', (e) => { if (e.touches.length === 0) releaseAllPads(); }, true);
window.addEventListener('blur', releaseAllInput);
window.addEventListener('pagehide', releaseAllInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseAllInput(); if (S.screen === 'fight' && S.match && S.match.phase !== 'over' && !S.paused) setPause(true); } });

// ---------- no browser zoom (iOS ignores user-scalable=no) ----------
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || !e.target.closest?.('.panel.wide')) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = performance.now();
  if (now - lastTouchEnd < 350 && e.changedTouches.length === 1 && e.touches.length === 0 && e.cancelable) {
    // quick second tap: block double-tap zoom, but still deliver the click to normal buttons
    const t = e.target.closest?.('button'); e.preventDefault();
    if (t && !t.closest('.pad-grid')) t.click();
  }
  lastTouchEnd = now;
}, { passive: false });
const vpMeta = document.getElementById('vp');
const VP = vpMeta ? vpMeta.content : '';
function resetViewportZoom() {
  if (!vpMeta) return;
  if (window.visualViewport && Math.abs(visualViewport.scale - 1) < 0.01) return;
  vpMeta.content = VP.replace('maximum-scale=1', 'maximum-scale=1.01');
  requestAnimationFrame(() => { vpMeta.content = VP; window.scrollTo(0, 0); });
}
window.visualViewport?.addEventListener('resize', () => { if (Math.abs(visualViewport.scale - 1) > 0.01) resetViewportZoom(); });
addEventListener('orientationchange', () => setTimeout(resetViewportZoom, 300));

function padFlash(a, on) { padBtns[a]?.classList.toggle('on', on); }

// ---------- HUD ----------
function hud() {
  const m = S.match; if (!m) return;
  m.f.forEach((f, i) => {
    const n = i + 1;
    $(`kb${n}`).textContent = `${Math.round(f.knock)}%`; $(`kbf${n}`).style.width = `${Math.min(100, f.knock / 1.5)}%`;
    $(`st${n}`).textContent = `${Math.round(f.stamina)}%`; $(`stf${n}`).style.width = `${f.stamina}%`;
    $(`hy${n}`).textContent = `${Math.round(f.hype)}%`; const hy = $(`hyf${n}`); hy.style.width = `${f.hype}%`; hy.classList.toggle('full', f.hype >= 100);
    $(`status${n}`).textContent = m.phase === 'fight' ? m.status(f) : '';
  });
  const t = Math.ceil(m.time); $('timer').textContent = t; $('timer').classList.toggle('low', t <= 10 && m.phase === 'fight');
  $('rinfo').textContent = `ROUND ${String(m.round).padStart(2, '0')} / 60S`;
  const me = m.f[0], fighting = m.phase === 'fight';
  for (const [a, c] of [['light', COST.light], ['heavy', COST.heavy], ['parry', COST.parry], ['feint', COST.feint], ['up', COST.jump]]) padBtns[a]?.classList.toggle('locked', fighting && me.stamina < c);
  padBtns.special?.classList.toggle('locked', fighting && me.hype < 100 && me.stamina < COST.sig);
  const sp = padBtns.special; sp.classList.toggle('ready', m.f[0].hype >= 100); sp.querySelector('small').textContent = m.f[0].hype >= 100 ? 'FINISHER!' : 'T · TAP';
}

// ---------- loop ----------
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
let last = performance.now(), acc = 0, clock = 0;
const STEP = 1 / 120;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt; S.frames = (S.frames || 0) + 1;
  const m = S.match;
  if (S.screen === 'fight' && m && !S.paused) {
    acc += dt * S.speed;
    let steps = 0;
    while (acc >= STEP && steps < 40) {
      if (cpu && !S.cpuOff && m.phase === 'fight') cpu.update(m, m.f[1], m.f[0], STEP);
      if (S.autoCPU1 && m.phase === 'fight') S.autoCPU1.update(m, m.f[0], m.f[1], STEP);
      m.step(STEP); acc -= STEP; steps++;
    }
    m.f.forEach((f, i) => {
      const r = rigs[i];
      r.g.position.set(f.x, f.y, 0); r.g.scale.x = f.facing; r.g.rotation.y = f.facing * 0.38;
      r.g.visible = f.y > -14;
      animate(r, m.pose(f), clock, dt);
    });
    hud();
    // camera: track midpoint, zoom with distance
    const [a, b] = m.f; const mid = (Math.max(-W - 2, Math.min(W + 2, a.x)) + Math.max(-W - 2, Math.min(W + 2, b.x))) / 2;
    const dist = Math.abs(a.x - b.x);
    const aspectK = Math.min(2.3, Math.max(1, 1.6 / camera.aspect));
    const tz = Math.min(19, Math.max(14.5, 12.5 + dist * 0.55)) * aspectK;
    cam.x += (mid * 0.55 - cam.x) * Math.min(1, dt * 3); cam.z += (tz - cam.z) * Math.min(1, dt * 2.5);
    cam.fin += ((m.phase === 'fight' && m.slow > 0 ? 0.85 : 1) - cam.fin) * Math.min(1, dt * 8);
    const fin = cam.fin;
    cam.shake *= Math.exp(-dt * 7);
    const sx = (Math.random() - 0.5) * cam.shake, sy = (Math.random() - 0.5) * cam.shake;
    const portrait = camera.aspect < 1 ? 1 : 0;
    camera.position.set(cam.x + sx, 3.9 + portrait * 1.2 + sy, cam.z * fin);
    camera.lookAt(cam.x, 0.95 + portrait * 2.4, 0);
  } else if (S.screen === 'select' && preview) {
    preview.g.rotation.y = Math.sin(clock * 0.6) * 0.9 + 0.35;
    animate(preview, { state: 'idle', walk: 0, glow: 0.35 }, clock, dt);
    const aspectK = Math.max(1, 1.5 / camera.aspect);
    camera.position.set(0, 1.25, 8.6 * aspectK); camera.lookAt(0, 0.6, 0);
  } else if (S.screen === 'fight' && m) {
    hud();
  } else if (S.screen === 'lineup') { /* handled by lineup tick */ }
  // sparks + dust
  for (const s of sparks) if (s.life > 0) { s.life -= dt; s.v.y -= 18 * dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += dt * 10; if (s.life <= 0) s.m.visible = false; }
  const p = dustGeo.attributes.position.array;
  for (let i = 0; i < dustN; i++) { p[i * 3 + 1] -= dt * (0.6 + (i % 5) * 0.15); if (p[i * 3 + 1] < -4) p[i * 3 + 1] = 13; }
  dustGeo.attributes.position.needsUpdate = true;
  pinkFill.intensity = 5 + Math.sin(clock * 2) * 1.2;
  renderer.render(scene, camera);
}
renderSelect();
// ?lineup : all eight fighters on the roof, for weapon reference shots
if (new URLSearchParams(location.search).has('lineup')) {
  S.screen = 'lineup'; scene.remove(preview.g); preview = null;
  $('select').classList.add('hidden'); document.body.classList.add('lineup');
  const lr = ROSTER.map((def, i) => { const r = buildFighter(def); r.g.position.set(-6.0 + i * 1.62, 0, 0); r.g.rotation.y = 0.6; scene.add(r.g); return r; });
  const labels = document.createElement('div'); labels.className = 'lineup-labels';
  labels.innerHTML = ROSTER.map((d) => `<span>${d.name}<small>${ARCHETYPES[d.archetype].from}</small></span>`).join(''); document.getElementById('app').appendChild(labels);
  const tick = () => { requestAnimationFrame(tick); lr.forEach((r) => animate(r, { state: 'idle', walk: 0, glow: 0 }, 0, 0.016)); camera.position.set(0, 2.6, 13.5 * Math.max(1, 1.7 / camera.aspect)); camera.lookAt(0, 0.9, 0); };
  tick();
}
requestAnimationFrame(frame);

// test / debug hook (harmless in prod)
window.__hc = {
  get S() { return S; }, get match() { return S.match; },
  setSpeed(n) { S.speed = n; }, autoP1(on) { S.autoP1 = on; S.autoCPU1 = on ? new CPU(0.72) : null; }, cpuOn(on) { S.cpuOff = !on; },
  shareText, roster: ROSTER.map((r) => r.id),
  get cam() { return { fin: cam.fin, z: camera.position.z, slow: S.match?.slow ?? 0 }; }, padHeld: () => [...padHeld.values()],
};
