import { buildGameContent, type GameContent } from './gameFromWords';
import { guideProblem } from './gameGuide';
import { classroomGameRequirement, isSentenceList, prepareClassroomGame } from './gameWorkspace';
import { grammarPoint, sentencesForUnscramble } from './grammar';
import { grammarRuleContent, isGrammarRuleGame, lessonGrammarTopic } from './lessonGrammarGame';
import { parseReadingText } from './readingLines';
import { parseShadowText } from './shadowLines';
import type { FullCardItem, GameSlide, LessonSlide, WordList } from './types';

type Sentence = { en: string; ko?: string };
const SENTENCE_ONLY = new Set(['unscramble', 'sentencesplash', 'wordtrain', 'grammardetective', 'sentencerocket']);

function slideSentences(slide: LessonSlide): Sentence[] {
  if (slide.kind === 'reading') return parseReadingText(slide.source);
  if (slide.kind === 'shadow') return parseShadowText(slide.source);
  if (slide.kind === 'drill') return [{ en: slide.sentence, ko: slide.sentenceKo }, ...slide.drills.map(d => ({ en: d.answer, ko: d.answerKo }))];
  if (slide.kind === 'grammar') {
    const point = grammarPoint(slide.grammarId);
    return point ? sentencesForUnscramble(point).map(en => ({ en })) : [];
  }
  return [];
}

export function lessonGameSources(slides: LessonSlide[], wordList: WordList | null, cards: FullCardItem[]) {
  const list = wordList?.items.some(item => item.word.trim()) ? wordList : null;
  const kind = list && isSentenceList(list) ? 'sentence' : 'word';
  const seen = new Set<string>();
  const sentences = slides.flatMap(slide => slideSentences(slide).flatMap((line, index) => {
    const word = line.en.replace(/\*\*/g, '').trim();
    const key = word.toLowerCase();
    if (word.split(/\s+/u).length < 2 || seen.has(key)) return [];
    seen.add(key);
    return [{ id: `${slide.id}:sentence:${index}`, word, meaning: line.ko ?? '', imageUrl: null }];
  }));
  return { kind, cards, sentences, wordList: list } as const;
}

export interface LessonGameMatch {
  content: GameContent | null;
  grammarId: string | null;
  hasGrammarSlide?: boolean;
  kind: 'grammar' | 'word' | 'sentence' | 'builtin';
  problem?: string | null;
}

/** Same conversion and native readiness check for the picker, editor, save, and presentation. */
export function resolveLessonGame(slide: GameSlide, slides: LessonSlide[], source: ReturnType<typeof lessonGameSources>): LessonGameMatch {
  const type = slide.gameType;
  const grammarId = lessonGrammarTopic(slides, slide);
  let problem: string | null = null;
  const ready = (content: GameContent | null) => {
    if (!content) return null;
    problem = guideProblem({ game_type: type, items: content.items, config: content.config ?? {} });
    return problem ? null : content;
  };
  if (isGrammarRuleGame(type)) return {
    content: grammarRuleContent(type, grammarId), grammarId, kind: 'grammar',
    hasGrammarSlide: slides.some(item => item.kind === 'grammar'),
  };

  const sentenceOnly = SENTENCE_ONLY.has(type);
  const sources = [
    ...(source.wordList || source.cards.length ? [{ kind: source.kind, cards: source.cards, list: source.wordList }] : []),
    ...(source.sentences.length ? [{ kind: 'sentence' as const, cards: source.sentences, list: null }] : []),
  ];
  if (sentenceOnly && source.kind === 'word') sources.reverse();
  for (const input of sources) {
    if (sentenceOnly && input.kind !== 'sentence') continue;
    const content = ready(prepareClassroomGame(type, input.cards, input.kind));
    if (content) {
      const list = input.list;
      return { content: list ? { ...content, config: { ...content.config, classroomSource: {
        id: list.id, name: list.name, version: list.updated_at, kind: input.kind, cards: input.cards,
      } } } : content, grammarId, kind: input.kind };
    }
  }
  if (['unscramble', 'sentencesplash'].includes(type) && source.kind === 'word') {
    const examples = source.cards.flatMap(card => card.example && card.example.trim().split(/\s+/u).length >= 2
      ? [{ ...card, word: card.example.trim(), meaning: '', imageUrl: null }] : []);
    const content = ready(prepareClassroomGame(type, examples, 'sentence'));
    if (content) return { content, grammarId, kind: 'sentence' };
  }
  // The built-in scripts and props are the game's own content, independent of lesson material.
  const builtIn = ['airport', 'doctor', 'icecream', 'restaurant', 'shopping', 'timer', 'mathgen'].includes(type);
  const builtinContent = builtIn && (buildGameContent(type, type === 'shopping' && source.kind === 'word' ? source.cards : []) ?? { items: [], config: {} });
  return { content: builtinContent ? ready(builtinContent) : null,
    grammarId, kind: builtIn ? 'builtin' : source.cards.length ? source.kind : source.sentences.length ? 'sentence' : source.kind, problem };
}

export function lessonGameRequirement(type: GameSlide['gameType'], match?: LessonGameMatch): { key: string; count?: number } {
  if (isGrammarRuleGame(type)) return { key: match?.grammarId ? 'lessonUx.gameUnsupportedGrammar' : 'lessonUx.gameNeedsGrammar' };
  if (match?.problem) return { key: `guide.${match.problem}` };
  if (SENTENCE_ONLY.has(type) && match?.kind !== 'sentence') return { key: 'lessonUx.needSentenceList' };
  return classroomGameRequirement(type, match?.kind === 'sentence' ? 'sentence' : 'word');
}
