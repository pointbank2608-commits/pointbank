import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import LanguageToggle from '../components/LanguageToggle';
import SpinWheel from '../components/SpinWheel';

function CheckIcon() {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-on-secondary">
      ✓
    </span>
  );
}

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
    { icon: 'calendar_month', title: t('landing.summaryHomeworkTitle'), desc: t('landing.summaryHomeworkDesc') },
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

  const pains = [
    { n: '01', title: t('landing.pain1Title'), desc: t('landing.pain1Desc') },
    { n: '02', title: t('landing.pain2Title'), desc: t('landing.pain2Desc') },
    { n: '03', title: t('landing.pain3Title'), desc: t('landing.pain3Desc') },
  ];

  const compareRows = [
    [t('landing.compareRow1Label'), t('landing.compareRow1Off'), t('landing.compareRow1On')],
    [t('landing.compareRow2Label'), t('landing.compareRow2Off'), t('landing.compareRow2On')],
    [t('landing.compareRowHwLabel'), t('landing.compareRowHwOff'), t('landing.compareRowHwOn')],
    [t('landing.compareRow3Label'), t('landing.compareRow3Off'), t('landing.compareRow3On')],
    [t('landing.compareRow4Label'), t('landing.compareRow4Off'), t('landing.compareRow4On')],
  ];

  const steps = [
    { n: '1', title: t('landing.step1Title'), desc: t('landing.step1Desc') },
    { n: '2', title: t('landing.step2Title'), desc: t('landing.step2Desc') },
    { n: '3', title: t('landing.step3Title'), desc: t('landing.step3Desc') },
  ];

  return (
    <div className="landing bg-background text-on-background antialiased">
      <header className="sticky top-0 z-50 border-b border-outline-variant/40 bg-surface-container-lowest/85 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-container-max items-center justify-between px-margin-mobile md:px-margin-desktop">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-2xl shrink-0" aria-hidden>
              🐷
            </span>
            <span className="landing-display truncate text-[20px] text-primary md:text-[24px]">
              {t('common.brand')}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <LanguageToggle />
            <Link
              to="/login"
              className="hidden rounded-full border border-outline-variant px-4 py-2 font-label-md text-label-md text-on-surface transition hover:bg-surface-container-low sm:inline-flex"
            >
              {t('landing.login')}
            </Link>
            <Link
              to="/login"
              className="inline-flex rounded-full bg-primary px-4 py-2.5 font-label-md text-label-md text-on-primary transition hover:bg-primary-container md:px-5"
            >
              {t('landing.startFree')}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute -top-24 right-0 -z-10 h-[520px] w-[520px] rounded-full bg-soft-mint/35 blur-[90px]" />
          <div className="absolute -bottom-32 left-0 -z-10 h-[420px] w-[420px] rounded-full bg-warm-yellow/25 blur-[80px]" />
          <div className="mx-auto grid max-w-container-max items-center gap-12 px-margin-mobile py-16 md:grid-cols-2 md:px-margin-desktop md:py-24">
            <div className="space-y-7">
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center rounded-full bg-secondary-container px-4 py-1.5 font-label-md text-[13px] text-on-secondary-container">
                  {t('landing.heroEyebrow')}
                </div>
                <div className="inline-flex items-center rounded-full bg-warm-yellow px-4 py-1.5 font-label-md text-[13px] text-deep-navy">
                  {t('landing.betaBadge')}
                </div>
              </div>
              <h1 className="landing-display text-[36px] text-deep-navy md:text-[56px] md:leading-[1.12]">
                {t('landing.heroLine1')}
                <br />
                {t('landing.heroLine2')}
                <br />
                <span className="text-primary">{t('landing.heroLine3')}</span>
              </h1>
              <p className="max-w-xl text-[17px] leading-7 text-on-surface-variant md:text-body-lg">{t('landing.heroDesc')}</p>
              <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 font-title-md text-[16px] text-on-primary transition hover:bg-primary-container"
                >
                  {t('landing.startFree')}
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </Link>
              </div>
              <div className="flex flex-col gap-2 text-[14px] text-on-surface-variant sm:flex-row sm:gap-5">
                <span className="inline-flex items-center gap-2">
                  <CheckIcon />
                  {t('landing.heroCheck1')}
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckIcon />
                  {t('landing.heroCheck2')}
                </span>
              </div>
              <p className="font-caption text-caption text-outline">{t('landing.heroCaption')}</p>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-[28px] bg-surface-container-lowest shadow-[0_20px_50px_rgba(30,75,122,0.12)]">
                <img
                  src="/covers/landing-hero.jpg"
                  alt=""
                  className="h-[200px] w-full object-cover md:h-[240px]"
                />
                <div className="space-y-4 p-5 md:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-title-md text-[16px] text-deep-navy">{t('landing.mockClassName')}</div>
                      <div className="font-caption text-caption text-on-surface-variant">{t('landing.mockStudentCount')}</div>
                    </div>
                    <div className="rounded-full bg-warm-yellow px-3 py-1.5 font-label-md text-[13px] text-deep-navy">
                      {t('landing.mockToday')} +{mockStudents.reduce((s, m) => s + m.pts, 0) % 100} {t('landing.mockUnit')}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {mockStudents.map((s) => (
                      <div key={s.name} className="flex items-center justify-between rounded-2xl bg-surface-container-low px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container font-title-md text-[14px] text-on-primary-container">
                            {s.name.slice(0, 1)}
                          </div>
                          <span className="text-[15px] text-on-surface">{s.name}</span>
                        </div>
                        <span className="rounded-full bg-primary/10 px-3 py-1 font-title-md text-[14px] text-primary">
                          {s.pts}
                          {t('landing.mockPointSuffix')}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="mb-2 font-caption text-caption text-outline">{t('landing.mockPreset')}</div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-secondary-container px-3 py-1.5 font-caption text-caption text-on-secondary-container">
                        {t('landing.mockPreset1')}
                      </span>
                      <span className="rounded-full bg-secondary-container px-3 py-1.5 font-caption text-caption text-on-secondary-container">
                        {t('landing.mockPreset2')}
                      </span>
                      <span className="rounded-full bg-secondary-container px-3 py-1.5 font-caption text-caption text-on-secondary-container">
                        {t('landing.mockPreset3')}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-primary py-3 text-center font-label-md text-label-md text-on-primary">
                    {t('landing.mockGive')}
                  </div>
                </div>
              </div>
              <div className="absolute -right-2 -top-3 rounded-2xl border border-surface-container bg-white px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)] md:-right-4">
                <div className="font-caption text-caption text-outline">{t('landing.mockSettleTitle')}</div>
                <div className="font-label-md text-[13px] text-deep-navy">{t('landing.mockSettleDone')}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-surface-container-lowest">
          <div className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop md:py-24">
            <p className="mb-3 font-label-md text-[13px] tracking-wide text-primary">{t('landing.painEyebrow')}</p>
            <h2 className="landing-display mb-12 max-w-3xl text-[28px] text-deep-navy md:text-[40px]">
              {t('landing.painTitle')}
            </h2>
            <div className="grid gap-5 md:grid-cols-3">
              {pains.map((p) => (
                <div key={p.n} className="rounded-[24px] bg-background p-7">
                  <div className="mb-5 font-label-md text-[13px] text-primary">{p.n}</div>
                  <h3 className="landing-display mb-3 text-[22px] text-on-surface">{p.title}</h3>
                  <p className="text-[15px] leading-7 text-on-surface-variant">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-container-max px-margin-mobile py-16 md:px-margin-desktop">
          <h2 className="landing-display mb-10 text-center text-[28px] text-deep-navy md:text-[40px]">
            {t('landing.summaryTitle')}
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5 md:gap-5">
            {summary.map((s) => (
              <div
                key={s.title}
                className="flex flex-col items-center gap-2 rounded-[24px] bg-surface-container-lowest p-6 text-center shadow-[0_8px_30px_rgba(30,75,122,0.06)]"
              >
                <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-soft-mint/50 text-primary">
                  <span className="material-symbols-outlined">{s.icon}</span>
                </div>
                <div className="font-title-md text-[16px] text-on-surface">{s.title}</div>
                <div className="font-caption text-caption text-on-surface-variant">{s.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-container-max items-center gap-12 px-margin-mobile py-16 md:grid-cols-2 md:px-margin-desktop md:py-20">
          <div className="rounded-[28px] border border-surface-container bg-surface-container-lowest p-6 shadow-[0_12px_40px_rgba(30,75,122,0.06)]">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-container font-title-md text-on-primary-container">
                {t('landing.feature1Sample').slice(0, 1)}
              </div>
              <div>
                <div className="font-title-md text-[16px] text-on-surface">
                  {t('landing.feature1Sample')} · {t('landing.feature1SampleClass')}
                </div>
                <div className="font-caption text-caption text-on-surface-variant">{t('landing.feature1SampleCheckin')}</div>
              </div>
            </div>
            <div className="mb-4 flex items-baseline gap-2">
              <span className="font-caption text-caption text-on-surface-variant">{t('landing.feature1TodayLabel')}</span>
              <span className="landing-display text-[40px] text-primary">+7</span>
              <span className="text-on-surface-variant">{t('landing.feature1Unit')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-secondary-container px-3 py-1.5 font-caption text-caption text-on-secondary-container">
                {t('landing.feature1Tag1')}
              </span>
              <span className="rounded-full bg-secondary-container px-3 py-1.5 font-caption text-caption text-on-secondary-container">
                {t('landing.feature1Tag2')}
              </span>
              <span className="rounded-full bg-error-container px-3 py-1.5 font-caption text-caption text-on-error-container">
                {t('landing.feature1Tag3')}
              </span>
            </div>
          </div>
          <div>
            <div className="mb-2 font-label-md text-[13px] tracking-wide text-primary">{t('landing.feature1Eyebrow')}</div>
            <h2 className="landing-display mb-4 text-[28px] text-deep-navy md:text-[40px]">{t('landing.feature1Title')}</h2>
            <p className="text-[17px] leading-8 text-on-surface-variant">
              {t('landing.feature1DescBefore')}
              <strong className="text-on-surface">{t('landing.feature1DescStrong')}</strong>
              {t('landing.feature1DescAfter')}
            </p>
          </div>
        </section>

        <section className="bg-surface-container-lowest">
          <div className="mx-auto grid max-w-container-max items-center gap-12 px-margin-mobile py-16 md:grid-cols-2 md:px-margin-desktop md:py-20">
            <div className="md:order-2">
              <div className="flex h-[300px] items-center justify-center overflow-hidden rounded-[28px] bg-background">
                <div className="origin-center scale-[0.64]" style={{ width: 420, height: 420 }}>
                  <SpinWheel items={wheelItems} />
                </div>
              </div>
            </div>
            <div className="md:order-1">
              <div className="mb-2 font-label-md text-[13px] tracking-wide text-primary">{t('landing.feature2Eyebrow')}</div>
              <h2 className="landing-display mb-4 text-[28px] text-deep-navy md:text-[40px]">{t('landing.feature2Title')}</h2>
              <p className="text-[17px] leading-8 text-on-surface-variant">{t('landing.feature2Desc')}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-container-max items-center gap-12 px-margin-mobile py-16 md:grid-cols-2 md:px-margin-desktop md:py-20">
          <div className="overflow-x-auto rounded-[28px] border border-surface-container bg-surface-container-lowest p-6 shadow-[0_12px_40px_rgba(30,75,122,0.06)]">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="font-caption text-caption text-on-surface-variant">
                  <th className="pb-3 text-left">{t('landing.feature3TableName')}</th>
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <th key={d} className="px-1 pb-3">
                      {d}
                    </th>
                  ))}
                  <th className="pb-3">{t('landing.feature3TableAttendance')}</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.map((row) => (
                  <tr key={row.name} className="border-t border-surface-container">
                    <td className="py-3 text-left font-medium text-on-surface">{row.name}</td>
                    {row.marks.map((m, i) => (
                      <td key={i} className="px-1 py-3">
                        {m ? <span className="mx-auto inline-block h-2.5 w-2.5 rounded-full bg-secondary" /> : null}
                      </td>
                    ))}
                    <td className="py-3 font-bold text-primary">{row.marks.filter(Boolean).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="mb-2 font-label-md text-[13px] tracking-wide text-primary">{t('landing.feature3Eyebrow')}</div>
            <h2 className="landing-display mb-4 text-[28px] text-deep-navy md:text-[40px]">{t('landing.feature3Title')}</h2>
            <p className="text-[17px] leading-8 text-on-surface-variant">{t('landing.feature3Desc')}</p>
          </div>
        </section>

        <section className="bg-surface-container-lowest">
          <div className="mx-auto grid max-w-container-max items-center gap-12 px-margin-mobile py-16 md:grid-cols-2 md:px-margin-desktop md:py-20">
            <div>
              <div className="mb-2 font-label-md text-[13px] tracking-wide text-primary">{t('landing.feature4Eyebrow')}</div>
              <h2 className="landing-display mb-4 text-[28px] text-deep-navy md:text-[40px]">{t('landing.feature4Title')}</h2>
              <p className="mb-8 text-[17px] leading-8 text-on-surface-variant">{t('landing.feature4Desc')}</p>
              <div className="space-y-4">
                <div className="flex flex-col gap-2 rounded-[20px] bg-background p-4 sm:flex-row sm:items-center">
                  <div className="min-w-[7.5rem] font-label-md text-[13px] text-on-surface-variant">{t('landing.feature4DoneIf')}</div>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <span className="rounded-full bg-secondary-container px-3 py-1.5 font-label-md text-[13px] text-on-secondary-container">
                      + {t('landing.feature4DoneBtn')}
                    </span>
                    <span className="text-outline">→</span>
                    <span className="inline-flex items-center gap-1 font-label-md text-[13px] text-secondary">
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      {t('landing.feature4DoneThen')}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 rounded-[20px] bg-background p-4 sm:flex-row sm:items-center">
                  <div className="min-w-[7.5rem] font-label-md text-[13px] text-on-surface-variant">{t('landing.feature4MissIf')}</div>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <span className="rounded-full bg-error-container px-3 py-1.5 font-label-md text-[13px] text-on-error-container">
                      − {t('landing.feature4MissBtn')}
                    </span>
                    <span className="text-outline">→</span>
                    <span className="inline-flex items-center gap-1 font-label-md text-[13px] text-error">
                      <span className="material-symbols-outlined text-[18px]">cancel</span>
                      {t('landing.feature4MissThen')}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-5 font-caption text-caption text-outline">{t('landing.feature4Hint')}</p>
            </div>

            <div className="rounded-[28px] bg-background p-6">
              <div className="mb-4 font-title-md text-[16px] text-deep-navy">{t('landing.feature4CalName')}</div>
              <div className="mb-4 flex gap-4 font-caption text-caption text-on-surface-variant">
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  </span>
                  {t('landing.feature4Done')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-error-container text-on-error-container">
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </span>
                  {t('landing.feature4Miss')}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {(
                  [
                    ['homework.weekdayMon', 'done'],
                    ['homework.weekdayTue', 'done'],
                    ['homework.weekdayWed', 'missing'],
                    ['homework.weekdayThu', 'done'],
                    ['homework.weekdayFri', 'none'],
                  ] as const
                ).map(([dayKey, status], i) => (
                  <div key={dayKey} className="flex aspect-square flex-col items-center justify-between rounded-xl border border-surface-container p-2">
                    <span className="self-end font-caption text-caption text-on-surface-variant">{i + 3}</span>
                    {status === 'done' && (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                        <span className="material-symbols-outlined text-[16px]">check</span>
                      </span>
                    )}
                    {status === 'missing' && (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-error-container text-on-error-container">
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </span>
                    )}
                    {status === 'none' && <span className="h-7" />}
                    <span className="font-caption text-[11px] text-on-surface-variant">{t(dayKey)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop">
            <p className="mb-3 font-label-md text-[13px] tracking-wide text-primary">{t('landing.compareEyebrow')}</p>
            <h2 className="landing-display mb-10 text-[28px] text-deep-navy md:text-[40px]">{t('landing.compareTitle')}</h2>
            <div className="overflow-x-auto rounded-[24px] bg-background">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="font-label-md text-[13px] text-on-surface-variant">
                    <th className="px-5 py-4 font-medium" />
                    <th className="px-5 py-4 font-medium">{t('landing.compareOffline')}</th>
                    <th className="px-5 py-4 font-medium text-primary">{t('landing.compareUs')}</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row) => (
                    <tr key={row[0]} className="border-t border-surface-container">
                      <td className="px-5 py-4 font-label-md text-[14px] text-on-surface">{row[0]}</td>
                      <td className="px-5 py-4 text-[14px] text-on-surface-variant">{row[1]}</td>
                      <td className="px-5 py-4 text-[14px] font-medium text-on-surface">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop">
          <p className="mb-3 font-label-md text-[13px] tracking-wide text-primary">{t('landing.stepsEyebrow')}</p>
          <h2 className="landing-display mb-12 text-[28px] text-deep-navy md:text-[40px]">{t('landing.stepsTitle')}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="rounded-[24px] bg-surface-container-lowest p-7 shadow-[0_8px_30px_rgba(30,75,122,0.06)]">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-primary font-title-md text-on-primary">
                  {s.n}
                </div>
                <h3 className="landing-display mb-2 text-[20px] text-on-surface">{s.title}</h3>
                <p className="text-[15px] leading-7 text-on-surface-variant">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-margin-mobile pb-20 md:px-margin-desktop">
          <div className="relative mx-auto max-w-container-max overflow-hidden rounded-[32px] bg-primary px-8 py-14 text-center md:px-14 md:py-16">
            <h2 className="landing-display relative z-10 mb-3 text-[28px] text-on-primary md:text-[40px]">{t('landing.ctaTitle')}</h2>
            <p className="relative z-10 mb-8 text-[17px] text-primary-fixed">{t('landing.ctaDesc')}</p>
            <Link
              to="/login"
              className="relative z-10 inline-flex rounded-full bg-warm-yellow px-8 py-4 font-title-md text-[16px] text-on-tertiary-fixed-variant transition hover:bg-tertiary-fixed-dim"
            >
              {t('landing.startFree')}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-variant/40 py-10 text-center font-caption text-caption text-outline">
        {t('landing.footer')}
      </footer>
    </div>
  );
}
