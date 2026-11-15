import { useEffect, useMemo, useState } from 'react';
import type { WordBankEntry } from './types';
import { loadWordBank } from './wordBankCache';

type ExampleWord = { word: string; meaning: string; example?: string | null };
const normalize = (value: string) => value.trim().normalize('NFC');
const senseKey = (word: string, meaning: string) => JSON.stringify([normalize(word).toLowerCase(), normalize(meaning)]);

export function indexWorksheetExamples(entries: readonly WordBankEntry[]) {
  const examples = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.example_sentence?.trim() || !entry.meaning.trim()) continue;
    const key = senseKey(entry.word, entry.meaning);
    if (!examples.has(key)) examples.set(key, entry.example_sentence);
  }
  return examples;
}

export function fillWorksheetExamples<T extends ExampleWord>(words: T[], examples: ReadonlyMap<string, string>): T[] {
  let changed = false;
  const filled = words.map(word => {
    if (word.example?.trim() || !word.meaning.trim()) return word;
    const example = examples.get(senseKey(word.word, word.meaning));
    if (!example) return word;
    changed = true;
    return { ...word, example };
  });
  return changed ? filled : words;
}

export function useWorksheetExamples() {
  const [examples, setExamples] = useState<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    let active = true;
    void loadWordBank().then(entries => {
      if (active) setExamples(indexWorksheetExamples(entries));
    });
    return () => { active = false; };
  }, []);
  return useMemo(() => <T extends ExampleWord>(words: T[]) => fillWorksheetExamples(words, examples), [examples]);
}
