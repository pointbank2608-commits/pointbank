import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchRevisions, restoreLessonRevision, type ContentRevision } from '../lib/api';
import { effectiveSlides } from '../lib/lessonSlides';
import type { CurriculumLesson, LessonSlide } from '../lib/types';

/**
 * 수업의 이전 버전(supabase/034 content_revisions). 저장할 때마다 트리거가 남겨 둔 직전 내용을
 * 보여 주고, 고르면 그 슬라이드·이름·단어장 연결로 되돌린다.
 */
export default function LessonHistoryModal({
  lesson,
  onClose,
  onRestored,
}: {
  lesson: CurriculumLesson;
  onClose: () => void;
  onRestored: () => void;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ContentRevision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchRevisions('curriculum_lessons', lesson.id)
      .then((list) => setRows(list.filter((r) => r.op === 'update')))
      .catch((e) => {
        const msg = String((e as { message?: string })?.message ?? e);
        setError(msg.includes('content_revisions') || msg.includes('schema cache') ? t('curriculum.history.needSetup') : msg);
        setRows([]);
      });
  }, [lesson.id, t]);

  async function restore(rev: ContentRevision) {
    if (!confirm(t('curriculum.history.restoreConfirm'))) return;
    setBusy(rev.id);
    try {
      await restoreLessonRevision(rev);
      onRestored();
    } catch (e) {
      setError(String((e as { message?: string })?.message ?? e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl bg-surface-container-lowest p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-title-md text-title-md font-bold text-on-surface">{t('curriculum.history.title', { name: lesson.name })}</h3>
        <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.history.desc')}</p>
        {error && <p className="font-caption text-caption text-error">{error}</p>}
        {rows === null && <p className="font-caption text-caption text-on-surface-variant">{t('common.loading')}</p>}
        {rows && rows.length === 0 && !error && <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.history.empty')}</p>}
        <ul className="space-y-2">
          {rows?.map((rev) => {
            const slides = (rev.data.playlist as LessonSlide[] | undefined) ?? [];
            const count = effectiveSlides({ ...lesson, playlist: slides }).length;
            return (
              <li key={rev.id} className="flex items-center gap-2 rounded-lg border border-outline-variant/60 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-label-md text-label-md text-on-surface">{new Date(rev.created_at).toLocaleString()}</div>
                  <div className="font-caption text-caption text-on-surface-variant">
                    {t('curriculum.history.slides', { count })}
                    {typeof rev.data.name === 'string' && rev.data.name !== lesson.name ? ` · ${rev.data.name}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy === rev.id}
                  onClick={() => void restore(rev)}
                  className="shrink-0 rounded-full bg-primary px-3 py-1.5 font-label-md text-label-md text-on-primary disabled:opacity-50"
                >
                  {t('curriculum.history.restore')}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end pt-1">
          <button type="button" onClick={onClose} className="rounded-full border border-outline-variant px-4 py-2 font-label-md text-label-md text-on-surface-variant">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
