import { supabase } from './supabase';

/** 셀프 탈퇴·데이터 내보내기(2026-10-17, supabase/081) */

export async function requestAcademyDeletion(): Promise<string> {
  const { data, error } = await supabase.rpc('request_academy_deletion');
  if (error) throw new Error(error.message);
  return String(data);
}

export async function cancelAcademyDeletion(): Promise<void> {
  const { error } = await supabase.rpc('cancel_academy_deletion');
  if (error) throw new Error(error.message);
}

/** 내 학원의 삭제 예정(요청한) 시각 — 요청이 없거나 081 전이면 null */
export async function myDeletionRequest(): Promise<string | null> {
  const { data, error } = await supabase.rpc('my_deletion_request');
  if (error) return null;
  return (data as string | null) ?? null;
}

export async function deleteMyTeacherAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_teacher_account');
  if (error) throw new Error(error.message);
}

/** 유예 14일 중 남은 날 수(오늘 삭제되면 0) */
export function deletionDaysLeft(requestedAt: string): number {
  const due = Date.parse(requestedAt) + 14 * 86_400_000;
  return Math.max(0, Math.ceil((due - Date.now()) / 86_400_000));
}

const EXPORT_TABLES = ['classes', 'students', 'presets', 'transactions', 'word_lists', 'curriculum_lessons', 'game_templates'] as const;
const PAGE = 1000;
const MAX_ROWS = 100_000;

/** 내 학원 데이터를 한 파일(JSON)로 내려받는다 — RLS 가 내 학원 것만 돌려준다 */
export async function exportAcademyData(academyId: string): Promise<Blob> {
  const out: Record<string, unknown[]> = {};
  for (const table of EXPORT_TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('academy_id', academyId)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    out[table] = rows;
  }
  const payload = { exportedAt: new Date().toISOString(), academyId, ...out };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}
