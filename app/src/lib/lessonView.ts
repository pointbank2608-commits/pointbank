import { supabase } from './supabase';
import type { FullCardItem, LessonSlide } from './types';

/**
 * 학생 따라보기(온라인·줌 수업, 2026-09-27) — supabase/030_lesson_share_and_view.sql 의 lesson_views.
 * 선생님(발표 중)이 링크를 켜면 수업 묶음을 올려 두고, 슬라이드를 넘길 때마다 지금 슬라이드·단계를 알린다
 * (방송 신호로 바로 + DB 에도 적어 두어 늦게 들어온 학생·끊겼던 학생이 따라잡는다).
 * 학생(/watch/:code)은 로그인 없이 lesson_view_get(처음 한 번)·lesson_view_state(자주)로 읽는다.
 */
export interface LessonViewSnapshot {
  slides: LessonSlide[];
  words: FullCardItem[];
}

export interface LessonViewState {
  slide_id: string | null;
  sub: Record<string, unknown> | null;
  ended: boolean;
}

export function lessonViewChannel(code: string): string {
  return `lesson-view-${code}`;
}

export function lessonViewUrl(code: string): string {
  return `${window.location.origin}/watch/${code}`;
}

export async function lessonViewCreate(title: string, snapshot: LessonViewSnapshot, slideId: string | null): Promise<{ id: string; code: string }> {
  const { data, error } = await supabase.rpc('lesson_view_host_create', { p_title: title, p_snapshot: snapshot, p_slide_id: slideId });
  if (error) throw error;
  const row = data as { id: string; code: string };
  return { id: row.id, code: row.code };
}

export async function lessonViewUpdate(id: string, slideId: string | null, sub: Record<string, unknown> | null): Promise<void> {
  await supabase.from('lesson_views').update({ slide_id: slideId, sub, updated_at: new Date().toISOString() }).eq('id', id);
}

export async function lessonViewEnd(id: string): Promise<void> {
  await supabase.from('lesson_views').update({ ended_at: new Date().toISOString() }).eq('id', id);
}

export async function lessonViewGet(code: string): Promise<(LessonViewState & { title: string; snapshot: LessonViewSnapshot }) | null> {
  const { data, error } = await supabase.rpc('lesson_view_get', { p_code: code });
  if (error) throw error;
  return (data as (LessonViewState & { title: string; snapshot: LessonViewSnapshot }) | null) ?? null;
}

export async function lessonViewState(code: string): Promise<LessonViewState | null> {
  const { data, error } = await supabase.rpc('lesson_view_state', { p_code: code });
  if (error) throw error;
  return (data as LessonViewState | null) ?? null;
}
