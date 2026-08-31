import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AdminLayout from './pages/AdminLayout';
import AdminAcademiesPage from './pages/AdminAcademiesPage';
import AirplanePage from './pages/AirplanePage';
import AnagramPage from './pages/AnagramPage';
import AppLayout from './pages/AppLayout';
import AttendancePage from './pages/AttendancePage';
import Baskin31Page from './pages/Baskin31Page';
import BombPage from './pages/BombPage';
import Connect4Page from './pages/Connect4Page';
import CrosswordPage from './pages/CrosswordPage';
import AuthPage from './pages/AuthPage';
import ClassBoardPage from './pages/ClassBoardPage';
import DashboardPage from './pages/DashboardPage';
import FindMissingPage from './pages/FindMissingPage';
import FlashcardsPage from './pages/FlashcardsPage';
import GamesPage from './pages/GamesPage';
import GroupSortPage from './pages/GroupSortPage';
import HangmanPage from './pages/HangmanPage';
import HomeworkCalendarPage from './pages/HomeworkCalendarPage';
import LadderPage from './pages/LadderPage';
import LandingPage from './pages/LandingPage';
import MatchupPage from './pages/MatchupPage';
import MathGeneratorPage from './pages/MathGeneratorPage';
import MazeChasePage from './pages/MazeChasePage';
import OnboardingPage from './pages/OnboardingPage';
import OrderPage from './pages/OrderPage';
import PassBallPage from './pages/PassBallPage';
import PopcornPage from './pages/PopcornPage';
import QuizPage from './pages/QuizPage';
import RankOrderPage from './pages/RankOrderPage';
import ResultsPage from './pages/ResultsPage';
import SaveOrGivePage from './pages/SaveOrGivePage';
import SentenceUnscramblePage from './pages/SentenceUnscramblePage';
import SettingsPage from './pages/SettingsPage';
import SpellTheWordPage from './pages/SpellTheWordPage';
import StudentPage from './pages/StudentPage';
import TicTacToePage from './pages/TicTacToePage';
import TimerMatchPage from './pages/TimerMatchPage';
import TrueFalsePage from './pages/TrueFalsePage';
import TwoDicePage from './pages/TwoDicePage';
import TypeAnswerPage from './pages/TypeAnswerPage';
import WhackAMolePage from './pages/WhackAMolePage';
import WheelPage from './pages/WheelPage';
import WordSearchPage from './pages/WordSearchPage';

export default function App() {
  const { t } = useTranslation();
  const { loading, session, profile, isStaff, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background font-body-md text-on-surface-variant">
        {t('common.loading')}
      </div>
    );
  }

  // 1) 로그인 전 — 첫 화면은 서비스 소개(랜딩), 로그인/가입은 /login
  if (!session) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // 2) 로그인은 했지만 아직 학원에 소속되지 않음
  if (!profile) {
    return (
      <Routes>
        <Route path="*" element={<OnboardingPage />} />
      </Routes>
    );
  }

  // 3) 플랫폼 관리자 — 학원 소속과 무관한 별도 화면
  if (isAdmin) {
    return (
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminAcademiesPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    );
  }

  // 4) 정상 이용
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {isStaff ? (
          <>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/board" element={<ClassBoardPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/results/homework/:studentId" element={<HomeworkCalendarPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/games" element={<GamesPage />} />
            <Route path="/games/wheel" element={<WheelPage />} />
            <Route path="/games/ladder" element={<LadderPage />} />
            <Route path="/games/order" element={<OrderPage />} />
            <Route path="/games/bomb" element={<BombPage />} />
            <Route path="/games/timer" element={<TimerMatchPage />} />
            <Route path="/games/tictactoe" element={<TicTacToePage />} />
            <Route path="/games/saveorgive" element={<SaveOrGivePage />} />
            <Route path="/games/findmissing" element={<FindMissingPage />} />
            <Route path="/games/baskin31" element={<Baskin31Page />} />
            <Route path="/games/connect4" element={<Connect4Page />} />
            <Route path="/games/popcorn" element={<PopcornPage />} />
            <Route path="/games/passball" element={<PassBallPage />} />
            <Route path="/games/twodice" element={<TwoDicePage />} />
            <Route path="/games/quiz" element={<QuizPage />} />
            <Route path="/games/hangman" element={<HangmanPage />} />
            <Route path="/games/truefalse" element={<TrueFalsePage />} />
            <Route path="/games/matchup" element={<MatchupPage />} />
            <Route path="/games/whackamole" element={<WhackAMolePage />} />
            <Route path="/games/flashcards" element={<FlashcardsPage />} />
            <Route path="/games/anagram" element={<AnagramPage />} />
            <Route path="/games/groupsort" element={<GroupSortPage />} />
            <Route path="/games/unscramble" element={<SentenceUnscramblePage />} />
            <Route path="/games/typeanswer" element={<TypeAnswerPage />} />
            <Route path="/games/spellword" element={<SpellTheWordPage />} />
            <Route path="/games/rankorder" element={<RankOrderPage />} />
            <Route path="/games/wordsearch" element={<WordSearchPage />} />
            <Route path="/games/crossword" element={<CrosswordPage />} />
            <Route path="/games/mathgen" element={<MathGeneratorPage />} />
            <Route path="/games/mazechase" element={<MazeChasePage />} />
            <Route path="/games/airplane" element={<AirplanePage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        ) : (
          // 학생은 자기 통장과 게임만 본다. 순위/결과 화면은 노출하지 않는다.
          <>
            <Route path="/me" element={<StudentPage />} />
            <Route path="/games" element={<GamesPage />} />
            <Route path="/games/wheel" element={<WheelPage />} />
            <Route path="/games/ladder" element={<LadderPage />} />
            <Route path="/games/order" element={<OrderPage />} />
            <Route path="/games/bomb" element={<BombPage />} />
            <Route path="/games/timer" element={<TimerMatchPage />} />
            <Route path="/games/tictactoe" element={<TicTacToePage />} />
            <Route path="/games/saveorgive" element={<SaveOrGivePage />} />
            <Route path="/games/findmissing" element={<FindMissingPage />} />
            <Route path="/games/baskin31" element={<Baskin31Page />} />
            <Route path="/games/connect4" element={<Connect4Page />} />
            <Route path="/games/popcorn" element={<PopcornPage />} />
            <Route path="/games/passball" element={<PassBallPage />} />
            <Route path="/games/twodice" element={<TwoDicePage />} />
            <Route path="/games/quiz" element={<QuizPage />} />
            <Route path="/games/hangman" element={<HangmanPage />} />
            <Route path="/games/truefalse" element={<TrueFalsePage />} />
            <Route path="/games/matchup" element={<MatchupPage />} />
            <Route path="/games/whackamole" element={<WhackAMolePage />} />
            <Route path="/games/flashcards" element={<FlashcardsPage />} />
            <Route path="/games/anagram" element={<AnagramPage />} />
            <Route path="/games/groupsort" element={<GroupSortPage />} />
            <Route path="/games/unscramble" element={<SentenceUnscramblePage />} />
            <Route path="/games/typeanswer" element={<TypeAnswerPage />} />
            <Route path="/games/spellword" element={<SpellTheWordPage />} />
            <Route path="/games/rankorder" element={<RankOrderPage />} />
            <Route path="/games/wordsearch" element={<WordSearchPage />} />
            <Route path="/games/crossword" element={<CrosswordPage />} />
            <Route path="/games/mathgen" element={<MathGeneratorPage />} />
            <Route path="/games/mazechase" element={<MazeChasePage />} />
            <Route path="/games/airplane" element={<AirplanePage />} />
            <Route path="*" element={<Navigate to="/me" replace />} />
          </>
        )}
      </Route>
    </Routes>
  );
}
