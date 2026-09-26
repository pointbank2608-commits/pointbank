import { createCurriculumLesson, createGameTemplate, createWordList, fetchGameTemplateById } from './api';
import { effectiveSlides } from './lessonSlides';
import type { CurriculumLesson, LessonSlide, WordList } from './types';

/**
 * 수업을 다른 반으로 복사한다(2026-09-26) — 복사한 뒤엔 서로 영향 없이 따로 고친다.
 *
 * 그냥 행만 복사하면 A반 전용 자료가 B반에서 안 보이므로 함께 복사한다:
 *  - 단어장: A반 전용이면 B반에 같은 이름·단어로 새로 만든다(학원 공용·B반 것이면 그대로 연결).
 *  - 게임 슬라이드의 게임 내용(game_templates): A반 전용이면 B반 것으로 복사해 새 id 로 바꾼다.
 * 이미지·영상·문법·노래·지문·직접 만들기·자료실 슬라이드는 내용이 슬라이드 안에 있어 그대로 복사된다.
 */
export async function copyLessonToClass(params: {
  lesson: CurriculumLesson;
  targetClassId: string;
  academyId: string;
  teacherId: string;
  /** 지금 보고 있는 반의 단어장 목록(수업이 쓰는 단어장을 찾는 데 쓴다) */
  wordLists: WordList[];
}): Promise<CurriculumLesson> {
  const { lesson, targetClassId, academyId, teacherId, wordLists } = params;

  // 1) 단어장
  let wordListId = lesson.word_list_id;
  const wordList = wordLists.find((wl) => wl.id === lesson.word_list_id);
  if (wordList && wordList.class_id && wordList.class_id !== targetClassId) {
    const copy = await createWordList({
      academyId,
      classId: targetClassId,
      name: wordList.name,
      items: wordList.items,
      teacherId,
    });
    wordListId = copy.id;
  }

  // 2) 게임 내용 — 같은 템플릿을 여러 슬라이드가 쓰면 한 번만 복사
  const templateMap = new Map<string, string>();
  const slides: LessonSlide[] = [];
  for (const slide of effectiveSlides(lesson)) {
    if (slide.kind !== 'game' || !slide.templateId) {
      slides.push({ ...slide, id: crypto.randomUUID() });
      continue;
    }
    let newId = templateMap.get(slide.templateId);
    if (!newId) {
      try {
        const tpl = await fetchGameTemplateById(slide.templateId);
        if (!tpl.class_id || tpl.class_id === targetClassId) {
          newId = tpl.id; // 학원 공용이거나 이미 그 반 것 → 그대로
        } else {
          const copy = await createGameTemplate({
            academyId,
            classId: targetClassId,
            gameType: tpl.game_type,
            name: tpl.name,
            items: tpl.items,
            config: tpl.config,
            teacherId,
          });
          newId = copy.id;
        }
      } catch {
        newId = undefined; // 지워진 게임 내용 — 저장할 때처럼 단어장으로 다시 만들 수 있게 비워 둔다
      }
      if (newId) templateMap.set(slide.templateId, newId);
    }
    slides.push({ ...slide, id: crypto.randomUUID(), templateId: newId });
  }

  // 3) 수업
  return createCurriculumLesson({
    academyId,
    classId: targetClassId,
    name: lesson.name,
    wordListId,
    videoUrl: null,
    level: lesson.level,
    playlist: slides,
    teacherId,
  });
}
