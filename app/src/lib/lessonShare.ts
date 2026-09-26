import { createCurriculumLesson, createGameTemplate, createWordList, fetchGameTemplateById } from './api';
import { effectiveSlides } from './lessonSlides';
import { supabase } from './supabase';
import type { CurriculumLesson, GameItem, GameTemplateConfig, GameType, LessonSlide, WordList, WordListItem } from './types';

/**
 * 수업 공유 링크(2026-09-27) — supabase/030_lesson_share_and_view.sql 의 lesson_shares.
 * 링크를 만드는 순간의 수업을 한 묶음(snapshot)으로 저장한다: 슬라이드 + 수업 단어장 단어 + 게임 슬라이드가 쓰는
 * 게임 내용. 받은 선생님은 미리 본 뒤 "내 수업으로 가져오기"로 자기 학원·반에 새로 만든다(원본과 따로).
 * 학생 이름·출석·포인트는 묶음에 없다(슬라이드에 들어 있지 않고, 출석 체크 슬라이드는 받은 쪽 반으로 동작).
 * 올린 그림은 공개 저장소 주소라 그대로 보인다.
 */
export interface LessonShareSnapshot {
  version: 1;
  lesson: { name: string; level: string | null; slides: LessonSlide[] };
  wordList: { name: string; items: WordListItem[] } | null;
  templates: Record<string, { game_type: GameType; name: string; items: GameItem[]; config: GameTemplateConfig }>;
}

export interface LessonShareRow {
  id: string;
  token: string;
  title: string;
  created_at: string;
  revoked_at: string | null;
}

export function lessonShareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`;
}

export async function buildShareSnapshot(
  lesson: CurriculumLesson,
  wordList: WordList | null,
  opts: { dropReading: boolean },
): Promise<LessonShareSnapshot> {
  const slides = effectiveSlides(lesson).filter((s) => !(opts.dropReading && s.kind === 'reading'));
  const templates: LessonShareSnapshot['templates'] = {};
  for (const s of slides) {
    if (s.kind !== 'game' || !s.templateId || templates[s.templateId]) continue;
    try {
      const tpl = await fetchGameTemplateById(s.templateId);
      templates[s.templateId] = { game_type: tpl.game_type, name: tpl.name, items: tpl.items, config: tpl.config };
    } catch {
      /* 지워진 게임 내용 — 받은 쪽에서 저장할 때 단어장으로 다시 만든다 */
    }
  }
  return {
    version: 1,
    lesson: { name: lesson.name, level: lesson.level, slides },
    wordList: wordList ? { name: wordList.name, items: wordList.items } : null,
    templates,
  };
}

export async function createLessonShare(params: { academyId: string; lessonId: string; title: string; snapshot: LessonShareSnapshot }): Promise<LessonShareRow> {
  const { data, error } = await supabase
    .from('lesson_shares')
    .insert({ academy_id: params.academyId, lesson_id: params.lessonId, title: params.title, snapshot: params.snapshot })
    .select('id, token, title, created_at, revoked_at')
    .single();
  if (error) throw error;
  return data as LessonShareRow;
}

export async function fetchLessonShares(lessonId: string): Promise<LessonShareRow[]> {
  const { data, error } = await supabase
    .from('lesson_shares')
    .select('id, token, title, created_at, revoked_at')
    .eq('lesson_id', lessonId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LessonShareRow[];
}

export async function revokeLessonShare(id: string): Promise<void> {
  const { error } = await supabase.from('lesson_shares').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function fetchSharedLesson(
  token: string,
): Promise<{ title: string; snapshot: LessonShareSnapshot; academy_name: string; created_at: string } | null> {
  const { data, error } = await supabase.rpc('lesson_share_get', { p_token: token });
  if (error) throw error;
  return (data as { title: string; snapshot: LessonShareSnapshot; academy_name: string; created_at: string } | null) ?? null;
}

/** 받은 묶음으로 내 학원·반에 새 수업을 만든다(단어장·게임 내용도 새로, 슬라이드 id 도 새로). */
export async function importSharedLesson(
  snapshot: LessonShareSnapshot,
  params: { academyId: string; classId: string; teacherId: string },
): Promise<CurriculumLesson> {
  const { academyId, classId, teacherId } = params;
  let wordListId: string | null = null;
  if (snapshot.wordList && snapshot.wordList.items.length > 0) {
    const wl = await createWordList({ academyId, classId, name: snapshot.wordList.name, items: snapshot.wordList.items, teacherId });
    wordListId = wl.id;
  }
  const templateMap = new Map<string, string>();
  for (const [oldId, tpl] of Object.entries(snapshot.templates ?? {})) {
    try {
      const made = await createGameTemplate({
        academyId,
        classId,
        gameType: tpl.game_type,
        name: tpl.name,
        items: tpl.items,
        config: tpl.config,
        teacherId,
      });
      templateMap.set(oldId, made.id);
    } catch {
      /* 하나가 실패해도 수업은 가져온다 — 그 게임 슬라이드는 저장할 때 단어장으로 다시 만들 수 있다 */
    }
  }
  const slides: LessonSlide[] = snapshot.lesson.slides.map((s) =>
    s.kind === 'game'
      ? { ...s, id: crypto.randomUUID(), templateId: s.templateId ? templateMap.get(s.templateId) : undefined }
      : { ...s, id: crypto.randomUUID() },
  );
  return createCurriculumLesson({
    academyId,
    classId,
    name: snapshot.lesson.name,
    wordListId,
    videoUrl: null,
    level: snapshot.lesson.level,
    playlist: slides,
    teacherId,
  });
}
