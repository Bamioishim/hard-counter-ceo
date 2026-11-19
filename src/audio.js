// Tiny WebAudio synth. No files.
let ctx = null, master = null, muted = false, noiseBuf = null;
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; }
export function isMuted() { return muted; }
function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
  if (!ctx) return; const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, 0.005, vol, dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, freq, q = 1, vol = 0.3, type = 'bandpass', delay = 0, sweep) {
  if (!ctx) return; const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  const g = ctx.createGain(); env(g, t, 0.004, vol, dur);
  s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.05);
}
export const sfx = {
  blip() { tone('square', 660, 880, 0.06, 0.08); },
  select() { tone('square', 520, 1040, 0.09, 0.1); tone('square', 1040, 1040, 0.08, 0.06, 0.07); },
  lock() { tone('sawtooth', 220, 880, 0.18, 0.12); noise(0.15, 3000, 1, 0.08); },
  whoosh() { noise(0.14, 900, 0.8, 0.12, 'bandpass', 0, 3500); },
  light() { noise(0.06, 2500, 2, 0.2); tone('triangle', 420, 180, 0.07, 0.25); },
  heavy() { noise(0.12, 600, 1, 0.35, 'lowpass'); tone('sine', 140, 45, 0.25, 0.55); tone('square', 300, 90, 0.1, 0.12); },
  bonk() { tone('square', 880, 220, 0.12, 0.18); tone('sine', 160, 50, 0.3, 0.6); noise(0.1, 1200, 1, 0.3); },
  parry() { tone('triangle', 1800, 1700, 0.25, 0.22); tone('sine', 2700, 2600, 0.35, 0.12); noise(0.05, 6000, 3, 0.15); },
  block() { tone('square', 500, 380, 0.07, 0.12); noise(0.05, 4000, 2, 0.12); },
  jump() { tone('triangle', 300, 620, 0.1, 0.12); },
  land() { noise(0.05, 300, 1, 0.12, 'lowpass'); },
  charge() { tone('sawtooth', 120, 600, 0.5, 0.06); },
  sig() { tone('sawtooth', 200, 1400, 0.25, 0.14); noise(0.3, 2000, 0.7, 0.2, 'bandpass', 0, 600); },
  finisher() { tone('sawtooth', 80, 900, 0.5, 0.2); tone('square', 110, 55, 0.7, 0.25, 0.15); noise(0.7, 500, 0.5, 0.4, 'lowpass', 0.15, 80); },
  ringout() { tone('sawtooth', 900, 60, 0.9, 0.18); noise(0.6, 800, 0.5, 0.35, 'lowpass', 0.25, 100); tone('sine', 70, 30, 0.6, 0.5, 0.25); },
  bell() { tone('square', 988, 988, 0.12, 0.1); tone('square', 1319, 1319, 0.25, 0.1, 0.12); },
  fight() { tone('sawtooth', 220, 440, 0.12, 0.14); tone('sawtooth', 440, 880, 0.2, 0.14, 0.1); noise(0.25, 2500, 0.8, 0.15, 'bandpass', 0.1); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.16, 0.1, i * 0.12)); },
  lose() { [392, 330, 262].forEach((f, i) => tone('triangle', f, f * 0.97, 0.22, 0.12, i * 0.18)); },
  denied() { tone('square', 200, 150, 0.1, 0.1); },
};
