import { useEffect, useMemo, useState } from 'react';
import { fetchWordBank } from './api';
import type { FullCardItem, WordBankEntry } from './types';

/** 사전(word_bank)을 한 번만 받아 두고 여러 화면이 같이 쓴다. */
let wordBankPromise: Promise<WordBankEntry[]> | null = null;
export function loadWordBank(): Promise<WordBankEntry[]> {
  if (!wordBankPromise) wordBankPromise = fetchWordBank().catch(() => ((wordBankPromise = null), []));
  return wordBankPromise;
}

/**
 * 단어장 단어에 사전 정보(예문·품사·그림)를 채운다 — 단어장에는 예문이 저장돼 있지 않아서
 * "단어 소개" 슬라이드가 같은 낱말(뜻까지 같으면 그 뜻)의 사전 항목을 찾아 보충한다.
 */
export function useWordBankEnriched(cards: FullCardItem[]): FullCardItem[] {
  const [bank, setBank] = useState<WordBankEntry[] | null>(null);
  useEffect(() => {
    let alive = true;
    void loadWordBank().then((b) => alive && setBank(b));
    return () => {
      alive = false;
    };
  }, []);
  return useMemo(() => {
    if (!bank || bank.length === 0) return cards;
    const byWord = new Map<string, WordBankEntry[]>();
    for (const e of bank) {
      const k = e.word.trim().toLowerCase();
      byWord.set(k, [...(byWord.get(k) ?? []), e]);
    }
    return cards.map((c) => {
      const hits = byWord.get(c.word.trim().toLowerCase());
      if (!hits) return c;
      const hit = hits.find((h) => h.meaning.trim() === c.meaning.trim()) ?? hits[0];
      return {
        ...c,
        example: c.example ?? hit.example_sentence,
        partOfSpeech: c.partOfSpeech ?? hit.part_of_speech,
        imageUrl: c.imageUrl ?? hit.image_url,
      };
    });
  }, [bank, cards]);
}
