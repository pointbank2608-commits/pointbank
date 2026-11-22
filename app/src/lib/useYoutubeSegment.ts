import { useCallback, useEffect, useRef, useState } from 'react';
import { loadYoutubeIframeApi, type YoutubePlayer } from './youtube';

/**
 * 유튜브 영상의 한 구간(시작~끝)만 틀고 멈추는 훅(2026-10-05) — 쉐도잉 칠판(ShadowBoard)의 재생 방식
 * 원본의 시작·끝을 YouTube에도 전달하고, 별도 시간 확인으로 완료 상태를 갱신한다.
 * ShadowBoard 는 교실 발표에서 이미 쓰이고 있어 그대로 두었다.
 *
 * 영상을 못 불러오면(퍼가기 막힘·인터넷) `failed` 가 true — 부르는 쪽이 읽어 주기(TTS)로 대신한다.
 */
export function useYoutubeSegment(videoId: string | null | undefined, initialStart?: number, bounded = false) {
  const [elementId] = useState(() => `hw-yt-${crypto.randomUUID()}`);
  const playerRef = useRef<YoutubePlayer | null>(null);
  const pollRef = useRef<number | null>(null);
  const doneRef = useRef<((completed: boolean) => void) | null>(null);
  const requestedRate = useRef(1);
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
    const timeout = window.setTimeout(() => {
      if (!cancelled) setFailed(true);
    }, 12000);
    loadYoutubeIframeApi()
      .then(() => {
        if (cancelled || !window.YT) return;
        playerRef.current = new window.YT.Player(elementId, {
          videoId,
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, controls: initialStart === undefined || bounded ? 0 : 1, disablekb: initialStart === undefined || bounded ? 1 : 0, iv_load_policy: 3, fs: 0,
            ...(initialStart !== undefined && { start: Math.floor(initialStart), origin: window.location.origin }) },
          events: {
            onReady: () => {
              if (cancelled) return;
              window.clearTimeout(timeout);
              setFailed(false);
              setReady(true);
            },
            onStateChange: (event: {data:number}) => {
              // Loading a segment can reset the player's speed. Restore it after playback starts.
              if(!cancelled&&event.data===1)playerRef.current?.setPlaybackRate(requestedRate.current);
            },
            onError: () => {
              if (cancelled) return;
              window.clearTimeout(timeout);
              setFailed(true);
              stopPoll();
              setPlaying(false);
              doneRef.current?.(false);
              doneRef.current = null;
            },
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        setFailed(true);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      stopPoll();
      doneRef.current?.(false);
      doneRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
      setReady(false);
      setPlaying(false);
      setFailed(false);
    };
  }, [videoId, elementId, initialStart, bounded, stopPoll]);

  useEffect(() => () => stopPoll(), [stopPoll]);

  /** start~end 초를 틀고 끝나면 멈춘다. 끝나면 resolve. */
  const playSegment = useCallback(
    (start: number, end: number, rate = 1, onTime?: (seconds: number) => void) =>
      new Promise<boolean>((resolve) => {
        const p = playerRef.current;
        if (!p || !ready) {
          resolve(false);
          return;
        }
        stopPoll();
        doneRef.current?.(false);
        doneRef.current = resolve;
        requestedRate.current=rate;
        p.setPlaybackRate(rate);
        if (videoId) {
          // Native bounds also protect shadowing/hints while a background tab throttles JS polling.
          // Reapply on every replay: seekTo alone clears endSeconds.
          p.loadVideoById({ videoId, startSeconds: start, endSeconds: end });
        } else {
          p.seekTo(Math.max(0, start), true);
          p.playVideo();
        }
        setPlaying(true);
        let reached = false;
        let movedAt = performance.now();
        let previous = -1;
        pollRef.current = window.setInterval(() => {
          const time = p.getCurrentTime();
          if (onTime && p.getPlayerState?.() === 1 && time >= start - 0.15 && time < end && time !== previous) {
            reached = true;
            previous = time;
            movedAt = performance.now();
          }
          const duration = p.getDuration?.();
          const atSourceEnd = p.getPlayerState?.() === 0 && !!duration && end >= duration - 0.15 && time >= duration - 0.3;
          const atSegmentEnd = p.getPlayerState?.() === 0 && time >= end - 0.15;
          const complete = onTime ? reached && (time >= end || atSourceEnd || atSegmentEnd) : time >= end - 0.05 || atSegmentEnd;
          if (onTime && reached) onTime(time);
          if (complete || (onTime && performance.now() - movedAt > 10000)) {
            p.pauseVideo();
            stopPoll();
            setPlaying(false);
            const done = doneRef.current;
            doneRef.current = null;
            done?.(complete);
          }
        }, onTime ? 25 : 80);
      }),
    [ready, stopPoll, videoId],
  );

  const stop = useCallback(() => {
    if (ready) playerRef.current?.pauseVideo();
    stopPoll();
    setPlaying(false);
    const done = doneRef.current;
    doneRef.current = null;
    done?.(false);
  }, [ready, stopPoll]);

  return { elementId, ready, failed, playing, playSegment, stop };
}
