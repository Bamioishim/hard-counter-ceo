import * as THREE from 'three';

const matCache = new Map();
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.78, metalness: o.metal ?? 0.02, flatShading: true,
    emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, transparent: !!o.opacity, opacity: o.opacity ?? 1 });
  matCache.set(key, m);
  return m;
}
const geoCache = new Map();
function boxGeo(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
export function box(w, h, d, color, x = 0, y = 0, z = 0, o) {
  const m = new THREE.Mesh(boxGeo(w, h, d), typeof color === 'object' ? color : mat(color, o));
  m.position.set(x, y, z); m.castShadow = true;
  return m;
}
function cyl(rt, rb, h, color, seg = 8, o) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, o));
  m.castShadow = true; return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Base chibi body. Forward is +x (weapon side). Front faces camera (+z).
function baseRig(o) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const tw = o.torsoW ?? 0.62;
  const hipY = 0.55;
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.15, hipY, 0);
    leg.add(box(0.21, 0.42, 0.24, o.pants, 0, -0.21, 0));
    leg.add(box(0.24, 0.14, 0.32, o.shoes ?? '#22232b', 0, -0.48, 0.04));
    body.add(leg); legs.push(leg);
  }
  const torso = new THREE.Group(); torso.position.y = hipY; body.add(torso);
  torso.add(box(tw, 0.62, 0.38, o.shirt, 0, 0.31, 0));
  const head = new THREE.Group(); head.position.y = 0.62; torso.add(head);
  const hw = o.headW ?? 0.66;
  head.add(box(hw, 0.6, 0.58, o.skin, 0, 0.32, 0));
  // simple face
  if (!o.noFace) {
    const eye = o.eye ?? '#15161c';
    head.add(box(0.08, o.eyeH ?? 0.1, 0.02, eye, -0.14, 0.32, 0.3));
    head.add(box(0.08, o.eyeH ?? 0.1, 0.02, eye, 0.14, 0.32, 0.3));
    head.add(box(0.16, 0.03, 0.02, o.mouth ?? '#7a3b33', 0, 0.16, 0.3));
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * (tw / 2 + 0.09), 0.56, 0);
    arm.add(box(0.17, 0.42, 0.2, o.sleeve ?? o.shirt, 0, -0.2, 0));
    arm.add(box(0.17, 0.14, 0.2, o.hand ?? o.skin, 0, -0.46, 0));
    torso.add(arm); arms.push(arm);
  }
  // Hard Counter archetype: the weapon is fixed to the hips, not held. It pivots at the belt.
  const weapon = new THREE.Group(); weapon.position.set(0.1, 0.5, 0.2); body.add(weapon);
  return { g, body, torso, head, legs, armBack: arms[0], armFront: arms[1], weapon };
}

export function weaponLen(def) { return 0.95 + def.stats.reach * 0.08; }

// Same silhouette for every fighter, like the original four: gold collar ring, long capsule shaft, bulbed rounded tip.
const LANCE = {
  elon:    { shaft: '#c4c9d8', band: '#ffffff' },
  jensen:  { shaft: '#3b3e46', band: '#76b900', glow: true },
  mark:    { shaft: '#5b8df5', band: '#e9eefc' },
  jeff:    { shaft: '#ff9b2f', band: '#1e2a44' },
  vitalik: { shaft: '#8e8ef7', band: '#e3e3ff', glow: true },
  ansem:   { shaft: '#e2b25a', band: '#6b5636' },
  wale:    { shaft: '#f08bbd', band: '#ffffff' },
  sam:     { shaft: '#eafffb', band: '#3fe0c5', glow: true },
};
function buildLance(r, def) {
  const L = weaponLen(def), c = LANCE[def.id];
  const sm = mat(c.shaft, { rough: 0.38, metal: 0.05, emissive: c.glow ? c.shaft : '#000000', ei: c.glow ? 0.12 : 1 });
  const shaft = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, L - 0.25, 4, 12), sm);
  shaft.rotation.z = -Math.PI / 2; shaft.position.x = (L - 0.25) / 2 + 0.06; r.weapon.add(shaft);
  const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.14, 4, 12), sm);
  tip.rotation.z = -Math.PI / 2; tip.position.x = L - 0.08; r.weapon.add(tip);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.028, 8, 18), mat('#d8b24a', { metal: 0.7, rough: 0.3 }));
  ring.rotation.y = Math.PI / 2; ring.position.x = 0.04; r.weapon.add(ring);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.089, 0.089, 0.05, 12), mat(c.band, { emissive: c.glow ? c.band : '#000000', ei: 0.9 }));
  band.rotation.z = Math.PI / 2; band.position.x = L * 0.62; r.weapon.add(band);
  r.weapon.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  r.lanceLen = L;
}

// Small non-functional props so each CEO still reads at a glance.
function addProps(r, def) {
  if (def.id === 'wale') {
    const star = new THREE.Group();
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), mat('#8a8f9c', { metal: .8, rough: .25 })); b.position.set(Math.cos(i * Math.PI / 2) * 0.09, Math.sin(i * Math.PI / 2) * 0.09, 0); b.rotation.z = i * Math.PI / 2 - Math.PI / 2; b.scale.z = 0.3; star.add(b); }
    star.position.set(0, -0.5, 0.14); r.armBack.add(star); r.spinner = star;
  }
  if (def.id === 'ansem') {
    const bat = cyl(0.06, 0.03, 0.9, '#e3b65f', 8); bat.position.set(-0.05, 0.4, -0.24); bat.rotation.z = 0.7; r.torso.add(bat);
  }
  if (def.id === 'jeff') r.armBack.add(box(0.26, 0.2, 0.22, '#c79a5a', 0, -0.56, 0.1));
  if (def.id === 'jensen') { r.armBack.add(box(0.06, 0.22, 0.3, '#2c2e33', 0, -0.56, 0.12)); r.armBack.add(box(0.07, 0.03, 0.3, '#76b900', 0, -0.46, 0.12, { emissive: '#76b900' })); }
  if (def.id === 'elon') { const x1 = box(0.04, 0.22, 0.03, '#fff', 0, -0.58, 0.12); x1.rotation.z = .7; const x2 = box(0.04, 0.22, 0.03, '#fff', 0, -0.58, 0.12); x2.rotation.z = -.7; r.armBack.add(x1, x2); }
}

const BUILDERS = {
  elon(def) {
    const r = baseRig({ skin: '#efc6a6', shirt: '#17181d', pants: '#22242c', shoes: '#0e0e12' });
    r.head.add(box(0.7, 0.16, 0.62, '#3a2a20', 0, 0.66, -0.01));
    r.head.add(box(0.7, 0.24, 0.12, '#3a2a20', 0, 0.55, -0.26));
    r.head.add(box(0.1, 0.03, 0.02, '#3a2a20', -0.14, 0.42, 0.3));
    r.head.add(box(0.1, 0.03, 0.02, '#3a2a20', 0.14, 0.42, 0.3));
    // X logo on tee
    const x1 = box(0.36, 0.06, 0.02, '#f4f4f4', 0, 0.36, 0.2); x1.rotation.z = 0.78; r.torso.add(x1);
    const x2 = box(0.36, 0.06, 0.02, '#f4f4f4', 0, 0.36, 0.2); x2.rotation.z = -0.78; r.torso.add(x2);
    return r;
  },
  jensen(def) {
    const r = baseRig({ skin: '#e7bf9b', shirt: '#121215', sleeve: '#1b1b1f', pants: '#141418', shoes: '#0b0b0d' });
    r.head.add(box(0.7, 0.14, 0.62, '#8e8e95', 0, 0.66, -0.01));
    r.head.add(box(0.7, 0.3, 0.1, '#77777e', 0, 0.5, -0.27));
    r.head.add(box(0.1, 0.18, 0.5, '#8e8e95', -0.33, 0.52, -0.02));
    r.head.add(box(0.1, 0.18, 0.5, '#8e8e95', 0.33, 0.52, -0.02));
    const leather = mat('#141417', { rough: 0.5, metal: 0.15 });
    r.torso.add(box(0.2, 0.62, 0.41, leather, -0.21, 0.31, 0));
    r.torso.add(box(0.2, 0.62, 0.41, leather, 0.21, 0.31, 0));
    r.torso.add(box(0.2, 0.1, 0.1, leather, -0.17, 0.6, 0.2)); r.torso.add(box(0.2, 0.1, 0.1, leather, 0.17, 0.6, 0.2));
    r.armBack.children[0].material = leather; r.armFront.children[0].material = leather;
    return r;
  },
  mark(def) {
    const r = baseRig({ skin: '#f1c9aa', shirt: '#8b8d94', pants: '#2a2f3d', shoes: '#e9e9ea', hand: '#16161a' });
    for (let i = 0; i < 9; i++) {
      const cx = -0.27 + (i % 5) * 0.135, cz = i < 5 ? 0.18 : -0.12;
      r.head.add(box(0.15, 0.15, 0.17, '#4a3020', cx + (i >= 5 ? 0.06 : 0), 0.68, cz));
    }
    r.head.add(box(0.7, 0.2, 0.3, '#4a3020', 0, 0.6, -0.16));
    // VR headset
    r.head.add(box(0.62, 0.2, 0.16, '#f2f2f4', 0, 0.34, 0.36, { rough: .3 }));
    r.head.add(box(0.5, 0.12, 0.02, '#1d2b55', 0, 0.34, 0.45, { emissive: '#3d7bff', ei: .7 }));
    r.head.add(box(0.72, 0.06, 0.6, '#222', 0, 0.36, -0.02));
    // gloves bigger
    for (const a of [r.armBack, r.armFront]) a.add(box(0.22, 0.18, 0.24, '#c1121f', 0, -0.47, 0));
    return r;
  },
  jeff(def) {
    const r = baseRig({ skin: '#e6b48f', shirt: '#9cc3e6', pants: '#2c3c5c', shoes: '#3a2a1c' });
    r.head.add(box(0.68, 0.06, 0.6, '#efc2a0', 0, 0.63, 0, { rough: .2 })); // shine
    r.head.add(box(0.5, 0.09, 0.03, '#1b1b1b', 0, 0.33, 0.31, { rough: .2, metal: .4 })); // aviators
    r.head.add(box(0.14, 0.04, 0.02, '#7a3b33', 0.03, 0.17, 0.3));
    const vest = mat('#1e2a44', { rough: .5 });
    r.torso.add(box(0.24, 0.6, 0.42, vest, -0.2, 0.3, 0)); r.torso.add(box(0.24, 0.6, 0.42, vest, 0.2, 0.3, 0));
    for (let i = 0; i < 3; i++) r.torso.add(box(0.66, 0.02, 0.43, '#141d31', 0, 0.12 + i * 0.18, 0));
    return r;
  },
  vitalik(def) {
    const r = baseRig({ skin: '#f3d8c4', shirt: '#f1f0f6', pants: '#5a5d6e', shoes: '#2b2b33', torsoW: 0.5, headW: 0.62 });
    r.head.add(box(0.66, 0.14, 0.6, '#3a2c26', 0, 0.66, -0.01));
    r.head.add(box(0.66, 0.26, 0.1, '#3a2c26', 0, 0.52, -0.26));
    r.head.add(box(0.08, 0.2, 0.12, '#f0cdb6', -0.36, 0.34, 0)); r.head.add(box(0.08, 0.2, 0.12, '#f0cdb6', 0.36, 0.34, 0));
    // unicorn tee print
    const tex = canvasTex(64, 64, (c) => {
      c.fillStyle = '#f1f0f6'; c.fillRect(0, 0, 64, 64);
      c.fillStyle = '#ff9fd2'; c.beginPath(); c.ellipse(30, 38, 16, 11, 0, 0, 7); c.fill();
      c.fillRect(38, 20, 10, 18); c.fillStyle = '#ffd36b'; c.beginPath(); c.moveTo(43, 6); c.lineTo(40, 21); c.lineTo(47, 21); c.fill();
      c.fillStyle = '#7fd6ff'; c.fillRect(14, 32, 4, 12); c.fillStyle = '#b28bff'; c.fillRect(18, 30, 4, 10);
      c.fillStyle = '#222'; c.fillRect(42, 25, 3, 3);
    });
    const print = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshStandardMaterial({ map: tex, roughness: .9 }));
    print.position.set(0, 0.32, 0.192); r.torso.add(print);
    return r;
  },
  ansem(def) {
    const r = baseRig({ skin: '#f3c98a', shirt: '#8f8064', pants: '#6f6450', shoes: '#3b3226', hand: '#f6e3c4', noFace: true });
    const fur = '#f3c98a';
    r.head.add(box(0.5, 0.26, 0.04, '#fbf1de', 0, 0.22, 0.3)); // muzzle
    r.head.add(box(0.08, 0.06, 0.04, '#e58a8a', 0, 0.32, 0.32)); // nose
    // ears
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 4), mat(fur)); e.position.set(s * 0.22, 0.72, 0); e.rotation.y = Math.PI / 4; r.head.add(e); }
    // orange glasses
    const gl = mat('#ff8a3d', { emissive: '#ff6a00', ei: .25, rough: .2, opacity: 0.85 });
    r.head.add(box(0.2, 0.1, 0.03, gl, -0.14, 0.4, 0.31)); r.head.add(box(0.2, 0.1, 0.03, gl, 0.14, 0.4, 0.31));
    r.head.add(box(0.5, 0.025, 0.03, '#a8641f', 0, 0.44, 0.31));
    // long white mustache
    for (const s of [-1, 1]) { const m = box(0.05, 0.42, 0.04, '#ffffff', s * 0.12, 0.02, 0.33); m.rotation.z = s * 0.12; r.head.add(m); }
    // hat
    const brim = cyl(0.62, 0.62, 0.04, '#c8ad7f', 14); brim.position.y = 0.66; r.head.add(brim);
    const crown = cyl(0.3, 0.36, 0.26, '#bfa275', 12); crown.position.y = 0.8; r.head.add(crown);
    const band = cyl(0.365, 0.365, 0.05, '#6b5636', 12); band.position.y = 0.7; r.head.add(band);
    // jacket lapels + pocket frog
    r.torso.add(box(0.12, 0.4, 0.02, '#76694f', -0.1, 0.38, 0.2)); r.torso.add(box(0.12, 0.4, 0.02, '#76694f', 0.1, 0.38, 0.2));
    r.torso.add(box(0.1, 0.08, 0.03, '#5aa94b', 0.18, 0.18, 0.2));
    r.torso.add(box(0.14, 0.3, 0.05, '#ffffff', 0, 0.36, 0.205));
    return r;
  },
  wale(def) {
    const r = baseRig({ skin: '#c48a64', shirt: '#efe6cf', pants: '#3a3a44', shoes: '#ece7da', eyeH: 0.03 });
    r.head.add(box(0.7, 0.18, 0.62, '#3b2a22', 0, 0.66, -0.01));
    const quiff = box(0.4, 0.14, 0.3, '#3b2a22', 0.08, 0.78, 0.12); quiff.rotation.z = -0.25; r.head.add(quiff);
    r.head.add(box(0.7, 0.26, 0.12, '#3b2a22', 0, 0.52, -0.26));
    // pink mask on the back side of the head (opposite weapon side), spiral eyes
    const tex = canvasTex(128, 128, (c) => {
      c.fillStyle = '#f59ac6'; c.fillRect(0, 0, 128, 128);
      for (const ex of [36, 92]) {
        c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, 50, 22, 0, 7); c.fill();
        c.strokeStyle = '#1b1b1b'; c.lineWidth = 4; c.beginPath();
        for (let a = 0; a < 16; a += 0.2) { const rr = a * 1.3; const px = ex + Math.cos(a) * rr, py = 50 + Math.sin(a) * rr; a === 0 ? c.moveTo(px, py) : c.lineTo(px, py); }
        c.stroke();
      }
      c.fillStyle = '#e3262b'; c.beginPath(); c.arc(64, 74, 9, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.strokeStyle = '#1b1b1b'; c.lineWidth = 3; c.beginPath(); c.ellipse(64, 100, 34, 13, 0, 0, Math.PI); c.fill(); c.stroke();
    });
    const maskMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: tex, roughness: .7 });
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.5), [maskMat, mat('#f59ac6'), mat('#f59ac6'), mat('#f59ac6'), mat('#f59ac6'), mat('#f59ac6')]);
    // +x face index 0 has the texture; rotate so it faces outward on -x side
    mask.rotation.y = Math.PI; mask.position.set(-0.38, 0.36, -0.04); mask.castShadow = true; r.head.add(mask);
    r.head.add(box(0.06, 0.06, 0.62, '#222', -0.34, 0.6, 0));
    return r;
  },
  sam(def) {
    const r = baseRig({ skin: '#f1c9aa', shirt: '#5f7a8c', pants: '#c9bfa6', shoes: '#f0f0f0', eye: '#2a2f3a', eyeH: 0.13 });
    r.head.add(box(0.7, 0.13, 0.62, '#8a6a4e', 0, 0.66, -0.01));
    r.head.add(box(0.7, 0.24, 0.1, '#8a6a4e', 0, 0.54, -0.26));
    r.head.add(box(0.5, 0.07, 0.1, '#8a6a4e', -0.05, 0.6, 0.26));
    r.torso.add(box(0.3, 0.06, 0.4, '#4e6575', 0, 0.6, 0)); // crewneck
    return r;
  },
};

export function buildFighter(def) {
  const r = BUILDERS[def.id](def);
  r.def = def;
  buildLance(r, def); addProps(r, def);
  r.len = weaponLen(def);
  r.g.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
  // glow ring for hype/charge
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 24), new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; r.g.add(ring); r.ring = ring;
  return r;
}

// Weapon is hip-mounted (Hard Counter style): every move is a hip thrust, a hip swing or a body spin.
const lerp = (a, b, k) => a + (b - a) * k;
export function animate(r, p, time, dt) {
  const k = Math.min(1, dt * 20);
  let wx = 0, wrot = 0.02, armF = 0.5, armB = 0.5, lean = 0, sy = 1, bodyY = 0, spin = 0, legA = 0, wscale = 1, hipX = 0;
  const walk = p.walk;
  if (p.air) { legA = 0.5; armB = 1.3; armF = 1.3; }
  else if (Math.abs(walk) > 0.01) { legA = Math.sin(time * 14) * 0.6; bodyY = Math.abs(Math.sin(time * 14)) * 0.05; armF = 0.5 + Math.sin(time * 14) * 0.4; armB = 0.5 - Math.sin(time * 14) * 0.4; }
  else { bodyY = Math.sin(time * 3) * 0.015; armF = 0.45 + Math.sin(time * 3) * 0.05; }
  if (p.crouch) { sy = 0.74; wrot = -0.05; }
  const ph = p.phase, q = p.q;
  switch (p.state) {
    case 'light': // quick hip jab
      if (ph === 'startup') { wx = -0.12 * q; hipX = -0.05 * q; }
      else if (ph === 'active') { wx = 0.42; hipX = 0.14; lean = 0.12; armF = 1.0; armB = 1.0; }
      else { wx = 0.42 * (1 - q); hipX = 0.14 * (1 - q); }
      break;
    case 'heavy': case 'feint': // hip swing: dip, then sweep up
      if (ph === 'startup') { wrot = -0.55 * q; lean = -0.12 * q; wx = -0.12 * q; armF = 1.6; armB = 1.6; }
      else if (ph === 'active') { wrot = 0.75; wx = 0.18; lean = 0.18; armF = 2.2; armB = 0.3; }
      else { wrot = 0.75 * (1 - q); wx = 0.18 * (1 - q); lean = 0.18 * (1 - q); }
      break;
    case 'charge': // lean back, lance cocked
      wx = -0.28 - p.charge * 0.1; wrot = 0.12; lean = -0.2; sy = 0.93; armF = 1.8; armB = 1.8; hipX = -0.08;
      wx += Math.sin(time * 70) * 0.02 * p.charge; break;
    case 'release': case 'sig': case 'fin': {
      const big = p.state === 'fin' ? 1.25 : p.state === 'sig' ? 1.1 : 1;
      wscale = p.state === 'fin' ? (p.kind === 'extend' ? 1.0 : 1.25) : 1;
      if (ph === 'startup') { wx = -0.25 * q; lean = -0.12; }
      else if (ph === 'active') { wx = 0.55 * big; lean = 0.25; hipX = 0.18; armF = 1.2; armB = 1.2; }
      else { wx = 0.55 * big * (1 - q); lean = 0.25 * (1 - q); }
      if (p.kind === 'extend' && ph === 'active') wscale = 1.9;
      if (p.kind === 'spin' && ph !== 'recovery') { spin = (ph === 'active' ? 1 : q * 0.25) * time * 26; wrot = -0.15; }
      if (p.kind === 'ram' && ph === 'active') { wrot = 0.55; }
      if (p.kind === 'ram' && ph === 'startup') { wrot = -0.4 * q; sy = 0.85; }
      if (p.kind === 'launch' && ph === 'active') { wrot = 0.9; }
      break; }
    case 'parry': // lance snapped upright as a guard
      wrot = 1.15; wx = 0.05; armF = 1.9; armB = 1.9; lean = -0.05; break;
    case 'hit':
      lean = -0.45; armF = 2.6; armB = 2.2; wrot = -0.3; legA = 0.4; break;
    case 'stagger':
      lean = -0.25 + Math.sin(time * 30) * 0.08; wrot = -0.6; armF = 2.8; armB = 2.8; break;
    case 'whiff':
      wrot = 1.15 * (1 - q); armF = 1.4; break;
  }
  r.weapon.position.x = lerp(r.weapon.position.x, 0.1 + wx, k);
  r.weapon.rotation.z = lerp(r.weapon.rotation.z, wrot, k);
  r.weapon.scale.x = lerp(r.weapon.scale.x, wscale, k);
  const ws = lerp(r.weapon.scale.y, wscale > 1.5 ? 1.15 : wscale, k); r.weapon.scale.y = ws; r.weapon.scale.z = ws;
  r.armFront.rotation.z = lerp(r.armFront.rotation.z, armF, k);
  r.armBack.rotation.z = lerp(r.armBack.rotation.z, -armB, k);
  r.body.rotation.z = lerp(r.body.rotation.z, -lean, k);
  r.body.position.x = lerp(r.body.position.x, hipX, k);
  r.body.scale.y = lerp(r.body.scale.y, sy, k);
  r.body.position.y = lerp(r.body.position.y, bodyY, k);
  r.legs[0].rotation.x = lerp(r.legs[0].rotation.x, legA, k);
  r.legs[1].rotation.x = lerp(r.legs[1].rotation.x, p.air ? -0.3 : -legA, k);
  r.body.rotation.y = spin ? spin : lerp(r.body.rotation.y, 0, k);
  if (r.spinner) r.spinner.rotation.z += dt * 9;
  r.ring.material.opacity = lerp(r.ring.material.opacity, p.glow, k);
  r.ring.scale.setScalar(1 + Math.sin(time * 8) * 0.06 + p.glow * 0.4);
}
