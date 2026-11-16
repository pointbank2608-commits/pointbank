import { supabase } from './supabase';
import type { WordListItem, WordListKind } from './types';

export const AI_MATERIAL_COUNT_LIMIT = 30;
export type AiMaterialInput = { topic: string; grade: number; wordCount: number; sentenceCount: number };
type DraftItem = { text: string; meaning: string };
export type AiMaterialDraft = { words: DraftItem[]; sentences: DraftItem[] };
export type AiMaterialList = { id: string; kind: WordListKind; name: string; items: WordListItem[] };

function isDraftItems(items: unknown): items is DraftItem[] {
  return Array.isArray(items) && items.length <= AI_MATERIAL_COUNT_LIMIT && items.every(item =>
    typeof item?.text === 'string' && item.text.trim().length > 0 && item.text.length <= 100 &&
    typeof item?.meaning === 'string' && item.meaning.trim().length > 0 && item.meaning.length <= 160);
}

export async function generateAiMaterials(academy: string, input: AiMaterialInput): Promise<AiMaterialDraft> {
  const { data, error } = await supabase.functions.invoke<AiMaterialDraft>('extract-textbook', {
    body: { mode: 'generate', academy, ...input },
  });
  if (error) {
    const payload = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'extractionUnavailable');
  }
  if (!data || !isDraftItems(data.words) || !isDraftItems(data.sentences) || (!data.words.length && !data.sentences.length)) {
    throw new Error('extractionFailed');
  }
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
