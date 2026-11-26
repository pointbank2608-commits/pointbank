import { supabase } from './supabase';
import { parseWorksheetFile, type WorksheetDocument } from './worksheetStudio';
import type { SourceMaterialOptions, TeachingDraft } from './teachingMaterials';

export const TEXTBOOK_MAX_BYTES = 10 * 1024 * 1024;
export const TEXTBOOK_MAX_FILES = 6;
export const TEXTBOOK_MAX_PDF_PAGES = 3;
export const TEXTBOOK_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const TEXTBOOK_BUCKET = 'textbook-originals';

interface TextbookOriginal {
  name: string;
  path: string;
  mime: string;
}
export interface TextbookBook {
  id: string;
  title: string;
}

export interface TextbookUnit {
  id: string;
  book_id: string;
  textbook: string;
  title: string;
  files: TextbookOriginal[];
  word_list_id: string | null;
  sentence_list_id: string | null;
}
export interface TextbookItem {
  text: string;
  meaning: string;
  page: number;
  meaningSuggested: boolean;
}
export interface TextbookExtraction {
  words: TextbookItem[];
  sentences: TextbookItem[];
  unclearPages: number[];
}
export interface TextbookWorksheet {
  id: string;
  document: WorksheetDocument;
}

export const textbookUnitName = (unit: TextbookUnit) => `${unit.textbook} · ${unit.title}`;
export const textbookLibraryPath = '/wordlists?tab=textbooks';
export const textbookBookPath = (book: string) => `${textbookLibraryPath}&book=${encodeURIComponent(book)}`;
export const textbookUnitPath = (unit: string) => `${textbookLibraryPath}&unit=${encodeURIComponent(unit)}`;
export function textbookWorksheetPath(unit: string, source?: string, sheet?: string) {
  const query = new URLSearchParams({ unit });
  if (source) query.set('source', source);
  if (sheet) query.set('sheet', sheet);
  return `/materials/worksheet?${query}`;
}

export async function fetchTextbookUnits(academy: string, owner: string): Promise<TextbookUnit[]> {
  const { data, error } = await supabase.from('textbook_units')
    .select('id,book_id,textbook,title,files,word_list_id,sentence_list_id')
    .eq('academy_id', academy).eq('created_by', owner).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchTextbookBooks(academy: string, owner: string): Promise<(TextbookBook & { unitCount: number })[]> {
  const { data, error } = await supabase.from('textbook_books').select('id,title,textbook_units(count)')
    .eq('academy_id', academy).eq('created_by', owner).order('created_at', { ascending: false }).order('id');
  if (error) throw error;
  return data.map(({ id, title, textbook_units }) => ({ id, title, unitCount: textbook_units[0]?.count ?? 0 }));
}

export async function fetchTextbookBook(academy: string, owner: string, bookId: string) {
  const { data, error } = await supabase.from('textbook_books').select('id,title,textbook_units(id,title)')
    .eq('academy_id', academy).eq('created_by', owner).eq('id', bookId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const units = data.textbook_units.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true })
    || a.id.localeCompare(b.id));
  return { id: data.id, title: data.title, units };
}

export async function fetchTextbookUnit(academy: string, owner: string, id: string): Promise<TextbookUnit | null> {
  const { data, error } = await supabase.from('textbook_units').select('id,book_id,textbook,title,files,word_list_id,sentence_list_id')
    .eq('academy_id', academy).eq('created_by', owner).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTextbookBook(academy: string, owner: string, title: string): Promise<TextbookBook> {
  const name = title.trim();
  const { data, error } = await supabase.from('textbook_books')
    .insert({ academy_id: academy, created_by: owner, title: name }).select('id,title').single();
  if (!error) return data;
  if (error.code !== '23505') throw error;
  const existing = await supabase.from('textbook_books').select('id,title')
    .eq('academy_id', academy).eq('created_by', owner).eq('title', name).single();
  if (existing.error) throw existing.error;
  return existing.data;
}

async function textbookForm(academy: string, files: File[], first: number, last: number) {
  const pdf = files[0]?.type === 'application/pdf';
  let images = files;
  if (pdf) {
    if (files.length !== 1 || !Number.isInteger(first) || !Number.isInteger(last) || first < 1
      || last < first || last > 1000 || last - first >= TEXTBOOK_MAX_PDF_PAGES) throw new Error('invalidPageRange');
    const { renderTextbookPdf } = await import('./textbookPdf');
    images = await renderTextbookPdf(files[0], first, last);
  }
  if (!images.length || images.length > TEXTBOOK_MAX_FILES
    || images.some(file => !file.type.startsWith('image/') || !file.size)
    || images.reduce((total, file) => total + file.size, 0) > TEXTBOOK_MAX_BYTES) throw new Error('invalidFiles');
  const body = new FormData();
  body.set('academy', academy);
  body.set('first', '1');
  body.set('last', String(images.length));
  images.forEach(file => body.append('files', file));
  return body;
}

async function requestExtraction<T>(body: FormData) {
  const { data, error } = await supabase.functions.invoke<T>('extract-textbook', { body });
  if (error) {
    const payload = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'extractionUnavailable');
  }
  return data;
}

export async function extractGrammar(academy: string, files: File[], first: number, last: number,
  audience: string, grade=audience==='elementary'?3:audience==='high'?10:7, count=5) {
  const body = await textbookForm(academy, files, first, last);
  body.set('mode', 'grammar');
  body.set('audience', audience);
  body.set('grammarGrade',String(grade));
  body.set('grammarCount',String(count));
  const result = await requestExtraction<{ content: import('./grammar').GrammarBoardContent }>(body);
  if (result?.content?.steps?.length !== 6 || !result.content.examples?.length || result.content.workshop?.version!==1 ||
    !result.content.steps.every(step=>step.practice)) throw new Error('extractionFailed');
  return result.content;
}

export async function extractTextbook(academy: string, files: File[], first: number, last: number,
  options?: SourceMaterialOptions): Promise<TextbookExtraction & Partial<TeachingDraft>> {
  const pdf = files[0]?.type === 'application/pdf';
  const body = await textbookForm(academy, files, first, last);
  if (options) body.set('options', JSON.stringify(options));
  const data = await requestExtraction<TextbookExtraction & Partial<TeachingDraft>>(body);
  if (!data || !Array.isArray(data.words) || !Array.isArray(data.sentences) || !Array.isArray(data.unclearPages)) {
    throw new Error('extractionFailed');
  }
  if (!pdf) return data;
  return { ...data,
    words: data.words.map(item => ({ ...item, page: first + item.page - 1 })),
    sentences: data.sentences.map(item => ({ ...item, page: first + item.page - 1 })),
    unclearPages: data.unclearPages.map(page => first + page - 1),
  };
}

export async function createTextbookCatalogUnit(id: string, book: string, title: string): Promise<TextbookUnit> {
  const { data, error } = await supabase.rpc('create_textbook_catalog_unit', {
    p_id: id, p_book_id: book, p_title: title.trim(),
  });
  if (error) throw error;
  return data as TextbookUnit;
}

export async function textbookOriginalUrl(file: TextbookOriginal) {
  const { data, error } = await supabase.storage.from(TEXTBOOK_BUCKET).createSignedUrl(file.path, 120);
  if (error) throw error;
  return data.signedUrl;
}

export async function fetchTextbookWorksheets(unitId: string): Promise<TextbookWorksheet[]> {
  const { data, error } = await supabase.from('textbook_worksheets').select('id,document')
    .eq('unit_id', unitId).order('updated_at', { ascending: false });
  if (error) throw error;
  return data.map(row => ({ id: row.id, document: parseWorksheetFile(row.document) }));
}

export async function fetchTextbookWorksheet(unitId: string, id: string): Promise<WorksheetDocument> {
  const { data, error } = await supabase.from('textbook_worksheets').select('document')
    .eq('unit_id', unitId).eq('id', id).single();
  if (error) throw error;
  return parseWorksheetFile(data.document);
}

export async function saveTextbookWorksheet(unitId: string, id: string, document: WorksheetDocument) {
  const { error } = await supabase.from('textbook_worksheets')
    .upsert({ id, unit_id: unitId, document: parseWorksheetFile(document), updated_at: new Date().toISOString() });
  if (error) throw error;
}
