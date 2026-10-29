import { useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

/**
 * 파닉스 게임의 "끌어서 놓기". 누르면 그대로 버튼(클릭)이고, 10px 넘게 끌면 카드가 손가락을 따라오며
 * 손을 뗀 자리의 `[data-drop]` 영역으로 전달된다(터치·마우스·전자칠판 공통, 영역 위에서는 `data-drop-hot`).
 * 끌지 않은 클릭은 원래 onClick 으로 가므로 키보드·보조 기기 조작과 기존 흐름이 그대로 유지된다.
 */
function useDrag(onDropOn: ((zone: string) => void) | undefined, disabled: boolean | undefined) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const hot = useRef<Element | null>(null);
  const suppress = useRef(false);
  const cleanup = useRef<(() => void) | null>(null);
  const latest = useRef({ onDropOn, disabled });
  latest.current = { onDropOn, disabled };

  const zoneAt = (x: number, y: number) => {
    for (const el of document.elementsFromPoint(x, y)) {
      const zone = el.closest('[data-drop]');
      if (zone) return zone;
    }
    return null;
  };
  const setHot = (zone: Element | null) => {
    if (hot.current === zone) return;
    hot.current?.removeAttribute('data-drop-hot');
    zone?.setAttribute('data-drop-hot', 'true');
    hot.current = zone;
  };
  useEffect(() => () => { cleanup.current?.(); setHot(null); }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (latest.current.disabled || !latest.current.onDropOn || e.button > 0) return;
    cleanup.current?.();
    const startX = e.clientX, startY = e.clientY, id = e.pointerId;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!moved) { if (Math.hypot(dx, dy) < 10) return; moved = true; }
      setPos({ x: dx, y: dy });
      setHot(zoneAt(ev.clientX, ev.clientY));
    };
    const finish = (ev: PointerEvent, dropped: boolean) => {
      if (ev.pointerId !== id) return;
      cleanup.current?.();
      const zone = dropped && moved ? zoneAt(ev.clientX, ev.clientY) : null;
      setHot(null);
      setPos(null);
      if (moved) { suppress.current = true; window.setTimeout(() => { suppress.current = false; }, 150); }
      const target = zone?.getAttribute('data-drop');
      if (target) latest.current.onDropOn?.(target);
    };
    const up = (ev: PointerEvent) => finish(ev, true);
    const cancel = (ev: PointerEvent) => finish(ev, false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    cleanup.current = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      cleanup.current = null;
    };
  };
  const onClickCapture = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    if (suppress.current) { e.preventDefault(); e.stopPropagation(); suppress.current = false; }
  };
  const style: CSSProperties = pos
    ? { position: 'relative', zIndex: 60, transform: `translate(${pos.x}px,${pos.y}px) scale(1.08)`, transition: 'none', cursor: 'grabbing', touchAction: 'none', boxShadow: '0 14px 22px #0004' }
    : { touchAction: 'none', transition: 'transform .25s ease-out' };
  // 그림(img)을 잡고 끌 때 브라우저의 그림 끌기가 시작되면 포인터 이동이 끊기므로 막는다.
  const onDragStart = (e: { preventDefault: () => void }) => e.preventDefault();
  return { handlers: { onPointerDown, onClickCapture, onDragStart }, style, dragging: pos !== null };
}

type DragButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { onDropOn?: (zone: string) => void };
export function DragButton({ onDropOn, style, className, children, ...rest }: DragButtonProps) {
  const drag = useDrag(onDropOn, rest.disabled);
  return <button {...rest} {...drag.handlers} className={(className ?? '') + (drag.dragging ? ' pg-dragging' : '')} style={{ ...style, ...drag.style }}>{children}</button>;
}

type DragBoxProps = HTMLAttributes<HTMLDivElement> & { onDropOn?: (zone: string) => void; disabled?: boolean; children: ReactNode };
export function DragBox({ onDropOn, disabled, style, className, children, ...rest }: DragBoxProps) {
  const drag = useDrag(onDropOn, disabled);
  return <div {...rest} {...drag.handlers} className={(className ?? '') + (drag.dragging ? ' pg-dragging' : '')} style={{ ...style, ...drag.style }}>{children}</div>;
}
