import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PRESENT_ZOOM_IDENTITY,
  PRESENT_ZOOM_MAX,
  PRESENT_ZOOM_MIN,
  useLessonRunner,
  type PresentZoom,
} from '../context/LessonRunnerContext';

function clampScale(s: number): number {
  return Math.min(PRESENT_ZOOM_MAX, Math.max(PRESENT_ZOOM_MIN, s));
}

/** (px, py) 지점이 화면에서 그대로 머물도록 배율을 바꾼다 — 손가락·커서 아래를 기준으로 확대. */
export function zoomAt(prev: PresentZoom, nextScale: number, px: number, py: number): PresentZoom {
  const scale = clampScale(nextScale);
  if (Math.abs(scale - 1) < 0.02) return PRESENT_ZOOM_IDENTITY;
  const k = scale / prev.scale;
  return { scale, x: px - (px - prev.x) * k, y: py - (py - prev.y) * k };
}

interface Pinch {
  startDist: number;
  startMid: { x: number; y: number };
  startZoom: PresentZoom;
}

/**
 * 발표 중 슬라이드 영역 — 두 손가락 핀치, Ctrl(⌘)+휠(트랙패드 핀치 포함), Ctrl +/−/0 으로
 * 확대·축소하고, 확대된 상태에선 휠·두 손가락으로 끌어 옮긴다. 한 손가락 탭·드래그는 그대로
 * 게임에 넘긴다(게임 조작과 안 겹치게). 100%일 땐 transform 을 아예 안 걸어서(transform 이 있으면
 * 안쪽 position:fixed 화면들의 기준이 바뀐다) 평소 동작과 완전히 같다.
 *
 * 터치가 없는 화면(마우스)에서는 스페이스바를 누른 채 끌거나(커서가 손바닥 ✋), 마우스 휠 버튼을 누른 채
 * 끌어서 화면을 옮긴다 — 확대됐으면 확대 화면을, 아니면 화면보다 긴 슬라이드를 스크롤한다. 스페이스를
 * 짧게 눌렀다 떼면(끌지 않으면) 원래 스페이스 동작(문법 예문 다음·카드 뒤집기)을 그대로 넘겨준다.
 *
 * 안쪽 div 는 position:relative + min-h-full 이라, 발표 중 "화면을 꽉 채워야 하는" 슬라이드
 * (게임 GameThemeFrame, 이미지 슬라이드)는 absolute inset-0 으로 이 영역 전체를 채운다.
 */
export default function PresentZoomArea({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { zoom, setZoom } = useLessonRunner();
  const outerRef = useRef<HTMLDivElement>(null);
  // 끌어서 옮기기 상태: 'ready' = 스페이스를 누르고 있음(손바닥), 'dragging' = 끄는 중(쥔 손)
  const [panMode, setPanMode] = useState<'off' | 'ready' | 'dragging'>('off');
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const el: HTMLDivElement = outer;

    function localPoint(clientX: number, clientY: number) {
      const r = el.getBoundingClientRect();
      return { x: clientX - r.left + el.scrollLeft, y: clientY - r.top + el.scrollTop };
    }

    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        // 브라우저 자체 확대(페이지 전체 줌) 대신 슬라이드만 확대한다.
        e.preventDefault();
        const d = Math.max(-50, Math.min(50, e.deltaY));
        const p = localPoint(e.clientX, e.clientY);
        setZoom((prev) => zoomAt(prev, prev.scale * Math.exp(-d * 0.004), p.x, p.y));
        return;
      }
      if (zoomRef.current.scale !== 1) {
        // 확대된 상태에서 휠·트랙패드 스크롤은 화면을 끌어 옮기는 데 쓴다.
        e.preventDefault();
        setZoom((prev) => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
    }

    const touches = new Map<number, { x: number; y: number }>();
    let pinch: Pinch | null = null;

    function pinchInfo() {
      const [a, b] = Array.from(touches.values());
      return {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: localPoint((a.x + b.x) / 2, (a.y + b.y) / 2),
      };
    }

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType !== 'touch') return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const { dist, mid } = pinchInfo();
        pinch = { startDist: Math.max(1, dist), startMid: mid, startZoom: zoomRef.current };
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!pinch || touches.size !== 2) return;
      e.preventDefault();
      const { dist, mid } = pinchInfo();
      const p = pinch;
      const z = zoomAt(p.startZoom, p.startZoom.scale * (dist / p.startDist), p.startMid.x, p.startMid.y);
      setZoom(z.scale === 1 ? z : { ...z, x: z.x + (mid.x - p.startMid.x), y: z.y + (mid.y - p.startMid.y) });
    }

    function onPointerEnd(e: PointerEvent) {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = null;
    }

    /* ---------- 스페이스바 / 휠 버튼으로 끌어서 옮기기 ---------- */
    const PASS = '__classbankSpacePass';
    let spaceHeld = false;
    let spaceDownAt = 0;
    let dragged = false;
    let justPanned = false;
    let pan: { pointerId: number; x: number; y: number; zoom: PresentZoom; scrollLeft: number; scrollTop: number } | null = null;

    const isZoomed = () => zoomRef.current.scale !== 1 || zoomRef.current.x !== 0 || zoomRef.current.y !== 0;
    const canScroll = () => el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2;
    const isTyping = (target: EventTarget | null) => {
      const node = target as HTMLElement | null;
      return !!node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT' || node.isContentEditable);
    };

    function onSpaceDown(e: KeyboardEvent) {
      if (e.key !== ' ' || (e as unknown as Record<string, unknown>)[PASS] || isTyping(e.target)) return;
      // 옮길 게 없으면(확대 안 됐고 스크롤도 없음) 스페이스는 원래 동작 그대로.
      if (!spaceHeld && !isZoomed() && !canScroll()) return;
      // 슬라이드 쪽(문법 예문·카드)이 이 스페이스를 받지 않게 먼저 가로챈다. 짧게 누르고 떼면 keyup 에서 돌려준다.
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat || spaceHeld) return;
      spaceHeld = true;
      spaceDownAt = Date.now();
      dragged = false;
      setPanMode('ready');
    }

    function onSpaceUp(e: KeyboardEvent) {
      if (e.key !== ' ' || !spaceHeld) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      spaceHeld = false;
      if (!pan) setPanMode('off');
      // 끌지 않고 짧게 눌렀다 뗀 스페이스 → 원래 스페이스 동작으로 다시 보내 준다.
      if (!dragged && Date.now() - spaceDownAt < 350) {
        const again = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
        (again as unknown as Record<string, unknown>)[PASS] = true;
        (document.activeElement ?? document.body).dispatchEvent(again);
      }
    }

    function startPan(e: PointerEvent) {
      e.preventDefault();
      e.stopPropagation();
      pan = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, zoom: zoomRef.current, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* 캡처가 안 돼도 영역 안에서 끄는 건 동작한다 */
      }
      setPanMode('dragging');
    }

    function onPanDown(e: PointerEvent) {
      if (e.pointerType === 'touch') return;
      const middle = e.button === 1;
      if ((spaceHeld && e.button === 0) || (middle && (isZoomed() || canScroll()))) startPan(e);
    }

    function onPanMove(e: PointerEvent) {
      if (!pan || e.pointerId !== pan.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      const dx = e.clientX - pan.x;
      const dy = e.clientY - pan.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
      if (isZoomed()) {
        setZoom({ ...pan.zoom, x: pan.zoom.x + dx, y: pan.zoom.y + dy });
      } else {
        el.scrollLeft = pan.scrollLeft - dx;
        el.scrollTop = pan.scrollTop - dy;
      }
    }

    function onPanUp(e: PointerEvent) {
      if (!pan || e.pointerId !== pan.pointerId) return;
      e.stopPropagation();
      pan = null;
      justPanned = dragged;
      setPanMode(spaceHeld ? 'ready' : 'off');
    }

    // 끌기를 마친 순간의 클릭은 게임 버튼 등에 전달하지 않는다.
    function onClickCapture(e: MouseEvent) {
      if (justPanned || spaceHeld) {
        e.preventDefault();
        e.stopPropagation();
        justPanned = false;
      }
    }

    function onBlur() {
      spaceHeld = false;
      pan = null;
      setPanMode('off');
    }

    // 휠 버튼 클릭의 기본 동작(자동 스크롤 동그라미)을 막는다.
    function onAuxDown(e: MouseEvent) {
      if (e.button === 1 && (isZoomed() || canScroll())) e.preventDefault();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const r = el.getBoundingClientRect();
      const cx = r.width / 2 + el.scrollLeft;
      const cy = r.height / 2 + el.scrollTop;
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setZoom((prev) => zoomAt(prev, prev.scale * 1.25, cx, cy));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom((prev) => zoomAt(prev, prev.scale / 1.25, cx, cy));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(PRESENT_ZOOM_IDENTITY);
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    // 캡처 단계로 받아야 게임 쪽 요소가 이벤트를 멈춰도 손가락 수를 놓치지 않는다.
    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
    el.addEventListener('pointerup', onPointerEnd, true);
    el.addEventListener('pointercancel', onPointerEnd, true);
    window.addEventListener('keydown', onKeyDown);
    // 슬라이드들(문법·카드)도 window capture 로 스페이스를 듣는다 — 이 영역이 먼저 붙어 있어 먼저 받는다.
    window.addEventListener('keydown', onSpaceDown, true);
    window.addEventListener('keyup', onSpaceUp, true);
    window.addEventListener('blur', onBlur);
    el.addEventListener('pointerdown', onPanDown, true);
    el.addEventListener('pointermove', onPanMove, true);
    el.addEventListener('pointerup', onPanUp, true);
    el.addEventListener('pointercancel', onPanUp, true);
    el.addEventListener('click', onClickCapture, true);
    el.addEventListener('mousedown', onAuxDown, true);
    return () => {
      window.removeEventListener('keydown', onSpaceDown, true);
      window.removeEventListener('keyup', onSpaceUp, true);
      window.removeEventListener('blur', onBlur);
      el.removeEventListener('pointerdown', onPanDown, true);
      el.removeEventListener('pointermove', onPanMove, true);
      el.removeEventListener('pointerup', onPanUp, true);
      el.removeEventListener('pointercancel', onPanUp, true);
      el.removeEventListener('click', onClickCapture, true);
      el.removeEventListener('mousedown', onAuxDown, true);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('pointermove', onPointerMove, true);
      el.removeEventListener('pointerup', onPointerEnd, true);
      el.removeEventListener('pointercancel', onPointerEnd, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [setZoom]);

  const zoomed = zoom.scale !== 1 || zoom.x !== 0 || zoom.y !== 0;

  // 처음 확대했을 때 한 번만 "스페이스바를 누른 채 끌면 옮겨요" 안내(몇 초 뒤 사라짐).
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    if (!zoomed) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem('classbank.panHintSeen') === '1';
      sessionStorage.setItem('classbank.panHintSeen', '1');
    } catch {
      /* 저장이 막혀 있으면 매번 보여줘도 괜찮다 */
    }
    if (seen) return;
    setShowHint(true);
    const timer = window.setTimeout(() => setShowHint(false), 4000);
    return () => window.clearTimeout(timer);
  }, [zoomed]);

  return (
    <div
      ref={outerRef}
      // 브라우저 기본 핀치 확대(페이지 전체)는 막고, 한 손가락 세로·가로 스크롤은 그대로 둔다.
      style={{ touchAction: 'pan-x pan-y' }}
      className={`relative min-h-0 flex-1 print:overflow-visible ${zoomed ? 'overflow-hidden' : 'overflow-y-auto'} ${
        panMode === 'dragging' ? 'present-pan-grabbing' : panMode === 'ready' ? 'present-pan-ready' : ''
      }`}
    >
      {showHint && (
        <div className="pointer-events-none sticky left-0 top-2 z-40 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-inverse-surface/85 px-4 py-2 font-label-md text-label-md text-inverse-on-surface shadow-lg">
          <span className="material-symbols-outlined text-[18px]">pan_tool</span>
          {t('curriculum.play.panHint')}
        </div>
      )}
      <div
        className="relative min-h-full p-3 md:p-5 print:p-0"
        style={
          zoomed
            ? { transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`, transformOrigin: '0 0' }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
