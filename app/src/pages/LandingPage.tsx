import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import LanguageToggle from '../components/LanguageToggle';
import GamesDiagram from '../components/landing/GamesDiagram';
import LandingDemo from '../components/landing/LandingDemo';
import WorksheetCollage from '../components/landing/WorksheetCollage';
import { GAME_CATALOG } from '../lib/gameCatalog';

/**
 * 공개 랜딩(2026-10-17) — 외부 디자인 시안(docs/landing-pack)을 따라 다시 만들었다.
 * 제목·설명·버튼·탭·표는 전부 실제 HTML 이고, 이미지는 클레이 일러스트(public/landing2)만 쓴다.
 * 문구는 i18n `landing2.*`(요금·약관·사업자 정보는 기존 `landing.*` 그대로).
 */

/** `**강조**` 표기를 진한 블루 글자로 */
function rich(text: string): ReactNode {
  return text.split('**').map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-extrabold text-[var(--lp-blue)]">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

/** 줄 배열: 데스크톱에서는 줄바꿈, 모바일에서는 자연스럽게 이어 붙인다 */
function Lines({ lines, className = '' }: { lines: string[]; className?: string }) {
  return (
    <>
      {lines.map((l, i) => (
        <span key={i} className={`md:block ${className}`}>
          {rich(l)}
          {i < lines.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  );
}

function CheckCircle({ size = 'md', solid = false }: { size?: 'sm' | 'md'; solid?: boolean }) {
  const box = size === 'md' ? 'h-14 w-14' : 'h-10 w-10';
  const tone = solid ? 'bg-[var(--lp-blue)] text-white' : 'bg-[var(--lp-sky)] text-[var(--lp-blue)]';
  return (
    <span className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full ${tone}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" className={size === 'md' ? 'h-7 w-7' : 'h-5 w-5'} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

const iconTones = ['bg-[#e3eeff]', 'bg-[#fff1bd]', 'bg-[#ebe6ff]', 'bg-[#ffe6d6]', 'bg-[#ebe6ff]', 'bg-[#e3eeff]', 'bg-[#fff1bd]', 'bg-[#ffe6d6]'];
const featureIcons = ['i-lesson', 'i-game', 'i-contest', 'i-print', 'i-book', 'i-video', 'i-online', 'i-class'];
const typeIcons = [
  // 뜻 고르기
  <svg key="a" viewBox="0 0 32 32" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="4" width="20" height="24" rx="4" /><path d="M11 11h10M11 16h10M11 21h6" /></svg>,
  // OX
  <svg key="b" viewBox="0 0 48 32" className="h-9 w-[52px]" fill="none" strokeLinecap="round" aria-hidden="true"><circle cx="13" cy="16" r="11" fill="currentColor" /><circle cx="13" cy="16" r="5" fill="#eaf2ff" /><circle cx="35" cy="16" r="11" fill="currentColor" /><path d="M30.5 11.5l9 9M39.5 11.5l-9 9" stroke="#eaf2ff" strokeWidth="3" /></svg>,
  // 철자 쓰기
  <svg key="c" viewBox="0 0 32 32" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 26l1.5-6L21 6.5a3 3 0 014.5 4L12 24z M18.5 9l4.5 4.5" /></svg>,
  // 스피드 부저
  <svg key="d" viewBox="0 0 32 32" className="h-9 w-9" fill="currentColor" aria-hidden="true"><path d="M18 2L6 18h8l-2 12 14-18h-8z" /></svg>,
];

export default function LandingPage() {
  const { t } = useTranslation();
  const gameCount = GAME_CATALOG.length;
  const list = <T,>(key: string): T => t(key, { returnObjects: true }) as T;

  const heroDesc = list<string[]>('landing2.hero.desc');
  const heroBenefits = list<string[]>('landing2.hero.benefits');
  const painCards = list<{ title: string[]; desc: string; alt: string }[]>('landing2.pain.cards');
  const stepItems = list<{ title: string; desc: string[]; alt: string }[]>('landing2.steps.items');
  const featureCards = list<{ title: string; desc: string[] }[]>('landing2.features.cards');
  const compareRows = list<{ label: string; us: string; old: string }[]>('landing2.compare.rows');
  const contestTypes = list<string[]>('landing2.contest.types');

  const painImages = ['pain1', 'pain2', 'pain3'];
  const painBadge = ['bg-[#dce9ff] text-[#1d63f0]', 'bg-[#ffeeb0] text-[#a5700a]', 'bg-[#e6e0ff] text-[#5b44c9]'];
  const stepImages = ['step1', 'step2', 'step3'];

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

  const focus = 'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-navy)]';
  const primaryBtn = `inline-flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-[var(--lp-blue)] px-9 text-[clamp(19px,2.2vw,24px)] font-extrabold text-white shadow-[0_18px_36px_-14px_rgba(29,99,240,.75)] transition hover:bg-[var(--lp-blue-dark)] ${focus}`;
  const section = 'mx-auto w-full max-w-[1240px] px-5 sm:px-8';

  return (
    <div className="landing antialiased">
      <a href="#main" className="sr-only z-[100] rounded-lg bg-white px-4 py-3 font-bold text-[var(--lp-navy)] focus:not-sr-only focus:absolute focus:left-4 focus:top-4">
        {t('landing2.skip')}
      </a>

      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[84px] w-full max-w-[1920px] items-center justify-between px-5 sm:px-8 lg:px-[4.2%]">
          <Link to="/" className={`flex min-w-0 items-center rounded-lg ${focus}`}>
            <BrandLogo className="h-10 w-auto md:h-12 lg:h-[3.6rem]" />
          </Link>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <LanguageToggle className="hidden bg-white/70 md:inline-flex" />
            <Link to="/login" className={`rounded-lg px-3 py-2 text-[18px] font-semibold text-[var(--lp-navy)] hover:text-[var(--lp-blue)] ${focus}`}>
              {t('landing.login')}
            </Link>
            <Link
              to="/login"
              className={`inline-flex min-h-12 items-center rounded-xl border-2 border-[var(--lp-blue)] bg-white px-4 text-[17px] font-bold text-[var(--lp-blue)] transition hover:bg-[var(--lp-sky)] sm:px-6 sm:text-[18px] ${focus}`}
            >
              {t('landing.startShort')}
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* A. 첫 화면 — 시안(01_hero)의 그림판 위에 글자를 실제 HTML 로 얹는다. 데스크톱은 시안과 같은 비율(cqw)로 배치하고, 좁은 화면은 세로로 쌓는다 */}
        <section className="relative bg-white">
          <div className="relative mx-auto w-full max-w-[1920px] [container-type:inline-size]">
            <div className="relative z-10 px-6 pb-8 pt-8 sm:px-10 lg:absolute lg:inset-0 lg:p-0">
              <span className="inline-flex items-center rounded-full bg-[#e5eeff] px-5 py-2.5 text-[clamp(16px,2.4vw,20px)] font-bold text-[var(--lp-navy)] lg:absolute lg:left-[4.2cqw] lg:top-[5.5cqw] lg:h-[3.6cqw] lg:px-[2.2cqw] lg:py-0 lg:text-[1.5cqw]">
                {t('landing2.hero.tag')}
              </span>
              <h1 className="lp-h mt-5 text-[clamp(46px,11.5vw,84px)] !leading-[1.1] lg:absolute lg:left-[3.9cqw] lg:top-[10.8cqw] lg:mt-0 lg:text-[6.1cqw] lg:!leading-[7.4cqw]">
                <span className="block whitespace-nowrap">{t('landing2.hero.title1')}</span>
                <span className="block whitespace-nowrap">
                  <span className="text-[var(--lp-blue)]">{t('landing2.hero.title2a')}</span>
                  {t('landing2.hero.title2b')}
                </span>
              </h1>
              <p className="lp-p mt-6 max-w-[560px] text-[clamp(19px,3.6vw,25px)] font-medium text-[var(--lp-muted)] lg:absolute lg:left-[4.2cqw] lg:top-[28.7cqw] lg:mt-0 lg:max-w-none lg:text-[1.95cqw] lg:leading-[3.05cqw]">
                <Lines lines={heroDesc} />
              </p>
              <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8 lg:static lg:mt-0">
                <Link
                  to="/login"
                  className={`${primaryBtn} lg:absolute lg:left-[4.2cqw] lg:top-[38.6cqw] lg:h-[6.1cqw] lg:min-h-0 lg:w-[27.2cqw] lg:gap-[1.2cqw] lg:rounded-[0.9cqw] lg:px-0 lg:text-[2cqw]`}
                >
                  {t('landing2.hero.primary')}
                  <Arrow />
                </Link>
                <a
                  href="#try"
                  className={`inline-flex min-h-12 items-center gap-1 rounded-lg text-[clamp(18px,3vw,21px)] font-bold text-[var(--lp-blue)] underline decoration-2 underline-offset-[10px] hover:text-[var(--lp-blue-dark)] lg:absolute lg:left-[34.3cqw] lg:top-[39.6cqw] lg:min-h-0 lg:text-[1.55cqw] ${focus}`}
                >
                  {t('landing2.hero.secondary')}
                  <Arrow />
                </a>
              </div>
            </div>
            {/* 그림판: 노트북·소품·마스코트·활동지. 좁은 화면에서는 오른쪽 그림 부분만 잘라 보여 준다 */}
            <img
              src="/landing2/hero-plate.webp"
              alt=""
              width={1536}
              height={797}
              fetchPriority="high"
              className="block aspect-[4/3] w-full object-cover object-[74%_50%] sm:aspect-[16/9] lg:aspect-auto lg:h-auto lg:object-fill"
            />
            <p className="absolute bottom-[1%] right-3 text-[12px] text-[var(--lp-muted)] lg:right-[2.6cqw] lg:text-[0.85cqw]">{t('landing2.hero.mockNote')}</p>
          </div>
          <div className={`${section} pb-12 pt-4 lg:pb-14`}>
            <ul className="mx-auto grid max-w-[960px] gap-4 sm:grid-cols-3">
              {heroBenefits.map((b) => (
                <li key={b} className="flex items-center justify-center gap-4 text-[clamp(18px,2vw,22px)] font-bold text-[var(--lp-navy)] sm:justify-start">
                  <CheckCircle />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* B. 선생님의 어려움 */}
        <section className="bg-[var(--lp-ivory)]">
          <div className={`${section} py-20 md:py-28`}>
            <div className="mx-auto max-w-[900px] text-center">
              <p className="text-[clamp(18px,2vw,24px)] font-extrabold text-[var(--lp-blue)]">{t('landing2.pain.eyebrow')}</p>
              <h2 className="lp-h mt-4 text-[clamp(36px,5.2vw,68px)]">
                <Lines lines={list<string[]>('landing2.pain.title')} />
              </h2>
              <p className="lp-p mt-7 text-[clamp(17px,1.8vw,22px)] text-[var(--lp-muted)]">
                <Lines lines={list<string[]>('landing2.pain.desc')} />
              </p>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {painCards.map((c, i) => (
                <article key={i} className="lp-card relative flex flex-col overflow-hidden">
                  <span className={`absolute left-6 top-6 z-10 flex h-14 w-14 items-center justify-center rounded-full text-[22px] font-black ${painBadge[i]}`}>0{i + 1}</span>
                  <div className="bg-white px-4 pt-6">
                    <img src={`/landing2/${painImages[i]}.webp`} alt={c.alt} loading="lazy" width={960} height={720} className="mx-auto aspect-[4/3] w-full object-contain mix-blend-multiply" />
                  </div>
                  <div className="flex-1 px-7 pb-9 pt-3">
                    <h3 className="lp-h text-[clamp(25px,2.4vw,32px)] !leading-[1.3]">
                      <Lines lines={c.title} />
                    </h3>
                    <p className="lp-p mt-4 text-[clamp(17px,1.5vw,19px)] text-[var(--lp-muted)]">{c.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* C. 3단계 */}
        <section className="bg-[var(--lp-soft)]">
          <div className={`${section} py-20 md:py-28`}>
            <h2 className="lp-h text-center text-[clamp(36px,5.2vw,68px)]">{t('landing2.steps.title')}</h2>
            <ol className="mt-14 grid gap-8 lg:grid-cols-3 lg:gap-10">
              {stepItems.map((s, i) => (
                <li key={i} className="lp-card relative px-6 pb-10 pt-8 text-center">
                  <img src={`/landing2/${stepImages[i]}.webp`} alt={s.alt} loading="lazy" width={960} height={720} className="mx-auto aspect-[4/3] w-full max-w-[420px] object-contain mix-blend-multiply" />
                  <span className="mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#3f7dff] text-[28px] font-black text-white shadow-[0_12px_24px_-10px_rgba(63,125,255,.8)]">{i + 1}</span>
                  <h3 className="lp-h mt-5 text-[clamp(28px,2.8vw,36px)]">{s.title}</h3>
                  <p className="lp-p mx-auto mt-4 max-w-[360px] text-[clamp(17px,1.45vw,19px)] text-[var(--lp-muted)]">
                    <Lines lines={s.desc} />
                  </p>
                  {i < 2 && (
                    <span className="absolute -right-[26px] top-[28%] z-10 hidden h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--lp-blue)] shadow-md lg:flex" aria-hidden="true">
                      <Arrow />
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* D. 실시간 보카 대회 */}
        <section className="bg-white">
          <div className="grid lg:grid-cols-[1.08fr_1fr]">
            <div className="relative min-h-[380px] lg:min-h-[680px]">
              <img src="/landing2/contest.webp" alt={t('landing2.contest.alt')} loading="lazy" width={896} height={1200} className="absolute inset-0 h-full w-full object-cover object-[50%_35%]" />
            </div>
            <div className="flex flex-col justify-center px-6 py-14 sm:px-12 lg:py-20 lg:pl-14 lg:pr-[max(2rem,calc((100vw-1240px)/2))]">
              <p className="text-[clamp(18px,1.9vw,22px)] font-extrabold text-[var(--lp-blue)]">{t('landing2.contest.eyebrow')}</p>
              <h2 className="lp-h mt-4 text-[clamp(38px,4.6vw,64px)]">
                <Lines lines={list<string[]>('landing2.contest.title')} />
              </h2>
              <p className="lp-p mt-7 text-[clamp(18px,1.8vw,22px)] font-medium text-[var(--lp-ink)]">
                <Lines lines={list<string[]>('landing2.contest.p1')} />
              </p>
              <hr className="my-6 border-[var(--lp-sky2)]" />
              <p className="lp-p text-[clamp(18px,1.8vw,22px)] font-medium text-[var(--lp-ink)]">{rich(t('landing2.contest.p2'))}</p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {contestTypes.map((ty, i) => (
                  <li key={ty} className="flex min-h-[72px] items-center gap-4 rounded-2xl bg-[#e8f0ff] px-5 text-[clamp(18px,1.8vw,22px)] font-extrabold text-[var(--lp-navy)]">
                    <span className="flex w-12 shrink-0 justify-center text-[var(--lp-blue)]">{typeIcons[i]}</span>
                    {ty}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* E. 활동지·워크북 */}
        <section className="overflow-hidden bg-white">
          <div className="grid items-stretch lg:grid-cols-[0.9fr_1.1fr]">
            <div className="px-6 py-16 sm:px-8 md:py-24 lg:py-28 lg:pl-[max(2rem,calc((100vw-1240px)/2))] lg:pr-6">
              <p className="text-[clamp(18px,1.9vw,22px)] font-extrabold text-[var(--lp-blue)]">{t('landing2.sheets.eyebrow')}</p>
              <h2 className="lp-h mt-4 text-[clamp(38px,4.8vw,66px)]">
                <Lines lines={list<string[]>('landing2.sheets.title')} />
              </h2>
              <p className="lp-p mt-7 text-[clamp(18px,1.8vw,22px)] font-medium text-[var(--lp-ink)]">
                <Lines lines={list<string[]>('landing2.sheets.p1')} />
              </p>
              <p className="lp-p mt-6 text-[clamp(18px,1.8vw,22px)] font-medium text-[var(--lp-ink)]">
                <Lines lines={list<string[]>('landing2.sheets.p2')} />
              </p>
              <span className="mt-9 inline-flex min-h-16 items-center gap-3 rounded-full bg-[var(--lp-blue)] px-7 text-[clamp(18px,1.9vw,22px)] font-extrabold text-white shadow-[0_16px_30px_-14px_rgba(29,99,240,.7)]">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 9V3h10v6M6 18H4a1 1 0 01-1-1v-6a2 2 0 012-2h14a2 2 0 012 2v6a1 1 0 01-1 1h-2M7 14h10v7H7z" />
                </svg>
                {t('landing2.sheets.badge')}
              </span>
            </div>
            <WorksheetCollage />
          </div>
        </section>

        {/* F. 단어장 재활용과 게임 */}
        <section className="bg-[var(--lp-soft)]">
          <div className={`${section} py-20 md:py-28`}>
            <div className="mx-auto mb-14 max-w-[1000px] text-center">
              <h2 className="lp-h text-[clamp(36px,5vw,66px)]">
                <Lines lines={list<string[]>('landing2.games.title')} />
              </h2>
              <p className="lp-p mt-6 text-[clamp(17px,1.8vw,22px)] text-[var(--lp-muted)]">
                <Lines lines={list<string[]>('landing2.games.desc')} />
              </p>
            </div>
            <GamesDiagram />
          </div>
        </section>

        {/* G. 직접 체험 */}
        <section id="try" className="scroll-mt-24 bg-white">
          <div className={`${section} py-20 md:py-28`}>
            <div className="mx-auto mb-10 max-w-[860px] text-center">
              <p className="text-[clamp(18px,1.9vw,22px)] font-extrabold text-[var(--lp-blue)]">{t('landing2.demo.eyebrow')}</p>
              <h2 className="lp-h mt-3 text-[clamp(36px,4.6vw,62px)]">{t('landing2.demo.title')}</h2>
              <p className="lp-p mt-5 text-[clamp(17px,1.8vw,22px)] text-[var(--lp-muted)]">
                <Lines lines={list<string[]>('landing2.demo.desc')} />
              </p>
            </div>
            <LandingDemo />
          </div>
        </section>

        {/* H. 전체 기능 */}
        <section className="bg-[var(--lp-soft)]">
          <div className={`${section} py-20 md:py-28`}>
            <div className="mx-auto mb-14 max-w-[900px] text-center">
              <h2 className="lp-h text-[clamp(34px,4.6vw,62px)]">
                {t('landing2.features.title')} <span className="text-[var(--lp-blue)]">{t('landing2.features.brand')}</span>
              </h2>
              <p className="lp-p mt-5 text-[clamp(17px,1.8vw,22px)] text-[var(--lp-muted)]">{t('landing2.features.desc')}</p>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featureCards.map((f, i) => (
                <li key={i} className="lp-card flex items-center gap-5 p-5 sm:flex-col sm:gap-0 sm:px-6 sm:pb-9 sm:pt-8 sm:text-center">
                  <span className={`flex h-[84px] w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-full sm:h-[150px] sm:w-[150px] ${iconTones[i]}`}>
                    <img src={`/landing2/${featureIcons[i]}.webp`} alt="" loading="lazy" className="h-[72%] w-[72%] object-contain" />
                  </span>
                  <div className="min-w-0 sm:mt-6">
                    <h3 className="break-keep text-[clamp(20px,1.9vw,25px)] font-black leading-snug text-[var(--lp-navy)]">{t(f.title, { count: gameCount })}</h3>
                    <p className="lp-p mt-2 text-[clamp(16px,1.4vw,18px)] text-[var(--lp-muted)]">
                      <Lines lines={f.desc} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* I. 교실 수업의 가치 */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#0a3a9c] via-[#0a2f84] to-[#0b2872] text-white">
          <div className={`${section} relative z-10 pb-6 pt-20 text-center md:pt-24`}>
            <p className="text-[clamp(18px,1.9vw,22px)] font-extrabold text-[#7fd0ff]">{t('landing2.classroom.eyebrow')}</p>
            <h2 className="lp-h mt-4 !text-white text-[clamp(38px,5.4vw,72px)]">{t('landing2.classroom.title')}</h2>
            <p className="lp-p mx-auto mt-7 max-w-[760px] text-[clamp(17px,1.8vw,22px)] text-white/90">
              <Lines lines={list<string[]>('landing2.classroom.desc')} />
            </p>
          </div>
          <div className="relative">
            <img
              src="/landing2/classroom.webp"
              alt={t('landing2.classroom.alt')}
              loading="lazy"
              width={1376}
              height={768}
              className="block w-full [mask-image:linear-gradient(to_bottom,transparent_0%,#000_22%)]"
            />
          </div>
        </section>

        {/* J. 비교표 */}
        <section className="bg-white">
          <div className={`${section} py-20 md:py-28`}>
            <h2 className="lp-h mx-auto max-w-[900px] text-center text-[clamp(34px,4.6vw,62px)]">
              <span className="md:block">{list<string[]>('landing2.compare.title')[0]} </span>
              <span className="text-[var(--lp-blue)] md:block">{list<string[]>('landing2.compare.title')[1]}</span>
            </h2>

            {/* 데스크톱·태블릿: 표 */}
            <div className="mx-auto mt-14 hidden max-w-[1100px] md:block">
              <table className="w-full border-separate border-spacing-0 overflow-visible rounded-3xl border border-[#e3e8f2] bg-white shadow-[0_22px_54px_-34px_rgba(25,60,140,.35)]">
                <thead>
                  <tr>
                    <th scope="col" className="w-[20%] rounded-tl-3xl bg-[#f0f2f6] px-6 py-7 text-center text-[21px] font-extrabold text-[var(--lp-navy)]">{t('landing2.compare.colItem')}</th>
                    <th scope="col" className="relative w-[42%] bg-[var(--lp-blue)] px-6 py-8 text-center text-[clamp(24px,2.4vw,30px)] font-black text-white [box-shadow:0_-14px_0_0_var(--lp-blue)] rounded-t-2xl">{t('landing2.compare.colUs')}</th>
                    <th scope="col" className="w-[38%] rounded-tr-3xl bg-[#f0f2f6] px-6 py-7 text-center text-[21px] font-extrabold text-[var(--lp-navy)]">{t('landing2.compare.colOld')}</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((r, i) => {
                    const last = i === compareRows.length - 1;
                    return (
                      <tr key={r.label}>
                        <th scope="row" className={`px-8 py-6 text-left text-[clamp(18px,1.8vw,22px)] font-extrabold text-[var(--lp-navy)] ${last ? '' : 'border-b border-[#e8ecf4]'}`}>{r.label}</th>
                        <td className={`bg-[#eaf2ff] px-6 py-6 ${last ? 'rounded-b-2xl' : 'border-b border-[#d3e1fb]'} border-x-2 border-x-[var(--lp-blue)] ${last ? 'border-b-2 border-b-[var(--lp-blue)]' : ''}`}>
                          <span className="flex items-center gap-4 text-[clamp(18px,1.8vw,22px)] font-extrabold text-[var(--lp-navy)]">
                            <CheckCircle size="sm" solid />
                            {r.us}
                          </span>
                        </td>
                        <td className={`px-8 py-6 text-[clamp(17px,1.7vw,21px)] font-normal text-[#6a7590] ${last ? '' : 'border-b border-[#e8ecf4]'}`}>{r.old}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 모바일: 항목별 카드 (클래스뱅크를 먼저) */}
            <div className="mx-auto mt-10 grid max-w-[560px] gap-5 md:hidden">
              {compareRows.map((r) => (
                <div key={r.label} className="overflow-hidden rounded-3xl border border-[#dfe6f3] bg-white shadow-sm">
                  <div className="px-5 pt-5 text-[20px] font-black text-[var(--lp-navy)]">{r.label}</div>
                  <div className="m-3 flex items-start gap-3 rounded-2xl border-2 border-[var(--lp-blue)] bg-[#eaf2ff] p-4">
                    <CheckCircle size="sm" solid />
                    <div>
                      <div className="text-[14px] font-extrabold text-[var(--lp-blue)]">{t('landing2.compare.colUs')}</div>
                      <div className="mt-1 text-[19px] font-extrabold leading-snug text-[var(--lp-navy)]">{r.us}</div>
                    </div>
                  </div>
                  <div className="mx-3 mb-4 rounded-2xl bg-[#f3f5f8] p-4">
                    <div className="text-[14px] font-bold text-[#7b869e]">{t('landing2.compare.colOld')}</div>
                    <div className="mt-1 text-[17px] leading-snug text-[#6a7590]">{r.old}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* K. 요금제 */}
        <section id="pricing" className="bg-[var(--lp-soft)]">
          <div className={`${section} py-20 md:py-28`}>
            <p className="text-center text-[clamp(18px,1.9vw,22px)] font-extrabold text-[var(--lp-blue)]">{t('landing.pricingEyebrow')}</p>
            <h2 className="lp-h mx-auto mt-3 max-w-[900px] text-center text-[clamp(32px,4.2vw,54px)]">{t('landing.pricingTitle')}</h2>
            <p className="lp-p mx-auto mt-5 max-w-[760px] text-center text-[clamp(17px,1.7vw,21px)] text-[var(--lp-muted)]">{t('landing.pricingDesc')}</p>
            <div className="mx-auto mt-12 grid max-w-[980px] gap-6 md:grid-cols-2">
              {plans.map((p) => (
                <div key={p.name} className={`rounded-[32px] p-8 md:p-10 ${p.paid ? 'bg-[var(--lp-navy)] text-white shadow-[0_30px_60px_-30px_rgba(11,31,77,.8)]' : 'lp-card text-[var(--lp-ink)]'}`}>
                  <div className={`text-[20px] font-extrabold ${p.paid ? 'text-[#ffd54f]' : 'text-[var(--lp-blue)]'}`}>{p.name}</div>
                  <div className="lp-h mt-2 !text-inherit text-[clamp(38px,4vw,50px)]" style={{ color: p.paid ? '#fff' : undefined }}>{p.price}</div>
                  <div className={`mb-7 mt-1 min-h-[26px] text-[16px] ${p.paid ? 'text-white/75' : 'text-[var(--lp-muted)]'}`}>{p.sub}</div>
                  <ul className="space-y-3.5 text-[clamp(17px,1.6vw,19px)] leading-7">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-3">
                        <span aria-hidden className={`font-black ${p.paid ? 'text-[#ffd54f]' : 'text-[var(--lp-blue)]'}`}>✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-[900px] text-[15px] leading-7 text-[#6a7590]">{t('landing.pricingNote')}</p>
          </div>
        </section>

        {/* 마무리 체험 버튼 */}
        <section className="bg-[var(--lp-soft)] pb-20 md:pb-28">
          <div className={section}>
            <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-[#e3eeff] via-[#f3f7ff] to-[#eef4ff] px-7 py-14 text-center md:px-16 md:py-20">
              <img src="/landing2/m-trophy.webp" alt="" loading="lazy" className="pointer-events-none absolute bottom-0 left-[3%] hidden w-[150px] drop-shadow-xl lg:block" />
              <img src="/landing2/m-cheer.webp" alt="" loading="lazy" className="pointer-events-none absolute bottom-0 right-[3%] hidden w-[150px] drop-shadow-xl lg:block" />
              <h2 className="lp-h text-[clamp(32px,4.4vw,56px)]">{t('landing.ctaTitle')}</h2>
              <p className="lp-p mx-auto mt-4 max-w-[640px] text-[clamp(17px,1.8vw,21px)] text-[var(--lp-muted)]">{t('landing.ctaDesc')}</p>
              <Link to="/login" className={`${primaryBtn} mt-9`}>
                {t('landing2.hero.primary')}
                <Arrow />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e8ecf4] bg-white py-12 text-center text-[15px] leading-6 text-[#6a7590]">
        <div className="mb-4 flex justify-center">
          <LanguageToggle className="bg-[#f0f2f6]" />
        </div>
        <p className="mb-4">{t('landing.footer')}</p>
        <div className="mb-5 flex items-center justify-center gap-5">
          <Link to="/terms" className="underline hover:text-[var(--lp-navy)]">
            {t('landing.termsLink')}
          </Link>
          <Link to="/privacy" className="underline hover:text-[var(--lp-navy)]">
            {t('landing.privacyLink')}
          </Link>
          <Link to="/refund-policy" className="underline hover:text-[var(--lp-navy)]">
            {t('landing.refundLink')}
          </Link>
        </div>
        <div className="mx-auto max-w-md space-y-1 px-5">
          <p className="text-[16px] font-bold text-[var(--lp-navy)]">{t('landing.bizName')}</p>
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
