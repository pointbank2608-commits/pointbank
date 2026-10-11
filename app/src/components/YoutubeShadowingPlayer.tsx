import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { extractYoutubeId, loadYoutubeIframeApi, type YoutubePlayer } from '../lib/youtube';

interface Props {
  videoUrl: string;
  /** 발표 중: 주어진 칸을 꽉 채우되 영상이 잘리지 않게 16:9 로 맞추고, 구간 설정은 아래 한 줄로 */
  fit?: boolean;
  /** 처음 구간(초) */
  start?: number;
  end?: number;
}

const RATES = [0.75, 1, 1.25, 1.5];

/**
 * 유튜브 영상을 구간 반복+배속 조절로 재생하는 "쉐도잉" 플레이어. Class5의 "무비 보기"와
 * 같은 원리 — 영상을 새로 만들거나 라이선싱하지 않고, 이미 공개된 유튜브 영상을 IFrame
 * Player API로 embed 한 뒤 원하는 구간(startSeconds~endSeconds)만 반복 재생한다.
 */
export default function YoutubeShadowingPlayer({ videoUrl, fit = false, start, end }: Props) {
  const { t } = useTranslation();
  const [elementId] = useState(() => `yt-player-${crypto.randomUUID()}`);
  const playerRef = useRef<YoutubePlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [startSec, setStartSec] = useState(start ?? 0);
  const [endSec, setEndSec] = useState<number | ''>(end ?? '');
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(true);
  // 구간이 정해진 영상(영상 라이브러리 장면 등)은 처음부터 그 구간만 틀고, 유튜브 자체 진행 막대(영상 전체 길이) 대신
  // 구간 길이만큼의 진행 막대를 보여 준다(2026-10-11 "영상 전체가 나온다" 제보).
  const segmentMode = start !== undefined && end !== undefined && end > start;
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(start ?? 0);
  // onStateChange 는 플레이어 생성 시 한 번만 등록돼서 그 시점의 state를 그대로 가둔다(stale
  // closure) — 이후 시작(초)·반복 설정을 바꿔도 반영되도록 매 렌더마다 최신값을 ref에 적어둔다.
  const loopRef = useRef(loop);
  const startSecRef = useRef(startSec);
  loopRef.current = loop;
  startSecRef.current = startSec;
  const endSecRef = useRef<number | ''>(endSec);
  endSecRef.current = endSec;

  const videoId = extractYoutubeId(videoUrl);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    void loadYoutubeIframeApi().then(() => {
      if (cancelled || !window.YT) return;
      playerRef.current = new window.YT.Player(elementId, {
        videoId,
        playerVars: segmentMode ? { rel: 0, modestbranding: 1, playsinline: 1, controls: 0, disablekb: 1, fs: 0 } : { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            setReady(true);
            // 구간이 있으면 그 구간부터(처음 0초가 아니라) 바로 튼다
            if (segmentMode) {
              playerRef.current?.loadVideoById({ videoId, startSeconds: startSecRef.current, endSeconds: endSecRef.current === '' ? undefined : endSecRef.current });
            }
          },
          onStateChange: (e: { data: number }) => {
            setPlaying(e.data === 1);
            if (loopRef.current && window.YT && e.data === window.YT.PlayerState.ENDED) {
              playerRef.current?.seekTo(startSecRef.current, true);
              playerRef.current?.playVideo();
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId, elementId]);

  // 구간 진행 시간(150ms마다)
  useEffect(() => {
    if (!ready || !segmentMode) return;
    const timer = window.setInterval(() => {
      const t = playerRef.current?.getCurrentTime();
      if (typeof t === 'number') setNow(t);
    }, 150);
    return () => window.clearInterval(timer);
  }, [ready, segmentMode]);

  const segEnd = endSec === '' ? undefined : endSec;
  const segLen = segmentMode && segEnd !== undefined ? Math.max(1, segEnd - startSec) : 0;
  const segPos = Math.min(segLen, Math.max(0, now - startSec));
  const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

  function toggle() {
    const p = playerRef.current;
    if (!p) return;
    if (playing) {
      p.pauseVideo();
    } else {
      // 구간 끝까지 갔으면 처음부터
      if (segEnd !== undefined && now >= segEnd - 0.3) p.seekTo(startSec, true);
      p.playVideo();
    }
  }

  function playSegment() {
    const player = playerRef.current;
    if (!player) return;
    player.loadVideoById({
      videoId: videoId ?? '',
      startSeconds: startSec,
      endSeconds: endSec === '' ? undefined : endSec,
    });
    player.setPlaybackRate(rate);
  }

  if (!videoId) {
    return (
      <div className="rounded-xl bg-surface-container-low p-6 text-center font-body-md text-body-md text-on-surface-variant">
        {t('curriculum.player.invalidUrl')}
      </div>
    );
  }

  return (
    <div className={fit ? 'flex h-full flex-col gap-2' : 'space-y-3'}>
      {/* 발표 중에는 남는 칸 안에서 가로·세로 모두 넘치지 않는 가장 큰 16:9 로(2026-10-03 "영상이 잘린다" 제보) */}
      <div className={fit ? 'flex min-h-0 flex-1 items-center justify-center' : ''} style={fit ? { containerType: 'size' } : undefined}>
        <div
          className="relative overflow-hidden rounded-xl bg-black"
          style={fit ? { aspectRatio: '16 / 9', width: 'min(100cqw, calc(100cqh * 16 / 9))' } : { aspectRatio: '16 / 9', width: '100%' }}
        >
          <div id={elementId} className="absolute inset-0 h-full w-full" />
        </div>
      </div>

      {segmentMode && segLen > 0 && (
        <div className={`flex items-center gap-3 rounded-xl bg-surface-container-lowest px-3 py-2 ${fit ? 'shrink-0' : ''}`}>
          <button
            type="button"
            onClick={toggle}
            disabled={!ready}
            aria-label={playing ? t('curriculum.player.pause') : t('curriculum.player.play')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-50"
          >
            <span className="material-symbols-outlined">{playing ? 'pause' : 'play_arrow'}</span>
          </button>
          <input
            type="range"
            min={0}
            max={segLen}
            step={0.1}
            value={segPos}
            onChange={(e) => {
              const v = Number(e.target.value);
              setNow(startSec + v);
              playerRef.current?.seekTo(startSec + v, true);
            }}
            aria-label={t('curriculum.player.seek')}
            className="min-w-0 flex-1 accent-primary"
          />
          <span className="shrink-0 font-caption text-caption tabular-nums text-on-surface-variant">
            {fmt(segPos)} / {fmt(segLen)}
          </span>
        </div>
      )}

      <div className={`flex flex-wrap items-end rounded-xl bg-surface-container-lowest shadow-[0_4px_20px_rgba(39,101,168,0.08)] ${fit ? 'shrink-0 gap-3 px-3 py-2' : 'gap-4 p-4'}`}>
        <div>
          <label className="mb-1 block font-caption text-caption text-on-surface-variant">
            {t('curriculum.player.startSec')}
          </label>
          <input
            type="number"
            min={0}
            value={startSec}
            onChange={(e) => setStartSec(Math.max(0, Number(e.target.value) || 0))}
            className="w-24 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-1.5 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block font-caption text-caption text-on-surface-variant">
            {t('curriculum.player.endSec')}
          </label>
          <input
            type="number"
            min={0}
            value={endSec}
            placeholder={t('curriculum.player.endSecPlaceholder') ?? ''}
            onChange={(e) => setEndSec(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0))}
            className="w-24 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-1.5 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block font-caption text-caption text-on-surface-variant">
            {t('curriculum.player.rate')}
          </label>
          <select
            value={rate}
            onChange={(e) => {
              const next = Number(e.target.value);
              setRate(next);
              playerRef.current?.setPlaybackRate(next);
            }}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-1.5 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}x
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-1.5 font-label-md text-label-md text-on-surface-variant">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
            className="h-4 w-4 rounded accent-primary"
          />
          {t('curriculum.player.loop')}
        </label>
        <button
          type="button"
          disabled={!ready}
          onClick={playSegment}
          className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-50"
        >
          {t('curriculum.player.playSegment')}
        </button>
      </div>
    </div>
  );
}
