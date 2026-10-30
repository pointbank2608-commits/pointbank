/**
 * 숙제 내용 만들기(순수 함수) — 단어 카드·영상 장면 + 활동 구성(HwPlan) → 활동 목록(HwItemDraft[]).
 * 문제마다 서버 채점용 정답(correct)·스탯 태그(skill)·낱말 카드 스냅샷(card)을 담는다.
 * 빈칸 보기 고르기는 대회 퀴즈쇼의 규칙(pickBlankDistractors·blankSentence)을 그대로 쓴다.
 */
import { blankSentence, pickBlankDistractors } from '../liveQuiz';
import { parseShadowText } from '../shadowLines';
import type { FullCardItem } from '../types';
import type { HwCard, HwItemDraft, HwPlan, HwQuestion, HwShadowLine } from './types';
import { isMeaning } from './quality';

export const GEN_VERSION = 'hw2-2026-10';

/** 스탯 태그 — 041 learning_events.skill, 학습 카드 이름표와 같은 값 */
export const SKILL = {
  meaning: 'vocab.meaning',
  picture: 'vocab.picture',
  listen: 'listening.word',
  spelling: 'vocab.spelling',
  context: 'vocab.context',
  sentence: 'sentence.order',
  content: 'listening.content',
  // 개별수업·복습·시험에서 오는 세부 능력(060_solo_stats.sql 의 단계 → 능력 이름표와 같다)
  pos: 'vocab.pos',
  dictation: 'listening.dictation',
  readSentence: 'reading.sentence',
  situation: 'reading.situation',
  correct: 'sentence.correct',
} as const;

export type Rng = () => number;

export function shuffleWith<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const uid = () => crypto.randomUUID();
const clean = (s: string | null | undefined) => (s ?? '').trim();
const isLetters = (w: string) => /^[a-z]{3,10}$/i.test(w.trim());

export const cardOf = (c: FullCardItem): HwCard => ({ word: clean(c.word), meaning: clean(c.meaning), imageUrl: c.imageUrl ?? null, example: c.example ?? null });

const base = (c: FullCardItem, skill: string, difficulty = 1) => ({
  id: uid(),
  skill,
  word: clean(c.word),
  contentId: `word:${clean(c.word).toLowerCase()}`,
  difficulty,
  gen: GEN_VERSION,
  card: cardOf(c),
});

/** 오답 보기: 같은 뜻·같은 낱말을 빼고 무작위로 */
function otherValues(pool: FullCardItem[], c: FullCardItem, pick: (x: FullCardItem) => string, n: number, rng: Rng): string[] {
  const own = pick(c).toLowerCase();
  const seen = new Set<string>([own]);
  const out: string[] = [];
  for (const x of shuffleWith(pool, rng)) {
    const v = clean(pick(x));
    if (!v || seen.has(v.toLowerCase()) || clean(x.meaning) === clean(c.meaning)) continue;
    seen.add(v.toLowerCase());
    out.push(v);
    if (out.length >= n) break;
  }
  return out;
}

function choiceQ(c: FullCardItem, right: string, wrong: string[], rng: Rng, extra: Partial<HwQuestion> & { skill: string }): HwQuestion | null {
  if (wrong.length === 0) return null;
  const choices = shuffleWith([right, ...wrong], rng);
  return { ...base(c, extra.skill), qtype: 'choice', prompt: '', ...extra, choices, correct: choices.indexOf(right) };
}

export const meaningQ = (c: FullCardItem, pool: FullCardItem[], rng: Rng) =>
  isMeaning(c.meaning) ? choiceQ(c, clean(c.meaning), otherValues(pool.filter((x) => isMeaning(x.meaning)), c, (x) => x.meaning, 3, rng), rng, { skill: SKILL.meaning, style: 'meaning', prompt: clean(c.word), speak: clean(c.word) }) : null;

export const reverseQ = (c: FullCardItem, pool: FullCardItem[], rng: Rng) =>
  choiceQ(c, clean(c.word), otherValues(pool, c, (x) => x.word, 3, rng), rng, { skill: SKILL.meaning, style: 'reverse', prompt: clean(c.meaning) });

export const listenQ = (c: FullCardItem, pool: FullCardItem[], rng: Rng) =>
  choiceQ(c, clean(c.word), otherValues(pool, c, (x) => x.word, 3, rng), rng, { skill: SKILL.listen, style: 'listen', prompt: '', speak: clean(c.word), difficulty: 2 });

export const pictureQ = (c: FullCardItem, pool: FullCardItem[], rng: Rng) =>
  c.imageUrl ? choiceQ(c, clean(c.word), otherValues(pool, c, (x) => x.word, 3, rng), rng, { skill: SKILL.picture, style: 'picture', prompt: '', imageUrl: c.imageUrl }) : null;

export function blankQ(c: FullCardItem, pool: FullCardItem[], rng: Rng): HwQuestion | null {
  const sentence = blankSentence(c.example, c.word);
  if (!sentence) return null;
  const wrong = pickBlankDistractors(c, sentence, pool, 3);
  const q = choiceQ(c, clean(c.word), wrong, rng, { skill: SKILL.context, style: 'blank', prompt: sentence, sub: clean(c.meaning), difficulty: 2 });
  return q;
}

/** 예문 낱말 순서(3~8낱말) */
export function sentenceOrderQ(c: FullCardItem, rng: Rng): HwQuestion | null {
  const words = clean(c.example).split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 8) return null;
  let tokens = shuffleWith(words, rng);
  for (let i = 0; i < 6 && tokens.join(' ') === words.join(' '); i++) tokens = shuffleWith(words, rng);
  return { ...base(c, SKILL.sentence, 3), qtype: 'order', style: 'sentence', prompt: clean(c.meaning), tokens, correct: words, joiner: ' ' };
}

/** 글자 순서(애너그램) */
export function lettersQ(c: FullCardItem, rng: Rng): HwQuestion | null {
  const w = clean(c.word).toLowerCase();
  if (!isLetters(w)) return null;
  const letters = [...w];
  let tokens = shuffleWith(letters, rng);
  for (let i = 0; i < 8 && tokens.join('') === w; i++) tokens = shuffleWith(letters, rng);
  return { ...base(c, SKILL.spelling, 2), qtype: 'order', style: 'letters', prompt: clean(c.meaning), imageUrl: c.imageUrl ?? null, tokens, correct: letters, joiner: '' };
}

/** 철자 입력 */
export function spellQ(c: FullCardItem): HwQuestion | null {
  const w = clean(c.word);
  if (!/^[a-z][a-z' -]{1,20}$/i.test(w)) return null;
  return { ...base(c, SKILL.spelling, 3), qtype: 'text', style: 'spell', prompt: clean(c.meaning), imageUrl: c.imageUrl ?? null, speak: w, correct: w };
}


/** 두 낱말의 철자가 얼마나 비슷한지(글자 편집 거리) */
export function editDistance(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[y.length];
}

/** 섬광 카드: 낱말(과 뜻·그림)을 잠깐 보여 주고 가린 뒤, 떠올려 쓴다 */
export function flashQ(c: FullCardItem, ms = 1500): HwQuestion | null {
  const w = clean(c.word);
  if (!/^[a-z][a-z' -]{1,20}$/i.test(w)) return null;
  return { ...base(c, SKILL.spelling, 3), qtype: 'text', style: 'flash', prompt: w, sub: clean(c.meaning), imageUrl: c.imageUrl ?? null, speak: w, correct: w, flashMs: ms };
}

/** 점점 가리기: 낱말을 읽으며 글자가 하나씩 지워지고, 끝에는 모두 가려져 직접 쓴다 */
export function fadeQ(c: FullCardItem): HwQuestion | null {
  const w = clean(c.word);
  if (!/^[a-z][a-z' -]{2,20}$/i.test(w)) return null;
  return { ...base(c, SKILL.spelling, 3), qtype: 'text', style: 'fade', prompt: w, sub: clean(c.meaning), imageUrl: c.imageUrl ?? null, speak: w, correct: w };
}

/** 헷갈리는 짝: 철자가 비슷한 낱말들 속에서 뜻에 맞는 낱말 고르기(철자 거리가 가까운 것부터) */
export function confuseQ(c: FullCardItem, pool: FullCardItem[], rng: Rng, extraNear: string[] = []): HwQuestion | null {
  const w = clean(c.word);
  const near = new Map<string, number>();
  for (const x of pool) {
    const v = clean(x.word);
    if (!v || v.toLowerCase() === w.toLowerCase() || clean(x.meaning) === clean(c.meaning)) continue;
    near.set(v, editDistance(w, v));
  }
  for (const v of extraNear) if (v && v.toLowerCase() !== w.toLowerCase()) near.set(v, 0);
  const wrong = [...near.entries()].sort((a, b) => a[1] - b[1] || rng() - 0.5).slice(0, 3).map(([v]) => v);
  if (wrong.length < 2) return null;
  return choiceQ(c, w, wrong, rng, { skill: SKILL.meaning, style: 'confuse', prompt: clean(c.meaning), imageUrl: c.imageUrl ?? null, speak: w, difficulty: 3 });
}

/** 받아쓰기: 소리를 듣고 낱말을 직접 친다 */
export function dictationQ(c: FullCardItem): HwQuestion | null {
  const w = clean(c.word);
  if (!/^[a-z][a-z' -]{1,20}$/i.test(w)) return null;
  return { ...base(c, SKILL.dictation, 3), qtype: 'text', style: 'dictation', prompt: '', speak: w, correct: w };
}

/** 그림 보고 쓰기: 그림만 보고 낱말을 직접 친다(그림이 있는 낱말만) */
export function typePictureQ(c: FullCardItem): HwQuestion | null {
  const w = clean(c.word);
  if (!c.imageUrl || !/^[a-z][a-z' -]{1,20}$/i.test(w)) return null;
  return { ...base(c, SKILL.spelling, 2), qtype: 'text', style: 'typepic', prompt: '', imageUrl: c.imageUrl, correct: w };
}

/** 힌트 글자 보고 쓰기: 뜻과 첫·끝 글자(a _ _ _ e)를 보고 낱말을 직접 친다 */
export function hintQ(c: FullCardItem): HwQuestion | null {
  const w = clean(c.word);
  if (!/^[a-z][a-z' -]{2,20}$/i.test(w)) return null;
  const hint = [...w].map((ch, i) => (i === 0 || i === w.length - 1 || !/[a-z]/i.test(ch) ? ch : '_')).join(' ');
  return { ...base(c, SKILL.spelling, 2), qtype: 'text', style: 'hint', prompt: clean(c.meaning), sub: hint, imageUrl: c.imageUrl ?? null, speak: w, correct: w };
}

/** 따라 쓰기: 낱말을 보면서(소리도 들으며) 똑같이 친다 — 가장 쉬운 타이핑 */
export function copyQ(c: FullCardItem): HwQuestion | null {
  const w = clean(c.word);
  if (!/^[a-z][a-z' -]{1,20}$/i.test(w)) return null;
  return { ...base(c, SKILL.spelling, 1), qtype: 'text', style: 'copy', prompt: w, sub: clean(c.meaning), imageUrl: c.imageUrl ?? null, speak: w, correct: w };
}

/** 문장 카드: 영어 문장(낱말 3개 이상)과 우리말 뜻이 있는 카드 — 문장 목록에서 온 카드 */
export const isSentenceCard = (c: FullCardItem) => clean(c.word).split(/\s+/).filter(Boolean).length >= 3 && clean(c.meaning).length > 0;

/** 문장 정답: 원문과, 문장 안 쉼표·따옴표 같은 부호를 뺀 글(화면 자판으로 부호를 못 쳐도 맞게) — '/' 로 이어 서버가 둘 다 정답으로 본다 */
export function sentenceAnswer(sentence: string): string {
  const s = clean(sentence);
  const bare = s.replace(/[,;:"“”()]/g, '').replace(/\s+/g, ' ').trim();
  return bare !== s && !s.includes('/') ? `${s} / ${bare}` : s;
}

/** 맞다/아니다: "apple = 사과" 같은 짝이 맞는지 O·X 로 고른다(절반은 일부러 틀린 짝) */
export function oxQ(c: FullCardItem, pool: FullCardItem[], rng: Rng, wantTrue: boolean): HwQuestion | null {
  if (!isMeaning(c.meaning)) return null;
  let shown = clean(c.meaning);
  if (!wantTrue) {
    const other = otherValues(pool.filter((x) => isMeaning(x.meaning)), c, (x) => x.meaning, 1, rng)[0];
    if (!other) return null;
    shown = other;
  }
  return { ...base(c, SKILL.meaning, 1), qtype: 'choice', style: 'ox', prompt: `${clean(c.word)} = ${shown}`, speak: clean(c.word), choices: ['O', 'X'], correct: wantTrue ? 0 : 1 };
}

/** 한글 보고 영어 문장 쓰기(문장 카드) */
export function sentenceWriteQ(c: FullCardItem): HwQuestion | null {
  if (!isSentenceCard(c)) return null;
  const sentence = clean(c.word);
  return { ...base(c, SKILL.sentence, 3), qtype: 'text', style: 'swrite', prompt: clean(c.meaning), correct: sentenceAnswer(sentence), word: sentence };
}

/** 문장 지우며 읽기: 끝 낱말부터 가려지며 읽고, 마지막에는 문장 전체를 쓴다(문장 카드) */
export function sentenceFadeQ(c: FullCardItem): HwQuestion | null {
  if (!isSentenceCard(c)) return null;
  const sentence = clean(c.word);
  return { ...base(c, SKILL.sentence, 3), qtype: 'text', style: 'sfade', prompt: sentence, sub: clean(c.meaning), speak: sentence, correct: sentenceAnswer(sentence), word: sentence };
}

const frameKey = (s: string) => clean(s).toLowerCase().split(/\s+/).slice(0, 2).join(' ');

/** 틀 바꿔 쓰기: 같은 틀(처음 두 낱말이 같은 문장)의 보기 문장을 보고, 우리말에 맞는 다른 문장을 쓴다(문장 카드) */
export function frameQ(c: FullCardItem, pool: FullCardItem[], rng: Rng): HwQuestion | null {
  if (!isSentenceCard(c)) return null;
  const sentence = clean(c.word);
  const mates = pool.filter((x) => isSentenceCard(x) && clean(x.word) !== sentence && frameKey(x.word) === frameKey(sentence));
  if (mates.length === 0) return null;
  const model = shuffleWith(mates, rng)[0];
  return { ...base(c, SKILL.sentence, 2), qtype: 'text', style: 'frame', prompt: clean(c.meaning), sub: clean(model.word), correct: sentenceAnswer(sentence), word: sentence };
}

const withStyle = (q: HwQuestion | null, style: NonNullable<HwQuestion['style']>): HwQuestion | null => (q ? { ...q, style } : null);

/** 괴물 먹이기: 괴물이 말하는 뜻에 맞는 낱말을 먹인다(뜻 → 낱말 고르기를 괴물 모양으로) */
export const monsterQ = (c: FullCardItem, pool: FullCardItem[], rng: Rng) => withStyle(reverseQ(c, pool, rng), 'monster');
/** 단어 뽑기: 알맞은 캡슐을 뽑는다(그림이 있으면 그림 → 낱말, 없으면 뜻 → 낱말) */
export const clawQ = (c: FullCardItem, pool: FullCardItem[], rng: Rng) => withStyle(c.imageUrl ? pictureQ(c, pool, rng) : reverseQ(c, pool, rng), 'claw');
/** 미로 추격: 알맞은 길(낱말)을 고른다(문장 속 빈칸이 있으면 빈칸 → 낱말, 없으면 뜻 → 낱말) */
export const mazeQ = (c: FullCardItem, pool: FullCardItem[], rng: Rng) => withStyle(blankQ(c, pool, rng) ?? reverseQ(c, pool, rng), 'maze');
/** 비행기: 소리를 듣고 구름 위의 낱말을 고른다 */
export const planeQ = (c: FullCardItem, pool: FullCardItem[], rng: Rng) => withStyle(listenQ(c, pool, rng), 'plane');

/** 그룹 정렬: 이 낱말이 어느 주제(카테고리)인지 고른다 — 사전에서 담은 낱말처럼 주제가 있는 낱말만 */
export function groupQ(c: FullCardItem, pool: FullCardItem[], rng: Rng): HwQuestion | null {
  const cat = clean(c.category);
  if (!cat) return null;
  const others = [...new Set(pool.map((x) => clean(x.category)).filter((v) => v && v !== cat))];
  if (others.length < 1) return null;
  return choiceQ(c, cat, shuffleWith(others, rng).slice(0, 2), rng, { skill: SKILL.meaning, style: 'group', prompt: clean(c.word), speak: clean(c.word), difficulty: 2 });
}

/** 크로스워드: 뜻과 글자 칸(첫 글자 + 빈칸, 글자 수)을 보고 낱말을 쓴다 */
export function crossQ(c: FullCardItem): HwQuestion | null {
  const w = clean(c.word);
  if (!/^[a-z]{3,12}$/i.test(w)) return null;
  const boxes = [...w].map((ch, i) => (i === 0 ? ch : '_')).join(' ');
  return { ...base(c, SKILL.spelling, 2), qtype: 'text', style: 'cross', prompt: clean(c.meaning), sub: `${boxes}  (${w.length})`, imageUrl: c.imageUrl ?? null, speak: w, correct: w };
}

const sentenceOf = (c: FullCardItem) => (isSentenceCard(c) ? clean(c.word) : clean(c.example));

/** 문장 게임(문장 기차·로켓·탑·다리·Splash): 섞인 낱말을 순서대로 눌러 문장을 만든다 — 문장 목록의 문장, 또는 낱말의 예문 */
export function orderGameQ(c: FullCardItem, rng: Rng, style: 'train' | 'rocket' | 'tower' | 'bridge' | 'splash'): HwQuestion | null {
  const sentence = sentenceOf(c);
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 8) return null;
  let tokens = shuffleWith(words, rng);
  for (let i = 0; i < 6 && tokens.join(' ') === words.join(' '); i++) tokens = shuffleWith(words, rng);
  return { ...base(c, SKILL.sentence, 3), qtype: 'order', style, prompt: clean(c.meaning), sub: isSentenceCard(c) ? undefined : clean(c.word), tokens, correct: words, joiner: ' ', word: sentence };
}

/** 문법 탐정: 낱말 순서가 뒤바뀐 틀린 문장을 보고 바른 문장으로 고쳐 쓴다(끝 낱말은 그대로 두어 마침표를 지킨다) */
export function detectiveQ(c: FullCardItem): HwQuestion | null {
  const sentence = sentenceOf(c);
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 10) return null;
  const at = words.findIndex((w, i) => i <= words.length - 3 && w.toLowerCase() !== words[i + 1].toLowerCase());
  if (at < 0) return null;
  const wrong = [...words];
  [wrong[at], wrong[at + 1]] = [wrong[at + 1], wrong[at]];
  return { ...base(c, SKILL.correct, 3), qtype: 'text', style: 'detective', prompt: wrong.join(' '), sub: isSentenceCard(c) ? clean(c.meaning) : clean(c.meaning), correct: sentenceAnswer(sentence), word: sentence };
}

/** 두더지잡기: 소리를 듣고 두더지(보기) 중 맞는 낱말을 잡는다 — 듣고 고르기 문제를 두더지 모양으로 보여 준다 */
export const whackQ = (c: FullCardItem, pool: FullCardItem[], rng: Rng) =>
  choiceQ(c, clean(c.word), otherValues(pool, c, (x) => x.word, 3, rng), rng, { skill: SKILL.listen, style: 'whack', prompt: '', speak: clean(c.word), difficulty: 2 });

/** 단어 낚시: 낱말을 보고 알맞은 뜻(물고기)을 낚는다 */
export const fishQ = (c: FullCardItem, pool: FullCardItem[], rng: Rng) =>
  isMeaning(c.meaning) ? choiceQ(c, clean(c.meaning), otherValues(pool.filter((x) => isMeaning(x.meaning)), c, (x) => x.meaning, 3, rng), rng, { skill: SKILL.meaning, style: 'fish', prompt: clean(c.word), speak: clean(c.word) }) : null;

/** 풍선 터뜨리기: 뜻을 보고 알맞은 낱말 풍선을 터뜨린다 */
export const balloonQ = (c: FullCardItem, pool: FullCardItem[], rng: Rng) =>
  choiceQ(c, clean(c.word), otherValues(pool, c, (x) => x.word, 3, rng), rng, { skill: SKILL.meaning, style: 'balloon', prompt: clean(c.meaning), imageUrl: c.imageUrl ?? null });

/** 행맨: 글자를 하나씩 골라 낱말을 맞힌다(목숨 6개). 끝에 낱말 전체를 한 번 내고 서버가 처음 답을 채점한다 */
export function hangmanQ(c: FullCardItem): HwQuestion | null {
  const w = clean(c.word);
  if (!/^[a-z][a-z' -]{1,20}$/i.test(w)) return null;
  return { ...base(c, SKILL.spelling, 3), qtype: 'text', style: 'hangman', prompt: clean(c.meaning), imageUrl: c.imageUrl ?? null, speak: w, correct: w };
}

/** 매치업: 5개씩 한 판, 판마다 같은 뜻 보기(순서 같음) */
export function matchupQs(cards: FullCardItem[], rng: Rng): HwQuestion[] {
  const out: HwQuestion[] = [];
  for (let i = 0; i < cards.length; i += 5) {
    const chunk = cards.slice(i, i + 5);
    if (chunk.length < 2) break;
    const meanings = shuffleWith(
      chunk.map((c) => clean(c.meaning)),
      rng,
    );
    chunk.forEach((c) => out.push({ ...base(c, SKILL.meaning), qtype: 'choice', style: 'match', prompt: clean(c.word), choices: meanings, correct: meanings.indexOf(clean(c.meaning)), round: String(i / 5) }));
  }
  return out;
}

/** 쉐도잉 뒤 내용 확인: 질문마다 장면의 다른 질문들의 답을 오답 보기로 */
export interface ClipQuestion {
  q: string;
  a: string;
  qKo?: string;
  aKo?: string;
  /** 답이 나오는 장면의 시간(초) — 수업 묶음을 다시 맞춘 뒤에만 있다 */
  time?: number;
}

const STOP = new Set(['that', 'this', 'with', 'from', 'they', 'them', 'have', 'been', 'will', 'would', 'there', 'their', 'what', 'when', 'where', 'which', 'your', 'about', 'because']);
const wordsOf = (text: string): string[] => (text.toLowerCase().match(/[a-z']+/g) ?? []).filter((w) => w.length >= 4 && !STOP.has(w));

/**
 * 쉐도잉 숙제에 실제로 들어간 대사 범위 안에서 답이 나오는 질문만 남긴다 — 숙제 길이(5·10분)에 맞춰 대사를 앞에서 자르는데
 * 질문은 장면 전체에서 뽑아서 "읽지도 않은 내용이 문제로 나오는" 일이 있었다(2026-10-13 제보).
 * 질문에 장면 시간이 있으면 그 시간이 들어간 대사 범위 안인지로, 없으면 답의 낱말이 들어간 대사에 나오는지로 가린다.
 * 어느 쪽도 확인할 수 없는 질문은 뺀다. 반환은 원래 순서 번호와 함께(통계용 contentId).
 */
export function questionsWithin(questions: ClipQuestion[], lines: HwShadowLine[]): { q: ClipQuestion; index: number }[] {
  if (lines.length === 0) return [];
  const start = Math.min(...lines.map((l) => l.s));
  const end = Math.max(...lines.map((l) => l.e));
  const text = ' ' + lines.map((l) => l.en.toLowerCase()).join(' ') + ' ';
  const out: { q: ClipQuestion; index: number }[] = [];
  questions.forEach((q, index) => {
    if (typeof q.time === 'number') {
      if (q.time >= start - 2 && q.time <= end + 2) out.push({ q, index });
      return;
    }
    const toks = [...new Set(wordsOf(q.a))];
    if (toks.length === 0) return;
    // 변화형(stays → stay, wanted → want)도 같은 낱말로 본다
    const stem = (w: string) => {
      const r = w.replace(/(ing|ed|es|s)$/, '');
      return r.length >= 3 ? r : w;
    };
    const hit = toks.filter((w) => text.includes(w) || text.includes(stem(w))).length;
    if (hit / toks.length >= 0.6) out.push({ q, index });
  });
  return out;
}

/** 오답 보기는 장면 전체 질문의 답에서도 가져온다(문제로 나가지는 않는다) */
export function contentQs(questions: ClipQuestion[], rng: Rng, only?: { q: ClipQuestion; index: number }[]): HwQuestion[] {
  if (questions.length < 2) return [];
  const asked = only ?? questions.map((q, index) => ({ q, index }));
  return asked.map(({ q: x, index: i }) => {
    const wrong = questions.filter((_, j) => j !== i && questions[j].a !== x.a).map((y) => y.a);
    const choices = shuffleWith([x.a, ...wrong].slice(0, 4), rng);
    return {
      id: uid(),
      qtype: 'choice' as const,
      style: 'content' as const,
      prompt: x.q,
      sub: x.qKo,
      choices,
      correct: choices.indexOf(x.a),
      skill: SKILL.content,
      word: '',
      contentId: `clip-question:${i}`,
      difficulty: 2,
      gen: GEN_VERSION,
    };
  });
}

/** 카드를 n개 고르기(모자라면 다시 섞어 채우되 같은 활동에서 같은 낱말은 되도록 안 겹치게) */
export function takeCards(cards: FullCardItem[], n: number, rng: Rng, ok: (c: FullCardItem) => boolean = () => true): FullCardItem[] {
  const usable = cards.filter(ok);
  if (usable.length === 0 || n <= 0) return [];
  return shuffleWith(usable, rng).slice(0, Math.min(n, usable.length));
}

export interface ClipSource {
  id: string;
  youtube_id: string;
  title: string;
  script: string;
  pack?: { questions?: ClipQuestion[] } | null;
}

export interface BuildLabels {
  quiz: string;
  worksheet: string;
  matchup: string;
  anagram: string;
  spelling: string;
  shadowing: string;
}

/**
 * 유치원 친구용 숙제(2026-10-12): 영상 장면(있으면)이나 낱말의 예문을 한 문장씩 "듣고 → 따라 읽기" 한다.
 * 문제·채점이 없고 활동 하나(쉐도잉)만 나온다. 예문이 없는 낱말은 낱말 자체를 한 줄로 읽는다.
 */
export function buildKidsItems(cards: FullCardItem[], count: number, label: string, clip: ClipSource | null = null, rng: Rng = Math.random): HwItemDraft[] {
  const n = Math.max(1, count);
  if (clip) {
    const lines: HwShadowLine[] = parseShadowText(clip.script)
      .slice(0, n)
      .map((l) => ({ s: l.start, e: l.end, en: l.en.replace(/\*\*/g, ''), ko: l.ko || undefined, speaker: l.speaker }));
    if (lines.length === 0) return [];
    return [{ kind: 'shadowing', title: label, config: { kids: true }, content: { videoId: clip.youtube_id, ...(clip.id ? { clipId: clip.id } : {}), lines, questions: [] } }];
  }
  const pool = cards.filter((c) => clean(c.word) && clean(c.meaning));
  // 예문이 있는 낱말을 먼저, 모자라면 낱말 자체로 채운다
  const withExample = shuffleWith(pool.filter((c) => clean(c.example)), rng);
  const without = shuffleWith(pool.filter((c) => !clean(c.example)), rng);
  const lines: HwShadowLine[] = [...withExample, ...without].slice(0, n).map((c) => ({
    s: 0,
    e: 0,
    en: clean(c.example) || clean(c.word),
    ko: clean(c.example) ? clean(c.exampleKo) || clean(c.meaning) : clean(c.meaning),
  }));
  if (lines.length === 0) return [];
  return [{ kind: 'shadowing', title: label, config: { kids: true }, content: { lines, questions: [] } }];
}

/**
 * 유치원 영상 보기 숙제(2026-10-13): 유튜브 영상 몇 개를 끝까지 보면 끝난다. 문제·채점·대사표가 없다.
 * 활동 하나 = 영상 하나(쉐도잉 종류에 watch 표시만 붙여 서버·SQL 변경 없이 쓴다 — 문제가 0개라 item_complete 만 보내면 끝난다).
 */
export function buildWatchItems(videos: { id: string; title: string }[], label: string, targetViews = 1): HwItemDraft[] {
  const views = Math.max(1, Math.min(Math.round(targetViews) || 1, 10));
  return videos.map((v, i) => ({
    kind: 'shadowing' as const,
    title: v.title.trim() || `${label} ${i + 1}`,
    // targetViews: 한 영상을 몇 번 끝까지 보면 끝나는지(093 서버가 센다)
    config: { kids: true, watch: true, targetViews: views },
    content: { videoId: v.id, lines: [], questions: [] },
  }));
}

/** 활동 구성 → 활동 목록. 쉐도잉 → 단어 퀴즈 → 워크시트 → 게임 순서. 만들 수 없는 활동은 빠진다. */
export function buildItems(cards: FullCardItem[], plan: HwPlan, labels: BuildLabels, clip: ClipSource | null = null, rng: Rng = Math.random): HwItemDraft[] {
  const pool = cards.filter((c) => clean(c.word) && clean(c.meaning));
  const items: HwItemDraft[] = [];

  if (clip && plan.shadowLines > 0) {
    const lines: HwShadowLine[] = parseShadowText(clip.script)
      .slice(0, plan.shadowLines)
      .map((l) => ({ s: l.start, e: l.end, en: l.en.replace(/\*\*/g, ''), ko: l.ko || undefined, speaker: l.speaker }));
    if (lines.length > 0) {
      items.push({
        kind: 'shadowing',
        title: labels.shadowing,
        config: {},
        content: { videoId: clip.youtube_id, ...(clip.id ? { clipId: clip.id } : {}), lines, questions: plan.contentCheck ? contentQs(clip.pack?.questions ?? [], rng, questionsWithin(clip.pack?.questions ?? [], lines)) : [] },
      });
    }
  }

  const quiz: HwQuestion[] = [];
  for (const c of takeCards(pool, plan.quizMeaning, rng)) {
    const q = meaningQ(c, pool, rng);
    if (q) quiz.push(q);
  }
  for (const c of takeCards(pool, plan.quizListen, rng)) {
    const q = listenQ(c, pool, rng);
    if (q) quiz.push(q);
  }
  for (const c of takeCards(pool, plan.quizPicture, rng, (x) => !!x.imageUrl)) {
    const q = pictureQ(c, pool, rng);
    if (q) quiz.push(q);
  }
  if (quiz.length) items.push({ kind: 'quiz', title: labels.quiz, config: {}, content: { questions: quiz } });

  const sheet: HwQuestion[] = [];
  const sheets: ('choose' | 'blank' | 'order')[] = [];
  const chooseQs = takeCards(pool, plan.sheetChoose, rng)
    .map((c) => (c.imageUrl ? pictureQ(c, pool, rng) : reverseQ(c, pool, rng)))
    .filter((q): q is HwQuestion => !!q);
  if (chooseQs.length) sheets.push('choose');
  const blankQs = takeCards(pool, plan.sheetBlank, rng, (c) => !!blankSentence(c.example, c.word))
    .map((c) => blankQ(c, pool, rng))
    .filter((q): q is HwQuestion => !!q);
  if (blankQs.length) sheets.push('blank');
  let orderQs = takeCards(pool, plan.sheetOrder, rng, (c) => {
    const n = clean(c.example).split(/\s+/).filter(Boolean).length;
    return n >= 3 && n <= 8;
  })
    .map((c) => sentenceOrderQ(c, rng))
    .filter((q): q is HwQuestion => !!q);
  // 예문이 없는 단어장이면 글자 순서로 대신
  if (orderQs.length === 0 && plan.sheetOrder > 0)
    orderQs = takeCards(pool, plan.sheetOrder, rng, (c) => isLetters(c.word))
      .map((c) => lettersQ(c, rng))
      .filter((q): q is HwQuestion => !!q);
  if (orderQs.length) sheets.push('order');
  sheet.push(...chooseQs, ...blankQs, ...orderQs);
  if (sheet.length) items.push({ kind: 'worksheet', title: labels.worksheet, config: { sheets }, content: { questions: sheet } });

  if (plan.gameMatchup >= 2) {
    const qs = matchupQs(takeCards(pool, plan.gameMatchup, rng), rng);
    if (qs.length) items.push({ kind: 'game', title: labels.matchup, config: { game: 'matchup' }, content: { questions: qs } });
  }
  if (plan.gameAnagram > 0) {
    const qs = takeCards(pool, plan.gameAnagram, rng, (c) => isLetters(c.word))
      .map((c) => lettersQ(c, rng))
      .filter((q): q is HwQuestion => !!q);
    if (qs.length) items.push({ kind: 'game', title: labels.anagram, config: { game: 'anagram' }, content: { questions: qs } });
  }
  if (plan.gameSpelling > 0) {
    const qs = takeCards(pool, plan.gameSpelling, rng)
      .map((c) => spellQ(c))
      .filter((q): q is HwQuestion => !!q);
    if (qs.length) items.push({ kind: 'game', title: labels.spelling, config: { game: 'spelling' }, content: { questions: qs } });
  }
  return items;
}

/* ---------- 5·10·15분 추천 구성 ---------- */

export const EMPTY_PLAN: HwPlan = {
  quizMeaning: 0,
  quizListen: 0,
  quizPicture: 0,
  sheetChoose: 0,
  sheetBlank: 0,
  sheetOrder: 0,
  gameMatchup: 0,
  gameAnagram: 0,
  gameSpelling: 0,
  shadowLines: 0,
  contentCheck: false,
};

export type HwDuration = 5 | 10 | 15;

export function presetPlan(minutes: HwDuration, cards: FullCardItem[], hasClip: boolean): HwPlan {
  const hasExamples = cards.some((c) => !!blankSentence(c.example, c.word));
  const hasImages = cards.some((c) => !!c.imageUrl);
  if (hasClip) {
    if (minutes === 5) return { ...EMPTY_PLAN, shadowLines: 6, contentCheck: true };
    if (minutes === 10) return { ...EMPTY_PLAN, shadowLines: 10, contentCheck: true, quizMeaning: cards.length >= 4 ? 5 : 0 };
    return { ...EMPTY_PLAN, shadowLines: 16, contentCheck: true, quizMeaning: cards.length >= 4 ? 5 : 0, gameMatchup: cards.length >= 4 ? 5 : 0 };
  }
  if (minutes === 5) return { ...EMPTY_PLAN, quizMeaning: 5, gameMatchup: 5 };
  if (minutes === 10)
    return { ...EMPTY_PLAN, quizMeaning: 4, quizListen: 3, sheetBlank: hasExamples ? 3 : 0, sheetChoose: hasExamples ? 0 : 3, sheetOrder: 3, gameAnagram: 4 };
  return { ...EMPTY_PLAN, quizMeaning: 5, quizListen: 4, quizPicture: hasImages ? 3 : 0, sheetChoose: 4, sheetBlank: hasExamples ? 4 : 0, sheetOrder: 4, gameMatchup: 5, gameSpelling: 5 };
}

/** 예상 시간(분) — 문제마다 대략 걸리는 초를 더한다(5·10·15분 버튼 아래 안내와 확인 화면) */
export function estimateMinutes(items: HwItemDraft[]): number {
  let sec = 0;
  for (const it of items) {
    if (it.config.watch) sec += 240 * Math.max(1, Number(it.config.targetViews) || 1);
    else if (it.kind === 'shadowing') sec += (it.content.lines?.length ?? 0) * 45;
    for (const q of it.content.questions)
      sec += q.style === 'match' ? 12 : q.style === 'sentence' ? 40 : q.style === 'letters' ? 30 : q.style === 'spell' ? 35 : q.style === 'blank' ? 30 : q.style === 'content' ? 25 : 20;
  }
  return Math.max(1, Math.round(sec / 60));
}

export const countQuestions = (items: HwItemDraft[]) => items.reduce((n, it) => n + it.content.questions.length, 0);
