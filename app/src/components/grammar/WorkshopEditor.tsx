import { useState, type Dispatch, type SetStateAction } from 'react';
import { extensionPool, type Workshop, type ExtensionQuestion } from '../../../../supabase/functions/_shared/grammarWorkshop';
import type { GrammarBoardContent } from '../../lib/grammar';

export function GradeSettings({grade,count,max,onChange,disabled=false}:{grade:number;count:number;max:number;onChange:(grade:number,count:number)=>void;disabled?:boolean}) {
  return <fieldset disabled={disabled} className="flex flex-wrap items-center gap-3">
    <label>대상 학년 <select value={grade} onChange={e=>onChange(Number(e.target.value),count)}>
      {Array.from({length:12},(_,i)=>i+1).map(g=><option key={g} value={g}>{g<=6?'초등 '+g:g<=9?'중등 '+(g-6):'고등 '+(g-9)}학년</option>)}
    </select></label>
    <label>마지막 과제 뒤 심화 문제 <input type="number" className="w-20 rounded border p-1" min={0} max={max} step={1}
      value={count} onChange={e=>onChange(grade,Math.max(0,Math.min(max,Math.trunc(Number(e.target.value)||0))))}/> 개</label>
    <span className="text-sm">0개를 고르면 여섯 단계로 끝나요. 최대 {max}개</span>
  </fieldset>;
}
function DrillTextField({label,value,onChange}:{label:string;value:string;onChange:(text:string)=>void}) {
  // Matching text metrics keep the textarea as tall as its wrapped contents, even after a resize.
  const box='col-start-1 row-start-1 min-w-0 w-full rounded-md border p-2 whitespace-pre-wrap [overflow-wrap:anywhere]';
  return <label className="grid min-w-0 gap-1 text-sm">{label}
    <span className="grid min-w-0">
      <span aria-hidden="true" className={box+' invisible'}>{value+' '}</span>
      <textarea aria-label={label} rows={1} className={box+' resize-none'} value={value} onChange={e=>onChange(e.target.value)}/>
    </span>
  </label>;
}
export function WorkshopSettings({draft,setDraft,disabled}:{draft:GrammarBoardContent;setDraft:Dispatch<SetStateAction<GrammarBoardContent>>;disabled:boolean}) {
  const [drillIndex,setDrillIndex]=useState(0);
  const workshop=draft.workshop;
  if (!workshop) return null;
  const originals=extensionPool({...workshop,overrides:undefined}).slice(0,workshop.count);
  const drillNumber=Math.min(drillIndex,originals.length-1);
  const originalDrill=originals[drillNumber];
  const drillKey=originalDrill ? originalDrill.kind+'|'+(originalDrill.previousPrompt??originalDrill.prompt) : '';
  const drill=workshop.overrides?.[drillKey]??originalDrill;
  const updateWorkshop=(fn:(w:Workshop)=>Workshop)=>setDraft(old=>({...old,workshop:fn(old.workshop!)}));
  function changeDrill(patch:Partial<ExtensionQuestion>) {
    updateWorkshop(w=>({...w,overrides:{...w.overrides,[drillKey]:{...drill,...patch}}}));
  }
  return <details className="rounded-xl border p-2"><summary>수업 설정</summary>
    <div className="grid gap-3 p-2">
    <GradeSettings grade={workshop.grade} count={workshop.count} max={extensionPool(workshop).length} disabled={disabled}
      onChange={(grade,count)=>updateWorkshop(w=>{
        const next={...w,grade,countsByGrade:{...w.countsByGrade,[w.grade]:w.count}};
        const n=grade===w.grade?count:(w.countsByGrade?.[grade]??5);
        return {...next,count:Math.min(n,extensionPool(next).length)};
      })}/>
    {drill && <details className="rounded-lg border p-2"><summary>심화 문제 미리보기·수정 ({originals.length}개)</summary>
      <label>문제 선택 <select value={drillNumber} onChange={e=>setDrillIndex(Number(e.target.value))}>
        {originals.map((q,i)=><option key={i} value={i}>{i+1}. {q.title}</option>)}</select></label>
      <div className="mt-2 grid min-w-0 gap-3">
        <DrillTextField label="문제" value={drill.prompt} onChange={prompt=>changeDrill({prompt})}/>
        {drill.options?.map((opt,j)=><div key={j} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <label className="flex items-center gap-1"><input type="radio" name="drill-correct" aria-label={(j+1)+'번 보기를 정답으로 선택'} checked={drill.answer===opt} onChange={()=>changeDrill({answer:opt})}/> 정답</label>
          <DrillTextField label={(j+1)+'번 보기'} value={opt} onChange={value=>changeDrill({options:drill.options!.map((s,i)=>i===j?value:s),answer:opt===drill.answer?value:drill.answer})}/>
        </div>)}
        {!drill.options&&<DrillTextField label="정답 또는 예시" value={drill.answer} onChange={answer=>changeDrill({answer})}/>}
        <DrillTextField label="풀이" value={drill.reason} onChange={reason=>changeDrill({reason})}/>
      </div>
    </details>}
    </div></details>;
}
