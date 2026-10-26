import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toWmError, wmPlanClose, wmPlanLinks, wmPlanList, wmPlanResults, wmStudentUrl } from '../../lib/wordMemory/api';
import type { WmPlanResults, WmPlanSummary, WmStudentResult } from '../../lib/wordMemory/types';

const SKILLS = ['meaning', 'spelling', 'listening', 'context', 'picture'] as const;

/** 약한 능력(틀린 횟수가 많은 순, 최대 2개) */
function weakSkills(skill: Record<string, number>): string[] {
  return SKILLS.filter((s) => (skill[s] ?? 0) > 0)
    .sort((a, b) => (skill[b] ?? 0) - (skill[a] ?? 0))
    .slice(0, 2);
}

/**
 * 숙제 페이지의 "단어암기숙제 현황". 숙제 완료(오늘 학습)와 장기 기억(며칠 뒤에도 기억한 단어)을 다른 지표로 나눠 보여 준다.
 * 능력별(뜻·철자·듣기…) 더 연습할 부분과 개인 링크도 여기서 본다.
 */
export default function WordMemoryResults({ classId, initialPlanId }: { classId: string; initialPlanId?: string | null }) {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<WmPlanSummary[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialPlanId ?? null);
  const [results, setResults] = useState<WmPlanResults | null>(null);
  const [links, setLinks] = useState<{ student_id: string; name: string; access: string }[]>([]);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPlans(await wmPlanList(classId));
      setError(false);
    } catch (e) {
      const k = toWmError(e).kind;
      // 숙제 기능이 닫혔거나 서버에 아직 없으면 조용히 숨긴다
      setPlans(k === 'feature_closed' || k === 'not_found' ? [] : []);
      setError(k !== 'feature_closed' && k !== 'not_found');
    }
  }, [classId]);

  useEffect(() => {
    setPlans(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (!openId) {
      setResults(null);
      return;
    }
    let alive = true;
    Promise.all([wmPlanResults(openId), wmPlanLinks(openId)])
      .then(([r, l]) => {
        if (!alive) return;
        setResults(r);
        setLinks(l);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [openId]);

  async function close(id: string) {
    if (!window.confirm(t('wordMemory.closeConfirm'))) return;
    try {
      await wmPlanClose(id);
      await load();
      setOpenId(null);
    } catch {
      setError(true);
    }
  }

  async function copy(access: string) {
    try {
      await navigator.clipboard.writeText(wmStudentUrl(access));
      setCopied(access);
    } catch {
      setCopied(null);
    }
  }

  if (plans === null) return null;
  if (plans.length === 0 && !error) return null;

  return (
    <section className="space-y-3 break-keep rounded-xl border border-outline-variant bg-surface-container-lowest p-4" data-wm-results aria-label={t('wordMemory.resultsTitle')}>
      <h2 className="text-xl font-bold text-deep-navy">{t('wordMemory.resultsTitle')}</h2>
      {error && (
        <p role="alert" className="rounded-lg bg-error-container px-3 py-2">
          {t('wordMemory.errUnknown')}
        </p>
      )}
      <ul className="space-y-2">
        {plans.map((p) => (
          <li key={p.id} className="rounded-xl border border-outline-variant" data-wm-plan={p.id}>
            <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left" aria-expanded={openId === p.id} onClick={() => setOpenId(openId === p.id ? null : p.id)}>
              <span>
                <span className="block font-bold text-deep-navy">
                  {p.title || t('wordMemory.title')}
                  {p.closed && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs">{t('wordMemory.planClosed')}</span>}
                  {!p.closed && p.ended && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs">{t('wordMemory.planEnded')}</span>}
                </span>
                <span className="block text-sm text-on-surface-variant">
                  {t('wordMemory.planMeta', { words: p.words, mode: t(p.daily_mode === 'light' ? 'wordMemory.dailyLight' : 'wordMemory.dailyNormal'), day: p.day_index + 1, study: p.study_days, review: p.review_days })}
                </span>
              </span>
              <span className="text-sm font-bold text-primary">{t('wordMemory.todayDone', { done: p.today_done, total: p.students })}</span>
            </button>
            {openId === p.id && results && results.plan.id === p.id && (
              <div className="space-y-3 border-t border-outline-variant p-3">
                <p className="text-sm text-on-surface-variant">{t('wordMemory.resultsNote')}</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-left text-sm">
                    <thead>
                      <tr className="text-on-surface-variant">
                        <th className="p-2">{t('wordMemory.colName')}</th>
                        <th className="p-2">{t('wordMemory.colToday')}</th>
                        <th className="p-2">{t('wordMemory.colMet')}</th>
                        <th className="p-2">{t('wordMemory.colAlone')}</th>
                        <th className="p-2">{t('wordMemory.colKept')}</th>
                        <th className="p-2">{t('wordMemory.colPractice')}</th>
                        <th className="p-2">{t('wordMemory.colLast')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.students.map((s: WmStudentResult) => {
                        const weak = weakSkills(s.skill_miss);
                        return (
                          <tr key={s.student_id} className="border-t border-outline-variant" data-wm-student-row={s.name}>
                            <td className="p-2 font-bold">{s.name}</td>
                            <td className="p-2">{t(`wordMemory.todayState_${s.today}`)}</td>
                            <td className="p-2 tabular-nums">
                              {s.met} / {results.plan.words}
                            </td>
                            <td className="p-2 tabular-nums">{s.alone_words}</td>
                            <td className="p-2 tabular-nums font-bold">{s.kept_words}</td>
                            <td className="p-2">{weak.length ? weak.map((k) => t(`wordMemory.skill_${k}`)).join(' · ') : t('wordMemory.noPractice')}</td>
                            <td className="p-2 tabular-nums">{s.last_active ?? '–'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <details>
                  <summary className="cursor-pointer font-bold text-primary">{t('wordMemory.studentLinks')}</summary>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {links.map((l) => (
                      <li key={l.student_id}>
                        <button type="button" className="min-h-11 rounded-xl border border-outline-variant bg-white px-3 text-sm font-bold" onClick={() => void copy(l.access)}>
                          {l.name} · {copied === l.access ? t('wordMemory.linkCopied') : t('wordMemory.linkCopy')}
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
                {!p.closed && (
                  <button type="button" className="min-h-11 rounded-xl border border-outline-variant px-4 text-sm font-bold text-error" onClick={() => void close(p.id)}>
                    {t('wordMemory.closePlan')}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
