import type { SoloStep } from './soloLessons';
import type { BoardBlock } from './soloBoard';
import { MIN_SKILL_N, skillLabel, type SkillLabel } from './homework/teacherHelpers';

/**
 * 블록 보드에 보여 주는 정답률(060·063) — 서버가 합계만 주고(학생 이름·순위 없음), 앱이 블록 범위로 더한다.
 *  - 이 수업: 이 수업을 푼 학생들의 처음 답, 블록이 차지한 문제 번호 범위의 합
 *  - 이 반(최근 N일): 그 블록이 재는 능력 하나의 반 전체 처음 답(학습 카드와 같은 재료)
 * 판단 말("잘 익혔어요" …)은 학습 카드와 같은 기준(`skillLabel`: 8개 미만이면 판단 안 함).
 */
export interface BlockStatsData {
  days: number;
  scope: 'class' | 'academy';
  steps: { step: number; students: number; n: number; correct: number }[];
  skills: { skill: string; n: number; correct: number; students: number }[];
}

/** 단계 종류 → 재는 능력. 서버의 solo_step_skill(060·062)과 같아야 한다(check-logic.mjs 가 검사). */
export function soloStepSkill(step: Pick<SoloStep, 't'> & { imageUrl?: string | null }): string | null {
  switch (step.t) {
    case 'pickWord':
      return step.imageUrl ? 'vocab.picture' : 'vocab.meaning';
    case 'pickMeaning':
      return 'vocab.meaning';
    case 'fillBlank':
    case 'gapType':
      return 'vocab.context';
    case 'pickPos':
      return 'vocab.pos';
    case 'spell':
    case 'typeWord':
      return 'vocab.spelling';
    case 'listenPick':
      return 'listening.word';
    case 'dictation':
      return 'listening.dictation';
    case 'lyricBlank':
      return 'listening.content';
    case 'translatePick':
      return 'reading.sentence';
    case 'sayPick':
      return 'reading.situation';
    case 'unscramble':
    case 'lineOrder':
      return 'sentence.order';
    case 'pickCorrect':
    case 'fixError':
      return 'sentence.correct';
    default:
      return null;
  }
}

export interface BlockPerformance {
  /** 이 수업(이 블록의 문제 범위) */
  lesson: { students: number; n: number; correct: number; rate: number; label: SkillLabel | null } | null;
  /** 이 반(또는 학원) 최근 N일, 이 블록이 재는 능력 */
  klass: { skill: string; n: number; correct: number; rate: number; label: SkillLabel | null } | null;
}

/**
 * 블록 하나의 정답률. `saved` 는 서버에 저장된(= 기록이 붙은) 문제 목록, `steps` 는 지금 편집 중인 목록.
 * 저장 뒤 문제를 옮기거나 지웠다면 번호가 어긋나므로, 블록 범위의 문제 종류가 저장본과 같을 때만 "이 수업" 숫자를 보여 준다.
 */
export function blockPerformance(data: BlockStatsData | null, saved: SoloStep[], steps: SoloStep[], block: BoardBlock): BlockPerformance {
  const out: BlockPerformance = { lesson: null, klass: null };
  if (!data) return out;

  let aligned = true;
  for (let i = block.start; i <= block.end; i++) {
    if (!saved[i] || saved[i].t !== steps[i]?.t) {
      aligned = false;
      break;
    }
  }
  if (aligned) {
    const rows = data.steps.filter((r) => r.step >= block.start && r.step <= block.end);
    const n = rows.reduce((a, r) => a + r.n, 0);
    if (n > 0) {
      const correct = rows.reduce((a, r) => a + r.correct, 0);
      const rate = correct / n;
      // 같은 학생이 블록의 여러 문제를 풀므로 학생 수는 가장 많이 푼 문제 쪽을 쓴다
      const students = rows.reduce((a, r) => Math.max(a, r.students), 0);
      out.lesson = { students, n, correct, rate, label: skillLabel(n, rate) };
    }
  }

  const first = steps[block.start];
  const skill = first && block.type !== 'test' ? soloStepSkill(first as Pick<SoloStep, 't'> & { imageUrl?: string | null }) : null;
  if (skill) {
    const s = data.skills.find((x) => x.skill === skill);
    if (s && s.n > 0) {
      const rate = s.correct / s.n;
      out.klass = { skill, n: s.n, correct: s.correct, rate, label: skillLabel(s.n, rate) };
    }
  }
  return out;
}

export { MIN_SKILL_N };
