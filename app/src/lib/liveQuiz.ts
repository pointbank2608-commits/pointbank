import { supabase } from './supabase';
import type { FullCardItem, LiveQuestion, LiveQuestionKind } from './types';

/**
 * 대회 퀴즈쇼(실시간, 휴대폰 참가) — 2026-09-26.
 * 선생님(전자칠판)은 로그인한 staff 라 live_* 테이블을 직접 읽고 실시간 구독한다.
 * 학생(휴대폰)은 로그인하지 않고 live_join / live_state / live_submit 함수로만 드나든다
 * (supabase/028_live_quiz_show.sql). 정답은 "정답 공개" 전까지 학생에게 가지 않는다.
 */

export type LivePhase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'final';

export interface LiveSession {
  id: string;
  code: string;
  title: string;
  questions: LiveQuestion[];
  speed_bonus: boolean;
  phase: LivePhase;
  q_index: number;
  q_started_at: string | null;
  created_at: string;
  ended_at: string | null;
}

export interface LivePlayer {
  id: string;
  session_id: string;
  nickname: string;
  joined_at: string;
}

export interface LiveAnswer {
  id: string;
  session_id: string;
  player_id: string;
  q_index: number;
  choice: number | null;
  answer: string | null;
  correct: boolean | null;
  potential: number;
  points: number;
  answered_at: string;
}

export const LIVE_DEFAULT_POINTS = 1000;
export const LIVE_DEFAULT_SECONDS = 20;
export const LIVE_KINDS: LiveQuestionKind[] = ['choice', 'ox', 'text', 'buzzer'];

function uid(): string {
  return crypto.randomUUID();
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const norm = (s: string) => s.normalize('NFKC').trim().toLocaleLowerCase();

/** 문제를 대회에 낼 수 있는지(빈칸이 없는지). */
export function isLiveQuestionReady(q: LiveQuestion): boolean {
  if (!q.prompt.trim() && !q.imageUrl) return false;
  switch (q.kind) {
    case 'choice':
      return (q.choices?.length ?? 0) >= 2 && (q.choices ?? []).every((c) => c.trim()) && (q.correctIndex ?? -1) >= 0;
    case 'ox':
      return q.correctIndex === 0 || q.correctIndex === 1;
    case 'text':
    case 'buzzer':
      return !!q.answer?.trim();
  }
}

export function newLiveQuestion(kind: LiveQuestionKind, round?: string): LiveQuestion {
  return {
    id: uid(),
    kind,
    prompt: '',
    choices: kind === 'choice' ? ['', '', '', ''] : undefined,
    correctIndex: kind === 'choice' || kind === 'ox' ? 0 : undefined,
    answer: kind === 'text' || kind === 'buzzer' ? '' : undefined,
    points: kind === 'text' ? 1500 : LIVE_DEFAULT_POINTS,
    seconds: kind === 'text' ? 30 : kind === 'ox' ? 15 : LIVE_DEFAULT_SECONDS,
    round,
  };
}

export interface ContestRoundNames {
  choice: string;
  ox: string;
  text: string;
  buzzer: string;
  /** O·X 문제 문장: {{word}} = {{meaning}} */
  oxPrompt: (word: string, meaning: string) => string;
}

/**
 * 단어장 하나로 "종합 대회"를 만든다 — AI 없이 단어장 자료만 쓴다.
 * 1라운드 뜻 고르기(4지선다) → 2라운드 O·X → 3라운드 철자 쓰기(주관식) → 4라운드 스피드 부저.
 * 단어가 넉넉하면 라운드마다 다른 단어를 쓰고, 모자라면 섞어서 다시 쓴다.
 */
export function buildContestQuestions(words: FullCardItem[], names: ContestRoundNames, perRound = 5): LiveQuestion[] {
  const usable = words.filter((w) => w.word.trim() && w.meaning.trim());
  if (usable.length < 2) return [];
  const n = Math.max(1, Math.min(perRound, usable.length));
  let pool = shuffle(usable);
  const take = (): FullCardItem[] => {
    const out: FullCardItem[] = [];
    while (out.length < n) {
      if (pool.length === 0) pool = shuffle(usable);
      out.push(pool.shift()!);
    }
    return out;
  };
  const meaningsOf = (w: FullCardItem) =>
    [...new Map(usable.filter((x) => norm(x.meaning) !== norm(w.meaning)).map((x) => [norm(x.meaning), x.meaning.trim()])).values()];

  const questions: LiveQuestion[] = [];
  for (const w of take()) {
    const wrong = shuffle(meaningsOf(w)).slice(0, 3);
    if (wrong.length === 0) continue;
    const choices = shuffle([w.meaning.trim(), ...wrong]);
    questions.push({
      id: uid(),
      kind: 'choice',
      prompt: w.word.trim(),
      imageUrl: null,
      choices,
      correctIndex: choices.indexOf(w.meaning.trim()),
      points: LIVE_DEFAULT_POINTS,
      seconds: 20,
      round: names.choice,
    });
  }
  take().forEach((w, i) => {
    const others = meaningsOf(w);
    // 절반쯤은 틀린 짝(X)으로
    const makeFalse = others.length > 0 && (i % 2 === 1) !== Math.random() < 0.3;
    const shown = makeFalse ? shuffle(others)[0] : w.meaning.trim();
    questions.push({
      id: uid(),
      kind: 'ox',
      prompt: names.oxPrompt(w.word.trim(), shown),
      imageUrl: null,
      correctIndex: makeFalse ? 1 : 0,
      points: LIVE_DEFAULT_POINTS,
      seconds: 15,
      round: names.ox,
    });
  });
  for (const w of take()) {
    questions.push({
      id: uid(),
      kind: 'text',
      prompt: w.meaning.trim(),
      imageUrl: w.imageUrl ?? null,
      answer: w.word.trim(),
      points: 1500,
      seconds: 30,
      round: names.text,
    });
  }
  for (const w of take()) {
    questions.push({
      id: uid(),
      kind: 'buzzer',
      prompt: w.meaning.trim(),
      imageUrl: w.imageUrl ?? null,
      answer: w.word.trim(),
      points: LIVE_DEFAULT_POINTS,
      seconds: LIVE_DEFAULT_SECONDS,
      round: names.buzzer,
    });
  }
  return questions;
}

/* ---------------- 선생님(칠판) ---------------- */

export async function liveHostCreate(args: {
  title: string;
  questions: LiveQuestion[];
  classId: string | null;
  templateId: string | null;
  speedBonus: boolean;
}): Promise<LiveSession> {
  const { data, error } = await supabase.rpc('live_host_create', {
    p_title: args.title,
    p_questions: args.questions,
    p_class_id: args.classId,
    p_template_id: args.templateId,
    p_speed_bonus: args.speedBonus,
  });
  if (error) throw error;
  return data as LiveSession;
}

export async function liveHostSet(sessionId: string, phase: LivePhase | 'ended', qIndex: number): Promise<LiveSession> {
  const { data, error } = await supabase.rpc('live_host_set', { p_session_id: sessionId, p_phase: phase, p_q_index: qIndex });
  if (error) throw error;
  return data as LiveSession;
}

export async function liveFetchPlayers(sessionId: string): Promise<LivePlayer[]> {
  const { data, error } = await supabase
    .from('live_players')
    .select('id, session_id, nickname, joined_at')
    .eq('session_id', sessionId)
    .order('joined_at');
  if (error) throw error;
  return (data ?? []) as LivePlayer[];
}

export async function liveFetchAnswers(sessionId: string): Promise<LiveAnswer[]> {
  const { data, error } = await supabase.from('live_answers').select('*').eq('session_id', sessionId).order('answered_at');
  if (error) throw error;
  return (data ?? []) as LiveAnswer[];
}

/** 주관식 "정답 인정/취소", 부저 판정. 맞으면 받을 점수(potential)를 준다. */
export async function liveJudge(answer: LiveAnswer, correct: boolean): Promise<void> {
  const { error } = await supabase
    .from('live_answers')
    .update({ correct, points: correct ? answer.potential : 0 })
    .eq('id', answer.id);
  if (error) throw error;
}

/** 부적절한 닉네임 내보내기(그 학생의 답도 같이 지워진다). */
export async function liveKick(playerId: string): Promise<void> {
  const { error } = await supabase.from('live_players').delete().eq('id', playerId);
  if (error) throw error;
}

export interface LiveRankRow {
  player: LivePlayer;
  score: number;
  correct: number;
}

export function liveRanking(players: LivePlayer[], answers: LiveAnswer[]): LiveRankRow[] {
  const byPlayer = new Map<string, { score: number; correct: number }>();
  for (const a of answers) {
    const cur = byPlayer.get(a.player_id) ?? { score: 0, correct: 0 };
    cur.score += a.points;
    if (a.correct) cur.correct += 1;
    byPlayer.set(a.player_id, cur);
  }
  return players
    .map((player) => ({ player, ...(byPlayer.get(player.id) ?? { score: 0, correct: 0 }) }))
    .sort((a, b) => b.score - a.score || a.player.joined_at.localeCompare(b.player.joined_at));
}

/** 학생 휴대폰에 "화면이 바뀌었어요"를 알리는 방송 채널 이름. */
export function liveChannelName(code: string): string {
  return `live-quiz-${code}`;
}

export function liveJoinUrl(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

/* ---------------- 학생(휴대폰) ---------------- */

export interface LiveStudentState {
  error?: string;
  title: string;
  phase: LivePhase | 'ended';
  q_index: number;
  q_count: number;
  question: (Omit<LiveQuestion, 'id' | 'points'> & { kind: LiveQuestionKind }) | null;
  started_at: string | null;
  server_now: string;
  nickname: string;
  score: number;
  rank: number;
  players: number;
  my_answer: {
    choice: number | null;
    text: string | null;
    correct: boolean | null;
    points: number | null;
    buzz_order: number | null;
  } | null;
}

const tokenKey = (code: string) => `classbank.live.${code}`;

export function readLiveToken(code: string): string | null {
  try {
    return localStorage.getItem(tokenKey(code));
  } catch {
    return null;
  }
}

export function forgetLiveToken(code: string) {
  try {
    localStorage.removeItem(tokenKey(code));
  } catch {
    /* 무시 */
  }
}

export async function liveJoin(code: string, nickname: string): Promise<string> {
  const { data, error } = await supabase.rpc('live_join', { p_code: code, p_nickname: nickname });
  if (error) throw error;
  const token = (data as { token: string }).token;
  try {
    localStorage.setItem(tokenKey(code), token);
  } catch {
    /* 새로고침하면 다시 들어와야 할 뿐 */
  }
  return token;
}

export async function liveState(token: string): Promise<LiveStudentState> {
  const { data, error } = await supabase.rpc('live_state', { p_token: token });
  if (error) throw error;
  return data as LiveStudentState;
}

export async function liveSubmit(token: string, qIndex: number, choice: number | null, text: string | null): Promise<void> {
  const { error } = await supabase.rpc('live_submit', { p_token: token, p_q_index: qIndex, p_choice: choice, p_text: text });
  if (error) throw error;
}

/** 서버 오류 코드(raise exception 'xxx') → 화면 문구 키. */
export function liveErrorKey(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  for (const code of ['no_session', 'nickname_taken', 'bad_nickname', 'full', 'finished', 'closed', 'timeout', 'already', 'no_player', 'bad_answer']) {
    if (msg.includes(code)) return `liveQuiz.err_${code}`;
  }
  if (/function .*does not exist|Could not find the function/i.test(msg)) return 'liveQuiz.err_setup';
  return 'liveQuiz.err_unknown';
}

/** 라운드 이름·O·X 문장 — 자동 생성(buildContestQuestions)과 게임 슬라이드 자동 생성이 같이 쓴다. */
export function contestRoundNames(t: (k: string, o?: Record<string, unknown>) => string): ContestRoundNames {
  return {
    choice: t('liveQuiz.round_choice'),
    ox: t('liveQuiz.round_ox'),
    text: t('liveQuiz.round_text'),
    buzzer: t('liveQuiz.round_buzzer'),
    oxPrompt: (word, meaning) => t('liveQuiz.oxPrompt', { word, meaning }),
  };
}
