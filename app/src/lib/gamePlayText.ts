/** 칸·프롬프트에 넣을 글이 짧은 단어인지, 문장인지. 전자칠판에서 글자 크기 전략을 나눌 때 쓴다. */
export function classifyPlayText(text: string): 'word' | 'sentence' {
  const t = text.trim();
  if (!t) return 'word';
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 4) return 'sentence';
  if (t.length >= 18) return 'sentence';
  if (words.length >= 2 && t.length >= 12) return 'sentence';
  return 'word';
}
