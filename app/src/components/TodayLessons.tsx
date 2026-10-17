import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { fetchClasses, fetchCurriculumLessons } from '../lib/api';
import { classesToday, shortTime } from '../lib/classSchedule';
import { useFeature } from '../lib/features';
import type { ClassRow, CurriculumLesson } from '../lib/types';

interface Card {
  cls: ClassRow;
  lesson: CurriculumLesson | null;
}

/** 오늘 화면 통계 띠에 들어가는 실제 값(대시보드가 계산해 넘긴다) */
export interface TodayStats {
  studentCount: number;
  presentCount: number;
  pointsText: string;
  rewardedCount: number;
}

const ARROW = (
  <span className="material-symbols-outlined shrink-0 text-[28px]" aria-hidden>
    chevron_right
  </span>
);

function StatItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-1 sm:px-6">
      <span className="material-symbols-outlined shrink-0 text-[36px] text-[#7fb2ff]" aria-hidden style={{ fontVariationSettings: "'FILL' 1" }}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="font-caption text-[13px] text-white/75">{label}</div>
        <div className="truncate font-display-lg text-[22px] font-extrabold leading-tight text-white">{value}</div>
      </div>
    </div>
  );
}

function QuickTile({ to, icon, label, tone }: { to: string; icon: string; label: string; tone: string }) {
  return (
    <Link
      to={to}
      className={`flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-[14px] px-2 py-3 text-center transition hover:-translate-y-0.5 hover:shadow-card ${tone}`}
    >
      <span className="material-symbols-outlined text-[30px]" aria-hidden style={{ fontVariationSettings: "'FILL' 1" }}>
        {icon}
      </span>
      <span className="font-label-md text-[15px] font-bold text-deep-navy">{label}</span>
    </Link>
  );
}

/**
 * 오늘 화면의 핵심 영역(시안 02_dashboard_launcher_selected): 큰 파란 "수업 시작" · 노란 "수업 만들기" · 연파랑 "활동지 인쇄" →
 * 네이비 통계 띠 → 빠른 실행·샘플 체험 → 오늘 수업 목록. 반에 요일·시간을 적어 두면 오늘 수업이 시간순 카드로 뜬다.
 */
export default function TodayLessons({ academyId, stats, heading }: { academyId: string; stats: TodayStats; heading?: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const groupOpen = useFeature('group');
  const [cards, setCards] = useState<Card[] | null>(null);
  const [hasSchedule, setHasSchedule] = useState(true);
  const [sampleHidden, setSampleHidden] = useState(() => {
    try {
      return localStorage.getItem('classbank.sampleBanner.hide') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const classes = await fetchClasses(academyId);
        setHasSchedule(classes.some((c) => c.schedule?.days?.length));
        const today = classesToday(classes);
        const out = await Promise.all(
          today.map(async (cls) => {
            const lessons = await fetchCurriculumLessons(academyId, cls.id).catch(() => []);
            const latest = [...lessons].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;
            return { cls, lesson: latest };
          }),
        );
        if (alive) setCards(out);
      } catch {
        if (alive) setCards([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [academyId]);

  const startLesson = (c: Card) => navigate('/curriculum', { state: { focusClassId: c.cls.id, startLessonId: c.lesson?.id } });

  // 다음 수업: 지금 이후에 시작하는 첫 준비된 수업, 없으면 준비된 첫 수업
  const ready = (cards ?? []).filter((c) => c.lesson);
  const nowHm = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
  const next = ready.find((c) => (c.cls.schedule?.time ?? '') >= nowHm) ?? ready[0] ?? null;
  const nextText = next ? `${next.cls.schedule ? `${shortTime(next.cls.schedule.time)} ` : ''}${next.cls.name} · ${next.lesson?.name ?? ''}` : '';

  const hero = (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.18fr_1fr] lg:grid-rows-2">
      {groupOpen && (
        <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0b6bff] to-[#0a54e6] p-6 text-white shadow-card sm:p-8 lg:row-span-2 lg:min-h-[420px]">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
          <div aria-hidden className="pointer-events-none absolute -bottom-28 right-[-4rem] h-72 w-96 rounded-[50%] bg-white/10" />
          <div className="relative z-10 flex h-full flex-col">
            <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-white text-primary shadow-sm">
              <span className="material-symbols-outlined text-[48px]" aria-hidden style={{ fontVariationSettings: "'FILL' 1" }}>
                play_arrow
              </span>
            </span>
            <h2 className="mt-5 font-display-lg text-[clamp(2.2rem,4.4vw,3.4rem)] font-black leading-none tracking-[-0.02em]">{t('dashV2.heroTitle')}</h2>
            <p className="mt-3 font-body-lg text-[clamp(1.05rem,1.5vw,1.3rem)] text-white/90">{t('dashV2.heroDesc')}</p>
            {next && <p className="mt-2 max-w-[22rem] truncate rounded-full bg-white/15 px-3 py-1 font-caption text-[13px] text-white/95">{t('dashV2.heroNext', { what: nextText })}</p>}
            <button
              type="button"
              onClick={() => (next ? startLesson(next) : navigate('/curriculum'))}
              className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-white py-3.5 pl-7 pr-4 font-title-md text-[19px] font-extrabold text-deep-navy shadow-md transition hover:-translate-y-0.5 lg:mt-auto"
            >
              {t('dashV2.heroButton')}
              {ARROW}
            </button>
          </div>
          <img
            src="/ui2/m-hero.webp"
            alt=""
            aria-hidden
            width={760}
            height={580}
            draggable={false}
            className="pointer-events-none absolute -bottom-2 right-0 z-0 w-[48%] max-w-[360px] select-none sm:w-[46%] lg:bottom-3 lg:right-3 lg:w-[56%] lg:max-w-[420px]"
          />
        </section>
      )}
      {groupOpen && (
        <button
          type="button"
          onClick={() => navigate('/curriculum', { state: { openQuick: true } })}
          className="relative flex min-h-[200px] items-center overflow-hidden rounded-[26px] bg-[#fff4c2] p-6 text-left shadow-card transition hover:-translate-y-0.5 sm:p-7"
        >
          <span aria-hidden className="absolute right-5 top-5 z-20 text-deep-navy">
            {ARROW}
          </span>
          <span className="relative z-10 block max-w-[60%]">
            <span className="mb-3 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#ffc531] text-white">
              <span className="material-symbols-outlined text-[38px]" aria-hidden>
                add
              </span>
            </span>
            <span className="block font-display-lg text-[clamp(1.6rem,2.6vw,2.2rem)] font-black leading-tight text-deep-navy">{t('dashV2.createTitle')}</span>
            <span className="mt-1 block font-body-md text-[15px] text-deep-navy/75">{t('dashV2.createDesc')}</span>
          </span>
          <img src="/ui2/m-paper.webp" alt="" aria-hidden width={760} height={667} draggable={false} className="pointer-events-none absolute bottom-0 right-3 w-[40%] max-w-[230px] select-none" />
        </button>
      )}
      <button
        type="button"
        onClick={() => navigate('/materials')}
        className="relative flex min-h-[200px] items-center overflow-hidden rounded-[26px] bg-[#e6f1ff] p-6 text-left shadow-card transition hover:-translate-y-0.5 sm:p-7"
      >
        <span aria-hidden className="absolute right-5 top-5 z-20 text-deep-navy">
          {ARROW}
        </span>
        <span className="relative z-10 block max-w-[60%]">
          <span className="mb-3 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-primary text-white">
            <span className="material-symbols-outlined text-[34px]" aria-hidden style={{ fontVariationSettings: "'FILL' 1" }}>
              print
            </span>
          </span>
          <span className="block font-display-lg text-[clamp(1.6rem,2.6vw,2.2rem)] font-black leading-tight text-deep-navy">{t('dashV2.printTitle')}</span>
          <span className="mt-1 block font-body-md text-[15px] text-deep-navy/75">{t('dashV2.printDesc')}</span>
        </span>
        <img src="/ui2/m-printer.webp" alt="" aria-hidden width={688} height={616} draggable={false} className="pointer-events-none absolute bottom-2 right-3 w-[40%] max-w-[230px] select-none" />
      </button>
    </div>
  );

  const lessonCount = cards?.length ?? 0;
  const statBar = (
    <div className="rounded-[20px] bg-deep-navy px-2 py-5 shadow-card sm:px-4">
      <div className="grid grid-cols-2 gap-y-4 lg:grid-cols-4 lg:divide-x lg:divide-white/20">
        <StatItem icon="calendar_month" label={t('dashV2.statLessons')} value={cards ? t('dashV2.count', { n: lessonCount }) : '–'} />
        <StatItem icon="groups" label={t('dashV2.statAttend')} value={`${stats.presentCount} / ${t('dashV2.people', { n: stats.studentCount })}`} />
        <StatItem icon="star" label={t('dashV2.statPoints')} value={stats.pointsText} />
        <StatItem icon="redeem" label={t('dashV2.statRewarded')} value={t('dashV2.people', { n: stats.rewardedCount })} />
      </div>
    </div>
  );

  // 아직 만든 수업이 하나도 없는 선생님에게는 준비 없이 한 번 써 보는 길을 먼저 보여 준다(외부 평가: 첫 성공까지 할 일이 많다)
  const noLessons = cards !== null && groupOpen && !sampleHidden && (cards.length > 0 ? cards.every((c) => !c.lesson) : !hasSchedule);
  const infoText = cards === null ? '' : lessonCount > 0 ? t('dashV2.lessonsInfo', { n: lessonCount }) : t('dashV2.noLessonInfo');

  const quick = (
    <div className={`grid grid-cols-1 gap-4 ${noLessons ? 'lg:grid-cols-[1.5fr_1fr]' : ''}`}>
      <section className="rounded-[20px] border border-outline-variant bg-white p-5 shadow-card">
        <h2 className="font-title-md text-[18px] font-extrabold text-deep-navy">{t('dashV2.quickTitle')}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickTile to="/games" icon="sports_esports" label={t('dashV2.quickGame')} tone="bg-[#eef3ff] text-[#5b57e8]" />
          <QuickTile to="/attendance" icon="how_to_reg" label={t('dashV2.quickAttend')} tone="bg-[#e8f7ef] text-[#1f9d63]" />
          <QuickTile to="/board" icon="star" label={t('dashV2.quickBoard')} tone="bg-[#fff6dc] text-[#f0a400]" />
          <QuickTile to="/results" icon="description" label={t('dashV2.quickResults')} tone="bg-[#e8f1ff] text-primary" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[12px] bg-[#e8f1ff] px-4 py-3 text-[15px] text-primary">
          <span className="material-symbols-outlined text-[22px]" aria-hidden>
            info
          </span>
          <span className="min-w-0 flex-1">{infoText}</span>
          {cards !== null && (
            <Link to="/settings" className="flex items-center gap-0.5 font-bold text-primary hover:underline">
              {t('dashV2.setSchedule')}
              <span className="material-symbols-outlined text-[20px]" aria-hidden>
                chevron_right
              </span>
            </Link>
          )}
        </div>
      </section>
      {noLessons && (
        <section className="relative overflow-hidden rounded-[20px] border border-outline-variant bg-white p-5 shadow-card">
          <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-10 h-44 w-56 rounded-[50%] bg-[#fff1b8]" />
          <button
            type="button"
            onClick={() => {
              setSampleHidden(true);
              try {
                localStorage.setItem('classbank.sampleBanner.hide', '1');
              } catch {
                /* 저장 못 해도 이번 화면에서는 숨는다 */
              }
            }}
            className="absolute right-3 top-3 z-20 rounded-full p-1.5 text-on-surface-variant hover:bg-black/5"
            aria-label={t('common.close')}
          >
            ✕
          </button>
          <div className="relative z-10 flex items-start gap-2">
            <span className="material-symbols-outlined text-[44px] text-[#ffb800]" aria-hidden style={{ fontVariationSettings: "'FILL' 1" }}>
              bolt
            </span>
            <div className="pr-6">
              <h2 className="font-title-md text-[19px] font-extrabold text-deep-navy">{t('dashV2.sampleTitle')}</h2>
              <p className="mt-1 max-w-[16rem] font-body-md text-[14px] text-on-surface-variant">{t('dashV2.sampleDesc')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/curriculum', { state: { createSample: true } })}
            className="relative z-10 mt-4 inline-flex items-center gap-1 rounded-[12px] bg-primary px-6 py-3 font-title-md text-[17px] font-extrabold text-white shadow-md transition hover:bg-primary-container"
          >
            {t('dashV2.sampleButton')}
            <span className="material-symbols-outlined text-[22px]" aria-hidden>
              chevron_right
            </span>
          </button>
          <img src="/ui2/m-wave.webp" alt="" aria-hidden loading="lazy" width={683} height={626} draggable={false} className="pointer-events-none absolute bottom-2 right-3 z-10 w-[32%] max-w-[130px] select-none" />
        </section>
      )}
    </div>
  );

  const dateLabel = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', weekday: 'short' });

  return (
    <div className="space-y-5">
      {heading}
      {hero}
      {statBar}
      {quick}
      {cards !== null && (
        <section className="rounded-[20px] border border-outline-variant bg-white p-5 shadow-card sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-extrabold text-deep-navy">{t('todayLessons.title', { count: cards.length })}</h2>
            <span className="font-label-md text-label-md text-on-surface-variant">{dateLabel}</span>
          </div>
          {cards.length === 0 ? (
            <p className="mt-3 text-on-surface-variant">
              {hasSchedule ? t('todayLessons.noneToday') : t('todayLessons.noSchedule')}{' '}
              {!hasSchedule && (
                <Link to="/settings" className="font-semibold text-primary underline">
                  {t('todayLessons.setSchedule')}
                </Link>
              )}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {cards.map((c) => (
                <li key={c.cls.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-outline-variant p-4">
                  <span className="w-14 shrink-0 font-title-md text-title-md text-deep-navy">{c.cls.schedule ? shortTime(c.cls.schedule.time) : ''}</span>
                  <div className="min-w-[12rem] flex-1">
                    <div className="font-title-md text-title-md text-on-surface">{c.cls.name}</div>
                    <div className="font-body-md text-body-md text-on-surface-variant">
                      {c.lesson ? `${c.lesson.name}${c.cls.schedule ? ` · ${c.cls.schedule.minutes}${t('todayLessons.min')}` : ''}` : t('todayLessons.noLesson')}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 font-caption text-caption ${
                      c.lesson ? 'bg-secondary-container text-on-secondary-container' : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                    }`}
                  >
                    {c.lesson ? t('todayLessons.ready') : t('todayLessons.needLesson')}
                  </span>
                  <button
                    type="button"
                    onClick={() => startLesson(c)}
                    className={`min-h-12 rounded-full px-5 font-label-md text-label-md ${
                      c.lesson ? 'bg-primary text-on-primary hover:bg-primary-container' : 'border border-primary text-primary hover:bg-primary/10'
                    }`}
                  >
                    {c.lesson ? `▶ ${t('todayLessons.start')}` : t('todayLessons.create')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
