import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { speak } from '../lib/speech';

const SKIP_KEY = 'classbank.startCheck.skip';

export function startCheckSkipped(): boolean {
  try {
    return localStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

/** ▶ 수업 시작 직전 30초 점검: 소리 들려요? · 전체화면 · 폰 리모컨. 시작 버튼 클릭이 그대로 전체화면 허용 클릭이 된다. */
export default function StartCheck({ lessonName, onStart, onClose }: { lessonName: string; onStart: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [skip, setSkip] = useState(false);
  function go() {
    if (skip) {
      try {
        localStorage.setItem(SKIP_KEY, '1');
      } catch {
        /* 기억 못 해도 시작은 된다 */
      }
    }
    onStart();
  }
  return (
    <div role="dialog" aria-modal="true" aria-label={t('startCheck.title')} className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/50 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy">{t('startCheck.title')}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{lessonName}</p>
        <ul className="space-y-3">
          <li className="flex items-center gap-3 rounded-xl border border-outline-variant/60 p-3">
            <span className="material-symbols-outlined text-primary" aria-hidden>volume_up</span>
            <span className="flex-1 font-body-md text-body-md">{t('startCheck.sound')}</span>
            <button type="button" onClick={() => speak('Hello! Can you hear me?')} className="min-h-11 rounded-full border border-primary px-4 font-label-md text-label-md text-primary">
              {t('startCheck.soundTest')}
            </button>
          </li>
          <li className="flex items-center gap-3 rounded-xl border border-outline-variant/60 p-3">
            <span className="material-symbols-outlined text-primary" aria-hidden>fullscreen</span>
            <span className="flex-1 font-body-md text-body-md">{t('startCheck.fullscreen')}</span>
          </li>
          <li className="flex items-center gap-3 rounded-xl border border-outline-variant/60 p-3">
            <span className="material-symbols-outlined text-primary" aria-hidden>smartphone</span>
            <span className="flex-1 font-body-md text-body-md">{t('startCheck.remote')}</span>
          </li>
        </ul>
        <label className="flex min-h-11 items-center gap-2 font-body-md text-body-md text-on-surface-variant">
          <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} className="h-5 w-5 accent-primary" />
          {t('startCheck.skip')}
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={go} className="min-h-12 flex-1 rounded-full bg-primary px-6 font-label-md text-label-md text-on-primary hover:bg-primary-container">
            ▶ {t('startCheck.start')}
          </button>
          <button type="button" onClick={onClose} className="min-h-12 rounded-full border border-outline-variant px-5 font-label-md text-label-md text-on-surface-variant">
            {t('startCheck.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
