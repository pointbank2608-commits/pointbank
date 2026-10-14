import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { fetchClassNotice, setClassNotice } from '../../lib/soloChat';

const MINUTES = [30, 60, 180, 720] as const;

/** 반 전체 공지 보내기(2026-10-14) — 학생 화면 위쪽에 한 줄이 뜬다. 정한 시간이 지나면 저절로 사라지고, 비우고 보내면 바로 내린다. */
export default function ClassNoticePanel({ classId }: { classId: string }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [text, setText] = useState('');
  const [minutes, setMinutes] = useState<number>(180);
  const [current, setCurrent] = useState<{ text: string; until: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let alive = true;
    setText('');
    fetchClassNotice(classId)
      .then((n) => {
        if (!alive) return;
        setUnavailable(false);
        setCurrent(n);
      })
      .catch(() => alive && setUnavailable(true));
    return () => {
      alive = false;
    };
  }, [classId]);

  if (unavailable) return null;

  async function send(clear: boolean) {
    setBusy(true);
    try {
      await setClassNotice(classId, clear ? '' : text, minutes);
      setCurrent(clear || !text.trim() ? null : { text: text.trim(), until: new Date(Date.now() + minutes * 60000).toISOString() });
      if (!clear) setText('');
      notify(t(clear ? 'solo.noticeCleared' : 'solo.noticeSent'));
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg bg-surface-container-low px-3 py-2">
      <div className="flex items-center gap-2 font-label-md text-label-md font-bold text-deep-navy">
        <span className="material-symbols-outlined text-[20px] text-primary">campaign</span>
        {t('solo.noticeTitle')}
      </div>
      {current && (
        <div className="flex items-center gap-2 rounded-lg bg-warm-yellow/30 px-3 py-1.5 text-sm text-deep-navy">
          <span className="min-w-0 flex-1 truncate">📢 {current.text}</span>
          <button type="button" disabled={busy} onClick={() => void send(true)} className="shrink-0 font-label-md text-label-md text-error underline disabled:opacity-50">
            {t('solo.noticeClear')}
          </button>
        </div>
      )}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) void send(false);
        }}
      >
        <input
          value={text}
          maxLength={120}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('solo.noticePlaceholder')}
          className="min-w-[14rem] flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-2 text-sm" aria-label={t('solo.noticeMinutes')}>
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {t('solo.noticeFor', { label: m >= 60 ? t('solo.noticeHours', { n: m / 60 }) : t('solo.noticeMin', { n: m }) })}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy || !text.trim()} className="rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary disabled:opacity-40">
          {t('solo.noticeSend')}
        </button>
      </form>
    </div>
  );
}
