// 단어암기숙제(090) 임시 DB(PGlite) 준비: 하네스 스키마 + 이 기능이 기대하는 기존 표·함수의 최소 모양 + 090a~m 적용. 운영 DB 와 무관.
import { makeDb } from './lib.mjs';

export const WM_FILES = [
  '090a_wm_tables.sql', '090b_wm_helpers.sql', '090c_wm_make_q.sql', '090d_wm_styles.sql', '090e_wm_build_session.sql', '090f_wm_session.sql',
  '090g_wm_assign.sql', '090h_wm_student.sql', '090i_wm_apply.sql', '090j_wm_answer.sql', '090k_wm_views.sql', '090l_wm_student_links.sql', '090m_wm_grants.sql',
  // 096: 프로젝트(큰 범위)·새 방식·학생별 조정 — 090 위에 더한다
  '096a_wm_project_tables.sql', '096b_wm_assign_big.sql', '096c_wm_session_override.sql', '096d_wm_make_q_more.sql', '096e_wm_pick_styles_more.sql',
  '096f_wm_briefing.sql', '096g_wm_steps.sql', '096h_wm_progress.sql',
];

const EXTRA = `
alter table public.students add column if not exists archived_at timestamptz;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public
  as $$ select coalesce((select role in ('owner','teacher') from public.profiles where id = auth.uid()), false) $$;
create table public.student_sessions (token uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade, expires_at timestamptz not null default now() + interval '90 days');
create or replace function public.student_session_student(p_token uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid; begin select student_id into v from public.student_sessions where token = p_token and expires_at > now(); if v is null then raise exception 'expired'; end if; return v; end $$;
`;

export async function makeWmDb() {
  const db = await makeDb([]);
  await db.exec(EXTRA);
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { SUPABASE_DIR } = await import('./lib.mjs');
  for (const f of WM_FILES) {
    try {
      await db.exec(readFileSync(join(SUPABASE_DIR, f), 'utf8'));
    } catch (e) {
      throw new Error(`${f}: ${e.message}`);
    }
  }
  return db;
}

/** 한국 시간 기준 날짜(YYYY-MM-DD) 낮 12시로 시각을 맞춘다 */
export const setDay = (db, ymd, hour = 12) => db.exec(`select set_config('app.wm_now', '${ymd}T${String(hour).padStart(2, '0')}:00:00+09:00', false)`);
