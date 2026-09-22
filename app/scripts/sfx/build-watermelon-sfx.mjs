/**
 * 수박 문장 게임 효과음 — 유치·초등 저학년용 귀여운 물방울/비눗방울.
 * 저음 쿵·폭발 대신, 짧고 동그란 drip / ploop / pop 만 겹친다.
 */
import fs from 'node:fs';
import path from 'node:path';

const SR = 44100;
const OUT = path.resolve(import.meta.dirname, '../../public/sounds');

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function env(t, attack, decay) {
  if (t < 0) return 0;
  if (t < attack) return t / Math.max(0.0001, attack);
  return Math.exp(-(t - attack) / decay);
}

function mixInto(buf, start, samples, gain = 1) {
  for (let i = 0; i < samples.length; i++) {
    const at = start + i;
    if (at >= 0 && at < buf.length) buf[at] += samples[i] * gain;
  }
}

/** 물방울 한 방울: 높은 음이 살짝 머물다 동그랗게 내려온다. */
function drip({ startHz, endHz, dur, gain, attack = 0.004, hold = 0.22 }) {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const p = i / Math.max(1, n - 1);
    const fall = Math.pow(p, 1 + hold * 2);
    const f = startHz * Math.pow(endHz / startHz, fall);
    phase += (2 * Math.PI * f) / SR;
    const amp = env(t, attack, dur * 0.34) * gain;
    out[i] = (Math.sin(phase) + 0.16 * Math.sin(phase * 2)) * amp;
  }
  return out;
}

/** 비눗방울이 터질 때처럼 빠르게 올라가며 사라진다. */
function bubbleUp({ startHz, endHz, dur, gain, attack = 0.002 }) {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const p = i / Math.max(1, n - 1);
    const f = startHz * Math.pow(endHz / startHz, Math.sqrt(p));
    phase += (2 * Math.PI * f) / SR;
    const amp = env(t, attack, dur * 0.22) * gain * (1 - p * 0.35);
    out[i] = Math.sin(phase) * amp;
  }
  return out;
}

/** 작고 반짝이는 물방울 핑. */
function ping({ hz, dur, gain, attack = 0.003 }) {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const amp = env(t, attack, dur * 0.28) * gain;
    out[i] = Math.sin(2 * Math.PI * hz * t) * amp;
  }
  return out;
}

function soften(buf) {
  let peak = 0.0001;
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
  const scale = 0.76 / peak;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i] * scale;
    buf[i] = clamp(x - x * x * x * 0.08, -0.92, 0.92);
  }
  return buf;
}

function writeWav(name, mono) {
  soften(mono);
  const stereo = new Float32Array(mono.length * 2);
  for (let i = 0; i < mono.length; i++) {
    const l = mono[i];
    const rIdx = Math.min(mono.length - 1, i + 8);
    stereo[i * 2] = l;
    stereo[i * 2 + 1] = mono[rIdx] * 0.9 + l * 0.1;
  }
  const dataBytes = stereo.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2 * 2, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);
  let o = 44;
  for (let i = 0; i < stereo.length; i++) {
    buf.writeInt16LE(Math.round(clamp(stereo[i], -1, 1) * 32767), o);
    o += 2;
  }
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(name, `${(mono.length / SR).toFixed(2)}s`, buf.length, 'bytes');
}

function alloc(seconds) {
  return new Float32Array(Math.floor(SR * seconds));
}

function drop() {
  const buf = alloc(0.22);
  mixInto(buf, 0, drip({ startHz: 980, endHz: 460, dur: 0.16, gain: 0.7, hold: 0.28 }));
  mixInto(buf, 0, ping({ hz: 1560, dur: 0.05, gain: 0.14 }));
  return buf;
}

function merge() {
  const buf = alloc(0.32);
  mixInto(buf, 0, drip({ startHz: 1040, endHz: 560, dur: 0.12, gain: 0.48, hold: 0.2 }));
  mixInto(buf, Math.floor(SR * 0.055), drip({ startHz: 880, endHz: 420, dur: 0.14, gain: 0.58, hold: 0.24 }));
  mixInto(buf, Math.floor(SR * 0.12), drip({ startHz: 720, endHz: 520, dur: 0.16, gain: 0.32, hold: 0.4 }));
  return buf;
}

function agree() {
  const buf = alloc(0.55);
  mixInto(buf, 0, drip({ startHz: 784, endHz: 660, dur: 0.14, gain: 0.36, hold: 0.35 }));
  mixInto(buf, Math.floor(SR * 0.1), drip({ startHz: 988, endHz: 820, dur: 0.15, gain: 0.4, hold: 0.35 }));
  mixInto(buf, Math.floor(SR * 0.2), drip({ startHz: 1175, endHz: 990, dur: 0.2, gain: 0.46, hold: 0.4 }));
  mixInto(buf, Math.floor(SR * 0.22), ping({ hz: 1568, dur: 0.18, gain: 0.16 }));
  return buf;
}

function pop() {
  const buf = alloc(0.38);
  mixInto(buf, 0, bubbleUp({ startHz: 620, endHz: 1680, dur: 0.09, gain: 0.62 }));
  mixInto(buf, Math.floor(SR * 0.04), ping({ hz: 1320, dur: 0.1, gain: 0.22 }));
  mixInto(buf, Math.floor(SR * 0.08), ping({ hz: 1760, dur: 0.11, gain: 0.18 }));
  mixInto(buf, Math.floor(SR * 0.12), ping({ hz: 2093, dur: 0.12, gain: 0.14 }));
  mixInto(buf, Math.floor(SR * 0.06), drip({ startHz: 980, endHz: 720, dur: 0.12, gain: 0.2, hold: 0.15 }));
  return buf;
}

function over() {
  const buf = alloc(0.72);
  mixInto(buf, 0, drip({ startHz: 784, endHz: 520, dur: 0.18, gain: 0.42, hold: 0.2 }));
  mixInto(buf, Math.floor(SR * 0.2), drip({ startHz: 659, endHz: 430, dur: 0.2, gain: 0.38, hold: 0.22 }));
  mixInto(buf, Math.floor(SR * 0.4), drip({ startHz: 523, endHz: 340, dur: 0.26, gain: 0.34, hold: 0.18 }));
  return buf;
}

fs.mkdirSync(OUT, { recursive: true });
writeWav('watermelon-drop.wav', drop());
writeWav('watermelon-merge.wav', merge());
writeWav('watermelon-agree.wav', agree());
writeWav('watermelon-pop.wav', pop());
writeWav('watermelon-over.wav', over());
