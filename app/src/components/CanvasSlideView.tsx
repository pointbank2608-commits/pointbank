import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BOARD_FONTS, boardSlideStyle, boardTheme } from '../lib/boardThemes';
import { MARK_PATHS } from '../lib/canvasMarks';
import { buildMotionPlan } from '../lib/canvasMotion';
import { useSyncedSubState } from '../lib/presentSync';
import type { CanvasElement, CanvasMarkElement, CanvasMotion, CanvasShapeElement, CanvasSlide, CanvasTextElement } from '../lib/types';

/** "직접 만들기" 슬라이드를 그리는 공용 렌더러 — 썸네일·편집 미리보기·발표 화면이 전부 이걸 쓴다.
 * 무대(16:9)에 container-type:size 를 걸고 글자 크기를 cqh(무대 높이 %)로 줘서, 어느 크기로
 * 그려도 PPT처럼 같은 비율로 보인다. */

export const CANVAS_FONTS: Record<CanvasTextElement['font'], string> = BOARD_FONTS;

export function canvasElementBoxStyle(el: CanvasElement): CSSProperties {
  return {
    position: 'absolute',
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: `${el.w}%`,
    height: `${el.h}%`,
    transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined,
  };
}

export function canvasTextStyle(el: CanvasTextElement): CSSProperties {
  return {
    fontFamily: CANVAS_FONTS[el.font] ?? CANVAS_FONTS.sans,
    fontSize: `${el.fontSize}cqh`,
    color: el.color,
    fontWeight: el.bold ? 700 : 400,
    fontStyle: el.italic ? 'italic' : 'normal',
    textAlign: el.align,
    lineHeight: 1.25,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    background: el.fill ?? 'transparent',
    borderRadius: el.fill ? '1.5cqh' : undefined,
    padding: '1cqh 1.5cqh',
  };
}

/** 화면에 보이는 선 길이(px) — 상자에 맞춰 가로세로가 다르게 늘어나므로 점을 따라가며 잰다 */
function screenLength(path: SVGPathElement): number {
  const total = path.getTotalLength();
  const m = path.getScreenCTM();
  if (!m || !total) return 0;
  let len = 0;
  let prev: DOMPoint | null = null;
  for (let i = 0; i <= 80; i++) {
    const p = path.getPointAtLength((total * i) / 80).matrixTransform(m);
    if (prev) len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

/** 그려지는 표시 — draw 면 펜으로 그리듯 나타나고(선마다 차례로), 아니면 다 그려진 채로 */
export function CanvasMarkContent({ el, draw = false, delay = 0, duration = 0.6 }: { el: CanvasMarkElement; draw?: boolean; delay?: number; duration?: number }) {
  const paths = MARK_PATHS[el.shape] ?? MARK_PATHS.check;
  const per = Math.max(0.15, duration / paths.length);
  const refs = useRef<(SVGPathElement | null)[]>([]);
  // 선 굵기가 화면 기준이라(non-scaling-stroke) 점선 길이도 화면 길이로 맞춘다. 다 그리면 점선을 풀어
  // 나중에 크기가 바뀌어도 선이 끊겨 보이지 않게 한다.
  const [lens, setLens] = useState<number[] | null>(null);
  const [done, setDone] = useState(0);
  useLayoutEffect(() => {
    if (!draw) return;
    setLens(refs.current.map((p) => (p ? Math.ceil(screenLength(p)) + 2 : 0)));
    setDone(0);
  }, [draw, el.shape]);
  const drawing = draw && lens !== null && done < paths.length;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`pointer-events-none h-full w-full overflow-visible ${drawing ? 'canvas-mark-draw' : ''}`}
      style={{ visibility: draw && lens === null ? 'hidden' : undefined }}
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path
          key={i}
          ref={(node) => {
            refs.current[i] = node;
          }}
          d={d}
          fill="none"
          stroke={el.color}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          onAnimationEnd={() => setDone((n) => n + 1)}
          style={{
            strokeWidth: `${el.stroke}cqh`,
            ...(drawing && lens ? ({ animationDelay: `${delay + i * per}s`, '--mark-dur': `${per}s`, '--mark-len': lens[i] } as CSSProperties) : {}),
          }}
        />
      ))}
    </svg>
  );
}

const SHAPE_PATHS: Record<string, string> = {
  triangle: 'M50 4 L96 94 L4 94 Z',
  diamond: 'M50 3 L97 50 L50 97 L3 50 Z',
  star: 'M50 5 L61 37 L95 38 L68 58 L78 92 L50 72 L22 92 L32 58 L5 38 L39 37 Z',
  speech: 'M10 5 H90 Q96 5 96 11 V62 Q96 68 90 68 H48 L28 94 L33 68 H10 Q4 68 4 62 V11 Q4 5 10 5 Z',
  blockarrow: 'M4 33 H58 V8 L96 50 L58 92 V67 H4 Z',
};

/** 도형 하나 — 네모·원과 선·화살표 선은 CSS 로(화살촉이 늘어나지 않게), 나머지는 SVG */
export function CanvasShapeContent({ el }: { el: CanvasShapeElement }) {
  const sw = el.strokeWidth;
  if (el.shape === 'line' || el.shape === 'arrow') {
    const c = el.stroke ?? '#1f2937';
    const bg =
      el.dash === 'dashed'
        ? `repeating-linear-gradient(90deg, ${c} 0, ${c} ${sw * 3}cqh, transparent ${sw * 3}cqh, transparent ${sw * 5.2}cqh)`
        : el.dash === 'dotted'
          ? `repeating-linear-gradient(90deg, ${c} 0, ${c} ${sw}cqh, transparent ${sw}cqh, transparent ${sw * 2.4}cqh)`
          : c;
    return (
      <div className="pointer-events-none flex h-full w-full items-center">
        <div style={{ flex: 1, height: `${sw}cqh`, background: bg, borderRadius: `${sw}cqh` }} />
        {el.shape === 'arrow' && (
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: `${sw * 3.4}cqh solid ${c}`,
              borderTop: `${sw * 2}cqh solid transparent`,
              borderBottom: `${sw * 2}cqh solid transparent`,
              marginLeft: `-${sw * 0.3}cqh`,
            }}
          />
        )}
      </div>
    );
  }
  if (el.shape === 'rect' || el.shape === 'roundrect' || el.shape === 'ellipse') {
    return (
      <div
        className="pointer-events-none h-full w-full"
        style={{
          boxSizing: 'border-box',
          background: el.fill ?? 'transparent',
          border: el.stroke ? `${sw}cqh ${el.dash} ${el.stroke}` : 'none',
          borderRadius: el.shape === 'ellipse' ? '50%' : el.shape === 'roundrect' ? `${el.radius ?? 4}cqh` : 0,
        }}
      />
    );
  }
  const d = SHAPE_PATHS[el.shape] ?? SHAPE_PATHS.triangle;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none h-full w-full overflow-visible" aria-hidden="true">
      <path
        d={d}
        fill={el.fill ?? 'none'}
        stroke={el.stroke ?? 'none'}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        style={{
          strokeWidth: `${sw}cqh`,
          strokeDasharray: el.dash === 'dashed' ? `${sw * 3}cqh ${sw * 2}cqh` : el.dash === 'dotted' ? `0.01px ${sw * 2.2}cqh` : undefined,
        }}
      />
    </svg>
  );
}

/** 요소 하나의 "내용"만 — 위치 박스는 바깥에서 잡는다(편집기는 그 박스에 핸들을 붙인다). */
export function CanvasElementContent({ el, placeholder }: { el: CanvasElement; placeholder?: string }) {
  const opacity = el.opacity !== undefined && el.opacity < 1 ? el.opacity : undefined;
  let body: ReactNode;
  if (el.type === 'mark') body = <CanvasMarkContent el={el} />;
  else if (el.type === 'shape') body = <CanvasShapeContent el={el} />;
  else if (el.type === 'image') {
    body = <img src={el.url} alt="" draggable={false} className="pointer-events-none h-full w-full select-none" style={{ objectFit: el.fit }} />;
  } else {
    const empty = !el.text.trim();
    body = (
      <div className="flex h-full w-full flex-col justify-center" style={{ ...canvasTextStyle(el), ...(empty && placeholder ? { color: '#9ca3af' } : {}) }}>
        <div data-text-body>{empty ? placeholder ?? '' : el.text}</div>
      </div>
    );
  }
  // 글상자 자동 늘리기가 첫 자식에서 [data-text-body]를 찾으므로, 투명도가 있을 때만 한 겹 더 싼다.
  return opacity === undefined ? <>{body}</> : <div className="h-full w-full" style={{ opacity }}>{body}</div>;
}

/** 효과 한 겹 — 나타나기는 처음 상태에서 시작하고, 사라지기(out)는 보이다가 사라진다 */
export function MotionLayer({ motion, el, animate, delay = 0, children }: { motion: CanvasMotion; el: CanvasElement; animate: boolean; delay?: number; children: ReactNode }) {
  if (!animate) return <div className="h-full w-full">{children}</div>;
  // 그려지기는 표시(mark)만 선 그리기로 하고, 선·화살표 선은 훑어 나타나기, 나머지는 서서히
  const name = motion.effect === 'draw' ? (el.type === 'shape' ? 'wipe' : 'fade') : motion.effect;
  return (
    <div
      className={`cm-fx h-full w-full ${motion.out ? 'cm-out' : ''}`}
      style={{ animationName: `cm-${name}`, animationDuration: `${motion.duration}s`, animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

/** 무대 배경(색 + 선택적으로 배경 그림). */
export function CanvasBackground({ slide }: { slide: CanvasSlide }) {
  return (
    <>
      <div className="absolute inset-0" style={{ background: slide.background }} />
      {(() => {
        const th = boardTheme(slide.theme);
        return th ? <div className="absolute inset-0" style={boardSlideStyle(th)} /> : null;
      })()}
      {slide.backgroundImageUrl && (
        <img
          src={slide.backgroundImageUrl}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
        />
      )}
    </>
  );
}

/**
 * 주어진 칸 안에 16:9 무대를 최대한 크게 맞춰 그린다(칸이 높이를 가져야 한다 — absolute inset-0 등).
 * play(발표·학생 따라보기)면 요소 효과가 나온다(lib/canvasMotion.ts — 클릭할 때 하나씩 / 앞과 함께 / 앞이 끝나면, 사라지기=가리개).
 * 클릭 단계는 클리커·Space·→·화면 클릭으로 하나씩 넘기고, 다 나오면 다음 슬라이드로 흘려보낸다(문법 슬라이드와 같은
 * capture 패턴). ←·PageUp 은 한 단계 거둔다. 썸네일·편집기(play 아님)에서는 효과 없이 처음 모습(다 보임)으로 그린다.
 */
export default function CanvasSlideView({ slide, className = '', play = false }: { slide: CanvasSlide; className?: string; play?: boolean }) {
  const plan = useMemo(() => buildMotionPlan(slide), [slide]);
  const total = play ? plan.clickSteps : 0;
  const [shown, setShown] = useState(0);
  // 방금 새로 도착한 단계(그 단계 효과만 움직인다). 뒤로 가면 -1(움직임 없이 상태만 되돌림). 처음엔 0 = 슬라이드가 열리며 나오는 효과
  const [animatedStep, setAnimatedStep] = useState(0);
  const shownRef = useRef(0);
  const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function goTo(n: number) {
    const prev = shownRef.current;
    if (n === prev) return;
    shownRef.current = n;
    setShown(n);
    setAnimatedStep(n > prev ? n : -1);
  }
  const follower = useSyncedSubState({ shown }, (s) => goTo(Number(s.shown) || 0));

  useEffect(() => {
    if (!play || follower || total === 0) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const fwd = e.key === 'PageDown' || e.key === 'ArrowRight' || e.key === ' ';
      const back = e.key === 'PageUp' || e.key === 'ArrowLeft';
      const n = shownRef.current;
      const next = fwd && n < total ? n + 1 : back && n > 0 ? n - 1 : n;
      if (next !== n) {
        goTo(next);
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, follower, total]);

  return (
    <div className={`flex h-full w-full items-center justify-center ${className}`} style={{ containerType: 'size' }}>
      <CanvasStageBox className="shadow-[0_8px_28px_rgba(0,0,0,0.15)]" fitParent>
        <CanvasBackground slide={slide} />
        {slide.elements.map((el) => {
          const info = play ? plan.byId.get(el.id) : undefined;
          if (!info) {
            return (
              <div key={el.id} style={canvasElementBoxStyle(el)}>
                <CanvasElementContent el={el} />
              </div>
            );
          }
          const m = info.motion;
          const out = !!m.out;
          const animating = animatedStep === info.step && !reduce;
          const visible = out ? info.step > shown || (animating && info.step === shown) : info.step <= shown;
          if (!visible) return null;
          const delay = info.start + (info.step === 0 ? 0.3 : 0);
          const drawMark = el.type === 'mark' && m.effect === 'draw' && !out;
          return (
            <div key={el.id} style={canvasElementBoxStyle(el)}>
              {drawMark ? (
                <CanvasMarkContent el={el} draw={animating} delay={delay} duration={m.duration} />
              ) : (
                <MotionLayer motion={m} el={el} animate={animating} delay={delay}>
                  <CanvasElementContent el={el} />
                </MotionLayer>
              )}
            </div>
          );
        })}
      </CanvasStageBox>
    </div>
  );
}

/** 16:9 무대 상자. fitParent 면 부모 컨테이너(container-type:size) 안에 가로·세로 모두 들어가게. */
export function CanvasStageBox({
  children,
  className = '',
  fitParent,
  stageRef,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  fitParent?: boolean;
  stageRef?: React.Ref<HTMLDivElement>;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      ref={stageRef}
      {...rest}
      className={`relative overflow-hidden ${fitParent ? '' : 'w-full'} ${className}`}
      style={{
        aspectRatio: '16 / 9',
        containerType: 'size',
        ...(fitParent ? { width: 'min(100cqw, calc(100cqh * 16 / 9))' } : {}),
        ...rest.style,
      }}
    >
      {children}
    </div>
  );
}
