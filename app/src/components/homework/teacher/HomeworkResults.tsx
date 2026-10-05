import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../context/ToastContext';
import { closeHomework, deleteHomework, fetchHomeworkSummary, homeworkUrl, teacherErrorKey, type HomeworkOverviewRow, type HomeworkSummary } from '../../../lib/homework';
import type { FullCardItem } from '../../../lib/types';
import { cardFromSnapshot } from '../../../lib/homework/teacherHelpers';
import HomeworkRewardPanel from './HomeworkRewardPanel';

const POLL_MS = 15000;

/**
 * 숙제 결과 — 집계는 서버(hw_assignment_summary)가 한다. 분모는 숙제를 낸 그 순간의 대상 학생 수.
 * 열려 있는 동안만, 화면이 보일 때만 15초마다 다시 읽는다.
 */
export default function HomeworkResults({
  hw,
  onChanged,
  onMakeHomework,
  onRecommend,
  onCard,
}: {
  hw: HomeworkOverviewRow;
  onChanged: () => void;
  /** 오답으로 숙제 만들기(학생 한 명 또는 반 전체) */
  onMakeHomework: (args: { studentIds?: string[]; cards: FullCardItem[]; title: string }) => void;
  onRecommend: (studentIds: string[]) => void;
  onCard: (studentId: string) => void;
}) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [sum, setSum] = useState<HomeworkSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      setSum(await fetchHomeworkSummary(hw.id));
      setUpdatedAt(new Date());
      setErr(null);
    } catch (e) {
      setErr(t(teacherErrorKey(e)));
    }
  }, [hw.id, t]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  if (err) return <p className="border-t border-outline-variant/40 p-4 text-base text-error">{err}</p>;
  if (!sum) return <p className="border-t border-outline-variant/40 p-4 text-base text-on-surface-variant">{t('common.loading')}</p>;

  const totalQ = sum.items.reduce((n, it) => n + it.count, 0);
  const done = sum.students.filter((s) => s.status === 'done');
  const notDone = sum.students.filter((s) => s.status !== 'done' && !s.archived);
  const classCards = sum.class_wrong_words.map((w, i) => cardFromSnapshot(w.word, w.card, i)).filter((c): c is FullCardItem => !!c);
  const cardsFor = (words: string[]) => {
    const set = new Set(words.map((w) => w.toLowerCase()));
    return classCards.filter((c) => set.has(c.word.toLowerCase()));
  };

  const reminder = t('studentHw.reminderMessage', {
    names: notDone.map((s) => s.name).join(', '),
    title: hw.title || t('studentHw.defaultTitle'),
    url: homeworkUrl(hw.code),
  });

  const pill = (status: string) =>
    status === 'done' ? 'bg-emerald-100 text-emerald-800' : status === 'doing' ? 'bg-amber-100 text-amber-800' : 'bg-surface-container-high text-on-surface-variant';
  const small = 'flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold';

  return (
    <div className="space-y-4 border-t border-outline-variant/40 p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-base">
        <span>
          {t('studentHw.doneOf', { done: done.length, total: sum.target_count })}
        </span>
        <span className="text-on-surface-variant">{t('studentHw.itemsLine', { count: sum.items.length, questions: totalQ })}</span>
        {updatedAt && (
          <span className="flex items-center gap-1 text-sm text-on-surface-variant" aria-live="polite">
            <span className="material-symbols-outlined text-[16px]">sync</span>
            {t('studentHw.autoRefresh', { time: updatedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) })}
          </span>
        )}
      </div>

      <HomeworkRewardPanel assignmentId={hw.id} summary={sum} onGiven={() => void load()} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-base">
          <thead>
            <tr className="text-left text-sm text-on-surface-variant">
              <th className="py-2 pr-3 font-label-md">{t('studentHw.colName')}</th>
              <th className="py-2 pr-3 font-label-md">{t('studentHw.colStatus')}</th>
              <th className="py-2 pr-3 font-label-md">{t('studentHw.colScore')}</th>
              <th className="py-2 pr-3 font-label-md">{t('studentHw.colTime')}</th>
              <th className="py-2 pr-3 font-label-md">{t('studentHw.colWrong')}</th>
              <th className="py-2 font-label-md">
                <span className="sr-only">{t('studentHw.colActions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sum.students.map((s) => (
              <tr key={s.student_id} className="border-t border-outline-variant/30 align-top">
                <td className="py-2 pr-3 font-bold text-on-surface">
                  {s.name}
                  {s.archived && <span className="ml-1 text-xs font-normal text-on-surface-variant">({t('studentHw.archived')})</span>}
                </td>
                <td className="py-2 pr-3">
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-sm ${pill(s.status)}`}>
                    {t(`studentHw.status_${s.status}`)}
                    {s.status === 'doing' && ` ${s.answered}/${totalQ}`}
                  </span>
                  {s.rewarded && (
                    <span className="ml-1 inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-warm-yellow/40 px-2 py-0.5 text-sm text-deep-navy">
                      <span className="material-symbols-outlined text-[14px]">savings</span>
                      {t('studentHw.rewarded')}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 tabular-nums">{s.status === 'none' ? '–' : `${s.correct} / ${totalQ}`}</td>
                <td className="py-2 pr-3 tabular-nums">{s.minutes === null ? '–' : t('studentHw.minutes', { n: s.minutes })}</td>
                <td className="py-2 pr-3 text-on-surface-variant">
                  {s.wrong_words.slice(0, 6).join(', ')}
                  {s.retries > 0 && <div className="text-xs">{t('studentHw.retriesN', { count: s.retries })}</div>}
                </td>
                <td className="py-1">
                  <div className="flex flex-wrap justify-end gap-1">
                    {s.wrong_words.length > 0 && !s.archived && (
                      <button
                        type="button"
                        className={`${small} bg-secondary-container/60 text-on-surface hover:bg-secondary-container`}
                        onClick={() =>
                          onMakeHomework({ studentIds: [s.student_id], cards: cardsFor(s.wrong_words), title: t('studentHw.wrongTitleFor', { name: s.name }) })
                        }
                      >
                        <span className="material-symbols-outlined text-[18px]">replay</span>
                        {t('studentHw.makeFromWrong')}
                      </button>
                    )}
                    <button type="button" className={`${small} border border-outline-variant text-on-surface hover:bg-surface-container-low`} onClick={() => onCard(s.student_id)}>
                      <span className="material-symbols-outlined text-[18px]">badge</span>
                      {t('studentHw.learningCard')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sum.class_wrong_words.length > 0 && (
        <div className="space-y-2">
          <div className="font-label-md text-label-md text-on-surface">{t('studentHw.classWrongWords')}</div>
          <div className="flex flex-wrap gap-1.5">
            {sum.class_wrong_words.slice(0, 15).map((w) => (
              <span key={w.word} className="rounded-full bg-error-container/60 px-3 py-1 text-base text-on-error-container">
                {w.word} <b>×{w.count}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {classCards.length >= 2 && (
          <button
            type="button"
            className={`${small} bg-primary px-4 text-on-primary`}
            onClick={() => onMakeHomework({ cards: classCards.slice(0, 20), title: t('studentHw.classReviewTitle') })}
          >
            <span className="material-symbols-outlined text-[18px]">group_work</span>
            {t('studentHw.makeClassReview')}
          </button>
        )}
        <button
          type="button"
          className={`${small} border border-outline-variant px-4 text-on-surface`}
          onClick={() => onRecommend(sum.students.filter((s) => !s.archived && s.status !== 'none').map((s) => s.student_id))}
        >
          <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          {t('studentHw.checkRecommend')}
        </button>
        {notDone.length > 0 && !hw.closed_at && (
          <button
            type="button"
            className={`${small} border border-outline-variant px-4 text-on-surface`}
            onClick={() =>
              void navigator.clipboard.writeText(reminder).then(
                () => notify(t('studentHw.copiedReminder', { count: notDone.length })),
                () => notify(t('studentHw.copyFailed'), 'error'),
              )
            }
          >
            <span className="material-symbols-outlined text-[18px]">notifications</span>
            {t('studentHw.copyReminder', { count: notDone.length })}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/30 pt-3">
        <button
          type="button"
          className={`${small} border border-outline-variant px-4 text-on-surface-variant`}
          onClick={() =>
            void closeHomework(hw.id, !hw.closed_at).then(
              () => {
                notify(t(hw.closed_at ? 'studentHw.reopened' : 'studentHw.closedToast'));
                onChanged();
              },
              (e) => notify(t(teacherErrorKey(e)), 'error'),
            )
          }
        >
          <span className="material-symbols-outlined text-[18px]">{hw.closed_at ? 'lock_open' : 'lock'}</span>
          {t(hw.closed_at ? 'studentHw.reopen' : 'studentHw.close')}
        </button>
        {confirmDelete ? (
          <span className="flex flex-wrap items-center gap-2 rounded-xl bg-error-container/40 px-3 py-1.5" role="alert">
            <span className="text-base text-on-error-container">{t('studentHw.deleteConfirm')}</span>
            <button
              type="button"
              className={`${small} bg-error px-4 text-on-error`}
              onClick={() =>
                void deleteHomework(hw.id).then(
                  () => {
                    notify(t('studentHw.deleted'));
                    onChanged();
                  },
                  (e) => notify(t(teacherErrorKey(e)), 'error'),
                )
              }
            >
              {t('studentHw.delete')}
            </button>
            <button type="button" className={`${small} border border-outline-variant px-4`} onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </button>
          </span>
        ) : (
          <button type="button" className={`${small} px-4 text-error hover:bg-error-container/40`} onClick={() => setConfirmDelete(true)}>
            <span className="material-symbols-outlined text-[18px]">delete</span>
            {t('studentHw.delete')}
          </button>
        )}
      </div>
    </div>
  );
}
