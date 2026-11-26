import type { FullCardItem } from '../types';
import { gameItemFromCards, newBlock, SOLO_GAME_NAMES, type SoloGame } from './blocks';
import { detectiveSwapIndex, lettersQ, matchupQs, reverseQ, shuffleWith } from './build';
import { flipDeckItem } from './memory';
import type { Material } from './materialPlan';
import { isMeaning } from './quality';
import type { HwItemDraft, HwQuestion } from './types';

// Matchup and anagram already have material-review variants that keep every selected card.
const {matchup: _matchup, anagram: _anagram, ...otherSoloGames} = SOLO_GAME_NAMES;
export const reviewGameNames = {
  memory: ['메모리 매치', 'Memory match'],
  flip: ['카드 뒤집기', 'Flip cards'],
  guess: ['단어 맞추기', 'Word scramble'],
  shoot: ['단어 슈팅', 'Word targets'],
  ...otherSoloGames,
} as const;
export type ReviewGame = keyof typeof reviewGameNames;
export const reviewGames = Object.keys(reviewGameNames) as ReviewGame[];
export const reviewGameKey = (game: ReviewGame) => 'review-game:' + game;

type CatalogReviewGame = Exclude<SoloGame,'matchup'|'anagram'>;
function isCatalogGame(game: ReviewGame): game is CatalogReviewGame {
  return Object.hasOwn(otherSoloGames,game);
}
const sentenceGames = new Set<ReviewGame>(['train','rocket','tower','bridge','splash','detective']);
const choiceGames = new Set<ReviewGame>(['balloon','whack','fish','monster','claw','maze','plane','group']);

function selectedDialogue(material: Material): FullCardItem[] {
  const scene = material.scene;
  if (!scene) return [];
  return scene.lines
    .filter(line => line.s >= scene.start && line.e <= scene.end && line.e > line.s && line.en.trim() && line.ko?.trim())
    .map(line => ({
      id:JSON.stringify([material.id,line.s,line.e,line.en]), word:line.en, meaning:line.ko!, imageUrl:null,
    }));
}

export function isReviewGameGroup(item: HwItemDraft) {
  if (item.kind!=='game') return false;
  const b=item.config.block;
  if (!b?.groupKey) return false;
  if (b.type==='study') return b.groupKey===reviewGameKey('flip') && b.method==='flip';
  return b.type==='recall' && (
    (b.groupKey===reviewGameKey('memory') && item.config.game==='matchup') ||
    (b.groupKey===reviewGameKey('guess') && item.config.game==='anagram') ||
    (b.groupKey===reviewGameKey('shoot') && b.method==='review:shoot') ||
    (!!item.config.game && Object.hasOwn(otherSoloGames,item.config.game) && b.groupKey==='review-game:'+item.config.game)
  );
}

export function reviewGameSource(materials: Material[], game: ReviewGame, en: boolean) {
  const selected = new Map<string, FullCardItem>();
  let hasSentences = false;
  const sentences = sentenceGames.has(game);
  for (const material of materials) {
    if (material.kind === 'frequent' || (material.kind === 'sentence' && !sentences && game !== 'flip')) continue;
    // In an episode, the teacher checks individual dialogue lines. A word's incidental
    // dictionary example must never reintroduce a line that was left unchecked.
    let candidates = material.cards;
    if (material.kind === 'scene') {
      const dialogue = sentences || game==='flip' ? selectedDialogue(material) : [];
      candidates = sentences
        ? dialogue
        : [...material.cards.map(card => ({...card,example:null})), ...dialogue];
      if (dialogue.length && game==='flip') hasSentences=true;
    }
    for (const card of candidates) {
      const word = card.word.trim(), meaning = card.meaning.trim();
      if (!word || !meaning || (game === 'guess' && !/^[a-z]{3,10}$/i.test(word))) continue;
      let source: FullCardItem = card;
      if (sentences) {
        const fromExample = material.kind === 'word';
        const sentence = fromExample ? card.example?.trim() : word;
        if (!sentence) continue;
        const words = sentence.split(/\s+/);
        if (game==='detective' ? detectiveSwapIndex(words)<0 : words.length<3 || words.length>8 || new Set(words).size<2) continue;
        // Do not use a headword's Korean gloss as the translation of its example.
        if (fromExample && !card.exampleKo?.trim()) continue;
        source = fromExample ? {...card,word:sentence,meaning:card.exampleKo!.trim()} : card;
      }
      if ((game==='spelling' || game==='hangman') && !/^[a-z][a-z' -]{1,20}$/i.test(word)) continue;
      if (game==='cross' && !/^[a-z]{3,12}$/i.test(word)) continue;
      if (game==='fish' && !isMeaning(meaning)) continue;
      if (game==='group' && !card.category?.trim()) continue;
      if (material.kind === 'sentence' || sentences) hasSentences = true;
      selected.set(JSON.stringify([source.word.trim().toLowerCase(),source.meaning.trim()]),source);
    }
  }
  let cards = [...selected.values()];
  // A singleton can still participate when another selected source supplies distractors.
  // In a combined choice game discard only the ambiguous targets, not every usable pair.
  const needsWordOptions = choiceGames.has(game) && game !== 'group';
  const hasDistractor = (card: FullCardItem) => cards.some(other =>
    other.word.trim().toLowerCase() !== card.word.trim().toLowerCase() &&
    other.meaning.trim().toLowerCase() !== card.meaning.trim().toLowerCase());
  if (needsWordOptions && cards.length > 1) cards = cards.filter(hasDistractor);
  const min = game === 'memory' || game === 'shoot' || choiceGames.has(game) ? 2 : 1;
  let reason = '';
  if (game==='group' && new Set(cards.map(card=>card.category?.trim())).size<2) {
    reason = en ? 'Choose words from at least two topics.' : '서로 다른 주제가 있는 단어를 선택해 주세요.';
  } else if (cards.length < min) {
    if (game === 'guess') reason = en ? 'Choose a 3–10 letter English word.' : '영문 3~10글자인 단어가 필요해요.';
    else if (sentences) {
      const max = game === 'detective' ? 10 : 8;
      reason = en ? `Choose a translated sentence with 3–${max} words.` : `뜻이 있는 3~${max}단어 문장이나 대사를 선택해 주세요.`;
    }
    else if (game === 'cross') reason = en ? 'Choose a 3–12 letter English word.' : '영문 3~12글자인 단어가 필요해요.';
    else if (game === 'spelling' || game === 'hangman') reason = en ? 'Choose an English word of 2–21 characters.' : '영문 2~21글자인 단어가 필요해요.';
    else if (game === 'flip') reason = en ? 'Choose words or sentences with meanings.' : '뜻이 있는 단어나 문장을 선택해 주세요.';
    else reason = en ? 'Choose at least two words with meanings.' : '뜻이 있는 단어를 2개 이상 선택해 주세요.';
  } else if (game === 'memory') {
    const words = new Set(cards.map(card=>card.word.trim().toLowerCase()));
    const meanings = new Set(cards.map(card=>card.meaning.trim()));
    if (words.size !== cards.length || meanings.size !== cards.length) {
      reason = en ? 'Choose distinct words with different meanings.' : '단어와 뜻이 각각 겹치지 않게 선택해 주세요.';
    }
  } else if (game==='shoot' && !cards.every(hasDistractor)) {
    reason=en?'Choose distinct words and meanings for the answer options.':'오답 보기로 쓸 서로 다른 단어와 뜻이 필요해요.';
  }
  const questionCount = reason ? 0 : isCatalogGame(game) ? Math.min(cards.length, choiceGames.has(game) ? 8 : 6) : cards.length;
  return {cards,hasSentences,reason,questionCount};
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
  if (isCatalogGame(game)) {
    const item = gameItemFromCards(cards, game, reviewGameNames[game][en?1:0]);
    if (!item) return [];
    item.config.block = newBlock('recall').config.block;
    items.push(item);
  } else if (game === 'flip') {
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
