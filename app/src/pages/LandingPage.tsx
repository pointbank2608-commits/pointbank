import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import LanguageToggle from '../components/LanguageToggle';
import SpinWheel from '../components/SpinWheel';

export default function LandingPage() {
  const { t } = useTranslation();

  const wheelItems = [
    { id: '1', label: t('landing.wheelItem1') },
    { id: '2', label: t('landing.wheelItem2') },
    { id: '3', label: t('landing.wheelItem3') },
    { id: '4', label: t('landing.wheelItem4') },
    { id: '5', label: t('landing.wheelItem5') },
  ];

  const summary = [
    { icon: 'account_balance_wallet', title: t('landing.summaryPointTitle'), desc: t('landing.summaryPointDesc') },
    { icon: 'event_available', title: t('landing.summaryAttendanceTitle'), desc: t('landing.summaryAttendanceDesc') },
    { icon: 'sports_esports', title: t('landing.summaryGameTitle'), desc: t('landing.summaryGameDesc') },
    { icon: 'school', title: t('landing.summaryClassTitle'), desc: t('landing.summaryClassDesc') },
  ];

  const mockStudents = [
    { name: t('landing.mockStudent1'), pts: 350 },
    { name: t('landing.mockStudent2'), pts: 420 },
    { name: t('landing.mockStudent3'), pts: 340 },
  ];

  const attendanceRows = [
    { name: t('landing.feature3Sample1'), marks: [1, 1, 0, 1, 1, 0, 1] },
    { name: t('landing.feature3Sample2'), marks: [1, 0, 1, 1, 0, 0, 1] },
    { name: t('landing.feature3Sample3'), marks: [1, 1, 1, 0, 1, 0, 1] },
  ];

  return (
    <div className="bg-background text-on-background font-body-md antialiased">
      {/* 헤더 */}
      <header className="w-full h-20 px-margin-mobile md:px-margin-desktop flex justify-between items-center sticky top-0 bg-surface-container-lowest/90 backdrop-blur-md z-50 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl shrink-0">🐷</span>
          <span className="font-display-lg text-primary text-[18px] md:text-[26px] tracking-tight whitespace-nowrap truncate">
            {t('common.brand')}
          </span>
        </div>
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <LanguageToggle />
          <Link
            to="/login"
            className="bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md px-3 md:px-6 py-2.5 md:py-3 rounded-lg shadow-sm hover:-translate-y-[2px] transition-all whitespace-nowrap"
          >
            {t('landing.login')}
          </Link>
        </div>
      </header>

      <main className="max-w-container-max mx-auto w-full">
        {/* 히어로 */}
        <section className="relative pt-16 md:pt-24 pb-24 px-margin-mobile md:px-margin-desktop overflow-hidden flex flex-col md:flex-row items-center gap-12">
          <div className="absolute top-0 right-0 -z-10 w-[600px] h-[600px] bg-soft-mint/30 rounded-full blur-[100px] translate-x-1/3 -translate-y-1/4" />
          <div className="absolute bottom-0 left-0 -z-10 w-[500px] h-[500px] bg-warm-yellow/20 rounded-full blur-[80px] -translate-x-1/3 translate-y-1/4" />

          <div className="flex-1 space-y-7 z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-container rounded-full text-on-secondary-container font-label-md shadow-sm">
              <span className="material-symbols-outlined fill text-sm">star</span>
              {t('landing.betaBadge')}
            </div>
            <h1 className="font-display-lg text-headline-lg-mobile md:text-display-lg text-deep-navy leading-tight">
              {t('landing.heroTitleLine1')}
              <br />
              <span className="text-primary">{t('landing.heroTitleHighlight')}</span>
              {t('landing.heroTitleSuffix')}
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">{t('landing.heroDesc')}</p>
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Link
                to="/login"
                className="bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md px-8 py-4 rounded-lg shadow-[0_4px_20px_rgba(39,101,168,0.2)] hover:-translate-y-[2px] transition-all flex items-center justify-center gap-2"
              >
                {t('landing.startFree')}
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
            </div>
            <p className="font-caption text-caption text-outline">{t('landing.heroCaption')}</p>
          </div>

          <div className="flex-1 relative z-10 w-full max-w-lg">
            <div className="relative bg-surface-container-lowest rounded-xl shadow-[0_8px_30px_rgba(39,101,168,0.12)] border border-surface-container-highest p-6 overflow-hidden transform md:rotate-2 hover:rotate-0 transition-transform duration-500">
              <div className="flex justify-between items-center mb-6 border-b border-surface-container-low pb-4">
                <div>
                  <h3 className="font-title-md text-title-md text-deep-navy text-sm md:text-base">
                    {t('landing.mockClassName')}
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant">{t('landing.mockStudentCount')}</p>
                </div>
                <div className="bg-warm-yellow px-4 py-2 rounded-full font-title-md text-deep-navy text-sm shadow-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm fill">stars</span>
                  {t('landing.mockToday')} +{mockStudents.reduce((s, m) => s + m.pts, 0) % 100} {t('landing.mockUnit')}
                </div>
              </div>
              <div className="space-y-3">
                {mockStudents.map((s) => (
                  <div key={s.name} className="flex justify-between items-center p-3 rounded-lg bg-surface-container-low">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-title-md">
                        {s.name.slice(0, 1)}
                      </div>
                      <span className="font-body-md text-on-surface">{s.name}</span>
                    </div>
                    <span className="font-title-md text-primary bg-primary/10 px-3 py-1 rounded-full">
                      {s.pts}
                      {t('landing.mockPointSuffix')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="absolute -top-4 -right-4 bg-white p-3 rounded-xl shadow-lg border border-surface-container-low flex items-center gap-2">
                <span className="material-symbols-outlined text-warm-yellow text-2xl fill">workspace_premium</span>
                <div className="flex flex-col">
                  <span className="font-caption text-caption text-outline">{t('landing.mockSettleTitle')}</span>
                  <span className="font-label-md text-deep-navy">{t('landing.mockSettleDone')}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 한눈에 보기 */}
        <section className="px-margin-mobile md:px-margin-desktop pb-20">
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy text-center mb-10">
            {t('landing.summaryTitle')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {summary.map((s) => (
              <div
                key={s.title}
                className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_20px_rgba(39,101,168,0.08)] text-center flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-soft-mint/40 flex items-center justify-center text-primary mb-1">
                  <span className="material-symbols-outlined">{s.icon}</span>
                </div>
                <div className="font-title-md text-title-md text-on-surface">{s.title}</div>
                <div className="font-caption text-caption text-on-surface-variant">{s.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 기능 1 — 포인트 뱅킹 */}
        <section className="px-margin-mobile md:px-margin-desktop pb-24 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(39,101,168,0.08)] border border-surface-container p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                {t('landing.feature1Sample').slice(0, 1)}
              </div>
              <div>
                <div className="font-title-md text-title-md text-on-surface">
                  {t('landing.feature1Sample')} · {t('landing.feature1SampleClass')}
                </div>
                <div className="font-caption text-caption text-on-surface-variant">{t('landing.feature1SampleCheckin')}</div>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-caption text-caption text-on-surface-variant">{t('landing.feature1TodayLabel')}</span>
              <span className="font-display-lg text-[36px] text-primary font-bold">+7</span>
              <span className="font-body-md text-on-surface-variant">{t('landing.feature1Unit')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="bg-secondary-container text-on-secondary-container font-caption text-caption px-3 py-1.5 rounded-full">
                {t('landing.feature1Tag1')}
              </span>
              <span className="bg-secondary-container text-on-secondary-container font-caption text-caption px-3 py-1.5 rounded-full">
                {t('landing.feature1Tag2')}
              </span>
              <span className="bg-error-container text-on-error-container font-caption text-caption px-3 py-1.5 rounded-full">
                {t('landing.feature1Tag3')}
              </span>
            </div>
          </div>

          <div className="flex-1">
            <div className="font-label-md text-label-md text-primary mb-2">{t('landing.feature1Eyebrow')}</div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy mb-4">
              {t('landing.feature1Title')}
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              {t('landing.feature1DescBefore')}
              <strong className="text-on-surface">{t('landing.feature1DescStrong')}</strong>
              {t('landing.feature1DescAfter')}
            </p>
          </div>
        </section>

        {/* 기능 2 — 미니게임 */}
        <section className="px-margin-mobile md:px-margin-desktop pb-24 flex flex-col md:flex-row-reverse items-center gap-12">
          <div className="flex-1 bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(39,101,168,0.08)] border border-surface-container p-6 flex items-center justify-center">
            <div style={{ width: 260 }}>
              <SpinWheel items={wheelItems} />
            </div>
          </div>

          <div className="flex-1">
            <div className="font-label-md text-label-md text-primary mb-2">{t('landing.feature2Eyebrow')}</div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy mb-4">
              {t('landing.feature2Title')}
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">{t('landing.feature2Desc')}</p>
          </div>
        </section>

        {/* 기능 3 — 출석부 */}
        <section className="px-margin-mobile md:px-margin-desktop pb-24 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(39,101,168,0.08)] border border-surface-container p-6 overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="font-caption text-caption text-on-surface-variant">
                  <th className="text-left pb-2">{t('landing.feature3TableName')}</th>
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <th key={d} className="pb-2 px-1">
                      {d}
                    </th>
                  ))}
                  <th className="pb-2">{t('landing.feature3TableAttendance')}</th>
                </tr>
              </thead>
              <tbody className="font-body-md text-body-md">
                {attendanceRows.map((row) => (
                  <tr key={row.name} className="border-t border-surface-container">
                    <td className="text-left py-2 font-medium text-on-surface">{row.name}</td>
                    {row.marks.map((m, i) => (
                      <td key={i} className="py-2 px-1">
                        {m ? <span className="inline-block w-2.5 h-2.5 rounded-full bg-secondary mx-auto" /> : null}
                      </td>
                    ))}
                    <td className="py-2 font-bold text-primary">{row.marks.filter(Boolean).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex-1">
            <div className="font-label-md text-label-md text-primary mb-2">{t('landing.feature3Eyebrow')}</div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy mb-4">
              {t('landing.feature3Title')}
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">{t('landing.feature3Desc')}</p>
          </div>
        </section>

        {/* 마지막 CTA */}
        <section className="px-margin-mobile md:px-margin-desktop pb-20 text-center">
          <div className="bg-primary rounded-xl p-10 md:p-14 relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-5xl mb-4">🐷</div>
              <h2 className="font-headline-lg-mobile md:font-headline-lg text-on-primary mb-3">{t('landing.ctaTitle')}</h2>
              <p className="font-body-lg text-primary-fixed opacity-90 mb-6">{t('landing.ctaDesc')}</p>
              <Link
                to="/login"
                className="inline-flex bg-warm-yellow hover:bg-tertiary-fixed-dim text-on-tertiary-fixed-variant font-title-md text-title-md px-8 py-4 rounded-lg shadow-sm hover:-translate-y-[2px] transition-all"
              >
                {t('landing.startFree')}
              </Link>
            </div>
            <div
              className="absolute right-0 top-0 w-64 h-full opacity-20 pointer-events-none"
              style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #FFD54F 0%, transparent 60%)' }}
            />
          </div>
        </section>
      </main>

      <footer className="text-center py-8 font-caption text-caption text-outline">{t('landing.footer')}</footer>
    </div>
  );
}
