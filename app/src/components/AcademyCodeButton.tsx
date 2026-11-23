import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function AcademyCodeButton() {
  const { t } = useTranslation();
  const { academy } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const invite = academy?.invite_code ?? '';

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 복사가 막힌 브라우저면 눈으로 보고 옮겨 적는다 */
    }
  }

  if (!invite) return null;
  const label = t('nav.inviteCodeLabel');
  const inviteRow = (
    <div className="space-y-1">
      <div className="font-caption text-caption text-on-surface-variant">{label}</div>
      <div className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-lg font-bold tracking-[0.2em] text-deep-navy">{invite}</span>
        <button
          type="button"
          onClick={() => void copyInvite()}
          aria-label={t('nav.codeCopy', { label })}
          title={t('nav.codeCopy', { label })}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary"
        >
          <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-4 mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-white/20 bg-white/5 px-4 py-2.5 font-label-md text-[15px] font-semibold text-white/90 transition-colors hover:bg-white/15"
      >
        <span className="material-symbols-outlined">{open ? 'expand_less' : 'key'}</span>
        {open ? t('nav.hideCodes') : t('nav.showCodes')}
      </button>
      {open && (
        <div className="mt-2 space-y-3 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 shadow-sm">
          {inviteRow}
          <p className="font-caption text-caption text-on-surface-variant">{t('nav.codeHint')}</p>
        </div>
      )}
    </div>
  );
}
