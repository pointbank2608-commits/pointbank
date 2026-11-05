import { supabase } from './supabase';

export type ResearchFocus = 'participation' | 'practice' | 'measurement' | 'curriculum';
export type ResearchDecision = 'investigate' | 'compare' | 'hold';
export interface ResearchCohort {
  practice: 'letters' | 'recall'; baseline: 'known' | 'needs_practice' | 'unknown';
  goal_units: number; students: number; plans: number; versions: number;
  diagnostic_answered: number; first_checked: number; first_correct: number; final_checked: number; final_correct: number;
  practice_denominator: number; practice_answers: number;
  d1_due: number; d1_answered: number; d1_correct: number; d2_due: number; d2_answered: number; d2_correct: number;
}
export interface ResearchRound {
  round: number; due: number; answered: number; correct: number; missing: number; not_due: number; not_scheduled: number;
  min_elapsed_days: number | null; max_elapsed_days: number | null;
}
export interface ResearchReport {
  research_version: 'vocab-research-v1'; generated_at: string; evidence_hash: string; days: number; academy_id: string | null;
  overview: { plans: number; assignments: number; students: number; started: number; first_completed: number; finished: number };
  cohorts: ResearchCohort[]; rounds: ResearchRound[];
  content_versions: { fingerprint: string; title: string; practice: string; baseline: ResearchCohort['baseline']; goal_units: number; students: number; first_checked: number; first_correct: number; final_checked: number; final_correct: number; d1_answered: number; d1_correct: number; d2_answered: number; d2_correct: number }[];
  versions_truncated: boolean;
  quality: { answers: number; unlinked_answers: number; mismatched_answers: number; observed_runs: number; visible_ms: number; hint_events: number; help_requests: number; unresolved_goals: number };
  feedback: { assigned: number; dismissed: number; changed_practice: number };
  protection: string[]; scopes: { id: string; label: string }[];
}
export interface ResearchRecord {
  request_id: string; created_at: string; days: number; academy_id: string | null;
  focus: ResearchFocus; decision: ResearchDecision; note: string; evidence_hash: string; evidence: ResearchReport;
}
export interface ResearchSave {
  p_request: string; p_days: number; p_academy: string | null; p_focus: ResearchFocus;
  p_decision: ResearchDecision; p_note: string; p_evidence_hash: string;
}

export class ResearchError extends Error {
  kind: 'missing' | 'denied' | 'changed' | 'error';
  constructor(code?: string, message = '') {
    super(message);
    this.kind = ['PGRST202','42883','42P01'].includes(code ?? '') ? 'missing'
      : code === '42501' || /forbidden/.test(message) ? 'denied'
      : /research_changed_refresh/.test(message) ? 'changed' : 'error';
  }
}
export async function fetchResearch(days: number, academy: string | null): Promise<ResearchReport> {
  const { data, error } = await supabase.rpc('admin_learning_research', { p_days: days, p_academy: academy });
  if (error) throw new ResearchError(error.code, error.message);
  if (data?.research_version !== 'vocab-research-v1' || !data.overview || !Array.isArray(data.cohorts)) throw new ResearchError();
  return data as ResearchReport;
}
export async function fetchResearchRecords(days: number, academy: string | null): Promise<ResearchRecord[]> {
  const { data, error } = await supabase.rpc('admin_learning_research_decisions', { p_days: days, p_academy: academy });
  if (error) throw new ResearchError(error.code, error.message);
  if (!Array.isArray(data)) throw new ResearchError();
  return data as ResearchRecord[];
}
export async function saveResearchDecision(input: ResearchSave): Promise<{ request_id: string; duplicate: boolean }> {
  const { data, error } = await supabase.rpc('admin_learning_research_decide', input);
  if (error) throw new ResearchError(error.code, error.message);
  if (!data?.request_id) throw new ResearchError();
  return data;
}

export interface ResearchInsight { key: string; focus: ResearchFocus; priority: 'check' | 'review'; ko: string; en: string }
// Deterministic review suggestions. Never select a winning treatment or assign student work.
export function researchInsights(r: ResearchReport): ResearchInsight[] {
  const out: ResearchInsight[] = [];
  if (r.protection.length) out.push({ key: 'boundary', focus: 'measurement', priority: 'check',
    ko: '학습 경로 보호 설정이 변경됐습니다. 새 배정 전에 호환성 검사를 확인하세요.', en: 'Path protection changed. Review compatibility before assigning new plans.' });
  if (r.quality.unlinked_answers + r.quality.mismatched_answers > 0) out.push({ key: 'link', focus: 'measurement', priority: 'check',
    ko: '제공 버전과 연결되지 않거나 일치하지 않는 응답이 있습니다. 연결 품질을 먼저 점검하세요.', en: 'Some answers are unlinked or version mismatched. Review evidence quality first.' });
  const missing = r.rounds.reduce((n,x) => n+x.missing,0);
  if (missing) out.push({ key: 'return', focus: 'participation', priority: 'review',
    ko: `기한이 지난 지연 확인 ${missing}건이 미응답입니다. 접속 경로·일정·복귀 흐름을 점검하세요. 미응답은 오답이 아닙니다.`, en: `${missing} due delayed checks are unanswered. Review access, scheduling and return flow; missing answers are not errors.` });
  if (r.overview.started > r.quality.observed_runs) out.push({ key: 'telemetry', focus: 'measurement', priority: 'review',
    ko: '시작된 배정 일부에 활동 센서가 없습니다. 수집 플래그·연결 상태를 확인하고 시간·도움 지표의 관측 범위를 구분하세요.', en: 'Some started assignments lack telemetry. Check collection and connectivity before interpreting time or help.' });
  const unknown = r.cohorts.reduce((n,c) => n+(c.baseline === 'unknown' ? c.goal_units : 0),0);
  if (unknown) out.push({ key: 'baseline', focus: 'measurement', priority: 'review',
    ko: `진단 결과가 없는 배정·단어 사례 ${unknown}건은 사전 상태 비교에서 분리하세요.`, en: `Keep ${unknown} assignment–word observations with unknown baseline separate from baseline comparisons.` });
  const eligible = r.cohorts.filter(c => c.baseline === 'needs_practice');
  if (eligible.some(c => c.first_checked > c.first_correct)) out.push({ key: 'practice', focus: 'practice', priority: 'review',
    ko: '진단에서 어려웠던 단어의 첫 확인과 재학습 후 확인을 비교하세요. 최종 정답만으로 한 번에 익혔다고 판단하지 않습니다.', en: 'Review first and final initial checks for words missed at diagnosis. Final success can include additional practice.' });
  if (new Set(eligible.filter(c => c.d1_answered+c.d2_answered > 0).map(c => c.practice)).size > 1) out.push({ key: 'compare', focus: 'curriculum', priority: 'review',
    ko: '두 연습 방식에 지연 확인 기록이 있습니다. 단어·학생·사전 상태 차이를 확인한 뒤 교사가 승인하는 작은 비교를 설계하세요. 현재 집계로 우열을 정하지 않습니다.', en: 'Both practice modes have delayed observations. Review content, learners and baseline before designing a teacher-approved comparison.' });
  if (!r.overview.assignments) out.push({ key: 'empty', focus: 'measurement', priority: 'review',
    ko: '이 기간에 배정된 어휘 회상 수업이 없습니다. 검증된 수집 경로부터 확인하세요.', en: 'No vocabulary-recall assignments in this cohort window. Verify the collection path first.' });
  if (!out.length) out.push({ key: 'wait', focus: 'curriculum', priority: 'review',
    ko: '현재 근거로 자동 변경을 권하지 않습니다. 지연 확인 기록을 더 모으고 비교 조건을 준비하세요.', en: 'No automatic changes are recommended. Gather delayed evidence and prepare comparison conditions.' });
  return out;
}

export const fraction = (correct: number, total: number) => total ? `${correct}/${total} · ${Math.round(100*correct/total)}%` : '—';
