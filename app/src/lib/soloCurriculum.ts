import { plainText, type GrammarPoint } from './grammar';
import { buildFixErrorSteps } from './grammarBlocks';
import { buildSoloGrammarLesson, buildWordBlock, evenIndexes, type SoloGameType, type SoloPass, type SoloStep } from './soloLessons';
import { buildTestStep } from './soloTest';
import { buildCondWriteSteps, buildOrderWriteSteps, sentencesFromPoints } from './writeBlocks';
import type { FullCardItem } from './types';

/**
 * 교과과정용 개별수업 "3단계 틀"(2026-10-13, 사용자 설계):
 *   1. 기본 개념  = 강의 카드 → 이해 문제 → 게임
 *   2. 심화 개념  = 강의 카드 → 심화 문제 → 게임
 *   3. 총정리     = 정리 카드 → 최종 테스트 → 게임
 * 한 차시가 슬라이드처럼 한 화면씩 넘어가고(문제 하나 = 화면 한 장), 그룹(숫자로 시작하는 나눔 화면)이 세 단계를 나눈다.
 * 새 단계 종류·서버 변경이 없다 — 강의 카드는 설명 카드(`rule`)·예문(`example`)·낱말 만나기(`meet`)로, 문제와 시험은 기존 블록으로 채운다.
 *
 * 아직 임시인 것: "게임"은 학생 혼자 하는 개인 게임 블록이 생기기 전이라 문장·낱말 빠르게 맞히기로 채운다(나중에 교체).
 * 합격선(다음 단계로 넘어가는 조건)과 "왜 틀렸는지" 팁은 다음 작업이다.
 */
/** 3단계 틀의 "게임" 자리에 넣는 선생님의 게임 템플릿(없으면 그 자리는 빠른 문제) */
export interface StagedGame {
  gameType: SoloGameType;
  templateId: string;
  title: string;
}
export interface StagedOptions {
  /** 기본·심화·총정리 순서의 세 자리 */
  games?: (StagedGame | null)[];
  /** 기본·심화 그룹에 붙일 합격선(없으면 기본값 "참고만 70%", null 이면 합격선 없음) — 총정리는 최종 테스트가 따로 있어 붙이지 않는다 */
  pass?: SoloPass | null;
}

export const DEFAULT_STAGED_PASS: SoloPass = { pct: 70, gate: false };
const passOf = (o: StagedOptions): SoloPass | null => (o.pass === undefined ? DEFAULT_STAGED_PASS : o.pass);

const gameStep = (g: StagedGame): SoloStep => ({ t: 'game', gameType: g.gameType, templateId: g.templateId, title: g.title });

interface Built {
  name: string;
  steps: SoloStep[];
  minutes: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = <T,>(arr: T[], n: number): T[] => (arr.length <= n ? arr : evenIndexes(arr.length, n).map((i) => arr[i]));

/** 그룹 나눔 화면(번호·제목·시간) */
const stage = (no: number, title: string, minutes: number, hint: string, pass?: SoloPass | null): SoloStep => ({
  t: 'intro',
  title: `${no}. ${title}`,
  text: `${minutes}분 · ${hint}`,
  ...(pass ? { pass } : {}),
});

/** 그룹 안의 작은 구역 이름(번호 없는 안내 화면) — 강의 / 문제 / 게임 */
const part = (title: string, text: string): SoloStep => ({ t: 'intro', title, text });

const totalMinutes = (steps: SoloStep[]): number =>
  steps.reduce((n, s) => {
    const m = s.t === 'intro' ? /^(\d+)분 · /.exec(s.text) : null;
    return n + (m ? Number(m[1]) : 0);
  }, 0);

const cleanKo = (s: string): string => s.replace(/\s*\([^)]*\)\s*$/, '').trim();

/** 한 줄 설명: 틀린 문장 → 고친 문장 */
const pitfallLine = (p: { wrong: string; right: string }): string =>
  `✗ ${plainText(p.wrong).replace(/\s*\([^)]*\)\s*$/, '').trim()}  →  ✓ ${plainText(p.right).replace(/\s*\([^)]*\)\s*$/, '').trim()}`;

/* ---------------- 문법 ---------------- */

export const STAGED_MIN_WORDS = 6;

/** 문법 항목 하나 → 3단계 수업 */
export function buildStagedGrammarLesson(point: GrammarPoint, opts: StagedOptions = {}): Built {
  const G = opts.games ?? [];
  const base = buildSoloGrammarLesson(point);
  const steps: SoloStep[] = [{ t: 'intro', title: point.name, text: point.tip ?? point.explain }];
  const examples = point.examples.map((e, i) => ({ sentence: plainText(e).trim(), ko: cleanKo((point.translations ?? [])[i] ?? '') })).filter((x) => x.sentence);
  const usage = [...(point.usage ?? [])].map(plainText);
  const detail = [...(point.detail ?? [])].map(plainText);
  const ruleLines = [...(point.rule ?? [])].map(plainText);
  const questions = (t: SoloStep['t']) => base.steps.filter((s) => s.t === t);

  // ── 1. 기본 개념 ──
  steps.push(stage(1, '기본 개념', 10, '규칙과 예문을 카드로 배워요', passOf(opts)));
  steps.push(part('강의', '카드를 한 장씩 넘기며 배워요'));
  steps.push({ t: 'rule', title: point.name, pattern: plainText(point.pattern), explain: point.explain, lines: usage.slice(0, 3), tip: '' });
  for (const e of examples.slice(0, 3)) steps.push({ t: 'example', sentence: e.sentence, ko: e.ko });
  steps.push(part('문제 풀기', '배운 것을 확인해요'));
  steps.push(...pick(questions('translatePick'), 3), ...pick(questions('pickCorrect'), 2));
  steps.push(part('게임', '문장을 조립하며 한 번 더 익혀요'));
  steps.push(...(G[0] ? [gameStep(G[0])] : pick(questions('unscramble'), 3)));

  // ── 2. 심화 개념 ──
  steps.push(stage(2, '심화 개념', 12, '쓰임과 틀리기 쉬운 것을 배워요', passOf(opts)));
  steps.push(part('강의', '더 자세히, 틀리기 쉬운 것까지 배워요'));
  const deep = detail.length > 0 ? detail : ruleLines;
  if (deep.length > 0) {
    steps.push({ t: 'rule', title: '쉽게 이해하기', pattern: deep[0], explain: deep[1] ?? '', lines: deep.slice(2, 6), tip: '' });
  }
  const pitfalls = (point.pitfalls ?? []).filter((p) => p.wrong && p.right);
  if (pitfalls.length > 0) {
    const first = pitfalls[0];
    steps.push({
      t: 'rule',
      title: '틀리기 쉬운 것',
      pattern: pitfallLine(first),
      explain: first.why ?? '',
      lines: pitfalls.slice(1, 4).map(pitfallLine),
      tip: '',
    });
  }
  for (const e of examples.slice(3, 5)) steps.push({ t: 'example', sentence: e.sentence, ko: e.ko });
  steps.push(part('문제 풀기', '틀린 곳을 고치고 직접 써 봐요'));
  steps.push(...buildFixErrorSteps([point.id], 3));
  const sents = sentencesFromPoints([point]);
  steps.push(...buildOrderWriteSteps(sents, 3), ...buildCondWriteSteps(sents, 1));
  steps.push(part('게임', '소리 내어 말하며 한 번 더 익혀요'));
  steps.push(...(G[1] ? [gameStep(G[1])] : pick(questions('fadeRead'), 3)));

  // ── 3. 총정리 ──
  steps.push(stage(3, '총정리와 최종 테스트', 12, '한 줄로 정리하고 시험을 봐요'));
  steps.push(part('정리', '오늘 배운 것을 한 장으로 정리해요'));
  steps.push({ t: 'rule', title: '한 줄 정리', pattern: point.tip ?? plainText(point.pattern), explain: point.explain, lines: usage.slice(0, 3), tip: '' });
  const test = buildTestStep(steps, { count: 10, timed: false, title: '최종 테스트' });
  if (test) {
    steps.push(part('최종 테스트', '오늘 배운 것으로 시험을 봐요'));
    steps.push(test);
  }
  steps.push(part('게임', '마지막으로 빠르게 확인해요'));
  steps.push(...(G[2] ? [gameStep(G[2])] : pick(shuffle([...questions('translatePick'), ...questions('pickCorrect'), ...questions('unscramble')]), 4)));

  const tipText = point.tip ?? point.explain;
  const withTips = steps.map((st) =>
    (st.t === 'translatePick' || st.t === 'unscramble' || st.t === 'orderWrite' || st.t === 'pickCorrect') && !(st as { tip?: string }).tip && tipText
      ? ({ ...st, tip: tipText } as SoloStep)
      : st,
  );
  return { name: `${point.name} (3단계)`, steps: withTips, minutes: totalMinutes(withTips) };
}

/* ---------------- 단어·숙어·표현 ---------------- */

/** 낱말 묶음(6개 이상) → 3단계 수업 */
export function buildStagedWordLesson(title: string, words: FullCardItem[], opts: StagedOptions = {}): Built | null {
  const G = opts.games ?? [];
  const usable = words.filter((w) => w.word.trim() && w.meaning.trim());
  if (usable.length < STAGED_MIN_WORDS) return null;
  const steps: SoloStep[] = [{ t: 'intro', title, text: `${usable.length}` }];

  // ── 1. 기본 개념 ──
  steps.push(stage(1, '기본 개념', 10, '낱말을 만나고 뜻을 익혀요', passOf(opts)));
  steps.push(part('강의', '낱말 카드를 한 장씩 넘기며 만나요'));
  steps.push(...buildWordBlock('meet', usable));
  steps.push(part('문제 풀기', '뜻과 소리를 확인해요'));
  steps.push(...pick(buildWordBlock('pickWord', usable), 5), ...pick(buildWordBlock('pickMeaning', usable), 4), ...pick(buildWordBlock('listenPick', usable), 4));
  steps.push(part('게임', '빠르게 맞혀 봐요'));
  steps.push(...(G[0] ? [gameStep(G[0])] : pick(shuffle([...buildWordBlock('pickWord', usable), ...buildWordBlock('listenPick', usable)]), 6)));

  // ── 2. 심화 개념 ──
  steps.push(stage(2, '심화 개념', 12, '문장 속 쓰임과 철자를 익혀요', passOf(opts)));
  steps.push(part('강의', '문장 속에서 어떻게 쓰이는지 봐요'));
  const withExample = usable.filter((w) => w.example && w.example.trim().split(/\s+/).length >= 3 && w.example.trim().split(/\s+/).length <= 10);
  for (const w of pick(shuffle(withExample), 5)) steps.push({ t: 'example', sentence: (w.example as string).trim(), ko: '' });
  steps.push(part('문제 풀기', '문장 속 낱말과 철자를 확인해요'));
  steps.push(...pick(buildWordBlock('pickPos', usable), 4), ...pick(buildWordBlock('fillBlank', usable), 5), ...pick(buildWordBlock('spell', usable), 4), ...pick(buildWordBlock('typeWord', usable), 4));
  steps.push(part('게임', '잘 듣고 써 봐요'));
  steps.push(...(G[1] ? [gameStep(G[1])] : pick(buildWordBlock('dictation', usable), 5)));

  // ── 3. 총정리 ──
  steps.push(stage(3, '총정리와 최종 테스트', 12, '한 번에 정리하고 시험을 봐요'));
  steps.push(part('정리', '오늘 배운 낱말을 한 장으로 정리해요'));
  steps.push({
    t: 'rule',
    title: '오늘 배운 낱말',
    pattern: `${usable.length}개`,
    explain: '아래 낱말을 소리 내어 읽어 보세요.',
    lines: usable.slice(0, 12).map((w) => `${w.word} — ${w.meaning}`),
    tip: '',
  });
  const test = buildTestStep(steps, { count: 10, timed: false, title: '최종 테스트' });
  if (test) {
    steps.push(part('최종 테스트', '오늘 배운 낱말로 시험을 봐요'));
    steps.push(test);
  }
  steps.push(part('게임', '마지막으로 빠르게 확인해요'));
  steps.push(...(G[2] ? [gameStep(G[2])] : pick(shuffle([...buildWordBlock('pickWord', usable), ...buildWordBlock('listenPick', usable), ...buildWordBlock('pickMeaning', usable)]), 6)));

  return { name: `${title} (3단계)`, steps, minutes: totalMinutes(steps) };
}

/** 이 틀로 만든 수업인지(이름 끝의 "(3단계)") — 목록 표시용 */
export const isStagedName = (name: string): boolean => /\(3단계\)\s*$/.test(name);
