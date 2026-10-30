import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { toWmError, wmApplyStep, wmPlanBriefing, wmPlanCards, wmPlanProgress, wmPlanSteps, wmPlanWeakCards } from '../../lib/wordMemory/api';
import { createCheckTest, fmtDate, parentSummary, pickFinalCards, SECTION_SIZE, sectionCount } from '../../lib/wordMemory/coach';
import type { WmBriefing, WmDailyMode, WmProgress, WmStepAction, WmStepReason, WmStudentSteps } from '../../lib/wordMemory/types';

type Tab = 'brief' | 'steps' | 'progress';

const MODE_KO: Record<WmDailyMode, string> = { light: '가볍게', normal: '보통', plus: '넉넉히' };
const MODE_EN: Record<WmDailyMode, string> = { light: 'Light', normal: 'Normal', plus: 'Plenty' };
const SKILL_KO: Record<string, string> = { spelling: '철자', listening: '듣기', meaning: '뜻', context: '문장 속 쓰임' };
const SKILL_EN: Record<string, string> = { spelling: 'spelling', listening: 'listening', meaning: 'meaning', context: 'sentence use' };

/**
 * 단어암기 프로젝트의 선생님 코치 화면(2026-10-31) — 매일 아침 한 번 열어 보는 도구.
 *  ① 오늘 브리핑: 어제 누가 했는지, 반이 이번 주 가장 헷갈린 낱말(수업 3분 확인·확인 숙제로 연결)
 *  ② 다음 단계 카드: 기록으로 제안한 분량·집중 조정을 선생님이 승인(자동으로 바꾸지 않는다)
 *  ③ 진행·시험: 구간(50개)별 졸업(며칠 뒤에도 기억함), 지금 속도의 완성 예상일, 구간 시험·최종 시험, 학부모 요약
 */
export default function WordMemoryCoach({ planId, classId, planTitle, words, closed }: { planId: string; classId: string; planTitle: string; words: number; closed: boolean }) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const l = useCallback((ko: string, e: string) => (en ? e : ko), [en]);
  const { notify } = useToast();
  const [tab, setTab] = useState<Tab>('brief');
  const [brief, setBrief] = useState<WmBriefing | null>(null);
  const [steps, setSteps] = useState<WmStudentSteps[] | null>(null);
  const [progress, setProgress] = useState<WmProgress | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [section, setSection] = useState(1);

  const load = useCallback(
    async (which: Tab) => {
      try {
        setError(false);
        if (which === 'brief') setBrief(await wmPlanBriefing(planId));
        else if (which === 'steps') setSteps(await wmPlanSteps(planId));
        else setProgress(await wmPlanProgress(planId));
      } catch (e) {
        const k = toWmError(e).kind;
        setError(k !== 'feature_closed');
      }
    },
    [planId],
  );
  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  const studentIds = useMemo(() => (progress?.students ?? brief?.students ?? []).map((s) => s.student_id), [progress, brief]);

  const modeName = (m: WmDailyMode) => (en ? MODE_EN : MODE_KO)[m];
  const skillName = (k?: string | null) => (k ? ((en ? SKILL_EN : SKILL_KO)[k] ?? k) : '');

  const actionLabel = (a: WmStepAction) =>
    ({
      lighter: l('하루 분량 줄이기', 'Lighter daily load'),
      heavier: l('하루 분량 늘리기', 'Heavier daily load'),
      focus_spelling: l('철자 집중 연습', 'Focus on spelling'),
      focus_listening: l('듣기 집중 연습', 'Focus on listening'),
      focus_meaning: l('뜻 집중 연습', 'Focus on meaning'),
      focus_context: l('문장 속 쓰임 집중 연습', 'Focus on sentence use'),
      clear_focus: l('집중 연습 끝내기', 'End the focus'),
    })[a];
  const reasonText = (r: WmStepReason) =>
    ({
      inactive: l(`${r.days ?? 3}일 넘게 하지 않았어요`, `No study for ${r.days ?? 3}+ days`),
      low_accuracy: l(`최근 7일 정답률 ${r.pct ?? 0}%예요`, `7-day accuracy is ${r.pct ?? 0}%`),
      steady: l(`최근 7일 중 ${r.days ?? 5}일을 했고 정답률 ${r.pct ?? 90}%예요`, `Studied ${r.days ?? 5} of 7 days at ${r.pct ?? 90}% accuracy`),
      weak_skill: l(`틀린 것의 대부분이 ${skillName(r.skill)}이에요(${r.count ?? 0}번)`, `Most misses are ${skillName(r.skill)} (${r.count ?? 0})`),
      focus_improved: l(`${skillName(r.skill)}을 틀리는 일이 줄었어요`, `${skillName(r.skill)} misses have dropped`),
    })[r.code];

  async function apply(studentId: string, action: WmStepAction) {
    setBusy(studentId + action);
    try {
      await wmApplyStep(planId, studentId, action);
      notify(l('적용했어요. 내일 학습부터 바뀌어요.', 'Applied. It takes effect from the next session.'));
      await load('steps');
    } catch {
      notify(l('적용하지 못했어요. 다시 시도해 주세요.', 'Could not apply. Try again.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function makeTest(kind: 'section' | 'final' | 'hot') {
    if (!studentIds.length) return;
    setBusy('test-' + kind);
    try {
      let cards;
      let title: string;
      if (kind === 'section') {
        const from = (section - 1) * SECTION_SIZE + 1;
        cards = await wmPlanCards(planId, from, from + SECTION_SIZE - 1);
        title = `${planTitle || l('단어 암기', 'Word project')} · ${l(`${from}~${Math.min(from + SECTION_SIZE - 1, words)}번 시험`, `Check ${from}–${Math.min(from + SECTION_SIZE - 1, words)}`)}`;
      } else if (kind === 'final') {
        const [weak, all] = await Promise.all([wmPlanWeakCards(planId, 100), wmPlanCards(planId, 1, 1000)]);
        cards = pickFinalCards(weak, all);
        title = `${planTitle || l('단어 암기', 'Word project')} · ${l('최종 시험', 'Final test')}`;
      } else {
        const keys = new Set((brief?.hot_words ?? []).map((h) => h.key));
        cards = (await wmPlanCards(planId, 1, 1000)).filter((c) => keys.has(c.key));
        title = l('헷갈리는 낱말 확인', 'Tricky words check');
      }
      if (cards.length < 2) {
        notify(l('시험에 쓸 낱말이 모자라요.', 'Not enough words for a test.'), 'error');
        return;
      }
      const hw = await createCheckTest({ classId, studentIds, title, cards, en });
      notify(l(`시험 숙제를 냈어요(숙제 번호 ${hw.code}). 결과는 숙제 목록에서 봐요.`, `Test homework created (code ${hw.code}). See results in the homework list.`));
    } catch {
      notify(l('시험 숙제를 만들지 못했어요.', 'Could not create the test.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function copy(text: string, ok: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify(ok);
    } catch {
      notify(l('복사하지 못했어요.', 'Could not copy.'), 'error');
    }
  }

  const tabBtn = (id: Tab, label: string) => (
    <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-h-11 rounded-full px-4 text-sm font-bold ${tab === id ? 'bg-primary text-on-primary' : 'border border-outline-variant bg-white text-deep-navy'}`}>
      {label}
    </button>
  );
  const chip = 'rounded-full px-2 py-0.5 text-xs font-bold';
  const state = (s: string) =>
    s === 'done' ? { t: l('끝냄', 'Done'), c: 'bg-emerald-100 text-emerald-900' } : s === 'partial' || s === 'started' ? { t: l('하는 중', 'Partial'), c: 'bg-amber-100 text-amber-900' } : { t: l('안 함', 'Not yet'), c: 'bg-rose-100 text-rose-900' };

  return (
    <section className="space-y-3 rounded-xl bg-primary/5 p-3" data-wm-coach aria-label={l('프로젝트 코치', 'Project coach')}>
      <div className="flex flex-wrap items-center gap-2" role="tablist">
        {tabBtn('brief', l('오늘 브리핑', 'Morning brief'))}
        {tabBtn('steps', l('다음 단계 카드', 'Next steps'))}
        {tabBtn('progress', l('진행·시험', 'Progress & tests'))}
      </div>
      {error && <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-sm">{l('불러오지 못했어요. 새로고침해 주세요.', 'Could not load. Please refresh.')}</p>}

      {tab === 'brief' && (
        <div className="space-y-3">
          {!brief ? (
            <p className="text-sm text-on-surface-variant">{l('불러오는 중…', 'Loading…')}</p>
          ) : (
            <>
              <p className="text-sm">
                {l(`어제(${fmtDate(brief.yesterday, false)}) 끝낸 학생 `, `Finished yesterday: `)}
                <b>{brief.students.filter((s) => s.yesterday === 'done').length}/{brief.students.length}</b>
                {brief.students.some((s) => s.yesterday === 'none') && (
                  <>
                    {l(' · 안 한 학생: ', ' · Not done: ')}
                    <b>{brief.students.filter((s) => s.yesterday === 'none').map((s) => s.name).join(', ')}</b>
                  </>
                )}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead>
                    <tr className="text-on-surface-variant">
                      <th className="p-2">{l('이름', 'Name')}</th>
                      <th className="p-2">{l('어제', 'Yesterday')}</th>
                      <th className="p-2">{l('오늘', 'Today')}</th>
                      <th className="p-2">{l('연속', 'Streak')}</th>
                      <th className="p-2">{l('오늘 복습', 'Due')}</th>
                      <th className="p-2">{l('어려운 낱말', 'Hard')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brief.students.map((s) => (
                      <tr key={s.student_id} className="border-t border-outline-variant">
                        <td className="p-2 font-bold">{s.name}</td>
                        <td className="p-2"><span className={`${chip} ${state(s.yesterday).c}`}>{state(s.yesterday).t}</span>{s.answered_yesterday > 0 && <span className="ml-1 text-xs tabular-nums">{s.correct_yesterday}/{s.answered_yesterday}</span>}</td>
                        <td className="p-2"><span className={`${chip} ${state(s.today).c}`}>{state(s.today).t}</span></td>
                        <td className="p-2 tabular-nums">{l(`${s.streak_days}일`, `${s.streak_days}d`)}</td>
                        <td className="p-2 tabular-nums">{s.due_today}</td>
                        <td className="p-2 tabular-nums">{s.hard}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h4 className="font-bold text-deep-navy">{l('이번 주 반이 가장 헷갈린 낱말', 'Words the class missed most this week')}</h4>
                {brief.hot_words.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">{l('아직 틀린 낱말 기록이 없어요.', 'No missed words yet.')}</p>
                ) : (
                  <>
                    <ol className="mt-1 flex flex-wrap gap-2">
                      {brief.hot_words.map((h) => (
                        <li key={h.key} className="rounded-xl border border-outline-variant bg-white px-3 py-1 text-sm">
                          <b>{h.word}</b> <span className="text-on-surface-variant">{h.meaning}</span> <span className="text-xs tabular-nums">· {l(`${h.students}명 ${h.misses}번`, `${h.students} students, ${h.misses}×`)}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" className="min-h-11 rounded-xl border border-outline-variant bg-white px-4 text-sm font-bold" onClick={() => void copy(brief.hot_words.map((h) => `${h.word} ${h.meaning}`).join('\n'), l('낱말을 복사했어요. 수업 시작 3분에 칠판에 써 보세요.', 'Copied. Use them for a 3-minute opener.'))}>
                        {l('수업 시작 3분 확인용 복사', 'Copy for a 3-minute opener')}
                      </button>
                      <button type="button" disabled={busy !== null || closed} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-40" onClick={() => void makeTest('hot')}>
                        {l('이 낱말로 확인 숙제 내기', 'Assign a check on these words')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'steps' && (
        <div className="space-y-2">
          {!steps ? (
            <p className="text-sm text-on-surface-variant">{l('불러오는 중…', 'Loading…')}</p>
          ) : (
            <>
              <p className="text-sm text-on-surface-variant">{l('학생 기록으로 제안한 조정이에요. 누르기 전에는 아무것도 바뀌지 않아요.', 'Suggestions from each student record. Nothing changes until you apply.')}</p>
              {steps.every((s) => s.steps.length === 0 || s.steps.every((c) => dismissed.has(s.student_id + c.action))) && (
                <p className="rounded-lg bg-white px-3 py-2 text-sm">{l('오늘 제안할 조정이 없어요. 모두 잘 따라오고 있어요.', 'No suggestions today. Everyone is on track.')}</p>
              )}
              <ul className="space-y-2">
                {steps.map((s) => (
                  <li key={s.student_id} className="rounded-xl border border-outline-variant bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <b>{s.name}</b>
                      <span className={`${chip} bg-slate-100`}>{modeName(s.mode)}</span>
                      {s.focus && <span className={`${chip} bg-sky-100 text-sky-900`}>{l(`${skillName(s.focus)} 집중 중`, `Focus: ${skillName(s.focus)}`)}</span>}
                      <span className="text-xs text-on-surface-variant">{s.accuracy_7d === null ? l('최근 7일 기록 없음', 'No answers in 7 days') : l(`최근 7일 ${s.answers_7d}문제 · 정답률 ${s.accuracy_7d}%`, `7 days: ${s.answers_7d} Qs · ${s.accuracy_7d}%`)}</span>
                    </div>
                    {s.steps.filter((c) => !dismissed.has(s.student_id + c.action)).map((c) => (
                      <div key={c.action} className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-primary/5 px-3 py-2">
                        <span className="min-w-0 flex-1 text-sm"><b>{actionLabel(c.action)}</b> — {reasonText(c.reason)}</span>
                        <button type="button" disabled={busy !== null || closed} className="min-h-11 rounded-full bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-40" onClick={() => void apply(s.student_id, c.action)}>{l('적용', 'Apply')}</button>
                        <button type="button" className="min-h-11 rounded-full border border-outline-variant px-4 text-sm font-bold" onClick={() => setDismissed((d) => new Set(d).add(s.student_id + c.action))}>{l('지금은 안 해요', 'Not now')}</button>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {tab === 'progress' && (
        <div className="space-y-3">
          {!progress ? (
            <p className="text-sm text-on-surface-variant">{l('불러오는 중…', 'Loading…')}</p>
          ) : (
            <>
              <p className="text-sm">
                {l(`전체 ${progress.words}개 중 `, `Of ${progress.words} words, `)}<b>{progress.need_to_graduate}{l('개(95%)', ' (95%)')}</b>
                {l('를 "며칠 뒤에도 기억함"까지 졸업시키면 완성이에요. 목표 마감 ', ' must be graduated. Target end ')}<b>{fmtDate(progress.final_deadline, en)}</b>
              </p>
              <ul className="space-y-2">
                {progress.students.map((s) => {
                  const pct = progress.words ? Math.round((100 * s.kept) / progress.words) : 0;
                  const brs = brief?.students.find((b) => b.student_id === s.student_id);
                  return (
                    <li key={s.student_id} className="rounded-xl border border-outline-variant bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <b>{s.name}</b>
                        {s.completed ? <span className={`${chip} bg-emerald-100 text-emerald-900`}>{l('완성!', 'Done!')}</span> : s.pace.graduate_date ? (
                          <span className={`${chip} ${s.pace.on_track ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
                            {l(`지금 속도면 ${fmtDate(s.pace.graduate_date, false)} 완성 예상${s.pace.on_track ? '' : ' (마감을 넘어요)'}`, `Est. ${fmtDate(s.pace.graduate_date, true)}${s.pace.on_track ? '' : ' (past the end)'}`)}
                          </span>
                        ) : <span className={`${chip} bg-slate-100`}>{l('속도 계산 중', 'Pace pending')}</span>}
                        <span className="text-xs text-on-surface-variant tabular-nums">{l(`만남 ${s.met} · 졸업 ${s.kept} (${pct}%)`, `met ${s.met} · graduated ${s.kept} (${pct}%)`)}</span>
                        <button type="button" className="ml-auto min-h-11 rounded-full border border-outline-variant px-3 text-xs font-bold" onClick={() => void copy(parentSummary({ en, student: s.name, planTitle: planTitle || l('단어 암기', 'Word project'), words: progress.words, progress: s, streak: brs?.streak_days }), l('학부모용 요약을 복사했어요.', 'Parent summary copied.'))}>
                          {l('학부모 요약 복사', 'Copy parent summary')}
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2" aria-label={l('구간별 졸업', 'Graduation by section')}>
                        {s.sections.map((sec) => (
                          <div key={sec.n} className="text-xs" title={l(`${sec.from}~${sec.to}번`, `#${sec.from}–${sec.to}`)}>
                            <div className="flex justify-between"><span>{l(`${sec.n}구간`, `Sec ${sec.n}`)}</span><span className="tabular-nums">{sec.kept}/{sec.size}</span></div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-500" style={{ width: `${sec.size ? (100 * sec.kept) / sec.size : 0}%` }} /></div>
                            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-sky-400" style={{ width: `${sec.size ? (100 * sec.met) / sec.size : 0}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-on-surface-variant">{l('초록 = 졸업(며칠 뒤에도 기억함), 파랑 = 만난 낱말', 'Green = graduated, blue = met')}</p>
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3">
                <label className="text-sm font-bold">
                  {l('구간 시험', 'Section test')}{' '}
                  <select className="min-h-11 rounded-xl border border-outline-variant px-2" value={section} onChange={(e) => setSection(Number(e.target.value))}>
                    {Array.from({ length: sectionCount(progress.words) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{l(`${n}구간 (${(n - 1) * SECTION_SIZE + 1}~${Math.min(n * SECTION_SIZE, progress.words)}번)`, `Section ${n}`)}</option>
                    ))}
                  </select>
                </label>
                <button type="button" disabled={busy !== null || closed} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-40" onClick={() => void makeTest('section')}>{l('구간 시험 내기', 'Assign section test')}</button>
                <button type="button" disabled={busy !== null || closed} className="min-h-11 rounded-xl border border-outline-variant px-4 text-sm font-bold disabled:opacity-40" onClick={() => void makeTest('final')}>{l('최종 시험 내기', 'Assign final test')}</button>
              </div>
              <p className="text-xs text-on-surface-variant">{l('시험은 기존 숙제로 나가요(낱말마다 뜻·듣기·철자·빈칸 중 다른 방식). 졸업 못 한 낱말이 20개 이상이면 최종 시험은 그 낱말로, 아니면 전체에서 100개를 무작위로 골라요.', 'Tests are normal homework. The final test uses ungraduated words (20+), else a random 100.')}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
