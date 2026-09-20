/**
 * 사전 단어를 게임에 쓸 때의 글자 처리 규칙 — 화면에는 저장된 표기 그대로(T-shirt, o'clock,
 * New Year's Day, P.E., Korea) 보여주고, 글자를 다루는 게임(행맨·철자·애너그램·낱말 찾기·
 * 크로스워드·답 입력하기)만 여기 함수로 변환해서 쓴다. 게임마다 따로 고치면 34종에서 계속
 * 새는 곳이 생겨서 규칙을 한 곳에 모았다.
 *
 *  - 정답 비교: 대소문자·공백·구두점을 무시한다(`korea` 도 `Korea` 로 인정).
 *  - 행맨: 글자가 아닌 문자(공백 - ' .)는 처음부터 채워서 보여주고 추측 대상에서 뺀다.
 *  - 글자판 게임(낱말 찾기·크로스워드·애너그램): 구두점을 없애고 대문자로 통일한다.
 *    공백이 있는 구("ice cream")나 너무 짧거나 긴 단어는 이 게임에 안 맞으니 제외한다.
 */

const LETTER = /\p{L}/u;

/** 정답 비교용: 소문자 + 글자/숫자만 남긴다. */
export function normalizeForCompare(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** 정답 비교: 표기 차이(대소문자·공백·구두점)는 무시한다. */
export function sameAnswer(a: string, b: string): boolean {
  const na = normalizeForCompare(a);
  return na.length > 0 && na === normalizeForCompare(b);
}

/** 글자판 게임에서 쓸 글자 — 구두점을 없애고 대문자로. 공백이 있거나 길이가 범위를 벗어나면 null. */
export function toLetterGameText(text: string, { min = 2, max = 12 } = {}): string | null {
  const trimmed = text.normalize('NFKC').trim();
  if (/\s/.test(trimmed)) return null;
  const letters = trimmed.replace(/[^\p{L}]/gu, '');
  if (letters.length < min || letters.length > max) return null;
  return letters.toLocaleUpperCase();
}

export function isLetterGameEligible(text: string, range?: { min?: number; max?: number }): boolean {
  return toLetterGameText(text, range) !== null;
}

/** 행맨용: 글자별로 "추측해야 하는 글자"인지 "처음부터 보여줄 고정 문자"인지 나눈다. */
export function hangmanSlots(text: string): { ch: string; fixed: boolean }[] {
  return [...text.normalize('NFKC')].map((ch) => ({ ch, fixed: !LETTER.test(ch) }));
}
