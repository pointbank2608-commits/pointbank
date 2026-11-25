import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { dismissFreeUpgradePrompt, nextFreeUpgradePrompt } from '../lib/api';
import AccessibleDialog from './AccessibleDialog';

export default function FreeUpgradePrompt({ teacherId }: { teacherId: string }) {
  const { t } = useTranslation();
  const { run } = useToast();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [hideToday, setHideToday] = useState(false);
  const sequence = useRef(0);
  useEffect(() => {
    let active = true;
    async function check() {
      const checkId = ++sequence.current;
      try {
        const next = await nextFreeUpgradePrompt(teacherId);
        if (active && checkId === sequence.current) setCycle(next);
      } catch { /* Leave the recommendation pending until the next visit. */ }
    }
    void check();
    window.addEventListener('classbank-free-game-play', check);
    window.addEventListener('focus', check);
    return () => {
      active = false;
      window.removeEventListener('classbank-free-game-play', check);
      window.removeEventListener('focus', check);
    };
  }, [teacherId]);

  async function dismiss(viewPlans: boolean) {
    if (!cycle || busy) return;
    setBusy(true);
    const ok = await run(() => dismissFreeUpgradePrompt(cycle, hideToday));
    setBusy(false);
    if (ok) {
      ++sequence.current;
      setHideToday(false);
      setCycle(null);
      if (viewPlans) navigate('/settings/billing');
    }
  }
  if (!cycle) return null;
  return <AccessibleDialog label={t('freeGames.upgradeTitle')} onClose={() => void dismiss(false)}>
    <div className="max-w-md space-y-4 p-6">
      <h2 className="text-xl font-bold">{t('freeGames.upgradeTitle')}</h2>
      <p>{t('freeGames.upgradeText')}</p>
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" className="h-5 w-5" checked={hideToday} disabled={busy}
          onChange={event => setHideToday(event.target.checked)} />
        {t('freeGames.hideToday')}
      </label>
      <div className="flex flex-wrap gap-3">
        <button className="rounded-lg bg-primary px-4 py-2 text-white" disabled={busy} onClick={() => void dismiss(true)}>{t('freeGames.seePlans')}</button>
        <button className="rounded-lg border px-4 py-2" disabled={busy} onClick={() => void dismiss(false)}>{t('freeGames.later')}</button>
      </div>
    </div>
  </AccessibleDialog>;
}
