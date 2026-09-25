import { useEffect, useRef, type ReactNode } from 'react';
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
 * 안쪽 div 는 position:relative + min-h-full 이라, 발표 중 "화면을 꽉 채워야 하는" 슬라이드
 * (게임 GameThemeFrame, 이미지 슬라이드)는 absolute inset-0 으로 이 영역 전체를 채운다.
 */
export default function PresentZoomArea({ children }: { children: ReactNode }) {
  const { zoom, setZoom } = useLessonRunner();
  const outerRef = useRef<HTMLDivElement>(null);
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
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('pointermove', onPointerMove, true);
      el.removeEventListener('pointerup', onPointerEnd, true);
      el.removeEventListener('pointercancel', onPointerEnd, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [setZoom]);

  const zoomed = zoom.scale !== 1 || zoom.x !== 0 || zoom.y !== 0;

  return (
    <div
      ref={outerRef}
      // 브라우저 기본 핀치 확대(페이지 전체)는 막고, 한 손가락 세로·가로 스크롤은 그대로 둔다.
      style={{ touchAction: 'pan-x pan-y' }}
      className={`relative min-h-0 flex-1 print:overflow-visible ${zoomed ? 'overflow-hidden' : 'overflow-y-auto'}`}
    >
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
