import type { CourseUnit } from '../data/phonicsLessons';
import { PHONICS_UNITS } from '../data/phonicsCurriculum';
import { resolveWorkbookSelection, workbookOfMaterial } from '../data/cvcWorkbook';
import { PHONICS_GAMES, gameAvailability, phonicsGameUnits, type PhonicsGame } from './phonicsGames';
import type { FullCardItem, LessonSlide, PhonicsGameSlide } from './types';

/** 수업 슬라이드로 쓰는 파닉스 게임 도우미 — 어떤 유닛으로 열지 정하고, 그 유닛에서 할 수 있는지 알려 준다. */
let cached: CourseUnit[] | null = null;
export const lessonPhonicsUnits = (): CourseUnit[] => (cached ??= phonicsGameUnits());
export const phonicsGameOf = (id?: string): PhonicsGame | undefined => PHONICS_GAMES.find(game => game.id === id);

const norm = (word: string) => word.trim().toLowerCase();

/** 수업 단어가 가장 많이 겹치는 유닛(두 낱말 이상, 수업 단어의 절반 이상일 때만). 없으면 null. */
export function matchUnitForWords(cards: readonly Pick<FullCardItem, 'word'>[], units: readonly CourseUnit[] = lessonPhonicsUnits()): CourseUnit | null {
  const words = new Set(cards.map(card => norm(card.word)).filter(Boolean));
  if (words.size < 2) return null;
  let best: CourseUnit | null = null;
  let bestHits = 0;
  let tied = false;
  for (const unit of units) {
    const hits = new Set(unit.entries.map(entry => norm(entry.word)).filter(word => words.has(word))).size;
    if (hits > bestHits) { best = unit; bestHits = hits; tied = false; }
    else if (hits > 0 && hits === bestHits) tied = true;
  }
  return best && !tied && bestHits >= 2 && bestHits * 2 >= words.size ? best : null;
}

/** 이 게임을 열 수 있는 단계의 유닛 */
export const unitsForGame = (game: PhonicsGame, units: readonly CourseUnit[] = lessonPhonicsUnits()) =>
  units.filter(unit => game.stages.includes(unit.step));

/** A selected workbook provides stronger evidence than spelling overlap with a general word list. */
export function lessonPhonicsTopic(slides: LessonSlide[], game: PhonicsGameSlide) {
  const index = slides.findIndex(slide => slide.id === game.id);
  const workbooks = slides.flatMap((slide, position) => {
    if (slide.kind !== 'material') return [];
    const courseUnit = slide.phonicsStage1 && lessonPhonicsUnits().find(unit => unit.id === slide.phonicsStage1?.unitId);
    const book = workbookOfMaterial(slide.materialId);
    const refs = slide.phonicsStage1 ? [slide.phonicsStage1.unitId]
      : book ? resolveWorkbookSelection(book.id, slide).units.map(unit => unit.id) : slide.phonicsUnitIds ?? [];
    const selected = PHONICS_UNITS.filter(unit => refs.includes(unit.id));
    return courseUnit || selected.length ? [{ position, selected, courseUnit }] : [];
  });
  const workbook = workbooks.findLast(w => w.position < index) ?? (workbooks.length === 1 ? workbooks[0] : undefined);
  if (!workbook) return workbooks.length ? null : undefined;
  if (workbook.courseUnit) return workbook.courseUnit;
  const [first] = workbook.selected;
  if (!workbook.selected.every(unit => unit.step === first.step)) return null;
  const rules = new Set(workbook.selected.map(unit => unit.ruleId));
  const candidates = lessonPhonicsUnits().filter(unit => unit.step === first.step && [...rules].every(rule => unit.groups.some(group => group.ruleId === rule)));
  return matchUnitForWords(workbook.selected.flatMap(unit => unit.entries), candidates);
}

export interface PhonicsSlideState {
  game?: PhonicsGame;
  unit?: CourseUnit;
  /** 이 유닛에서 못 하는 이유(없으면 바로 할 수 있다) */
  reason: string | null;
  /** 수업 단어와 맞는 유닛으로 열린다 */
  linked: boolean;
}

/** 슬라이드(또는 블록 카드)가 어떤 유닛으로 열리고 그 유닛에서 할 수 있는지 */
export function phonicsSlideState(gameId: string | undefined, unitId: string | undefined, cards: readonly Pick<FullCardItem, 'word'>[], en = false, units: readonly CourseUnit[] = lessonPhonicsUnits(), topic?: CourseUnit | null): PhonicsSlideState {
  const game = phonicsGameOf(gameId);
  if (!game) return { reason: null, linked: false };
  const chosen = unitId ? units.find(unit => unit.id === unitId) : undefined;
  const matched = unitId ? null : topic === undefined ? matchUnitForWords(cards, units) : topic;
  const unit = chosen ?? matched ?? undefined;
  const reason = unit ? gameAvailability(game, unit, en) : (en ? 'Choose a phonics unit for this game.' : '이 게임에서 연습할 파닉스 유닛을 골라 주세요.');
  return { game, unit, reason, linked: !!matched && !reason };
}

export function phonicsLessonOptions(slide?: Pick<PhonicsGameSlide, 'rounds' | 'teams' | 'level'>) {
  return {
    rounds: slide?.rounds === 3 || slide?.rounds === 10 ? slide.rounds : 6,
    teams: slide?.teams === 2 || slide?.teams === 3 || slide?.teams === 4 ? slide.teams : 1,
    level: slide?.level === 'easy' || slide?.level === 'hard' ? slide.level : 'normal',
  } as const;
}
