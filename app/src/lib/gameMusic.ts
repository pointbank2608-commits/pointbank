import { cubicBezier } from './easing';
import type { MusicSelection } from './types';

/**
 * 게임용 기본 제공 효과음.
 * 실제 음원 파일을 넣지 않고 Web Audio API로 그때그때 합성한다 —
 * 저작권 걱정 없이 어느 학원에서 써도 되는 소리만 기본 제공하기 위함.
 * (실제 대중가요/캐릭터 음악을 쓰고 싶으면 아래 업로드 기능으로 직접 올리면 된다.)
 */

export interface BuiltinSound {
  id: string;
  label: string;
  emoji: string;
}

export const BUILTIN_SOUNDS: BuiltinSound[] = [
  { id: 'drumroll', label: '두구두구', emoji: '🥁' },
  { id: 'heartbeat', label: '심장박동', emoji: '💓' },
  { id: 'clock', label: '시계 초침', emoji: '⏰' },
  { id: 'applause', label: '박수 갈채', emoji: '👏' },
  { id: 'boom', label: '펑!(폭발)', emoji: '💥' },
  { id: 'tada', label: '짜잔', emoji: '🎉' },
  { id: 'countdown', label: '카운트다운', emoji: '⏱️' },
  { id: 'ding', label: '딩동', emoji: '🔔' },
];

let sharedCtx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!sharedCtx) sharedCtx = new AudioContext();
  if (sharedCtx.state === 'suspended') void sharedCtx.resume();
  return sharedCtx;
}

function tone(time: number, freq: number, duration: number, gain: number, type: OscillatorType = 'sine') {
  const c = ctx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(gain, time + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, time + duration);
  osc.connect(g).connect(c.destination);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

function noiseBurst(time: number, duration: number, gain: number) {
  const c = ctx();
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, time);
  src.connect(g).connect(c.destination);
  src.start(time);
}

/** 재생 시작. 되돌아오는 함수를 부르면 그 시점에서 소리를 멈춘다(반복 재생용 stop). */
export function playBuiltin(id: string, opts: { loop?: boolean } = {}): () => void {
  const c = ctx();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function playOnce(startAt: number): number {
    switch (id) {
      case 'drumroll': {
        const hits = 16;
        const span = 1.1;
        for (let i = 0; i < hits; i++) {
          noiseBurst(startAt + (i * span) / hits, span / hits, 0.35);
        }
        tone(startAt + span, 660, 0.5, 0.35, 'square');
        return span + 0.5;
      }
      case 'heartbeat': {
        // 저음 두 번(쿵-쿵)이 한 세트, 세트 사이는 쉬어서 실제 심장박동처럼 들리게 한다.
        tone(startAt, 68, 0.16, 0.55, 'sine');
        tone(startAt + 0.22, 54, 0.2, 0.45, 'sine');
        return 0.9;
      }
      case 'clock': {
        // 똑딱 두 번(초침 두 칸)을 한 세트로, 1초마다 반복되게 한다.
        noiseBurst(startAt, 0.045, 0.5);
        noiseBurst(startAt + 0.5, 0.045, 0.42);
        return 1.0;
      }
      case 'applause': {
        // 짧은 노이즈 조각을 무작위 타이밍으로 잔뜩 겹쳐서 박수 소리의 질감을 흉내낸다.
        const hits = 40;
        const span = 1.6;
        for (let i = 0; i < hits; i++) {
          noiseBurst(startAt + Math.random() * span, 0.06, 0.22 + Math.random() * 0.16);
        }
        return span + 0.2;
      }
      case 'boom': {
        // 저음이 빠르게 뚝 떨어지는 사인파(쿵) + 노이즈(파편 소리)를 겹쳐 폭발음을 만든다.
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, startAt);
        osc.frequency.exponentialRampToValueAtTime(35, startAt + 0.5);
        g.gain.setValueAtTime(0.001, startAt);
        g.gain.linearRampToValueAtTime(0.9, startAt + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, startAt + 0.6);
        osc.connect(g).connect(c.destination);
        osc.start(startAt);
        osc.stop(startAt + 0.65);
        noiseBurst(startAt, 0.35, 0.6);
        noiseBurst(startAt + 0.05, 0.2, 0.3);
        return 0.7;
      }
      case 'tada': {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(startAt + i * 0.11, f, 0.4, 0.3, 'triangle'));
        return 0.11 * 3 + 0.4;
      }
      case 'countdown': {
        [440, 440, 440, 880].forEach((f, i) => tone(startAt + i * 0.6, f, 0.25, 0.3, 'square'));
        return 0.6 * 3 + 0.3;
      }
      case 'ding':
      default: {
        tone(startAt, 880, 0.5, 0.3, 'sine');
        tone(startAt + 0.05, 1318.5, 0.6, 0.2, 'sine');
        return 0.6;
      }
    }
  }

  function schedule(startAt: number) {
    const len = playOnce(startAt);
    if (opts.loop && !stopped) {
      timer = setTimeout(() => {
        if (!stopped) schedule(c.currentTime + 0.05);
      }, (len + 0.05) * 1000);
    }
  }

  schedule(c.currentTime + 0.02);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

/** 돌림판 CSS 회전 트랜지션과 같은 이징(SpinWheel.tsx 의 `cubic-bezier(0.17, 0.89, 0.24, 1)`). */
const WHEEL_SPIN_EASE = cubicBezier(0.17, 0.89, 0.24, 1);

function wheelTickClick(time: number, strength: number) {
  const c = ctx();
  const duration = 0.014;
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.setValueAtTime(0.16 + strength * 0.14, time);
  src.connect(g).connect(c.destination);
  src.start(time);
}

/** 손으로 돌림판을 직접 드래그할 때 실시간으로 한 번 울리는 딸깍음(스케줄이 아니라 그 즉시). */
export function playWheelTickOnce(strength = 0.6) {
  wheelTickClick(ctx().currentTime, strength);
}

/**
 * 돌림판이 실제로 도는 것처럼: 회전 각도가 일정 간격을 지날 때마다 짧은 클릭음을 하나씩
 * 울린다. 화면의 CSS 회전과 같은 이징 곡선을 그대로 샘플링해서 언제 각 클릭이 울려야
 * 하는지 계산하기 때문에, 처음엔 촘촘하게(빠르게 도는 구간) 울리다가 회전이 느려질수록
 * 클릭 간격도 자연스럽게 벌어진다 — 소리를 별도 타이머로 "점점 느리게" 흉내내는 게
 * 아니라, 실제 회전 속도를 그대로 오디오 스케줄에 반영하는 방식.
 * 되돌아오는 함수를 부르면 아직 안 울린 클릭을 전부 취소한다(도중에 다시 돌리기 등).
 */
export function playWheelSpinTicks(totalDegrees: number, durationMs: number): () => void {
  const TICK_DEG = 9; // 대략 40칸/바퀴 밀도 — 촘촘하지도 허전하지도 않은 정도로 조정함
  const SAMPLE_STEPS = 600;
  let stopped = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  let nextThreshold = TICK_DEG;
  for (let i = 1; i <= SAMPLE_STEPS && nextThreshold <= totalDegrees; i++) {
    const frac = i / SAMPLE_STEPS;
    const angle = WHEEL_SPIN_EASE(frac) * totalDegrees;
    while (nextThreshold <= angle && nextThreshold <= totalDegrees) {
      const atMs = frac * durationMs;
      const speedFrac = 1 - frac;
      timers.push(
        setTimeout(() => {
          if (!stopped) wheelTickClick(ctx().currentTime, speedFrac);
        }, atMs),
      );
      nextThreshold += TICK_DEG;
    }
  }

  return () => {
    stopped = true;
    timers.forEach(clearTimeout);
  };
}

/** 카드가 자리를 바꿀 때 한 번 울리는 "촤르르" 셔플음 — 짧은 노이즈 조각을 빠르게 이어서
 * 카드를 재빨리 섞는 손놀림 소리를 흉내낸다. 섞기 라운드마다 한 번씩 불러 쓴다. */
export function playShuffleSwish(): void {
  const c = ctx();
  const start = c.currentTime + 0.01;
  const hits = 10;
  const span = 0.32;
  for (let i = 0; i < hits; i++) {
    noiseBurst(start + (i * span) / hits, 0.05, 0.22 + Math.random() * 0.1);
  }
}

/** 결과 사운드를 한 번도 설정하지 않았을 때 쓰는 기본값. */
export const DEFAULT_RESULT_SOUND: MusicSelection = { kind: 'builtin', id: 'tada' };

/**
 * 저장된 결과 사운드 설정을 실제 재생값으로 바꾼다.
 * undefined(한 번도 설정 안 함) → 기본 "짜잔". null(선생님이 "없음"을 직접 고름) → 무음 유지.
 */
export function resolveResultSound(stored: MusicSelection | null | undefined): MusicSelection | null {
  return stored !== undefined ? stored : DEFAULT_RESULT_SOUND;
}

/**
 * 선택된 배경음악을 재생한다. 기본 제공 효과음이면 합성음을, 업로드 파일이면
 * <audio> 로 재생한다. 반환된 함수를 부르면 멈춘다. music 이 없으면 아무 일도 안 한다.
 */
export function playMusic(music: MusicSelection | null | undefined, opts: { loop?: boolean } = {}): () => void {
  if (!music) return () => {};
  if (music.kind === 'builtin') return playBuiltin(music.id, opts);

  const audio = new Audio(music.url);
  audio.loop = !!opts.loop;
  void audio.play().catch(() => {});
  return () => {
    audio.pause();
    audio.currentTime = 0;
  };
}
