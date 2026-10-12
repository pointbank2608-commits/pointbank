import type { WordListItem } from './types';

/**
 * 문장 목록(066, 내 단어장의 "문장" 종류) — 항목 모양은 단어장과 같다: word = 영어 문장, meaning = 해석(없어도 됨).
 * 여러 문장을 한꺼번에 붙여 넣을 때 읽는 규칙을 여기 둔다(화면·테스트가 같이 쓴다).
 */
export interface ParsedSentence {
  sentence: string;
  meaning: string;
}

/** 줄 앞의 번호·글머리("1.", "2)", "-", "•")는 떼고, 영어 문장 | 해석 (탭도 가능)으로 나눈다 */
export function parseSentenceLines(text: string): ParsedSentence[] {
  const out: ParsedSentence[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim().replace(/^(?:\d+\s*[.)]|[-•*·])\s+/, '').trim();
    if (!line) continue;
    let sentence = line;
    let meaning = '';
    const cut = line.search(/\t|\s\|\s|\|/);
    if (cut >= 0) {
      sentence = line.slice(0, cut).trim();
      meaning = line.slice(cut).replace(/^[\t\s|]+/, '').trim();
    }
    // 영어 글자가 하나도 없으면(번호만 있는 줄 등) 문장이 아니다
    if (!/[A-Za-z]/.test(sentence)) continue;
    const key = sentence.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ sentence, meaning });
  }
  return out;
}

/** 이미 있는 항목과 같은 영어 문장(대소문자·공백 무시)은 빼고 새 항목만 */
export function newSentenceItems(existing: WordListItem[], parsed: ParsedSentence[], makeId: () => string): WordListItem[] {
  const have = new Set(existing.map((i) => i.word.toLowerCase().replace(/\s+/g, ' ').trim()));
  const out: WordListItem[] = [];
  for (const p of parsed) {
    const key = p.sentence.toLowerCase().replace(/\s+/g, ' ');
    if (have.has(key)) continue;
    have.add(key);
    out.push({ id: makeId(), word: p.sentence, meaning: p.meaning, image_url: null, category: null });
  }
  return out;
}
