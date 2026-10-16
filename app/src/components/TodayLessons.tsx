import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { fetchClasses, fetchCurriculumLessons } from '../lib/api';
import { classesToday, shortTime } from '../lib/classSchedule';
import type { ClassRow, CurriculumLesson } from '../lib/types';

interface Card {
  cls: ClassRow;
  lesson: CurriculumLesson | null;
}

/** 오늘 화면의 "오늘 수업" — 반에 요일·시간을 적어 두면 오늘 수업이 시간순 카드로 뜬다. */
export default function TodayLessons({ academyId }: { academyId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  if (cards === null) return null;

  const dateLabel = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', weekday: 'short' });

  return (
    <section className="rounded-2xl border border-primary/15 bg-surface-container-lowest p-5 shadow-sm sm:p-7">
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
          {cards.map(({ cls, lesson }) => (
            <li key={cls.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant/60 p-4">
              <span className="w-14 shrink-0 font-title-md text-title-md text-deep-navy">{cls.schedule ? shortTime(cls.schedule.time) : ''}</span>
              <div className="min-w-0 flex-1">
                <div className="font-title-md text-title-md text-on-surface">{cls.name}</div>
                <div className="font-body-md text-body-md text-on-surface-variant">
                  {lesson ? `${lesson.name}${cls.schedule ? ` · ${cls.schedule.minutes}${t('todayLessons.min')}` : ''}` : t('todayLessons.noLesson')}
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 font-caption text-caption ${
                  lesson ? 'bg-secondary-container text-on-secondary-container' : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                }`}
              >
                {lesson ? t('todayLessons.ready') : t('todayLessons.needLesson')}
              </span>
              <button
                type="button"
                onClick={() => navigate('/curriculum', { state: { focusClassId: cls.id, startLessonId: lesson?.id } })}
                className={`min-h-12 rounded-full px-5 font-label-md text-label-md ${
                  lesson ? 'bg-primary text-on-primary hover:bg-primary-container' : 'border border-primary text-primary hover:bg-primary/10'
                }`}
              >
                {lesson ? `▶ ${t('todayLessons.start')}` : t('todayLessons.create')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
