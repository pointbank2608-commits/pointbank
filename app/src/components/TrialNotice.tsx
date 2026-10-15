import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { todayKst } from '../lib/trial';

/**
 * 체험 안내(2026-10-16) — 수업 중에는 막지 않는다(AppLayout 의 발표 아닌 화면에서만 그린다).
 *  - 상단 띠: 체험 종료 3일 전부터, 끝난 뒤에도 하루 한 번씩 다시 보임(닫을 수 있음)
 *  - 모달: "하루 첫 방문"에 한 번만 — 종료 하루 전/당일, 종료 후 3일 안. 자동 로그인이라 로그인 시점이 아니라 날짜 기준.
 * 만든 단어장·수업 개수를 보여 줘서 "무엇을 잃는지"를 구체적으로 알린다.
 */
function seen(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function mark(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* 저장 못 해도 이번 화면에서는 닫는다 */
  }
}

function useContentCounts(enabled: boolean) {
  const [counts, setCounts] = useState<{ lists: number; lessons: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void Promise.all([
      supabase.from('word_lists').select('id', { count: 'exact', head: true }),
      supabase.from('curriculum_lessons').select('id', { count: 'exact', head: true }),
    ]).then(([a, b]) => {
      if (alive) setCounts({ lists: a.count ?? 0, lessons: b.count ?? 0 });
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return counts;
}

function useShown() {
  const { isStaff, academy, trial } = useAuth();
  const stage: 'soon' | 'last' | 'ended' | null =
    !isStaff || !academy
      ? null
      : trial.active
        ? (trial.daysLeft ?? 99) <= 1
          ? 'last'
          : (trial.daysLeft ?? 99) <= 3
            ? 'soon'
            : null
        : trial.expired
          ? 'ended'
          : null;
  return stage;
}

export function TrialBanner() {
  const { t } = useTranslation();
  const { trial, profile } = useAuth();
  const stage = useShown();
  const key = `classbank.trialBanner.${todayKst()}`;
  const [hidden, setHidden] = useState(() => seen(key));
  const counts = useContentCounts(stage === 'ended');

  if (!stage || hidden) return null;
  const isOwner = profile?.role === 'owner';
  const title =
    stage === 'ended'
      ? t('trial.bannerEnded')
      : trial.daysLeft === 0
        ? t('trial.bannerToday')
        : t('trial.bannerSoon', { n: trial.daysLeft });
  const body =
    stage === 'ended'
      ? t('trial.bannerEndedBody', { lists: counts?.lists ?? 0, lessons: counts?.lessons ?? 0 })
      : t('trial.bannerSoonBody');

  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-warm-yellow bg-warm-yellow/25 px-4 py-3">
      <span className="material-symbols-outlined text-deep-navy" aria-hidden>
        hourglass_top
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-label-md text-label-md font-bold text-deep-navy">{title}</div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{body}</p>
      </div>
      {isOwner ? (
        <Link to="/settings/billing" className="shrink-0 rounded-full bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary">
          {t('trial.subscribe')}
        </Link>
      ) : (
        <span className="shrink-0 font-caption text-caption text-on-surface-variant">{t('trial.askOwner')}</span>
      )}
      <button
        type="button"
        onClick={() => {
          mark(key);
          setHidden(true);
        }}
        className="shrink-0 rounded-full px-2 py-1 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container"
        aria-label={t('common.close')}
      >
        ✕
      </button>
    </div>
  );
}

export function TrialModal() {
  const { t } = useTranslation();
  const { trial, profile } = useAuth();
  const stage = useShown();
  const eligible = stage === 'last' || (stage === 'ended' && (trial.daysSinceEnd ?? 99) <= 3);
  const key = `classbank.trialModal.${stage}.${todayKst()}`;
  const [open, setOpen] = useState(false);
  const counts = useContentCounts(eligible && open);

  useEffect(() => {
    if (eligible && !seen(key)) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, key]);

  if (!open || !eligible) return null;
  const isOwner = profile?.role === 'owner';
  const close = () => {
    mark(key);
    setOpen(false);
  };

  return (
    <div className="no-print fixed inset-0 z-[80] flex items-center justify-center bg-inverse-surface/50 p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md space-y-4 rounded-2xl bg-surface-container-lowest p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy">
          {stage === 'ended' ? t('trial.modalEndedTitle') : t('trial.modalLastTitle')}
        </h2>
        <ul className="space-y-1.5 font-body-md text-body-md text-on-surface">
          <li>· {t('trial.changeClasses')}</li>
          <li>· {t('trial.changeGames')}</li>
          <li>· {t('trial.changeLists')}</li>
          <li>· {t('trial.changeLocked')}</li>
        </ul>
        {counts && (counts.lists > 0 || counts.lessons > 0) && (
          <p className="rounded-lg bg-surface-container-low px-3 py-2 font-body-sm text-body-sm">
            {t('trial.yourContent', { lists: counts.lists, lessons: counts.lessons })}
          </p>
        )}
        <p className="font-caption text-caption text-on-surface-variant">{t('trial.noDelete')}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} className="rounded-full px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low">
            {t('trial.later')}
          </button>
          {isOwner ? (
            <Link to="/settings/billing" onClick={close} className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary">
              {t('trial.subscribe')}
            </Link>
          ) : (
            <span className="self-center font-caption text-caption text-on-surface-variant">{t('trial.askOwner')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
