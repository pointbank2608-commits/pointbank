import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { fetchClasses, fetchStudentsOfClass } from '../../lib/api';
import { useFeature } from '../../lib/features';
import type { ClassRow, FullCardItem, Student } from '../../lib/types';
import { toWmError, wmAssign, wmPlanLinks, wmStudentUrl } from '../../lib/wordMemory/api';
import { analyzeCards, dailyBudget, defaultStudyDays, estimateMinutes, introDays, toWmCards, WM_MAX_WORDS, WM_MIN_WORDS } from '../../lib/wordMemory/plan';
import type { WmAssignResult, WmDailyMode } from '../../lib/wordMemory/types';
import AccessibleDialog from '../AccessibleDialog';

export interface WmSource {
  type: 'wordlist' | 'elementary800' | 'custom';
  id?: string;
  name: string;
}

/**
 * 단어암기숙제 배정 창: 자료(단어장·초등 800) → 반·학생 → 하루 학습량 → 미리보기 → 명시적으로 "배정하기".
 * 배정 전에는 아무것도 만들지 않는다. 요청 번호(requestId)는 창을 열 때 한 번 정해 두 번 눌러도 한 번만 배정된다.
 */
export default function WordMemoryAssignModal({ source, cards, defaultClassId, onClose }: { source: WmSource; cards: FullCardItem[]; defaultClassId?: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { academy } = useAuth();
  const navigate = useNavigate();
  const homeworkOpen = useFeature('homework');
  const wmCards = useMemo(() => toWmCards(cards), [cards]);
  const analysis = useMemo(() => analyzeCards(wmCards), [wmCards]);
  const requestId = useRef(crypto.randomUUID());
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState(defaultClassId ?? '');
  const [students, setStudents] = useState<Student[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<WmDailyMode>('light');
  const [title, setTitle] = useState(source.name);
  const [studyDays, setStudyDays] = useState<number | null>(null);
  const [reviewDays, setReviewDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WmAssignResult | null>(null);
  const [links, setLinks] = useState<{ student_id: string; name: string; access: string }[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const study = studyDays ?? defaultStudyDays(wmCards.length, mode);

  useEffect(() => {
    if (!academy?.id) return;
    let alive = true;
    fetchClasses(academy.id)
      .then((rows) => {
        if (!alive) return;
        setClasses(rows);
        setClassId((cur) => cur || rows[0]?.id || '');
      })
      .catch(() => alive && setError('errUnknown'));
    return () => {
      alive = false;
    };
  }, [academy?.id]);

  useEffect(() => {
    if (!classId) return;
    let alive = true;
    fetchStudentsOfClass(classId)
      .then((rows) => {
        if (!alive) return;
        setStudents(rows);
        setPicked(new Set(rows.map((s) => s.id)));
      })
      .catch(() => alive && setError('errUnknown'));
    return () => {
      alive = false;
    };
  }, [classId]);

  const budget = dailyBudget(mode);
  const minutes = estimateMinutes(mode);
  const canAssign = homeworkOpen && !busy && !result && classId && picked.size > 0 && analysis.issues.length === 0;

  async function assign() {
    if (!canAssign) return;
    setBusy(true);
    setError(null);
    try {
      const r = await wmAssign({
        requestId: requestId.current,
        classId,
        title: title.trim() || source.name,
        cards: wmCards,
        source: { type: source.type, id: source.id, name: source.name },
        studentIds: [...picked],
        mode,
        studyDays: study,
        reviewDays,
      });
      setResult(r);
      if (r.plan_id) setLinks(await wmPlanLinks(r.plan_id));
    } catch (e) {
      const err = toWmError(e);
      setError(err.kind === 'feature_closed' ? 'errFeatureClosed' : err.kind === 'bad_student' || err.kind === 'no_students' ? 'errBadStudent' : err.kind === 'network' ? 'errNetwork' : 'errUnknown');
    } finally {
      setBusy(false);
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

  const field = 'min-h-11 rounded-xl border border-outline-variant bg-white px-3 text-base';
  const chip = (on: boolean) => `min-h-11 rounded-xl border-2 px-4 text-base font-bold ${on ? 'border-primary bg-primary text-white' : 'border-outline-variant bg-white text-deep-navy'}`;

  return (
    <AccessibleDialog label={t('wordMemory.title')} onClose={onClose}>
      <div className="w-full break-keep space-y-5 p-5 sm:p-7" data-wm-assign>
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-deep-navy">{t('wordMemory.title')}</h2>
            <p className="mt-1 text-on-surface-variant">{t('wordMemory.desc')}</p>
          </div>
          <button type="button" className="min-h-11 shrink-0 rounded-xl border border-outline-variant bg-white px-4 font-bold" onClick={onClose}>
            {t('wordMemory.close')}
          </button>
        </header>

        {!homeworkOpen && (
          <p role="alert" className="rounded-xl bg-error-container p-3 font-bold">
            {t('wordMemory.errFeatureClosed')}
          </p>
        )}

        {result ? (
          <section className="space-y-3" data-wm-result>
            <h3 className="text-xl font-bold text-deep-navy">{result.plan_id ? t('wordMemory.assignedTitle') : t('wordMemory.nothingNew')}</h3>
            {result.plan_id && <p>{t('wordMemory.assignedBody', { count: result.total })}</p>}
            {result.duplicate && <p className="text-on-surface-variant">{t('wordMemory.assignedDuplicate')}</p>}
            {result.skipped.length > 0 && <p className="text-on-surface-variant">{t('wordMemory.skipped', { count: result.skipped.length })}</p>}
            {links.length > 0 && (
              <div>
                <h4 className="mb-2 font-bold">{t('wordMemory.studentLinks')}</h4>
                <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant">
                  {links.map((l) => (
                    <li key={l.student_id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                      <span className="font-bold">{l.name}</span>
                      <button type="button" className={`${field} font-bold`} onClick={() => void copy(l.access)} data-wm-copy>
                        {copied === l.access ? t('wordMemory.linkCopied') : t('wordMemory.linkCopy')}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {result.plan_id && (
                <button type="button" className={`${field} border-primary bg-primary font-bold text-white`} onClick={() => navigate('/homework', { state: { wmPlanId: result.plan_id } })}>
                  {t('wordMemory.openResults')}
                </button>
              )}
              <button type="button" className={`${field} font-bold`} onClick={onClose}>
                {t('wordMemory.close')}
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-xl bg-surface-container-low p-4">
              <div className="text-sm font-bold text-on-surface-variant">{t('wordMemory.source')}</div>
              <div className="mt-1 text-lg font-bold" data-wm-source>
                {t('wordMemory.sourceWords', { name: source.name, count: wmCards.length })}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold text-on-surface-variant">
                {t('wordMemory.pickClass')}
                <select className={`${field} mt-1 w-full text-deep-navy`} value={classId} onChange={(e) => setClassId(e.target.value)} data-wm-class>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <div className="flex items-center justify-between text-sm font-bold text-on-surface-variant">
                  <span>{t('wordMemory.pickStudents')}</span>
                  <span className="flex gap-2">
                    <button type="button" className="text-primary underline" onClick={() => setPicked(new Set(students.map((s) => s.id)))}>
                      {t('wordMemory.selectAll')}
                    </button>
                    <button type="button" className="text-primary underline" onClick={() => setPicked(new Set())}>
                      {t('wordMemory.clearAll')}
                    </button>
                  </span>
                </div>
                {students.length === 0 ? (
                  <p className="mt-2 text-on-surface-variant">{t('wordMemory.noStudents')}</p>
                ) : (
                  <ul className="mt-1 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                    {students.map((s) => (
                      <li key={s.id}>
                        <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 ${picked.has(s.id) ? 'border-primary bg-primary-fixed' : 'border-outline-variant bg-white'}`}>
                          <input
                            type="checkbox"
                            checked={picked.has(s.id)}
                            onChange={() =>
                              setPicked((prev) => {
                                const n = new Set(prev);
                                if (n.has(s.id)) n.delete(s.id);
                                else n.add(s.id);
                                return n;
                              })
                            }
                            data-wm-student
                          />
                          {s.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section>
              <div className="mb-2 text-sm font-bold text-on-surface-variant">{t('wordMemory.daily')}</div>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t('wordMemory.daily')}>
                {(['light', 'normal'] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={mode === m} className={chip(mode === m)} onClick={() => setMode(m)} data-wm-mode={m}>
                    {t(m === 'light' ? 'wordMemory.dailyLight' : 'wordMemory.dailyNormal')}
                  </button>
                ))}
              </div>
              <p className="mt-2" data-wm-daily-desc>
                {t('wordMemory.dailyDesc', { asks: budget.asks, newMax: budget.newMax, min: minutes.min, max: minutes.max })}
              </p>
              <p className="text-sm text-on-surface-variant">{t('wordMemory.dailyNote')}</p>
            </section>

            <section className="space-y-1 rounded-xl border border-outline-variant p-4" data-wm-preview>
              <h3 className="font-bold text-deep-navy">{t('wordMemory.previewTitle')}</h3>
              <p>
                {t('wordMemory.previewWords', { count: analysis.total })} · {t('wordMemory.previewDays', { days: introDays(analysis.total, mode) })}
              </p>
              <p className="pt-1 text-sm font-bold text-on-surface-variant">{t('wordMemory.previewActivities')}</p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                <li>{t('wordMemory.actMeaning')}</li>
                {analysis.withImage > 0 && <li>{t('wordMemory.actPicture', { count: analysis.withImage })}</li>}
                {analysis.blankUsable > 0 && <li>{t('wordMemory.actBlank', { count: analysis.blankUsable })}</li>}
                {analysis.exampleUnusable > 0 && <li>{t('wordMemory.actBlankSkipped', { count: analysis.exampleUnusable })}</li>}
              </ul>
              {analysis.withImage < analysis.total && <p className="text-sm text-on-surface-variant">{t('wordMemory.noPicture')}</p>}
              {analysis.withExample < analysis.total && <p className="text-sm text-on-surface-variant">{t('wordMemory.noExample')}</p>}
              {analysis.homographs > 0 && <p className="text-sm text-on-surface-variant">{t('wordMemory.homographs', { count: analysis.homographs })}</p>}
              {analysis.issues.includes('too_few') && (
                <p role="alert" className="font-bold text-error">
                  {t('wordMemory.tooFew', { min: WM_MIN_WORDS })}
                </p>
              )}
              {analysis.issues.includes('too_many') && (
                <p role="alert" className="font-bold text-error">
                  {t('wordMemory.tooMany', { max: WM_MAX_WORDS })}
                </p>
              )}
            </section>

            <details className="rounded-xl border border-outline-variant p-4">
              <summary className="cursor-pointer font-bold text-primary">{t('wordMemory.optional')}</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="block text-sm font-bold text-on-surface-variant sm:col-span-3">
                  {t('wordMemory.planTitle')}
                  <input className={`${field} mt-1 w-full text-deep-navy`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
                </label>
                <label className="block text-sm font-bold text-on-surface-variant">
                  {t('wordMemory.studyDays')}
                  <select className={`${field} mt-1 w-full text-deep-navy`} value={study} onChange={(e) => setStudyDays(Number(e.target.value))} data-wm-study-days>
                    {[...new Set([7, 10, 14, 21, 30, 45, 60, study])].sort((a, b) => a - b).map((d) => (
                      <option key={d} value={d}>
                        {t('wordMemory.days', { count: d })}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-bold text-on-surface-variant">
                  {t('wordMemory.reviewDays')}
                  <select className={`${field} mt-1 w-full text-deep-navy`} value={reviewDays} onChange={(e) => setReviewDays(Number(e.target.value))}>
                    {[0, 7, 14, 21, 30].map((d) => (
                      <option key={d} value={d}>
                        {t('wordMemory.days', { count: d })}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>

            {error && (
              <p role="alert" className="rounded-xl bg-error-container p-3 font-bold" data-wm-error>
                {t(`wordMemory.${error}`)}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="min-h-12 rounded-xl bg-primary px-6 text-lg font-bold text-white shadow-sm disabled:opacity-40" disabled={!canAssign} onClick={() => void assign()} data-wm-assign-btn>
                {busy ? t('wordMemory.assigning') : t('wordMemory.assign')}
              </button>
            </div>
          </>
        )}
      </div>
    </AccessibleDialog>
  );
}
