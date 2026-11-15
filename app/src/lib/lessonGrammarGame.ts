import { grammarPoint } from './grammar';
import { GRAMMAR_GAME_TYPES, type GrammarGameType } from './grammarGames';
import { grammarGameSupport, MIN_ROUNDS } from './grammarGamesB';
import type { GameSlide, GameType, LessonSlide } from './types';

export function isGrammarRuleGame(type: GameType): type is GrammarGameType {
  return (GRAMMAR_GAME_TYPES as readonly string[]).includes(type);
}

export function grammarRuleContent(type: GameType, grammarId: string | null | undefined) {
  if (!grammarId || !isGrammarRuleGame(type)) return null;
  const point = grammarPoint(grammarId);
  if (!point || grammarGameSupport(grammarId)[type] < MIN_ROUNDS[type]) return null;
  return { items: [{ id: `grammar-${grammarId}`, label: point.name }], config: { grammarId } };
}

/** Use the preceding teaching block, or the only topic when the game precedes it. */
export function lessonGrammarTopic(slides: LessonSlide[], game: GameSlide): string | null {
  if (!isGrammarRuleGame(game.gameType)) return null;
  const index = slides.findIndex(slide => slide.id === game.id);
  const previous = index < 0 ? undefined : slides.slice(0, index).findLast(slide => slide.kind === 'grammar' && slide.grammarId);
  if (previous?.kind === 'grammar') return previous.grammarId;
  const topics = new Set(slides.flatMap(slide => slide.kind === 'grammar' && slide.grammarId ? [slide.grammarId] : []));
  return topics.size === 1 ? [...topics][0] : null;
}
