import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

/**
 * 코치마크(2026-10-16) — 처음 들어온 화면에서 두 줄 안내를 한 번만 보여 준다. "알겠어요"를 누르면 이 브라우저에서
 * 다시 안 뜬다. 새 안내 = `TIPS`에 한 줄 + `coach.<id>Title/Body` 번역.
 */
const TIPS: Record<string, string> = {
  '/dashboard': 'menuMoved',
  '/wordlists': 'wordlists',
  '/curriculum': 'curriculum',
  '/games': 'games',
  '/board': 'board',
  '/dictionary': 'dictionary',
  '/attendance': 'attendance',
};

const KEY = (id: string) => `classbank.coach.${id}`;

function seen(id: string): boolean {
  try {
    return localStorage.getItem(KEY(id)) === '1';
  } catch {
    return false;
  }
}

export default function CoachTip() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const id = TIPS[pathname.replace(/\/$/, '')] ?? null;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
  }, [id]);

  if (!id || hidden || seen(id)) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY(id as string), '1');
    } catch {
      /* 저장 못 해도 이번 화면에서는 닫는다 */
    }
    setHidden(true);
  }

  return (
    <div className="no-print mb-4 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-fixed/20 px-4 py-3">
      <span className="material-symbols-outlined mt-0.5 text-primary" aria-hidden>
        lightbulb
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-label-md text-label-md font-bold text-deep-navy">{t(`coach.${id}Title`)}</div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{t(`coach.${id}Body`)}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-full bg-primary px-3 py-1.5 font-label-md text-label-md text-on-primary"
      >
        {t('coach.gotIt')}
      </button>
    </div>
  );
}
