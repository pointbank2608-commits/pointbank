/**
 * 단어 프로젝트(wm-v2) 화면 시안의 순수 계산. 서버 응답(WmToday·WmProgressStudent 등)을 읽어 화면 상태만 정한다.
 * 점수·정확도 같은 내부 값은 만들지도, 내보내지도 않는다. 기존 wm-v1 응답(project 없음)도 같은 함수로 읽는다.
 */
import type { WmDailyMode, WmProgressStudent, WmProjectStatus, WmSection, WmToday } from '../../lib/wordMemory/types';
import { dailyBudget } from '../../lib/wordMemory/plan';

/** 한국 날짜(YYYY-MM-DD). 서버 값이 없는 배정 전 미리보기에서만 쓴다 — 서버의 wm_today()와 같은 Asia/Seoul 기준 */
export const kstToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export const fmt = (n: number) => n.toLocaleString('ko-KR');

const DAY = 86_400_000;
const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const addDays = (iso: string, n: number) => new Date(utc(iso) + n * DAY).toISOString().slice(0, 10);
export const diffDays = (fromIso: string, toIso: string) => Math.round((utc(toIso) - utc(fromIso)) / DAY);
export const dateKo = (iso: string) => `${+iso.slice(5, 7)}월 ${+iso.slice(8, 10)}일`;
/** 오늘과 해가 다르면 연도를 붙인다(먼 목표일이 헷갈리지 않게) */
export const dateKoSmart = (iso: string, todayIso: string) => (iso.slice(0, 4) === todayIso.slice(0, 4) ? dateKo(iso) : dateKoLong(iso));
export const dateKoLong = (iso: string) => `${iso.slice(0, 4)}년 ${dateKo(iso)}`;

/* ---------------------------------------------------------------- 학생: 오늘 할 학습 */

export type StudentMode = 'run' | 'doneToday' | 'nothing' | 'completed' | 'ended';

export interface StudentTodayView {
  mode: StudentMode;
  /** 버튼 하나: 처음이면 시작, 하던 게 있으면 이어서 */
  action: 'start' | 'resume' | null;
  /** 새 단어 · 복습 · 틀렸던 단어 다시 확인(오늘 분량 전체) */
  fresh: number;
  review: number;
  again: number;
  /** 아직 안 한 문항(소개 카드 포함) */
  remaining: number;
  asks: number;
  /** 새 단어 없이 복습만 하는 날 */
  reviewOnly: boolean;
  goalPassed: boolean;
  goalDate: string | null;
  /** 서버 waiting_review: 오늘 복습 차례지만 오늘 분량에 못 들어가 다음 날들에 나눠서 하는 복습 수. 그대로 보여 준다("밀렸다"가 아님) */
  waiting: number;
  nextDue: string | null;
  unseen: number;
  /** 프로젝트(wm-v2)에서만: 며칠 간격으로 도움 없이 맞힌 것으로 확인된 단어 */
  verified: number | null;
  total: number | null;
}

export function studentTodayView(today: WmToday): StudentTodayView {
  const p = today.project;
  const todo = today.items.filter((i) => i.state === 'todo');
  const done = today.items.length - todo.length;
  const { review, hard, new: fresh, asks } = today.counts;
  const base = {
    fresh, review, again: hard, asks,
    remaining: todo.length,
    reviewOnly: fresh === 0 && review + hard > 0,
    goalPassed: !!p?.goal_passed && !p.completed,
    goalDate: p?.goal_date ?? null,
    waiting: today.waiting_review,
    nextDue: today.next_due,
    unseen: today.unseen,
    verified: p ? p.verified : null,
    total: p ? p.total : null,
  };
  if (p?.completed) return { ...base, mode: 'completed', action: null, remaining: 0 };
  if (today.ended) return { ...base, mode: 'ended', action: null, remaining: 0 };
  if (today.items.length === 0) return { ...base, mode: 'nothing', action: null };
  if (todo.length === 0) return { ...base, mode: 'doneToday', action: null };
  return { ...base, mode: 'run', action: done > 0 ? 'resume' : 'start' };
}

/** 하루 문항 한 개에 15~30초쯤(정확한 시간이 아니다) */
export const estimateMinutesForAsks = (asks: number) => ({ min: Math.max(1, Math.ceil((asks * 15) / 60)), max: Math.max(1, Math.ceil((asks * 30) / 60)) });

/* ---------------------------------------------------------------- 교사: 승인 */

export const DAILY_MODES: WmDailyMode[] = ['light', 'normal', 'plus'];
export const MODE_LABEL: Record<WmDailyMode, string> = { light: '가볍게', normal: '보통', plus: '넉넉히' };

export interface ScheduleInput {
  total: number;
  mode: WmDailyMode;
  start: string;
  goal: string;
  reviewDays: number;
}

export interface Schedule {
  newPerDay: number;
  asksPerDay: number;
  /** 모든 새 단어를 한 번씩 만나는 데 걸리는 날(상한 기준) */
  introDays: number;
  introEnd: string;
  /** 소개가 끝난 뒤 확인 복습까지 마치는 예상일(= 소개 끝 + 복습 기간). 목표일과 비교한다 */
  verifyEnd: string;
  /** 서버에 넘기는 공부 기간. 서버의 목표일 = 시작일 + studyDays + reviewDays 이므로 studyDays = (목표일 − 시작일) − reviewDays */
  studyDays: number;
  /** 목표일 안에 소개를 끝내려면 하루에 필요한 새 단어 수 */
  requiredPerDay: number;
  /** 목표일 안에 확인 복습까지 마칠 수 있는가(예상) */
  fits: boolean;
  /** 가장 적게 늘려서 맞는 하루 분량. 없으면 목표일 또는 범위를 바꿔야 한다 */
  neededMode: WmDailyMode | null;
  valid: boolean;
  reason?: 'goal_before_start' | 'too_short' | 'too_long';
}

export function projectSchedule(i: ScheduleInput): Schedule {
  const b = dailyBudget(i.mode);
  const introDays = Math.max(1, Math.ceil(i.total / b.newMax));
  const span = diffDays(i.start, i.goal);
  const studyDays = span - i.reviewDays;
  const requiredPerDay = Math.ceil(i.total / Math.max(1, studyDays));
  const neededMode = DAILY_MODES.find((m) => dailyBudget(m).newMax >= requiredPerDay) ?? null;
  const reason = span < 1 ? 'goal_before_start' : studyDays < 3 ? 'too_short' : studyDays > 3650 ? 'too_long' : undefined;
  return {
    newPerDay: b.newMax, asksPerDay: b.asks, introDays,
    introEnd: addDays(i.start, introDays - 1),
    verifyEnd: addDays(i.start, introDays - 1 + i.reviewDays),
    studyDays, requiredPerDay,
    fits: introDays <= studyDays,
    neededMode,
    valid: !reason,
    reason,
  };
}

/** 서버(wm_plan_progress)가 주는 구간 크기. 103 기준 50으로 고정이다 */
export const SERVER_SECTION_SIZE = 50;

/** 화면에 보이는 구간 크기: 서버 구간(50)의 배수로 묶어 구간 수를 20개 이하로 맞춘다(3,520개 → 200개씩 18구간) */
export const sectionSizeFor = (total: number, base = SERVER_SECTION_SIZE) => base * Math.max(1, Math.ceil(total / (base * 20)));

export function rangeSections(total: number, size = sectionSizeFor(total)) {
  const out: { n: number; from: number; to: number; size: number }[] = [];
  for (let from = 1, n = 1; from <= total; from += size, n += 1) out.push({ n, from, to: Math.min(total, from + size - 1), size: Math.min(size, total - from + 1) });
  return out;
}

/** 서버 구간(작은 단위)을 화면 구간 크기로 묶는다. 합계(만남·기억)는 그대로 더한다 */
export function groupSections(sections: WmSection[], groupSize: number): WmSection[] {
  const out: WmSection[] = [];
  for (const s of sections) {
    const bucket = Math.floor((s.from - 1) / groupSize);
    const last = out[out.length - 1];
    if (last && Math.floor((last.from - 1) / groupSize) === bucket) {
      last.to = s.to; last.size += s.size; last.met += s.met; last.kept += s.kept;
    } else out.push({ ...s, n: out.length + 1 });
  }
  return out;
}

/* ---------------------------------------------------------------- 교사: 진행 */

export interface ProgressBuckets {
  total: number;
  verified: number;
  needsReview: number;
  unconfirmed: number;
  /** 오늘 복습 대기: 위 분류와 겹칠 수 있어 막대에 더하지 않는다 */
  reviewDue: number;
  /** 세 분류의 합이 전체와 같은가(다르면 화면에 집계 확인 안내) */
  consistent: boolean;
  pct: { verified: number; needsReview: number; unconfirmed: number };
}

export function progressBuckets(p: WmProjectStatus): ProgressBuckets {
  const t = Math.max(1, p.total);
  return {
    total: p.total, verified: p.verified, needsReview: p.needs_review, unconfirmed: p.unconfirmed, reviewDue: p.review_due,
    consistent: p.verified + p.needs_review + p.unconfirmed === p.total,
    pct: { verified: (p.verified / t) * 100, needsReview: (p.needs_review / t) * 100, unconfirmed: (p.unconfirmed / t) * 100 },
  };
}

export type ProjectRowKind = 'project' | 'legacy';
/** 교사 진행 화면 한 줄: project 가 있으면 wm-v2, 없으면 기존 wm-v1 */
export const rowKind = (s: WmProgressStudent): ProjectRowKind => (s.project ? 'project' : 'legacy');

/** 구간 칸의 채움 정도(0~1): 구간 안에서 며칠 뒤에도 기억한 단어 비율 */
export const sectionFill = (s: WmSection) => (s.size > 0 ? s.kept / s.size : 0);
