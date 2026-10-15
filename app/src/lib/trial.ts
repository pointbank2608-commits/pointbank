import type { Academy } from './types';

/**
 * 14일 전체 체험(2026-10-16). 체험 종료일(trial_ends_at, 한국 날짜)까지는 유료와 같은 기능을 쓴다.
 * 서버 한도 트리거(080b·080c)와 같은 기준 — 한국 날짜로 비교한다.
 */
export interface TrialInfo {
  /** 무료 플랜이면서 체험 기간 안 */
  active: boolean;
  /** 체험이 끝난 무료 플랜 */
  expired: boolean;
  /** 0 = 오늘이 마지막 날. 체험이 아니면 null */
  daysLeft: number | null;
  /** 끝난 지 며칠 지났는지(체험 중이면 null) */
  daysSinceEnd: number | null;
  endsAt: string | null;
}

export function todayKst(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

export function trialInfo(academy: Pick<Academy, 'plan' | 'trial_ends_at'> | null | undefined): TrialInfo {
  const none: TrialInfo = { active: false, expired: false, daysLeft: null, daysSinceEnd: null, endsAt: null };
  if (!academy || academy.plan !== 'free' || !academy.trial_ends_at) return none;
  const diff = dayDiff(academy.trial_ends_at, todayKst());
  if (diff >= 0) return { active: true, expired: false, daysLeft: diff, daysSinceEnd: null, endsAt: academy.trial_ends_at };
  return { active: false, expired: true, daysLeft: null, daysSinceEnd: -diff, endsAt: academy.trial_ends_at };
}
