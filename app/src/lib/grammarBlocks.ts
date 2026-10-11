import { evenIndexes, type SoloStep } from './soloLessons';
import { looseNorm } from './soloLessons';
import { GRAMMAR_POINTS, plainText, type GrammarPoint } from './grammar';

/**
 * 문법 항목으로 만드는 블록(2026-10-12) — 문법 항목마다 검수된 "시험에 잘 나오는 틀린 문장 → 고친 문장"(pitfalls)이 있어서
 * AI 없이 어법 오류 고치기 문제를 만든다: 틀린 문장을 보여 주고 학생이 고쳐 쓴다(정답 = 고친 문장, 대소문자·문장부호 무시).
 * 화면 풀이(서버 채점 063 SQL)와 인쇄(soloPrint.ts)가 같은 문제를 쓴다.
 */

export interface FixItem {
  pointId: string;
  pointName: string;
  wrong: string;
  right: string;
  why: string;
}

/** 해석 메모 "(주격)" 같은 꼬리·강조 표시를 뗀다 */
const clean = (s: string): string => plainText(s).replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').trim();

/** 문법 항목들의 틀린 문장 → 고친 문장을 모두 모은다(같은 틀린 문장·정답과 같은 틀린 문장은 뺀다). */
export function fixErrorItems(points: GrammarPoint[]): FixItem[] {
  const seen = new Set<string>();
  const out: FixItem[] = [];
  for (const p of points) {
    for (const pit of p.pitfalls ?? []) {
      const wrong = clean(pit.wrong);
      const right = clean(pit.right);
      if (!wrong || !right) continue;
      if (looseNorm(wrong) === looseNorm(right)) continue;
      const key = looseNorm(wrong);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ pointId: p.id, pointName: p.name, wrong, right, why: (pit.why ?? '').trim() });
    }
  }
  return out;
}

/** 틀린 곳이 있는 문제가 있는 문법 항목 수 */
export const pitfallCount = (p: GrammarPoint): number => fixErrorItems([p]).length;

/** 문법 항목 id 목록 → 오류 고치기 문제 단계들(count 개, 앞뒤 고르게). */
export function buildFixErrorSteps(pointIds: string[], count: number): SoloStep[] {
  const points = pointIds.map((id) => GRAMMAR_POINTS.find((g) => g.id === id)).filter((p): p is GrammarPoint => !!p);
  const all = fixErrorItems(points);
  const picked = all.length <= count ? all : evenIndexes(all.length, count).map((i) => all[i]);
  return picked.map((it): SoloStep => ({ t: 'fixError', wrong: it.wrong, right: it.right, why: it.why, ko: '' }));
}

/**
 * 틀린 문장의 낱말 칸(공백으로 나눔) — 학생이 틀린 낱말을 눌러 고친다.
 * 화면(플레이어)과 인쇄가 같은 규칙을 쓰도록 여기서 정한다.
 */
export const fixTokens = (wrong: string): string[] => wrong.split(/\s+/).filter(Boolean);

/** 학생이 고친 낱말(칸 번호 → 고친 글)을 반영한 문장. 빈 글로 고치면 그 낱말을 지운 것. */
export function applyFixEdits(wrong: string, edits: Record<number, string>): string {
  return fixTokens(wrong)
    .map((w, i) => (i in edits ? edits[i].trim() : w))
    .filter((w) => w.length > 0)
    .join(' ');
}
