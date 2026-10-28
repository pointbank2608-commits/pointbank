import type { GrammarSheetContent } from './types';

const modules = import.meta.glob('./bank/*.json', { eager: true, import: 'default' }) as Record<string, GrammarSheetContent[]>;

/** 문법 id → 시트 자료. bank 폴더의 모든 JSON 을 합친다. */
export const GRAMMAR_SHEET_BANK: Record<string, GrammarSheetContent> = {};
for (const list of Object.values(modules)) for (const item of list) GRAMMAR_SHEET_BANK[item.id] = item;
