import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPhone } from '../lib/studentPortal';

export default function SavedPhone({ label, last4, canReveal, reveal }: {
  label: string; last4: string; canReveal: boolean; reveal: () => Promise<string | null>;
}) {
  const { t } = useTranslation();
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function toggle() {
    if (number) { setNumber(''); return; }
    setBusy(true);
    setFailed(false);
    try {
      const value = await reveal();
      if (!value) throw new Error();
      setNumber(formatPhone(value));
    } catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return <div className="space-y-1">
    <div className="text-sm font-bold">{label}</div>
    <div className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3">
      <span className="flex-1 py-2 font-mono">{number || ('***-****-' + last4)}</span>
      {canReveal && <button type="button" className="grid h-11 w-11 place-items-center rounded-lg text-primary"
        disabled={busy} aria-pressed={!!number} aria-label={t(number ? 'parentPortal.hideSavedPhone' : 'parentPortal.showSavedPhone', { label })}
        onClick={() => void toggle()}>
        <span className="material-symbols-outlined" aria-hidden="true">{number ? 'visibility_off' : 'visibility'}</span>
      </button>}
    </div>
    {failed && <p role="alert" className="text-sm text-error">{t('parentPortal.phoneLoadFailed')}</p>}
  </div>;
}
