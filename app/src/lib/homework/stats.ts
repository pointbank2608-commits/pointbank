/**
 * 학생 스탯 카드(Classbank Student ③, 2026-10-05) — 서버 학습 카드(student_learning_card) 숫자를 능력 5개 × 세부 능력으로 묶고
 * 등급(S+·S·A·B·C)을 붙인다. 계산은 모두 여기 한 곳(화면·학부모 리포트가 같이 쓴다).
 *
 * 규칙
 *  - 세부 능력: 처음 답 8개 이상이어야 등급, 아니면 "?" (가중 정답률 — 최근 기록에 더 무게, 서버가 계산).
 *  - 큰 능력: 등급이 있는 세부 능력들의 문제 수 가중 평균. 하나도 없으면 "?".
 *  - 전체 기록이 모자라면(채점 30개 미만 또는 끝낸 활동 3개 미만) 모든 등급을 "?"로 — 근거 없는 등급을 만들지 않는다.
 *  - 꾸준함: 받은 숙제 완료율(3개 이상), 틀린 문제 다시 풀어 맞힌 비율(5번 이상), 통장 숙제 검사 완료율(3번 이상).
 *  - 읽기는 아직 재는 활동이 없어 늘 "?"(재는 활동이 생기면 SKILL 을 여기에 더한다).
 *  - 다른 학생과 비교하지 않는다. 비교는 지난 기간의 나(단순 정답률, 8개 이상일 때만).
 */
import type { LearningCard } from '../homework';
import { SKILL } from './build';

/** 세부 능력 이름 번역 키 */
export const subLabelKey = (key: string) => `studentHw.skill_${key.replace('.', '_')}`;

export type Grade = 'S+' | 'S' | 'A' | 'B' | 'C';
export const MIN_SUB_N = 8;

export function gradeOf(rate: number): Grade {
  return rate >= 0.95 ? 'S+' : rate >= 0.9 ? 'S' : rate >= 0.8 ? 'A' : rate >= 0.7 ? 'B' : 'C';
}

export interface SubStat {
  key: string;
  n: number;
  rate: number | null;
  grade: Grade | null;
  /** 지난 기간 대비 %p (근거가 있을 때만) */
  delta: number | null;
}

export interface AbilityStat {
  key: 'vocab' | 'listening' | 'reading' | 'sentence' | 'habit';
  rate: number | null;
  grade: Grade | null;
  subs: SubStat[];
}

export interface StatSheet {
  enough: boolean;
  abilities: AbilityStat[];
  overall: { rate: number | null; grade: Grade | null };
  /** 경기 기록 */
  record: { graded: number; correctRate: number | null; finished: number; assigned: number; retries: number; corrected: number };
}

const ABILITY_SKILLS: Record<Exclude<AbilityStat['key'], 'habit'>, string[]> = {
  vocab: [SKILL.meaning, SKILL.picture, SKILL.spelling, SKILL.context],
  listening: [SKILL.listen, SKILL.content],
  reading: [],
  sentence: [SKILL.sentence],
};

function combine(subs: SubStat[]): { rate: number | null; grade: Grade | null } {
  const rated = subs.filter((s) => s.grade && s.rate !== null);
  const n = rated.reduce((a, s) => a + s.n, 0);
  if (!rated.length || !n) return { rate: null, grade: null };
  const rate = rated.reduce((a, s) => a + (s.rate as number) * s.n, 0) / n;
  return { rate, grade: gradeOf(rate) };
}

export function buildStatSheet(card: LearningCard): StatSheet {
  const enough = card.graded >= 30 && card.completed_activities >= 3;
  const skill = (key: string): SubStat => {
    const s = card.skills.find((x) => x.skill === key);
    const n = s?.n ?? 0;
    const rate = s && s.weighted !== null ? Number(s.weighted) : null;
    const ok = enough && n >= MIN_SUB_N && rate !== null;
    const delta = s && n >= MIN_SUB_N && s.prev_n >= MIN_SUB_N ? Math.round((s.correct / n - s.prev_correct / s.prev_n) * 100) : null;
    return { key, n, rate: ok ? rate : null, grade: ok ? gradeOf(rate as number) : null, delta };
  };
  const ratio = (key: string, num: number, den: number, min: number, prev?: { num: number; den: number }): SubStat => {
    const ok = enough && den >= min;
    const rate = den ? num / den : null;
    const delta = prev && den >= min && prev.den >= min ? Math.round((num / den - prev.num / prev.den) * 100) : null;
    return { key, n: den, rate: ok ? rate : null, grade: ok && rate !== null ? gradeOf(rate) : null, delta };
  };

  const abilities: AbilityStat[] = (['vocab', 'listening', 'reading', 'sentence'] as const).map((key) => {
    const subs = ABILITY_SKILLS[key].map(skill);
    return { key, subs, ...combine(subs) };
  });
  const pb = card.passbook_homework;
  const habitSubs = [
    ratio('habit.finish', card.habit.finished, card.habit.assigned, 3, { num: card.habit.prev_finished, den: card.habit.prev_assigned }),
    ratio('habit.retry', card.retries.corrected, card.retries.count, 5),
    ratio('habit.passbook', pb.done, pb.done + pb.missing, 3),
  ];
  abilities.push({ key: 'habit', subs: habitSubs, ...combine(habitSubs) });

  const known = abilities.filter((a) => a.rate !== null);
  const overallRate = known.length ? known.reduce((a, x) => a + (x.rate as number), 0) / known.length : null;
  const totalN = card.skills.reduce((a, s) => a + s.n, 0);
  const totalRight = card.skills.reduce((a, s) => a + s.correct, 0);
  return {
    enough,
    abilities,
    overall: { rate: overallRate, grade: overallRate === null ? null : gradeOf(overallRate) },
    record: {
      graded: card.graded,
      correctRate: totalN ? totalRight / totalN : null,
      finished: card.habit.finished,
      assigned: card.habit.assigned,
      retries: card.retries.count,
      corrected: card.retries.corrected,
    },
  };
}

/** 잘하는 것·연습할 것(학부모 리포트·카드 한 줄 요약) — 등급이 있는 세부 능력만 */
export function strengthsAndFocus(sheet: StatSheet): { strengths: SubStat[]; focus: SubStat[] } {
  const subs = sheet.abilities.flatMap((a) => a.subs).filter((s) => s.grade && s.rate !== null);
  // 영어 능력을 꾸준함(habit.*)보다 먼저 — 학부모에게는 영어 실력이 먼저 궁금하다
  const habit = (s: SubStat) => (s.key.startsWith('habit.') ? 1 : 0);
  const sorted = [...subs].sort((a, b) => habit(a) - habit(b) || (b.rate as number) - (a.rate as number));
  const strengths = sorted.filter((s) => (s.rate as number) >= 0.85).slice(0, 2);
  const focus = [...subs]
    .sort((a, b) => habit(a) - habit(b) || (a.rate as number) - (b.rate as number))
    .filter((s) => (s.rate as number) < 0.7 && !strengths.includes(s))
    .slice(0, 2);
  return { strengths, focus };
}
