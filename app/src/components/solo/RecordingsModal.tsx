import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import {
  createSoloShare,
  fetchSoloRecordingAudio,
  fetchSoloRecordings,
  fetchSoloShares,
  revokeSoloShare,
  type ShareNameMode,
  type SoloLesson,
  type SoloRecordingMeta,
  type SoloShareRow,
  type SoloStatusRow,
} from '../../lib/soloApi';

/**
 * 학생이 따라 부른 녹음을 선생님이 듣고, 마음에 들면 학부모에게 링크로 보낸다.
 * 링크는 무작위 열쇠(/r/열쇠), 기본 30일 뒤 만료, 선생님이 언제든 닫을 수 있다. 학생 이름 표시는 선택(전체/성 빼고/숨김).
 */
export default function RecordingsModal({ lesson, row, onClose }: { lesson: SoloLesson; row: SoloStatusRow; onClose: () => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [records, setRecords] = useState<SoloRecordingMeta[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<SoloShareRow[]>([]);
  const [nameMode, setNameMode] = useState<ShareNameMode>('given');
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([fetchSoloRecordings(row.assignment_id), fetchSoloShares(row.assignment_id)]);
      setRecords(r);
      setShares(s);
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
      setRecords([]);
    }
  }, [row.assignment_id, notify]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 만든 소리 주소는 창을 닫을 때 비운다
  useEffect(
    () => () => {
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function load(id: string) {
    if (urls[id]) return;
    try {
      const url = await fetchSoloRecordingAudio(id);
      setUrls((u) => ({ ...u, [id]: url }));
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  const lineOf = (step: number) => {
    const s = lesson.steps[step];
    return s && s.t === 'lineSing' ? s.en : '';
  };

  const linkOf = (token: string) => `${window.location.origin}/r/${token}`;
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify(t('studentLogin.copied'));
    } catch {
      notify(text);
    }
  }

  async function makeShare() {
    setBusy(true);
    try {
      const token = await createSoloShare(row.assignment_id, nameMode, days);
      await reload();
      await copy(t('solo.shareMessage', { name: row.name, link: linkOf(token) }));
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="my-6 w-full max-w-2xl space-y-4 rounded-2xl bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 font-title-md text-title-md font-bold text-deep-navy">{t('solo.recordingsTitle', { name: row.name })}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {records === null ? (
          <div className="py-8 text-center text-on-surface-variant">{t('common.loading')}</div>
        ) : records.length === 0 ? (
          <p className="rounded-lg bg-surface-container-low px-4 py-6 text-center font-body-md text-on-surface-variant">{t('solo.noRecordings')}</p>
        ) : (
          <>
            <ul className="space-y-3">
              {records.map((r) => (
                <li key={r.id} className="rounded-xl border border-outline-variant/50 p-3">
                  <div className="font-body-md text-body-md text-on-surface">{lineOf(r.step) || t('solo.stepN', { n: r.step + 1 })}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {urls[r.id] ? (
                      <audio src={urls[r.id]} controls autoPlay className="h-10 max-w-full" />
                    ) : (
                      <button type="button" onClick={() => void load(r.id)} className="flex items-center gap-1 rounded-full border border-primary px-3 py-1 font-label-md text-label-md text-primary hover:bg-primary/10">
                        <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                        {t('solo.listen')}
                        {r.seconds ? ` · ${Math.round(Number(r.seconds))}s` : ''}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-3 rounded-xl bg-primary-fixed/25 p-4">
              <div className="font-label-md text-label-md font-bold text-deep-navy">{t('solo.shareTitle')}</div>
              <p className="font-caption text-caption text-on-surface-variant">{t('solo.shareHint')}</p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="space-y-1">
                  <span className="block font-caption text-caption text-on-surface-variant">{t('solo.shareName')}</span>
                  <select value={nameMode} onChange={(e) => setNameMode(e.target.value as ShareNameMode)} className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm">
                    <option value="given">{t('solo.shareNameGiven')}</option>
                    <option value="full">{t('solo.shareNameFull')}</option>
                    <option value="hidden">{t('solo.shareNameHidden')}</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block font-caption text-caption text-on-surface-variant">{t('solo.shareDays')}</span>
                  <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm">
                    {[7, 14, 30, 60, 90].map((d) => (
                      <option key={d} value={d}>
                        {t('solo.shareDaysOption', { n: d })}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" disabled={busy} onClick={() => void makeShare()} className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-50">
                  {t('solo.shareCreate')}
                </button>
              </div>
              {shares.length > 0 && (
                <ul className="space-y-1.5">
                  {shares.map((s) => {
                    const expired = new Date(s.expires_at).getTime() < Date.now();
                    const live = !s.revoked && !expired;
                    return (
                      <li key={s.token} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-container-lowest px-3 py-2">
                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-on-surface-variant">{linkOf(s.token)}</span>
                        <span className={`rounded-full px-2 py-0.5 font-caption text-caption ${live ? 'bg-secondary-container/60 text-on-surface' : 'bg-surface-container text-on-surface-variant'}`}>
                          {s.revoked ? t('solo.shareClosed') : expired ? t('solo.shareExpired') : t('solo.shareUntil', { date: new Date(s.expires_at).toLocaleDateString() })}
                        </span>
                        {live && (
                          <>
                            <button type="button" onClick={() => void copy(t('solo.shareMessage', { name: row.name, link: linkOf(s.token) }))} className="font-caption text-caption text-primary hover:underline">
                              {t('solo.shareCopy')}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm(t('solo.shareCloseConfirm'))) return;
                                try {
                                  await revokeSoloShare(s.token);
                                  void reload();
                                } catch (e) {
                                  notify(e instanceof Error ? e.message : String(e), 'error');
                                }
                              }}
                              className="font-caption text-caption text-error hover:underline"
                            >
                              {t('solo.shareClose')}
                            </button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
