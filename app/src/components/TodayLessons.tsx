import { useEffect, useState } from 'react';
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

function EntryCard({ icon, tone, title, desc, onClick }: { icon: string; tone: string; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[132px] flex-col items-start gap-1 rounded-[24px] border border-outline-variant/40 bg-surface-container-lowest p-5 text-left shadow-card transition hover:-translate-y-0.5"
    >
      <span className={`mb-1 flex h-12 w-12 items-center justify-center rounded-full ${tone}`}>
        <span className="material-symbols-outlined text-[28px]" aria-hidden>
          {icon}
        </span>
      </span>
      <span className="font-title-md text-title-md text-on-surface">{title}</span>
      <span className="text-[14px] leading-5 text-on-surface-variant">{desc}</span>
    </button>
  );
}

/** 오늘 화면의 "큰 진입 카드 3개 + 오늘 수업" — 반에 요일·시간을 적어 두면 오늘 수업이 시간순 카드로 뜬다. */
export default function TodayLessons({ academyId }: { academyId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const groupOpen = useFeature('group');
  const [cards, setCards] = useState<Card[] | null>(null);
  const [hasSchedule, setHasSchedule] = useState(true);

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

  const entries = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {groupOpen && (
        <EntryCard
          icon="play_arrow"
          tone="bg-tag-today text-tag-today-ink"
          title={t('todayEntry.start')}
          desc={next ? `${next.cls.schedule ? `${shortTime(next.cls.schedule.time)} ` : ''}${next.cls.name} · ${next.lesson?.name ?? ''}` : t('todayEntry.startNone')}
          onClick={() => (next ? startLesson(next) : navigate('/curriculum'))}
        />
      )}
      {groupOpen && (
        <EntryCard
          icon="add"
          tone="bg-tag-lesson text-tag-lesson-ink"
          title={t('todayEntry.create')}
          desc={t('todayEntry.createDesc')}
          onClick={() => navigate('/curriculum', { state: { openQuick: true } })}
        />
      )}
      <EntryCard icon="print" tone="bg-tag-library text-tag-library-ink" title={t('todayEntry.print')} desc={t('todayEntry.printDesc')} onClick={() => navigate('/materials')} />
    </div>
  );

  if (cards === null) return entries;

  const dateLabel = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', weekday: 'short' });

  return (
    <div className="space-y-gutter">
      {entries}
      <section className="rounded-[24px] border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-card sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold text-deep-navy">{t('todayLessons.title', { count: cards.length })}</h2>
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
              <li key={c.cls.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-outline-variant/60 p-4">
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
    </div>
  );
}
