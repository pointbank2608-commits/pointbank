import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playMusic, playWheelSpinTicks } from '../lib/gameMusic';
import { colorFor, computeSpinRotation, fontSizeFor, pickRandomIndex, shortenLabel } from '../lib/wheel';
import type { GameItem, MusicSelection } from '../lib/types';

interface Props {
  items: GameItem[];
  music?: MusicSelection | null;
  resultSound?: MusicSelection | null;
  /** 항목 하나를 선택할 때마다 화면 밖으로 알려준다 (최근 결과 기록 등에 사용). */
  onResult?: (item: GameItem) => void;
}

const SIZE = 420;
const CX = SIZE / 2;
const CY = SIZE / 2;
/** 스킨 구멍 안쪽. 테두리 이미지가 위에 덮이므로 회전 계산과 무관하다. */
const R = 164;
const DEFAULT_SPIN_MS = 4600;
const MIN_SPIN_MS = 2000;
const MAX_SPIN_MS = 20000;

const RIM_SRC = '/skins/wheel-rim.png';
const HUB_SRC = '/skins/wheel-hub-spin.png';
const POINTER_SRC = '/skins/wheel-pointer.png';

/** 화면 12시를 0도, 시계 방향으로 도는 각도 A 에서의 좌표. */
function pointOnCircle(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.sin(rad), y: CY - radius * Math.cos(rad) };
}

export default function SpinWheel({ items, music, resultSound, onResult }: Props) {
  const { t } = useTranslation();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<GameItem | null>(null);
  const [spinMs, setSpinMs] = useState(DEFAULT_SPIN_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopMusicRef = useRef<() => void>(() => {});
  /** 업로드한 회전음의 실제 길이(초). 한 번 읽어두면 재사용 — url별로 캐싱. */
  const uploadDurationsRef = useRef<Record<string, number>>({});

  // 선생님이 회전음으로 파일을 업로드해뒀으면, 실제로 돌리기 전에 미리 길이를 읽어둔다
  // (스핀 시작 시점엔 즉시 값이 필요해서 미리 로드해두는 것 — 매번 새로 읽지 않도록 캐싱).
  useEffect(() => {
    if (!music || music.kind !== 'upload') return;
    const url = music.url;
    if (url in uploadDurationsRef.current) return;
    const probe = new Audio(url);
    const onLoaded = () => {
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        uploadDurationsRef.current[url] = probe.duration;
      }
    };
    probe.addEventListener('loadedmetadata', onLoaded);
    return () => probe.removeEventListener('loadedmetadata', onLoaded);
  }, [music]);

  const count = items.length;
  const slice = count > 0 ? 360 / count : 0;
  const fontSize = fontSizeFor(count);

  const slices = useMemo(() => {
    return items.map((item, i) => {
      const a0 = i * slice;
      const a1 = (i + 1) * slice;
      const p0 = pointOnCircle(a0, R);
      const p1 = pointOnCircle(a1, R);
      const largeArc = a1 - a0 > 180 ? 1 : 0;
      const path = `M ${CX} ${CY} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`;
      const mid = a0 + slice / 2;
      return { id: item.id, path, mid, color: colorFor(i), label: shortenLabel(item.label, slice) };
    });
  }, [items, slice]);

  function spin() {
    if (spinning || count === 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    stopMusicRef.current();

    setResult(null);
    setSpinning(true);
    const targetIndex = pickRandomIndex(count);
    const next = computeSpinRotation({ targetIndex, itemCount: count, currentRotation: rotation });

    // 업로드한 회전음이 있으면 그 소리 길이에 맞춰 회전 시간을 늘리거나 줄인다 —
    // 실제 녹음된 소리(예: 진짜 룰렛 소리)는 이미 그 안에 감속하는 리듬이 들어있어서,
    // 회전 애니메이션 길이를 소리 길이에 맞춰야 서로 안 어긋난다.
    const uploadUrl = music?.kind === 'upload' ? music.url : null;
    const uploadDuration = uploadUrl ? uploadDurationsRef.current[uploadUrl] : undefined;
    const nextSpinMs = uploadDuration
      ? Math.min(MAX_SPIN_MS, Math.max(MIN_SPIN_MS, Math.round(uploadDuration * 1000)))
      : DEFAULT_SPIN_MS;
    setSpinMs(nextSpinMs);
    setRotation(next);

    if (!music) {
      // 아무 회전음도 안 골랐으면 무음 대신, 실제 회전 속도(화면과 같은 이징 곡선)에
      // 맞춰 딸깍거리는 소리를 기본으로 재생한다 — 진짜 돌림판처럼 처음엔 빠르게,
      // 느려지면 소리도 같이 느려진다.
      stopMusicRef.current = playWheelSpinTicks(next - rotation, nextSpinMs);
    } else {
      // 업로드한 파일은 그 자체가 이미 감속하는 소리라 한 번만 재생하고, 기본 제공
      // 합성음(두구두구 등)은 기존처럼 반복 재생한다.
      stopMusicRef.current = playMusic(music, { loop: music.kind !== 'upload' });
    }

    timerRef.current = setTimeout(() => {
      setSpinning(false);
      const picked = items[targetIndex];
      setResult(picked);
      onResult?.(picked);
      stopMusicRef.current();
      playMusic(resultSound);
    }, nextSpinMs);
  }

  if (count === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🎡</div>
        <div className="font-body-md text-body-md">{t('gameWheel.noItemsCard')}</div>
      </div>
    );
  }

  const spinStyle = {
    transform: `rotate(${rotation}deg)`,
    transition: spinning ? `transform ${spinMs}ms cubic-bezier(0.17, 0.89, 0.24, 1)` : 'none',
  };

  return (
    <div className="flex flex-col items-center py-4 pb-2">
      <div className="relative w-full max-w-[420px] aspect-square">
        <div
          className="absolute inset-0"
          style={{ ...spinStyle, filter: 'drop-shadow(0 14px 24px rgba(110, 62, 18, 0.28))' }}
        >
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 h-full w-full">
            {slices.map((s) => (
              <path key={s.id} d={s.path} fill={s.color} stroke="#fff8ea" strokeWidth={3} />
            ))}
            {slices.map((s) => (
              <text
                key={s.id + '-label'}
                x={CX}
                y={CY - R * 0.58}
                transform={`rotate(${s.mid} ${CX} ${CY})`}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-white font-title-md font-bold"
                style={{
                  fontSize,
                  paintOrder: 'stroke',
                  stroke: 'rgba(21,28,34,0.35)',
                  strokeWidth: 3,
                }}
              >
                {s.label}
              </text>
            ))}
          </svg>
          <img src={RIM_SRC} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none" />
        </div>

        <img
          src={POINTER_SRC}
          alt=""
          draggable={false}
          className="pointer-events-none absolute left-1/2 z-20 w-12 -translate-x-1/2 select-none"
          style={{ top: -14, filter: 'drop-shadow(0 3px 3px rgba(90,50,10,0.3))' }}
        />

        <button
          onClick={spin}
          disabled={spinning}
          aria-label={t('gameWheel.spinAriaLabel')}
          title={t('gameWheel.spinButton')}
          className="absolute top-1/2 left-1/2 z-10 h-[93px] w-[93px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent p-0 disabled:cursor-default disabled:opacity-75 hover:not-disabled:brightness-105 active:not-disabled:brightness-95 transition-[filter]"
          style={{ filter: 'drop-shadow(0 4px 7px rgba(90, 40, 10, 0.28))' }}
        >
          <img src={HUB_SRC} alt="" draggable={false} className="pointer-events-none h-full w-full select-none object-contain" />
        </button>
      </div>

      <button
        onClick={spin}
        disabled={spinning}
        className="mt-5 px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container disabled:opacity-60 text-on-secondary font-title-md text-title-md shadow-sm transition-colors"
      >
        {spinning ? t('gameWheel.spinning') : t('gameWheel.spinButton')}
      </button>

      {result && !spinning && (
        <div
          key={result.id + result.label}
          className="mt-4 text-center bg-secondary-container/50 border border-secondary-container rounded-2xl px-8 py-3.5"
        >
          <div className="font-caption text-caption font-bold tracking-wider text-secondary uppercase">{t('gameWheel.winnerLabel')}</div>
          <div className="font-display-lg text-[28px] text-deep-navy mt-0.5">{result.label}</div>
        </div>
      )}
    </div>
  );
}
