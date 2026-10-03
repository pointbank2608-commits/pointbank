import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import LanguageToggle from '../components/LanguageToggle';
import SpinWheel from '../components/SpinWheel';

function CheckIcon() {
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[13px] font-bold text-on-secondary">
      ✓
    </span>
  );
}

export default function LandingPage() {
  const { t } = useTranslation();

  const wheelItems = [
    { id: '1', label: 'apple' },
    { id: '2', label: 'banana' },
    { id: '3', label: 'grape' },
    { id: '4', label: 'melon' },
    { id: '5', label: 'peach' },
  ];

  const mockSlides = [
    { icon: 'style', label: t('landing.mockSlide1') },
    { icon: 'flip', label: t('landing.mockSlide2') },
    { icon: 'casino', label: t('landing.mockSlide3') },
    { icon: 'emoji_events', label: t('landing.mockSlide4') },
    { icon: 'print', label: t('landing.mockSlide5') },
    { icon: 'stars', label: t('landing.mockSlide6') },
  ];

  const pains = [
    { n: '01', title: t('landing.pain1Title'), desc: t('landing.pain1Desc'), image: '/covers/landing-pain-1.jpg' },
    { n: '02', title: t('landing.pain2Title'), desc: t('landing.pain2Desc'), image: '/covers/landing-pain-2.jpg' },
    { n: '03', title: t('landing.pain3Title'), desc: t('landing.pain3Desc'), image: '/covers/landing-pain-3.jpg' },
  ];

  const flow = [
    { n: '1', icon: 'menu_book', title: t('landing.flow1Title'), desc: t('landing.flow1Desc') },
    { n: '2', icon: 'library_add', title: t('landing.flow2Title'), desc: t('landing.flow2Desc') },
    { n: '3', icon: 'co_present', title: t('landing.flow3Title'), desc: t('landing.flow3Desc') },
  ];

  const showcases = [
    { eyebrow: t('landing.show1Eyebrow'), title: t('landing.show1Title'), desc: t('landing.show1Desc'), image: '/covers/game-quizshow.jpg' },
    { eyebrow: t('landing.show2Eyebrow'), title: t('landing.show2Title'), desc: t('landing.show2Desc'), image: '/covers/material-cvcworkbook.jpg' },
  ];

  const everything = [
    { icon: 'co_present', title: t('landing.allLessonTitle'), desc: t('landing.allLessonDesc') },
    { icon: 'sports_esports', title: t('landing.allGameTitle'), desc: t('landing.allGameDesc') },
    { icon: 'emoji_events', title: t('landing.allContestTitle'), desc: t('landing.allContestDesc') },
    { icon: 'print', title: t('landing.allPrintTitle'), desc: t('landing.allPrintDesc') },
    { icon: 'auto_stories', title: t('landing.allWordsTitle'), desc: t('landing.allWordsDesc') },
    { icon: 'smart_display', title: t('landing.allVideoTitle'), desc: t('landing.allVideoDesc') },
    { icon: 'videocam', title: t('landing.allOnlineTitle'), desc: t('landing.allOnlineDesc') },
    { icon: 'account_balance_wallet', title: t('landing.allManageTitle'), desc: t('landing.allManageDesc') },
  ];

  const compareRows = [1, 2, 3, 4, 5].map((n) => [
    t(`landing.compareRow${n}Label`),
    t(`landing.compareRow${n}Off`),
    t(`landing.compareRow${n}On`),
  ]);

  const plans = [
    {
      name: t('landing.pricingFreeName'),
      price: t('landing.pricingFreePrice'),
      sub: '',
      paid: false,
      features: [t('landing.pricingFreeF1'), t('landing.pricingFreeF2'), t('landing.pricingFreeF3')],
    },
    {
      name: t('landing.pricingPaidName'),
      price: t('landing.pricingPaidPrice'),
      sub: t('landing.pricingPaidVat'),
      paid: true,
      features: [t('landing.pricingPaidF1'), t('landing.pricingPaidF2'), t('landing.pricingPaidF3')],
    },
  ];

  return (
    <div className="landing bg-background text-on-background antialiased">
      <header className="sticky top-0 z-50 border-b border-[#2a241c]/8 bg-[#fff8ee]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-container-max items-center justify-between px-margin-mobile md:px-margin-desktop">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="h-11 w-11 shrink-0 drop-shadow-sm" />
            <span className="landing-logo text-[20px] text-[#3d2e22] sm:text-[23px] md:text-[28px]">
              {t('common.brand')}
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <LanguageToggle className="bg-[#efe6d8]" />
            <Link
              to="/login"
              className="hidden rounded-full border border-[#3d2e22]/18 px-4 py-2 font-label-md text-[16px] text-[#3d2e22] transition hover:bg-[#efe6d8] sm:inline-flex"
            >
              {t('landing.login')}
            </Link>
            <Link
              to="/login"
              className="inline-flex rounded-full bg-[#3d2e22] px-4 py-2.5 font-label-md text-[16px] text-[#fff8ee] transition hover:bg-[#2a241c] md:px-5"
            >
              {t('landing.startFree')}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="landing-hero-media relative">
            <img
              src="/covers/landing-hero.jpg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-[50%_42%]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#fff8ee]/18 via-transparent to-[#2a241c]/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#2a241c]/80 via-[#2a241c]/42 to-transparent" />
            <div className="relative mx-auto grid h-full min-h-[inherit] max-w-container-max items-center gap-10 px-margin-mobile py-16 md:grid-cols-[1.05fr_0.95fr] md:px-margin-desktop md:py-20">
              <div className="space-y-7 text-white">
                <div className="flex flex-wrap gap-2">
                  <div className="inline-flex items-center rounded-full bg-white/14 px-4 py-1.5 font-label-md text-[15px] text-white backdrop-blur-sm">
                    {t('landing.heroEyebrow')}
                  </div>
                  <div className="inline-flex items-center rounded-full bg-warm-yellow px-4 py-1.5 font-label-md text-[15px] text-deep-navy">
                    {t('landing.heroBadge')}
                  </div>
                </div>
                <h1 className="landing-display text-[42px] leading-[1.2] text-white md:text-[64px] md:leading-[1.16]">
                  {t('landing.heroLine1')}
                  <br />
                  {t('landing.heroLine2')} <span className="text-warm-yellow">{t('landing.heroLine3')}</span>
                </h1>
                <p className="max-w-xl text-[19px] leading-8 text-white/86 md:text-[21px] md:leading-9">{t('landing.heroDesc')}</p>
                <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-warm-yellow px-8 py-4 font-title-md text-[18px] text-deep-navy transition hover:bg-tertiary-fixed-dim"
                  >
                    {t('landing.startFree')}
                    <span className="material-symbols-outlined text-[22px]">arrow_forward</span>
                  </Link>
                </div>
                <div className="flex flex-col gap-2 text-[16px] text-white/82 sm:flex-row sm:flex-wrap sm:gap-x-5 md:text-[17px]">
                  {[t('landing.heroCheck1'), t('landing.heroCheck2'), t('landing.heroCheck3')].map((c) => (
                    <span key={c} className="inline-flex items-center gap-2">
                      <CheckIcon />
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="overflow-hidden rounded-[28px] bg-surface-container-lowest/95 shadow-[0_24px_60px_rgba(8,20,36,0.35)] backdrop-blur-sm">
                  <div className="space-y-4 p-5 md:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-title-md text-[18px] text-deep-navy">{t('landing.mockLessonTitle')}</div>
                        <div className="text-[15px] text-on-surface-variant">{t('landing.mockLessonSub')}</div>
                      </div>
                      <div className="rounded-full bg-warm-yellow px-3 py-1.5 font-label-md text-[15px] text-deep-navy">
                        {t('landing.mockBadge')}
                      </div>
                    </div>
                    <ol className="grid grid-cols-2 gap-2">
                      {mockSlides.map((s, i) => (
                        <li key={s.label} className="flex items-center gap-2.5 rounded-2xl bg-surface-container-low px-3 py-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                            <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                          </span>
                          <span className="min-w-0 text-[15px] leading-5 text-on-surface">
                            <span className="mr-1 text-outline">{i + 1}</span>
                            {s.label}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-label-md text-[16px] text-on-primary">
                      <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                      {t('landing.mockPresent')}
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-5 -left-2 rounded-2xl border border-white/70 bg-white px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] md:-left-6">
                  <div className="text-[14px] text-outline">{t('landing.mockFloatTitle')}</div>
                  <div className="font-label-md text-[15px] text-deep-navy">{t('landing.mockFloatDone')}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#12263d]">
          <div className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop md:py-24">
            <p className="mb-3 font-label-md text-[16px] tracking-wide text-soft-mint">{t('landing.painEyebrow')}</p>
            <h2 className="landing-display mb-12 max-w-3xl text-[32px] text-white md:text-[48px]">{t('landing.painTitle')}</h2>
            <div className="grid gap-5 md:grid-cols-3">
              {pains.map((p) => (
                <article key={p.n} className="landing-pain-card relative aspect-[3/4] overflow-hidden rounded-[28px]">
                  <img src={p.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b1726]/92 via-[#0b1726]/35 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-7">
                    <div className="mb-4 font-label-md text-[16px] text-warm-yellow">{p.n}</div>
                    <h3 className="landing-display mb-3 text-[26px] text-white">{p.title}</h3>
                    <p className="text-[17px] leading-8 text-white/84">{p.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#fff8ee]">
          <div className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop md:py-24">
            <p className="mb-3 font-label-md text-[16px] tracking-wide text-primary">{t('landing.flowEyebrow')}</p>
            <h2 className="landing-display mb-10 max-w-3xl text-[32px] text-deep-navy md:text-[48px]">{t('landing.flowTitle')}</h2>
            <div className="grid gap-5 md:grid-cols-3">
              {flow.map((s) => (
                <div key={s.n} className="rounded-[28px] bg-white p-7 shadow-[0_8px_30px_rgba(30,75,122,0.06)]">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary font-title-md text-[18px] text-on-primary">
                      {s.n}
                    </span>
                    <span className="material-symbols-outlined text-[28px] text-primary">{s.icon}</span>
                  </div>
                  <h3 className="landing-display mb-3 text-[26px] text-deep-navy">{s.title}</h3>
                  <p className="text-[17px] leading-8 text-on-surface-variant">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {showcases.map((sc, i) => (
          <section key={sc.title} className={i % 2 === 0 ? '' : 'bg-surface-container-lowest'}>
            <div className="mx-auto grid max-w-container-max items-center gap-12 px-margin-mobile py-16 md:grid-cols-2 md:px-margin-desktop md:py-20">
              <div className={`overflow-hidden rounded-[28px] shadow-[0_16px_48px_rgba(30,75,122,0.12)] ${i % 2 === 0 ? '' : 'md:order-2'}`}>
                <img src={sc.image} alt="" className="aspect-[4/3] w-full object-cover" />
              </div>
              <div className={i % 2 === 0 ? '' : 'md:order-1'}>
                <div className="mb-2 font-label-md text-[16px] tracking-wide text-primary">{sc.eyebrow}</div>
                <h2 className="landing-display mb-4 text-[32px] text-deep-navy md:text-[48px]">{sc.title}</h2>
                <p className="text-[19px] leading-9 text-on-surface-variant">{sc.desc}</p>
              </div>
            </div>
          </section>
        ))}

        <section>
          <div className="mx-auto grid max-w-container-max items-center gap-12 px-margin-mobile py-16 md:grid-cols-2 md:px-margin-desktop md:py-20">
            <div className="flex h-[320px] items-center justify-center overflow-hidden rounded-[28px] bg-background shadow-[0_16px_48px_rgba(30,75,122,0.08)]">
              <div className="origin-center scale-[0.68]" style={{ width: 420, height: 420 }}>
                <SpinWheel items={wheelItems} />
              </div>
            </div>
            <div>
              <div className="mb-2 font-label-md text-[16px] tracking-wide text-primary">{t('landing.show3Eyebrow')}</div>
              <h2 className="landing-display mb-4 text-[32px] text-deep-navy md:text-[48px]">{t('landing.show3Title')}</h2>
              <p className="text-[19px] leading-9 text-on-surface-variant">{t('landing.show3Desc')}</p>
            </div>
          </div>
        </section>

        <section className="bg-surface-container-lowest">
          <div className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop md:py-24">
            <h2 className="landing-display mb-10 text-center text-[32px] text-deep-navy md:text-[48px]">{t('landing.allTitle')}</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
              {everything.map((s) => (
                <div
                  key={s.title}
                  className="flex flex-col items-center gap-2 rounded-[24px] bg-background p-6 text-center shadow-[0_8px_30px_rgba(30,75,122,0.06)]"
                >
                  <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-soft-mint/50 text-primary">
                    <span className="material-symbols-outlined">{s.icon}</span>
                  </div>
                  <div className="font-title-md text-[18px] text-on-surface">{s.title}</div>
                  <div className="text-[16px] leading-6 text-on-surface-variant">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#12263d]">
          <div className="mx-auto max-w-container-max px-margin-mobile py-16 text-center md:px-margin-desktop md:py-20">
            <p className="mb-3 font-label-md text-[16px] tracking-wide text-soft-mint">{t('landing.placeEyebrow')}</p>
            <h2 className="landing-display mx-auto mb-4 max-w-3xl text-[30px] text-white md:text-[44px]">{t('landing.placeTitle')}</h2>
            <p className="mx-auto max-w-2xl text-[19px] leading-9 text-white/80">{t('landing.placeDesc')}</p>
          </div>
        </section>

        <section>
          <div className="mx-auto grid max-w-container-max items-center gap-12 px-margin-mobile py-16 md:grid-cols-2 md:px-margin-desktop md:py-20">
            <div>
              <div className="mb-2 font-label-md text-[16px] tracking-wide text-primary">{t('landing.feature4Eyebrow')}</div>
              <h2 className="landing-display mb-4 text-[32px] text-deep-navy md:text-[48px]">{t('landing.feature4Title')}</h2>
              <p className="mb-8 text-[19px] leading-9 text-on-surface-variant">{t('landing.feature4Desc')}</p>
              <div className="flex flex-col gap-2 rounded-[20px] bg-background p-4 sm:flex-row sm:items-center">
                <div className="min-w-[7.5rem] font-label-md text-[16px] text-on-surface-variant">{t('landing.feature4DoneIf')}</div>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <span className="rounded-full bg-secondary-container px-3 py-1.5 font-label-md text-[16px] text-on-secondary-container">
                    + {t('landing.feature4DoneBtn')}
                  </span>
                  <span className="text-outline">→</span>
                  <span className="inline-flex items-center gap-1 font-label-md text-[16px] text-secondary">
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    {t('landing.feature4DoneThen')}
                  </span>
                </div>
              </div>
              <p className="mt-5 text-[16px] leading-7 text-outline">{t('landing.feature4Hint')}</p>
            </div>
            <div className="overflow-hidden rounded-[28px] shadow-[0_16px_48px_rgba(30,75,122,0.12)]">
              <img src="/covers/landing-feature-homework.jpg" alt="" className="aspect-[4/3] w-full object-cover" />
            </div>
          </div>
        </section>

        <section className="bg-surface-container-lowest">
          <div className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop">
            <p className="mb-3 font-label-md text-[16px] tracking-wide text-primary">{t('landing.compareEyebrow')}</p>
            <h2 className="landing-display mb-10 text-[32px] text-deep-navy md:text-[48px]">{t('landing.compareTitle')}</h2>
            <div className="overflow-x-auto rounded-[24px] bg-background">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="font-label-md text-[16px] text-on-surface-variant">
                    <th className="px-5 py-4 font-medium" />
                    <th className="px-5 py-4 font-medium">{t('landing.compareOffline')}</th>
                    <th className="px-5 py-4 font-medium text-primary">{t('landing.compareUs')}</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row) => (
                    <tr key={row[0]} className="border-t border-surface-container">
                      <td className="px-5 py-4 font-label-md text-[17px] text-on-surface">{row[0]}</td>
                      <td className="px-5 py-4 text-[17px] text-on-surface-variant">{row[1]}</td>
                      <td className="px-5 py-4 text-[17px] font-medium text-on-surface">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop">
          <p className="mb-3 font-label-md text-[16px] tracking-wide text-primary">{t('landing.pricingEyebrow')}</p>
          <h2 className="landing-display mb-4 text-[32px] text-deep-navy md:text-[48px]">{t('landing.pricingTitle')}</h2>
          <p className="mb-10 text-[19px] leading-9 text-on-surface-variant">{t('landing.pricingDesc')}</p>
          <div className="grid gap-6 md:grid-cols-2">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`rounded-[24px] p-8 shadow-[0_8px_30px_rgba(30,75,122,0.06)] ${
                  p.paid ? 'bg-deep-navy text-white' : 'bg-surface-container-lowest text-on-surface'
                }`}
              >
                <div className={`mb-2 font-label-md text-[18px] ${p.paid ? 'text-warm-yellow' : 'text-primary'}`}>{p.name}</div>
                <div className="landing-display mb-1 text-[40px]">{p.price}</div>
                <div className={`mb-6 min-h-[24px] text-[15px] ${p.paid ? 'text-white/70' : 'text-on-surface-variant'}`}>{p.sub}</div>
                <ul className="space-y-3 text-[17px] leading-7">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span aria-hidden className={p.paid ? 'text-warm-yellow' : 'text-primary'}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[15px] leading-7 text-outline">{t('landing.pricingNote')}</p>
        </section>

        <section className="px-margin-mobile pb-20 md:px-margin-desktop">
          <div className="relative mx-auto max-w-container-max overflow-hidden rounded-[32px] px-8 py-16 text-center md:px-14 md:py-20">
            <img src="/covers/landing-cta.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[#10233a]/72" />
            <h2 className="landing-display relative z-10 mb-3 text-[32px] text-white md:text-[48px]">{t('landing.ctaTitle')}</h2>
            <p className="relative z-10 mb-8 text-[19px] leading-8 text-white/84 md:text-[21px]">{t('landing.ctaDesc')}</p>
            <Link
              to="/login"
              className="relative z-10 inline-flex rounded-full bg-warm-yellow px-8 py-4 font-title-md text-[18px] text-deep-navy transition hover:bg-tertiary-fixed-dim"
            >
              {t('landing.startFree')}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-variant/40 py-10 text-center text-[15px] leading-6 text-outline">
        <p className="mb-4">{t('landing.footer')}</p>
        <div className="mb-4 flex items-center justify-center gap-3">
          <Link to="/terms" className="underline hover:text-on-surface-variant">
            {t('landing.termsLink')}
          </Link>
          <Link to="/privacy" className="underline hover:text-on-surface-variant">
            {t('landing.privacyLink')}
          </Link>
          <Link to="/refund-policy" className="underline hover:text-on-surface-variant">
            {t('landing.refundLink')}
          </Link>
        </div>
        <div className="mx-auto max-w-md space-y-1">
          <p className="font-label-md text-[16px] text-on-surface-variant">{t('landing.bizName')}</p>
          <p>{t('landing.bizOwner')}</p>
          <p>{t('landing.bizNumber')}</p>
          <p>{t('landing.bizMailOrder')}</p>
          <p>{t('landing.bizAddress')}</p>
          <p>{t('landing.bizContact')}</p>
          <p className="pt-2">{t('landing.bizCopyright')}</p>
        </div>
      </footer>
    </div>
  );
}
