export interface GrammarExample {
  sentence: string;
  translation: string;
  chunks: { text: string; role: string; term?: string }[];
  why: string;
}

export interface GrammarItem {
  id: string;
  sentence: string;
  prompt: string;
  options: { id: string; text: string }[];
  written?: boolean;
}

interface AuthoredItem extends GrammarItem {
  options: { id: string; text: string; feedback: string }[];
  correctOptionId: string;
}

export type GrammarAdaptiveItem = AuthoredItem | (GrammarItem & { answerText: string; feedback: string });

export interface GrammarLesson {
  goalId: string;
  grammarIds: string[];
  version: number;
  title: string;
  objective: string;
  rule: string;
  boundary: string;
  examples: GrammarExample[];
  reasoning: AuthoredItem;
  repair: { explanation: string; example: GrammarExample; practice: AuthoredItem };
  transfer: AuthoredItem;
  delayed: AuthoredItem;
  adaptive?: Record<GrammarQuestionPhase, GrammarAdaptiveItem[]>;
}

export type GrammarQuestionPhase = 'reasoning' | 'practice' | 'transfer' | 'delayed';

export type GrammarBlockStep =
  | { phase: 'explain'; objective: string; rule: string; boundary: string; examples: GrammarExample[] }
  | { phase: 'repair'; explanation: string; example: GrammarExample }
  | { phase: GrammarQuestionPhase; item: GrammarItem };

export interface GrammarBlockFeedback {
  correct: boolean;
  explanation: string;
}

export type GrammarBlockAction = { type: 'continue' } | { type: 'answer'; itemId: string; optionId: string };

function itemAt(lesson: GrammarLesson, phase: GrammarQuestionPhase): AuthoredItem {
  return phase === 'practice' ? lesson.repair.practice : lesson[phase];
}

/** Project the one visible step. Keep the authored answer key and feedback server side for assignments. */
export function grammarBlockStep(lesson: GrammarLesson, phase: GrammarBlockStep['phase']): GrammarBlockStep {
  if (phase === 'explain') {
    const { objective, rule, boundary, examples } = lesson;
    return { phase, objective, rule, boundary, examples };
  }
  if (phase === 'repair') {
    const { explanation, example } = lesson.repair;
    return { phase, explanation, example };
  }
  return grammarQuestionStep(phase, itemAt(lesson, phase));
}

export function grammarQuestionStep(phase: GrammarQuestionPhase, item: GrammarAdaptiveItem): GrammarBlockStep {
  const { id, sentence, prompt, options } = item;
  return { phase, item: { id, sentence, prompt, written: 'answerText' in item, options: options.map(({ id, text }) => ({ id, text })) } };
}

export function gradeGrammarPreview(item: GrammarAdaptiveItem, response: string): GrammarBlockFeedback | undefined {
  if ('answerText' in item) {
    const normalize = (value: string) => value.replace(/[‘’]/g, "'").trim().replace(/\s+/g, ' ').toLowerCase();
    return { correct: normalize(response) === normalize(item.answerText), explanation: item.feedback };
  }
  const option = item.options.find(({ id }) => id === response);
  return option && { correct: option.id === item.correctOptionId, explanation: option.feedback };
}

export type GrammarPreviewPhase = GrammarBlockStep['phase'] | 'waiting' | 'finished';

/** Teacher preview only. Assigned sessions must persist and grade the transition on the server. */
export function advanceGrammarPreview(lesson: GrammarLesson, phase: GrammarPreviewPhase, action: GrammarBlockAction):
  { phase: GrammarPreviewPhase; feedback?: GrammarBlockFeedback } | null {
  if (phase === 'finished') return null;
  if (phase === 'explain' || phase === 'repair' || phase === 'waiting') {
    if (action.type !== 'continue') return null;
    return { phase: { explain: 'reasoning', repair: 'practice', waiting: 'delayed' }[phase] as GrammarPreviewPhase };
  }
  if (action.type !== 'answer') return null;
  const item = itemAt(lesson, phase);
  const feedback = gradeGrammarPreview(item, action.optionId);
  if (action.itemId !== item.id || !feedback) return null;
  const { correct } = feedback;
  const next = {
    reasoning: correct ? 'transfer' : 'repair',
    practice: 'transfer',
    transfer: 'waiting',
    delayed: 'finished',
  } as const;
  return { phase: next[phase], feedback };
}
