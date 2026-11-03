import { GRAMMAR_SHEET_BANK } from '../data/grammarSheets';
import type { GrammarSheetContent } from '../data/grammarSheets/types';
import { grammarPoint, plainText } from './grammar';
import { factorySources, verbRounds } from './grammarGames';
import { compareRounds, linkRounds, linkSentence } from './grammarGamesB';
import { condRounds, passiveRounds, shopRounds } from './grammarGamesC';
import { buildFactoryItems, type FactoryKind } from './sentenceFactory';
import { secondsOf } from './soloBoard';
import { buildSoloGrammarLesson, evenIndexes, type SoloStep } from './soloLessons';
import { wordTokens } from './writeBlocks';

/**
 * 개별수업 문법 문제 은행(2026-11-04): 단체수업 30분 수업에서 쓰는 워크북 자료·문장 공장·문법별 게임의 문제를
 * 개별수업의 기존 채점 단계(맞는 문장 고르기·오류 고치기·단어 배열 영작·조건 영작)로 바꾼다. 새 단계 종류·SQL 변경이 없다.
 * 어휘 능력으로 집계되지 않게 빈칸 고르기(fillBlank) 대신 "맞는 문장 고르기"(pickCorrect, 문장 능력)로 만든다.
 */
export interface SoloGrammarBank {
  /** 워크북 자료가 충분한 문법인지 */
  has: boolean;
  /** 빈칸 고르기(워크북 A·B) → 맞는 문장 고르기. a = A 세트, b = B 세트 */
  chooseA: SoloStep[];
  chooseB: SoloStep[];
  /** 틀린 곳 고치기(워크북 A·B 오류 문장) */
  fix: SoloStep[];
  /** 단어 배열 영작(워크북 추가 예문) */
  build: SoloStep[];
  /** 문장 공장 미션(과거·부정·의문·주어 바꾸기)을 단어 배열 영작으로 */
  factory: SoloStep[];
  /** 조건 영작 */
  write: SoloStep[];
  /** 문법별 게임(짝꿍·비교급·연결·수동태·조건문·장보기)의 문제를 맞는 문장 고르기로 */
  drills: SoloStep[];
}

const cleanKo = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '').trim();
const clean = (s: string) => plainText(s).replace(/\s+/g, ' ').trim();
/** 개별수업 저장 검사(fixSame)와 같은 비교 — 대소문자·문장부호만 다른 문장은 "고칠 곳이 없는 문제"라 뺀다 */
const loose = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim();

function shuffled<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 빈칸(____) 문장 + 보기 → 보기마다 문장을 완성한 "맞는 문장 고르기" */
function choose(p: string, c: string[], a: number, why: string): SoloStep | null {
  if (!p.includes('____') || c.length < 2 || a < 0 || a >= c.length) return null;
  const fill = (w: string) => p.replace('____', w).replace(/\s+/g, ' ').trim();
  const options = c.map(fill);
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return null;
  return { t: 'pickCorrect', options, answer: a, why };
}

function orderWrite(ko: string, en: string, seed: number): SoloStep | null {
  const toks = wordTokens(en);
  if (toks.length < 3 || toks.length > 12 || !ko) return null;
  let words = shuffled(toks, seed);
  for (let i = 0; i < 6 && words.join('|') === toks.join('|'); i++) words = shuffled(toks, seed + i + 1);
  return { t: 'orderWrite', ko, words, answer: en };
}

const FACTORY_KO: Record<FactoryKind, string> = {
  past: '과거형', present: '현재형', future: '미래형(will)', negative: '부정문', question: '의문문', subjectThey: '주어를 They 로 바꾼 문장', subjectHe: '주어를 He 로 바꾼 문장',
};

function drillStep(before: string, after: string, options: string[], answer: string, why: string): SoloStep | null {
  const sentences = options.map((o) => `${before} ${o} ${after}`.replace(/\s+/g, ' ').replace(/ ([.,?!])/g, '$1').trim());
  const idx = options.indexOf(answer);
  if (idx < 0 || new Set(sentences).size !== sentences.length) return null;
  return { t: 'pickCorrect', options: sentences, answer: idx, why };
}

export function soloGrammarBank(grammarId: string, seed = 1): SoloGrammarBank {
  const point = grammarPoint(grammarId);
  const sheet = GRAMMAR_SHEET_BANK[grammarId] as GrammarSheetContent | undefined;
  const empty: SoloGrammarBank = { has: false, chooseA: [], chooseB: [], fix: [], build: [], factory: [], write: [], drills: [] };
  if (!point || !sheet) return empty;

  const toSteps = (items: GrammarSheetContent['choose']) => items.map((it) => choose(it.p, it.c, it.a, it.why)).filter((x): x is SoloStep => !!x);
  const chooseA = toSteps(sheet.choose);
  const chooseB = toSteps(sheet.b?.choose ?? []);

  const seen = new Set<string>();
  const fix: SoloStep[] = [];
  for (const c of [...sheet.correct, ...(sheet.b?.correct ?? [])]) {
    const wrong = clean(c.w);
    const right = clean(c.r);
    if (!wrong || !right || loose(wrong) === loose(right) || seen.has(wrong)) continue;
    seen.add(wrong);
    fix.push({ t: 'fixError', wrong, right, why: clean(c.why), ko: '' });
  }

  const build = [...(sheet.buildExtra ?? []), ...(sheet.b?.build ?? [])]
    .map((b, i) => orderWrite(cleanKo(clean(b.ko)), clean(b.en), seed * 13 + i))
    .filter((x): x is SoloStep => !!x);

  const factory = buildFactoryItems(factorySources(grammarId), { perSentence: 3, max: 14 })
    .map((it, i) => orderWrite(`${FACTORY_KO[it.kind]}으로 바꿔 써요 → ${it.from}`, it.to, seed * 17 + i))
    .filter((x): x is SoloStep => !!x);

  const write: SoloStep[] = [...sheet.review, ...(sheet.b?.review ?? [])].map((r): SoloStep => {
    const model = clean(r.model);
    const n = wordTokens(model).length;
    return {
      t: 'condWrite', ko: clean(r.ko), model,
      conditions: [{ text: clean(r.cond) }, { text: `${Math.max(1, n - 2)}~${n + 3}단어로 쓸 것`, min: Math.max(1, n - 2), max: n + 3 }],
    };
  });

  const drills: SoloStep[] = [];
  for (const r of verbRounds(grammarId, seed, 6)) {
    const s = drillStep(r.before, r.after, r.options, r.answer, `주어가 ${r.subject}로 바뀌면 동사도 알맞게 바뀌어요.`);
    if (s) drills.push(s);
  }
  for (const r of compareRounds(grammarId, seed, 6)) {
    const s = drillStep(r.before, r.after, r.options, r.answer, r.kind === 'comp' ? '둘을 비교할 때는 -er(more)와 than 을 써요.' : '셋 이상 중 가장 …할 때는 the + -est(most)를 써요.');
    if (s) drills.push(s);
  }
  for (const r of linkRounds(grammarId, seed, 6)) {
    const sentences = r.options.map((o) => linkSentence(r.a, o, r.b));
    const idx = r.options.indexOf(r.answer);
    if (idx >= 0) drills.push({ t: 'pickCorrect', options: sentences, answer: idx, why: 'because 뒤에는 이유, so 뒤에는 결과가 와요. and 는 비슷한 내용, but 은 반대 내용을 이어요.' });
  }
  for (const r of passiveRounds(grammarId, seed, 6)) {
    const s = drillStep(r.before, r.after, r.options, r.answer, '수동태 = be + 과거분사. 행동을 당한 것이 주어가 돼요.');
    if (s) drills.push(s);
  }
  for (const r of condRounds(grammarId, seed, 6)) {
    const s = drillStep(r.before, r.after, r.options, r.answer, 'if 절에는 현재형, 결과에는 will + 동사원형을 써요.');
    if (s) drills.push(s);
  }
  for (const r of shopRounds(grammarId, seed, 6)) {
    const s = drillStep(r.before, r.after, r.options, r.answer, r.explain[0]);
    if (s) drills.push(s);
  }

  const enough = chooseA.length >= 6 && fix.length >= 3 && write.length >= 3;
  return {
    has: enough,
    chooseA: shuffled(chooseA, seed), chooseB: shuffled(chooseB, seed + 1),
    fix, build: shuffled(build, seed + 2), factory, write: shuffled(write, seed + 3), drills: shuffled(drills, seed + 4),
  };
}

const evenPick = <T,>(arr: T[], n: number): T[] => (arr.length <= n ? arr : evenIndexes(arr.length, n).map((i) => arr[i]));

/**
 * 기본 개별수업의 문법 수업(약 25분): 예전 기본 구성(소개 → 규칙 → 예문 읽기 → 해석·맞는 문장 → 문장 배열하기)에
 * 워크북 빈칸·오류 고치기·영작·문장 공장·문법 게임 문제를 더한다. 그룹 나눔 화면 없이 한 줄로 이어 가는 짧은 수업 틀이다.
 * 3단계 틀·표준 50분 흐름은 예전 기본 수업(buildSoloGrammarLesson)을 그대로 재료로 쓰므로 그 함수는 바꾸지 않았다.
 */
export function buildBasicGrammarLesson(point: Parameters<typeof buildSoloGrammarLesson>[0]): ReturnType<typeof buildSoloGrammarLesson> {
  const base = buildSoloGrammarLesson(point);
  const bank = soloGrammarBank(point.id);
  if (!bank.has) return base;
  const tip = point.tip ?? point.explain;
  const withTip = (list: SoloStep[]): SoloStep[] =>
    list.map((st) => (st.t === 'pickCorrect' || st.t === 'orderWrite' || st.t === 'unscramble' ? ({ ...st, tip } as SoloStep) : st));
  // 예전 기본 구성은 마지막에 문장 배열하기가 몰려 있다 → 그 앞에 이해 문제를, 뒤에 쓰기 문제를 넣는다
  const firstUnscramble = base.steps.findIndex((st) => st.t === 'unscramble');
  const cut = firstUnscramble < 0 ? base.steps.length : firstUnscramble;
  const steps: SoloStep[] = [
    ...base.steps.slice(0, cut),
    ...withTip([...evenPick(bank.chooseA, 4), ...bank.drills.slice(0, 2)]),
    ...base.steps.slice(cut),
    ...evenPick(bank.fix, 3),
    ...withTip([...evenPick(bank.build, 1), ...evenPick(bank.factory, 2)]),
    ...evenPick(bank.write, 2),
  ];
  const minutes = Math.max(8, Math.round(steps.reduce((n, st) => n + secondsOf(st), 0) / 60));
  return { name: base.name, steps, minutes };
}
