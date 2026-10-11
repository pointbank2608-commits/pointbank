import { wordsFromSteps } from './soloEdit';
import { buildWordBlock, gradeSoloLocal, soloCorrectText, type SoloQuestionStep, type SoloStep, type SoloTestItem, type TestArea, type WordBlockType } from './soloLessons';

/**
 * 시험 블록(2026-10-12, 1단계) — 수업 하나에서 배운 것으로 영역이 고루 섞인 시험을 한 번에 만든다.
 * 시험은 단계 하나(`t: 'test'`)에 문제 여러 개를 담는다: 수업 단계와 달리 틀려도 바로 정답을 보여 주지 않고,
 * 문제마다 제한 시간이 있고, 다 푼 뒤 서버(058 `solo_test_submit`)가 한 번에 채점해 영역별 점수를 돌려준다.
 *
 * 문제 재료(AI 없음):
 *  - 수업의 낱말(`wordsFromSteps`) → 어휘(그림·뜻·품사 고르기) · 듣기(듣고 고르기·받아쓰기) · 쓰기(뜻 보고 쓰기·철자) · 문장(예문 빈칸)
 *  - 수업에 이미 있는 문장 문제(해석 고르기·맞는 문장 고르기·문장 배열·상황 표현 고르기·빈칸) → 보기 순서를 다시 섞어 문장 영역에
 * 범위는 지금 "이 수업에서 배운 것"만 — 학교 학년·6년 커리큘럼 범위는 다음 단계.
 */

export const TEST_AREAS: TestArea[] = ['vocab', 'listening', 'spelling', 'sentence'];
export const TEST_LENGTHS = [10, 20, 30] as const;

const AREA_OF: Record<SoloQuestionStep['t'], TestArea> = {
  pickWord: 'vocab',
  pickMeaning: 'vocab',
  pickPos: 'vocab',
  listenPick: 'listening',
  dictation: 'listening',
  spell: 'spelling',
  typeWord: 'spelling',
  fillBlank: 'sentence',
  translatePick: 'sentence',
  pickCorrect: 'sentence',
  unscramble: 'sentence',
  sayPick: 'sentence',
};
export const TEST_ITEM_TYPES = Object.keys(AREA_OF) as SoloQuestionStep['t'][];

/** 문제 하나의 기본 제한 시간(초) — 듣기 문제는 소리가 나오는 동안 시계가 멈춘다 */
export const TEST_SECONDS: Record<SoloQuestionStep['t'], number> = {
  pickWord: 20,
  pickMeaning: 20,
  pickPos: 20,
  listenPick: 20,
  dictation: 30,
  spell: 40,
  typeWord: 30,
  fillBlank: 30,
  translatePick: 35,
  pickCorrect: 30,
  unscramble: 45,
  sayPick: 30,
};

/** 영역별 몫(합 1) — 모자란 영역의 몫은 남는 영역으로 넘긴다 */
const AREA_SHARE: Record<TestArea, number> = { vocab: 0.35, listening: 0.25, spelling: 0.2, sentence: 0.2 };

const WORD_TYPES: Record<TestArea, WordBlockType[]> = {
  vocab: ['pickWord', 'pickMeaning', 'pickPos'],
  listening: ['listenPick', 'dictation'],
  spelling: ['typeWord', 'spell'],
  sentence: ['fillBlank'],
};

export const isTestQuestion = (s: SoloStep): s is SoloQuestionStep => s.t in AREA_OF;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 수업 단계에서 가져온 문제: 출처·고침 표시를 떼고, 보기·조각 순서를 다시 섞는다(수업에서 본 자리를 외워 맞히지 않게) */
function fresh(q: SoloQuestionStep): SoloQuestionStep {
  const { src: _src, edited: _edited, ...rest } = q as SoloQuestionStep & { src?: unknown; edited?: unknown };
  const c = JSON.parse(JSON.stringify(rest)) as SoloQuestionStep;
  if ('options' in c && 'answer' in c) {
    const order = shuffle(c.options.map((_, i) => i));
    const answer = order.indexOf(c.answer);
    if (c.t === 'listenPick') return { ...c, options: order.map((i) => c.options[i]), images: order.map((i) => c.images[i] ?? null), answer };
    return { ...c, options: order.map((i) => c.options[i]), answer } as SoloQuestionStep;
  }
  if (c.t === 'unscramble') {
    const words = c.sentence.split(/\s+/).filter(Boolean);
    let sc = shuffle(words);
    for (let i = 0; i < 5 && sc.join(' ') === words.join(' '); i++) sc = shuffle(words);
    return { ...c, words: sc };
  }
  return c;
}

/** 같은 낱말·문장이 여러 번 나오지 않게 고를 때 쓰는 열쇠 */
function keyOf(q: SoloQuestionStep): string {
  if ('word' in q && typeof q.word === 'string' && q.word) return q.word.toLowerCase();
  if (q.t === 'pickWord' || q.t === 'fillBlank') return (q.options[q.answer] ?? q.meaning).toLowerCase();
  if (q.t === 'unscramble' || q.t === 'translatePick') return q.sentence.toLowerCase();
  if (q.t === 'pickCorrect') return (q.options[q.answer] ?? '').toLowerCase();
  if (q.t === 'sayPick') return q.situation.toLowerCase();
  return JSON.stringify(q);
}

interface Candidate {
  q: SoloQuestionStep;
  key: string;
}

/** 영역마다 문제 종류별 후보 */
function candidates(steps: SoloStep[]): Record<TestArea, Map<SoloQuestionStep['t'], Candidate[]>> {
  const out = Object.fromEntries(TEST_AREAS.map((a) => [a, new Map<SoloQuestionStep['t'], Candidate[]>()])) as Record<TestArea, Map<SoloQuestionStep['t'], Candidate[]>>;
  const seen = new Set<string>();
  const put = (q: SoloQuestionStep) => {
    // 한두 글자 낱말(a·an·I)을 쓰기·받아쓰기로 내면 시험 문제로 너무 쉽거나 헷갈린다
    if ((q.t === 'typeWord' || q.t === 'dictation' || q.t === 'spell') && q.word.trim().length < 3) return;
    const key = keyOf(q);
    const id = `${q.t}|${key}`;
    if (seen.has(id)) return;
    seen.add(id);
    const m = out[AREA_OF[q.t]];
    m.set(q.t, [...(m.get(q.t) ?? []), { q, key }]);
  };
  const words = wordsFromSteps(steps);
  for (const area of TEST_AREAS) for (const type of WORD_TYPES[area]) buildWordBlock(type, words).forEach((s) => isTestQuestion(s) && put(s));
  // 수업에 이미 있는 문제(문장 문제는 낱말로 못 만드니 여기서만 나온다, 낱말이 적은 수업은 낱말 문제도 여기서)
  for (const s of steps) if (isTestQuestion(s)) put(fresh(s));
  return out;
}

/** 이 수업으로 만들 수 있는 시험 문제 수(최대) */
export function testCapacity(steps: SoloStep[]): number {
  const c = candidates(steps);
  return TEST_AREAS.reduce((n, a) => n + [...c[a].values()].reduce((k, l) => k + l.length, 0), 0);
}

/** 영역별 문제 수 나누기 — 몫대로 나누고, 후보가 모자란 영역의 몫은 남는 영역으로 */
function quotas(total: number, avail: Record<TestArea, number>): Record<TestArea, number> {
  const want = Math.min(total, TEST_AREAS.reduce((n, a) => n + avail[a], 0));
  const q = Object.fromEntries(TEST_AREAS.map((a) => [a, Math.min(avail[a], Math.round(want * AREA_SHARE[a]))])) as Record<TestArea, number>;
  let sum = TEST_AREAS.reduce((n, a) => n + q[a], 0);
  while (sum < want) {
    const a = [...TEST_AREAS].sort((x, y) => avail[y] - q[y] - (avail[x] - q[x]))[0];
    if (avail[a] - q[a] <= 0) break;
    q[a] += 1;
    sum += 1;
  }
  while (sum > want) {
    const a = [...TEST_AREAS].sort((x, y) => q[y] - q[x])[0];
    q[a] -= 1;
    sum -= 1;
  }
  return q;
}

export interface TestOptions {
  count: number;
  timed: boolean;
  title: string;
}

/** 시험 블록 하나를 만든다. 문제를 하나도 못 만들면 null. */
export function buildTestStep(steps: SoloStep[], opts: TestOptions): Extract<SoloStep, { t: 'test' }> | null {
  const pool = candidates(steps.filter((s) => s.t !== 'test'));
  const avail = Object.fromEntries(TEST_AREAS.map((a) => [a, [...pool[a].values()].reduce((n, l) => n + l.length, 0)])) as Record<TestArea, number>;
  const q = quotas(opts.count, avail);
  const used = new Set<string>();
  const items: SoloTestItem[] = [];
  for (const area of TEST_AREAS) {
    // 종류를 돌아가며 하나씩 — 같은 영역 안에서도 문제 모양이 섞이게
    const lists = [...pool[area].values()].map((l) => shuffle(l));
    let taken = 0;
    for (let guard = 0; taken < q[area] && lists.some((l) => l.length > 0) && guard < 500; guard++) {
      for (const l of lists) {
        if (taken >= q[area] || l.length === 0) continue;
        // 아직 안 나온 낱말·문장을 먼저
        const i = Math.max(0, l.findIndex((c) => !used.has(c.key)));
        const [c] = l.splice(i, 1);
        used.add(c.key);
        items.push({ ...c.q, area, sec: TEST_SECONDS[c.q.t] } as SoloTestItem);
        taken += 1;
      }
    }
  }
  if (items.length === 0) return null;
  return { t: 'test', title: opts.title, scope: 'lesson', timed: opts.timed, items };
}

/** 영역별 문제 수 */
export function areaCounts(items: { area: TestArea }[]): Record<TestArea, number> {
  const c = Object.fromEntries(TEST_AREAS.map((a) => [a, 0])) as Record<TestArea, number>;
  for (const it of items) c[it.area] += 1;
  return c;
}

/** 시험 예상 시간(초) — 문제 제한 시간의 합 + 문제마다 넘기는 시간 */
export const testSeconds = (items: { sec: number }[]): number => items.reduce((n, it) => n + it.sec + 4, 0) + 20;

/* ---------------- 채점 결과 ---------------- */

export interface TestResult {
  score: number;
  total: number;
  by_area: Partial<Record<TestArea, { right: number; total: number }>>;
  /** 문제마다: 맞았는지 + 정답 글자 */
  items: { correct: boolean; answer: string | null }[];
}

/** 미리보기용 채점(서버 058 과 같은 규칙) — 빈 답·시간 초과는 오답 */
export function gradeTestLocal(items: SoloTestItem[], answers: (string | null)[]): TestResult {
  const by_area: TestResult['by_area'] = {};
  let score = 0;
  const out = items.map((it, i) => {
    const v = answers[i];
    const correct = v !== null && v !== undefined && v !== '' && gradeSoloLocal(it, v) === true;
    if (correct) score += 1;
    const a = by_area[it.area] ?? { right: 0, total: 0 };
    by_area[it.area] = a;
    a.total += 1;
    if (correct) a.right += 1;
    return { correct, answer: soloCorrectText(it) };
  });
  return { score, total: items.length, by_area, items: out };
}
