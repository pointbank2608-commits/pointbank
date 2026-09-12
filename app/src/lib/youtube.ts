/** 유튜브 URL(watch/youtu.be/embed 어떤 형태든)에서 11자리 영상 ID만 뽑아낸다. 못 찾으면 null. */
export function extractYoutubeId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  // 이미 순수 11자리 ID만 붙여넣은 경우
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string, options: Record<string, unknown>) => YoutubePlayer;
      PlayerState: { ENDED: number; PLAYING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** window.YT.Player 인스턴스가 실제로 쓰는 메서드만 최소로 타입 선언 — 전체 SDK 타입을 끌어오지 않는다. */
export interface YoutubePlayer {
  loadVideoById: (opts: { videoId: string; startSeconds?: number; endSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  destroy: () => void;
}

let apiPromise: Promise<void> | null = null;

/** 유튜브 IFrame Player API 스크립트를 한 번만 로드한다(여러 컴포넌트가 동시에 불러도 안전). */
export function loadYoutubeIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve();
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  });
  return apiPromise;
}
