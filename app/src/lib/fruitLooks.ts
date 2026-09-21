/**
 * 수박 문장 게임의 과일 생김새. 물리 크기(radius)는 토큰 개수,
 * 모양·색은 품사와 단수/복수(그리고 합쳐진 단계)로 나눈다.
 */
import type { SentenceSlot, SentenceToken } from './sentencePatterns';

export const FRUIT_KINDS = [
  'blueberry',
  'grape',
  'lemon',
  'apple',
  'orange',
  'peach',
  'melon',
  'watermelon',
  'plum',
] as const;

export type FruitKind = (typeof FRUIT_KINDS)[number];

export const FRUIT_LOOKS: Record<FruitKind, { fill: string; leaf: string }> = {
  blueberry: { fill: '#6b8cce', leaf: '#2d6a4f' },
  grape: { fill: '#8b6bb8', leaf: '#2d6a4f' },
  lemon: { fill: '#f4d35e', leaf: '#40916c' },
  apple: { fill: '#f07167', leaf: '#2d6a4f' },
  orange: { fill: '#f4a261', leaf: '#2d6a4f' },
  peach: { fill: '#ffb4a2', leaf: '#2d6a4f' },
  melon: { fill: '#95d5b2', leaf: '#1b4332' },
  watermelon: { fill: '#40916c', leaf: '#1b4332' },
  plum: { fill: '#c77dff', leaf: '#2d6a4f' },
};

const PLURAL_PRONOUNS = new Set(['we', 'they', 'these', 'those']);
const SINGULAR_PRONOUNS = new Set(['i', 'he', 'she', 'it', 'this', 'that', 'you']);
const IRREGULAR_PLURALS = new Set(['children', 'people', 'mice', 'men', 'women', 'teeth', 'feet', 'geese']);

/** 주어·목적어의 단수/복수. 동사는 품사 과일만 쓰고 여기선 복수로 보지 않는다. */
export function isPluralWord(word: string, slot: SentenceSlot): boolean {
  if (slot === 'verb' || slot === 'aux') return false;
  const head = word.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (!head) return false;
  if (PLURAL_PRONOUNS.has(head) || IRREGULAR_PLURALS.has(head)) return true;
  if (SINGULAR_PRONOUNS.has(head)) return false;
  if (head.endsWith('ss') || head.endsWith('us') || head.endsWith('is')) return false;
  return head.length > 2 && head.endsWith('s');
}

export function fruitKindForTokens(tokens: SentenceToken[]): FruitKind {
  if (tokens.length >= 4) return 'watermelon';
  if (tokens.length === 3) return 'melon';
  if (tokens.length === 2) return 'peach';
  const token = tokens[0];
  if (!token) return 'apple';
  const plural = isPluralWord(token.word, token.slot);
  switch (token.slot) {
    case 'subject':
      return plural ? 'grape' : 'blueberry';
    case 'verb':
    case 'aux':
      return 'lemon';
    case 'object':
    case 'complement':
      return plural ? 'orange' : 'apple';
    case 'prep':
    case 'adverb':
    case 'wh':
      return 'plum';
    default:
      return 'apple';
  }
}
