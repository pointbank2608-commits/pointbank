import { ADVENTURE_TYPES, adventureErrors, type AdventureType } from './adventureGames';
import type { GameTemplate, GameType } from './types';
import { storyErrors } from './storybook';
import { GAME_CATALOG } from './gameCatalog';
import { isLiveQuestionReady } from './liveQuiz';
import { asSentenceSlot, DEFAULT_WATERMELON_PATTERN_ID, getSentencePattern } from './sentencePatterns';

/** UI capabilities, not game rules. Native scoring/turn engines retain ownership. */
const BUILTIN = new Set<GameType>(['sentencerocket','grammardetective','treasurehunt','wordclaw','sentencebridge','sentencetower','timer','airport','restaurant','icecream','doctor','shopping','mathgen','labeleddiagram','watermelon']);
const SENTENCES = new Set<GameType>(['wordtrain','unscramble','sentencesplash']);
const BOTH = new Set<GameType>(['wheel','flashcards','typeanswer','lastbox','mysterybox','treasuredig','shufflefind','telepathy','catchsentence','lightning']);
const MANUAL_TURNS = new Set<GameType>(['wheel','ladder','order','bomb','findmissing','passball','flashcards','anagram','groupsort','unscramble','spellword','rankorder','labeleddiagram','imagequiz','quiz','truefalse']);
export function gamePreparation(type: GameType) {
  return {
    kinds: type==='grammardetective'?['sentence'] as const:BUILTIN.has(type) ? [] : BOTH.has(type) ? ['word','sentence'] as const : SENTENCES.has(type) ? ['sentence'] as const : ['word'] as const,
    manualTurns: MANUAL_TURNS.has(type),
    realtime: type === 'quizshow',
    dedicated: (ADVENTURE_TYPES as readonly string[]).includes(type) || BUILTIN.has(type) || ['feedmonster','sentencebridge','sentencetower'].includes(type),
  };
}

/** Counts describe the native configuration, not unfiltered source rows. */
export function gameReadyDetails(template: GameTemplate) {
  const { game_type: type, config: c, items } = template;
  const questions = ['quiz','gameshowquiz','winlosequiz'].includes(type) ? c.questions : type==='truefalse' ? c.statements : type==='quizshow' ? c.liveQuestions : type==='typeanswer' ? c.typeAnswerEntries : type==='imagequiz' ? c.imageQuizItems : undefined;
  const pairs = ['matchup','whackamole'].includes(type) ? c.pairs : type==='flashcards' ? c.flashcards : undefined;
  const intrinsic = [...ADVENTURE_TYPES,'timer','airport','restaurant','doctor','icecream','shopping','mathgen','feedmonster','sentencebridge','sentencetower'].includes(type);
  const count = intrinsic ? null : questions ? questions.length : pairs ? pairs.length : type==='labeleddiagram' ? c.diagramPins?.length || 0 : type==='groupsort' ? c.groups?.reduce((n,g)=>n+g.items.length,0) || 0 : items.length;
  const kind = questions ? 'questions' : type === 'timer' ? 'participants' : SENTENCES.has(type) || c.classroomSource?.kind === 'sentence' ? 'sentences' : 'items';
  const configuredTeams = ({catchsentence:c.catchTeams,treasuredig:c.digTeams,fourclues:c.clueTeams,lastbox:c.boxTeams,mysterybox:c.boxTeams,shufflefind:c.shuffleTeams,telepathy:c.telepathyTeams} as Partial<Record<GameType,number>>)[type];
  const teams = configuredTeams || (['tictactoe','connect4','baskin31','gameshowquiz','winlosequiz'].includes(type) ? 2 : type === 'saveorgive' && c.saveOrGiveMode !== 'individual' ? c.saveOrGiveTeamCount || 2 : null);
  return { count, kind, teams };
}

/** Validate the native config as well as converted sources before entering focus mode. */
export function isNativeGameReady(template: GameTemplate): boolean {
  const { game_type: type, config: c, items } = template;
  if ((ADVENTURE_TYPES as readonly string[]).includes(type)) return !!c.adventure && adventureErrors(type as AdventureType,c.adventure).length===0;
  if (type === 'feedmonster' || type === 'sentencebridge' || type === 'sentencetower') return !!c.storybook && storyErrors(type, c.storybook).length === 0;
  if (type === 'labeleddiagram') return !!c.diagramImageUrl && !!c.diagramPins?.some(pin => pin.label.trim());
  if (type === 'mathgen') return c.mathOperations === undefined || c.mathOperations.length > 0;
  if (type === 'watermelon') {
    const slots = getSentencePattern(c.watermelonPatternId || DEFAULT_WATERMELON_PATTERN_ID).slots;
    return items.some(item => item.label.trim() && slots.includes(asSentenceSlot(item.slot)!));
  }
  if (type === 'shopping') return c.shopScene !== 'words' || !!c.shopItems?.some(item => item.imageUrl && item.answer.trim());
  if (['timer','airport','restaurant','icecream','doctor'].includes(type)) return true;
  if (['matchup','whackamole'].includes(type)) return !!c.pairs && c.pairs.length >= 2 && c.pairs.every(p => p.left.trim() && p.right.trim());
  if (type === 'flashcards') return !!c.flashcards?.length && c.flashcards.every(p => p.left.trim() && p.right.trim());
  if (type === 'typeanswer') return !!c.typeAnswerEntries?.length && c.typeAnswerEntries.every(p => p.prompt.trim() && p.answer.trim());
  if (['quiz','gameshowquiz','winlosequiz'].includes(type)) return !!c.questions?.length && c.questions.every(q => q.question.trim() && q.choices.filter(v => v.trim()).length >= 2 && q.choices[q.correctIndex]?.trim());
  if (type === 'truefalse') return !!c.statements?.length && c.statements.every(s => s.text.trim());
  if (type === 'quizshow') return !!c.liveQuestions?.length && c.liveQuestions.every(isLiveQuestionReady);
  if (type === 'groupsort') return (c.groups?.filter(g => g.name.trim() && g.items.some(i => i.text.trim())).length || 0) >= 2;
  if (type === 'imagequiz') return !!c.imageQuizItems?.length && c.imageQuizItems.every(i => i.imageUrl && i.answer.trim());
  if (type === 'unscramble' || type === 'sentencesplash') return items.some(i => i.label.trim().split(/\s+/u).length >= 2);
  const minimum = GAME_CATALOG.find(g => g.type === type)?.minItems || 1;
  return items.filter(i => i.label.trim()).length >= minimum;
}
