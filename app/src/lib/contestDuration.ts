import { isLiveQuestionReady, roundTypeOf } from './liveQuiz';
import type { LiveQuestion } from './types';

/** Planning allowance: full answer timer + 10s checking, plus 10s per round intro.
 * Buzzer rounds have no answer timer, so allow 30s for answering/judging.
 * Student joining is excluded. This is an estimate, not an elapsed-time promise.
 */
export function estimateContestDuration(questions: LiveQuestion[]): { count: number; seconds: number } {
  const ready = questions.filter(isLiveQuestionReady);
  const rounds = new Set(ready.map(q => q.round?.trim() || roundTypeOf(q)));
  const seconds = ready.reduce((total, q) => total + 10 + (q.kind === 'buzzer' ? 30
    : Number.isFinite(q.seconds) ? Math.max(5, q.seconds!) : 20), 0) + rounds.size * 10;
  return { count: ready.length, seconds };
}
