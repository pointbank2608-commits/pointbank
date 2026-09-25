import type { CSSProperties } from 'react';
import { BOARD_FONTS, boardSlideStyle, boardTheme } from '../lib/boardThemes';
import type { CanvasElement, CanvasSlide, CanvasTextElement } from '../lib/types';

/** "직접 만들기" 슬라이드를 그리는 공용 렌더러 — 썸네일·편집 미리보기·발표 화면이 전부 이걸 쓴다.
 * 무대(16:9)에 container-type:size 를 걸고 글자 크기를 cqh(무대 높이 %)로 줘서, 어느 크기로
 * 그려도 PPT처럼 같은 비율로 보인다. */

export const CANVAS_FONTS: Record<CanvasTextElement['font'], string> = BOARD_FONTS;

export function canvasElementBoxStyle(el: CanvasElement): CSSProperties {
  return { position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%` };
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

/** 요소 하나의 "내용"만 — 위치 박스는 바깥에서 잡는다(편집기는 그 박스에 핸들을 붙인다). */
export function CanvasElementContent({ el, placeholder }: { el: CanvasElement; placeholder?: string }) {
  if (el.type === 'image') {
    return (
      <img
        src={el.url}
        alt=""
        draggable={false}
        className="pointer-events-none h-full w-full select-none"
        style={{ objectFit: el.fit }}
      />
    );
  }
  const empty = !el.text.trim();
  return (
    <div
      className="flex h-full w-full flex-col justify-center"
      style={{ ...canvasTextStyle(el), ...(empty && placeholder ? { color: '#9ca3af' } : {}) }}
    >
      <div data-text-body>{empty ? placeholder ?? '' : el.text}</div>
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

/** 주어진 칸 안에 16:9 무대를 최대한 크게 맞춰 그린다(칸이 높이를 가져야 한다 — absolute inset-0 등). */
export default function CanvasSlideView({ slide, className = '' }: { slide: CanvasSlide; className?: string }) {
  return (
    <div className={`flex h-full w-full items-center justify-center ${className}`} style={{ containerType: 'size' }}>
      <CanvasStageBox className="shadow-[0_8px_28px_rgba(0,0,0,0.15)]" fitParent>
        <CanvasBackground slide={slide} />
        {slide.elements.map((el) => (
          <div key={el.id} style={canvasElementBoxStyle(el)}>
            <CanvasElementContent el={el} />
          </div>
        ))}
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
