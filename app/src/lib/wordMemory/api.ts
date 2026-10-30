/**
 * 단어암기숙제 서버 호출. 학생 쪽은 로그인 없이 개인 링크 열쇠(access) 하나로 부른다 — 학생 이름·id 는 주소·저장소에 남기지 않는다.
 * 답은 보낼 때마다 새 요청 번호(client_id)를 붙이고, 인터넷이 끊겨 다시 보낼 때는 같은 번호를 쓴다 — 서버가 한 번만 남긴다.
 */
import { supabase } from '../supabase';
import type {
  WmAnswerResult, WmAssignInput, WmAssignResult, WmBriefing, WmCardRow, WmCollectionWord, WmErrorKind, WmHint, WmOpen, WmPlanResults, WmPlanSummary, WmProgress, WmStageCounts, WmStepAction,
  WmStudentSteps, WmToday,
} from './types';

export class WmError extends Error {
  kind: WmErrorKind;
  constructor(kind: WmErrorKind) {
    super(kind);
    this.kind = kind;
  }
}

export function toWmError(err: unknown): WmError {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return new WmError('network');
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return new WmError('network');
  for (const k of ['feature_closed', 'too_few_words', 'bad_student', 'no_students', 'not_found', 'closed', 'stale'] as const) if (msg.includes(k)) return new WmError(k);
  return new WmError('unknown');
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  let res;
  try {
    res = await supabase.rpc(fn, args);
  } catch (e) {
    throw toWmError(e);
  }
  if (res.error) throw toWmError(res.error);
  return res.data as T;
}

/* ---------- 선생님 ---------- */

export const wmAssign = (input: WmAssignInput) =>
  rpc<WmAssignResult>('wm_assign', {
    p_request_id: input.requestId,
    p_class_id: input.classId,
    p_title: input.title,
    p_cards: input.cards,
    p_source: input.source,
    p_student_ids: input.studentIds,
    p_daily_mode: input.mode,
    p_study_days: input.studyDays,
    p_review_days: input.reviewDays,
  });
export const wmPlanList = (classId: string | null) => rpc<WmPlanSummary[]>('wm_plan_list', { p_class_id: classId });
export const wmPlanResults = (planId: string) => rpc<WmPlanResults>('wm_plan_results', { p_plan: planId });
export const wmPlanLinks = (planId: string) => rpc<{ student_id: string; name: string; access: string }[]>('wm_plan_links', { p_plan: planId });
export const wmPlanClose = (planId: string) => rpc<null>('wm_plan_close', { p_plan: planId });

export const wmPlanBriefing = (planId: string) => rpc<WmBriefing>('wm_plan_briefing', { p_plan: planId });
export const wmPlanSteps = (planId: string) => rpc<WmStudentSteps[]>('wm_plan_steps', { p_plan: planId });
export const wmApplyStep = (planId: string, studentId: string, action: WmStepAction) => rpc<{ mode: string; focus: string | null }>('wm_apply_step', { p_plan: planId, p_student: studentId, p_action: action });
export const wmPlanProgress = (planId: string) => rpc<WmProgress>('wm_plan_progress', { p_plan: planId });
export const wmPlanCards = (planId: string, from: number, to: number) => rpc<WmCardRow[]>('wm_plan_cards', { p_plan: planId, p_from: from, p_to: to });
export const wmPlanWeakCards = (planId: string, limit = 100) => rpc<WmCardRow[]>('wm_plan_weak_cards', { p_plan: planId, p_limit: limit });

/* ---------- 학생 ---------- */

export const wmOpen = (access: string) => rpc<WmOpen>('wm_open', { p_access: access });
export const wmToday = (access: string) => rpc<WmToday>('wm_today_state', { p_access: access });
export const wmAck = (access: string, session: string, q: number, clientId: string) => rpc<{ ok: boolean; done: boolean }>('wm_ack', { p_access: access, p_session: session, p_q: q, p_client: clientId });
export const wmHint = (access: string, session: string, q: number) => rpc<WmHint>('wm_hint', { p_access: access, p_session: session, p_q: q });
export const wmAnswer = (access: string, session: string, q: number, response: string, clientId: string) =>
  rpc<WmAnswerResult>('wm_answer', { p_access: access, p_session: session, p_q: q, p_response: response, p_client: clientId });
export const wmCollection = (access: string) => rpc<{ stages: WmStageCounts; words: WmCollectionWord[] }>('wm_collection', { p_access: access });
export const wmStudentLinks = (token: string) => rpc<{ title: string; access: string; phase: 'study' | 'review' }[]>('wm_student_links', { p_token: token });

/** 학생 개인 링크 주소 */
export const wmStudentUrl = (access: string, origin = typeof window !== 'undefined' ? window.location.origin : '') => `${origin}/wm/${access}`;
