import { createGameTemplate } from './api';
import { buildGameContent, canBuildFromWords, lessonGameTemplateName } from './gameFromWords';
import type { FullCardItem, GameType, LessonSlide, WordBankEntry } from './types';

/** 질문 3개 수업 만들기 — 규칙 기반(AI 없음)으로 "분"에 맞는 수업 구성을 만든다. */
export type QuickMinutes = 20 | 40 | 50;
export type QuickSlot = 'warmup' | 'learn' | 'practice' | 'team' | 'wrapup' | 'sheet';

export interface QuickRow {
  slot: QuickSlot;
  minutes: number;
  /** learn·sheet 은 games 가 비어 있다 */
  games: GameType[];
}

/** 칸마다 "바꾸기"로 고를 수 있는 게임(단어장만으로 내용이 만들어지는 것) */
export const QUICK_ALTERNATIVES: Record<'warmup' | 'practice' | 'team' | 'wrapup', GameType[]> = {
  warmup: ['wheel', 'order', 'bomb', 'ladder'],
  practice: ['matchup', 'whackamole', 'anagram', 'hangman', 'typeanswer', 'flashcards'],
  team: ['tictactoe', 'connect4', 'twodice', 'baskin31'],
  wrapup: ['quiz', 'truefalse', 'imagequiz'],
};

export function planQuickLesson(minutes: QuickMinutes): QuickRow[] {
  if (minutes === 20) {
    return [
      { slot: 'warmup', minutes: 3, games: ['wheel'] },
      { slot: 'learn', minutes: 5, games: [] },
      { slot: 'practice', minutes: 7, games: ['matchup'] },
      { slot: 'wrapup', minutes: 5, games: ['quiz'] },
    ];
  }
  if (minutes === 40) {
    return [
      { slot: 'warmup', minutes: 3, games: ['wheel'] },
      { slot: 'learn', minutes: 7, games: [] },
      { slot: 'practice', minutes: 12, games: ['matchup', 'whackamole'] },
      { slot: 'team', minutes: 8, games: ['tictactoe'] },
      { slot: 'wrapup', minutes: 5, games: ['quiz'] },
      { slot: 'sheet', minutes: 5, games: [] },
    ];
  }
  return [
    { slot: 'warmup', minutes: 5, games: ['wheel', 'bomb'] },
    { slot: 'learn', minutes: 8, games: [] },
    { slot: 'practice', minutes: 15, games: ['matchup', 'whackamole', 'anagram'] },
    { slot: 'team', minutes: 10, games: ['tictactoe', 'connect4'] },
    { slot: 'wrapup', minutes: 7, games: ['quiz', 'truefalse'] },
    { slot: 'sheet', minutes: 5, games: [] },
  ];
}

/** 칸의 게임 하나를 같은 칸의 다음 후보로 바꾼다(이미 쓴 게임은 건너뜀) */
export function swapQuickGame(row: QuickRow, index: number): QuickRow {
  if (row.slot === 'learn' || row.slot === 'sheet') return row;
  const pool = QUICK_ALTERNATIVES[row.slot].filter((g) => canBuildFromWords(g));
  const current = row.games[index];
  const start = pool.indexOf(current);
  for (let step = 1; step <= pool.length; step += 1) {
    const next = pool[(start + step) % pool.length];
    if (!row.games.includes(next)) {
      const games = [...row.games];
      games[index] = next;
      return { ...row, games };
    }
  }
  return row;
}

const uid = () => crypto.randomUUID();

/** 계획을 슬라이드로: 맨 앞 출석 → 칸 순서대로 */
export function quickRowsToSlides(rows: QuickRow[]): LessonSlide[] {
  const slides: LessonSlide[] = [{ id: uid(), kind: 'attendance', boardTheme: 'green' }];
  for (const row of rows) {
    if (row.slot === 'learn') {
      slides.push({ id: uid(), kind: 'wordshow', boardTheme: 'green' }, { id: uid(), kind: 'study' });
    } else if (row.slot === 'sheet') {
      slides.push({ id: uid(), kind: 'material', materialId: 'worksheet', worksheetTab: 'match', boardTheme: 'whiteboard' });
    } else {
      for (const g of row.games) slides.push({ id: uid(), kind: 'game', gameType: g });
    }
  }
  return slides;
}

/** 게임 슬라이드마다 단어장으로 게임 내용(템플릿)을 만들어 붙인다(내용을 만들 수 없는 게임은 그대로) */
export async function attachQuickGames(params: {
  slides: LessonSlide[];
  cards: FullCardItem[];
  academyId: string;
  classId: string;
  teacherId: string;
  lessonName: string;
  listName: string;
}): Promise<LessonSlide[]> {
  const out: LessonSlide[] = [];
  for (const slide of params.slides) {
    if (slide.kind !== 'game' || slide.templateId) {
      out.push(slide);
      continue;
    }
    const content = buildGameContent(slide.gameType, params.cards);
    if (!content) {
      out.push(slide);
      continue;
    }
    const tpl = await createGameTemplate({
      academyId: params.academyId,
      classId: params.classId,
      gameType: slide.gameType,
      name: lessonGameTemplateName(params.lessonName, params.listName),
      items: content.items,
      config: content.config,
      teacherId: params.teacherId,
    });
    out.push({ ...slide, templateId: tpl.id });
  }
  return out;
}

/** 붙여넣은 교재 단어표를 카드로. 한 줄에 하나: "apple 사과", "apple - 사과", "apple, 사과", "apple\t사과", 영어만 써도 된다. */
export function parsePastedWords(text: string, bank: WordBankEntry[]): FullCardItem[] {
  const byWord = new Map<string, WordBankEntry>();
  for (const e of bank) {
    const k = e.word.trim().toLowerCase();
    if (!byWord.has(k)) byWord.set(k, e);
  }
  const seen = new Set<string>();
  const cards: FullCardItem[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, '').trim();
    if (!line) continue;
    const hangul = line.search(/[가-힣]/);
    let word: string;
    let meaning = '';
    if (hangul >= 0) {
      word = line.slice(0, hangul);
      meaning = line.slice(hangul).trim();
    } else {
      const parts = line.split(/\t|\s[-–=:|]\s|\s*[|=]\s*/);
      word = parts[0];
      meaning = parts.slice(1).join(' ').trim();
    }
    word = word.replace(/[\s\-–=:|,;·]+$/g, '').trim();
    if (!word || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    const hit = byWord.get(word.toLowerCase());
    cards.push({
      id: uid(),
      word,
      meaning: meaning || hit?.meaning || '',
      imageUrl: hit?.image_url ?? null,
      category: hit?.category ?? null,
      example: hit?.example_sentence ?? null,
      partOfSpeech: hit?.part_of_speech ?? null,
    });
  }
  return cards;
}
