import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LearningSensorsPanel from '../components/admin/LearningSensorsPanel';
import AdaptiveHomeworkResearch from '../components/admin/AdaptiveHomeworkResearch';
import {
  fetchResearch, fetchResearchRecords, fraction, researchInsights, ResearchError, saveResearchDecision,
  type ResearchCohort, type ResearchDecision, type ResearchFocus, type ResearchRecord, type ResearchReport, type ResearchSave,
} from '../lib/learningResearch';

const box = 'rounded-2xl border border-outline-variant bg-white p-4 md:p-6';
const input = 'min-h-11 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-on-surface disabled:opacity-60';
const button = 'min-h-11 rounded-xl bg-primary px-4 py-2 font-bold text-white disabled:opacity-50';

export default function AdminLearningPage() {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const l = (ko: string, english: string) => en ? english : ko;
  const [days, setDays] = useState(30);
  const [academy, setAcademy] = useState('');
  const [scopes, setScopes] = useState<ResearchReport['scopes']>([]);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [records, setRecords] = useState<ResearchRecord[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'missing' | 'denied' | 'error' | 'changed'>('idle');
  const [focus, setFocus] = useState<ResearchFocus>('measurement');
  const [decision, setDecision] = useState<ResearchDecision>('investigate');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'uncertain' | 'changed' | 'denied'>('idle');
  const [historyError, setHistoryError] = useState(false);
  const generation = useRef(0);
  const pending = useRef<ResearchSave | null>(null);
  useEffect(() => () => { generation.current++; }, []);
  const locked = saving || saveStatus === 'uncertain';
  const focusLabel = (v: ResearchFocus) => ({ measurement:l('수집·근거 품질','Evidence quality'), participation:l('지연 확인 참여','Delayed participation'), practice:l('연습·피드백','Practice and feedback'), curriculum:l('수업 구성 비교','Lesson comparison') })[v];
  const decisionLabel = (v: ResearchDecision) => ({ investigate:l('원인 점검','Investigate'), compare:l('비교 검증 준비','Prepare comparison'), hold:l('변경 보류·더 관찰','Hold and observe') })[v];
  const baselineLabel = (c: Pick<ResearchCohort,'baseline'>) => c.baseline === 'known' ? l('진단 정답','Correct at diagnosis') : c.baseline === 'needs_practice' ? l('진단 오답','Incorrect at diagnosis') : l('진단 미상','Unknown diagnosis');
  const practiceLabel = (v: string) => v === 'letters' ? l('글자 조합','Letter arrangement') : l('직접 회상 쓰기','Written recall');
  const date = (v: string) => new Date(v).toLocaleString(en ? 'en-US' : 'ko-KR');

  function changeScope() {
    generation.current++; setReport(null); setRecords([]); setStatus('idle'); setSaveStatus('idle'); setHistoryError(false);
  }
  async function load() {
    if (locked) return;
    const ticket = ++generation.current;
    setStatus('loading'); setReport(null); setRecords([]); setSaveStatus('idle'); setHistoryError(false);
    try {
      const [r, history] = await Promise.all([fetchResearch(days, academy || null), fetchResearchRecords(days, academy || null)]);
      if (ticket !== generation.current) return;
      setReport(r); setScopes(r.scopes); setRecords(history); setStatus('idle');
    } catch (e) {
      if (ticket === generation.current) setStatus(e instanceof ResearchError ? e.kind : 'error');
    }
  }
  async function save() {
    if (!report || saving) return;
    const request = pending.current ?? {
      p_request: crypto.randomUUID(), p_days: report.days, p_academy: report.academy_id,
      p_focus: focus, p_decision: decision, p_note: note, p_evidence_hash: report.evidence_hash,
    };
    pending.current = request; setSaving(true); setSaveStatus('idle');
    try {
      await saveResearchDecision(request);
      pending.current = null; setSaveStatus('saved');
      try { setRecords(await fetchResearchRecords(report.days, report.academy_id)); setHistoryError(false); }
      catch { setHistoryError(true); }
    } catch (e) {
      if (e instanceof ResearchError && (e.kind === 'changed' || e.kind === 'denied' || e.kind === 'missing')) {
        pending.current = null;
        setSaveStatus(e.kind === 'changed' ? 'changed' : 'denied');
        if (e.kind === 'changed') { setReport(null); setStatus('changed'); }
      } else setSaveStatus('uncertain');
    } finally { setSaving(false); }
  }
  const insights = report ? researchInsights(report) : [];
  return <div className="min-w-0 space-y-6">
    <header className="rounded-3xl bg-deep-navy px-5 py-7 text-white md:px-8">
      <p className="text-sm font-bold text-white/70">{l('클래스뱅크 · 학습 연구실','Classbank · Learning research')}</p>
      <h1 className="mt-2 break-keep text-3xl font-black">{l('더 잘 배우는 수업을 찾는 곳','Find lessons that help learners')}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/85">{l('실제 학습 결과와 필요한 연습, 이후 기억을 함께 확인하고 다음 검증 방향을 정합니다. 교사의 추가 기록 없이 수업·숙제·학생 수행에서 모은 근거를 사용합니다.','Review outcomes, practice and later recall together to choose what to validate next. Evidence comes from normal teaching and learning, without extra teacher records.')}</p>
      <p className="mt-4 inline-block rounded-full bg-white/15 px-3 py-1 text-sm">{l('어휘 회상 v1 · 관찰 분석','Vocabulary recall v1 · observational analysis')}</p>
    </header>

    <section className={box} aria-labelledby="research-scope">
      <h2 id="research-scope" className="text-lg font-bold">{l('분석할 배정 집단','Assignment cohort')}</h2>
      <p className="mt-1 text-sm text-on-surface-variant">{l('선택한 기간에 만들어진 학습 계획의 배정을 추적합니다. 그 이후의 확인 결과도 포함합니다. 일별 접속 통계와 집계 기준이 다릅니다.','Track assignments from plans created in the selected window, including their subsequent checks. This differs from daily activity counts.')}</p>
      <fieldset disabled={locked || status === 'loading'} className="mt-4 flex min-w-0 flex-wrap items-end gap-3">
        <label className="min-w-32 flex-1 text-sm font-bold">{l('계획 생성 기간','Plan creation window')}<select className={`${input} mt-1`} aria-label={l("계획 생성 기간","Plan creation window")} value={days} onChange={e=>{setDays(Number(e.target.value));changeScope();}}>{[7,30,90].map(d=><option value={d} key={d}>{l(`최근 ${d}일`,`Last ${d} days`)}</option>)}</select></label>
        <label className="min-w-40 flex-[2] text-sm font-bold">{l('학원 범위','Academy scope')}<select className={`${input} mt-1`} aria-label={l("학원 범위","Academy scope")} value={academy} onChange={e=>{setAcademy(e.target.value);changeScope();}}><option value="">{l('전체 학원','All academies')}</option>{scopes.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <button className={button} onClick={()=>void load()}>{status === 'loading' ? l('분석 중…','Analysing…') : l('학습 분석 조회','Load learning analysis')}</button>
      </fieldset>
      {status !== 'idle' && <p role="status" className="mt-3 text-sm">{status === 'loading' ? l('서버 채점과 지연 확인 기록을 연결하고 있습니다.','Linking graded responses and delayed checks.') : status === 'missing' ? l('학습 분석 DB가 아직 준비되지 않았습니다. 스테이징에서 097~100 적용을 확인하세요.','Learning research is not ready. Verify migrations 097–100 in staging.') : status === 'denied' ? l('학습 분석은 플랫폼 관리자만 조회할 수 있습니다.','Only platform admins can access research.') : status === 'changed' ? l('검토 중 근거가 달라졌습니다. 분석을 다시 조회한 뒤 결정하세요.','Evidence changed during review. Reload before deciding.') : l('분석을 불러오지 못했습니다. 연결과 권한을 확인하고 다시 조회하세요.','Unable to load analysis. Check connection and permissions, then retry.')}</p>}
      {!report && status === 'idle' && <p className="mt-3 text-sm text-on-surface-variant">{l('조회하면 현재 근거와 자동 점검 제안을 볼 수 있습니다.','Load the report to see current evidence and automatic review suggestions.')}</p>}
    </section>

    {report && <>
      <div className="flex flex-wrap justify-between gap-2 text-sm text-on-surface-variant"><p>{l('분석 시각','As of')}: {date(report.generated_at)}</p><p>{l('서로 다른 학생','Distinct students')}: {report.overview.students} · {l('계획','Plans')}: {report.overview.plans}</p></div>
      {!report.overview.assignments && <p role="status" className={box}>{l('선택한 집단에 배정 기록이 없습니다. 학습 효과를 계산할 근거가 아직 없습니다.','There are no assignments in this cohort yet. Learning effectiveness cannot be estimated.')}</p>}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={l('학습 진행 현황','Learning progress')}>
        {[
          [l('배정','Assigned'),report.overview.assignments,l('학생별 배정 수','Student assignments')],
          [l('시작','Started'),report.overview.started,l('실제 경로를 연 배정','Opened assignments')],
          [l('첫 학습 완료','Initial learning complete'),report.overview.first_completed,l('지연 확인은 별도','Delayed checks follow')],
          [l('계획 확인 완료','All checks complete'),report.overview.finished,l('참여 완료이며 숙달 보장은 아님','Participation, not guaranteed mastery')],
        ].map(([title,n,caption])=><div key={title} className={box}><h2 className="text-sm font-bold text-on-surface-variant">{title}</h2><p className="mt-2 text-3xl font-black text-deep-navy">{n}</p><p className="mt-2 text-xs text-on-surface-variant">{caption}</p></div>)}
      </section>

      <section className={box} aria-labelledby="delayed-title">
        <h2 id="delayed-title" className="break-keep text-xl font-bold">{l('시간을 둔 뒤 다시 기억했는가','Recall after a delay')}</h2>
        <p className="mt-2 text-sm text-on-surface-variant">{l('학생별 배정·단어·확인 차수 조합을 셉니다. 정답률의 분모는 실제 응답, 참여율의 분모는 기한이 도래한 확인입니다. 미응답은 오답으로 넣지 않습니다. 1일/7일은 초깃값입니다.','Counts are assignment–word–round observations for each learner. Correctness uses actual answers; participation uses due checks. Missing responses are not incorrect answers. 1/7-day intervals are initial defaults.')}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">{report.rounds.map(r=><article key={r.round} className="min-w-0 rounded-xl bg-surface-container-low p-4">
          <h3 className="font-bold">{r.round === 1 ? l('첫 지연 확인 · 약 1일 이후','First delayed check · ~1+ day') : l('두 번째 지연 확인 · 약 7일 이후','Second delayed check · ~7+ days')}</h3>
          <p className="mt-3 text-sm">{l('응답 중 정답','Correct among answers')}: <strong>{fraction(r.correct,r.answered)}</strong></p>
          <div className="mt-2 h-2 rounded-full bg-outline-variant" role="meter" aria-label={l(`${r.round}차 응답 중 정답률`,`Round ${r.round} correctness`)} aria-valuenow={r.answered ? Math.round(r.correct/r.answered*100) : 0} aria-valuemin={0} aria-valuemax={100} aria-valuetext={r.answered ? `${Math.round(r.correct/r.answered*100)}%` : l("관측 없음","Not observed")}><div className="h-full rounded-full bg-primary" style={{width:`${r.answered ? r.correct/r.answered*100 : 0}%`}}/></div>
          <p className="mt-3 text-sm">{l('기한 도래 중 참여','Participation among due checks')}: {fraction(r.answered,r.due)}</p>
          <p className="mt-2 text-sm">{l('기한 도래 후 미응답','Due, unanswered')}: <strong>{r.missing}</strong> · {l('기한 전','Not due')}: {r.not_due} · {l('아직 예약 전','Not scheduled')}: {r.not_scheduled}</p>
          <p className="mt-2 text-xs text-on-surface-variant">{l('실제 경과 일수 · 단어의 초기 확인 이후','Observed days since the word’s initial check')}: {r.min_elapsed_days == null ? l('관측 없음','Not observed') : `${Number(r.min_elapsed_days).toFixed(1)}–${Number(r.max_elapsed_days).toFixed(1)}`}</p>
        </article>)}</div>
      </section>

      <section className={box} aria-labelledby="cohort-title">
        <h2 id="cohort-title" className="break-keep text-xl font-bold">{l('비슷한 출발점에서 연습 방식 살펴보기','Review practice by starting point')}</h2>
        <p className="mt-2 text-sm text-on-surface-variant">{l('진단 정오별로 나눈 관찰 집계입니다. 같은 단어를 배웠거나 난도·교사·학생 조건이 같다는 뜻은 아닙니다. 같은 학생의 여러 단어와 반복 배정도 포함되므로 표본을 독립된 학생 수로 해석하지 않습니다.','These are observational groups by diagnostic result. Content, difficulty, teachers and learner conditions can differ. Words and repeat assignments from one learner are not independent learners.')}</p>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">{report.cohorts.map(c=><article className="min-w-0 rounded-xl border border-outline-variant p-4" key={`${c.practice}-${c.baseline}`}>
          <h3 className="font-bold">{practiceLabel(c.practice)} · {baselineLabel(c)}</h3>
          <p className="mt-1 text-xs text-on-surface-variant">{l('학생','Students')} {c.students} · {l('배정·단어 사례','Assignment–word observations')} {c.goal_units} · {l('계획','Plans')} {c.plans} · {l('제공 내용 버전','Content versions')} {c.versions}</p>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-on-surface-variant">{l('독립 확인 첫 답','First initial check')}</dt><dd className="font-bold">{fraction(c.first_correct,c.first_checked)}</dd></div>
            <div><dt className="text-on-surface-variant">{l('재학습 포함 최종 초기 확인','Final initial check, including relearning')}</dt><dd className="font-bold">{fraction(c.final_correct,c.final_checked)}</dd></div>
            <div><dt className="text-on-surface-variant">{l('첫 지연 확인 정답','First delayed correctness')}</dt><dd className="font-bold">{fraction(c.d1_correct,c.d1_answered)}</dd></div>
            <div><dt className="text-on-surface-variant">{l('두 번째 지연 확인 정답','Second delayed correctness')}</dt><dd className="font-bold">{fraction(c.d2_correct,c.d2_answered)}</dd></div>
            <div><dt className="text-on-surface-variant">{l('진단 응답 조합당 연습 응답','Practice answers per diagnosed pair')}</dt><dd className="font-bold">{c.practice_denominator ? (c.practice_answers/c.practice_denominator).toFixed(1) : '—'}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-on-surface-variant">{l('지연 응답','Delayed answers')}: {c.d1_answered}+{c.d2_answered} · {l('적은 표본과 미응답을 확인하고 우열 판단을 보류하세요.','Review sample size and nonresponse before making comparisons.')}</p>
        </article>)}</div>
        <p className="mt-4 text-sm font-bold">{l('새 문항·새 상황으로의 전이는 아직 측정하지 않습니다. 이 화면의 기억 확인은 같은 단어를 다시 묻습니다.','Transfer to new items or situations is not measured yet. These checks ask about the same words.')}</p>
      </section>

      <details className={box}>
        <summary className="cursor-pointer text-xl font-bold">{l('제공 내용 버전별 근거 비교','Compare evidence by delivered content version')}</summary>
        <p className="mt-3 text-sm text-on-surface-variant">{l('실제로 제공한 내용의 지문과 진단 결과별 집계입니다. 배정·단어 사례 수가 많은 최대 30행을 표시합니다. 정답률 순위가 아니며 서로 다른 내용의 난도 차이는 보정하지 않았습니다.','Grouped by delivered-content fingerprint and baseline. Up to 30 rows with the most assignment–word observations; this is not an effectiveness ranking or difficulty adjustment.')}</p>
        {report.versions_truncated && <p className="mt-2 text-sm font-bold">{l('표시 범위를 넘었습니다. 학원이나 기간을 좁혀 확인하세요.','More rows are available. Narrow the academy or time window.')}</p>}
        {!report.content_versions.length && <p className="mt-3 text-sm">{l('실제로 제공한 버전이 아직 없습니다.','No delivered content versions yet.')}</p>}
        {!!report.content_versions.length && <p className="mt-3 text-xs text-on-surface-variant sm:hidden">{l('표를 좌우로 밀어 나머지 지표를 확인하세요.','Scroll the table horizontally to view the remaining measures.')}</p>}
        {!!report.content_versions.length && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[44rem] text-left text-sm"><caption className="sr-only">{l('버전별 진단 집단과 후속 확인','Content versions, baseline groups and follow-up checks')}</caption><thead><tr>{[l('수업·내용 버전','Lesson / content version'),l('방식·진단','Practice / diagnosis'),l('학생 / 사례','Learners / observations'),l('첫 / 최종 초기 확인','First / final initial check'),l('1차 / 2차 지연 정답','First / second delayed correctness')].map(x=><th className="p-2 align-top" key={x}>{x}</th>)}</tr></thead><tbody>{report.content_versions.map(v=><tr className="border-t border-outline-variant" key={`${v.fingerprint}-${v.baseline}`}><td className="max-w-52 break-words p-2"><p>{v.title}</p><code className="text-xs text-on-surface-variant" title={v.fingerprint}>{v.fingerprint.slice(0,12)}</code></td><td className="p-2">{practiceLabel(v.practice)}<br/>{baselineLabel(v)}</td><td className="p-2">{v.students} / {v.goal_units}</td><td className="p-2">{fraction(v.first_correct,v.first_checked)}<br/>{fraction(v.final_correct,v.final_checked)}</td><td className="p-2">{fraction(v.d1_correct,v.d1_answered)}<br/>{fraction(v.d2_correct,v.d2_answered)}</td></tr>)}</tbody></table></div>}
      </details>

      <section className={box} aria-labelledby="quality-title">
        <h2 id="quality-title" className="break-keep text-xl font-bold">{l('근거 품질과 관측 범위','Evidence quality and observation limits')}</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">{[
          [l('서버 채점 응답','Graded answers'),report.quality.answers], [l('미연결 응답','Unlinked answers'),report.quality.unlinked_answers],
          [l('버전 불일치 응답','Version mismatch'),report.quality.mismatched_answers], [l('목표 미해결 문항','Unresolved goal items'),report.quality.unresolved_goals],
          [l('활동 센서가 있는 배정','Assignments with telemetry'),`${report.quality.observed_runs}/${report.overview.started}`],
          [l('관측 화면 노출 분','Observed visible minutes'),(report.quality.visible_ms/60000).toFixed(1)],
          [l('힌트 버튼 기록','Hint events'),report.quality.hint_events], [l('도움 요청 버튼 기록','Help-request events'),report.quality.help_requests],
        ].map(([title,n])=><div key={title}><dt className="text-sm text-on-surface-variant">{title}</dt><dd className="mt-1 text-xl font-bold">{n}</dd></div>)}</dl>
        <p className="mt-4 text-sm text-on-surface-variant">{l('센서가 없는 배정은 시간·도움을 0으로 간주하지 않습니다. 화면 노출은 집중이나 순수 학습 시간이 아니며 여러 탭이 겹칠 수 있습니다. 외부 도움과 실제 교사 개입은 관측하지 못합니다.','Missing telemetry is not zero time or zero help. Visible time is not attention or pure learning time and tabs may overlap. Outside help and actual teacher intervention are unknown.')}</p>
        <p className="mt-3 text-sm">{l('교사 추천 처리','Teacher recommendation decisions')}: {l('추가 배정','Assigned')} {report.feedback.assigned} · {l('건너뛰기','Skipped')} {report.feedback.dismissed} · {l('연습 방식 변경 후 배정','Assigned with changed practice')} {report.feedback.changed_practice}</p>
        <p className="mt-1 text-xs text-on-surface-variant">{l('교사의 선택은 학습 효과의 증거와 구분합니다.','Teacher choices are separate from evidence of effectiveness.')}</p>
        {!!report.protection.length && <p role="alert" className="mt-3 break-words rounded-xl bg-error-container p-3 text-sm text-on-error-container">{l('학습 경로 호환성 점검 필요','Path compatibility needs review')}: {report.protection.join(', ')}</p>}
      </section>

      <section className={box} aria-labelledby="insights-title">
        <h2 id="insights-title" className="break-keep text-xl font-bold">{l('자동 분석 · 다음에 확인할 것','Automatic review suggestions')}</h2>
        <ul className="mt-4 space-y-3">{insights.map(i=><li className="flex flex-col items-start justify-between gap-3 rounded-xl bg-surface-container-low p-4 sm:flex-row" key={i.key}><div className="min-w-0 flex-1"><p className="text-xs font-bold text-primary">{focusLabel(i.focus)}</p><p className="mt-1 text-sm leading-relaxed">{en ? i.en : i.ko}</p></div><button disabled={locked} className="min-h-11 shrink-0 rounded-xl border border-outline-variant px-3 text-sm font-bold disabled:opacity-50" onClick={()=>{setFocus(i.focus);setNote(en ? i.en : i.ko);setSaveStatus('idle');}}>{l('검토 대상으로 선택','Select for review')}</button></li>)}</ul>
        <p className="mt-4 text-sm text-on-surface-variant">{l('현재 관측을 기준으로 생성한 점검 제안입니다. 최적 교수법 판정이나 학생 숙제 자동 배정은 실행하지 않습니다.','Suggestions are generated from current observations. They do not establish an optimal method or automatically assign student work.')}</p>
      </section>

      <section className={box} aria-labelledby="decision-title">
        <h2 id="decision-title" className="break-keep text-xl font-bold">{l('다음 검증 방향 기록','Record the next review direction')}</h2>
        <p className="mt-2 text-sm text-on-surface-variant">{l('운영자의 검토 기록입니다. 수업·복습 간격·학생 배정을 바꾸지 않습니다. 저장 시 현재 보고서의 집계 근거를 함께 보관합니다.','This is an admin review record. It does not change lessons, intervals or assignments. The reviewed evidence is saved with the decision.')}</p>
        <fieldset disabled={locked} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold">{l('검토 영역','Review area')}<select className={`${input} mt-1`} aria-label={l("검토 영역","Review area")} value={focus} onChange={e=>{setFocus(e.target.value as ResearchFocus);setSaveStatus('idle');}}>{(['measurement','participation','practice','curriculum'] as const).map(f=><option key={f} value={f}>{focusLabel(f)}</option>)}</select></label>
          <label className="text-sm font-bold">{l('진행 방향','Direction')}<select className={`${input} mt-1`} aria-label={l("진행 방향","Direction")} value={decision} onChange={e=>{setDecision(e.target.value as ResearchDecision);setSaveStatus('idle');}}>{(['investigate','compare','hold'] as const).map(d=><option value={d} key={d}>{decisionLabel(d)}</option>)}</select></label>
          <label className="text-sm font-bold sm:col-span-2">{l('검토 메모 · 선택','Review note · optional')}<textarea aria-label={l("검토 메모 · 선택","Review note · optional")} maxLength={1000} rows={3} className={`${input} mt-1`} value={note} onChange={e=>{setNote(e.target.value);setSaveStatus('idle');}} placeholder={l('자동 제안을 선택하거나 다음에 확인할 내용을 남기세요. 학생 이름·열쇠는 넣지 마세요.','Select a suggestion or note the next question. Do not include student names or access keys.')}/></label>
        </fieldset>
        <button className={`${button} mt-4`} disabled={saving || saveStatus === 'saved'} onClick={()=>void save()}>{saving ? l('저장 확인 중…','Confirming…') : saveStatus === 'uncertain' ? l('같은 요청으로 저장 확인','Confirm the same save request') : l('검토 방향과 근거 저장','Save direction and evidence')}</button>
      </section>
    </>}

    {saveStatus !== 'idle' && <p role="status" className={box}>{saveStatus === 'saved' ? l('검토 방향과 당시 집계 근거를 저장했습니다. 학생 수업과 배정은 변경되지 않았습니다.','Direction and evidence saved. Lessons and assignments are unchanged.') : saveStatus === 'uncertain' ? l('저장 여부를 확인하지 못했습니다. 입력을 유지한 채 같은 요청으로 다시 확인하세요.','Save confirmation is unavailable. Keep the inputs and retry the same request.') : saveStatus === 'changed' ? l('분석 근거가 바뀌어 저장하지 않았습니다. 다시 조회해 검토하세요.','Evidence changed; the decision was not saved. Reload and review.') : l('저장 권한 또는 DB 준비 상태를 확인하세요.','Check save permissions and database readiness.')}</p>}

    {report && <section className={box} aria-labelledby="history-title"><h2 id="history-title" className="break-keep text-xl font-bold">{l('검토 이력 · 현재 집단의 최근 25건','Review history · latest 25 for this scope')}</h2>
      {historyError && <p role="status" className="mt-3 text-sm">{l('저장은 완료됐지만 이력을 갱신하지 못했습니다. 분석을 다시 조회해 확인하세요.','Saved, but history could not be refreshed. Reload to confirm.')}</p>}
      {!records.length && <p className="mt-3 text-sm text-on-surface-variant">{l('아직 저장한 검토 방향이 없습니다.','No review directions saved yet.')}</p>}
      <ul className="mt-3 space-y-3">{records.map(r=><li className="rounded-xl border border-outline-variant p-4" key={r.request_id}><p className="text-sm font-bold">{focusLabel(r.focus)} · {decisionLabel(r.decision)}</p><p className="mt-1 text-xs text-on-surface-variant">{date(r.created_at)}</p>{r.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{r.note}</p>}<details className="mt-3 text-sm"><summary className="cursor-pointer font-bold">{l('결정 당시 근거 보기','View evidence at decision time')}</summary><p className="mt-2">{l('분석 시각','Report time')}: {date(r.evidence.generated_at)}</p><p>{l('배정','Assignments')} {r.evidence.overview.assignments} · {l('학생','Students')} {r.evidence.overview.students} · {l('초기 완료','Initial completions')} {r.evidence.overview.first_completed}</p><ul>{r.evidence.rounds.map(x=><li key={x.round}>{l(`${x.round}차 지연 확인`,`Delayed round ${x.round}`)}: {l('정답/응답','Correct/answered')} {fraction(x.correct,x.answered)} · {l('미응답','Missing')} {x.missing}</li>)}</ul></details></li>)}</ul>
    </section>}

    <AdaptiveHomeworkResearch/>
    <details className={box}><summary className="cursor-pointer text-lg font-bold">{l('전체 서비스의 센서 수집·연결 상태','Cross-service collection and evidence coverage')}</summary><div className="mt-5"><LearningSensorsPanel/></div></details>
  </div>;
}
