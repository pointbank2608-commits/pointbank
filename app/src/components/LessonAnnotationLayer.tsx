import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
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
}

interface Props {
  onClose: () => void;
}

const COLORS = ['#E53935', '#1565C0', '#2E7D32', '#111827'];
const WIDTHS = [3, 6, 11];

/** 수업 중 이미지·워크시트 위에만 잠깐 쓰는 판서 레이어. 선은 서버에 저장하지 않고 현재
 * 활동 안에서만 유지한다. 좌표를 비율로 저장해 전체화면 전환이나 창 크기 변경에도 모양을 지킨다. */
export default function LessonAnnotationLayer({ onClose }: Props) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke, canvas: HTMLCanvasElement) => {
    if (stroke.points.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.tool === 'eraser' ? stroke.width * 3 : stroke.width;
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
  }, [strokes, redraw]);

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
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / Math.max(1, rect.width),
      y: (event.clientY - rect.top) / Math.max(1, rect.height),
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const stroke: Stroke = { points: [pointFromEvent(event)], color, width, tool };
    activeStrokeRef.current = stroke;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) drawStroke(ctx, stroke, canvas);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
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
    const stroke = activeStrokeRef.current;
    if (!stroke) return;
    event.preventDefault();
    activeStrokeRef.current = null;
    setStrokes((prev) => [...prev, stroke]);
  }

  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-0 top-[52px] z-40">
      <canvas
        ref={canvasRef}
        className="pointer-events-auto h-full w-full cursor-crosshair touch-none"
        aria-label={t('curriculum.play.annotationCanvas')}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
      <div className="pointer-events-auto absolute bottom-4 left-1/2 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-deep-navy/95 p-2 text-white shadow-xl backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setTool('pen')}
          className={`flex h-10 items-center gap-1 rounded-xl px-3 font-label-md text-label-md ${tool === 'pen' ? 'bg-white text-deep-navy' : 'hover:bg-white/15'}`}
          aria-pressed={tool === 'pen'}
        >
          <span className="material-symbols-outlined text-[20px]">ink_pen</span>
          <span className="hidden sm:inline">{t('curriculum.play.pen')}</span>
        </button>
        <div className="flex items-center gap-1 px-1" aria-label={t('curriculum.play.penColor')}>
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
          className={`flex h-10 items-center gap-1 rounded-xl px-3 font-label-md text-label-md ${tool === 'eraser' ? 'bg-white text-deep-navy' : 'hover:bg-white/15'}`}
          aria-pressed={tool === 'eraser'}
        >
          <span className="material-symbols-outlined text-[20px]">ink_eraser</span>
          <span className="hidden sm:inline">{t('curriculum.play.eraser')}</span>
        </button>
        <button type="button" disabled={strokes.length === 0} onClick={() => setStrokes((prev) => prev.slice(0, -1))} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/15 disabled:opacity-30" aria-label={t('curriculum.play.undoDrawing')}>
          <span className="material-symbols-outlined text-[20px]">undo</span>
        </button>
        <button type="button" disabled={strokes.length === 0} onClick={() => setStrokes([])} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/15 disabled:opacity-30" aria-label={t('curriculum.play.clearDrawing')}>
          <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
        </button>
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20" aria-label={t('curriculum.play.closeDrawing')}>
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
    </div>
  );
}
