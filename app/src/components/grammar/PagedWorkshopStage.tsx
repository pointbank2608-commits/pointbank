import {useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import type {Workshop} from '../../../../supabase/functions/_shared/grammarWorkshop';
import type {GuidedPractice} from '../../data/doYouCanYou';
import type {StageEdit} from './InlineWorkshopEdit';
import GuidedPracticePanel from './GuidedPracticePanel';
import {lessonPages,pageLabels} from './lessonPages';
import WorkshopSheet from './WorkshopSheet';

type Props={
  practice:GuidedPractice; step:number; total:number; grade?:number; title:ReactNode; topic?:ReactNode; prompt:ReactNode;
  map?:GuidedPractice; workshop?:Workshop; drillEditor?:ReactNode; review?:string; finalModel?:string; followUp?:string; edit?:StageEdit;
  classroom?:boolean; interactive?:boolean; keyboard?:boolean; locked?:boolean; className?:string;
  page?:number; scene?:number; onPage?:(page:number)=>void; onScene?:(scene:number)=>void;
  onPrevious?:()=>void; onNext?:()=>void; nextLabel?:string; onHelp?:()=>void; onReveal?:()=>void; onModelOpen?:()=>void;
};

export default function PagedWorkshopStage({practice, step,total,grade,title,topic,prompt,map,workshop,drillEditor,review,finalModel,followUp,edit,
  classroom,interactive=true,keyboard,locked,className='',page,scene,onPage,onScene,onPrevious,onNext,nextLabel,onHelp,onReveal,onModelOpen=onReveal}:Props){
  const [localPage,setLocalPage]=useState(0);
  const [localScene,setLocalScene]=useState(0);
  const [drafts,setDrafts]=useState<string[]>([]);
  const pages=lessonPages(step,practice,!!edit,!!workshop?.count);
  const index=Math.min(Math.max(0,page??localPage),pages.length-1);
  const current=pages[index];
  const bodyRef=useRef<HTMLDivElement>(null);
  const lastPage=useRef(index);
  useLayoutEffect(()=>{
    if(lastPage.current!==index){
      const body=bodyRef.current;
      if(body){
        body.scrollTop=0;
        body.focus({preventScroll:true});
        if(body.getBoundingClientRect().top<0) body.scrollIntoView({block:'start'});
      }
      lastPage.current=index;
    }
  },[index]);
  function label(i:number){
    const kind=pages[i];
    if(kind==='task' && (practice.independentPrompts?.length??0)>1) return '혼자 쓰기 '+(i+1);
    if(kind==='activity'){
      if(practice.assembly) return '문장 조립';
      if(step===3) return '단서 찾기';
      if(step===4) return '질문 고르기';
    }
    if(kind==='examples' && step===1) return '두 예문 비교';
    return pageLabels[kind];
  }
  const move=(i:number)=>{setLocalPage(i);onPage?.(i);};
  const selectScene=(i:number)=>{setLocalScene(i);onScene?.(i);};
  const afterScene=current==='scene' && pages[index+1]==='more';
  const nextIndex=index+(afterScene?2:1);
  const hasNextPage=nextIndex<pages.length;
  const toReview=pages[nextIndex]==='review';
  const needsAnswer=current==='task' && !classroom && !edit && !drafts[index]?.trim();
  const back=()=>{if(index)move(index-1);else onPrevious?.();};
  const forward=()=>{
    if(locked || needsAnswer)return;
    if(hasNextPage){if(toReview && !edit)onModelOpen?.();move(nextIndex);}
    else onNext?.();
  };
  useEffect(()=>{
    if(!keyboard || locked)return;
    const keydown=(e:KeyboardEvent)=>{
      if(e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || (e.target instanceof Element &&
        (e.target.closest('input,textarea,select,[contenteditable=true],dialog,[role="dialog"]') || e.key===' ' && e.target.closest('button,summary'))))return;
      if(['ArrowRight','PageDown',' '].includes(e.key) && (hasNextPage||onNext)){
        e.preventDefault();e.stopPropagation();forward();
      }else if(['ArrowLeft','PageUp'].includes(e.key) && (index||onPrevious)){
        e.preventDefault();e.stopPropagation();back();
      }
    };
    document.addEventListener('keydown',keydown,true);
    return ()=>document.removeEventListener('keydown',keydown,true);
  });
  const forwardLabel=toReview?(classroom?'예시 답 보기':edit?'예시 답 편집':'내 답과 예시 비교하기'):
    hasNextPage?label(nextIndex)+' →':nextLabel??'다음 단계';
  const compare=step===1 && current==='examples';
  const showPrompt=current!=='more' && current!=='scene' && current!=='extensions' && current!=='review';
  return <WorkshopSheet grade={grade} step={step} total={total} title={index===0?title:label(index)} topic={topic} map={map} onMap={onHelp} bodyRef={bodyRef}
    className={className+(compare && classroom?' workshop-comparison':'')}
    pageInfo={edit && pages.length>1?<label>편집할 쪽 <select value={index} onChange={e=>move(Number(e.target.value))}>
      {pages.map((_,i)=><option key={i} value={i}>{i+1}. {label(i)}</option>)}</select></label>:
      <span>{label(index)}{pages.length>1?' · '+(index+1)+' / '+pages.length+'쪽':''}</span>}
    prompt={showPrompt && !compare && prompt}
    footer={interactive && <>
      <button type="button" disabled={locked || !index&&!onPrevious} onClick={back}>{current==='scene'?'다른 쓰임 고르기':index?'← '+label(index-1):'이전 단계'}</button>
      <div className="workshop-page-actions">{afterScene && <button type="button" disabled={locked} onClick={()=>{onHelp?.();move(index+1);}}>더 궁금해요</button>}
        <button type="button" disabled={locked || needsAnswer || !hasNextPage&&!onNext} onClick={forward}>{forwardLabel}</button></div></>}>
    <div inert={!interactive}>{current==='extensions' && edit ? drillEditor : <GuidedPracticePanel practice={practice} workshop={workshop} review={review} edit={edit} page={current} pageIndex={index}
      initialScene={scene??localScene} onScene={selectScene} onOpenScene={()=>move(1)} locked={locked}
      finalModel={finalModel} followUp={followUp} classroom={classroom} onHelp={onHelp} onReveal={onReveal} drafts={drafts}
      onDraft={(i,value)=>setDrafts(old=>{const next=[...old];next[i]=value;return next;})}/>}</div>
    {compare && <div className="workshop-prompt">{prompt}</div>}
  </WorkshopSheet>;
}
