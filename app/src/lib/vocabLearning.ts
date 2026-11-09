import { learningPathRpc, type PathCard, type PathPractice } from './learningPaths';
import type { CueContext, CueMode, CueOutcome, CueTimetable, CueTimetableInput, EssentialCue } from './vocabCues';

export interface VocabFeedbackRow {
  student_id: string;
  student_name: string;
  goal_index: number;
  card: PathCard;
  first_correct: boolean | null;
  first_check_correct: boolean | null;
  independent_correct: boolean | null;
  practice_hint_used: boolean;
  review_correct: boolean | null;
  review_round: 1 | 2 | null;
  homework_id: string | null;
  homework_correct: boolean | null;
  homework_review_correct: boolean | null;
  homework_review_round: 1 | 2 | null;
  latest_correct: boolean | null;
}

export interface VocabDraft {
  id: string;
  kind: 'lesson' | 'homework';
  title: string;
  cards: PathCard[];
  students: string[];
  reason: 'practice' | 'check';
  games: boolean;
  cue?: { modes: CueMode[]; contexts: CueContext[] | null; contextual: boolean; essential?: EssentialCue[] };
}

export interface CueFeedbackRow {
  student_id: string;
  student_name: string;
  goal_index: number;
  card: PathCard;
  cues: Partial<Record<CueMode, CueOutcome>>;
  context_id: string | null;
  context_correct: boolean | null;
  ready: boolean;
  gap_count: number | null;
  verified_count: number | null;
}

interface VocabFeedback {
  lessons: { id: string; name: string; created_at: string }[];
  homework_enabled: boolean;
  rows: VocabFeedbackRow[];
  drafts: VocabDraft[];
  followups: { id: string; name: string; kind: VocabDraft['kind'] }[];
  cue_ready?: boolean;
  cue_lesson?: boolean;
  cue_rows?: CueFeedbackRow[];
  timetable?: CueTimetable | null;
}

export async function vocabFeedback(classId: string, lessonId: string | null = null) {
  const args = { p_class: classId, p_lesson: lessonId };
  try {
    const result = await learningPathRpc<VocabFeedback>('learning_vocab_cue_feedback', args);
    if (typeof result?.cue_ready === 'boolean') return result;
  } catch (error) {
    if (!(error instanceof Error && (error.message === 'path_not_ready' ||
      error.message.includes('permission denied for function learning_vocab_cue_feedback')))) throw error;
  }
  return learningPathRpc<VocabFeedback>('learning_vocab_feedback', args);
}

export const createVocabDraft = (lessonId: string, kind: VocabDraft['kind'], studentId: string | null, cues = false) =>
  learningPathRpc<VocabDraft | null>(cues ? 'learning_vocab_cue_draft' : 'learning_vocab_draft', { p_source: lessonId, p_kind: kind, p_student: studentId });

export const dismissVocabDraft = (id: string) =>
  learningPathRpc<void>('learning_vocab_dismiss', { p_draft: id });

export function approveVocab(input: {
  request: string;
  classId: string;
  students: string[];
  title: string;
  cards: PathCard[];
  practice: PathPractice;
  games: boolean;
  draft?: string;
  due?: string | null;
  cues?: { modes: CueMode[]; contexts?: CueContext[]; contextual?: boolean; timetable?: CueTimetableInput };
}) {
  const args = {
    p_request: input.request,
    p_class: input.classId,
    p_students: input.students,
    p_title: input.title,
    p_cards: input.cards,
    p_games: input.games,
    p_draft: input.draft ?? null,
    p_due: input.due ?? null,
  };
  if (input.cues) {
    const cueArgs = { ...args, p_modes: input.cues.modes, p_contexts: input.cues.contexts ?? null, p_contextual: input.cues.contextual ?? false };
    return learningPathRpc<{ lesson_id: string; duplicate: boolean }>(
      input.cues.timetable ? 'learning_vocab_cue_approve_scheduled' : 'learning_vocab_cue_approve',
      input.cues.timetable ? { ...cueArgs, p_timetable: input.cues.timetable } : cueArgs,
    );
  }
  return learningPathRpc<{ lesson_id: string; duplicate: boolean }>('learning_vocab_approve', { ...args, p_practice: input.practice });
}

export const needsVocabPractice = (row: VocabFeedbackRow) => row.independent_correct !== null &&
  (!row.homework_id || row.homework_correct !== null) && row.latest_correct === false;

export const canFollowUpVocab = (row: VocabFeedbackRow) => needsVocabPractice(row) ||
  (!row.homework_id && row.independent_correct !== null);
