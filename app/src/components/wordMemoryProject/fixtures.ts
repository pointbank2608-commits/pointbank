/**
 * 합성 응답 시나리오(실제 학생·학원 데이터 아님). 모양은 lib/wordMemory/types.ts 의 WmToday·WmOpen·WmProgressStudent 와 같다.
 * 오늘은 2026-11-07로 고정한다.
 */
import type { WmItem, WmOpen, WmProjectStatus, WmSection, WmStageCounts, WmToday } from '../../lib/wordMemory/types';
import type { ProgressRow } from './TeacherProgress';

export const TODAY = '2026-11-07';
export const TOTAL = 3520;

const stages = (kept: number, alone = 0, practicing = 0, seen = 0, total = TOTAL): WmStageCounts => ({ unseen: Math.max(0, total - kept - alone - practicing - seen), seen, practicing, alone, kept, total });

function items(o: { fresh?: number; review?: number; hard?: number; done?: number }): WmItem[] {
  const out: WmItem[] = [];
  const push = (kind: 'study' | 'ask', phase: WmItem['phase']) => out.push({ i: out.length, kind, phase, state: 'todo' });
  for (let n = 0; n < (o.review ?? 0); n += 1) push('ask', 'review');
  for (let n = 0; n < (o.hard ?? 0); n += 1) push('ask', 'hard');
  for (let n = 0; n < (o.fresh ?? 0); n += 1) { push('study', 'new'); push('ask', 'new'); }
  for (let n = 0; n < (o.done ?? 0) && n < out.length; n += 1) out[n].state = 'done';
  return out;
}

function today(o: { fresh?: number; review?: number; hard?: number; done?: number; project?: WmProjectStatus; waiting?: number; nextDue?: string | null; unseen?: number; ended?: boolean; st?: WmStageCounts }): WmToday {
  const list = items(o);
  const asks = list.filter((i) => i.kind === 'ask').length;
  return {
    project: o.project, session_id: 'demo-session', day: TODAY, done: list.length > 0 && list.every((i) => i.state === 'done'),
    counts: { review: o.review ?? 0, hard: o.hard ?? 0, new: o.fresh ?? 0, asks },
    retry_left: 0, items: list, waiting_review: o.waiting ?? 0, next_due: o.nextDue ?? null, unseen: o.unseen ?? 0,
    stages: o.st ?? stages(0), ended: o.ended,
  };
}

const project = (p: Partial<WmProjectStatus> & { verified: number; needs_review: number }): WmProjectStatus => ({
  goal_date: '2028-10-31', goal_passed: false, total: TOTAL, unconfirmed: TOTAL - p.verified - p.needs_review, review_due: 0, completed: false, ...p,
});

export interface StudentScenario {
  id: string;
  title: string;
  note: string;
  open: Pick<WmOpen, 'title' | 'student_name' | 'phase' | 'rule_version'>;
  today: WmToday;
  /** 마지막 문항을 풀면 프로젝트가 완료되는 시나리오(마지막 단어 확인) */
  completesOnFinish?: boolean;
}
const open = (title = '초등·중등 기본 단어 3,520', rule = 'wm-v2'): StudentScenario['open'] => ({ title, student_name: '합성 학생 A', phase: 'study', rule_version: rule });

export const STUDENT_SCENARIOS: StudentScenario[] = [
  { id: 'first-day', title: '첫날 · 3,520개 범위', note: '새 단어 5개와 처음 만난 단어를 바로 묻는 문항. 오늘 분량만 보인다.', open: open(),
    today: today({ fresh: 5, unseen: 3520, project: project({ verified: 0, needs_review: 0, review_due: 0 }), st: stages(0) }) },
  { id: 'absent-return', title: '결석 9일 뒤 돌아온 날', note: '서버 waiting_review 42개를 "다음 날들에 나눠서 해요"로 그대로 안내.', open: open(),
    today: today({ fresh: 2, review: 12, hard: 4, unseen: 2790, waiting: 42, nextDue: '2026-11-08', project: project({ verified: 640, needs_review: 31, review_due: 58 }), st: stages(640, 90, 0, 0) }) },
  { id: 'review-only', title: '복습만 하는 날', note: '새 단어 없이 복습과 다시 확인만.', open: open(),
    today: today({ review: 14, hard: 3, unseen: 2100, project: project({ verified: 980, needs_review: 22, review_due: 17 }) }) },
  { id: 'refresh', title: '답 제출 후 새로고침', note: '"답하기(합성)"을 누른 뒤 새로고침하면 서버 저장분처럼 이어서 하기로 돌아온다.', open: open(),
    today: today({ fresh: 3, review: 6, hard: 2, unseen: 2500, project: project({ verified: 400, needs_review: 12, review_due: 8 }) }) },
  { id: 'goal-passed', title: '목표일을 넘긴 날', note: '목표일은 예상 일정. 지나도 남은 학습이 이어진다는 안내만, 재촉하지 않는다.', open: open(),
    today: today({ fresh: 5, review: 11, unseen: 1100, project: project({ goal_date: '2026-10-31', goal_passed: true, verified: 2210, needs_review: 40, review_due: 11 }) }) },
  { id: 'last-word', title: '마지막 단어 확인 → 완료', note: '남은 문항 1개를 풀면 프로젝트 완료 화면이 된다.', open: open(), completesOnFinish: true,
    today: today({ review: 1, project: project({ goal_date: '2026-12-31', verified: 3519, needs_review: 1, review_due: 1 }) }) },
  { id: 'completed', title: '프로젝트 완료', note: '완료 화면. 새 학습 버튼 없음.', open: open(),
    today: today({ project: project({ goal_date: '2026-12-31', verified: 3520, needs_review: 0, review_due: 0, completed: true }), ended: true }) },
  { id: 'nothing-today', title: '오늘 할 분량 없음', note: '오늘 분량이 없는 날. 다음 복습일을 알려 준다.', open: open(),
    today: today({ nextDue: '2026-11-09', unseen: 1800, project: project({ verified: 1500, needs_review: 0, review_due: 0 }) }) },
  { id: 'done-today', title: '오늘 학습 끝', note: '오늘 분량을 모두 마친 화면.', open: open(),
    today: today({ fresh: 5, review: 8, done: 99, waiting: 9, nextDue: '2026-11-08', unseen: 1750, project: project({ verified: 1600, needs_review: 8, review_due: 8 }) }) },
  { id: 'legacy-v1', title: '기존 프로젝트(wm-v1)', note: 'project 필드가 없다. 익힌 단어 막대·목표일 없이 기존 방식 그대로.', open: open('기존 단어장 숙제', 'wm-v1'),
    today: today({ fresh: 4, review: 7, hard: 2, unseen: 40, nextDue: '2026-11-09', st: stages(12, 8, 6, 4, 60) }) },
  { id: 'legacy-ended', title: '기존 프로젝트 · 기간 끝', note: 'wm-v1 기간 종료. 프로젝트 완료와 구분된다.', open: open('기존 단어장 숙제', 'wm-v1'),
    today: today({ ended: true, st: stages(30, 10, 5, 5, 60) }) },
];

/* ---------------------------------------------------------------- 교사 진행 */

/** 서버 wm_plan_progress 는 구간을 50개씩 준다(103). 화면에서 묶어 보여 준다 */
export const SECTION_SIZE = 50;
function sections(keptFraction: number[]): WmSection[] {
  let from = 1;
  return keptFraction.map((f, n) => {
    const size = Math.min(SECTION_SIZE, TOTAL - from + 1);
    const s: WmSection = { n: n + 1, from, to: from + size - 1, size, met: Math.min(size, Math.round(size * Math.min(1, f + 0.12))), kept: Math.round(size * f) };
    from += size;
    return s;
  });
}
const COUNT = Math.ceil(TOTAL / SECTION_SIZE);
// 15칸 기준의 모양(fill)을 71개 서버 구간에 비례해 펼친다
const fr = (fill: (n: number) => number) => sections(Array.from({ length: COUNT }, (_, n) => fill(Math.floor((n / COUNT) * 15))));


const row = (id: string, name: string, p: WmProjectStatus | undefined, sec: WmSection[], extra: Partial<ProgressRow> = {}): ProgressRow => ({
  student_id: id, name, met: p ? p.verified + p.needs_review : 0, kept: p ? p.verified : 0, completed: !!p?.completed, project: p, sections: sec,
  pace: { intro_date: null, graduate_date: null, on_track: null }, ...extra,
});

export const PROGRESS_ROWS: ProgressRow[] = [
  row('s1', '합성 학생 A', project({ verified: 0, needs_review: 0, review_due: 0 }), fr(() => 0), { current_mode: 'normal', note: '오늘 시작' }),
  row('s2', '합성 학생 B', project({ verified: 1480, needs_review: 66, review_due: 41 }), fr((n) => (n < 5 ? 0.97 : n < 8 ? 0.7 : n < 10 ? 0.3 : 0)), { current_mode: 'normal' }),
  row('s3', '합성 학생 C', project({ goal_date: '2026-10-31', goal_passed: true, verified: 1900, needs_review: 120, review_due: 34 }), fr((n) => (n < 6 ? 0.95 : n < 9 ? 0.5 : n < 11 ? 0.2 : 0)),
    { current_mode: 'normal', pace: { intro_date: null, graduate_date: null, on_track: false } }),
  row('s4', '합성 학생 D', project({ goal_date: '2026-12-31', verified: 3520, needs_review: 0, review_due: 0, completed: true }), fr(() => 1)),
  row('s5', '합성 학생 E', project({ verified: 640, needs_review: 31, review_due: 58 }), fr((n) => (n < 2 ? 0.9 : n < 3 ? 0.3 : 0)), { current_mode: 'normal', note: '9일 만에 복귀' }),
  row('s6', '합성 학생 F(기존 wm-v1)', undefined, [0, 1].map((n) => ({ n: n + 1, from: n * 30 + 1, to: n * 30 + 30, size: 30, met: 24 - n * 10, kept: 14 - n * 8 })),
    { met: 30, kept: 12, pace: { intro_date: '2026-11-20', graduate_date: '2026-12-15', on_track: true } }),
];
