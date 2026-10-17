/**
 * 번개 피하기 캐릭터 6종(2026-10-16, 2026-10-17에 구글 AI 점토 그림으로 교체) — 번개를 맞으면 캐릭터마다 우스꽝스럽게 변한다
 * (PPT는 해골 하나뿐이었다). 그림은 `public/skins/lightning/c-<id>.webp`(평소)·`s-<id>.webp`(번개 맞은 모습).
 * 새 캐릭터 = CHARS 한 줄 + 두 그림 + 번역 `gameLightning.char_<id>`.
 */
export type CharKind = 'sheep' | 'boy' | 'girl' | 'umbrella' | 'zeus' | 'mermaid';
export const CHARS: { id: CharKind }[] = [{ id: 'sheep' }, { id: 'boy' }, { id: 'girl' }, { id: 'umbrella' }, { id: 'zeus' }, { id: 'mermaid' }];

export type CharMood = 'happy' | 'worried' | 'shocked' | 'cheer';

export const LT_IMG = (name: string) => `/skins/lightning/${name}.webp`;
export const charImage = (kind: CharKind, struck: boolean) => LT_IMG(`${struck ? 's' : 'c'}-${kind}`);
