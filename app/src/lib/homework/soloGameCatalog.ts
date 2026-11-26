import type { GameType } from '../types';
import type { SoloGame } from './blocks';

/** 숙제 게임 → 게임 센터 카드(그림·이름·설명)와 숙제에서 달라지는 점 */
type GameDef = { game: SoloGame; catalog: GameType; note: [string, string] };
export const WORD_GAMES: GameDef[] = [
  { game: 'matchup', catalog: 'matchup', note: ['숙제에서는 단어와 뜻을 짝지어요(낱말 최대 8개)', 'Pair words with meanings (up to 8)'] },
  { game: 'anagram', catalog: 'anagram', note: ['섞인 글자를 순서대로 눌러 낱말을 만들어요(6개)', 'Tap scrambled letters in order (6)'] },
  { game: 'spelling', catalog: 'spellword', note: ['뜻을 보고 철자를 직접 써요(6개)', 'Write the spelling from the meaning (6)'] },
  { game: 'whack', catalog: 'whackamole', note: ['소리를 듣고 두더지 4마리 중 맞는 낱말을 잡아요(8개)', 'Hear it, whack the right word (8)'] },
  { game: 'fish', catalog: 'wordfishing', note: ['낱말을 보고 알맞은 뜻의 물고기를 낚아요(8개)', 'Catch the fish with the right meaning (8)'] },
  { game: 'balloon', catalog: 'balloonpop', note: ['뜻을 보고 알맞은 낱말 풍선을 터뜨려요(8개)', 'Pop the balloon with the right word (8)'] },
  { game: 'hangman', catalog: 'hangman', note: ['글자를 하나씩 골라 낱말을 맞혀요, 목숨 6개(6개)', 'Guess letters, 6 lives (6)'] },
  { game: 'monster', catalog: 'feedmonster', note: ['괴물이 말하는 뜻에 맞는 낱말을 먹여요(8개)', 'Feed the word that matches the meaning (8)'] },
  { game: 'claw', catalog: 'wordclaw', note: ['그림(없으면 뜻)에 맞는 낱말 캡슐을 뽑아요(8개)', 'Pull the matching capsule (8)'] },
  { game: 'maze', catalog: 'mazechase', note: ['문장 빈칸(없으면 뜻)에 맞는 낱말 길을 골라요(8개)', 'Pick the right path (8)'] },
  { game: 'plane', catalog: 'airplane', note: ['소리를 듣고 구름 위의 낱말을 골라요(8개)', 'Hear it, pick the word on the clouds (8)'] },
  { game: 'group', catalog: 'groupsort', note: ['낱말이 어느 주제인지 골라요(주제가 있는 낱말만, 8개)', 'Pick the topic (words with a topic, 8)'] },
  { game: 'cross', catalog: 'crossword', note: ['뜻과 글자 칸(첫 글자 + 빈칸)을 보고 낱말을 써요(6개)', 'Type the word from meaning and boxes (6)'] },
];
export const SENTENCE_GAMES: GameDef[] = [
  { game: 'train', catalog: 'wordtrain', note: ['섞인 낱말을 순서대로 눌러 문장을 만들어요(6개)', 'Tap words in order to build a sentence (6)'] },
  { game: 'rocket', catalog: 'sentencerocket', note: ['섞인 낱말을 순서대로 눌러 문장을 만들어요(6개)', 'Tap words in order to build a sentence (6)'] },
  { game: 'tower', catalog: 'sentencetower', note: ['섞인 낱말을 순서대로 눌러 문장을 만들어요(6개)', 'Tap words in order to build a sentence (6)'] },
  { game: 'bridge', catalog: 'sentencebridge', note: ['섞인 낱말을 순서대로 눌러 문장을 만들어요(6개)', 'Tap words in order to build a sentence (6)'] },
  { game: 'splash', catalog: 'sentencesplash', note: ['섞인 낱말을 순서대로 눌러 문장을 완성해요(6개)', 'Tap words in order to finish a sentence (6)'] },
  { game: 'detective', catalog: 'grammardetective', note: ['낱말 순서가 틀린 문장을 바르게 고쳐 써요(6개)', 'Fix the wrong word order by typing (6)'] },
];
const byGame = new Map([...WORD_GAMES, ...SENTENCE_GAMES].map(definition => [definition.game, definition.catalog]));
export function soloGameCatalogId(game: SoloGame) {
  return byGame.get(game);
}
