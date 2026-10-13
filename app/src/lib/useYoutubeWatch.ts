import { useCallback, useEffect, useRef, useState } from 'react';
import { loadYoutubeIframeApi, type YoutubePlayer } from './youtube';

/**
 * 유튜브 영상 하나를 처음부터 끝까지 보는 훅(2026-10-13, 유치원 영상 보기 숙제).
 * - 내 컨트롤만 쓰려고 유튜브 컨트롤은 끄고(controls 0), 영상이 끝났을 때(ENDED) onEnded 를 한 번 부른다.
 * - youtube-nocookie 주소로 불러 추적 쿠키를 줄인다. 광고는 유튜브가 영상·채널마다 정하므로 앱이 없앨 수 없다.
 * - 못 불러오면 failed.
 */
export function useYoutubeWatch(videoId: string | null | undefined, onEnded: () => void) {
  const [elementId] = useState(() => `hw-watch-${crypto.randomUUID()}`);
  const playerRef = useRef<YoutubePlayer | null>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const firedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    firedRef.current = false;
    const timeout = window.setTimeout(() => !cancelled && setFailed((f) => f || !playerRef.current), 12000);
    loadYoutubeIframeApi()
      .then(() => {
        if (cancelled || !window.YT) return;
        playerRef.current = new window.YT.Player(elementId, {
          videoId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, controls: 0, disablekb: 1, iv_load_policy: 3, fs: 0 },
          events: {
            onReady: () => setReady(true),
            onError: () => setFailed(true),
            onStateChange: (e: { data: number }) => {
              const YT = window.YT;
              if (!YT) return;
              setPlaying(e.data === YT.PlayerState.PLAYING);
              if (e.data === YT.PlayerState.ENDED && !firedRef.current) {
                firedRef.current = true;
                setProgress(1);
                endedRef.current();
              }
            },
          },
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      playerRef.current?.destroy();
      playerRef.current = null;
      setReady(false);
      setPlaying(false);
    };
  }, [videoId, elementId]);

  // 진행 막대(0~1) — 0.5초마다 읽는다
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      const d = p?.getDuration?.() ?? 0;
      if (p && d > 0) setProgress(Math.min(1, p.getCurrentTime() / d));
    }, 500);
    return () => window.clearInterval(id);
  }, [ready]);

  const play = useCallback(() => playerRef.current?.playVideo(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);
  return { elementId, ready, failed, playing, progress, play, pause };
}
