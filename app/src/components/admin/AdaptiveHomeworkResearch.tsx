import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {adaptiveHomeworkResearch,AdaptiveHomeworkError,type HomeworkResearch} from '../../lib/homework/adaptive';

export default function AdaptiveHomeworkResearch(){
 const {i18n}=useTranslation(),en=i18n.language.startsWith('en');const l=(ko:string,english:string)=>en?english:ko;
 const [days,setDays]=useState(30),[report,setReport]=useState<HomeworkResearch|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){setBusy(true);setError('');setReport(null);try{setReport(await adaptiveHomeworkResearch(days));}catch(e){setError(e instanceof AdaptiveHomeworkError&&e.kind==='missing'?'missing':'error');}finally{setBusy(false);}}
 return <details className="rounded-2xl border border-outline-variant bg-white p-4 md:p-6"><summary className="cursor-pointer text-lg font-bold">{l('맞춤 단어 숙제 분석','Adaptive homework research')}</summary>
  <div className="mt-4 space-y-4"><p>{l('교사가 승인한 맞춤 단어 숙제만 따로 봅니다. 같은 학생이 여러 단어와 배정에 포함될 수 있습니다.','Only teacher-approved adaptive homework. A student may contribute several assignments and words.')}</p>
  <div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm font-bold">{l('승인 기간','Approval window')}<select aria-label={l('숙제 승인 기간','Homework approval window')} className="min-h-11 rounded-xl border px-3" value={days} disabled={busy} onChange={e=>{setDays(Number(e.target.value));setReport(null);setError('');}}>{[7,30,90].map(n=><option key={n} value={n}>{l(`최근 ${n}일`,`Last ${n} days`)}</option>)}</select></label><button className="min-h-11 rounded-xl bg-primary px-4 font-bold text-white disabled:opacity-50" disabled={busy} onClick={()=>void load()}>{busy?l('조회 중…','Loading…'):l('맞춤 숙제 분석 조회','Analyze adaptive homework')}</button></div>
  {error&&<p role="alert">{error==='missing'?l('맞춤 숙제 분석이 아직 서버에 준비되지 않았습니다.','Adaptive homework research is not ready on the server.'):l('조회하지 못했습니다. 연결과 관리자 인증을 확인해 주세요.','Could not load. Check the connection and administrator authentication.')}</p>}
  {report&&<>
   {!report.protection_intact&&<p role="alert">{l('맞춤 숙제 보호 설정이 바뀌었습니다. 운영 설정을 점검하세요.','Adaptive homework protection changed. Review the server configuration.')}</p>}
   <p className="font-bold">{l(`계획 ${report.plans} · 배정 ${report.assignments} · 학생 ${report.students}명 · 첫 학습 완료 ${report.first_completed}`,`${report.plans} plans · ${report.assignments} assignments · ${report.students} students · ${report.first_completed} initial completions`)}</p>
   <p>{l(`활동 센서가 있는 배정 ${report.observed_assignments} · 연결된 서버 채점 ${report.grading_links}`,`${report.observed_assignments} assignments with activity sensors · ${report.grading_links} linked grades`)}</p>
   {report.rounds.length?<div className="grid gap-3 sm:grid-cols-2">{report.rounds.map(r=><article key={r.round} className="rounded-xl bg-surface-container-low p-4"><h3 className="font-bold">{l(`${r.round}차 지연 확인`,`Delayed check ${r.round}`)}</h3><p>{l(`응답 중 정답 ${r.correct}/${r.answered} · 기한 도래 중 응답 ${r.answered}/${r.due}`,`${r.correct}/${r.answered} correct among responses · ${r.answered}/${r.due} due answered`)}</p><p className="text-sm">{l(`기한 후 미응답 ${r.missing} · 기한 전 ${r.not_due} · 예약 전 ${r.not_scheduled}`,`${r.missing} due and missing · ${r.not_due} not due · ${r.not_scheduled} not scheduled`)}</p></article>)}</div>:<p>{l('이 기간에 승인된 맞춤 숙제가 없습니다.','No adaptive homework was approved in this window.')}</p>}
   <p className="text-sm text-on-surface-variant">{l('지연 지표는 배정·단어 기준입니다. 미응답은 오답이 아니며, 센서가 없으면 시간과 도움은 미상입니다. 이 집계만으로 효과를 판단하지 않습니다.','Delayed metrics count assignment–word observations. Missing responses are not wrong; time and help remain unknown without sensors. These counts do not establish effectiveness.')}</p>
  </>}
  </div>
 </details>;
}
