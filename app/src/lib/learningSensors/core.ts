/** Internal measurement contract. Behaviour is client-reported; correctness stays server-owned. */
export const SENSOR_VERSION = 'sensor-v1';
export type SensorSource = 'homework' | 'solo' | 'word_memory' | 'group';
export type SensorAction = 'shown' | 'interval' | 'left' | 'hidden' | 'resumed' | 'submitted' | 'hint' | 'revealed' | 'audio' | 'help_requested' | 'help_resolved';
export interface SensorContext {
  source: SensorSource;
  /** In memory only. Never include in events, console output, URLs or browser storage. */
  credential: string;
  resource: string;
  runId?: string;
}
export interface SensorEvent {
  id: string;
  session: string;
  position: number;
  question: number | null;
  action: SensorAction;
  at: string;
  visible_ms: number;
  /** Conservative input-recent estimate, not attention or cognitive effort. */
  input_recent_ms: number;
}
export interface SensorSink {
  emit(event: SensorEvent): void;
  flush(): Promise<void>;
}
export function durationSlice(elapsed: number, visible: boolean, inputAge: number) {
  const ms = Number.isFinite(elapsed) ? Math.max(0, Math.min(30_000, Math.round(elapsed))) : 0;
  return { visible_ms: visible ? ms : 0, input_recent_ms: visible && inputAge <= 60_000 ? ms : 0 };
}
export type SensorHealth = { state: 'disabled' | 'ready' | 'missing_migration' | 'retrying'; pending: number; dropped: number };

/** Bounded, in-memory retry queue. A retry keeps event IDs; collection never blocks a lesson. */
export function createSensorQueue(send: (events: SensorEvent[]) => Promise<'ok' | 'missing'>, capacity = 120) {
  let queue: SensorEvent[] = [];
  let running: Promise<void> | null = null;
  let unavailable = false;
  const health: SensorHealth = { state: 'ready', pending: 0, dropped: 0 };
  const flush = (): Promise<void> => {
    if (running) return running;
    if (!queue.length || unavailable) return Promise.resolve();
    const batch = queue.slice(0, 40);
    running = (async () => {
      try {
        if (await send(batch) === 'missing') {
          unavailable = true;
          health.state = 'missing_migration';
          health.dropped += queue.length;
          queue = [];
        } else {
          const sent = new Set(batch.map(e => e.id));
          queue = queue.filter(e => !sent.has(e.id));
          health.state = 'ready';
        }
      } catch {
        health.state = 'retrying';
      } finally {
        health.pending = queue.length;
        running = null;
        // Drain new events after success; retry failures only on online/periodic triggers.
        if (health.state === 'ready' && queue.length) queueMicrotask(() => { void flush(); });
      }
    })();
    return running;
  };
  return {
    health,
    emit(event: SensorEvent) {
      if (unavailable) { health.dropped++; return; }
      if (queue.length >= capacity) { health.dropped++; return; }
      queue.push(event);
      health.pending = queue.length;
    },
    flush,
  };
}
