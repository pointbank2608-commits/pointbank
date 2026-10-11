import { isIdiomEntry, WORD_BANK_CATEGORIES, WORD_LEVELS } from './wordBankCategories';
import type { FullCardItem, WordBankEntry } from './types';

/**
 * 교과과정 단어(2026-10-12) — 단어 사전(word_bank)을 학교급(초등·중등·고등) → 학년군 → 주제로 짜서, 주제마다 10개씩 끊어
 * "수업 세트"로 고르게 한다. 사전 자료는 그대로 쓰고(복사·삭제 없음) 이 파일은 묶는 규칙만 가진다.
 *  - 초등: 교육부 초등 필수 800(DAY 1~16, 번호 순) + Lv.1 유치~초2 / Lv.2 초3~4 / Lv.3 초5~6 / Lv.4 초등 확장
 *  - 중등: Lv.5(교육부 2022 기본어휘 중학) · 고등: Lv.6(고등)
 *  - 한 묶음은 10개(마지막이 5개 미만이면 앞 묶음에 합친다). 그림이 없어도 만든다(중·고등은 글자형 수업).
 */
export type WordSchoolId = 'elementary' | 'middle' | 'high';

export interface WordSetItem {
  id: string;
  title: string;
  entries: WordBankEntry[];
}

export interface WordUnit {
  id: string;
  label: string;
  count: number;
  sets: WordSetItem[];
}

export interface WordBand {
  id: string;
  label: string;
  hint: string;
  count: number;
  units: WordUnit[];
}

export interface WordSchool {
  id: WordSchoolId;
  ko: string;
  en: string;
  count: number;
  bands: WordBand[];
}

export const WORD_SET_SIZE = 10;
const MIN_SET = 5;

const lv = (e: WordBankEntry): number => e.level ?? 1;

/** 수업에 쓸 수 있는 낱말인지: 숙어·표현이 아니고 뜻이 있는 첫 번째 뜻 */
const eligible = (e: WordBankEntry): boolean => !isIdiomEntry(e) && !!e.meaning?.trim() && !!e.word?.trim();

/** 같은 낱말은 한 번만(뜻 번호가 낮은 것, 그림이 있는 것 먼저) */
function dedupe(list: WordBankEntry[]): WordBankEntry[] {
  const best = new Map<string, WordBankEntry>();
  for (const e of list) {
    const k = e.word.trim().toLowerCase();
    const prev = best.get(k);
    if (!prev || e.sense_number < prev.sense_number || (e.sense_number === prev.sense_number && !prev.image_url && e.image_url)) best.set(k, e);
  }
  return [...best.values()];
}

/** 10개씩 끊는다 — 마지막이 5개 미만이면 앞 묶음에 합친다 */
export function chunkWords<T>(list: T[], size = WORD_SET_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  if (out.length > 1 && out[out.length - 1].length < MIN_SET) {
    const last = out.pop() ?? [];
    out[out.length - 1].push(...last);
  }
  return out;
}

function makeSets(prefix: string, title: string, list: WordBankEntry[]): WordSetItem[] {
  const chunks = chunkWords(list);
  return chunks.map((entries, i) => ({
    id: `${prefix}-${i + 1}`,
    // "DAY 3 · 2/5", "동물 2/3"처럼 몇 번째인지 보이게
    title: chunks.length > 1 ? (prefix.startsWith('day-') ? `${title} · ${i + 1}/${chunks.length}` : `${title} ${i + 1}/${chunks.length}`) : title,
    entries,
  }));
}

const bySort = (a: WordBankEntry, b: WordBankEntry) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.word.localeCompare(b.word);

/** 분류 순서: 사전 카테고리 목록 순서 → 그 밖의 값은 뒤에 */
const catRank = (c: string) => {
  const i = (WORD_BANK_CATEGORIES as readonly string[]).indexOf(c);
  return i < 0 ? 999 : i;
};

/** 분류별 단위 — 5개 미만인 분류는 "기타 주제"로 모은다 */
function unitsByCategory(prefix: string, list: WordBankEntry[]): WordUnit[] {
  const map = new Map<string, WordBankEntry[]>();
  for (const e of list) {
    const c = e.category?.trim() || '기타';
    map.set(c, [...(map.get(c) ?? []), e]);
  }
  const units: WordUnit[] = [];
  const small: WordBankEntry[] = [];
  for (const [c, items] of [...map.entries()].sort((a, b) => catRank(a[0]) - catRank(b[0]) || a[0].localeCompare(b[0]))) {
    if (items.length < MIN_SET) {
      small.push(...items);
      continue;
    }
    const sorted = [...items].sort(bySort);
    units.push({ id: `${prefix}-${c}`, label: c, count: sorted.length, sets: makeSets(`${prefix}-${c}`, c, sorted) });
  }
  if (small.length > 0) {
    const sorted = small.sort(bySort);
    const sets = sorted.length >= MIN_SET ? makeSets(`${prefix}-etc`, '기타 주제', sorted) : [];
    if (sets.length > 0) units.push({ id: `${prefix}-etc`, label: '기타 주제', count: sorted.length, sets });
  }
  return units;
}

const bandOf = (id: string, label: string, hint: string, units: WordUnit[]): WordBand => ({
  id,
  label,
  hint,
  count: units.reduce((n, u) => n + u.count, 0),
  units,
});

/** 단어 사전 → 교과과정 단어 지도 */
export function buildCurriculumWords(bank: WordBankEntry[]): WordSchool[] {
  const ok = bank.filter(eligible);

  // 초등: 교육부 800 DAY
  const elem = ok.filter((e) => lv(e) <= 4);
  const dayMap = new Map<number, WordBankEntry[]>();
  for (const e of dedupe(ok.filter((x) => x.moe800_day != null))) dayMap.set(e.moe800_day as number, [...(dayMap.get(e.moe800_day as number) ?? []), e]);
  const dayUnits: WordUnit[] = [...dayMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, items]) => {
      const sorted = [...items].sort((a, b) => (a.moe800_no ?? 0) - (b.moe800_no ?? 0) || bySort(a, b));
      return { id: `day-${day}`, label: `DAY ${day}`, count: sorted.length, sets: makeSets(`day-${day}`, `DAY ${day}`, sorted) };
    });

  const elemBands: WordBand[] = [];
  if (dayUnits.length > 0) elemBands.push(bandOf('moe800', '교육부 초등 800', 'DAY별 50개 · 5수업', dayUnits));
  for (const level of [1, 2, 3, 4]) {
    const list = dedupe(elem.filter((e) => lv(e) === level));
    if (list.length === 0) continue;
    const meta = WORD_LEVELS.find((w) => w.level === level);
    elemBands.push(bandOf(`lv${level}`, meta?.label ?? `Lv.${level}`, meta?.hint ?? '', unitsByCategory(`lv${level}`, list)));
  }

  const middleList = dedupe(ok.filter((e) => lv(e) === 5));
  const highList = dedupe(ok.filter((e) => lv(e) >= 6));
  const middleBands = middleList.length > 0 ? [bandOf('lv5', 'Lv.5', '중학', unitsByCategory('lv5', middleList))] : [];
  const highBands = highList.length > 0 ? [bandOf('lv6', 'Lv.6', '고등', unitsByCategory('lv6', highList))] : [];

  const total = (bands: WordBand[]) => bands.reduce((n, b) => n + b.count, 0);
  return [
    { id: 'elementary', ko: '초등', en: 'Elementary', count: total(elemBands), bands: elemBands },
    { id: 'middle', ko: '중등', en: 'Middle school', count: total(middleBands), bands: middleBands },
    { id: 'high', ko: '고등', en: 'High school', count: total(highBands), bands: highBands },
  ];
}

/** 묶음의 낱말 → 수업 낱말 카드 */
export function setToCards(entries: WordBankEntry[]): FullCardItem[] {
  return entries.map((e) => ({
    id: crypto.randomUUID(),
    word: e.word,
    meaning: e.meaning,
    imageUrl: e.image_url,
    category: e.category,
    example: e.example_sentence,
    partOfSpeech: e.part_of_speech,
  }));
}
