import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playMusic, playWheelSpinTicks, playWheelTickOnce } from '../lib/gameMusic';
import { colorFor, computeSpinRotation, fontSizeFor, pickRandomIndex, shortenLabel } from '../lib/wheel';
import type { GameItem, MusicSelection } from '../lib/types';

interface Props {
  items: GameItem[];
  music?: MusicSelection | null;
  resultSound?: MusicSelection | null;
  /** 항목 하나를 선택할 때마다 화면 밖으로 알려준다 (최근 결과 기록 등에 사용). */
  onResult?: (item: GameItem) => void;
  /** true면 오른쪽에 항목 개수 조절 + 이름 수정 목록 패널을 보여준다(선생님용 실제 플레이 화면에서만). */
  editable?: boolean;
  onEditItem?: (id: string, label: string) => void;
  /** 상단 이름 표시/수정 + 항목 개수 +/- 툴바. GameThemeFrame 안(전체화면 포함)에서도
   * 보이도록 SpinWheel 자체에 둔다 — WheelPage 바깥에 두면 전체화면에서 안 보였다. */
  templateName?: string;
  onRenameTemplate?: (name: string) => void;
  onAddItem?: () => void;
  onRemoveItem?: () => void;
}

const SIZE = 420;
const CX = SIZE / 2;
const CY = SIZE / 2;
/** 스킨 구멍 안쪽. 테두리 이미지가 위에 덮이므로 회전 계산과 무관하다. */
const R = 164;
const DEFAULT_SPIN_MS = 4600;
const MIN_SPIN_MS = 2000;
const MAX_SPIN_MS = 20000;

/** 손으로 돌리는 실감 물리값. 실제 마찰처럼 일정한 감속(가속도)로 멈춘다 —
 * 세게 돌릴수록(초기 속도가 클수록) 멈추기까지 오래·많이 돈다. */
const DRAG_TICK_DEG = 9;
const DECEL_DEG_PER_S2 = 260;
const MIN_RELEASE_VELOCITY = 40;
const MIN_MOMENTUM_VELOCITY = 6;
const DRAG_MOVE_THRESHOLD = 0.6;

const RIM_SRC = '/skins/wheel-rim.png';
const HUB_SRC = '/skins/wheel-hub-wood.png';
const POINTER_SRC = '/skins/wheel-pointer.png';

/** 화면 12시를 0도, 시계 방향으로 도는 각도 A 에서의 좌표. */
function pointOnCircle(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.sin(rad), y: CY - radius * Math.cos(rad) };
}

export default function SpinWheel({
  items,
  music,
  resultSound,
  onResult,
  editable,
  onEditItem,
  templateName,
  onRenameTemplate,
  onAddItem,
  onRemoveItem,
}: Props) {
  const { t } = useTranslation();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [useCssTransition, setUseCssTransition] = useState(false);
  const [result, setResult] = useState<GameItem | null>(null);
  const [spinMs, setSpinMs] = useState(DEFAULT_SPIN_MS);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopMusicRef = useRef<() => void>(() => {});
  /** 업로드한 회전음의 실제 길이(초). 한 번 읽어두면 재사용 — url별로 캐싱. */
  const uploadDurationsRef = useRef<Record<string, number>>({});

  /* ---------------- 손으로 직접 돌리기(드래그+관성) ---------------- */
  const wheelBoxRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);
  const draggingRef = useRef(false);
  const didDragRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const lastAngleRef = useRef(0);
  const velocitySamplesRef = useRef<{ t: number; angle: number }[]>([]);
  const momentumRafRef = useRef<number | null>(null);
  const tickAccumRef = useRef(0);

  useEffect(() => () => {
    if (momentumRafRef.current !== null) cancelAnimationFrame(momentumRafRef.current);
  }, []);

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

  // 오른쪽 목록 입력창의 초안 텍스트를 실제 항목과 맞춰둔다 — 타이핑 중엔 이 draft를
  // 보여주다가(반응성), blur/Enter 시점에 onEditItem으로 실제 반영한다.
  useEffect(() => {
    setItemDrafts(Object.fromEntries(items.map((i) => [i.id, i.label])));
  }, [items]);

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

  function handleItemDraftChange(id: string, value: string) {
    setItemDrafts((prev) => ({ ...prev, [id]: value }));
  }

  function commitItemDraft(id: string) {
    const value = (itemDrafts[id] ?? '').trim();
    if (value) onEditItem?.(id, value);
  }

  function startEditTemplateName() {
    setTemplateNameDraft(templateName ?? '');
    setEditingTemplateName(true);
  }

  function commitTemplateNameEdit() {
    const trimmed = templateNameDraft.trim();
    setEditingTemplateName(false);
    if (trimmed && trimmed !== templateName) onRenameTemplate?.(trimmed);
  }

  /** 12시를 0도, 시계 방향 증가로 재는 각도계 — pointOnCircle/computeSpinRotation과 동일. */
  function angleFromPoint(clientX: number, clientY: number): number {
    const box = wheelBoxRef.current;
    if (!box) return 0;
    const rect = box.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    return (Math.atan2(dx, -dy) * 180) / Math.PI;
  }

  function emitTicksForDelta(delta: number) {
    tickAccumRef.current += Math.abs(delta);
    while (tickAccumRef.current >= DRAG_TICK_DEG) {
      tickAccumRef.current -= DRAG_TICK_DEG;
      playWheelTickOnce();
    }
  }

  function stopMomentum() {
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
  }

  function resolveLandedItem(): GameItem {
    const theta = ((-rotationRef.current % 360) + 360) % 360;
    const idx = Math.min(count - 1, Math.floor(theta / slice));
    return items[idx];
  }

  function finalizeSpin() {
    setSpinning(false);
    const picked = resolveLandedItem();
    setResult(picked);
    onResult?.(picked);
    playMusic(resultSound);
  }

  function startMomentum(v0: number) {
    const sign = v0 >= 0 ? 1 : -1;
    let speed = Math.abs(v0);
    let last = performance.now();
    function step(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      speed = Math.max(0, speed - DECEL_DEG_PER_S2 * dt);
      const delta = speed * sign * dt;
      rotationRef.current += delta;
      setRotation(rotationRef.current);
      emitTicksForDelta(delta);
      if (speed <= MIN_MOMENTUM_VELOCITY) {
        momentumRafRef.current = null;
        finalizeSpin();
        return;
      }
      momentumRafRef.current = requestAnimationFrame(step);
    }
    momentumRafRef.current = requestAnimationFrame(step);
  }

  function handleWheelPointerDown(e: React.PointerEvent) {
    if (spinning || count === 0) return;
    stopMomentum();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 일부 환경(합성 이벤트 등)에서 캡처가 안 될 수 있어도 드래그 자체는 계속 진행한다.
    }
    activePointerIdRef.current = e.pointerId;
    draggingRef.current = true;
    didDragRef.current = false;
    lastAngleRef.current = angleFromPoint(e.clientX, e.clientY);
    velocitySamplesRef.current = [{ t: performance.now(), angle: rotationRef.current }];
    tickAccumRef.current = 0;
    setResult(null);
    setUseCssTransition(false);
    setSpinning(true);
  }

  function handleWheelPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current || e.pointerId !== activePointerIdRef.current) return;
    const angle = angleFromPoint(e.clientX, e.clientY);
    let delta = angle - lastAngleRef.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    if (Math.abs(delta) > DRAG_MOVE_THRESHOLD) didDragRef.current = true;
    lastAngleRef.current = angle;
    rotationRef.current += delta;
    setRotation(rotationRef.current);
    emitTicksForDelta(delta);
    const now = performance.now();
    const samples = velocitySamplesRef.current;
    samples.push({ t: now, angle: rotationRef.current });
    while (samples.length > 2 && now - samples[0].t > 120) samples.shift();
  }

  function endDrag(pointerId: number) {
    if (!draggingRef.current || pointerId !== activePointerIdRef.current) return;
    draggingRef.current = false;
    const samples = velocitySamplesRef.current;
    let v0 = 0;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = (last.t - first.t) / 1000;
      if (dt > 0.005) v0 = (last.angle - first.angle) / dt;
    }
    if (Math.abs(v0) > MIN_RELEASE_VELOCITY) {
      startMomentum(v0);
    } else if (didDragRef.current) {
      finalizeSpin();
    } else {
      setSpinning(false);
    }
  }

  function handleWheelPointerUp(e: React.PointerEvent) {
    endDrag(e.pointerId);
  }

  function handleWheelPointerCancel(e: React.PointerEvent) {
    if (e.pointerId !== activePointerIdRef.current) return;
    draggingRef.current = false;
    stopMomentum();
    setSpinning(false);
  }

  function spin() {
    if (spinning || count === 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    stopMomentum();
    stopMusicRef.current();

    setResult(null);
    setSpinning(true);
    setUseCssTransition(true);
    const targetIndex = pickRandomIndex(count);
    const next = computeSpinRotation({ targetIndex, itemCount: count, currentRotation: rotation });
    rotationRef.current = next;

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
      setUseCssTransition(false);
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
    transition: useCssTransition ? `transform ${spinMs}ms cubic-bezier(0.17, 0.89, 0.24, 1)` : 'none',
  };

  return (
    <div className="flex w-full flex-col items-center py-4 pb-2">
      <div
        className={`flex flex-col items-center gap-6 ${editable ? 'md:flex-row md:items-start md:justify-center' : ''}`}
      >
        <div className="flex flex-col items-center">
          {editable &&
            (editingTemplateName ? (
              <input
                autoFocus
                value={templateNameDraft}
                onChange={(e) => setTemplateNameDraft(e.target.value)}
                onBlur={commitTemplateNameEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTemplateNameEdit();
                  if (e.key === 'Escape') setEditingTemplateName(false);
                }}
                className="mb-2 w-full max-w-[420px] font-headline-lg-mobile text-headline-lg-mobile text-deep-navy bg-surface-container-lowest border border-primary rounded-lg px-2 outline-none text-center"
              />
            ) : (
              <button
                type="button"
                onClick={startEditTemplateName}
                title={t('gameAdmin.renameInlineHint')}
                className="mb-2 max-w-[420px] truncate font-headline-lg-mobile text-headline-lg-mobile text-deep-navy hover:bg-surface-container-lowest rounded-lg px-2 transition-colors"
              >
                {templateName}
              </button>
            ))}
          {editable && (
            <div className="mb-3 max-w-[420px] text-center font-caption text-caption text-on-surface-variant">
              {t('gameWheel.editHint')}
            </div>
          )}
          <div
            ref={wheelBoxRef}
            className="relative w-full max-w-[560px] aspect-square touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={handleWheelPointerDown}
            onPointerMove={handleWheelPointerMove}
            onPointerUp={handleWheelPointerUp}
            onPointerCancel={handleWheelPointerCancel}
          >
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

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                spin();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={spinning}
              aria-label={t('gameWheel.spinAriaLabel')}
              title={t('gameWheel.spinButton')}
              className="absolute left-1/2 top-1/2 z-10 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent p-0 transition-[filter] hover:enabled:brightness-105 active:enabled:brightness-95 disabled:cursor-default disabled:opacity-70"
            >
              <img
                src={HUB_SRC}
                alt=""
                draggable={false}
                className="pointer-events-none block w-full select-none"
                style={{ filter: 'drop-shadow(0 4px 6px rgba(90,50,10,0.28))' }}
              />
            </button>
            <img
              src={POINTER_SRC}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 z-20 w-[11%] -translate-x-1/2 select-none"
              style={{ top: '-3.3%', filter: 'drop-shadow(0 3px 3px rgba(90,50,10,0.3))' }}
            />
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

        {editable && (
          <div className="w-full md:w-[260px] md:shrink-0 space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-full bg-surface-container-lowest px-2 py-1.5 shadow-sm">
              <button
                type="button"
                onClick={onRemoveItem}
                disabled={count <= 1}
                aria-label={t('gameAdmin.removeItemQuick')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">remove</span>
              </button>
              <span className="font-label-md text-label-md text-on-surface-variant tabular-nums whitespace-nowrap">
                {t('gameAdmin.itemCountLabel', { count })}
              </span>
              <button
                type="button"
                onClick={onAddItem}
                aria-label={t('gameAdmin.addItemQuick')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
              </button>
            </div>
            <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
              {items.map((item, i) => (
                <input
                  key={item.id}
                  value={itemDrafts[item.id] ?? item.label}
                  onChange={(e) => handleItemDraftChange(item.id, e.target.value)}
                  onBlur={() => commitItemDraft(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  style={{ color: colorFor(i) }}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
