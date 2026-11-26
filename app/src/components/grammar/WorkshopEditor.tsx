import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { extensionPool, schoolOf, stageTitles, type Workshop, type ExtensionQuestion } from '../../../../supabase/functions/_shared/grammarWorkshop';
import { useAuth } from '../../context/AuthContext';
import { uploadLessonSlideImage } from '../../lib/api';
import type { GrammarBoardContent } from '../../lib/grammar';
import type { GuidedPractice } from '../../data/doYouCanYou';

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
function TextField({label,value,onChange}:{label:string;value:string;onChange:(s:string)=>void}) {
  return <label className="grid text-sm">{label}<textarea className="rounded-md border p-2" rows={2} value={value} onChange={e=>onChange(e.target.value)}/></label>;
}
export default function WorkshopEditor({draft,setDraft,onUploading,index,onStage}:{draft:GrammarBoardContent;setDraft:Dispatch<SetStateAction<GrammarBoardContent>>;onUploading:(busy:boolean)=>void;index:number;onStage:(index:number)=>void}) {
  const {academy}=useAuth();
  const [drillIndex,setDrillIndex]=useState(0);
  const [error,setError]=useState('');
  const [uploading,setUploading]=useState(false);
  const lock=useRef(false);
  const workshop=draft.workshop;
  const step=draft.steps?.[index];
  if (!workshop || !step?.practice) return null;
  const practice=step.practice;
  const school=schoolOf(workshop.grade);
  const scene=workshop.scenes[school];
  const originals=extensionPool({...workshop,overrides:undefined}).slice(0,workshop.count);
  const drillNumber=Math.min(drillIndex,originals.length-1);
  const originalDrill=originals[drillNumber];
  const drillKey=originalDrill ? originalDrill.kind+'|'+originalDrill.prompt : '';
  const drill=workshop.overrides?.[drillKey]??originalDrill;
  const updateWorkshop=(fn:(w:Workshop)=>Workshop)=>setDraft(old=>({...old,workshop:fn(old.workshop!)}));
  function changeDrill(patch:Partial<ExtensionQuestion>) {
    updateWorkshop(w=>({...w,overrides:{...w.overrides,[drillKey]:{...drill,...patch}}}));
  }
  function editPractice(fn:(p:GuidedPractice)=>GuidedPractice) {
    setDraft(old=>({...old,steps:old.steps?.map((s,i)=>i===index && s.practice?{...s,practice:fn(s.practice)}:s)}));
  }
  function editStep(key:'prompt'|'hint'|'answer'|'followUp',value:string) {
    setDraft(old=>({...old,steps:old.steps?.map((s,i)=>i===index?{...s,[key]:value}:s)}));
  }
  function editScene(key:keyof typeof scene,value:string) {
    updateWorkshop(w=>({...w,scenes:{...w.scenes,[school]:{...w.scenes[school],[key]:value}}}));
  }
  function imageAt(url:string,panel?:number) {
    editPractice(p=>panel===undefined?{...p,image:url}:{...p,panels:p.panels?.map((line,i)=>i===panel?{...line,image:url}:line)});
  }
  function imageField(label:string,url?:string,panel?:number) {
    return <label className="grid gap-1 text-sm">{label}{url&&<img alt={label} src={url} className="h-16 w-24 rounded object-contain"/>}
      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={async e=>{
        const file=e.target.files?.[0];e.target.value='';
        if(!file || !academy || lock.current)return;
        lock.current=true;setUploading(true);onUploading(true);setError('');
        try{const asset=await uploadLessonSlideImage(academy.id,file);imageAt(asset.url,panel);}
        catch{setError('그림을 저장하지 못했어요. 다시 선택해 주세요.');}
        finally{lock.current=false;setUploading(false);onUploading(false);}
      }}/></label>;
  }
  return <section className="grid gap-3 rounded-xl border p-3">
    <GradeSettings grade={workshop.grade} count={workshop.count} max={extensionPool(workshop).length} disabled={uploading}
      onChange={(grade,count)=>updateWorkshop(w=>{
        const next={...w,grade,countsByGrade:{...w.countsByGrade,[w.grade]:w.count}};
        const n=grade===w.grade?count:(w.countsByGrade?.[grade]??5);
        return {...next,count:Math.min(n,extensionPool(next).length)};
      })}/>
    <label>편집할 단계 <select disabled={uploading} value={index} onChange={e=>onStage(Number(e.target.value))}>
      {stageTitles.map((title,i)=><option value={i} key={title}>{i+1}. {title}</option>)}</select></label>
    <TextField label={index===0?'이 학교급의 시작 장면':'화면 설명'} value={index===0?scene.opening:step.prompt}
      onChange={v=>index===0?editScene('opening',v):editStep('prompt',v)}/>
    {index===5&&<><TextField label="이 학교급의 마지막 과제" value={scene.task} onChange={v=>editScene('task',v)}/>
      <TextField label="첫 시도 뒤에 보여 줄 예시" value={scene.model} onChange={v=>editScene('model',v)}/></>}
    {imageField('단계 그림 추가·교체',practice.image)}
    {practice.image&&<TextField label="그림 설명" value={practice.imageDescription??''} onChange={v=>editPractice(p=>({...p,imageDescription:v}))}/>}
    {practice.map?.map((entry,j)=><fieldset key={j}>
      {(['label','text'] as const).map(key=><TextField key={key} label={key==='label'?'쓰임 이름':'쓰임 설명'} value={entry[key]}
        onChange={v=>editPractice(p=>({...p,map:p.map?.map((x,i)=>i===j?{...x,[key]:v}:x)}))}/>)}</fieldset>)}
    {practice.panels?.map((line,j)=><fieldset key={j} className="grid gap-1 rounded border p-2"><legend>{line.label}</legend>
      {imageField(line.label+' 그림',line.image,j)}
      {(['label','chunks','glosses','meaning'] as const).map(key=><TextField key={key} label={{label:'장면 제목',chunks:'영어 조각 (줄마다 하나)',glosses:'조각별 우리말 뜻 (같은 순서로 한 줄씩)',meaning:'문장 전체 뜻'}[key]}
        value={key==='chunks'||key==='glosses'?(line[key]??[]).join('\n'):line[key]} onChange={v=>editPractice(p=>({...p,panels:p.panels?.map((x,i)=>i===j?{...x,[key]:key==='chunks'||key==='glosses'?v.split('\n'):v}:x)}))}/>)}</fieldset>)}
    {practice.why.map((pair,j)=><fieldset key={j}>{pair.map((v,k)=><TextField key={k} label={k?'펼쳐 볼 설명':'학생의 왜?'} value={v}
      onChange={value=>editPractice(p=>({...p,why:p.why.map((w,i)=>i!==j?w:k===0?[value,w[1]]:[w[0],value])}))}/>)}</fieldset>)}
    {'question' in practice && (practice.question || practice.choices.length>0) && <TextField label="연습 질문" value={practice.question}
      onChange={v=>editPractice(p=>'question'in p?{...p,question:v}:p)}/>}
    {practice.assembly && <TextField label="정답 순서대로 문장 조각 (줄마다 하나)" value={practice.assembly.join('\n')}
      onChange={v=>editPractice(p=>({...p,assembly:v.split('\n')}))}/>}
    {'choices' in practice && practice.choices.map(([label,feedback],j)=><fieldset key={j} className="rounded border p-2">
      <label><input type="radio" name={'correct-'+index} checked={j===practice.correct} onChange={()=>editPractice(p=>'choices'in p?{...p,correct:j}:p)}/> 정답 보기</label>
      {[label,feedback].map((v,k)=><TextField key={k} label={k?'선택했을 때 설명':'보기'} value={v} onChange={value=>editPractice(p=>'choices'in p?{...p,choices:p.choices.map((c,i)=>i!==j?c:k===0?[value,c[1]]:[c[0],value])}:p)}/>)}</fieldset>)}
    {'writingPrompt' in practice&&<TextField label="직접 쓰기 안내" value={practice.writingPrompt??''} onChange={v=>editPractice(p=>'choices'in p?{...p,writingPrompt:v}:p)}/>}
    {(['hint','answer','followUp'] as const).filter(key=>index!==5||key==='followUp').map(key=><TextField key={key}
      label={{hint:'힌트',answer:'예시 답과 이유',followUp:'다음 생각'}[key]} value={step[key]} onChange={v=>editStep(key,v)}/>)}
    {error&&<p role="alert">{error}</p>}
    {drill && <details className="rounded-lg border p-2"><summary>심화 문제 미리보기·수정 ({originals.length}개)</summary>
      <label>문제 선택 <select value={drillNumber} onChange={e=>setDrillIndex(Number(e.target.value))}>
        {originals.map((q,i)=><option key={i} value={i}>{i+1}. {q.title}</option>)}</select></label>
      <TextField label="문제" value={drill.prompt} onChange={prompt=>changeDrill({prompt})}/>
      {drill.options?.map((opt,j)=><label key={j} className="block"><input type="radio" name="drill-correct" checked={drill.answer===opt} onChange={()=>changeDrill({answer:opt})}/> 정답
        <input aria-label={(j+1)+'번 보기'} value={opt} onChange={e=>changeDrill({options:drill.options!.map((s,i)=>i===j?e.target.value:s),answer:opt===drill.answer?e.target.value:drill.answer})}/></label>)}
      {!drill.options&&<TextField label="정답 또는 예시" value={drill.answer} onChange={answer=>changeDrill({answer})}/>}
      <TextField label="풀이" value={drill.reason} onChange={reason=>changeDrill({reason})}/>
    </details>}
  </section>;
}
