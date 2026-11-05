import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {supabase} from '../../lib/supabase';
interface RunCoverage {
  runs:{source:string;runs:number;goal_items:number;unresolved_items:number}[];
  evidence:{source:string;outcomes:number;linked:number;version_matched:number;version_changed:number;origin_changed:number;unlinked:number;goal_linked:number}[];
}
export default function LearningRunCoverage(){
  const {i18n}=useTranslation();const en=i18n.language.startsWith('en');const l=(ko:string,english:string)=>en?english:ko;
  const [data,setData]=useState<RunCoverage|null>(null);const [status,setStatus]=useState('idle');
  async function load(){setStatus('loading');try{const{data:r,error}=await supabase.rpc('admin_learning_run_summary',{p_days:7});if(error){setStatus(error.code==='PGRST202'?'missing':'error');return;}setData(r as RunCoverage);setStatus('idle');}catch{setStatus('error');}}
  return <section className="space-y-3 rounded-2xl border border-outline-variant p-4" aria-labelledby="run-coverage-title"><h3 id="run-coverage-title" className="text-xl font-bold">{l('제공 버전과 학습 근거 연결','Delivery versions and learning evidence')}</h3><p className="text-sm text-on-surface-variant">{l('최근 7일 · 연결되지 않은 과거 기록이나 뜻이 불명확한 목표는 별도로 표시합니다. 연결 수는 교육 효과를 의미하지 않습니다.','Last 7 days. Legacy unlinked evidence and unresolved meanings remain separate. Coverage does not establish effectiveness.')}</p><button className="min-h-11 rounded-lg border border-outline-variant px-4" disabled={status==='loading'} onClick={()=>void load()}>{l('제공 버전 연결 조회','Load version coverage')}</button><p role="status">{status==='loading'?l('조회 중…','Loading…'):status==='missing'?l('제공 버전 DB가 아직 준비되지 않았습니다.','Delivery database is not ready.'):status==='error'?l('조회하지 못했습니다. 이전 결과는 갱신되지 않았습니다.','Unable to load. Previous results have not been refreshed.'):''}</p>
    {data&&<div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="text-left font-bold">{l('서버 채점 근거의 연결 상태','Server-graded evidence coverage')}</caption><thead><tr>{[l('경로','Source'),l('전체','Total'),l('버전 일치','Matched version'),l('버전 불일치','Version mismatch'),l('과거·미연결','Unlinked'),l('목표 연결','Linked goal')].map(x=><th key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{data.evidence.map(e=><tr key={e.source}><td className="p-2">{e.source}</td><td className="p-2">{e.outcomes}</td><td className="p-2">{e.version_matched}</td><td className="p-2">{e.version_changed}</td><td className="p-2">{e.unlinked}</td><td className="p-2">{e.goal_linked}</td></tr>)}</tbody></table><p className="mt-3 text-sm">{l('원본 수정 후에도 고정한 문제로 채점한 기록','Graded using frozen content after original edits')}: {data.evidence.reduce((n,e)=>n+e.origin_changed,0)}</p><p className="mt-2 text-sm">{l('뜻을 확정하지 못한 제공 문항','Delivered items with unresolved meanings')}: {data.runs.reduce((n,r)=>n+r.unresolved_items,0)}</p></div>}
  </section>;
}
