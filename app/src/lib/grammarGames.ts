import { GRAMMAR_SHEET_BANK } from '../data/grammarSheets';
import type { GrammarSheetContent } from '../data/grammarSheets/types';
import { grammarPoint, plainText } from './grammar';
import { buildFactoryItems, type FactoryKind } from './sentenceFactory';
import { detectiveSuggestion } from './detectiveSuggestion';
import type { DetectiveCase } from './adventureGames';

/**
 * 문법별 게임(2026-11-03): 문법 항목 하나(grammarId)에서 규칙으로 문제를 만든다. 게임 템플릿에는 `config.grammarId` 만 저장한다.
 * 재료는 문법 데이터(예문·틀리기 쉬운 것)·워크북 자료(오류 고치기·조건 영작)·문장 공장이며, AI 로 새 문제를 쓰지 않는다.
 */
export const GRAMMAR_GAME_TYPES = ['grammarlab', 'grammarverb', 'grammarauction', 'grammarwrite', 'grammarpos', 'grammarframe', 'grammarcompare', 'grammarlink', 'grammarhabit'] as const;
export type GrammarGameType = (typeof GRAMMAR_GAME_TYPES)[number];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffleSeeded<T>(list: T[], seed: number): T[] {
  const r = rng(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const sheetOf = (id: string) => GRAMMAR_SHEET_BANK[id] as GrammarSheetContent | undefined;
const clean = (s: string) => plainText(s).replace(/\s+/g, ' ').trim();

/** 문장 공장에 넣을 원문: 예문 + 워크북 추가 예문 */
export function factorySources(grammarId: string): string[] {
  const point = grammarPoint(grammarId);
  if (!point) return [];
  const sheet = sheetOf(grammarId);
  const extra = [...(sheet?.buildExtra ?? []), ...(sheet?.b?.build ?? [])].map((x) => clean(x.en));
  return [...new Set([...point.examples.map(clean), ...extra])];
}

/* ---------- 문장 변신 연구소 ---------- */
export interface LabRound { id: string; from: string; kind: FactoryKind; to: string; chips: string[] }
const tokensOf = (s: string) => s.replace(/[.?]$/, '').split(/\s+/).filter(Boolean);
export const punctOf = (s: string) => (s.endsWith('?') ? '?' : '.');

export function labRounds(grammarId: string, seed = 1, max = 10): LabRound[] {
  const items = buildFactoryItems(factorySources(grammarId), { perSentence: 2, max: max * 2 });
  const rounds = items.map((it, i): LabRound => {
    const target = tokensOf(it.to);
    const have = new Set(target.map((x) => x.toLowerCase()));
    const decoys = tokensOf(it.from).filter((w) => !have.has(w.toLowerCase())).slice(0, 2);
    if (decoys.length < 2) for (const w of ['do', 'does', 'did', 'will', 'is', 'are']) { if (!have.has(w) && decoys.length < 2 && !decoys.includes(w)) decoys.push(w); }
    return { id: `lab-${i}`, from: it.from, kind: it.kind, to: it.to, chips: shuffleSeeded([...target, ...decoys], seed + i) };
  });
  return shuffleSeeded(rounds, seed).slice(0, max);
}

/* ---------- 주어·동사 짝꿍 ---------- */
export interface VerbRound { id: string; from: string; subject: 'They' | 'He'; before: string; after: string; answer: string; options: string[] }
const BE_FORMS = ['am', 'is', 'are', 'was', 'were'];
export function verbRounds(grammarId: string, seed = 1, max = 10): VerbRound[] {
  const out: VerbRound[] = [];
  const seen = new Set<string>();
  for (const src of factorySources(grammarId)) {
    const items = buildFactoryItems([src], { perSentence: 7, max: 7 }).filter((x) => x.kind === 'subjectThey' || x.kind === 'subjectHe');
    for (const it of items) {
      const a = tokensOf(it.from);
      const b = tokensOf(it.to);
      if (a.length !== b.length) continue;
      const diff = a.map((w, i) => (w !== b[i] ? i : -1)).filter((i) => i >= 0);
      if (diff.length !== 2 || diff[0] !== 0) continue;
      const vi = diff[1];
      const answer = b[vi];
      const original = a[vi];
      const pool = BE_FORMS.includes(answer.toLowerCase()) ? BE_FORMS : [answer.endsWith('s') ? answer.replace(/(es|s)$/, '') : `${answer}s`];
      const options = [...new Set([answer, original, ...pool])].filter((w) => w !== '').slice(0, 3);
      if (options.length < 3 && !options.includes(answer)) options.push(answer);
      if (options.length < 2) continue;
      const key = it.to;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `verb-${out.length}`,
        from: it.from,
        subject: it.kind === 'subjectThey' ? 'They' : 'He',
        before: b.slice(0, vi).join(' '),
        after: `${b.slice(vi + 1).join(' ')}${punctOf(it.to)}`.trim(),
        answer,
        options: shuffleSeeded(options, seed + out.length),
      });
      break; // 문장마다 하나
    }
  }
  return shuffleSeeded(out, seed).slice(0, max).map((r, i) => ({ ...r, id: `verb-${i}` }));
}

/* ---------- 문법 경매 ---------- */
export interface Lot { id: string; sentence: string; ok: boolean; fix: string | null; why: string }
export function auctionLots(grammarId: string, seed = 1, max = 8): Lot[] {
  const point = grammarPoint(grammarId);
  const sheet = sheetOf(grammarId);
  const pairs: { w: string; r: string; why: string }[] = [];
  for (const p of point?.pitfalls ?? []) pairs.push({ w: clean(p.wrong), r: clean(p.right), why: clean(p.why) });
  for (const c of [...(sheet?.correct ?? []), ...(sheet?.b?.correct ?? [])]) pairs.push({ w: clean(c.w), r: clean(c.r), why: clean(c.why) });
  const uniq = new Map<string, (typeof pairs)[number]>();
  for (const p of pairs) if (p.w && p.r && p.w !== p.r && !uniq.has(p.w)) uniq.set(p.w, p);
  const lots = [...uniq.values()].map((p, i): Lot => (i % 2 === 0
    ? { id: '', sentence: p.w, ok: false, fix: p.r, why: p.why }
    : { id: '', sentence: p.r, ok: true, fix: null, why: p.why }));
  return shuffleSeeded(lots, seed).slice(0, max).map((l, i) => ({ ...l, id: `lot-${i}` }));
}

/* ---------- 조건 영작 대결 ---------- */
export interface WriteRound { id: string; ko: string; cond: string; model: string }
export function writeRounds(grammarId: string, seed = 1, max = 8): WriteRound[] {
  const sheet = sheetOf(grammarId);
  const all = [...(sheet?.review ?? []), ...(sheet?.b?.review ?? [])];
  const uniq = new Map(all.map((r) => [r.model, r]));
  return shuffleSeeded([...uniq.values()], seed).slice(0, max).map((r, i) => ({ id: `write-${i}`, ko: clean(r.ko), cond: clean(r.cond), model: clean(r.model) }));
}

/* ---------- 문법 탐정 사건집 ---------- */
export function detectiveCases(grammarId: string, max = 10): DetectiveCase[] {
  const point = grammarPoint(grammarId);
  const sheet = sheetOf(grammarId);
  const pairs: { w: string; r: string; why: string }[] = [];
  for (const p of point?.pitfalls ?? []) pairs.push({ w: clean(p.wrong), r: clean(p.right), why: clean(p.why) });
  for (const c of [...(sheet?.correct ?? []), ...(sheet?.b?.correct ?? [])]) pairs.push({ w: clean(c.w), r: clean(c.r), why: clean(c.why) });
  const cases: DetectiveCase[] = [];
  const seen = new Set<string>();
  for (const p of pairs) {
    if (!p.w || !p.r || p.w === p.r || seen.has(p.w)) continue;
    const s = detectiveSuggestion(p.w, p.r);
    if (!s) continue;
    seen.add(p.w);
    const id = `case-${cases.length}`;
    cases.push({ id, incorrect: p.w, correct: p.r, errors: [{ id: `err-${id}`, ...s }], accepted: [], explanation: p.why });
    if (cases.length >= max) break;
  }
  return cases;
}
