import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

type Tool = 'pen' | 'eraser';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
  tool: Tool;
  /** 지우개 지름(px). 없으면 예전 선(굵기 × 3) */
  size?: number;
}

interface Props {
  onClose: () => void;
  /** 위쪽에서 비울 높이(px) — 발표 진행바가 있으면 52, 자료실 화면에서는 0 */
  top?: number;
  /** 전자칠판처럼 닫기 없이 계속 쓰는 판서 — 닫기 단추와 Esc 닫기를 없앤다 */
  persistent?: boolean;
  /** 있으면 이 탭 sessionStorage 에 선을 남겨, 다른 화면에 다녀와도 판서가 이어진다 */
  persistKey?: string;
  /** Slide-local canvas with a toolbar rendered outside the drawing surface. */
  contained?: boolean;
  toolbarTarget?: HTMLElement | null;
}

// 흰색: 초록·검은 칠판 배경에서도 잘 보이게(2026-10-11 사용자 요청)
const COLORS = ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#00ACC1', '#1565C0', '#8E24AA', '#EC407A', '#795548', '#111827', '#FFFFFF'];
const WIDTHS = [3, 6, 11];
const ERASER_SIZES = [32, 64, 120, 200];
const ERASER_MIN = 16;
const ERASER_MAX = 320;
const clampEraser = (n: number) => Math.min(ERASER_MAX, Math.max(ERASER_MIN, Math.round(n)));

/** 수업 중 이미지·워크시트 위에만 잠깐 쓰는 판서 레이어. 선은 서버에 저장하지 않고 현재
 * 활동 안에서만 유지한다. 좌표를 비율로 저장해 전체화면 전환이나 창 크기 변경에도 모양을 지킨다. */
export default function LessonAnnotationLayer({ onClose, top = 52, persistent = false, persistKey, contained = false, toolbarTarget }: Props) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>(() => {
    if (!persistKey) return [];
    try {
      const raw = sessionStorage.getItem(persistKey);
      const parsed = raw ? (JSON.parse(raw) as Stroke[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [eraserSize, setEraserSize] = useState(64);
  // 지우개 모양(원)을 포인터를 따라 보여 준다
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; size: number } | null>(null);
  const eraserSizeRef = useRef(eraserSize);
  eraserSizeRef.current = eraserSize;

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke, canvas: HTMLCanvasElement) => {
    if (stroke.points.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.tool === 'eraser' ? (stroke.size ?? stroke.width * 3) : stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const first = stroke.points[0];
    ctx.moveTo(first.x * canvas.clientWidth, first.y * canvas.clientHeight);
    if (stroke.points.length === 1) {
      ctx.lineTo(first.x * canvas.clientWidth + 0.01, first.y * canvas.clientHeight + 0.01);
    } else {
      for (const point of stroke.points.slice(1)) {
        ctx.lineTo(point.x * canvas.clientWidth, point.y * canvas.clientHeight);
      }
    }
    ctx.stroke();
    ctx.restore();
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const widthPx = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const heightPx = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== widthPx || canvas.height !== heightPx) {
      canvas.width = widthPx;
      canvas.height = heightPx;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    strokesRef.current.forEach((stroke) => drawStroke(ctx, stroke, canvas));
  }, [drawStroke]);

  useEffect(() => {
    strokesRef.current = strokes;
    redraw();
    if (persistKey) {
      try {
        sessionStorage.setItem(persistKey, JSON.stringify(strokes));
      } catch {
        /* 너무 커서 못 남겨도 이번 화면에서는 그대로 쓴다 */
      }
    }
  }, [strokes, redraw, persistKey]);

  useEffect(() => {
    const observer = new ResizeObserver(redraw);
    if (canvasRef.current) observer.observe(canvasRef.current);
    window.addEventListener('resize', redraw);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', redraw);
    };
  }, [redraw]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !persistent) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, persistent]);

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / Math.max(1, rect.width),
      y: (event.clientY - rect.top) / Math.max(1, rect.height),
    };
  }

  function pointerDistance() {
    const [p, q] = [...pointersRef.current.values()];
    return Math.hypot(p.x - q.x, p.y - q.y);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* 캡처를 못 잡아도 그리기는 계속 */
    }
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (tool === 'eraser') setCursor({ x: event.clientX, y: event.clientY });
    // 지우개로 두 손가락을 대면 그리기를 멈추고 크기 조절(벌리면 커지고 오므리면 작아진다)
    if (tool === 'eraser' && pointersRef.current.size === 2) {
      activeStrokeRef.current = null;
      redraw();
      pinchRef.current = { dist: Math.max(1, pointerDistance()), size: eraserSizeRef.current };
      return;
    }
    if (pointersRef.current.size > 1) return;
    const stroke: Stroke = { points: [pointFromEvent(event)], color, width, tool, ...(tool === 'eraser' ? { size: eraserSize } : {}) };
    activeStrokeRef.current = stroke;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) drawStroke(ctx, stroke, canvas);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (tool === 'eraser') setCursor({ x: event.clientX, y: event.clientY });
    if (pointersRef.current.has(event.pointerId)) pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchRef.current && pointersRef.current.size >= 2) {
      event.preventDefault();
      setEraserSize(clampEraser((pinchRef.current.size * pointerDistance()) / pinchRef.current.dist));
      return;
    }
    const stroke = activeStrokeRef.current;
    if (!stroke) return;
    event.preventDefault();
    stroke.points.push(pointFromEvent(event));
    redraw();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) drawStroke(ctx, stroke, canvas);
  }

  function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (event.pointerType !== 'mouse') setCursor(null);
    const stroke = activeStrokeRef.current;
    if (!stroke) return;
    event.preventDefault();
    activeStrokeRef.current = null;
    setStrokes((prev) => [...prev, stroke]);
  }

  // 마우스 휠로도 지우개 크기를 바꾼다
  function handleWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    if (tool !== 'eraser') return;
    setEraserSize((n) => clampEraser(n * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
  }

  const toolbar = (
<div className={`pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-deep-navy/95 p-2 text-white shadow-xl backdrop-blur-sm ${contained ? 'w-full' : 'absolute bottom-4 left-1/2 max-w-[calc(100vw-1rem)] -translate-x-1/2'}`} role="toolbar" aria-label={t('curriculum.play.annotation')}>
        <button
          type="button"
          onClick={() => setTool('pen')}
          aria-label={t('curriculum.play.pen')}
          className={`flex h-10 items-center gap-1 rounded-xl px-3 font-label-md text-label-md ${tool === 'pen' ? 'bg-white text-deep-navy' : 'hover:bg-white/15'}`}
          aria-pressed={tool === 'pen'}
        >
          <span className="material-symbols-outlined text-[20px]">ink_pen</span>
          <span className="hidden sm:inline">{t('curriculum.play.pen')}</span>
        </button>
        <div className={`flex items-center gap-1 px-1 ${contained ? 'max-w-full flex-wrap justify-center' : ''}`} aria-label={t('curriculum.play.penColor')}>
          {COLORS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => { setColor(item); setTool('pen'); }}
              className={`h-8 w-8 rounded-full border-2 ${color === item && tool === 'pen' ? 'border-white ring-2 ring-white/40' : 'border-white/40'}`}
              style={{ backgroundColor: item }}
              aria-label={t('curriculum.play.selectPenColor')}
              aria-pressed={color === item && tool === 'pen'}
            />
          ))}
          <label
            className={`relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 ${!COLORS.includes(color) && tool === 'pen' ? 'border-white ring-2 ring-white/40' : 'border-white/40'}`}
            style={{ background: COLORS.includes(color) ? 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' : color }}
            title={t('curriculum.play.customColor')}
            data-custom-color
          >
            <input
              type="color"
              value={color}
              onChange={(e) => { setColor(e.target.value); setTool('pen'); }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label={t('curriculum.play.customColor')}
            />
          </label>
        </div>
        <div className="flex items-center gap-0.5 rounded-xl bg-white/10 p-1" aria-label={t('curriculum.play.penWidth')}>
          {WIDTHS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setWidth(item)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${width === item ? 'bg-white text-deep-navy' : 'hover:bg-white/15'}`}
              aria-label={t('curriculum.play.selectPenWidth', { width: item })}
              aria-pressed={width === item}
            >
              <span className="rounded-full bg-current" style={{ width: item + 4, height: item + 4 }} />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTool('eraser')}
          aria-label={t('curriculum.play.eraser')}
          className={`flex h-10 items-center gap-1 rounded-xl px-3 font-label-md text-label-md ${tool === 'eraser' ? 'bg-white text-deep-navy' : 'hover:bg-white/15'}`}
          aria-pressed={tool === 'eraser'}
        >
          <span className="material-symbols-outlined text-[20px]">ink_eraser</span>
          <span className="hidden sm:inline">{t('curriculum.play.eraser')}</span>
        </button>
        {tool === 'eraser' && (
          <div className={`flex items-center gap-1 rounded-xl bg-white/10 p-1 ${contained ? 'max-w-full flex-wrap justify-center' : ''}`} role="group" aria-label={t('curriculum.play.eraserSize')} data-eraser-sizes>
            {ERASER_SIZES.map((item, i) => (
              <button
                key={item}
                type="button"
                onClick={() => setEraserSize(item)}
                aria-pressed={Math.abs(eraserSize - item) < 8}
                aria-label={`${t('curriculum.play.eraserSize')} ${i + 1}`}
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${Math.abs(eraserSize - item) < 8 ? 'bg-white text-deep-navy' : 'hover:bg-white/15'}`}
              >
                <span className="rounded-full border-2 border-current" style={{ width: 8 + i * 6, height: 8 + i * 6 }} />
              </button>
            ))}
            <input
              type="range"
              min={ERASER_MIN}
              max={ERASER_MAX}
              value={eraserSize}
              onChange={(e) => setEraserSize(Number(e.target.value))}
              aria-label={t('curriculum.play.eraserSize')}
              className="mx-1 w-24 accent-white"
            />
          </div>
        )}
        <button type="button" disabled={strokes.length === 0} onClick={() => setStrokes((prev) => prev.slice(0, -1))} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/15 disabled:opacity-30" aria-label={t('curriculum.play.undoDrawing')}>
          <span className="material-symbols-outlined text-[20px]">undo</span>
        </button>
        <button type="button" disabled={strokes.length === 0} onClick={() => setStrokes([])} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/15 disabled:opacity-30" aria-label={t('curriculum.play.clearDrawing')}>
          <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
        </button>
        {!persistent && (
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20" aria-label={t('curriculum.play.closeDrawing')}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}
      </div>
  );

  return (
    <div className={`no-print pointer-events-none ${contained ? 'absolute inset-0 z-10' : 'fixed inset-x-0 bottom-0 z-40'}`} style={contained ? undefined : { top }}>
      <canvas
        ref={canvasRef}
        className={`pointer-events-auto h-full w-full touch-none ${tool === 'eraser' ? 'cursor-none' : 'cursor-crosshair'}`}
        aria-label={t('curriculum.play.annotationCanvas')}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setCursor(null); }}
        onWheel={handleWheel}
      />
      {tool === 'eraser' && cursor && (
        <div
          aria-hidden
          data-eraser-cursor
          className="pointer-events-none fixed rounded-full border-[3px] border-white bg-white/25 shadow-[0_0_0_2px_rgba(15,23,42,0.75),0_2px_10px_rgba(0,0,0,0.35)]"
          style={{ width: eraserSize, height: eraserSize, left: cursor.x - eraserSize / 2, top: cursor.y - eraserSize / 2 }}
        />
      )}
      {contained ? toolbarTarget && createPortal(toolbar, toolbarTarget) : toolbar}
    </div>
  );
}
