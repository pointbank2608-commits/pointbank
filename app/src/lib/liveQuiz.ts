import { supabase } from './supabase';
import type { ContestRoundSetting, ContestRoundType, FullCardItem, LiveQuestion, LiveQuestionKind, LiveQuestionStyle } from './types';

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
  if (!q.prompt.trim() && !q.imageUrl && !q.revealImage) return false;
  if (q.style === 'listen' && !q.speak?.trim()) return false;
  if (q.style === 'picture' && !q.revealImage) return false;
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

/* ---------------- 종합 대회 자동 만들기(라운드 8종, 2026-09-28) ---------------- */

/** 라운드 종류 → 답하는 방식(kind)·칠판 표시(style) */
export const CONTEST_ROUND_TYPES: ContestRoundType[] = ['choice', 'ox', 'text', 'buzzer', 'picture', 'listen', 'scramble', 'blank'];
export const ROUND_KIND: Record<ContestRoundType, { kind: LiveQuestionKind; style?: LiveQuestionStyle }> = {
  choice: { kind: 'choice' },
  ox: { kind: 'ox' },
  text: { kind: 'text' },
  buzzer: { kind: 'buzzer' },
  picture: { kind: 'choice', style: 'picture' },
  listen: { kind: 'choice', style: 'listen' },
  scramble: { kind: 'text', style: 'scramble' },
  blank: { kind: 'choice', style: 'blank' },
};

/** 처음 설정: 예전과 같은 4라운드 켜짐 + 새 라운드 4종은 꺼짐(선생님이 켠다) */
export const DEFAULT_CONTEST_ROUNDS: ContestRoundSetting[] = CONTEST_ROUND_TYPES.map((type, i) => ({ type, count: 5, on: i < 4 }));

/** 저장된 설정에 빠진 종류가 있으면(새 종류가 생긴 뒤) 뒤에 꺼진 채로 붙인다 */
export function normalizeContestRounds(saved: ContestRoundSetting[] | undefined): ContestRoundSetting[] {
  const list = (saved ?? DEFAULT_CONTEST_ROUNDS).filter((r) => CONTEST_ROUND_TYPES.includes(r.type));
  const missing = CONTEST_ROUND_TYPES.filter((type) => !list.some((r) => r.type === type)).map((type) => ({ type, count: 5, on: false }));
  return [...list, ...missing];
}

export interface ContestRoundNames {
  /** 라운드 종류 이름(번호 없이): "뜻 고르기" */
  name: (type: ContestRoundType) => string;
  /** 번호 붙인 라운드 이름: "1라운드 · 뜻 고르기" */
  numbered: (n: number, name: string) => string;
  /** O·X 문제 문장: {{word}} = {{meaning}} */
  oxPrompt: (word: string, meaning: string) => string;
  picturePrompt: string;
  listenPrompt: string;
}

const LETTERS = /^[a-z]+$/i;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 섞인 글자(원래 순서와 다르게). 공백으로 나눠 칠판·휴대폰 모두 타일처럼 읽히게 */
export function scrambleWord(word: string): string {
  const letters = [...word.trim().toLowerCase()];
  if (letters.length < 2) return letters.join(' ');
  for (let tries = 0; tries < 12; tries++) {
    const mixed = shuffle(letters);
    if (mixed.join('') !== letters.join('')) return mixed.join(' ');
  }
  return [...letters].reverse().join(' ');
}

/** 예문에서 그 낱말(그대로 쓰인 것만)을 빈칸으로. 못 찾으면 null */
export function blankSentence(example: string | null | undefined, word: string): string | null {
  if (!example?.trim()) return null;
  const w = word.trim();
  if (!w || /\s/.test(w)) return null;
  const re = new RegExp(`\\b${escapeRe(w)}\\b`, 'i');
  if (!re.test(example)) return null;
  return example.replace(re, '_____').trim();
}

const canScramble = (w: FullCardItem) => LETTERS.test(w.word.trim()) && w.word.trim().length >= 3;

/** 라운드 종류마다 이 단어들로 만들 수 있는 문제 수(편집 화면에 "그림 있는 단어 6개"처럼 보여 준다) */
export function contestAvailability(words: FullCardItem[]): Record<ContestRoundType, number> {
  const usable = words.filter((w) => w.word.trim() && w.meaning.trim());
  const n = usable.length >= 2 ? usable.length : 0;
  return {
    choice: n,
    ox: n,
    text: n,
    buzzer: n,
    picture: n ? usable.filter((w) => w.imageUrl).length : 0,
    listen: n,
    scramble: n ? usable.filter(canScramble).length : 0,
    blank: n ? usable.filter((w) => blankSentence(w.example, w.word)).length : 0,
  };
}

/**
 * 단어장 하나로 "종합 대회"를 만든다 — AI 없이 단어장(+사전 예문·그림) 자료만 쓴다.
 * rounds 순서대로, 켜진 라운드만, 라운드마다 count 문제. 라운드 번호는 실제로 만들어진 순서대로 1, 2, 3 …
 * 단어가 넉넉하면 라운드마다 다른 단어를 쓰고, 모자라면 섞어서 다시 쓴다.
 * (예전 호출처럼 숫자를 넘기면 기본 4라운드 × 그 수)
 */
export function buildContestQuestions(
  words: FullCardItem[],
  names: ContestRoundNames,
  rounds: ContestRoundSetting[] | number = DEFAULT_CONTEST_ROUNDS,
): LiveQuestion[] {
  const settings = typeof rounds === 'number' ? DEFAULT_CONTEST_ROUNDS.map((r) => ({ ...r, count: rounds })) : rounds;
  const usable = words.filter((w) => w.word.trim() && w.meaning.trim());
  if (usable.length < 2) return [];
  const meaningsOf = (w: FullCardItem) =>
    [...new Map(usable.filter((x) => norm(x.meaning) !== norm(w.meaning)).map((x) => [norm(x.meaning), x.meaning.trim()])).values()];
  const wordsOf = (w: FullCardItem) =>
    [...new Map(usable.filter((x) => norm(x.word) !== norm(w.word)).map((x) => [norm(x.word), x.word.trim()])).values()];

  // 라운드마다 되도록 다른 단어: 후보를 섞어 두고 앞에서부터 꺼낸다
  const pools = new Map<string, FullCardItem[]>();
  const take = (key: string, candidates: FullCardItem[], count: number): FullCardItem[] => {
    if (candidates.length === 0) return [];
    const n = Math.max(1, Math.min(count, candidates.length));
    let pool = pools.get(key) ?? shuffle(candidates);
    const out: FullCardItem[] = [];
    while (out.length < n) {
      if (pool.length === 0) pool = shuffle(candidates);
      out.push(pool.shift()!);
    }
    pools.set(key, pool);
    return out;
  };
  const choiceOf = (right: string, wrongPool: string[]) => {
    const wrong = shuffle(wrongPool).slice(0, 3);
    if (wrong.length === 0) return null;
    const choices = shuffle([right, ...wrong]);
    return { choices, correctIndex: choices.indexOf(right) };
  };

  const questions: LiveQuestion[] = [];
  let roundNo = 0;
  for (const r of settings) {
    if (!r.on || r.count <= 0) continue;
    const { kind, style } = ROUND_KIND[r.type];
    const round = names.numbered(roundNo + 1, names.name(r.type));
    const base = { kind, style, roundType: r.type, round, imageUrl: null as string | null };
    const made: LiveQuestion[] = [];
    switch (r.type) {
      case 'choice':
        for (const w of take('all', usable, r.count)) {
          const c = choiceOf(w.meaning.trim(), meaningsOf(w));
          if (c) made.push({ ...base, ...c, id: uid(), prompt: w.word.trim(), points: LIVE_DEFAULT_POINTS, seconds: 20 });
        }
        break;
      case 'ox':
        take('all', usable, r.count).forEach((w, i) => {
          const others = meaningsOf(w);
          // 절반쯤은 틀린 짝(X)으로
          const makeFalse = others.length > 0 && (i % 2 === 1) !== Math.random() < 0.3;
          const shown = makeFalse ? shuffle(others)[0] : w.meaning.trim();
          made.push({ ...base, id: uid(), prompt: names.oxPrompt(w.word.trim(), shown), correctIndex: makeFalse ? 1 : 0, points: LIVE_DEFAULT_POINTS, seconds: 15 });
        });
        break;
      case 'text':
        for (const w of take('all', usable, r.count))
          made.push({ ...base, id: uid(), prompt: w.meaning.trim(), imageUrl: w.imageUrl ?? null, answer: w.word.trim(), points: 1500, seconds: 30 });
        break;
      case 'buzzer':
        for (const w of take('all', usable, r.count))
          made.push({ ...base, id: uid(), prompt: w.meaning.trim(), imageUrl: w.imageUrl ?? null, answer: w.word.trim(), points: LIVE_DEFAULT_POINTS, seconds: LIVE_DEFAULT_SECONDS });
        break;
      case 'picture':
        for (const w of take('picture', usable.filter((x) => x.imageUrl), r.count)) {
          const c = choiceOf(w.word.trim(), wordsOf(w));
          if (c) made.push({ ...base, ...c, id: uid(), prompt: names.picturePrompt, revealImage: w.imageUrl, points: LIVE_DEFAULT_POINTS, seconds: 20 });
        }
        break;
      case 'listen':
        for (const w of take('all', usable, r.count)) {
          const c = choiceOf(w.meaning.trim(), meaningsOf(w));
          if (c) made.push({ ...base, ...c, id: uid(), prompt: names.listenPrompt, speak: w.word.trim(), points: LIVE_DEFAULT_POINTS, seconds: 20 });
        }
        break;
      case 'scramble':
        for (const w of take('scramble', usable.filter(canScramble), r.count))
          made.push({ ...base, id: uid(), prompt: scrambleWord(w.word), answer: w.word.trim(), points: 1500, seconds: 30 });
        break;
      case 'blank':
        for (const w of take('blank', usable.filter((x) => blankSentence(x.example, x.word)), r.count)) {
          const c = choiceOf(w.word.trim(), wordsOf(w));
          if (c) made.push({ ...base, ...c, id: uid(), prompt: blankSentence(w.example, w.word)!, points: LIVE_DEFAULT_POINTS, seconds: 25 });
        }
        break;
    }
    if (made.length > 0) {
      roundNo++;
      questions.push(...made);
    }
  }
  return questions;
}

/** 직접 만든 문제용 빈 문제(라운드 종류에 맞는 답 방식·표시) */
export function newRoundQuestion(type: ContestRoundType, round?: string): LiveQuestion {
  const { kind, style } = ROUND_KIND[type];
  const q = newLiveQuestion(kind, round);
  return { ...q, style, roundType: type, custom: true, seconds: type === 'blank' ? 25 : q.seconds };
}

/** 예전에 만든 문제(roundType 없음)의 라운드 종류 어림 — 편집 화면 묶음에 쓴다 */
export function roundTypeOf(q: LiveQuestion): ContestRoundType {
  if (q.roundType) return q.roundType;
  return q.style ?? q.kind;
}

/**
 * 자동 만들기를 다시 할 때 선생님이 직접 만든 문제는 남긴다 — 같은 종류 라운드가 새로 만들어졌으면 그 라운드 끝에
 * (라운드 이름도 새 번호로), 그 종류가 없으면 맨 뒤에 원래 라운드 이름 그대로.
 */
export function mergeCustomQuestions(generated: LiveQuestion[], previous: LiveQuestion[]): LiveQuestion[] {
  const out = [...generated];
  const leftovers: LiveQuestion[] = [];
  for (const q of previous.filter((x) => x.custom)) {
    const type = roundTypeOf(q);
    let last = -1;
    out.forEach((g, i) => {
      if (roundTypeOf(g) === type) last = i;
    });
    if (last >= 0) out.splice(last + 1, 0, { ...q, round: out[last].round });
    else leftovers.push(q);
  }
  return [...out, ...leftovers];
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
    name: (type) => t(`liveQuiz.roundName_${type}`),
    numbered: (n, name) => t('liveQuiz.roundNumbered', { n, name }),
    oxPrompt: (word, meaning) => t('liveQuiz.oxPrompt', { word, meaning }),
    picturePrompt: t('liveQuiz.picturePrompt'),
    listenPrompt: t('liveQuiz.listenPrompt'),
  };
}
