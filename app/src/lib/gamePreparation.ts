import { ADVENTURE_TYPES, adventureErrors, type AdventureType } from './adventureGames';
import type { GameTemplate, GameType } from './types';
import { storyErrors } from './storybook';
import { GAME_CATALOG } from './gameCatalog';
import { isLiveQuestionReady } from './liveQuiz';
import { asSentenceSlot, DEFAULT_WATERMELON_PATTERN_ID, getSentencePattern } from './sentencePatterns';

import { pictureWordModeKind, pictureWordQuestions } from './pictureWordQuestions';
/** UI capabilities, not game rules. Native scoring/turn engines retain ownership. */
const BUILTIN = new Set<GameType>(['sentencerocket','grammardetective','treasurehunt','wordclaw','sentencebridge','sentencetower','timer','airport','restaurant','icecream','doctor','shopping','mathgen','labeleddiagram','watermelon']);
const SENTENCES = new Set<GameType>(['wordtrain','unscramble','sentencesplash']);
const BOTH = new Set<GameType>(['wheel','flashcards','typeanswer','lastbox','mysterybox','treasuredig','shufflefind','telepathy','catchsentence','lightning']);
const MANUAL_TURNS = new Set<GameType>(['wheel','ladder','order','bomb','timer','popcorn','findmissing','passball','flashcards','anagram','groupsort','unscramble','spellword','rankorder','labeleddiagram','imagequiz','quiz','truefalse']);
export function gamePreparation(type: GameType) {
  return {
    kinds: type==='grammardetective'||type==='sentencerocket'?['sentence'] as const:BUILTIN.has(type) ? [] : BOTH.has(type) ? ['word','sentence'] as const : SENTENCES.has(type) ? ['sentence'] as const : ['word'] as const,
    manualTurns: MANUAL_TURNS.has(type),
    realtime: type === 'quizshow',
    dedicated: (ADVENTURE_TYPES as readonly string[]).includes(type) || BUILTIN.has(type) || ['feedmonster','sentencebridge','sentencetower'].includes(type),
  };
}

/** Counts describe the native configuration, not unfiltered source rows. */
export function gameReadyDetails(template: GameTemplate) {
  const { game_type: type, config: c, items } = template;
  if (c.pictureWordMode && pictureWordModeKind(type)) return { count: pictureWordQuestions(c).length, kind: 'questions', teams: null };
  const questions = ['quiz','gameshowquiz','winlosequiz','tugofwar'].includes(type) ? c.questions : type==='truefalse' ? c.statements : type==='quizshow' ? c.liveQuestions : type==='typeanswer' ? c.typeAnswerEntries : type==='imagequiz' ? c.imageQuizItems : undefined;
  const pairs = ['matchup','whackamole','wordhoops'].includes(type) ? c.pairs : type==='flashcards' ? c.flashcards : undefined;
  const intrinsic = [...ADVENTURE_TYPES,'timer','airport','restaurant','doctor','icecream','shopping','mathgen','feedmonster','sentencebridge','sentencetower'].includes(type);
  const count = intrinsic ? null : questions ? questions.length : pairs ? pairs.length : type==='labeleddiagram' ? c.diagramPins?.length || 0 : type==='groupsort' ? c.groups?.reduce((n,g)=>n+g.items.length,0) || 0 : items.length;
  const kind = questions ? 'questions' : type === 'timer' ? 'participants' : SENTENCES.has(type) || c.classroomSource?.kind === 'sentence' ? 'sentences' : 'items';
  const configuredTeams = ({catchsentence:c.catchTeams,treasuredig:c.digTeams,fourclues:c.clueTeams,lastbox:c.boxTeams,mysterybox:c.boxTeams,shufflefind:c.shuffleTeams,telepathy:c.telepathyTeams,wordhoops:c.hoopsTeams ?? 2} as Partial<Record<GameType,number>>)[type];
  const teams = configuredTeams || (['tictactoe','connect4','baskin31','gameshowquiz','winlosequiz','tugofwar'].includes(type) ? 2 : type === 'saveorgive' && c.saveOrGiveMode !== 'individual' ? c.saveOrGiveTeamCount || 2 : null);
  return { count, kind, teams };
}

/** Validate the native config as well as converted sources before entering focus mode. */
export function isNativeGameReady(template: Pick<GameTemplate, 'game_type' | 'config' | 'items'>): boolean {
  const { game_type: type, config: c, items } = template;
  const pictureMode = c.pictureWordMode ? pictureWordModeKind(type) : null;
  if (pictureMode) {
    if (!pictureWordQuestions(c).length) return false;
    // A question between moves does not supply the pieces, teams or other data for the original board.
    if (pictureMode === 'native' || (type === 'mysterybox' && c.mysteryMode === 'quiz')) return true;
  }
  if ((ADVENTURE_TYPES as readonly string[]).includes(type)) return !!c.adventure && adventureErrors(type as AdventureType,c.adventure).length===0;
  if ((type === 'wordhoops' && c.hoopsMode === 'picture') || (type === 'tugofwar' && c.tugMode === 'picture')) {
    return pictureWordQuestions(c).length > 0;
  }
  if (type === 'feedmonster' || type === 'sentencebridge' || type === 'sentencetower') return !!c.storybook && storyErrors(type, c.storybook).length === 0;
  // 사진·핀이 없으면 샘플 그림으로 시작하므로 항상 시작할 수 있다.
  if (type === 'labeleddiagram') return true;
  if (type === 'mathgen') return c.mathOperations === undefined || c.mathOperations.length > 0;
  if (type === 'watermelon') {
    const slots = getSentencePattern(c.watermelonPatternId || DEFAULT_WATERMELON_PATTERN_ID).slots;
    return items.some(item => item.label.trim() && slots.includes(asSentenceSlot(item.slot)!));
  }
  if (type === 'shopping') return c.shopScene !== 'words' || !!c.shopItems?.some(item => item.imageUrl && item.answer.trim());
  if (['timer','airport','restaurant','icecream','doctor'].includes(type)) return true;
  if (['matchup','whackamole','wordhoops'].includes(type)) return !!c.pairs && c.pairs.length >= 2 && c.pairs.every(p => p.left.trim() && p.right.trim());
  if (type === 'flashcards') return !!c.flashcards?.length && c.flashcards.every(p => p.left.trim() && p.right.trim());
  if (type === 'typeanswer') return !!c.typeAnswerEntries?.length && c.typeAnswerEntries.every(p => p.prompt.trim() && p.answer.trim());
  if (['quiz','gameshowquiz','winlosequiz','tugofwar'].includes(type)) return !!c.questions?.length && c.questions.every(q => q.question.trim() && q.choices.filter(v => v.trim()).length >= 2 && q.choices[q.correctIndex]?.trim());
  if (type === 'truefalse') return !!c.statements?.length && c.statements.every(s => s.text.trim());
  if (type === 'quizshow') return !!c.liveQuestions?.length && c.liveQuestions.every(isLiveQuestionReady);
  if (type === 'groupsort') return (c.groups?.filter(g => g.name.trim() && g.items.some(i => i.text.trim())).length || 0) >= 2;
  if (type === 'imagequiz') return !!c.imageQuizItems?.length && c.imageQuizItems.every(i => i.imageUrl && i.answer.trim());
  if (type === 'unscramble' || type === 'sentencesplash') return items.some(i => i.label.trim().split(/\s+/u).length >= 2);
  const minimum = GAME_CATALOG.find(g => g.type === type)?.minItems || 1;
  return items.filter(i => i.label.trim()).length >= minimum;
}

/**
 * 들어오면 샘플로 바로 시작하고 위쪽 도구줄(내 단어/문장·반 설정·게임설정·저장/불러오기)을 쓰는 게임.
 * 전용 편집기가 큰 어드벤처·스토리 게임과 학생 폰 참여형 대회 퀴즈쇼는 예전 준비 흐름을 그대로 쓴다(C단계).
 */
const KEEP_OLD_FLOW = new Set<string>(['quizshow']);
/** 항목 목록을 늘 숨기는 게임(시한폭탄: 누가 걸릴지·읽을 내용이 미리 보이면 재미가 없다). 도구줄의 "항목 숨기기"도 잠긴다. */
/** 게임 안에 "지금 누구 차례" 표시가 따로 있는 경우(시한폭탄 참가자 순서대로) — 도구줄 차례 바를 숨겨 두 번 보이지 않게 한다. */
export const hasOwnTurnDisplay = (type: GameType, config?: { bombMode?: 'pass' | 'timer' }): boolean => type === 'timer' || type === 'popcorn' || (type === 'bomb' && (config?.bombMode ?? 'pass') === 'pass');
export const itemsAlwaysHidden = (type: GameType): boolean => type === 'bomb';
export const instantStart = (type: GameType): boolean => !KEEP_OLD_FLOW.has(type);

/** Navigation that supplies content or asks to edit it keeps the preparation step. */
export function isDirectGameEntry(state: unknown): boolean {
  return state == null || (typeof state === 'object' && Object.keys(state).length === 0);
}
