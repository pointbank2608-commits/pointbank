import { useTranslation } from 'react-i18next';
import { useEffect, useId, useRef, useState } from 'react';
import { loadYoutubeIframeApi, type YoutubePlayer } from '../lib/youtube';

/**
 * Plays the requested segment above the current lesson page.
 * Q&A 슬라이드·단어 소개(영상 묶음 단어)가 같이 쓴다. 부모는 position: relative.
 */
export default function SceneOverlay({ videoId, time, endTime, compact = false, onClose }: { videoId: string; time: number; endTime?: number | null; compact?: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const close = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    let live = true;
    let player: YoutubePlayer | undefined;
    const end = endTime === null ? null : endTime !== undefined && endTime > time ? endTime : time + 8;
    const timeout = window.setTimeout(() => live && setError('PLAYBACK_TIMEOUT'), 15000);
    setError('');
    void loadYoutubeIframeApi().then(() => {
      if (!live || !window.YT) return;
      player = new window.YT.Player(id, {
        videoId,
        playerVars: { start: Math.floor(time), ...(end === null ? {} : {end: Math.ceil(end)}), controls: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: () => { if (live) { player?.seekTo(time, true); player?.playVideo(); } },
          onStateChange: ({ data }: { data: number }) => { if (data === 1) clearTimeout(timeout); },
          onError: ({ data }: { data: number }) => { clearTimeout(timeout); if (live) setError(String(data)); },
        },
      });
    });
    const poll = window.setInterval(() => {
      if (end !== null && player?.getPlayerState?.() === 1 && player.getCurrentTime() >= end) player.pauseVideo();
    }, 50);
    return () => {
      live = false;
      clearTimeout(timeout);
      clearInterval(poll);
      player?.pauseVideo();
      player?.destroy();
    };
  }, [videoId, time, endTime, id]);
  return (
    <div
      role="dialog"
      aria-label={t('qna.scene')}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}
      className={compact ? 'absolute bottom-[10cqh] left-[3cqh] z-20 w-[42%] min-w-[140px]' : 'absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-[4cqh]'}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className={`relative aspect-video overflow-hidden rounded-lg bg-black shadow-xl [&_iframe]:h-full [&_iframe]:w-full ${compact ? 'w-full' : 'h-full max-h-full max-w-full'}`} onClick={(e) => e.stopPropagation()}>
        <div key={`${videoId}:${time}:${endTime}`} className="absolute inset-0"><div id={id} /></div>
        {error && <p role="alert" className="absolute inset-0 grid place-items-center p-3 text-center text-white">{t('mediaV2.error',{code:error})}</p>}
        <button
          type="button"
          ref={close}
          onClick={onClose}
          aria-label={t('common.close')}
          className="absolute right-2 top-2 flex min-h-10 min-w-10 items-center justify-center rounded-full bg-white text-deep-navy shadow-lg"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '4cqh' }}>
            close
          </span>
        </button>
      </div>
    </div>
  );
}
