import { useLayoutEffect, type RefObject } from 'react';

/** Align a game panel with its trigger, keeping the panel within the visible area. */
export function useGamePanelAnchor(
  panel: RefObject<HTMLElement | null>,
  anchor: HTMLElement | null,
  maxWidth: number,
  container?: RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    const element = panel.current;
    if (!anchor || !element) return;
    const gap = 6;
    const edge = 8;
    const position = () => {
      const trigger = anchor.getBoundingClientRect();
      const bounds = container?.current?.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const leftEdge = Math.max(edge, bounds?.left ?? 0);
      const rightEdge = Math.min(viewportWidth - edge, bounds?.right ?? viewportWidth);
      const width = Math.min(maxWidth, Math.max(1, rightEdge - leftEdge));
      const left = Math.max(leftEdge, Math.min(trigger.left, rightEdge - width));
      const below = Math.max(0, viewportHeight - edge - trigger.bottom - gap);
      const above = Math.max(0, trigger.top - gap - edge);
      const openAbove = below < Math.min(240, above);
      const parentTop = bounds?.top ?? 0;
      Object.assign(element.style, {
        position: bounds ? 'absolute' : 'fixed',
        margin: '0',
        width: `${width}px`,
        left: `${left - (bounds?.left ?? 0) - (container?.current?.clientLeft ?? 0)}px`,
        right: 'auto',
        top: openAbove ? 'auto' : `${Math.max(edge, trigger.bottom + gap) - parentTop - (container?.current?.clientTop ?? 0)}px`,
        bottom: openAbove ? `${(bounds?.bottom ?? viewportHeight) - trigger.top + gap - (container?.current?.clientTop ?? 0)}px` : 'auto',
        maxHeight: `${Math.min(openAbove ? above : below, viewportHeight * (bounds ? 0.75 : 0.92))}px`,
      });
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(anchor);
    if (container?.current) observer.observe(container.current);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      for (const property of ['position', 'margin', 'width', 'left', 'right', 'top', 'bottom', 'max-height']) element.style.removeProperty(property);
    };
  }, [anchor, container, maxWidth, panel]);
}
