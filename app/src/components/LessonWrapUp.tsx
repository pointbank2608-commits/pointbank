import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { fetchAttendance, fetchStudentsOfClass } from '../lib/api';
import { useFeature } from '../lib/features';
import { useToast } from '../context/ToastContext';

export interface WrapUpInfo {
  lessonName: string;
  classId: string | null;
  className?: string;
  minutes: number;
  words: string[];
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 수업을 마친 뒤 한 화면: 출석 · 칭찬 통장 · 숙제 · 알림장 문구(카톡용 복사). */
export default function LessonWrapUp({ info, onClose }: { info: WrapUpInfo; onClose: () => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const homeworkOpen = useFeature('homework');
  const [att, setAtt] = useState<{ present: number; total: number } | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!info.classId) return;
    let alive = true;
    const day = todayKey();
    Promise.all([fetchStudentsOfClass(info.classId), fetchAttendance(info.classId, day, day)])
      .then(([students, rows]) => {
        if (alive) setAtt({ present: rows.filter((r) => r.checked_in_at).length, total: students.length });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [info.classId]);

  const wordsKey = info.words.slice(0, 8).join(', ');
  useEffect(() => {
    const words = wordsKey;
    setNote(
      words
        ? t('wrapUp.noteWithWords', { cls: info.className ?? '', lesson: info.lessonName, words })
        : t('wrapUp.noteNoWords', { cls: info.className ?? '', lesson: info.lessonName }),
    );
  }, [wordsKey, info.className, info.lessonName, t]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(note);
      notify(t('wrapUp.copied'));
    } catch {
      notify(t('wrapUp.copyFailed'), 'error');
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t('wrapUp.title')} className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/50 p-4">
      <div className="max-h-[90dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy">{t('wrapUp.title')}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {t('wrapUp.done', { cls: info.className ?? '', lesson: info.lessonName })}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-outline-variant/60 p-4">
            <div className="font-caption text-caption text-on-surface-variant">{t('wrapUp.attendance')}</div>
            <div className="mt-1 font-title-md text-title-md text-on-surface">
              {att ? t('wrapUp.attendanceValue', { present: att.present, total: att.total }) : '–'}
            </div>
            <Link to="/attendance" onClick={onClose} className="mt-2 inline-flex min-h-11 items-center font-label-md text-label-md text-primary underline">
              {t('wrapUp.openAttendance')}
            </Link>
          </div>
          <div className="rounded-xl border border-outline-variant/60 p-4">
            <div className="font-caption text-caption text-on-surface-variant">{t('wrapUp.praise')}</div>
            <div className="mt-1 font-body-md text-body-md text-on-surface">{t('wrapUp.praiseHint')}</div>
            <Link to="/board" onClick={onClose} className="mt-2 inline-flex min-h-11 items-center font-label-md text-label-md text-primary underline">
              {t('wrapUp.openBoard')}
            </Link>
          </div>
          {homeworkOpen && (
            <div className="rounded-xl border border-outline-variant/60 p-4">
              <div className="font-caption text-caption text-on-surface-variant">{t('wrapUp.homework')}</div>
              <div className="mt-1 font-body-md text-body-md text-on-surface">{t('wrapUp.homeworkHint')}</div>
              <Link to="/homework" onClick={onClose} className="mt-2 inline-flex min-h-11 items-center font-label-md text-label-md text-primary underline">
                {t('wrapUp.openHomework')}
              </Link>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-dashed border-outline-variant p-4">
          <label className="block font-caption text-caption text-on-surface-variant" htmlFor="wrapup-note">
            {t('wrapUp.noteLabel')}
          </label>
          <textarea
            id="wrapup-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 font-body-md text-body-md"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copy()} className="min-h-12 rounded-full bg-primary px-6 font-label-md text-label-md text-on-primary hover:bg-primary-container">
            {t('wrapUp.copy')}
          </button>
          <button type="button" onClick={onClose} className="min-h-12 rounded-full border border-outline-variant px-6 font-label-md text-label-md text-on-surface-variant">
            {t('wrapUp.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
