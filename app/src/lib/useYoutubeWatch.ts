import { useCallback, useEffect, useRef, useState } from 'react';
import { loadYoutubeIframeApi, type YoutubePlayer } from './youtube';

/** 시청 기록을 서버에 알리는 간격(초) */
const TICK_SECONDS = 5;

/**
 * 유튜브 영상 하나를 처음부터 끝까지 보는 훅(2026-10-13, 유치원 영상 보기 숙제).
 * - 내 컨트롤만 쓰려고 유튜브 컨트롤은 끄고(controls 0), 영상이 끝났을 때(ENDED) onEnded 를 한 번 부른다.
 * - youtube-nocookie 주소로 불러 추적 쿠키를 줄인다. 광고는 유튜브가 영상·채널마다 정하므로 앱이 없앨 수 없다.
 * - 못 불러오면 failed.
 * - 실제로 본 구간(2026-10-30): 재생 중이고 시간이 자연스럽게 흘러간 초만 센다(건너뛰기·되감기는 세지 않는다).
 *   onTick(본 초, 영상 길이)를 재생 중 5초마다 부르고, replay() 로 같은 영상을 한 번 더 볼 때 새로 센다.
 */
export function useYoutubeWatch(
  videoId: string | null | undefined,
  onEnded: () => void,
  onTick?: (watchedSec: number, durationSec: number) => void,
) {
  const [elementId] = useState(() => `hw-watch-${crypto.randomUUID()}`);
  const playerRef = useRef<YoutubePlayer | null>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const tickRef = useRef(onTick);
  tickRef.current = onTick;
  const firedRef = useRef(false);
  const secondsRef = useRef(new Set<number>());
  const lastRef = useRef<{ t: number; at: number } | null>(null);
  const sinceTickRef = useRef(0);
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
              if (e.data !== YT.PlayerState.PLAYING) lastRef.current = null;
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

  // 진행 막대(0~1)와 본 초 세기 — 0.5초마다 읽는다
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      const d = p?.getDuration?.() ?? 0;
      if (!p || d <= 0) return;
      const now = p.getCurrentTime();
      setProgress(Math.min(1, now / d));
      if (p.getPlayerState?.() !== window.YT?.PlayerState.PLAYING) return;
      const at = performance.now();
      const last = lastRef.current;
      // 지난 확인 이후 영상이 앞으로, 흐른 시간보다 크게 건너뛰지 않고 갔을 때만 "자연스럽게 본 것"으로 센다
      // (버퍼링으로 덜 간 것은 괜찮고, 앞으로 건너뛰거나 뒤로 감은 구간은 세지 않는다)
      const dt = last ? (at - last.at) / 1000 : 0;
      const dp = last ? now - last.t : 0;
      if (last && dp >= 0 && dp <= dt + 1.5) {
        secondsRef.current.add(Math.floor(now));
        sinceTickRef.current += dt;
        if (sinceTickRef.current >= TICK_SECONDS) {
          sinceTickRef.current = 0;
          tickRef.current?.(secondsRef.current.size, d);
        }
      }
      lastRef.current = { t: now, at };
    }, 500);
    return () => window.clearInterval(id);
  }, [ready]);

  const play = useCallback(() => playerRef.current?.playVideo(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);
  /** 지금까지 본 초와 영상 길이(끝났을 때 마지막으로 알릴 때 쓴다) */
  const snapshot = useCallback(() => ({ watchedSec: secondsRef.current.size, durationSec: Math.round(playerRef.current?.getDuration?.() ?? 0) }), []);
  /** 같은 영상을 처음부터 한 번 더 — 본 초 세기를 새로 시작한다 */
  const replay = useCallback(() => {
    firedRef.current = false;
    secondsRef.current = new Set();
    lastRef.current = null;
    sinceTickRef.current = 0;
    setProgress(0);
    playerRef.current?.seekTo(0, true);
    playerRef.current?.playVideo();
  }, []);
  return { elementId, ready, failed, playing, progress, play, pause, snapshot, replay };
}
