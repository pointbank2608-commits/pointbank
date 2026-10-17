/**
 * 새 게임 템플릿·빈 화면 시범에 넣는 영어 낱말(2026-10-17, 외부 평가: "빈 화면 예시가 '항목 1'·'단로 시작해요'면 게임 의도를 알 수 없다").
 * 사전에 있는 쉬운 낱말이라 단서·글자 게임이 바로 제대로 보인다.
 */
export const SAMPLE_WORDS = ['apple', 'banana', 'dog', 'cat', 'bird', 'book', 'pencil', 'school', 'water'];

export function sampleWord(n: number): string {
  return SAMPLE_WORDS[(Math.max(1, n) - 1) % SAMPLE_WORDS.length];
}
