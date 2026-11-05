import {useCallback,useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {adaptiveHomeworkSummary,AdaptiveHomeworkError,type AdaptiveHomeworkPlan} from '../../../lib/homework/adaptive';

export default function AdaptiveHomeworkResults({classId,revision}:{classId:string;revision:number}){
 const {i18n}=useTranslation(),en=i18n.language.startsWith('en');const l=(ko:string,english:string)=>en?english:ko;
 const [plans,setPlans]=useState<AdaptiveHomeworkPlan[]>([]),[error,setError]=useState(false),[hidden,setHidden]=useState(false),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{setLoading(true);setError(false);try{setPlans((await adaptiveHomeworkSummary(classId)).plans);setHidden(false);}catch(e){if(e instanceof AdaptiveHomeworkError&&e.kind==='missing')setHidden(true);else setError(true);}finally{setLoading(false);}},[classId]);
 useEffect(()=>{void load();},[load,revision]);
 if(hidden||(!plans.length&&!error))return null;
 const date=(value:string)=>new Date(value).toLocaleString(en?'en-US':'ko-KR',{month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'});
 return <section aria-label={l('맞춤 단어 숙제 진행','Adaptive homework progress')} className="space-y-4 rounded-3xl border border-outline-variant bg-white p-4 sm:p-6">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{l('맞춤 단어 숙제 진행','Adaptive homework progress')}</h2><p className="text-sm text-on-surface-variant">{l('첫 학습을 끝낸 학생과 이후 기억 확인을 따로 봅니다.','Initial completion and later memory checks are separate.')}</p></div><button className="min-h-11 rounded-full border px-4" disabled={loading} onClick={()=>void load()}>{l('새로고침','Refresh')}</button></header>
  {error&&<p role="alert">{l('진행 상황을 불러오지 못했어요. 다시 조회해 주세요.','Could not load progress. Try again.')}</p>}
  {plans.map(p=><details className="rounded-2xl bg-surface-container-low p-4" key={p.lesson_id}><summary className="cursor-pointer"><b>{p.name}</b><span className="mt-1 block text-sm">{l(`${p.words}단어 · 첫 학습 ${p.first_completed}/${p.assigned}명 · 복습 확인 ${p.delayed_answered}건 응답`,`${p.words} words · Initial learning ${p.first_completed}/${p.assigned} students · ${p.delayed_answered} review responses`)}</span></summary>
    {p.initial_due_at&&<p className="mt-3 text-sm">{l('첫 학습 기한: ','Initial deadline: ')}{date(p.initial_due_at)}</p>}
    <ul className="mt-3 grid gap-2 sm:grid-cols-2">{p.students.map(s=><li key={s.assignment_id} className="rounded-xl bg-white p-3"><b>{s.name}</b><p className="text-sm">{s.finished?l('계획한 확인 완료','Planned checks complete'):s.waiting&&s.due_at?l('첫 학습 완료 · 다음 확인 ','Initial learning complete · Next check ')+date(s.due_at):s.first_completed?l('복습 확인 가능','Review available'):s.started?l('첫 학습 진행 중','Initial learning in progress'):l('아직 시작하지 않음','Not started')}</p></li>)}</ul>
    <p className="mt-3 text-sm text-on-surface-variant">{l(`복습 응답 중 정답 ${p.delayed_correct}/${p.delayed_answered}. 확인일 전이거나 미응답인 항목은 오답에 포함하지 않습니다.`,`Correct among review responses: ${p.delayed_correct}/${p.delayed_answered}. Future and missing reviews are excluded from accuracy.`)}</p>
  </details>)}
  {plans.length===30&&<p className="text-sm">{l('최근 배정한 30개 숙제를 보여 줍니다.','Showing the most recent 30 assignments.')}</p>}
 </section>;
}
