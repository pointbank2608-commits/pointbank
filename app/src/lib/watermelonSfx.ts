type MelonSfx = 'drop' | 'merge' | 'agree' | 'pop' | 'over';

const URLS: Record<MelonSfx, string> = {
  drop: '/sounds/watermelon-drop.wav?v=2',
  merge: '/sounds/watermelon-merge.wav?v=2',
  agree: '/sounds/watermelon-agree.wav?v=2',
  pop: '/sounds/watermelon-pop.wav?v=2',
  over: '/sounds/watermelon-over.wav?v=2',
};

const VOLUME: Record<MelonSfx, number> = {
  drop: 0.62,
  merge: 0.7,
  agree: 0.64,
  pop: 0.74,
  over: 0.7,
};

const pools = new Map<string, HTMLAudioElement[]>();

function take(url: string): HTMLAudioElement {
  const pool = pools.get(url) ?? [];
  const free = pool.find((a) => a.paused || a.ended);
  if (free) return free;
  const audio = new Audio(url);
  audio.preload = 'auto';
  pool.push(audio);
  pools.set(url, pool);
  return audio;
}

/** 첫 낙하가 늦게 들리지 않게, 통이 보이는 시점에 미리 받아 둔다. */
export function preloadWatermelonSfx(): void {
  (Object.values(URLS) as string[]).forEach((url) => take(url));
}

export function playWatermelonSfx(name: MelonSfx): void {
  const audio = take(URLS[name]);
  audio.volume = VOLUME[name];
  audio.playbackRate = name === 'agree' || name === 'over' ? 1 : 0.96 + Math.random() * 0.08;
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}
