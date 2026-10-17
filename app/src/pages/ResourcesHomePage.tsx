import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFeature } from '../lib/features';
import { isPathBlockedForFree } from '../lib/planLimits';

/**
 * 자료 홈(2026-10-17, 시안 04_resources_selected) — 기존 자료 화면(게임·활동지·단어장·사전·파닉스·문법·영상)으로 가는 통합 입구.
 * 기존 /games · /materials 목록은 그대로 있고, 이 화면은 길만 안내한다(새 기능·검색·즐겨찾기는 없다).
 */
/** 번역 문구의 줄바꿈 표시를 공백으로 바꿔 폭에 맞게 흐르게 한다 */
const oneLine = (s: string) => s.split(String.fromCharCode(10)).join(' ');

export default function ResourcesHomePage() {
  const { t } = useTranslation();
  const { hasFullAccess } = useAuth();
  const groupOpen = useFeature('group');
  const locked = (to: string) => !hasFullAccess && isPathBlockedForFree(to);

  const lock = (to: string) =>
    locked(to) ? (
      <span className="material-symbols-outlined shrink-0 text-[18px] text-on-surface-variant" title={t('nav.premiumPageBadge')}>
        lock
      </span>
    ) : null;

  const find = [
    { to: '/dictionary', icon: 'image', tone: 'bg-[#ffe1ea] text-[#e5567c]', key: 'dictionary' },
    { to: '/phonics', icon: 'headphones', tone: 'bg-[#d9f5e8] text-[#1f9d63]', key: 'phonics' },
    { to: '/grammar', icon: 'description', tone: 'bg-[#e6e1ff] text-[#5b57e8]', key: 'grammar' },
    ...(groupOpen ? [{ to: '/videos', icon: 'play_arrow', tone: 'bg-[#dcecff] text-primary', key: 'videos' }] : []),
  ];

  const prints: { cat: string; icon: string; tone: string; links: { to: string; key: string }[] }[] = [
    { cat: 'words', icon: 'menu_book', tone: 'bg-[#e6f1ff] text-primary', links: [{ to: '/materials/flashcards', key: 'flashcards' }, { to: '/materials/worksheet', key: 'worksheet' }] },
    { cat: 'phonics', icon: 'headphones', tone: 'bg-[#d9f5e8] text-[#1f9d63]', links: [{ to: '/materials/cvc-workbook', key: 'cvc' }, { to: '/materials/phonics', key: 'phonicsSheet' }] },
    { cat: 'cards', icon: 'sports_esports', tone: 'bg-[#e6e1ff] text-[#5b57e8]', links: [{ to: '/materials/bingo', key: 'bingo' }, { to: '/materials/memory-cards', key: 'wordCards' }] },
    {
      cat: 'roleplay',
      icon: 'groups',
      tone: 'bg-[#e6f1ff] text-primary',
      links: [
        { to: '/materials/airport', key: 'airport' },
        { to: '/materials/restaurant', key: 'restaurant' },
        { to: '/materials/icecream', key: 'icecream' },
        { to: '/materials/doctor', key: 'doctor' },
      ],
    },
  ];

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display-lg text-[clamp(1.9rem,3.4vw,2.6rem)] font-black leading-tight tracking-[-0.02em] text-deep-navy">{t('resourcesHome.title')}</h1>
        <p className="mt-1 font-body-lg text-[clamp(1rem,1.4vw,1.2rem)] text-on-surface-variant">{t('resourcesHome.subtitle')}</p>
      </div>

      {/* 단어장 → 게임·활동지 안내 배너 */}
      <section className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-[22px] bg-[#e6f1ff] px-6 py-6 sm:px-8">
        <div className="relative z-10 min-w-[16rem] flex-1">
          <h2 className="font-display-lg text-[clamp(1.4rem,2.6vw,2.1rem)] font-black leading-tight text-deep-navy [word-break:keep-all]">{t('resourcesHome.bannerTitle')}</h2>
          <p className="mt-1.5 font-body-md text-[16px] text-on-surface-variant [word-break:keep-all]">{t('resourcesHome.bannerDesc')}</p>
        </div>
        <div className="relative z-10 flex items-end gap-1" aria-hidden>
          <img src="/ui2/m-paper.webp" alt="" width={760} height={667} loading="lazy" draggable={false} className="h-24 w-auto select-none sm:h-32" />
          <img src="/ui2/m-printer.webp" alt="" width={688} height={616} loading="lazy" draggable={false} className="h-20 w-auto select-none sm:h-28" />
        </div>
        <Link
          to="/wordlists"
          className="relative z-10 flex items-center gap-1 rounded-full bg-white px-6 py-3.5 font-title-md text-[17px] font-extrabold text-deep-navy shadow-sm transition hover:-translate-y-0.5"
        >
          {t('resourcesHome.openWordLists')}
          <span className="material-symbols-outlined text-[22px]" aria-hidden>chevron_right</span>
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="font-display-lg text-[clamp(1.25rem,2vw,1.6rem)] font-black text-deep-navy">{t('resourcesHome.useNow')}</h2>
        <div className="grid grid-cols-1 gap-4 min-[1260px]:grid-cols-3">
          <Link to="/games" className="flex min-h-[160px] items-stretch gap-3 min-[1260px]:min-h-[210px] overflow-hidden rounded-[22px] bg-gradient-to-br from-[#0b6bff] to-[#0a54e6] p-6 text-white shadow-card transition hover:-translate-y-0.5">
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-1 whitespace-nowrap font-display-lg text-[clamp(1.35rem,2vw,1.8rem)] font-black [word-break:keep-all]">
                {t('resourcesHome.games')}
                <span className="material-symbols-outlined text-[26px]" aria-hidden>chevron_right</span>
              </h3>
              <p className="mt-2 font-body-md text-[15px] text-white/90 [text-wrap:balance] [word-break:keep-all]">{oneLine(t('resourcesHome.gamesDesc'))}</p>
            </div>
            <img src="/covers/game-wheel.jpg" alt="" aria-hidden loading="lazy" draggable={false} className="pointer-events-none h-36 w-36 shrink-0 select-none self-end rounded-[18px] object-cover shadow-lg" />
          </Link>
          <Link to="/materials" className="flex min-h-[160px] items-stretch gap-3 min-[1260px]:min-h-[210px] overflow-hidden rounded-[22px] bg-[#fff4c2] p-6 shadow-card transition hover:-translate-y-0.5">
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-1 whitespace-nowrap font-display-lg text-[clamp(1.25rem,1.9vw,1.7rem)] font-black text-deep-navy [word-break:keep-all]">
                {t('resourcesHome.sheets')}
                <span className="material-symbols-outlined text-[26px]" aria-hidden>chevron_right</span>
              </h3>
              <p className="mt-2 font-body-md text-[15px] text-deep-navy/75 [text-wrap:balance] [word-break:keep-all]">{oneLine(t('resourcesHome.sheetsDesc'))}</p>
              {lock('/materials')}
            </div>
            <img src="/ui2/m-printer.webp" alt="" aria-hidden loading="lazy" width={688} height={616} draggable={false} className="pointer-events-none h-36 w-auto shrink-0 select-none self-end" />
          </Link>
          <Link to="/wordlists" className="flex min-h-[160px] items-stretch gap-3 min-[1260px]:min-h-[210px] overflow-hidden rounded-[22px] bg-[#e6f1ff] p-6 shadow-card transition hover:-translate-y-0.5">
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-1 whitespace-nowrap font-display-lg text-[clamp(1.35rem,2vw,1.8rem)] font-black text-deep-navy [word-break:keep-all]">
                {t('resourcesHome.lists')}
                <span className="material-symbols-outlined text-[26px]" aria-hidden>chevron_right</span>
              </h3>
              <p className="mt-2 font-body-md text-[15px] text-deep-navy/75 [text-wrap:balance] [word-break:keep-all]">{oneLine(t('resourcesHome.listsDesc'))}</p>
            </div>
            <div aria-hidden className="w-36 shrink-0 space-y-1 self-center rounded-[14px] bg-white p-2.5 shadow-card">
              {[
                { img: '/landing2/w-apple.webp', w: 'apple' },
                { img: '/landing2/w-dog.webp', w: 'dog' },
                { img: '/landing2/w-banana.webp', w: 'banana' },
              ].map((r) => (
                <div key={r.w} className="flex items-center gap-2 border-b border-outline-variant/60 pb-1 last:border-0 last:pb-0">
                  <img src={r.img} alt="" width={28} height={28} loading="lazy" className="h-7 w-7 object-contain" />
                  <span className="flex-1 font-body-md text-[14px] font-semibold text-deep-navy">{r.w}</span>
                  <span className="material-symbols-outlined text-[18px] text-primary/60">volume_up</span>
                </div>
              ))}
            </div>
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display-lg text-[clamp(1.25rem,2vw,1.6rem)] font-black text-deep-navy">{t('resourcesHome.findTitle')}</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
          {find.map((f) => (
            <Link key={f.to} to={f.to} className="flex items-center gap-4 rounded-[20px] border border-outline-variant bg-white p-5 shadow-card transition hover:-translate-y-0.5">
              <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[16px] ${f.tone}`}>
                <span className="material-symbols-outlined text-[36px]" aria-hidden style={{ fontVariationSettings: "'FILL' 1" }}>{f.icon}</span>
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 whitespace-nowrap font-title-md text-[19px] font-extrabold text-deep-navy">
                  {t(`resourcesHome.${f.key}`)}
                  <span className="material-symbols-outlined text-[22px]" aria-hidden>chevron_right</span>
                  {lock(f.to)}
                </span>
                <span className="mt-0.5 block font-body-md text-[14px] text-on-surface-variant [text-wrap:balance] [word-break:keep-all]">{oneLine(t(`resourcesHome.${f.key}Desc`))}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-[20px] border border-outline-variant bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display-lg text-[clamp(1.2rem,1.8vw,1.5rem)] font-black text-deep-navy">{t('resourcesHome.printTitle')}</h2>
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-outline-variant">
          {prints.map((p) => (
            <div key={p.cat} className="xl:px-5 xl:first:pl-0">
              <div className="flex items-center gap-2.5">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full ${p.tone}`}>
                  <span className="material-symbols-outlined text-[20px]" aria-hidden style={{ fontVariationSettings: "'FILL' 1" }}>{p.icon}</span>
                </span>
                <span className="font-label-md text-[16px] font-extrabold text-deep-navy">{t(`resourcesHome.cat_${p.cat}`)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.links.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="flex min-h-10 items-center gap-1 rounded-[10px] bg-[#eef4fd] px-3.5 font-label-md text-[14px] font-semibold text-deep-navy transition-colors hover:bg-primary-fixed"
                  >
                    {t(`resourcesHome.link_${l.key}`)}
                    <span className="material-symbols-outlined text-[18px]" aria-hidden>chevron_right</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
