import { useEffect, useRef } from 'react';
import { createSensorSink, sensorsEnabled } from './api';
import { durationSlice, type SensorAction, type SensorContext } from './core';

/** Shared by real players only. No provider means no collection (including previews). */
export function useLearningActivity(context: SensorContext | undefined, position: number | null, question: number | null = null) {
  const emitRef = useRef<(action: SensorAction) => void>(() => undefined);
  const source = context?.source, credential = context?.credential, resource = context?.resource, runId = context?.runId;
  const sinkRef = useRef<ReturnType<typeof createSensorSink> | null>(null);
  const session = useRef<string | null>(null);
  useEffect(() => {
    if (!source || credential === undefined || !resource || !sensorsEnabled()) return;
    session.current = crypto.randomUUID();
    const sink = createSensorSink({ source, credential, resource, runId });
    sinkRef.current = sink;
    const retry = window.setInterval(() => { void sink.flush(); }, 15_000);
    const online = () => { void sink.flush(); };
    window.addEventListener('online', online);
    return () => {
      window.clearInterval(retry);
      window.removeEventListener('online', online);
      // Activity cleanup queues the final slice. Let it run before the final flush.
      queueMicrotask(() => { void sink.flush().finally(() => sink.dispose()); });
      sinkRef.current = null;
    };
  }, [source, credential, resource, runId]);
  useEffect(() => {
    const sink = sinkRef.current;
    if (!sink || position === null || !session.current) { emitRef.current = () => undefined; return; }
    const sessionId = session.current;
    let last = performance.now();
    let lastInput = Number.NEGATIVE_INFINITY;
    let visible = document.visibilityState === 'visible';
    let ended = false;
    const emit = (action: SensorAction) => {
      if (ended) return;
      const now = performance.now();
      sink.emit({ id: crypto.randomUUID(), session: sessionId, position, question, action,
        at: new Date().toISOString(), ...durationSlice(now - last, visible, now - lastInput) });
      last = now;
      void sink.flush();
    };
    const input = () => { lastInput = performance.now(); };
    const visibility = () => {
      emit(document.visibilityState === 'visible' ? 'resumed' : 'hidden');
      visible = document.visibilityState === 'visible';
    };
    const pagehide = () => { emit('left'); ended = true; };
    const pageshow = () => { if (ended) { ended = false; last = performance.now(); visible = document.visibilityState === 'visible'; emit('resumed'); } };
    emitRef.current = emit;
    emit('shown');
    const tick = window.setInterval(() => { if (visible) emit('interval'); }, 15_000);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pagehide);
    window.addEventListener('pageshow', pageshow);
    for (const event of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(event, input, { passive: true });
    return () => {
      emit('left');
      ended = true;
      emitRef.current = () => undefined;
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pagehide);
      window.removeEventListener('pageshow', pageshow);
      for (const event of ['pointerdown', 'keydown', 'touchstart']) window.removeEventListener(event, input);
    };
  }, [source, credential, resource, runId, position, question]);
  return (action: SensorAction) => emitRef.current(action);
}
