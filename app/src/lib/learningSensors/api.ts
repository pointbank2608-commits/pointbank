import { supabase } from '../supabase';
import { createSensorQueue, type SensorContext, type SensorHealth, type SensorSink } from './core';

export const sensorsEnabled = () => import.meta.env.VITE_LEARNING_SENSORS_ENABLED === 'true';
const health = new Set<SensorHealth>();
/** Internal diagnostics only, never interpret missing telemetry as student inactivity. */
export const sensorHealth = () => [...health].map(h => ({ ...h }));

export function createSensorSink(context: SensorContext): SensorSink & { dispose(): void } {
  const queue = createSensorQueue(async events => {
    const { error } = context.runId
      ? await supabase.rpc('learning_sensor_report_run', { p_run: context.runId, p_credential: context.credential, p_events: events })
      : await supabase.rpc('learning_sensor_report', { p_source: context.source, p_credential: context.credential || null, p_resource: context.resource, p_events: events });
    if (error?.code === 'PGRST202' || error?.code === '42883') return 'missing';
    if (error) throw new Error('sensor_transport_failed');
    return 'ok';
  });
  health.add(queue.health);
  return { ...queue, dispose: () => { health.delete(queue.health); } };
}
