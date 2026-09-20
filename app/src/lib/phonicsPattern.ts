/**
 * 파닉스 단어의 소리 규칙 표기 유틸. phonics_bank.pattern_marked 는 규칙 글자를 {} 로 감싼 문자열이다.
 *   "r{ai}n"   → r + [ai] + n
 *   "b{a}k{e}" → b + [a] + k + [e]   (비연속 규칙은 {} 가 여러 번 나온다)
 * 화면(사전 카드)과 파닉스 워크시트가 같은 파서를 쓴다.
 */
export interface PatternPart {
  text: string;
  marked?: boolean;
}

export function parsePattern(pattern: string): PatternPart[] {
  const parts: PatternPart[] = [];
  const re = /\{([^}]*)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(pattern))) {
    if (match.index > lastIndex) parts.push({ text: pattern.slice(lastIndex, match.index) });
    parts.push({ text: match[1], marked: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < pattern.length) parts.push({ text: pattern.slice(lastIndex) });
  return parts;
}

/** 규칙 글자 덩어리들(예: "b{a}k{e}" → ["a", "e"]). 표기가 없거나 규칙 글자가 없으면 빈 배열. */
export function markedGroups(pattern: string | null | undefined): string[] {
  if (!pattern) return [];
  return parsePattern(pattern)
    .filter((p) => p.marked && p.text)
    .map((p) => p.text);
}

/** 라임(끝소리) — 4글자 이상이면 끝 3글자, 아니면 끝 2글자(cat → "at", rain → "ain"). */
export function rimeOf(word: string): string | null {
  const letters = word.toLowerCase().replace(/[^a-z]/g, '');
  if (letters.length < 3) return null;
  return letters.slice(letters.length >= 4 ? -3 : -2);
}
