import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../context/ToastContext';
import { closeHomework, deleteHomework, fetchHomeworkSummary, homeworkUrl, teacherErrorKey, type HomeworkOverviewRow, type HomeworkSummary } from '../../../lib/homework';
import type { FullCardItem } from '../../../lib/types';
import { cardFromSnapshot } from '../../../lib/homework/teacherHelpers';
import HomeworkRewardPanel from './HomeworkRewardPanel';
import { ClassMethods, StudentStrip, useBlockRows } from './BlockResults';
import WatchResults from './WatchResults';

const POLL_MS = 15000;

/**
 * 숙제 결과 — 집계는 서버(hw_assignment_summary)가 한다. 분모는 숙제를 낸 그 순간의 대상 학생 수.
 * 위쪽은 반 전체 피드백(완료·평균·방식별 평균·자주 틀린 낱말·반 단위 버튼), 아래는 학생별 카드(점수·활동 색칸·오답·버튼).
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
  const [allWords, setAllWords] = useState(false);
  const block = useBlockRows(hw.id);

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
  // 반 평균: 끝낸 학생의 점수·시간
  const avgPct = totalQ > 0 && done.length > 0 ? Math.round((100 * done.reduce((n, s) => n + s.correct, 0)) / (done.length * totalQ)) : null;
  const withMin = done.filter((s) => s.minutes !== null);
  const avgMin = withMin.length ? Math.round(withMin.reduce((n, s) => n + (s.minutes ?? 0), 0) / withMin.length) : null;

  const reminder = t('studentHw.reminderMessage', {
    names: notDone.map((s) => s.name).join(', '),
    title: hw.title || t('studentHw.defaultTitle'),
    url: homeworkUrl(hw.code),
  });

  const pill = (status: string) =>
    status === 'done' ? 'bg-emerald-100 text-emerald-800' : status === 'doing' ? 'bg-amber-100 text-amber-800' : 'bg-surface-container-high text-on-surface-variant';
  const small = 'flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold';
  const stat = 'rounded-xl bg-white px-4 py-2 text-center';

  return (
    <div className="space-y-4 border-t border-outline-variant/40 p-4">
      {/* 1. 반 전체 피드백 */}
      <section className="space-y-3 rounded-2xl bg-primary/5 p-4" aria-label="반 전체 피드백">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-deep-navy">반 전체 피드백</h3>
          {updatedAt && (
            <span className="flex items-center gap-1 text-sm text-on-surface-variant" aria-live="polite">
              <span className="material-symbols-outlined text-[16px]">sync</span>
              {t('studentHw.autoRefresh', { time: updatedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) })}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className={stat}>
            <div className="text-xl font-bold tabular-nums">{done.length}/{sum.target_count}</div>
            <div className="text-xs text-on-surface-variant">완료</div>
          </div>
          <div className={stat}>
            <div className="text-xl font-bold tabular-nums">{avgPct === null ? '–' : `${avgPct}%`}</div>
            <div className="text-xs text-on-surface-variant">평균 정답률</div>
          </div>
          <div className={stat}>
            <div className="text-xl font-bold tabular-nums">{avgMin === null ? '–' : t('studentHw.minutes', { n: avgMin })}</div>
            <div className="text-xs text-on-surface-variant">평균 시간</div>
          </div>
          <div className={stat}>
            <div className="text-xl font-bold tabular-nums">{sum.items.length}<span className="text-sm font-normal text-on-surface-variant"> / {totalQ}문제</span></div>
            <div className="text-xs text-on-surface-variant">활동</div>
          </div>
        </div>

        <ClassMethods rows={block.rows} />
        {block.error && <p role="status" className="text-sm text-error">{block.error}</p>}

        {sum.class_wrong_words.length > 0 && (
          <div className="space-y-1">
            <div className="text-sm font-bold text-on-surface-variant">{t('studentHw.classWrongWords')}</div>
            <div className="flex flex-wrap gap-1.5">
              {sum.class_wrong_words.slice(0, allWords ? 40 : 8).map((w) => (
                <span key={w.word} className="rounded-full bg-error-container/60 px-3 py-1 text-base text-on-error-container">
                  {w.word} <b>×{w.count}</b>
                </span>
              ))}
              {sum.class_wrong_words.length > 8 && (
                <button type="button" onClick={() => setAllWords((v) => !v)} className="rounded-full border border-outline-variant px-3 py-1 text-sm font-bold text-on-surface-variant">
                  {allWords ? '접기' : `+${Math.min(sum.class_wrong_words.length, 40) - 8} 더 보기`}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {classCards.length >= 2 && (
            <button type="button" className={`${small} bg-primary px-4 text-on-primary`} onClick={() => onMakeHomework({ cards: classCards.slice(0, 20), title: t('studentHw.classReviewTitle') })}>
              <span className="material-symbols-outlined text-[18px]">group_work</span>
              {t('studentHw.makeClassReview')}
            </button>
          )}
          <button
            type="button"
            className={`${small} border border-outline-variant bg-white px-4 text-on-surface`}
            onClick={() => onRecommend(sum.students.filter((s) => !s.archived && s.status !== 'none').map((s) => s.student_id))}
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            {t('studentHw.checkRecommend')}
          </button>
          {notDone.length > 0 && !hw.closed_at && (
            <button
              type="button"
              className={`${small} border border-outline-variant bg-white px-4 text-on-surface`}
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
      </section>

      <HomeworkRewardPanel assignmentId={hw.id} summary={sum} onGiven={() => void load()} />
      <WatchResults assignmentId={hw.id} itemTitles={new Map(sum.items.map((it) => [it.id, it.title]))} />

      {/* 2. 학생별 결과·피드백 */}
      <section className="space-y-2" aria-label="학생별 결과">
        <h3 className="text-lg font-bold text-deep-navy">학생별 결과</h3>
        {sum.students.map((s) => (
          <article key={s.student_id} className="space-y-2 rounded-2xl border border-outline-variant/60 bg-white p-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-lg font-bold text-on-surface">
                {s.name}
                {s.archived && <span className="ml-1 text-xs font-normal text-on-surface-variant">({t('studentHw.archived')})</span>}
              </span>
              <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-sm ${pill(s.status)}`}>
                {t(`studentHw.status_${s.status}`)}
                {s.status === 'doing' && ` ${s.answered}/${totalQ}`}
              </span>
              {s.rewarded && (
                <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-warm-yellow/40 px-2 py-0.5 text-sm text-deep-navy">
                  <span className="material-symbols-outlined text-[14px]">savings</span>
                  {t('studentHw.rewarded')}
                </span>
              )}
              <span className="ml-auto flex items-center gap-3 text-base tabular-nums">
                <b>{s.status === 'none' ? '–' : totalQ === 0 ? t('studentHw.activityCompletion', { defaultValue: '활동 완료 확인' }) : `${s.correct} / ${totalQ}`}</b>
                <span className="text-on-surface-variant">{s.minutes === null ? '' : t('studentHw.minutes', { n: s.minutes })}</span>
              </span>
            </div>

            <StudentStrip rows={block.rows} name={s.name} onReviewed={() => void block.load()} onError={(m) => notify(m, 'error')} />

            {(s.wrong_words.length > 0 || s.retries > 0) && (
              <div className="text-base text-on-surface-variant">
                {s.wrong_words.length > 0 && (
                  <>
                    <span className="font-bold text-on-surface">틀린 낱말 {s.wrong_words.length}개</span> · {s.wrong_words.slice(0, 6).join(', ')}
                    {s.wrong_words.length > 6 && ` +${s.wrong_words.length - 6}`}
                  </>
                )}
                {s.retries > 0 && <span className="ml-2 text-sm">{t('studentHw.retriesN', { count: s.retries })}</span>}
              </div>
            )}

            <div className="flex flex-wrap gap-1">
              {s.wrong_words.length > 0 && !s.archived && (
                <button
                  type="button"
                  className={`${small} bg-secondary-container/60 text-on-surface hover:bg-secondary-container`}
                  onClick={() => onMakeHomework({ studentIds: [s.student_id], cards: cardsFor(s.wrong_words), title: t('studentHw.wrongTitleFor', { name: s.name }) })}
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
          </article>
        ))}
      </section>

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
