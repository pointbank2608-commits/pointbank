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
