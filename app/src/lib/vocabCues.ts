import { learningPathRpc } from './learningPaths';

export const cueModes = ['read', 'listen', 'spell'] as const;
export type CueMode = typeof cueModes[number];
export interface CueContext { word: string; meaning: string; sentence: string }
export interface EssentialCue { word: string; meaning: string; mode: CueMode }
export interface CueSchedule {
  revision: number;
  class_days: number[];
  review_days: number[];
  today: string;
  next_class_on: string | null;
  next_review_on: string | null;
}
export interface CueTimetableInput {
  revision: number;
  essential: EssentialCue[];
  next_class_on: string | null;
  opens_on: string | null;
}
export interface CueTimetable {
  review_days: number[] | null;
  focus_due_at: string | null;
  next_class_on: string | null;
  deadline_passed: boolean;
}
export type CueSupport =
  | { kind: 'spell_compare'; attempt: string }
  | { kind: 'listen_contrast' | 'read_contrast'; word: string; meaning: string }
  | { kind: 'spell_chunks' | 'listen_slow' | 'read_example' };
export interface CueOutcome {
  first: boolean | null;
  check: boolean | null;
  review: boolean | null;
  round: number | null;
  latest: boolean | null;
  unavailable: boolean | null;
  essential?: boolean;
  before_deadline?: boolean | null;
  deadline_unavailable?: boolean | null;
  review_on?: string | null;
}

export interface CueState {
  run_id: string;
  position: number | null;
  revision: number;
  round: number;
  session_day: 0 | 1 | 3 | 7;
  phase: 'diagnostic' | 'learn' | 'practice' | 'check' | 'review' | 'context';
  finished: boolean;
  waiting: boolean;
  due_at: string | null;
  starts_at?: string | null;
  focus_due_at?: string | null;
  gap_count: number;
  verified_count: number;
  item: {
    mode: CueMode | 'context';
    game: 'balloon' | 'train' | null;
    word_index: number;
    text: string | null;
    target: string | null;
    audio: string | null;
    meaning: string | null;
    image: string | null;
    example: string | null;
    choices: string[] | null;
    letters: string[] | null;
    essential?: boolean;
    support?: CueSupport | null;
  } | null;
}

export type CueAction = 'answer' | 'unknown' | 'continue' | 'unavailable';
export interface CueRequest { id: string; revision: number; action: CueAction; value: string | null }
export interface CueActionResult {
  state: CueState;
  correct: boolean | null;
  unavailable: boolean;
  feedback: boolean;
  answer: string | null;
}

export async function openVocabCues(token: string, assignment: string) {
  try {
    const state = await learningPathRpc<CueState | null>('learning_vocab_cue_open', { p_token: token, p_assignment: assignment });
    return state?.run_id ? state : null;
  } catch (error) {
    if (error instanceof Error && error.message === 'path_not_ready') return null;
    throw error;
  }
}

export const actVocabCues = (token: string, assignment: string, request: CueRequest) =>
  learningPathRpc<CueActionResult>('learning_vocab_cue_action', {
    p_token: token, p_assignment: assignment, p_request: request.id, p_revision: request.revision,
    p_action: request.action, p_value: request.value,
  });

export function cueLabel(mode: CueMode, en: boolean) {
  return en ? { read: 'Read for meaning', listen: 'Listen for meaning', spell: 'Spell from meaning' }[mode]
    : { read: '글로 보고 뜻 알기', listen: '듣고 뜻 알기', spell: '뜻을 보고 철자 쓰기' }[mode];
}

export const readCueSchedule = (classId: string) =>
  learningPathRpc<CueSchedule>('learning_vocab_schedule_read', { p_class: classId });

export const saveCueSchedule = (classId: string, revision: number, classDays: number[], reviewDays: number[]) =>
  learningPathRpc<CueSchedule>('learning_vocab_schedule_save', {
    p_class: classId, p_revision: revision, p_class_days: classDays, p_review_days: reviewDays,
  });

export function nextCueClass(schedule: CueSchedule, opensOn: string) {
  if (!opensOn) return schedule.next_class_on;
  const date = new Date(opensOn + 'T00:00:00Z');
  for (let i = 0; i < 7; i++) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (schedule.class_days.includes(date.getUTCDay() || 7)) return date.toISOString().slice(0, 10);
  }
  return null;
}

export const essentialCueKey = ({ word, meaning, mode }: EssentialCue) => JSON.stringify([word, meaning, mode]);

export function cueDate(value: string, en: boolean, withTime = false) {
  const instant = new Date(value.length === 10 ? value + 'T00:00:00+09:00' : value);
  return new Intl.DateTimeFormat(en ? 'en-US' : 'ko-KR', {
    timeZone: 'Asia/Seoul', month: 'short', day: 'numeric', weekday: 'short',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(instant);
}
