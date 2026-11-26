import type { FullCardItem } from '../types';
import { newBlock } from './blocks';
import { lettersQ, matchupQs, reverseQ, shuffleWith } from './build';
import { flipDeckItem } from './memory';
import type { Material } from './materialPlan';
import type { HwItemDraft, HwQuestion } from './types';

export const reviewGameNames = {
  memory: ['메모리 매치', 'Memory match'],
  flip: ['카드 뒤집기', 'Flip cards'],
  guess: ['단어 맞추기', 'Word scramble'],
  shoot: ['단어 슈팅', 'Word targets'],
} as const;
export type ReviewGame = keyof typeof reviewGameNames;
export const reviewGames = Object.keys(reviewGameNames) as ReviewGame[];
export const reviewGameKey = (game: ReviewGame) => 'review-game:' + game;

export function isReviewGameGroup(item: HwItemDraft) {
  if (item.kind!=='game') return false;
  const b=item.config.block;
  if (!b?.groupKey) return false;
  if (b.type==='study') return b.groupKey===reviewGameKey('flip') && b.method==='flip';
  return b.type==='recall' && (
    (b.groupKey===reviewGameKey('memory') && item.config.game==='matchup') ||
    (b.groupKey===reviewGameKey('guess') && item.config.game==='anagram') ||
    (b.groupKey===reviewGameKey('shoot') && b.method==='review:shoot')
  );
}

export function reviewGameSource(materials: Material[], game: ReviewGame, en: boolean) {
  const selected = new Map<string, FullCardItem>();
  let hasSentences = false;
  for (const material of materials) {
    if (material.kind === 'frequent' || (material.kind === 'sentence' && game !== 'flip')) continue;
    for (const card of material.cards) {
      const word = card.word.trim(), meaning = card.meaning.trim();
      if (!word || !meaning || (game === 'guess' && !/^[a-z]{3,10}$/i.test(word))) continue;
      if (material.kind === 'sentence') hasSentences = true;
      selected.set(JSON.stringify([word.toLowerCase(),meaning]),card);
    }
  }
  const cards = [...selected.values()];
  const min = game === 'memory' || game === 'shoot' ? 2 : 1;
  let reason = '';
  if (cards.length < min) {
    if (game === 'guess') reason = en ? 'Choose a 3–10 letter English word.' : '영문 3~10글자인 단어가 필요해요.';
    else if (game === 'flip') reason = en ? 'Choose words or sentences with meanings.' : '뜻이 있는 단어나 문장을 선택해 주세요.';
    else reason = en ? 'Choose at least two words with meanings.' : '뜻이 있는 단어를 2개 이상 선택해 주세요.';
  } else if (game === 'memory') {
    const words = new Set(cards.map(card=>card.word.trim().toLowerCase()));
    const meanings = new Set(cards.map(card=>card.meaning.trim()));
    if (words.size !== cards.length || meanings.size !== cards.length) {
      reason = en ? 'Choose distinct words with different meanings.' : '단어와 뜻이 각각 겹치지 않게 선택해 주세요.';
    }
  } else if (game === 'shoot' && cards.some(card=>!cards.some(other=>
    other.word.trim().toLowerCase()!==card.word.trim().toLowerCase() && other.meaning.trim()!==card.meaning.trim()))) {
    reason=en?'Each target needs a different word and meaning as a distractor.':'각 과녁에 오답으로 쓸 다른 단어와 뜻이 필요해요.';
  }
  return {cards,hasSentences,reason};
}

// Each board needs at least two pairs. Leave two for the last board when six remain.
function memoryQuestions(cards: FullCardItem[]): HwQuestion[] {
  const shuffled = shuffleWith(cards, Math.random);
  const questions: HwQuestion[] = [];
  for (let start=0; start<shuffled.length;) {
    const size = shuffled.length-start===6 ? 4 : 5;
    const batch = shuffled.slice(start,start+size);
    questions.push(...matchupQs(batch,Math.random).map(q=>({...q,round:String(start)})));
    start+=batch.length;
  }
  return questions;
}

function gameItems(game: ReviewGame, cards: FullCardItem[], en: boolean): HwItemDraft[] {
  const items: HwItemDraft[] = [];
  if (game === 'flip') {
    // FlipDeck stores escaped lines in a block (60 cards / 4,800 characters).
    // Start a new deck before either limit so the source count always matches the shipped cards.
    let start=0;
    while (start<cards.length) {
      let size=Math.min(60,cards.length-start);
      let item=flipDeckItem(cards.slice(start,start+size),size,en);
      while (item && item.config.block?.count!==size && size>1) {
        size=Math.max(1,Math.floor(size/2));
        item=flipDeckItem(cards.slice(start,start+size),size,en);
      }
      if (!item || item.config.block?.count!==size) return [];
      items.push(item);
      start+=size;
    }
  } else {
    const questions = game==='memory' ? memoryQuestions(cards)
      : cards.map(card=>game==='guess' ? lettersQ(card,Math.random) : reverseQ(card,cards,Math.random));
    if (questions.some(q=>!q)) return [];
    const usable = questions.filter((q):q is HwQuestion=>!!q);
    for (let start=0; start<usable.length;) {
      let end=Math.min(start+200,usable.length);
      // Avoid splitting a board between two database rows.
      if (game==='memory' && end<usable.length) {
        while (end>start && usable[end-1].round===usable[end].round) end--;
      }
      const item=newBlock('recall');
      item.kind='game';
      if (game==='memory') item.config.game='matchup';
      if (game==='guess') item.config.game='anagram';
      if (game==='shoot') item.config.block!.method='review:shoot';
      item.content.questions=usable.slice(start,end);
      items.push(item);
      start=end;
    }
  }
  for (const item of items) {
    item.title=reviewGameNames[game][en?1:0];
    item.kind='game';
    item.config.block!.groupKey=reviewGameKey(game);
  }
  return items;
}

export function buildReviewGames(materials: Material[], games: ReviewGame[], en: boolean): {items:HwItemDraft[];issues:string[]} {
  const items: HwItemDraft[] = [], issues: string[] = [];
  for (const game of reviewGames.filter(game=>games.includes(game))) {
    const {cards,reason}=reviewGameSource(materials,game,en);
    const built=reason ? [] : gameItems(game,cards,en);
    if (!built.length) issues.push(reviewGameNames[game][en?1:0]+' · '+(reason || (en?'Check the length of these entries.':'선택 항목의 길이를 확인해 주세요.')));
    else items.push(...built);
  }
  return {items,issues};
}
