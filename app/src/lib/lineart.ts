import { LINEART_DECOR, LINEART_WORD_IDS } from './lineartManifest';

/** 사전 id 규칙과 같은 슬러그(예: "ice cream" → "ice-cream", "hot dog" → "hot-dog"). */
export function wordSlug(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const WORD_SET = new Set(LINEART_WORD_IDS);

/** 색칠용 선화가 있는 단어면 그림 경로, 없으면 null. */
export function lineartUrlForWord(word: string): string | null {
  const id = wordSlug(word);
  return WORD_SET.has(id) ? `/word-bank-lineart/${id}.webp` : null;
}

export const lineartWordCount = LINEART_WORD_IDS.length;

export function decorUrl(id: string): string {
  return `/word-bank-lineart/decor/${id}.webp`;
}

/** 선택 가능한 장식 주제(공통은 항상 포함되므로 뺀다). 실제 파일이 있는 주제만. */
export function decorThemes(): string[] {
  return Object.keys(LINEART_DECOR).filter((t) => t !== '공통');
}

/** 주제 하나를 고르면 그 주제 부품 + 공통 부품이 후보가 된다. */
export function decorIdsFor(theme: string | null): string[] {
  const common = LINEART_DECOR['공통'] ?? [];
  const own = theme ? (LINEART_DECOR[theme] ?? []) : [];
  return [...own, ...common];
}
