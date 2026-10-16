import { createClass, createCurriculumLesson, createWordList, setClassSchedule } from './api';
import { LESSON_SETS, lessonSetName, pickSetWords } from './lessonSets';
import { loadWordBank } from './wordBankCache';
import type { LessonSlide } from './types';

const uid = () => crypto.randomUUID();

/**
 * 가입 직후 "샘플 반 + 샘플 수업"을 만들어 둔다(첫 수업 1분 체험). 오늘 요일 15:30 수업으로 적어서
 * 오늘 화면에 바로 "▶ 시작" 카드가 뜬다. 실패해도 가입 흐름은 막지 않는다(호출부가 try/catch).
 */
export async function createSampleStarter(academyId: string, teacherId: string, lang: string): Promise<void> {
  const set = LESSON_SETS.find((s) => s.kind === 'word');
  if (!set) return;
  const cards = pickSetWords(set, await loadWordBank());
  if (cards.length < 5) return;
  const ko = lang.startsWith('ko');
  const cls = await createClass(academyId, ko ? '샘플 반' : 'Sample class', 0);
  const listName = lessonSetName(set, lang);
  const list = await createWordList({
    academyId,
    classId: cls.id,
    name: listName,
    items: cards.map((w) => ({
      id: uid(),
      word: w.word,
      meaning: w.meaning,
      image_url: w.imageUrl,
      category: w.category ?? null,
      partOfSpeech: w.partOfSpeech ?? null,
      patternMarked: w.patternMarked ?? null,
    })),
    teacherId,
  });
  const slides: LessonSlide[] = [
    { id: uid(), kind: 'attendance', boardTheme: 'green' },
    { id: uid(), kind: 'wordshow', boardTheme: 'green' },
    { id: uid(), kind: 'study' },
  ];
  await createCurriculumLesson({
    academyId,
    classId: cls.id,
    name: ko ? `샘플 수업 · ${listName}` : `Sample lesson · ${listName}`,
    wordListId: list.id,
    videoUrl: null,
    level: null,
    playlist: slides,
    teacherId,
  });
  await setClassSchedule(cls.id, { days: [new Date().getDay()], time: '15:30', minutes: 20 });
}
