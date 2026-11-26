"use client";
/**
 * All sounds are synthesized with the Web Audio API (oscillators + noise).
 * No audio files, nothing copyrighted. Browsers only allow audio after a user
 * gesture, so call unlockAudio() from a click/tap handler first.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  return ctx;
}

export function unlockAudio(): boolean {
  const c = getCtx();
  if (!c) return false;
  if (c.state === "suspended") void c.resume().catch(() => {});
  // A silent blip fully unlocks iOS Safari.
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    g.gain.value = 0.0001;
    o.connect(g).connect(master!);
    o.start();
    o.stop(c.currentTime + 0.01);
  } catch {
    /* ignore */
  }
  return true;
}

export function audioReady(): boolean {
  return !!ctx && ctx.state === "running";
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
}
export function isSoundEnabled() {
  return enabled;
}

function ready(): AudioContext | null {
  if (!enabled) return null;
  const c = getCtx();
  if (!c || c.state !== "running" || !master) return null;
  return c;
}

function tone(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  opts: { type?: OscillatorType; gain?: number; attack?: number; glideTo?: number; dest?: AudioNode } = {},
) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(freq, start);
  if (opts.glideTo) o.frequency.exponentialRampToValueAtTime(opts.glideTo, start + dur);
  const peak = opts.gain ?? 0.2;
  const a = opts.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + a);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(opts.dest ?? master!);
  o.start(start);
  o.stop(start + dur + 0.05);
}

let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext, start: number, dur: number, opts: { gain?: number; filter?: BiquadFilterType; freq?: number; q?: number } = {}) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 1, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = opts.filter ?? "bandpass";
  f.frequency.value = opts.freq ?? 2000;
  f.Q.value = opts.q ?? 1;
  const g = c.createGain();
  const peak = opts.gain ?? 0.2;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(start, Math.random() * 0.5);
  src.stop(start + dur + 0.05);
}

/** A small bell: inharmonic partials decaying at different rates. */
function bell(c: AudioContext, freq: number, start: number, gain = 0.12, dur = 1.2) {
  const partials = [1, 2.0, 2.76, 4.07, 5.4];
  partials.forEach((m, i) => tone(c, freq * m, start, dur / (1 + i * 0.6), { gain: gain / (1 + i * 0.9), type: "sine" }));
}

/* ---------------- Projector ---------------- */

/** Soft wooden tick. `bright` for the last 60 seconds. */
export function playTick(bright = false) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  tone(c, bright ? 1250 : 900, t, 0.05, { type: "triangle", gain: bright ? 0.12 : 0.07, glideTo: bright ? 800 : 600 });
  noise(c, t, 0.03, { freq: bright ? 3200 : 2200, q: 4, gain: bright ? 0.08 : 0.05 });
}

/** Sleigh-bell jingle for the final 10 seconds; `step` 0..9 rises in pitch. */
export function playJingle(step: number) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const base = 1800 * Math.pow(2, step / 12);
  for (let i = 0; i < 6; i++) {
    const s = t + i * 0.025 + Math.random() * 0.01;
    tone(c, base * (1 + Math.random() * 0.08), s, 0.12, { type: "square", gain: 0.025 });
    noise(c, s, 0.08, { freq: 6000 + step * 300, q: 3, gain: 0.07 });
  }
}

/** Closing chime: bells + warm chord. */
export function playClosingChime() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  [784, 659, 523, 392].forEach((f, i) => bell(c, f, t + i * 0.22, 0.14, 1.8));
  [261.6, 329.6, 392, 523.3].forEach((f) => tone(c, f, t + 0.9, 2.6, { type: "triangle", gain: 0.07, attack: 0.25 }));
}

/** Sparkle ding for each new unwrap. */
export function playDing() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  bell(c, 1568, t, 0.07, 0.7);
  tone(c, 2637, t + 0.06, 0.3, { gain: 0.03 });
}

/** Celebratory fanfare. `big` adds more voices (phone jackpot / projector). */
export function playFanfare(big = true) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const notes: [number, number, number][] = [
    [392, 0, 0.16],
    [523.3, 0.16, 0.16],
    [659.3, 0.32, 0.16],
    [784, 0.48, 0.5],
    [659.3, 0.98, 0.16],
    [784, 1.14, 0.9],
  ];
  for (const [f, s, d] of notes) {
    tone(c, f, t + s, d + 0.15, { type: "sawtooth", gain: 0.045, attack: 0.02 });
    tone(c, f, t + s, d + 0.15, { type: "triangle", gain: 0.08, attack: 0.02 });
    if (big) tone(c, f / 2, t + s, d + 0.15, { type: "triangle", gain: 0.06, attack: 0.02 });
  }
  if (big) {
    [523.3, 659.3, 784, 1046.5].forEach((f) => tone(c, f, t + 1.14, 1.6, { type: "triangle", gain: 0.05, attack: 0.05 }));
    for (let i = 0; i < 8; i++) bell(c, 1568 + i * 220, t + 1.2 + i * 0.07, 0.04, 0.6);
  }
}

/* ---------------- Phone ---------------- */

/** Paper rustle + pop + sparkle chime. */
export function playUnwrap() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 10; i++) noise(c, t + i * 0.09 + Math.random() * 0.04, 0.09, { freq: 1500 + Math.random() * 3500, q: 0.8, gain: 0.12 });
  // pop when the lid flies
  tone(c, 180, t + 1.05, 0.12, { type: "sine", gain: 0.35, glideTo: 60 });
  noise(c, t + 1.05, 0.06, { filter: "highpass", freq: 1200, gain: 0.25 });
  // sparkle
  [1318.5, 1568, 2093, 2637].forEach((f, i) => bell(c, f, t + 1.15 + i * 0.08, 0.06, 0.8));
}

export function playJackpotPhone() {
  playFanfare(true);
}
