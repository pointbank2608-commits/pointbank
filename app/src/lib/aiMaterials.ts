import { supabase } from './supabase';
import type { WordListItem, WordListKind } from './types';
import type { WorksheetDocument } from './worksheetStudio';

export const AI_MATERIAL_COUNT_LIMIT = 30;
export type AiMaterialInput = { topic: string; grade: number; wordCount: number; sentenceCount: number };
type DraftItem = { text: string; meaning: string; page?: number; meaningSuggested?: boolean };
export type AiMaterialDraft = { words: DraftItem[]; sentences: DraftItem[] };
export type AiMaterialList = { id: string; kind: WordListKind; name: string; items: WordListItem[] };

function isDraftItems(items: unknown, limit: number): items is DraftItem[] {
  return Array.isArray(items) && items.length <= limit && items.every(item =>
    typeof item?.text === 'string' && item.text.trim().length > 0 && item.text.length <= 100 &&
    typeof item?.meaning === 'string' && item.meaning.trim().length > 0 && item.meaning.length <= 160);
}

export async function generateAiMaterials(academy: string, input: AiMaterialInput): Promise<AiMaterialDraft> {
  return requestAiMaterials({ mode: 'generate', academy, ...input }, AI_MATERIAL_COUNT_LIMIT);
}

export async function extractWorksheetMaterials(academy: string, document: WorksheetDocument): Promise<AiMaterialDraft> {
  const selected = document.selectedWordIds ? new Set(document.selectedWordIds) : null;
  const words = document.words.filter(word => !selected || selected.has(word.id));
  const sections = [
    ...words.map(word => [word.word, word.meaning, word.example].filter(Boolean).join(' — ')),
    document.passage,
    ...document.tasks.filter(task => !task.wordId || !selected || selected.has(task.wordId)).map(task => task.prompt),
  ];
  let source = '';
  for (const section of sections) {
    const text = section.trim();
    if (text && source.length + text.length + 1 <= 12000) source += `${text}\n`;
  }
  if (!source) throw new Error('noWorksheetText');
  return requestAiMaterials({ mode: 'worksheet', academy, source }, 40);
}

async function requestAiMaterials(body: object, limit: number): Promise<AiMaterialDraft> {
  const { data, error } = await supabase.functions.invoke<AiMaterialDraft>('extract-textbook', {
    body,
  });
  if (error) {
    const payload = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'extractionUnavailable');
  }
  if (!data || !isDraftItems(data.words, limit) || !isDraftItems(data.sentences, limit)) {
    throw new Error('extractionFailed');
  }
  if (!data.words.length && !data.sentences.length) throw new Error('noStudyItems');
  return data;
}

export function makeAiMaterialList(kind: WordListKind, name: string, items: DraftItem[]): AiMaterialList {
  return {
    id: crypto.randomUUID(), kind, name,
    items: items.map(({ text, meaning }) => ({
      id: crypto.randomUUID(), word: text.trim(), meaning: meaning.trim(), image_url: null, category: null,
    })),
  };
}

export async function saveAiMaterials(academy: string, owner: string, lists: AiMaterialList[]) {
  // One insert saves both lists atomically. The dialog retries the exact same rows and IDs
  // if the response is lost after the database committed.
  const { error } = await supabase.from('word_lists').upsert(lists.map(list => ({
    ...list, academy_id: academy, class_id: null, created_by: owner,
  })), { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
}
