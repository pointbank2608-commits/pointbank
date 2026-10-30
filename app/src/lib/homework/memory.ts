/**
 * 암기 방식 블록(2026-10-30) — 낱말을 외우게 하는 방식 하나를 "기억해서 답하기" 블록으로 만든다.
 * 서버는 문제의 qtype(choice/text/order)과 정답만 보므로 새 SQL 없이, 문제 style 로 화면만 달라진다.
 * 블록에는 방식(method)과 문제 수(count)를 기억해 두어 편집기에서 같은 방식으로 다시 만들 수 있다.
 */
import { blankSentence } from '../liveQuiz';
import type { FullCardItem } from '../types';
import { blankQ, confuseQ, copyQ, dictationQ, fadeQ, flashQ, hintQ, lettersQ, listenQ, meaningQ, pictureQ, reverseQ, sentenceOrderQ, shuffleWith, spellQ, takeCards, typePictureQ, type Rng } from './build';
import { newBlock } from './blocks';
import type { HwItemDraft, HwQuestion } from './types';

export type MemoryMethod = 'meaning' | 'reverse' | 'listen' | 'picture' | 'blank' | 'spell' | 'letters' | 'sentence' | 'flash' | 'fade' | 'confuse' | 'graduate' | 'copy' | 'hint' | 'typepic' | 'dictation';

interface MethodInfo {
  name: [string, string];
  help: [string, string];
  /** 이 방식을 만들 수 있는 카드 조건 설명(안 되면 건너뜀) */
  build: (cards: FullCardItem[], pool: FullCardItem[], rng: Rng) => HwQuestion[];
}

const pick = (qs: (HwQuestion | null)[]) => qs.filter((q): q is HwQuestion => !!q);

export const MEMORY_METHODS: Record<MemoryMethod, MethodInfo> = {
  meaning: { name: ['단어 → 뜻 고르기', 'Word → meaning'], help: ['단어를 보고 뜻을 골라요', 'Pick the meaning'], build: (c, p, r) => pick(c.map((x) => meaningQ(x, p, r))) },
  reverse: { name: ['뜻 → 단어 고르기', 'Meaning → word'], help: ['뜻을 보고 단어를 골라요', 'Pick the word'], build: (c, p, r) => pick(c.map((x) => reverseQ(x, p, r))) },
  listen: { name: ['듣고 단어 고르기', 'Listen & pick'], help: ['소리를 듣고 단어를 골라요', 'Hear it, pick the word'], build: (c, p, r) => pick(c.map((x) => listenQ(x, p, r))) },
  picture: { name: ['그림 보고 고르기', 'Picture → word'], help: ['그림이 있는 낱말만 만들어져요', 'Words with pictures only'], build: (c, p, r) => pick(c.map((x) => pictureQ(x, p, r))) },
  blank: { name: ['문장 빈칸 채우기', 'Sentence blank'], help: ['예문이 있는 낱말만 만들어져요', 'Words with an example only'], build: (c, p, r) => pick(c.filter((x) => blankSentence(x.example, x.word)).map((x) => blankQ(x, p, r))) },
  spell: { name: ['뜻 보고 철자 쓰기', 'Write the spelling'], help: ['뜻을 보고 단어를 써요', 'Write the word'], build: (c) => pick(c.map((x) => spellQ(x))) },
  letters: { name: ['글자 순서 맞추기', 'Letter order'], help: ['섞인 글자를 순서대로 눌러요', 'Tap letters in order'], build: (c, _p, r) => pick(c.map((x) => lettersQ(x, r))) },
  sentence: { name: ['예문 순서 맞추기', 'Sentence order'], help: ['예문이 3~8낱말인 낱말만 만들어져요', 'Examples of 3–8 words'], build: (c, _p, r) => pick(c.map((x) => sentenceOrderQ(x, r))) },
  flash: { name: ['섬광 카드', 'Flash card'], help: ['낱말을 1.5초만 보여 주고 가린 뒤, 기억해서 써요', 'Shown for 1.5s, then write it'], build: (c) => pick(c.map((x) => flashQ(x))) },
  fade: { name: ['점점 가리기', 'Fading letters'], help: ['읽을 때마다 글자가 지워지고, 끝에는 모두 가려져서 직접 써요', 'Letters fade each round'], build: (c) => pick(c.map((x) => fadeQ(x))) },
  confuse: { name: ['헷갈리는 짝 고르기', 'Look-alike words'], help: ['철자가 비슷한 낱말 속에서 뜻에 맞는 낱말을 골라요', 'Pick among look-alike words'], build: (c, p, r) => pick(c.map((x) => confuseQ(x, p, r))) },
  copy: { name: ['따라 쓰기', 'Copy typing'], help: ['낱말을 보면서 똑같이 쳐요(가장 쉬운 타이핑)', 'Type the word while seeing it'], build: (c) => pick(c.map((x) => copyQ(x))) },
  hint: { name: ['힌트 글자 보고 쓰기', 'Type with letter hints'], help: ['뜻과 첫·끝 글자(a _ _ _ e)를 보고 쳐요', 'Meaning plus first/last letters'], build: (c) => pick(c.map((x) => hintQ(x))) },
  typepic: { name: ['그림 보고 쓰기', 'Picture typing'], help: ['그림만 보고 낱말을 쳐요(그림이 있는 낱말만)', 'Type from the picture only'], build: (c) => pick(c.map((x) => typePictureQ(x))) },
  dictation: { name: ['듣고 받아쓰기', 'Dictation'], help: ['소리를 듣고 낱말을 쳐요', 'Hear it, then type it'], build: (c) => pick(c.map((x) => dictationQ(x))) },
  graduate: { name: ['졸업 시험', 'Graduation test'], help: ['여러 방식을 섞어 마지막에 종합 확인해요', 'Mixed final check'], build: (c, p, r) => graduationQs(c, p, r) },
};

export const MEMORY_METHOD_LIST = Object.keys(MEMORY_METHODS) as MemoryMethod[];

/** 졸업 시험: 같은 낱말을 뜻·듣기·철자·문장 속 쓰임 가운데 낱말마다 다른 방식으로 한 번씩 묻는다 */
export function graduationQs(cards: FullCardItem[], pool: FullCardItem[], rng: Rng): HwQuestion[] {
  const order: MemoryMethod[] = ['reverse', 'listen', 'spell', 'blank', 'confuse', 'meaning'];
  const out: HwQuestion[] = [];
  shuffleWith(cards, rng).forEach((c, i) => {
    for (let k = 0; k < order.length; k++) {
      const m = order[(i + k) % order.length];
      const qs = MEMORY_METHODS[m].build([c], pool, rng);
      if (qs[0]) {
        out.push(qs[0]);
        break;
      }
    }
  });
  return out;
}

export const MAX_MEMORY_COUNT = 100;

/** 방식 하나로 문제 count 개(낱말이 모자라면 있는 만큼)를 만들어 기억해서 답하기 블록으로 감싼다. 만들 수 없으면 null */
export function memoryItemFromCards(cards: FullCardItem[], method: MemoryMethod, count: number, en = false, rng: Rng = Math.random): HwItemDraft | null {
  const usable = cards.filter((c) => c.word.trim() && c.meaning?.trim());
  const n = Math.max(1, Math.min(Math.round(count) || 1, MAX_MEMORY_COUNT));
  const info = MEMORY_METHODS[method];
  const questions = info.build(takeCards(usable, n, rng), usable, rng).slice(0, n);
  if (!questions.length) return null;
  const it = newBlock('recall');
  it.title = info.name[en ? 1 : 0];
  Object.assign(it.config.block!, { method, count: n });
  it.content = { questions };
  return it;
}
