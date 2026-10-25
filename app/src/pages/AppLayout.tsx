import { Suspense } from 'react';
import PageLoading from '../components/PageLoading';
import { useState, useEffect } from 'react';
import { NoticeOverlays, NotificationBell } from '../components/NoticeCenter';
import { LAST_PAGE_KEY } from '../lib/support';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import AcademyCodeButton from '../components/AcademyCodeButton';
import MaterialsPenButton from '../components/MaterialsPenButton';
import BoardReturnPill from '../components/board/BoardReturnPill';
import CoachTip from '../components/CoachTip';
import DeletionBanner from '../components/DeletionBanner';
import { TrialBanner, TrialModal } from '../components/TrialNotice';
import SosButton from '../components/SosButton';
import BrandMark from '../components/BrandMark';
import FontSizeToggle from '../components/FontSizeToggle';
import LanguageToggle from '../components/LanguageToggle';
import LessonRunnerBar from '../components/LessonRunnerBar';
import PlanRouteGuard from '../components/PlanRouteGuard';
import PresentZoomArea from '../components/PresentZoomArea';
import PrintBrandFooter from '../components/PrintBrandFooter';
import PrintWatermark from '../components/PrintWatermark';
import { useAuth } from '../context/AuthContext';
import { LessonRunnerProvider, useLessonRunner } from '../context/LessonRunnerContext';
import StaffNav from '../components/StaffNav';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

/** 레슨 러너(수업 진행바)가 화면 전환과 무관하게 살아있어야 해서, AppLayout 전체를
 * LessonRunnerProvider로 한 번 감싸고 실제 레이아웃은 안쪽 컴포넌트에서 그린다. */
export default function AppLayout() {
  return (
    <LessonRunnerProvider>
      <AppLayoutInner />
    </LessonRunnerProvider>
  );
}

function AppLayoutInner() {
  const { academy, profile, pointUnit, isStaff, isPaid, trial, signOut } = useAuth();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  // 도움말·문의를 열기 전 마지막 페이지(문의에 자동으로 붙는다)
  useEffect(() => {
    if (pathname.startsWith('/help')) return;
    try {
      sessionStorage.setItem(LAST_PAGE_KEY, pathname);
    } catch {
      /* 무시 */
    }
  }, [pathname]);
  const [mobileOpen, setMobileOpen] = useState(false);
  // 클래스뱅크 브랜드 footer 는 "수업 자료실"에서 뽑는 인쇄물에만 찍는다(학원 워터마크는 전 화면 공통).
  const isMaterialsPrint = pathname.startsWith('/materials');
  const isWorkbookPrint = /^\/materials\/(worksheet|cvc-workbook|long-vowel-workbook|phonics-stage-[45]-workbook|phonics-stage-1|grammar-workbook)$/.test(pathname) || pathname === '/phonics/stage-1';

  // "발표하기"를 누른 뒤 "수업 마치기" 전까지는 사이드바·상단바·페이지 여백을 전부 걷어낸다 —
  // 발표 중엔 편집 화면으로 빠져나가지 못하고 만들어 둔 수업만 진행한다(2026-09-25 사용자 결정).
  // 전체화면 버튼은 브라우저 전체화면만 켜고 끈다.
  const { runner } = useLessonRunner();
  const isPresenting = runner != null;

  const ROLE_LABEL: Record<string, string> = {
    owner: t('nav.roleOwner'),
    teacher: t('nav.roleTeacher'),
    student: t('nav.roleStudent'),
  };

  // 선생님 메뉴는 StaffNav(5개 묶음)가 그린다. 학생은 자기 통장과 게임만.
  const studentNavItems: NavItem[] = [
    { to: '/me', label: t('nav.myBoard'), icon: 'account_balance_wallet' },
    { to: '/games', label: t('nav.games'), icon: 'sports_esports' },
  ];

  const homeTo = isStaff ? '/dashboard' : '/me';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3.5 px-4 py-3 rounded-[14px] font-label-md text-[17px] font-semibold transition-all ${
      isActive ? 'bg-primary text-white shadow-[0_6px_16px_rgb(8_102_255/35%)]' : 'text-white/85 hover:bg-white/10'
    }`;

  const displayName = profile?.display_name ?? '';
  const roleLabel = ROLE_LABEL[profile?.role ?? ''] ?? '';
  const planBadge = isPaid ? t('settings.planPaidBadge') : trial.active ? t('trial.badge', { n: (trial.daysLeft ?? 0) + 1 }) : t('settings.planFreeBadge');

  // 네이비 사이드바(시안 02_dashboard_launcher_selected) — 로고·메뉴·마스코트·내 계정
  const sidebarContent = (
    <>
      <Link to={homeTo} className="flex items-center gap-3 px-6 pb-6 pt-1" onClick={() => setMobileOpen(false)}>
        {academy?.logo_url ? (
          <img src={academy.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-xl bg-white object-cover" />
        ) : (
          <BrandMark className="h-10 w-12 shrink-0" />
        )}
        <div className="min-w-0">
          <h1 className="font-display-lg text-[22px] font-black leading-tight text-white">{t('common.brand')}</h1>
          <p className="truncate font-caption text-[13px] leading-tight text-white/75">{academy?.name ?? ''}</p>
          <p className="truncate font-caption text-[11px] leading-tight text-white/45">{t('nav.pointUnitLabel', { unit: pointUnit })}</p>
        </div>
      </Link>

      {isStaff ? (
        <StaffNav onNavigate={() => setMobileOpen(false)} />
      ) : (
        <ul className="flex flex-1 flex-col gap-1.5 px-4">
          {studentNavItems.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} onClick={() => setMobileOpen(false)} className={navLinkClass}>
                <span className="material-symbols-outlined text-[28px]">{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}

      {isStaff && <AcademyCodeButton />}

      <div className="mx-5 mb-4 mt-4 hidden text-center [@media(min-height:820px)]:block">
        <img src="/ui2/m-pencil.webp" alt="" aria-hidden width={669} height={654} loading="lazy" draggable={false} className="mx-auto h-[7.5rem] w-auto select-none" />
        <p className="mt-1 font-label-md text-[15px] text-white/90">{t('nav.sidebarCheer')}</p>
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-white/15 px-4 pb-1 pt-4">
        {isStaff ? (
          // 선생님은 이름 줄을 눌러 결제 화면으로 바로 갈 수 있다(이름 · 역할, 플랜 배지).
          <Link
            to="/settings/billing"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-[14px] px-2 py-2 transition-colors hover:bg-white/10"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#4a9bff] font-title-md text-lg font-bold text-white">
              {(displayName || t('common.avatarInitialFallback')).slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-label-md text-[16px] font-bold text-white">
                {displayName}
                {roleLabel && <span className="font-semibold text-white/80"> · {roleLabel}</span>}
              </p>
              <p className="mt-0.5">
                <span className="rounded-full bg-white/15 px-2 py-0.5 font-caption text-[11px] text-white/85">{planBadge}</span>
              </p>
            </div>
            <span className="material-symbols-outlined shrink-0 text-[22px] text-white/70">chevron_right</span>
          </Link>
        ) : (
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#4a9bff] font-title-md text-lg font-bold text-white">
              {(displayName || t('common.avatarInitialFallback')).slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-label-md text-[16px] font-bold text-white">{displayName}</p>
              <p className="font-caption text-caption text-white/70">{roleLabel}</p>
            </div>
          </div>
        )}
        {/* 글자 크기·언어는 데스크톱에서는 위쪽 막대에 있다. 모바일 서랍에서만 여기에 둔다 */}
        <div className="flex flex-col gap-2 px-2 md:hidden">
          <FontSizeToggle />
          <LanguageToggle />
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-left font-label-md text-[15px] text-white/70 transition-all hover:bg-white/10 hover:text-white"
        >
          <span className="material-symbols-outlined text-[22px]">logout</span>
          {t('nav.signOut')}
        </button>
      </div>
    </>
  );

  // 발표 모드 — 사이드바·상단바·페이지 여백 없이 진행바 + 지금 슬라이드만 화면을 꽉 채운다.
  // 게임(GameThemeFrame)·이미지 슬라이드는 PresentZoomArea 안에서 absolute inset-0 으로 영역 전체를
  // 채우고, 두 손가락·Ctrl+휠로 확대·축소할 수 있다.
  if (isPresenting) {
    return (
      // 인쇄할 때는 고정 높이·스크롤 박스를 풀어야 여러 장이 잘리지 않고 다 나온다(print:*).
      <div className="flex h-[100dvh] flex-col bg-background font-body-md text-on-background print:block print:h-auto">
        <PrintWatermark />
        {isMaterialsPrint && <PrintBrandFooter />}
        <LessonRunnerBar />
        <PresentZoomArea>
          <PlanRouteGuard />
          <Suspense fallback={<PageLoading />}><Outlet /></Suspense>
        </PresentZoomArea>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex bg-background font-body-md text-on-background ${isWorkbookPrint ? 'print:block print:min-h-0 print:bg-white' : ''}`}>
      <PrintWatermark />
      {isMaterialsPrint && <PrintBrandFooter />}
      {/* 모바일 상단바 */}
      {/* iOS PWA(홈 화면 추가, viewport-fit=cover + black-translucent 상태 바)에서는 상태 바 영역이
          웹뷰 위에 겹쳐 그려지고 그 영역의 터치는 시스템이 가로채 버려서, 헤더가 화면 맨 위(y=0)에서
          시작하면 왼쪽 메뉴 버튼이 그 영역에 걸려 눌리지 않는다. safe-area-inset-top 만큼 아래로
          밀어서 실제 탭 영역이 상태 바 밖으로 나오게 한다. */}
      <header data-app-chrome
        className="no-print md:hidden fixed top-0 left-0 right-0 bg-surface-container-lowest shadow-sm flex items-center justify-between px-margin-mobile z-40 pt-[env(safe-area-inset-top,0px)]"
        style={{ height: 'calc(4rem + env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 text-on-surface-variant"
          aria-label={t('nav.openMenu')}
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <span className="font-title-md text-title-md text-deep-navy font-extrabold truncate">
          {academy?.name ?? t('common.brand')}
        </span>
        {isStaff ? (<div className="flex items-center gap-1"><SosButton /><NotificationBell /></div>) : (<div className="w-9" aria-hidden />)}
      </header>

      {/* 모바일 드로어 */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-inverse-surface/40 z-50" onClick={() => setMobileOpen(false)}>
          <nav
            className="flex h-full w-[19rem] max-w-[86vw] flex-col overflow-y-auto overscroll-contain bg-deep-navy pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(1.5rem+env(safe-area-inset-top,0px))]"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </nav>
        </div>
      )}

      {/* 데스크톱 사이드바 */}
      {/* 화면 높이가 낮으면(작은 노트북·브라우저 창 축소) 하단 설정·로그아웃이 잘려서, 사이드바 자체를 스크롤되게 한다. */}
      <nav data-app-chrome className="no-print fixed left-0 top-0 z-30 hidden h-[100dvh] w-[17.5rem] flex-col overflow-y-auto overscroll-contain bg-deep-navy py-7 md:flex">
        {sidebarContent}
      </nav>

      <main data-app-main className={`flex-1 min-w-0 md:ml-[17.5rem] pt-[calc(4rem+env(safe-area-inset-top,0px))] md:pt-0 min-h-screen print:min-h-0 print:pt-0 ${isWorkbookPrint ? 'print:ml-0' : ''}`}>
        <LessonRunnerBar />
        {/* 데스크톱 상단바 */}
        <header data-app-chrome className="no-print sticky top-0 z-20 hidden h-16 items-center justify-end gap-3 bg-background/90 px-margin-desktop backdrop-blur md:flex">
          <FontSizeToggle showLabel />
          <LanguageToggle />
          {isStaff && <SosButton />}
          {isStaff && <NotificationBell />}
          <Link
            to={isStaff ? '/settings' : homeTo}
            className="text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors"
            aria-label={t('nav.settings')}
          >
            <span className="material-symbols-outlined">settings</span>
          </Link>
          <Link
            to={isStaff ? '/settings' : homeTo}
            className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-title-md text-sm border border-outline-variant/30 shrink-0"
            aria-label={t('nav.myProfile')}
          >
            {(profile?.display_name ?? t('common.avatarInitialFallback')).slice(0, 1)}
          </Link>
        </header>
        <div data-app-content className="p-margin-mobile md:p-margin-desktop max-w-[1280px] mx-auto w-full print:max-w-none print:p-0">
          <div data-app-chrome>
          {isStaff && <NoticeOverlays />}
          <PlanRouteGuard />
          {isStaff && <DeletionBanner />}
          {isStaff && <TrialBanner />}
          {isStaff && <CoachTip />}
          {isStaff && <TrialModal />}
          </div>
          <Suspense fallback={<PageLoading />}><Outlet /></Suspense>
        </div>
        {pathname.startsWith('/materials') && <MaterialsPenButton />}
        <BoardReturnPill />
      </main>
    </div>
  );
}
