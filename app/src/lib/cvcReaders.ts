import data from '../data/cvcReaders.json';

/**
 * "I Can Read" 읽기 카드 — 목표 단어 하나에 짧은 문장 하나(CVC 67개, 앞에서 배운 단어만 쓰도록 검수한 데이터).
 * 카드는 문장을 한 낱말씩 쌓아 올린 줄들(The / The cat / The cat is …)로 그려진다. 문장 검수는
 * `node app/scripts/vocab/validate-cvc-readers.mjs` 로 한다(데이터 수정 뒤 꼭 돌릴 것).
 */
export interface CvcReader {
  n: number;
  word: string;
  vowel: string;
  family: string;
  sentence: string;
}

export const CVC_READERS = data as CvcReader[];

export interface ReaderCard {
  /** 카드 고유 키(은행 카드는 번호, 직접 입력은 c1, c2 …) */
  key: string;
  /** 위에 크게 보여줄 목표 단어(직접 입력에서 생략하면 null) */
  word: string | null;
  sentence: string;
  /** 한 낱말씩 쌓아 올린 줄들 */
  lines: string[];
}

/** "The cat is on the mat." → ["The", "The cat", …, "The cat is on the mat."] (끝 구두점은 마지막 줄에만). */
export function sentenceLines(sentence: string): string[] {
  const text = sentence.trim();
  const punct = text.match(/[.!?]+$/)?.[0] ?? '';
  const tokens = text.replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean);
  return tokens.map((_, i) => tokens.slice(0, i + 1).join(' ') + (i === tokens.length - 1 ? punct : ''));
}

export function readerCardFromBank(r: CvcReader): ReaderCard {
  return { key: `b${r.n}`, word: r.word, sentence: r.sentence, lines: sentenceLines(r.sentence) };
}

/**
 * 직접 입력 파싱: 한 줄에 카드 하나. "cat: The cat is on the mat." 처럼 쓰면 앞의 cat 이 위에 크게 나오고,
 * 콜론 없이 문장만 쓰면 목표 단어 없이 문장만 나온다. 낱말이 2~10개인 줄만 쓴다.
 */
export function parseCustomReaders(text: string): ReaderCard[] {
  const out: ReaderCard[] = [];
  text.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const m = line.match(/^([^:]{1,20}):\s*(.+)$/);
    const word = m ? m[1].trim() : null;
    const sentence = (m ? m[2] : line).trim();
    const lines = sentenceLines(sentence);
    if (lines.length < 2 || lines.length > 10) return;
    out.push({ key: `c${out.length + 1}`, word, sentence, lines });
  });
  return out;
}

/** 파닉스에서 고른 단어 중 읽기 카드가 있는 번호들(없으면 빈 배열). */
export function readerIdsForWords(words: string[]): number[] {
  const set = new Set(words.map((w) => w.toLowerCase()));
  return CVC_READERS.filter((r) => set.has(r.word)).map((r) => r.n);
}
