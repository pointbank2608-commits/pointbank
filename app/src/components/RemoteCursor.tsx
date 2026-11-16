import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { RemotePointer, RemotePointerClick } from '../lib/remote';

const CURSOR_WIDTH = 28;
const CURSOR_HEIGHT = 32;
const CURSOR_TIP = 2;

function cursorPosition(point: { x: number; y: number }) {
  return {
    x: Math.max(0, Math.min((point.x / 1000) * window.innerWidth, window.innerWidth - 1)),
    y: Math.max(0, Math.min((point.y / 1000) * window.innerHeight, window.innerHeight - 1)),
  };
}

/** The tip of the arrow is two pixels in from the edge of the SVG. */
export function clickPresentationAt(point: RemotePointerClick) {
  const stage = document.querySelector('[data-remote-click-area]');
  const { x: clientX, y: clientY } = cursorPosition(point);
  const target = document.elementFromPoint(clientX, clientY);
  if (!target || !stage?.contains(target) ||
      target.closest('a[href], iframe, input[type="file"], input[type="password"], [data-no-remote-click]')) return;

  const focusable = target.closest<HTMLElement>('input, textarea, select, [contenteditable="true"]');
  focusable?.focus({ preventScroll: true });

  function dispatch(type: 'click' | 'dblclick', detail: number) {
    if (!target?.isConnected || !stage?.contains(target)) return;
    target.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, composed: true, view: window, clientX, clientY, button: 0, detail,
    }));
  }

  dispatch('click', 1);
  if (point.count === 2 && document.elementFromPoint(clientX, clientY) === target) {
    dispatch('click', 2);
    dispatch('dblclick', 2);
  }
}

export default function RemoteCursor({ point, root }: { point: RemotePointer | null; root: Element }) {
  const cursor = useRef<SVGSVGElement>(null);
  const position = useRef({ x: 500, y: 500 });

  useLayoutEffect(() => {
    const svg = cursor.current;
    if (!svg || !point) return;

    const current = position.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let previous = performance.now();
    let frame = 0;

    function animate(now: number) {
      if (!svg || !point) return;
      // Interpolate from the currently drawn point even when another packet arrives mid-frame.
      const follow = 1 - Math.exp(-(now - previous) / 40);
      previous = now;
      const settled = reduceMotion || Math.hypot(point.x - current.x, point.y - current.y) < 0.5;
      current.x = settled ? point.x : current.x + (point.x - current.x) * follow;
      current.y = settled ? point.y : current.y + (point.y - current.y) * follow;
      updateViewport();
      if (!settled) frame = window.requestAnimationFrame(animate);
    }

    animate(previous);
    window.addEventListener('resize', updateViewport);
    function updateViewport() {
      const pixel = cursorPosition(current);
      if (svg) svg.style.transform = `translate3d(${pixel.x - CURSOR_TIP}px, ${pixel.y - CURSOR_TIP}px, 0)`;
    }
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateViewport);
    };
  }, [point, root]);

  if (!point) return null;
  return createPortal(
    <svg
      ref={cursor}
      aria-hidden="true"
      data-remote-pointer
      className="pointer-events-none fixed left-0 top-0 z-[100] drop-shadow-md will-change-transform"
      width={CURSOR_WIDTH}
      height={CURSOR_HEIGHT}
      viewBox="0 0 28 32"
      fill="none"
    >
      <path d="M2 2v24l6-5 4 9 5-2-4-9h9L2 2Z" fill="#0869f7" stroke="white" strokeWidth="2" strokeLinejoin="round" />
    </svg>,
    root,
  );
}
