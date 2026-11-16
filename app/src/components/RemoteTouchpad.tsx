import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { moveRemotePointer, type RemotePairing } from '../lib/remote';

const SEND_INTERVAL_MS = 90;

export default function RemoteTouchpad({ pair }: { pair: RemotePairing }) {
  const { t } = useTranslation();
  const finger = useRef<{ id: number; x: number; y: number; width: number } | null>(null);
  const movement = useRef({ x: 0, y: 0 });
  const timer = useRef<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const lastSend = useRef(-Infinity);
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
      sending.current = false;
    };
  }, []);

  function scheduleMovement() {
    const signal = controller.current?.signal;
    if (!signal || signal.aborted || sending.current || timer.current !== null) return;
    if (!Math.round(movement.current.x) && !Math.round(movement.current.y)) return;

    const delay = Math.max(0, SEND_INTERVAL_MS - (performance.now() - lastSend.current));
    timer.current = window.setTimeout(async () => {
      timer.current = null;
      const { x, y } = movement.current;
      const dx = Math.max(-1000, Math.min(1000, Math.round(x)));
      const dy = Math.max(-1000, Math.min(1000, Math.round(y)));
      movement.current = { x: x - dx, y: y - dy };
      lastSend.current = performance.now();
      sending.current = true;
      try {
        await moveRemotePointer(pair, dx, dy, signal);
        if (!signal.aborted) setError(false);
      } catch {
        if (!signal.aborted) setError(true);
      } finally {
        if (!signal.aborted) {
          sending.current = false;
          scheduleMovement();
        }
      }
    }, delay);
  }

  function start(event: PointerEvent<HTMLElement>) {
    if (finger.current || event.button !== 0) return;
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

  return (
    <section
      aria-label={t('remote.touchpad')}
      className="flex min-h-28 flex-1 cursor-crosshair touch-none select-none flex-col items-center justify-center gap-1 rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-center text-on-surface-variant"
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
  );
}
