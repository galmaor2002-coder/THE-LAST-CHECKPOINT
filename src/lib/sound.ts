// All sound is synthesized with the Web Audio API: no audio files to license or load.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let rain: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let muted = (() => { try { return localStorage.getItem('tlc-muted') === '1'; } catch { return false; } })();

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function isMuted() { return muted; }
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem('tlc-muted', m ? '1' : '0'); } catch { /* ignore */ }
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.05);
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, delay = 0, slideTo?: number) {
  const c = ac(); if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noiseBuffer(c: AudioContext, seconds: number) {
  const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function burst(dur: number, freq: number, vol = 0.25, q = 1) {
  const c = ac(); if (!c || !master) return;
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, dur);
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  src.connect(f).connect(g).connect(master); src.start();
}

export const sfx = {
  click: () => tone(1800, 0.04, 'square', 0.05),
  beep: () => tone(880, 0.12, 'sine', 0.12),
  scan: () => { tone(400, 0.5, 'sawtooth', 0.05, 0, 1600); tone(1600, 0.08, 'sine', 0.1, 0.5); },
  alert: () => { tone(620, 0.18, 'square', 0.1); tone(620, 0.18, 'square', 0.1, 0.25); },
  deny: () => tone(160, 0.35, 'sawtooth', 0.15, 0, 90),
  accept: () => { tone(520, 0.1, 'sine', 0.12); tone(780, 0.16, 'sine', 0.12, 0.1); },
  stamp: () => burst(0.12, 300, 0.4, 0.8),
  heartbeat: () => { tone(60, 0.12, 'sine', 0.4); tone(55, 0.14, 'sine', 0.3, 0.18); },
  siren: () => { for (let i = 0; i < 3; i++) { tone(500, 0.45, 'sawtooth', 0.08, i * 0.9, 900); tone(900, 0.45, 'sawtooth', 0.08, i * 0.9 + 0.45, 500); } },
  sting: () => { tone(110, 1.6, 'sawtooth', 0.12, 0, 55); burst(1.2, 120, 0.3, 0.5); },
  win: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.5, 'triangle', 0.12, i * 0.14)),
  lose: () => [330, 262, 196, 131].forEach((f, i) => tone(f, 0.7, 'sawtooth', 0.08, i * 0.22)),
};

export function startRain() {
  const c = ac(); if (!c || !master || rain) return;
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 4); src.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
  const gain = c.createGain(); gain.gain.value = 0.0001;
  src.connect(hp).connect(lp).connect(gain).connect(master);
  src.start();
  gain.gain.setTargetAtTime(0.07, c.currentTime, 1.5);
  rain = { src, gain };
}

/** Browsers block audio until a user gesture; call this from the first click. */
export function unlockAudio() {
  ac();
  startRain();
}
