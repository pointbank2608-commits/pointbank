import MyGamesPage from './pages/MyGamesPage';
import GameWorkspace from './components/GameWorkspace';
import { useTranslation } from 'react-i18next';
import StudentAppIdentity from './components/StudentAppIdentity';
import { NoticeProvider } from './components/NoticeCenter';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AdminLayout from './pages/AdminLayout';
import AppLayout from './pages/AppLayout';
import { Suspense } from 'react';
import PageLoading from './components/PageLoading';
import { lazyPage } from './lib/lazyPage';

// 화면 코드 분할(2026-10-17): 화면을 처음 열 때 그 조각만 받는다. 레이아웃(AppLayout/AdminLayout)만 처음부터 들어 있다.
const PhonicsLessonPage = lazyPage(() => import('./pages/PhonicsLessonPage'));
const PhonicsGamesPage = lazyPage(() => import('./pages/PhonicsGamesPage'));
const AdminTodayPage = lazyPage(() => import('./pages/AdminTodayPage'));
const AdminAcademyDetailPage = lazyPage(() => import('./pages/AdminAcademyDetailPage'));
const AdminSupportPage = lazyPage(() => import('./pages/AdminSupportPage'));
const AdminBillingPage = lazyPage(() => import('./pages/AdminBillingPage'));
const AdminSystemPage = lazyPage(() => import('./pages/AdminSystemPage'));
const AdminSettingsPage = lazyPage(() => import('./pages/AdminSettingsPage'));
const AdminNoticesPage = lazyPage(() => import('./pages/AdminNoticesPage'));
const AdminVideosPage = lazyPage(() => import('./pages/AdminVideosPage'));
const AdminBrandPage = lazyPage(() => import('./pages/AdminBrandPage'));
const VideoLibraryPage = lazyPage(() => import('./pages/VideoLibraryPage'));
const HomeworkPage = lazyPage(() => import('./pages/HomeworkPage'));
const HomeworkStudentPage = lazyPage(() => import('./pages/HomeworkStudentPage'));
const WordMemoryStudentPage = lazyPage(() => import('./pages/WordMemoryStudentPage'));
const StudentPortalPage = lazyPage(() => import('./pages/StudentPortalPage'));
const StudentSoloPage = lazyPage(() => import('./pages/StudentSoloPage'));
const SharedRecordingPage = lazyPage(() => import('./pages/SharedRecordingPage'));
const HelpPage = lazyPage(() => import('./pages/HelpPage'));
const LessonWatchPage = lazyPage(() => import('./pages/LessonWatchPage'));
const SharedLessonPage = lazyPage(() => import('./pages/SharedLessonPage'));
const AdminAcademiesPage = lazyPage(() => import('./pages/AdminAcademiesPage'));
const AirplanePage = lazyPage(() => import('./pages/AirplanePage'));
const AnagramPage = lazyPage(() => import('./pages/AnagramPage'));
const AttendancePage = lazyPage(() => import('./pages/AttendancePage'));
const Baskin31Page = lazyPage(() => import('./pages/Baskin31Page'));
const BillingPage = lazyPage(() => import('./pages/BillingPage'));
const BingoPage = lazyPage(() => import('./pages/BingoPage'));
const BombPage = lazyPage(() => import('./pages/BombPage'));
const Connect4Page = lazyPage(() => import('./pages/Connect4Page'));
const CrosswordPage = lazyPage(() => import('./pages/CrosswordPage'));
const AuthPage = lazyPage(() => import('./pages/AuthPage'));
const ClassBoardPage = lazyPage(() => import('./pages/ClassBoardPage'));
const DashboardPage = lazyPage(() => import('./pages/DashboardPage'));
const DictionaryPage = lazyPage(() => import('./pages/DictionaryPage'));
const PhonicsPage = lazyPage(() => import('./pages/PhonicsPage'));
const PhonicsStage1Page = lazyPage(() => import('./pages/PhonicsStage1Page'));
const GrammarPage = lazyPage(() => import('./pages/GrammarPage'));
const WordListsPage = lazyPage(() => import('./pages/WordListsPage'));
const FindMissingPage = lazyPage(() => import('./pages/FindMissingPage'));
const FlashcardsPage = lazyPage(() => import('./pages/FlashcardsPage'));
const GamesPage = lazyPage(() => import('./pages/GamesPage'));
const GameShowQuizPage = lazyPage(() => import('./pages/GameShowQuizPage'));
const GroupSortPage = lazyPage(() => import('./pages/GroupSortPage'));
const HangmanPage = lazyPage(() => import('./pages/HangmanPage'));
const HomeworkCalendarPage = lazyPage(() => import('./pages/HomeworkCalendarPage'));
const FlashcardPrintPage = lazyPage(() => import('./pages/FlashcardPrintPage'));
const ImageQuizPage = lazyPage(() => import('./pages/ImageQuizPage'));
const LabeledDiagramPage = lazyPage(() => import('./pages/LabeledDiagramPage'));
const LadderPage = lazyPage(() => import('./pages/LadderPage'));
const LandingPage = lazyPage(() => import('./pages/LandingPage'));
const MatchupPage = lazyPage(() => import('./pages/MatchupPage'));
const MathGeneratorPage = lazyPage(() => import('./pages/MathGeneratorPage'));
const Elementary800WorkbookPage = lazyPage(() => import('./pages/Elementary800WorkbookPage'));
const MaterialsPage = lazyPage(() => import('./pages/MaterialsPage'));
const WhiteboardPage = lazyPage(() => import('./pages/WhiteboardPage'));
const ResourcesHomePage = lazyPage(() => import('./pages/ResourcesHomePage'));
const MazeChasePage = lazyPage(() => import('./pages/MazeChasePage'));
const MemoryCardsPage = lazyPage(() => import('./pages/MemoryCardsPage'));
const OnboardingPage = lazyPage(() => import('./pages/OnboardingPage'));
const OrderPage = lazyPage(() => import('./pages/OrderPage'));
const PassBallPage = lazyPage(() => import('./pages/PassBallPage'));
const PopcornPage = lazyPage(() => import('./pages/PopcornPage'));
const PrivacyPage = lazyPage(() => import('./pages/PrivacyPage'));
const RefundPolicyPage = lazyPage(() => import('./pages/RefundPolicyPage'));
const TermsPage = lazyPage(() => import('./pages/TermsPage'));
const QuizPage = lazyPage(() => import('./pages/QuizPage'));
const RankOrderPage = lazyPage(() => import('./pages/RankOrderPage'));
const ResultsPage = lazyPage(() => import('./pages/ResultsPage'));
const SaveOrGivePage = lazyPage(() => import('./pages/SaveOrGivePage'));
const BalloonPopPage = lazyPage(() => import('./pages/AdventureGamePage').then(m => ({ default: m.BalloonPopPage })));
const WordTrainPage = lazyPage(() => import('./pages/AdventureGamePage').then(m => ({ default: m.WordTrainPage })));
const WordFishingPage = lazyPage(() => import('./pages/AdventureGamePage').then(m => ({ default: m.WordFishingPage })));
const SentenceRocketPage = lazyPage(() => import('./pages/AdventureGamePage').then(m => ({ default: m.SentenceRocketPage })));
const GrammarDetectivePage = lazyPage(() => import('./pages/AdventureGamePage').then(m => ({ default: m.GrammarDetectivePage })));
const TreasureHuntPage = lazyPage(() => import('./pages/AdventureGamePage').then(m => ({ default: m.TreasureHuntPage })));
const WordClawPage = lazyPage(() => import('./pages/AdventureGamePage').then(m => ({ default: m.WordClawPage })));
const FeedMonsterPage = lazyPage(() => import('./pages/StorybookGamePage').then(m => ({ default: m.FeedMonsterPage })));
const SentenceBridgePage = lazyPage(() => import('./pages/StorybookGamePage').then(m => ({ default: m.SentenceBridgePage })));
const SentenceTowerPage = lazyPage(() => import('./pages/StorybookGamePage').then(m => ({ default: m.SentenceTowerPage })));
const SentenceUnscramblePage = lazyPage(() => import('./pages/SentenceUnscramblePage'));
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'));
const SpellTheWordPage = lazyPage(() => import('./pages/SpellTheWordPage'));
const SentenceSplashPage = lazyPage(() => import('./pages/SentenceSplashPage'));
const StudentHistoryPage = lazyPage(() => import('./pages/StudentHistoryPage'));
const StudentPage = lazyPage(() => import('./pages/StudentPage'));
const TicTacToePage = lazyPage(() => import('./pages/TicTacToePage'));
const TimerMatchPage = lazyPage(() => import('./pages/TimerMatchPage'));
const TrueFalsePage = lazyPage(() => import('./pages/TrueFalsePage'));
const TwoDicePage = lazyPage(() => import('./pages/TwoDicePage'));
const TypeAnswerPage = lazyPage(() => import('./pages/TypeAnswerPage'));
const WhackAMolePage = lazyPage(() => import('./pages/WhackAMolePage'));
const WheelPage = lazyPage(() => import('./pages/WheelPage'));
const WinLoseQuizPage = lazyPage(() => import('./pages/WinLoseQuizPage'));
const WatermelonPage = lazyPage(() => import('./pages/WatermelonPage'));
const QuizShowPage = lazyPage(() => import('./pages/QuizShowPage'));
const ShoppingPage = lazyPage(() => import('./pages/ShoppingPage'));
const TreasureDigPage = lazyPage(() => import('./pages/TreasureDigPage'));
const FourCluesPage = lazyPage(() => import('./pages/FourCluesPage'));
const CatchSentencePage = lazyPage(() => import('./pages/CatchSentencePage'));
const LightningLuckPage = lazyPage(() => import('./pages/LightningLuckPage'));
const ShuffleFindPage = lazyPage(() => import('./pages/ShuffleFindPage'));
const TelepathyPage = lazyPage(() => import('./pages/TelepathyPage'));
const LastBoxPage = lazyPage(() => import('./pages/LastBoxPage'));
const RemotePage = lazyPage(() => import('./pages/RemotePage'));
const AirportPage = lazyPage(() => import('./pages/AirportPage'));
const RestaurantPage = lazyPage(() => import('./pages/RestaurantPage'));
const IceCreamPage = lazyPage(() => import('./pages/IceCreamPage'));
const DoctorPage = lazyPage(() => import('./pages/DoctorPage'));
const DoctorWorksheetPage = lazyPage(() => import('./pages/DoctorWorksheetPage'));
const LightningWorksheetPage = lazyPage(() => import('./pages/LightningWorksheetPage'));
const AirportWorksheetPage = lazyPage(() => import('./pages/AirportWorksheetPage'));
const RestaurantWorksheetPage = lazyPage(() => import('./pages/RestaurantWorksheetPage'));
const IceCreamWorksheetPage = lazyPage(() => import('./pages/IceCreamWorksheetPage'));
const MysteryBoxPage = lazyPage(() => import('./pages/MysteryBoxPage'));
const MysteryBoxPrintPage = lazyPage(() => import('./pages/MysteryBoxPrintPage'));
const LiveJoinPage = lazyPage(() => import('./pages/LiveJoinPage'));
const CvcWorkbookPage = lazyPage(() => import('./pages/CvcWorkbookPage'));
const PhonicsWorkbookPage = lazyPage(() => import('./pages/PhonicsWorkbookPage'));
const GrammarSheetsPage = lazyPage(() => import('./pages/GrammarSheetsPage'));
const WordSearchPage = lazyPage(() => import('./pages/WordSearchPage'));
const PhonicsWorksheetLibraryPage = lazyPage(() => import('./pages/PhonicsWorksheetLibraryPage'));
const WorksheetLibraryPage = lazyPage(() => import('./pages/WorksheetLibraryPage'));
const WorksheetPrintPage = lazyPage(() => import('./pages/WorksheetPrintPage'));
const CurriculumPage = lazyPage(() => import('./pages/CurriculumPage'));
const LessonSlideViewerPage = lazyPage(() => import('./pages/LessonSlideViewerPage'));

function AppRoutes() {
  const { t } = useTranslation();
  const { loading, session, profile, isStaff, isAdmin } = useAuth();
  const { pathname } = useLocation();

  // 대회 퀴즈쇼 학생 입장 — 로그인 없이 휴대폰으로 들어온다(로그인 여부·로딩과 상관없이 먼저).
  if (pathname === '/join' || pathname.startsWith('/join/')) {
    return (
      <Routes>
        <Route path="/join" element={<LiveJoinPage />} />
        <Route path="/join/:code" element={<LiveJoinPage />} />
      </Routes>
    );
  }
  // 학생용 페이지(Classbank Student): 학원 코드 + 이름 + 학부모 전화번호로 로그인. 선생님 로그인과 따로.
  if (pathname === '/s' || pathname.startsWith('/s/')) {
    return (
      <>
        <StudentAppIdentity />
      <Routes>
        <Route path="/s" element={<StudentPortalPage />} />
        <Route path="/s/lesson/:assignmentId" element={<StudentSoloPage />} />
        <Route path="*" element={<Navigate to="/s" replace />} />
      </Routes>
      </>
    );
  }
  // 학부모가 링크로 보는 아이의 녹음(로그인 없음, 만료·닫힘이 있는 무작위 열쇠)
  if (pathname.startsWith('/r/')) {
    return (
      <Routes>
        <Route path="/r/:token" element={<SharedRecordingPage />} />
      </Routes>
    );
  }
  // 학생 숙제(Classbank Student, 로그인 없이 숙제 번호 + 이름 + PIN)
  if (pathname === '/hw' || pathname.startsWith('/hw/')) {
    return (
      <Routes>
        <Route path="/hw" element={<HomeworkStudentPage />} />
        <Route path="/hw/p/:access" element={<HomeworkStudentPage />} />
        <Route path="/hw/:code" element={<HomeworkStudentPage />} />
      </Routes>
    );
  }
  // 학생 단어암기숙제(개인 링크 열쇠 하나로, 로그인 없음)
  if (pathname.startsWith('/wm/')) {
    return (
      <Routes>
        <Route path="/wm/:access" element={<WordMemoryStudentPage />} />
      </Routes>
    );
  }
  // 온라인 수업 학생 따라보기(로그인 없음), 공유받은 수업 미리보기(로그인 전에도 볼 수 있게)
  if (pathname === '/watch' || pathname.startsWith('/watch/') || pathname.startsWith('/share/')) {
    return (
      <Routes>
        <Route path="/watch" element={<LessonWatchPage />} />
        <Route path="/watch/:code" element={<LessonWatchPage />} />
        <Route path="/share/:token" element={<SharedLessonPage />} />
      </Routes>
    );
  }

  // 선생님 폰 리모컨 — 로그인한 선생님 계정이어야 한다(로그인 전이면 같은 주소에서 로그인 화면을 보여 준다)
  if (pathname.startsWith('/remote/')) {
    if (!loading && !session) return <AuthPage />;
    if (!loading && session && profile) {
      return (
        <Routes>
          <Route path="/remote/:id" element={<RemotePage />} />
        </Routes>
      );
    }
  }

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
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/refund-policy" element={<RefundPolicyPage />} />
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
          <Route path="/admin" element={<AdminTodayPage />} />
          <Route path="/admin/academies" element={<AdminAcademiesPage />} />
          <Route path="/admin/academies/:id" element={<AdminAcademyDetailPage />} />
          <Route path="/admin/inbox" element={<Navigate to="/admin/support?view=review" replace />} />
          <Route path="/admin/billing" element={<AdminBillingPage />} />
          <Route path="/admin/system" element={<AdminSystemPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
          <Route path="/admin/support" element={<AdminSupportPage />} />
          <Route path="/admin/notices" element={<AdminNoticesPage />} />
          <Route path="/admin/videos" element={<AdminVideosPage />} />
          <Route path="/admin/brand" element={<AdminBrandPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    );
  }

  // 4) 정상 이용
  return (
    <Routes>
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/refund-policy" element={<RefundPolicyPage />} />
      <Route
        element={
          <NoticeProvider>
            <AppLayout />
          </NoticeProvider>
        }
      >
        {isStaff ? (
          <>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/curriculum" element={<CurriculumPage />} />
            <Route path="/curriculum/:id/slide/:slideId" element={<LessonSlideViewerPage />} />
            <Route path="/board" element={<ClassBoardPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/results/homework/:studentId" element={<HomeworkCalendarPage />} />
            <Route path="/results/history/:studentId" element={<StudentHistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/settings/billing" element={<BillingPage />} />
            <Route path="/dictionary" element={<DictionaryPage />} />
            <Route path="/phonics" element={<PhonicsPage />} />
            <Route path="/phonics-games" element={<PhonicsGamesPage />} />
            <Route path="/phonics-games/:gameId" element={<PhonicsGamesPage />} />
            <Route path="/phonics/lesson" element={<PhonicsLessonPage />} />
            <Route path="/phonics/stage-1" element={<PhonicsStage1Page />} />
            <Route path="/materials/phonics-stage-1" element={<PhonicsWorkbookPage step={1} />} />
            <Route path="/grammar" element={<GrammarPage />} />
            <Route path="/videos" element={<VideoLibraryPage />} />
            <Route path="/homework" element={<HomeworkPage />} />
            <Route path="/wordlists" element={<WordListsPage />} />
            <Route path="/resources" element={<ResourcesHomePage />} />
            <Route path="/materials" element={<MaterialsPage />} />
            <Route path="/materials/elementary-800" element={<Elementary800WorkbookPage />} />
            <Route path="/my-games" element={<MyGamesPage />} />
            <Route path="/whiteboard" element={<WhiteboardPage />} />
            <Route path="/materials/flashcards" element={<FlashcardPrintPage />} />
            <Route path="/materials/memory-cards" element={<MemoryCardsPage />} />
            <Route path="/materials/bingo" element={<BingoPage />} />
            <Route path="/materials/mystery-box" element={<MysteryBoxPrintPage />} />
            <Route path="/materials/airport" element={<AirportWorksheetPage />} />
            <Route path="/materials/restaurant" element={<RestaurantWorksheetPage />} />
            <Route path="/materials/icecream" element={<IceCreamWorksheetPage />} />
            <Route path="/materials/doctor" element={<DoctorWorksheetPage />} />
            <Route path="/materials/lightning" element={<LightningWorksheetPage />} />
            <Route path="/materials/worksheet" element={<WorksheetPrintPage />} />
            <Route path="/materials/library" element={<WorksheetLibraryPage />} />
            <Route path="/materials/phonics" element={<PhonicsWorksheetLibraryPage />} />
            <Route path="/materials/cvc-workbook" element={<CvcWorkbookPage />} />
            <Route path="/materials/phonics-stage-4-workbook" element={<PhonicsWorkbookPage key="stage4" step={4} />} />
            <Route path="/materials/phonics-stage-5-workbook" element={<PhonicsWorkbookPage key="stage5" step={5} />} />
            <Route path="/materials/grammar-workbook" element={<GrammarSheetsPage />} />
            <Route path="/materials/grammar-sheets" element={<GrammarSheetsPage />} />
            <Route path="/materials/long-vowel-workbook" element={<CvcWorkbookPage key="long" book="long" />} />
            <Route path="/games" element={<GamesPage />} />
            <Route path="/games/wheel" element={<GameWorkspace><WheelPage /></GameWorkspace>} />
            <Route path="/games/ladder" element={<GameWorkspace><LadderPage /></GameWorkspace>} />
            <Route path="/games/order" element={<GameWorkspace><OrderPage /></GameWorkspace>} />
            <Route path="/games/bomb" element={<GameWorkspace><BombPage /></GameWorkspace>} />
            <Route path="/games/timer" element={<GameWorkspace><TimerMatchPage /></GameWorkspace>} />
            <Route path="/games/tictactoe" element={<GameWorkspace><TicTacToePage /></GameWorkspace>} />
            <Route path="/games/saveorgive" element={<GameWorkspace><SaveOrGivePage /></GameWorkspace>} />
            <Route path="/games/findmissing" element={<GameWorkspace><FindMissingPage /></GameWorkspace>} />
            <Route path="/games/baskin31" element={<GameWorkspace><Baskin31Page /></GameWorkspace>} />
            <Route path="/games/connect4" element={<GameWorkspace><Connect4Page /></GameWorkspace>} />
            <Route path="/games/popcorn" element={<GameWorkspace><PopcornPage /></GameWorkspace>} />
            <Route path="/games/passball" element={<GameWorkspace><PassBallPage /></GameWorkspace>} />
            <Route path="/games/twodice" element={<GameWorkspace><TwoDicePage /></GameWorkspace>} />
            <Route path="/games/quiz" element={<GameWorkspace><QuizPage /></GameWorkspace>} />
            <Route path="/games/hangman" element={<GameWorkspace><HangmanPage /></GameWorkspace>} />
            <Route path="/games/truefalse" element={<GameWorkspace><TrueFalsePage /></GameWorkspace>} />
            <Route path="/games/matchup" element={<GameWorkspace><MatchupPage /></GameWorkspace>} />
            <Route path="/games/whackamole" element={<GameWorkspace><WhackAMolePage /></GameWorkspace>} />
            <Route path="/games/flashcards" element={<GameWorkspace><FlashcardsPage /></GameWorkspace>} />
            <Route path="/games/anagram" element={<GameWorkspace><AnagramPage /></GameWorkspace>} />
            <Route path="/games/groupsort" element={<GameWorkspace><GroupSortPage /></GameWorkspace>} />
            <Route path="/games/balloonpop" element={<GameWorkspace><BalloonPopPage /></GameWorkspace>} />
            <Route path="/games/wordtrain" element={<GameWorkspace><WordTrainPage /></GameWorkspace>} />
            <Route path="/games/wordfishing" element={<GameWorkspace><WordFishingPage /></GameWorkspace>} />
            <Route path="/games/sentencerocket" element={<GameWorkspace><SentenceRocketPage /></GameWorkspace>} />
            <Route path="/games/grammardetective" element={<GameWorkspace><GrammarDetectivePage /></GameWorkspace>} />
            <Route path="/games/treasurehunt" element={<GameWorkspace><TreasureHuntPage /></GameWorkspace>} />
            <Route path="/games/wordclaw" element={<GameWorkspace><WordClawPage /></GameWorkspace>} />
            <Route path="/games/feedmonster" element={<GameWorkspace><FeedMonsterPage /></GameWorkspace>} />
            <Route path="/games/sentencebridge" element={<GameWorkspace><SentenceBridgePage /></GameWorkspace>} />
            <Route path="/games/sentencetower" element={<GameWorkspace><SentenceTowerPage /></GameWorkspace>} />
            <Route path="/games/unscramble" element={<GameWorkspace><SentenceUnscramblePage /></GameWorkspace>} />
            <Route path="/games/typeanswer" element={<GameWorkspace><TypeAnswerPage /></GameWorkspace>} />
            <Route path="/games/spellword" element={<GameWorkspace><SpellTheWordPage /></GameWorkspace>} />
            <Route path="/games/sentencesplash" element={<GameWorkspace><SentenceSplashPage /></GameWorkspace>} />
            <Route path="/games/rankorder" element={<GameWorkspace><RankOrderPage /></GameWorkspace>} />
            <Route path="/games/wordsearch" element={<GameWorkspace><WordSearchPage /></GameWorkspace>} />
            <Route path="/games/crossword" element={<GameWorkspace><CrosswordPage /></GameWorkspace>} />
            <Route path="/games/mathgen" element={<GameWorkspace><MathGeneratorPage /></GameWorkspace>} />
            <Route path="/games/mazechase" element={<GameWorkspace><MazeChasePage /></GameWorkspace>} />
            <Route path="/games/airplane" element={<GameWorkspace><AirplanePage /></GameWorkspace>} />
            <Route path="/games/labeleddiagram" element={<GameWorkspace><LabeledDiagramPage /></GameWorkspace>} />
            <Route path="/games/imagequiz" element={<GameWorkspace><ImageQuizPage /></GameWorkspace>} />
            <Route path="/games/gameshowquiz" element={<GameWorkspace><GameShowQuizPage /></GameWorkspace>} />
            <Route path="/games/winlosequiz" element={<GameWorkspace><WinLoseQuizPage /></GameWorkspace>} />
            <Route path="/games/watermelon" element={<GameWorkspace><WatermelonPage /></GameWorkspace>} />
            <Route path="/games/quizshow" element={<GameWorkspace><QuizShowPage /></GameWorkspace>} />
            <Route path="/games/shopping" element={<GameWorkspace><ShoppingPage /></GameWorkspace>} />
            <Route path="/games/treasuredig" element={<GameWorkspace><TreasureDigPage /></GameWorkspace>} />
            <Route path="/games/fourclues" element={<GameWorkspace><FourCluesPage /></GameWorkspace>} />
            <Route path="/games/catchsentence" element={<GameWorkspace><CatchSentencePage /></GameWorkspace>} />
            <Route path="/games/lastbox" element={<GameWorkspace><LastBoxPage /></GameWorkspace>} />
            <Route path="/games/airport" element={<GameWorkspace><AirportPage /></GameWorkspace>} />
            <Route path="/games/restaurant" element={<GameWorkspace><RestaurantPage /></GameWorkspace>} />
            <Route path="/games/icecream" element={<GameWorkspace><IceCreamPage /></GameWorkspace>} />
            <Route path="/games/doctor" element={<GameWorkspace><DoctorPage /></GameWorkspace>} />
            <Route path="/games/lightning" element={<GameWorkspace><LightningLuckPage /></GameWorkspace>} />
            <Route path="/games/shufflefind" element={<GameWorkspace><ShuffleFindPage /></GameWorkspace>} />
            <Route path="/games/telepathy" element={<GameWorkspace><TelepathyPage /></GameWorkspace>} />
            <Route path="/games/mysterybox" element={<GameWorkspace><MysteryBoxPage /></GameWorkspace>} />
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
            <Route path="/games/balloonpop" element={<BalloonPopPage />} />
            <Route path="/games/wordtrain" element={<WordTrainPage />} />
            <Route path="/games/wordfishing" element={<WordFishingPage />} />
            <Route path="/games/sentencerocket" element={<SentenceRocketPage />} />
            <Route path="/games/grammardetective" element={<GrammarDetectivePage />} />
            <Route path="/games/treasurehunt" element={<TreasureHuntPage />} />
            <Route path="/games/wordclaw" element={<WordClawPage />} />
            <Route path="/games/feedmonster" element={<FeedMonsterPage />} />
            <Route path="/games/sentencebridge" element={<SentenceBridgePage />} />
            <Route path="/games/sentencetower" element={<SentenceTowerPage />} />
            <Route path="/games/unscramble" element={<SentenceUnscramblePage />} />
            <Route path="/games/typeanswer" element={<TypeAnswerPage />} />
            <Route path="/games/spellword" element={<SpellTheWordPage />} />
            <Route path="/games/sentencesplash" element={<SentenceSplashPage />} />
            <Route path="/games/rankorder" element={<RankOrderPage />} />
            <Route path="/games/wordsearch" element={<WordSearchPage />} />
            <Route path="/games/crossword" element={<CrosswordPage />} />
            <Route path="/games/mathgen" element={<MathGeneratorPage />} />
            <Route path="/games/mazechase" element={<MazeChasePage />} />
            <Route path="/games/airplane" element={<AirplanePage />} />
            <Route path="/games/labeleddiagram" element={<LabeledDiagramPage />} />
            <Route path="/games/imagequiz" element={<ImageQuizPage />} />
            <Route path="/games/gameshowquiz" element={<GameShowQuizPage />} />
            <Route path="/games/winlosequiz" element={<WinLoseQuizPage />} />
            <Route path="/games/watermelon" element={<WatermelonPage />} />
            <Route path="/games/quizshow" element={<QuizShowPage />} />
            <Route path="/games/shopping" element={<ShoppingPage />} />
            <Route path="/games/treasuredig" element={<TreasureDigPage />} />
            <Route path="/games/fourclues" element={<FourCluesPage />} />
            <Route path="/games/catchsentence" element={<CatchSentencePage />} />
            <Route path="/games/lastbox" element={<LastBoxPage />} />
            <Route path="/games/airport" element={<AirportPage />} />
            <Route path="/games/restaurant" element={<RestaurantPage />} />
            <Route path="/games/icecream" element={<IceCreamPage />} />
            <Route path="/games/doctor" element={<DoctorPage />} />
            <Route path="/games/lightning" element={<LightningLuckPage />} />
            <Route path="/games/shufflefind" element={<ShuffleFindPage />} />
            <Route path="/games/telepathy" element={<TelepathyPage />} />
            <Route path="/games/mysterybox" element={<MysteryBoxPage />} />
            <Route path="*" element={<Navigate to="/me" replace />} />
          </>
        )}
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading fullScreen />}>
      <AppRoutes />
    </Suspense>
  );
}
