import type { ComponentType } from 'react';
import WheelPage from '../pages/WheelPage';
import LadderPage from '../pages/LadderPage';
import OrderPage from '../pages/OrderPage';
import BombPage from '../pages/BombPage';
import TimerMatchPage from '../pages/TimerMatchPage';
import TicTacToePage from '../pages/TicTacToePage';
import SaveOrGivePage from '../pages/SaveOrGivePage';
import FindMissingPage from '../pages/FindMissingPage';
import Baskin31Page from '../pages/Baskin31Page';
import Connect4Page from '../pages/Connect4Page';
import PopcornPage from '../pages/PopcornPage';
import PassBallPage from '../pages/PassBallPage';
import TwoDicePage from '../pages/TwoDicePage';
import QuizPage from '../pages/QuizPage';
import HangmanPage from '../pages/HangmanPage';
import TrueFalsePage from '../pages/TrueFalsePage';
import MatchupPage from '../pages/MatchupPage';
import WhackAMolePage from '../pages/WhackAMolePage';
import FlashcardsPage from '../pages/FlashcardsPage';
import AnagramPage from '../pages/AnagramPage';
import GroupSortPage from '../pages/GroupSortPage';
import SentenceUnscramblePage from '../pages/SentenceUnscramblePage';
import TypeAnswerPage from '../pages/TypeAnswerPage';
import SpellTheWordPage from '../pages/SpellTheWordPage';
import RankOrderPage from '../pages/RankOrderPage';
import WordSearchPage from '../pages/WordSearchPage';
import CrosswordPage from '../pages/CrosswordPage';
import MathGeneratorPage from '../pages/MathGeneratorPage';
import MazeChasePage from '../pages/MazeChasePage';
import AirplanePage from '../pages/AirplanePage';
import LabeledDiagramPage from '../pages/LabeledDiagramPage';
import ImageQuizPage from '../pages/ImageQuizPage';
import GameShowQuizPage from '../pages/GameShowQuizPage';
import WinLoseQuizPage from '../pages/WinLoseQuizPage';
import WatermelonPage from '../pages/WatermelonPage';
import QuizShowPage from '../pages/QuizShowPage';

/** 게임 경로(gameCatalog 의 path) → 그 게임 페이지 컴포넌트. 커리큘럼 게임 슬라이드 편집 화면이
 * 게임 설정 화면을 그대로 띄울 때 쓴다. 새 게임을 추가하면 App.tsx 라우트와 함께 여기도 한 줄. */
export const GAME_PAGES: Record<string, ComponentType> = {
  '/games/wheel': WheelPage,
  '/games/ladder': LadderPage,
  '/games/order': OrderPage,
  '/games/bomb': BombPage,
  '/games/timer': TimerMatchPage,
  '/games/tictactoe': TicTacToePage,
  '/games/saveorgive': SaveOrGivePage,
  '/games/findmissing': FindMissingPage,
  '/games/baskin31': Baskin31Page,
  '/games/connect4': Connect4Page,
  '/games/popcorn': PopcornPage,
  '/games/passball': PassBallPage,
  '/games/twodice': TwoDicePage,
  '/games/quiz': QuizPage,
  '/games/hangman': HangmanPage,
  '/games/truefalse': TrueFalsePage,
  '/games/matchup': MatchupPage,
  '/games/whackamole': WhackAMolePage,
  '/games/flashcards': FlashcardsPage,
  '/games/anagram': AnagramPage,
  '/games/groupsort': GroupSortPage,
  '/games/unscramble': SentenceUnscramblePage,
  '/games/typeanswer': TypeAnswerPage,
  '/games/spellword': SpellTheWordPage,
  '/games/rankorder': RankOrderPage,
  '/games/wordsearch': WordSearchPage,
  '/games/crossword': CrosswordPage,
  '/games/mathgen': MathGeneratorPage,
  '/games/mazechase': MazeChasePage,
  '/games/airplane': AirplanePage,
  '/games/labeleddiagram': LabeledDiagramPage,
  '/games/imagequiz': ImageQuizPage,
  '/games/gameshowquiz': GameShowQuizPage,
  '/games/winlosequiz': WinLoseQuizPage,
  '/games/watermelon': WatermelonPage,
  '/games/quizshow': QuizShowPage,
};
