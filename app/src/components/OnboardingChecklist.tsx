import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/**
 * 대시보드 "처음 시작하기" 체크리스트(2026-09-26) — 사용설명서 1단계.
 * 우리 서비스의 핵심("단어장 하나 → 게임·수업")을 처음 10분 안에 직접 해 보게 5단계를 보여주고,
 * 실제 데이터로 자동 체크한다(반·단어장·게임 내용·수업이 있는지, 발표를 한 번 해 봤는지).
 * 다 하면 사라지고, "숨기기"로 언제든 접을 수 있다(학원별로 이 브라우저에 기억).
 */
export const ONBOARDING_PRESENTED_KEY = 'classbank.onboarding.presented';

type StepId = 'class' | 'wordlist' | 'game' | 'lesson' | 'present';
const STEPS: { id: StepId; icon: string; to: string }[] = [
  { id: 'class', icon: 'groups', to: '/attendance' },
  { id: 'wordlist', icon: 'library_books', to: '/wordlists' },
  { id: 'game', icon: 'sports_esports', to: '/games' },
  { id: 'lesson', icon: 'auto_stories', to: '/curriculum' },
  { id: 'present', icon: 'slideshow', to: '/curriculum' },
];

async function countOf(table: string, academyId: string): Promise<number> {
  const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('academy_id', academyId);
  return count ?? 0;
}

export default function OnboardingChecklist({ academyId }: { academyId: string }) {
  const { t } = useTranslation();
  const hideKey = `classbank.onboarding.hidden.${academyId}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(hideKey) === '1';
    } catch {
      return false;
    }
  });
  const [done, setDone] = useState<Record<StepId, boolean> | null>(null);

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    void (async () => {
      const [classes, lists, games, lessons] = await Promise.all([
        countOf('classes', academyId),
        countOf('word_lists', academyId),
        countOf('game_templates', academyId),
        countOf('curriculum_lessons', academyId),
      ]).catch(() => [0, 0, 0, 0]);
      let presented = false;
      try {
        presented = localStorage.getItem(ONBOARDING_PRESENTED_KEY) === '1';
      } catch {
        /* 무시 */
      }
      if (!cancelled) setDone({ class: classes > 0, wordlist: lists > 0, game: games > 0, lesson: lessons > 0, present: presented });
    })();
    return () => {
      cancelled = true;
    };
  }, [academyId, hidden]);

  if (hidden || !done) return null;
  const doneCount = STEPS.filter((s) => done[s.id]).length;
  if (doneCount === STEPS.length) return null;
  const nextStep = STEPS.find((s) => !done[s.id]);

  function hide() {
    try {
      localStorage.setItem(hideKey, '1');
    } catch {
      /* 무시 */
    }
    setHidden(true);
  }

  return (
    <section className="rounded-2xl border-2 border-primary/25 bg-surface-container-lowest p-5 shadow-sm sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="material-symbols-outlined text-[24px] text-primary">flag</span>
        <h2 className="text-xl font-bold text-deep-navy">{t('startChecklist.title')}</h2>
        <span className="rounded-full bg-primary-fixed px-2.5 py-0.5 font-label-md text-label-md text-primary">
          {doneCount} / {STEPS.length}
        </span>
        <button type="button" onClick={hide} className="ml-auto font-label-md text-label-md text-on-surface-variant hover:text-primary">
          {t('startChecklist.hide')}
        </button>
      </div>
      <p className="mb-4 font-body-md text-body-md text-on-surface-variant">{t('startChecklist.subtitle')}</p>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-container">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((step, i) => {
          const ok = done[step.id];
          const isNext = step.id === nextStep?.id;
          return (
            <li key={step.id}>
              <Link
                to={step.to}
                className={`flex h-full flex-col gap-1.5 rounded-xl border-2 p-3 transition-colors ${
                  ok
                    ? 'border-secondary/40 bg-secondary-container/30'
                    : isNext
                      ? 'border-primary bg-primary-fixed/40 hover:bg-primary-fixed'
                      : 'border-outline-variant/50 hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-label-md text-label-md ${
                      ok ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {ok ? <span className="material-symbols-outlined text-[18px]">check</span> : i + 1}
                  </span>
                  <span className="material-symbols-outlined text-[20px] text-primary">{step.icon}</span>
                </div>
                <div className={`font-label-md text-label-md ${ok ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
                  {t(`startChecklist.step_${step.id}`)}
                </div>
                <div className="font-caption text-caption text-on-surface-variant">{t(`startChecklist.step_${step.id}_hint`)}</div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
