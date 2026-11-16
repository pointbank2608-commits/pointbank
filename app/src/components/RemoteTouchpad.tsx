import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { clickRemotePointer, moveRemotePointer, scrollRemotePresentation, type RemotePairing } from '../lib/remote';

const SEND_INTERVAL_MS = 60;

export default function RemoteTouchpad({ pair, step, clickEnabled, scrollEnabled }: {
  pair: RemotePairing;
  step: number;
  clickEnabled: boolean;
  scrollEnabled: boolean;
}) {
  const { t } = useTranslation();
  const finger = useRef<{ id: number; x: number; y: number; width: number } | null>(null);
  const scrollFinger = useRef<{ id: number; y: number; step: number } | null>(null);
  const movement = useRef({ x: 0, y: 0 });
  const pendingScroll = useRef<{ delta: number; step: number } | null>(null);
  const timer = useRef<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const lastSend = useRef(-Infinity);
  const pendingClick = useRef<{ count: 1 | 2; step: number } | null>(null);
  const lastTouchClick = useRef<{ button: HTMLButtonElement; at: number } | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const [clicking, setClicking] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const requests = new AbortController();
    controller.current = requests;
    return () => {
      requests.abort();
      controller.current = null;
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      movement.current = { x: 0, y: 0 };
      pendingScroll.current = null;
      pendingClick.current = null;
      sending.current = false;
    };
  }, []);

  function scheduleMovement() {
    const signal = controller.current?.signal;
    if (!signal || signal.aborted || sending.current || timer.current !== null) return;
    if (!Math.round(movement.current.x) && !Math.round(movement.current.y)
      && !Math.round(pendingScroll.current?.delta ?? 0) && !pendingClick.current) return;

    const delay = Math.max(0, SEND_INTERVAL_MS - (performance.now() - lastSend.current));
    timer.current = window.setTimeout(async () => {
      timer.current = null;
      const { x, y } = movement.current;
      const dx = Math.max(-1000, Math.min(1000, Math.round(x)));
      const dy = Math.max(-1000, Math.min(1000, Math.round(y)));
      const scroll = dx || dy ? null : pendingScroll.current;
      const scrollDelta = Math.max(-1000, Math.min(1000, Math.round(scroll?.delta ?? 0)));
      // Send every pending movement before taking the click's position on the server.
      const click = dx || dy || scrollDelta ? null : pendingClick.current;
      if (click) pendingClick.current = null;
      if (scroll && scrollDelta) {
        const remaining = scroll.delta - scrollDelta;
        pendingScroll.current = Math.round(remaining) ? { ...scroll, delta: remaining } : null;
      }
      movement.current = { x: x - dx, y: y - dy };
      lastSend.current = performance.now();
      sending.current = true;
      try {
        if (click) {
          await clickRemotePointer(pair, click.count, click.step, signal);
        } else if (scroll && scrollDelta) {
          await scrollRemotePresentation(pair, scrollDelta, scroll.step, signal);
        } else {
          await moveRemotePointer(pair, dx, dy, signal);
        }
        if (!signal.aborted) {
          if (dx || dy) setHasMoved(true);
          setError(false);
        }
      } catch {
        if (!signal.aborted) {
          setError(true);
          if (dx || dy) {
            pendingClick.current = null;
            setHasMoved(false);
            setClicking(false);
          }
        }
      } finally {
        if (!signal.aborted) {
          sending.current = false;
          if (click) setClicking(false);
          scheduleMovement();
        }
      }
    }, delay);
  }

  function start(event: PointerEvent<HTMLElement>) {
    if (finger.current || clicking || event.button !== 0) return;
    const { pointerId, clientX, clientY, currentTarget } = event;
    const width = currentTarget.getBoundingClientRect().width;
    if (width <= 0) return;
    currentTarget.setPointerCapture(pointerId);
    finger.current = { id: pointerId, x: clientX, y: clientY, width };
  }

  function move(event: PointerEvent<HTMLElement>) {
    const active = finger.current;
    if (!active || active.id !== event.pointerId) return;
    movement.current.x += ((event.clientX - active.x) * 800) / active.width;
    movement.current.y += ((event.clientY - active.y) * 1400) / active.width;
    active.x = event.clientX;
    active.y = event.clientY;
    scheduleMovement();
  }

  function stop(event: PointerEvent<HTMLElement>) {
    if (finger.current?.id === event.pointerId) finger.current = null;
  }

  function addScroll(delta: number, scrollStep: number) {
    if (!scrollEnabled || !delta) return;
    const previous = pendingScroll.current?.step === scrollStep ? pendingScroll.current.delta : 0;
    pendingScroll.current = { delta: previous + delta, step: scrollStep };
    scheduleMovement();
  }

  function stopScroll(event: PointerEvent<HTMLElement>) {
    if (scrollFinger.current?.id === event.pointerId) scrollFinger.current = null;
  }

  function click(count: 1 | 2) {
    if (!clickEnabled || !hasMoved || clicking || finger.current || pendingClick.current) return;
    pendingClick.current = { count, step };
    setClicking(true);
    scheduleMovement();
  }

  function touchClick(event: PointerEvent<HTMLButtonElement>, count: 1 | 2) {
    if (event.pointerType !== 'touch' || event.currentTarget.disabled) return;
    const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
    if (event.clientX < left || event.clientX >= right || event.clientY < top || event.clientY >= bottom) return;
    lastTouchClick.current = { button: event.currentTarget, at: performance.now() };
    click(count);
  }

  function buttonClick(event: MouseEvent<HTMLButtonElement>, count: 1 | 2) {
    const previous = lastTouchClick.current;
    // Some touch browsers also emit a compatibility click after pointerup.
    if (event.detail > 0 && previous?.button === event.currentTarget && performance.now() - previous.at < 500) return;
    click(count);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest">
      <div className="flex flex-1">
        <section
          aria-label={t('remote.touchpad')}
          className="flex min-h-28 flex-1 cursor-crosshair touch-none select-none flex-col items-center justify-center gap-1 px-4 py-3 text-center text-on-surface-variant"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
          onLostPointerCapture={stop}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[26px] text-primary">touchpad_mouse</span>
          <span className="font-label-md text-label-md text-deep-navy">{t('remote.touchpad')}</span>
          <span role={error ? 'status' : undefined} className="font-caption text-caption">
            {error ? t('remote.connectionError') : t('remote.touchpadHint')}
          </span>
        </section>
        {scrollEnabled && (
          <div
            role="group"
            aria-label={t('remote.scrollStrip')}
            tabIndex={0}
            className="flex w-[54px] shrink-0 cursor-ns-resize touch-none select-none flex-col items-center justify-between gap-2 border-l border-outline-variant bg-surface-container-low py-3 text-deep-navy focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:bg-secondary-container"
            onPointerDown={(event) => {
              if (scrollFinger.current || event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              scrollFinger.current = { id: event.pointerId, y: event.clientY, step };
            }}
            onPointerMove={(event) => {
              const active = scrollFinger.current;
              if (!active || active.id !== event.pointerId || active.step !== step) return;
              addScroll((event.clientY - active.y) * 2, active.step);
              active.y = event.clientY;
            }}
            onPointerUp={stopScroll}
            onPointerCancel={stopScroll}
            onLostPointerCapture={stopScroll}
            onContextMenu={(event) => event.preventDefault()}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
              event.preventDefault();
              addScroll(event.key === 'ArrowUp' ? -96 : 96, step);
            }}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">expand_less</span>
            <span className="text-[11px] font-semibold">{t('remote.scrollStrip')}</span>
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">expand_more</span>
          </div>
        )}
      </div>
      {clickEnabled && (
        <div className="grid grid-cols-2 divide-x divide-outline-variant border-t border-outline-variant bg-surface-container-low">
          <button
            type="button"
            disabled={!hasMoved || clicking}
            onPointerUp={(event) => touchClick(event, 1)}
            onClick={(event) => buttonClick(event, 1)}
            className="min-h-12 touch-manipulation font-label-md text-label-md text-deep-navy active:bg-secondary-container disabled:opacity-50"
          >
            {t('remote.pointerClick')}
          </button>
          <button
            type="button"
            disabled={!hasMoved || clicking}
            onPointerUp={(event) => touchClick(event, 2)}
            onClick={(event) => buttonClick(event, 2)}
            className="min-h-12 touch-manipulation font-label-md text-label-md text-deep-navy active:bg-secondary-container disabled:opacity-50"
          >
            {t('remote.pointerDoubleClick')}
          </button>
        </div>
      )}
    </div>
  );
}
