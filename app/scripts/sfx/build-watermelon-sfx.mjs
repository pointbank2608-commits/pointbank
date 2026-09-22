/**
 * 수박 문장 게임용 짧은 효과음 wav 를 만든다.
 * 오실레이터 한 방(삐-)이 아니라, 노이즈·저음 몸통·배음을 겹친 폴리 질감.
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
  if (t < attack) return t / attack;
  return Math.exp(-(t - attack) / decay);
}

function noise() {
  return Math.random() * 2 - 1;
}

function lowpassState() {
  return { y: 0 };
}

function lowpass(state, x, cutoff) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  state.y += a * (x - state.y);
  return state.y;
}

function highpassState() {
  return { prevX: 0, prevY: 0 };
}

function highpass(state, x, cutoff) {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SR;
  const a = rc / (rc + dt);
  const y = a * (state.prevY + x - state.prevX);
  state.prevX = x;
  state.prevY = y;
  return y;
}

function mixInto(buf, start, samples, gain = 1) {
  for (let i = 0; i < samples.length; i++) {
    const at = start + i;
    if (at >= 0 && at < buf.length) buf[at] += samples[i] * gain;
  }
}

function sineBurst(seconds, freqStart, freqEnd, attack, decay, gain) {
  const n = Math.floor(SR * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const p = i / Math.max(1, n - 1);
    const f = freqStart * Math.pow(freqEnd / freqStart, p);
    out[i] = Math.sin(2 * Math.PI * f * t) * env(t, attack, decay) * gain;
  }
  return out;
}

function noiseBurst(seconds, cutoff, attack, decay, gain, hp = 80) {
  const n = Math.floor(SR * seconds);
  const out = new Float32Array(n);
  const lp = lowpassState();
  const hip = highpassState();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const raw = highpass(hip, lowpass(lp, noise(), cutoff), hp);
    out[i] = raw * env(t, attack, decay) * gain;
  }
  return out;
}

function pluck(seconds, freq, decay, gain) {
  const n = Math.floor(SR * seconds);
  const delay = Math.max(2, Math.round(SR / freq));
  const buf = new Float64Array(delay);
  for (let i = 0; i < delay; i++) buf[i] = noise();
  const out = new Float32Array(n);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const next = idx + 1 < delay ? idx + 1 : 0;
    const x = 0.5 * (buf[idx] + buf[next]) * Math.exp(-i / (SR * decay));
    buf[idx] = x;
    out[i] = x * gain;
    idx = next;
  }
  return out;
}

function bell(seconds, freqs, gain) {
  const n = Math.floor(SR * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = 0;
    freqs.forEach((f, k) => {
      const decay = 0.18 + k * 0.07;
      s += Math.sin(2 * Math.PI * f * t) * Math.exp(-t / decay) * (1 / (k + 1.15));
    });
    out[i] = s * gain;
  }
  return out;
}

function soften(buf) {
  const lp = lowpassState();
  for (let i = 0; i < buf.length; i++) buf[i] = lowpass(lp, buf[i], 9800);
  let peak = 0.0001;
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
  const scale = 0.88 / peak;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i] * scale;
    buf[i] = clamp(x - x * x * x * 0.12, -0.97, 0.97);
  }
  return buf;
}

function writeWav(name, mono) {
  soften(mono);
  const stereo = new Float32Array(mono.length * 2);
  for (let i = 0; i < mono.length; i++) {
    const l = mono[i];
    const rIdx = Math.min(mono.length - 1, i + 11);
    stereo[i * 2] = l;
    stereo[i * 2 + 1] = mono[rIdx] * 0.92 + l * 0.08;
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
  const file = path.join(OUT, name);
  fs.writeFileSync(file, buf);
  console.log(name, `${(mono.length / SR).toFixed(2)}s`, buf.length, 'bytes');
}

function alloc(seconds) {
  return new Float32Array(Math.floor(SR * seconds));
}

function drop() {
  const buf = alloc(0.28);
  mixInto(buf, 0, noiseBurst(0.045, 1800, 0.002, 0.03, 0.55, 200));
  mixInto(buf, 0, sineBurst(0.2, 168, 72, 0.004, 0.09, 0.62));
  mixInto(buf, Math.floor(SR * 0.012), pluck(0.16, 210, 0.07, 0.22));
  mixInto(buf, Math.floor(SR * 0.018), sineBurst(0.12, 92, 58, 0.008, 0.07, 0.28));
  return buf;
}

function merge() {
  const buf = alloc(0.36);
  mixInto(buf, 0, noiseBurst(0.07, 1400, 0.003, 0.045, 0.42, 160));
  mixInto(buf, 0, sineBurst(0.16, 210, 110, 0.005, 0.08, 0.4));
  mixInto(buf, Math.floor(SR * 0.04), noiseBurst(0.12, 900, 0.006, 0.08, 0.32, 120));
  mixInto(buf, Math.floor(SR * 0.05), sineBurst(0.2, 146, 88, 0.01, 0.11, 0.38));
  mixInto(buf, Math.floor(SR * 0.08), sineBurst(0.18, 320, 420, 0.01, 0.1, 0.16));
  return buf;
}

function agree() {
  const buf = alloc(0.7);
  mixInto(buf, 0, noiseBurst(0.06, 3200, 0.004, 0.04, 0.12, 600));
  mixInto(buf, 0, bell(0.68, [784, 1178, 1568, 1975, 2352], 0.42));
  mixInto(buf, Math.floor(SR * 0.04), sineBurst(0.28, 1178, 1178, 0.01, 0.16, 0.12));
  return buf;
}

function pop() {
  const buf = alloc(0.48);
  mixInto(buf, 0, noiseBurst(0.05, 2600, 0.0015, 0.028, 0.55, 300));
  mixInto(buf, 0, sineBurst(0.22, 740, 160, 0.003, 0.1, 0.48));
  mixInto(buf, Math.floor(SR * 0.03), noiseBurst(0.14, 1600, 0.006, 0.08, 0.22, 250));
  mixInto(buf, Math.floor(SR * 0.05), sineBurst(0.12, 1240, 880, 0.004, 0.06, 0.16));
  mixInto(buf, Math.floor(SR * 0.09), sineBurst(0.14, 1680, 1320, 0.004, 0.07, 0.1));
  mixInto(buf, Math.floor(SR * 0.04), pluck(0.2, 280, 0.08, 0.14));
  return buf;
}

function over() {
  const buf = alloc(0.85);
  mixInto(buf, 0, noiseBurst(0.16, 700, 0.008, 0.12, 0.28, 60));
  mixInto(buf, 0, sineBurst(0.36, 96, 42, 0.01, 0.18, 0.55));
  mixInto(buf, Math.floor(SR * 0.08), sineBurst(0.28, 196, 147, 0.012, 0.16, 0.22));
  mixInto(buf, Math.floor(SR * 0.22), sineBurst(0.4, 147, 110, 0.02, 0.22, 0.2));
  return buf;
}

fs.mkdirSync(OUT, { recursive: true });
writeWav('watermelon-drop.wav', drop());
writeWav('watermelon-merge.wav', merge());
writeWav('watermelon-agree.wav', agree());
writeWav('watermelon-pop.wav', pop());
writeWav('watermelon-over.wav', over());
