import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchLearningCard, teacherErrorKey, type LearningCard } from '../../../lib/homework';
import { SKILL } from '../../../lib/homework/build';
import { MIN_SKILL_N as MIN_N, skillLabel, type SkillLabel } from '../../../lib/homework/teacherHelpers';
import { buildStatSheet } from '../../../lib/homework/stats';
import AccessibleDialog from '../../AccessibleDialog';
import ParentReport from './ParentReport';
import StatCard from './StatCard';

/** 학습 카드에 보이는 능력(순서 고정). 기록이 없으면 "아직 기록이 없어요". */
const SKILLS = [SKILL.meaning, SKILL.picture, SKILL.listen, SKILL.spelling, SKILL.context, SKILL.sentence, SKILL.content] as const;

const LABEL_STYLE: Record<SkillLabel, string> = {
  good: 'bg-emerald-100 text-emerald-800',
  practice: 'bg-amber-100 text-amber-800',
  review: 'bg-rose-100 text-rose-800',
};

/**
 * 학생 학습 카드(2026-10-05) — 온라인 숙제 기록으로 능력별 상태를 보여 준다. 숫자는 서버(student_learning_card)가 계산하고
 * 이 화면은 말로 바꾸기만 한다. 다른 학생과 비교하지 않고 "지난 기간의 나"와만 비교한다. 순위 없음.
 * 통장의 숙제 검사(오프라인 숙제)는 따로 보여 준다(섞지 않는다).
 */
export default function LearningCardModal({ studentId, onClose, onRecommend }: { studentId: string; onClose: () => void; onRecommend?: (studentId: string) => void }) {
  const { t } = useTranslation();
  const [days, setDays] = useState<30 | 90>(30);
  const [card, setCard] = useState<LearningCard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<'stat' | 'detail' | 'report'>('stat');
  const sheet = useMemo(() => (card ? buildStatSheet(card) : null), [card]);

  useEffect(() => {
    let alive = true;
    setCard(null);
    fetchLearningCard(studentId, days).then(
      (c) => alive && setCard(c),
      (e) => alive && setErr(t(teacherErrorKey(e))),
    );
    return () => {
      alive = false;
    };
  }, [studentId, days, t]);

  const enough = !!card && card.graded >= 30 && card.completed_activities >= 3;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

  return (
    <AccessibleDialog label={t('studentHw.learningCard')} onClose={onClose}>
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="font-label-md text-label-md text-primary">{t('studentHw.learningCard')}</div>
            <h2 className="font-headline-md text-headline-md text-deep-navy">{card?.student.name ?? '…'}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex min-h-11 items-center gap-1 rounded-full px-3 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
            {t('common.close')}
          </button>
        </div>

        <div className="flex gap-2" role="group" aria-label={t('studentHw.period')}>
          {([30, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => setDays(d)}
              className={`min-h-11 rounded-full px-5 font-label-md text-label-md ${days === d ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface'}`}
            >
              {t('studentHw.lastDays', { n: d })}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('studentHw.cardViews')}>
          {(['stat', 'detail', 'report'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`flex min-h-11 items-center gap-1.5 rounded-xl px-4 font-label-md text-label-md ${view === v ? 'bg-deep-navy text-white' : 'bg-surface-container-low text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-[18px]">{{ stat: 'military_tech', detail: 'list_alt', report: 'family_restroom' }[v]}</span>
              {t(`studentHw.view_${v}`)}
            </button>
          ))}
        </div>

        {err && <p className="text-base text-error">{err}</p>}
        {!card && !err && <p className="text-base text-on-surface-variant">{t('common.loading')}</p>}

        {card && sheet && view === 'stat' && <StatCard name={card.student.name} days={card.days} sheet={sheet} />}
        {card && sheet && view === 'report' && <ParentReport key={card.days} card={card} sheet={sheet} onBack={() => setView('stat')} />}

        {card && view === 'detail' && (
          <>
            <p className="text-sm text-on-surface-variant">{t('studentHw.evidence', { graded: card.graded, activities: card.completed_activities })}</p>
            {!enough && (
              <div className="rounded-xl bg-surface-container-low p-4">
                <div className="text-base font-bold text-deep-navy">{t('studentHw.collectingTitle')}</div>
                <div className="text-base text-on-surface-variant">{t('studentHw.collectingBody')}</div>
              </div>
            )}

            <ul className="divide-y divide-outline-variant/40 rounded-xl border border-outline-variant/50">
              {SKILLS.map((sk) => {
                const s = card.skills.find((x) => x.skill === sk);
                const label = enough && s ? skillLabel(s.n, s.weighted) : null;
                const now = s ? pct(s.correct, s.n) : null;
                const prev = s && s.prev_n >= MIN_N ? pct(s.prev_correct, s.prev_n) : null;
                return (
                  <li key={sk} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <span className="min-w-28 flex-1 text-base font-bold text-on-surface">{t(`studentHw.skill_${sk.replace('.', '_')}`)}</span>
                    {!s || s.n === 0 ? (
                      <span className="text-base text-on-surface-variant">{t('studentHw.noRecordYet')}</span>
                    ) : (
                      <>
                        {label && <span className={`rounded-full px-3 py-1 text-sm font-bold ${LABEL_STYLE[label]}`}>{t(`studentHw.label_${label}`)}</span>}
                        <span className="text-sm tabular-nums text-on-surface-variant">{t('studentHw.skillEvidence', { correct: s.correct, n: s.n })}</span>
                        {now !== null && prev !== null && (
                          <span className="text-sm text-on-surface-variant">
                            {now - prev >= 5 ? t('studentHw.vsPrevUp', { n: now - prev }) : now - prev <= -5 ? t('studentHw.vsPrevDown', { n: prev - now }) : t('studentHw.vsPrevSame')}
                          </span>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
              <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="min-w-28 flex-1 text-base font-bold text-on-surface">{t('studentHw.skill_habit')}</span>
                {card.habit.assigned === 0 ? (
                  <span className="text-base text-on-surface-variant">{t('studentHw.noRecordYet')}</span>
                ) : (
                  <>
                    {card.habit.assigned >= 3 && (
                      <span className={`rounded-full px-3 py-1 text-sm font-bold ${LABEL_STYLE[skillLabel(MIN_N, card.habit.finished / card.habit.assigned) ?? 'review']}`}>
                        {t(`studentHw.label_${skillLabel(MIN_N, card.habit.finished / card.habit.assigned) ?? 'review'}`)}
                      </span>
                    )}
                    <span className="text-sm tabular-nums text-on-surface-variant">{t('studentHw.habitEvidence', { finished: card.habit.finished, assigned: card.habit.assigned })}</span>
                    {card.habit.prev_assigned > 0 && (
                      <span className="text-sm text-on-surface-variant">{t('studentHw.habitPrev', { finished: card.habit.prev_finished, assigned: card.habit.prev_assigned })}</span>
                    )}
                  </>
                )}
              </li>
              <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="min-w-28 flex-1 text-base font-bold text-on-surface">{t('studentHw.skill_retry')}</span>
                {card.retries.count === 0 ? (
                  <span className="text-base text-on-surface-variant">{t('studentHw.noRecordYet')}</span>
                ) : (
                  <span className="text-sm tabular-nums text-on-surface-variant">{t('studentHw.retryEvidence', { count: card.retries.count, corrected: card.retries.corrected })}</span>
                )}
              </li>
            </ul>

            {card.shadowing.lines > 0 && <p className="text-base text-on-surface">{t('studentHw.shadowEvidence', { lines: card.shadowing.lines, listens: card.shadowing.listens })}</p>}

            {card.wrong_words.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-label-md text-label-md text-on-surface">{t('studentHw.reviewFirst')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {card.wrong_words.slice(0, 12).map((w) => (
                    <span key={w.word} className="rounded-full bg-error-container/50 px-3 py-1 text-base text-on-error-container">
                      {w.word} <b>×{w.count}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl bg-surface-container-low p-4">
              <div className="font-label-md text-label-md text-on-surface">{t('studentHw.passbookHomework')}</div>
              <div className="text-base text-on-surface">{t('studentHw.passbookEvidence', { done: card.passbook_homework.done, missing: card.passbook_homework.missing })}</div>
              <div className="text-sm text-on-surface-variant">{t('studentHw.passbookNote')}</div>
            </div>

            {card.recent.length > 0 && (
              <div className="space-y-1">
                <div className="font-label-md text-label-md text-on-surface">{t('studentHw.recentHomework')}</div>
                <ul className="space-y-1">
                  {card.recent.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-base">
                      <span className="truncate">{r.title || t('studentHw.defaultTitle')}</span>
                      <span className="shrink-0 text-sm text-on-surface-variant">
                        {t(`studentHw.status_${r.status}`)}
                        {r.status === 'done' && r.total ? ` · ${r.score}/${r.total}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-sm text-on-surface-variant">{t('studentHw.cardFootnote')}</p>
            {onRecommend && !card.student.archived && (
              <button type="button" onClick={() => onRecommend(studentId)} className="flex min-h-12 items-center gap-1.5 rounded-full bg-primary px-6 font-label-md text-label-md text-on-primary">
                <span className="material-symbols-outlined">auto_awesome</span>
                {t('studentHw.checkRecommend')}
              </button>
            )}
          </>
        )}
      </div>
    </AccessibleDialog>
  );
}
