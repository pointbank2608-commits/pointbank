import { useCallback, useEffect, useRef, useState } from 'react';
import { loadYoutubeIframeApi, type YoutubePlayer } from './youtube';

/**
 * 유튜브 영상의 한 구간(시작~끝)만 틀고 멈추는 훅(2026-10-05) — 쉐도잉 칠판(ShadowBoard)의 재생 방식
 * (seekTo → playVideo → 80ms 마다 끝 시간 확인 → pauseVideo)을 학생 숙제에서도 쓰려고 뺐다.
 * ShadowBoard 는 교실 발표에서 이미 쓰이고 있어 그대로 두었다.
 *
 * 영상을 못 불러오면(퍼가기 막힘·인터넷) `failed` 가 true — 부르는 쪽이 읽어 주기(TTS)로 대신한다.
 */
export function useYoutubeSegment(videoId: string | null | undefined) {
  const [elementId] = useState(() => `hw-yt-${crypto.randomUUID()}`);
  const playerRef = useRef<YoutubePlayer | null>(null);
  const pollRef = useRef<number | null>(null);
  const doneRef = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  const stopPoll = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => !cancelled && setFailed((f) => f || !playerRef.current), 12000);
    loadYoutubeIframeApi()
      .then(() => {
        if (cancelled || !window.YT) return;
        playerRef.current = new window.YT.Player(elementId, {
          videoId,
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, controls: 0, disablekb: 1, iv_load_policy: 3, fs: 0 },
          events: {
            onReady: () => setReady(true),
            onError: () => setFailed(true),
          },
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      stopPoll();
      playerRef.current?.destroy();
      playerRef.current = null;
      setReady(false);
    };
  }, [videoId, elementId, stopPoll]);

  useEffect(() => () => stopPoll(), [stopPoll]);

  /** start~end 초를 틀고 끝나면 멈춘다. 끝나면 resolve. */
  const playSegment = useCallback(
    (start: number, end: number, rate = 1) =>
      new Promise<void>((resolve) => {
        const p = playerRef.current;
        if (!p || !ready) {
          resolve();
          return;
        }
        stopPoll();
        doneRef.current?.();
        doneRef.current = resolve;
        p.setPlaybackRate(rate);
        p.seekTo(Math.max(0, start - 0.05), true);
        p.playVideo();
        setPlaying(true);
        pollRef.current = window.setInterval(() => {
          if (p.getCurrentTime() >= end - 0.05) {
            p.pauseVideo();
            stopPoll();
            setPlaying(false);
            const done = doneRef.current;
            doneRef.current = null;
            done?.();
          }
        }, 80);
      }),
    [ready, stopPoll],
  );

  const stop = useCallback(() => {
    playerRef.current?.pauseVideo();
    stopPoll();
    setPlaying(false);
    const done = doneRef.current;
    doneRef.current = null;
    done?.();
  }, [stopPoll]);

  return { elementId, ready, failed, playing, playSegment, stop };
}
