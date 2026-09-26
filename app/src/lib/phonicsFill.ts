import { useEffect, useMemo, useState } from 'react';
import { fetchPhonicsBank } from './api';
import type { FullCardItem, PhonicsBankEntry } from './types';

/**
 * 파닉스 소리 규칙 표기(patternMarked) 채우기 — 2026-09-27 전에 단어장에 담은 파닉스 단어는 표기가 없다.
 * 같은 낱말이 파닉스 자료(phonics_bank)에 있으면 표기를 채워 준다. 소리 규칙(category)이 있으면 규칙까지
 * 같은 것만(같은 낱말이 여러 규칙에 있을 수 있어서), 없으면 첫 번째. 파닉스 자료는 한 번만 받아 둔다.
 */
let bankPromise: Promise<PhonicsBankEntry[]> | null = null;
export function loadPhonicsBank(): Promise<PhonicsBankEntry[]> {
  if (!bankPromise) bankPromise = fetchPhonicsBank().catch(() => ((bankPromise = null), []));
  return bankPromise;
}

/** loose=false(기본): 파닉스에서 담은 단어(category 가 소리 규칙)만 — 사전 단어 "cat" 에 파닉스 강조가 붙지 않게.
 * loose=true: 파닉스 워크시트처럼 파닉스로 쓰겠다고 정한 곳 — 낱말만 같아도 채운다. */
export function fillPhonicsMarks(cards: FullCardItem[], bank: PhonicsBankEntry[], loose = false): FullCardItem[] {
  if (bank.length === 0) return cards;
  const byWord = new Map<string, PhonicsBankEntry[]>();
  for (const e of bank) {
    const k = e.word.trim().toLowerCase();
    byWord.set(k, [...(byWord.get(k) ?? []), e]);
  }
  let changed = false;
  const out = cards.map((c) => {
    if (c.patternMarked) return c;
    const hits = byWord.get(c.word.trim().toLowerCase());
    if (!hits) return c;
    const sameRule = c.category ? hits.find((h) => h.rule === c.category) : undefined;
    const hit = sameRule ?? (loose ? hits[0] : undefined);
    if (!hit) return c;
    changed = true;
    return { ...c, patternMarked: hit.pattern_marked, category: c.category ?? hit.rule, imageUrl: c.imageUrl ?? hit.image_url };
  });
  return changed ? out : cards;
}

/** 카드 목록에 파닉스 표기를 채워서 돌려준다(처음엔 받은 그대로, 파닉스 자료가 오면 채운 것으로). */
export function usePhonicsFilled(cards: FullCardItem[], loose = false): FullCardItem[] {
  const [bank, setBank] = useState<PhonicsBankEntry[] | null>(null);
  const needs = cards.some((c) => !c.patternMarked);
  useEffect(() => {
    if (!needs || bank) return;
    let alive = true;
    void loadPhonicsBank().then((b) => alive && setBank(b));
    return () => {
      alive = false;
    };
  }, [needs, bank]);
  return useMemo(() => (bank ? fillPhonicsMarks(cards, bank, loose) : cards), [bank, cards, loose]);
}
