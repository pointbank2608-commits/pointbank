import { supabase } from '../supabase';
import { sensorsEnabled } from './api';

type DeliverySource = 'homework' | 'solo' | 'word_memory';
/** Fallback only when the new endpoint is absent. Never hide network/auth failures. */
export async function openDelivery<T>(source: DeliverySource, credential: string, resource: string | null, legacy: () => Promise<T>): Promise<T> {
  if (!sensorsEnabled()) return legacy();
  const { data, error } = await supabase.rpc('learning_run_open', { p_source: source, p_credential: credential, p_resource: resource });
  if (error?.code === 'PGRST202' || error?.code === '42883') return legacy();
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

/** No downgrade on an action failure: retry must retain the original delivery receipt. */
export async function deliveryAction<T>(runId: string, credential: string, position: number, action: 'answer' | 'test' | 'advance' | 'reveal', payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc('learning_run_action', {
    p_run: runId, p_credential: credential, p_position: position, p_action: action, p_payload: payload,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}
