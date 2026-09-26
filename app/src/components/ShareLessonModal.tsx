import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { effectiveSlides } from '../lib/lessonSlides';
import { buildShareSnapshot, createLessonShare, fetchLessonShares, lessonShareUrl, revokeLessonShare, type LessonShareRow } from '../lib/lessonShare';
import type { CurriculumLesson, WordList } from '../lib/types';

/**
 * 수업 공유 링크 만들기·끄기(2026-09-27). 링크를 받은 선생님은 미리 보고 "내 수업으로 가져오기"로 자기 학원에
 * 복사본을 만든다. 노래·지문 슬라이드(가사·지문 원문)는 저작권 때문에 기본으로 빼고 공유한다.
 */
export default function ShareLessonModal({
  lesson,
  wordList,
  academyId,
  onClose,
}: {
  lesson: CurriculumLesson;
  wordList: WordList | null;
  academyId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const hasReading = effectiveSlides(lesson).some((s) => s.kind === 'reading');
  const [dropReading, setDropReading] = useState(true);
  const [shares, setShares] = useState<LessonShareRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchLessonShares(lesson.id)
      .then(setShares)
      .catch((e) => {
        setShares([]);
        setError(String((e as { message?: string })?.message ?? e).includes('lesson_shares') ? t('lessonShare.needSetup') : String(e));
      });
  }, [lesson.id, t]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const snapshot = await buildShareSnapshot(lesson, wordList, { dropReading: hasReading && dropReading });
      const row = await createLessonShare({ academyId, lessonId: lesson.id, title: lesson.name, snapshot });
      setShares((prev) => [row, ...(prev ?? [])]);
      void copy(row.token);
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      setError(msg.includes('lesson_shares') ? t('lessonShare.needSetup') : msg);
    } finally {
      setBusy(false);
    }
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(lessonShareUrl(token));
      setCopied(token);
      window.setTimeout(() => setCopied((c) => (c === token ? null : c)), 2000);
    } catch {
      /* 복사 권한이 없으면 주소 칸에서 직접 복사 */
    }
  }

  async function revoke(row: LessonShareRow) {
    if (!confirm(t('lessonShare.revokeConfirm'))) return;
    await revokeLessonShare(row.id);
    setShares((prev) => (prev ?? []).filter((s) => s.id !== row.id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[24px] text-primary">share</span>
          <h2 className="min-w-0 flex-1 truncate font-title-md text-title-md font-bold text-deep-navy">{t('lessonShare.title', { name: lesson.name })}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-surface-container" aria-label={t('common.cancel')}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('lessonShare.intro')}</p>
        <ul className="space-y-1 font-caption text-caption text-on-surface-variant">
          <li>• {t('lessonShare.includes')}</li>
          <li>• {t('lessonShare.excludes')}</li>
        </ul>
        {hasReading && (
          <label className="flex items-start gap-2 rounded-lg bg-warm-yellow/20 p-3 font-label-md text-label-md text-on-surface">
            <input type="checkbox" checked={dropReading} onChange={(e) => setDropReading(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
            <span>{t('lessonShare.dropReading')}</span>
          </label>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void create()}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]">add_link</span>
          {busy ? t('common.loading') : t('lessonShare.create')}
        </button>
        {error && <p className="rounded-lg bg-error-container px-3 py-2 font-caption text-caption text-on-error-container">{error}</p>}
        {shares && shares.length > 0 && (
          <div className="space-y-2">
            <div className="font-label-md text-label-md text-on-surface-variant">{t('lessonShare.activeLinks')}</div>
            {shares.map((row) => (
              <div key={row.id} className="flex items-center gap-2 rounded-lg border border-outline-variant/60 p-2">
                <input readOnly value={lessonShareUrl(row.token)} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 bg-transparent px-1 text-sm text-on-surface outline-none" />
                <button
                  type="button"
                  onClick={() => void copy(row.token)}
                  className="shrink-0 rounded-full bg-secondary-container px-3 py-1 font-label-md text-label-md text-on-secondary-container"
                >
                  {copied === row.token ? t('lessonShare.copied') : t('lessonShare.copy')}
                </button>
                <button type="button" onClick={() => void revoke(row)} className="shrink-0 rounded-full px-2 py-1 font-label-md text-label-md text-error hover:bg-error/10">
                  {t('lessonShare.revoke')}
                </button>
              </div>
            ))}
            <p className="font-caption text-caption text-on-surface-variant">{t('lessonShare.snapshotNote')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
