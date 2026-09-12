import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { extractYoutubeId, loadYoutubeIframeApi, type YoutubePlayer } from '../lib/youtube';

interface Props {
  videoUrl: string;
}

const RATES = [0.75, 1, 1.25, 1.5];

/**
 * 유튜브 영상을 구간 반복+배속 조절로 재생하는 "쉐도잉" 플레이어. Class5의 "무비 보기"와
 * 같은 원리 — 영상을 새로 만들거나 라이선싱하지 않고, 이미 공개된 유튜브 영상을 IFrame
 * Player API로 embed 한 뒤 원하는 구간(startSeconds~endSeconds)만 반복 재생한다.
 */
export default function YoutubeShadowingPlayer({ videoUrl }: Props) {
  const { t } = useTranslation();
  const [elementId] = useState(() => `yt-player-${crypto.randomUUID()}`);
  const playerRef = useRef<YoutubePlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState<number | ''>('');
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(true);
  // onStateChange 는 플레이어 생성 시 한 번만 등록돼서 그 시점의 state를 그대로 가둔다(stale
  // closure) — 이후 시작(초)·반복 설정을 바꿔도 반영되도록 매 렌더마다 최신값을 ref에 적어둔다.
  const loopRef = useRef(loop);
  const startSecRef = useRef(startSec);
  loopRef.current = loop;
  startSecRef.current = startSec;

  const videoId = extractYoutubeId(videoUrl);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    void loadYoutubeIframeApi().then(() => {
      if (cancelled || !window.YT) return;
      playerRef.current = new window.YT.Player(elementId, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => setReady(true),
          onStateChange: (e: { data: number }) => {
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
    <div className="space-y-3">
      <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16 / 9' }}>
        <div id={elementId} className="absolute inset-0 h-full w-full" />
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl bg-surface-container-lowest p-4 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
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
