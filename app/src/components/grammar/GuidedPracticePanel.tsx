import { useEffect, useRef, useState } from 'react';
import type { GuidedPractice } from '../../data/doYouCanYou';
import { WordOrder, WorkshopExercises } from './WorkshopExercises';
import type { SceneLine, Workshop } from '../../../../supabase/functions/_shared/grammarWorkshop';
import './guided-practice.css';
import type {LessonPage} from './lessonPages';

import {ItemAction, InlineImage, InlineText, SceneSentence, type StageEdit} from './InlineWorkshopEdit';

function emptyPanel():SceneLine {
  return {label:'',chunks:[''],meaning:''};
}

function SceneCard({panel,index,title,onHelp,sentenceFirst=false,edit,onTitle,onCaption,caption}:{
  panel:SceneLine;index:number;title?:string;onHelp?:()=>void;sentenceFirst?:boolean;edit?:StageEdit;
  onTitle?:(value:string)=>void;caption?:string;onCaption?:(value:string)=>void;
}) {
  const patch=(values:Partial<SceneLine>)=>edit?.practice(p=>({...p,panels:p.panels?.map((line,i)=>i===index?{...line,...values}:line)}));
  function field(key:'setting'|'response'|'rationale'|'label'|'meaning',label:string) {
    const optional=key==='setting'||key==='response'||key==='rationale';
    return <><InlineText label={label} value={panel[key]??''} emptyLabel={optional?'＋ '+label:label} onChange={edit?v=>patch({[key]:v}):undefined}/>
      {edit&&optional&&panel[key]&&<ItemAction kind="remove" label={label} onClick={()=>patch({[key]:''})}/>}</>;
  }
  const setting=(edit||panel.setting)&&<p>{field('setting','장면 설명')}</p>;
  return <article className="grammar-scene-card">
    {edit?<InlineImage edit={edit} label={panel.label+' 그림'} src={panel.image} onChange={image=>patch({image})}/>:panel.image&&<img src={panel.image} alt=""/>}
    {title!==undefined && (edit || panel.label!==title) && <p className="scene-speaker">{field('label','말하는 사람')}</p>}
    <h3>{title!==undefined?<InlineText value={title} label="쓰임 이름" onChange={onTitle}/>:field('label','장면 제목')}</h3>
    {onCaption&&<small><InlineText value={caption??''} label="쓰임 설명" onChange={onCaption}/></small>}
    {!sentenceFirst && setting}
    <SceneSentence panel={panel} onChange={edit?patch:undefined}/>
    <p>{field('meaning','문장 전체 뜻')}</p>{sentenceFirst && setting}
    {(edit||panel.response) && <p><b>상대의 반응</b> · {field('response','상대의 반응')}</p>}
    {(edit||panel.rationale) && <details onToggle={e=>{if(e.currentTarget.open)onHelp?.();}}><summary>왜 이런 뜻일까?</summary><p>{field('rationale','이유 설명')}</p></details>}
  </article>;
}

export function SceneMap({practice,onHelp,edit,initialScene,onScene,view='both',onOpen,locked}:{practice:GuidedPractice;onHelp?:()=>void;edit?:StageEdit;initialScene?:number;onScene?:(i:number)=>void;view?:'map'|'scene'|'both';onOpen?:()=>void;locked?:boolean}) {
  const [selection,setSelected]=useState(0);
  const entries=practice.map??[];
  const selected=Math.max(0,Math.min(initialScene??selection,entries.length-1));
  const entry=entries[selected];
  const panel=entry?.panelIndex===undefined?undefined:practice.panels?.[entry.panelIndex];
  function select(i:number){setSelected(i);onScene?.(i);}
  function addScene(){
    edit?.practice(p=>({...p,map:[...p.map??[],{label:'',text:'',panelIndex:p.panels?.length??0}],panels:[...p.panels??[],emptyPanel()]}));
    select(entries.length);onOpen?.();
  }
  function removeScene(i:number){
    const removed=entries[i].panelIndex;
    edit?.practice(p=>{
      const remaining=p.map!.filter((_,j)=>i!==j);
      if(removed===undefined||remaining.some(m=>m.panelIndex===removed))return {...p,map:remaining};
      return {...p,map:remaining.map(m=>m.panelIndex!==undefined&&m.panelIndex>removed?{...m,panelIndex:m.panelIndex-1}:m),
        panels:p.panels?.filter((_,j)=>j!==removed)};
    });
    select(Math.max(0,selected-(i<selected||selected===entries.length-1?1:0)));
  }
  const mapChange=(key:'label'|'text',value:string)=>edit?.practice(p=>({...p,map:p.map?.map((m,i)=>i===selected?{...m,[key]:value}:m)}));
  return <div className="grammar-atlas">
    {view!=='scene' && <div className="grammar-map-options">{entries.map((item,i)=>{
      const tile=<button type="button" key={i} aria-pressed={i===selected} disabled={locked} onClick={()=>{select(i);onOpen?.();onHelp?.();}}>
        <b>{item.label||(edit?'새 쓰임':'')}</b>{item.panelIndex!==undefined&&<small>{item.text}</small>}</button>;
      return edit?<div key={i} className="workshop-map-item">{tile}<ItemAction kind="remove" label={(item.label||'새 쓰임')+' 카드'} onClick={()=>removeScene(i)}/></div>:tile;
    })}{edit&&<ItemAction kind="add" label="쓰임 카드" onClick={addScene}/>}</div>}
    {view!=='map' && <div aria-live="polite" key={selected}>{!entry?null:panel ? <SceneCard title={entry.label} panel={panel} index={entry.panelIndex!} edit={edit} onHelp={onHelp}
      onTitle={edit?v=>mapChange('label',v):undefined} caption={entry.text} onCaption={edit?v=>mapChange('text',v):undefined}/> : <article className="grammar-scene-card"><h3><InlineText label="쓰임 이름" value={entry.label} onChange={edit?v=>mapChange('label',v):undefined}/></h3><p><InlineText label="쓰임 설명" value={entry.text} onChange={edit?v=>mapChange('text',v):undefined}/></p></article>}</div>}
  </div>;
}

export default function GuidedPracticePanel({ practice, review, onHelp, onReveal, workshop, classroom, page, pageIndex, edit, initialScene, onScene, onOpenScene, finalModel, followUp, drafts, onDraft, locked }: {
  practice: GuidedPractice; review?: string; onHelp?: () => void; onReveal?: () => void; workshop?: Workshop;
  classroom?:boolean; page:LessonPage; pageIndex:number; edit?:StageEdit; initialScene?:number; onScene?:(i:number)=>void; onOpenScene:()=>void;
  finalModel?:string; followUp?:string; drafts:string[]; onDraft:(i:number,value:string)=>void; locked?:boolean;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [writing,setWriting]=useState('');
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (picked !== null) feedback.current?.scrollIntoView({block: 'nearest'});
  }, [picked]);
  const why = ([question, explanation]: [string, string],index:number) => <div key={index} className={edit?'workshop-edit-row':undefined}><details onToggle={event => {
      if (event.currentTarget.open) onHelp?.();
    }}>
      <summary>{question||(edit?'새 질문':'')}</summary>
      {edit&&<InlineText label="질문 제목" value={question} onChange={v=>edit.practice(p=>({...p,why:p.why.map((pair,i)=>i===index?[v,pair[1]]:pair)}))}/>}
      <p><InlineText label="펼쳐 볼 설명" value={explanation} onChange={edit?v=>edit.practice(p=>({...p,why:p.why.map((pair,i)=>i===index?[pair[0],v]:pair)})):undefined}/></p>
    </details>{edit&&<ItemAction kind="remove" label={(index+1)+'번째 질문'} onClick={()=>edit.practice(p=>({...p,why:p.why.filter((_,i)=>i!==index)}))}/>}</div>;
  const questions=<>{practice.why.map(why)}{edit&&<ItemAction kind="add" label="왜 질문" onClick={()=>edit.practice(p=>({...p,why:[...p.why,['','']]}))}/>}</>;
  const artwork = edit?<div className="workshop-stage-image"><InlineImage edit={edit} label="단계 그림" src={practice.image} alt={practice.imageDescription}
    onChange={image=>edit.practice(p=>({...p,image}))}/>{practice.image&&<InlineText label="그림 설명" value={practice.imageDescription??''} onChange={imageDescription=>edit.practice(p=>({...p,imageDescription}))}/>}</div>:practice.image && <img src={practice.image} alt={practice.imageDescription ?? ''} className="max-h-48 rounded-lg object-contain" />;
  if(page==='extensions') return workshop && <WorkshopExercises workshop={workshop} onReveal={onReveal}/>;
  if(practice.independentPrompts){
    if(page==='review') return <div className="guided-practice">
      {edit ? <><p><InlineText label="예시 답" value={finalModel??''} onChange={edit.model}/></p>
        <p><InlineText label="예시를 본 뒤 확인할 점" value={followUp??''} onChange={edit.followUp}/></p></> :
        <>{drafts.map((draft,i)=><p key={i} className="whitespace-pre-line"><b>내 답</b> · {draft}</p>)}<p className="question-model">{review}</p></>}
      {questions}</div>;
    const task=practice.independentPrompts[pageIndex]??'';
    return <div className="guided-practice">{artwork}{edit ? <InlineText label="마지막 과제" value={task} onChange={edit.task}/> :
      classroom ? <><strong>내 답을 말로 들려주세요.</strong><p className="whitespace-pre-line">{task}</p></> :
      <label className="question-draft">{task}<textarea rows={2} value={drafts[pageIndex]??''} onChange={e=>onDraft(pageIndex,e.target.value)}/></label>}</div>;
  }
  if(page==='more') return <div className="guided-practice">{questions}</div>;
  const showPanels=page==='examples' || page==='activity' && !!practice.assembly;
  const hasActivity=practice.choices.length>0 || !!practice.assembly;
  return <div className="guided-practice">
    {(page==='map' || page==='scene') && <SceneMap view={page} locked={locked} practice={practice} onOpen={onOpenScene} onHelp={onHelp} edit={edit} initialScene={initialScene} onScene={onScene}/>}
    {showPanels && practice.panels && <div className="grammar-scene-grid">{practice.panels.map((panel,i)=>
      <div key={i}><SceneCard index={i} edit={edit} panel={panel} sentenceFirst={page==='examples'} onHelp={onHelp}/>
        {edit&&<ItemAction kind="remove" label={(i+1)+'번째 예문 카드'} onClick={()=>edit.practice(p=>({...p,panels:p.panels?.filter((_,j)=>i!==j)}))}/>}
      </div>)}{edit&&<ItemAction kind="add" label="예문 카드" onClick={()=>edit.practice(p=>({...p,panels:[...p.panels??[],emptyPanel()]}))}/>}</div>}
    {pageIndex===0 && artwork}
    {page==='activity' && !practice.assembly && !!practice.panels?.length && <div className="workshop-clues">
      {practice.panels.map((p,i)=><p key={i}><b>{p.label}</b> · <span lang="en">{p.chunks.join(' ')}</span> · {p.meaning}</p>)}
    </div>}
    {page==='write' && picked!==null && practice.choices[picked] && <p><b>내가 고른 표현</b> · {practice.choices[picked][0]}</p>}
    {!practice.map?.length && (page==='activity' || !hasActivity && (page==='examples'||page==='write')) && questions}
    {page==='activity' && (edit ? <div>
      {(practice.question||practice.choices.length>0)&&<p><InlineText label="연습 질문" value={practice.question} onChange={question=>edit.practice(p=>({...p,question}))}/></p>}
      {practice.assembly?.map((word,i)=><span key={i}><InlineText label={(i+1)+'번째 문장 조각'} value={word}
        onChange={v=>edit.practice(p=>({...p,assembly:p.assembly?.map((w,j)=>i===j?v:w)}))}/>
        <ItemAction kind="remove" label={(i+1)+'번째 문장 조각'} disabled={practice.assembly!.length===1} onClick={()=>edit.practice(p=>({...p,assembly:p.assembly?.filter((_,j)=>i!==j)}))}/></span>)}
      {practice.assembly&&<ItemAction kind="add" label="문장 조각" onClick={()=>edit.practice(p=>({...p,assembly:[...p.assembly??[],'']}))}/>}

      {practice.choices.map(([label,feedback],i)=><details key={i}><summary>{label||'새 보기'}</summary>
        <p><InlineText label="보기" value={label} onChange={v=>edit.practice(p=>'choices' in p?{...p,choices:p.choices.map((pair,j)=>i===j?[v,pair[1]]:pair)}:p)}/></p>
        <p><InlineText label="선택했을 때 설명" value={feedback} onChange={v=>edit.practice(p=>'choices' in p?{...p,choices:p.choices.map((pair,j)=>i===j?[pair[0],v]:pair)}:p)}/></p>
        <ItemAction kind="remove" label={(i+1)+'번째 보기'} disabled={practice.choices.length<=2} onClick={()=>edit.practice(p=>'choices'in p?{...p,choices:p.choices.filter((_,j)=>i!==j),correct:p.correct===i?0:p.correct>i?p.correct-1:p.correct}:p)}/>
        <label><input type="radio" checked={practice.correct===i} onChange={()=>edit.practice(p=>({...p,correct:i}))}/> 정답</label>
      </details>)}
      {practice.choices.length>0&&<ItemAction kind="add" label="보기" onClick={()=>edit.practice(p=>'choices'in p?{...p,choices:[...p.choices,['','']]}:p)}/>}
    </div> : practice.assembly ? <><p>{practice.question}</p><WordOrder words={practice.assembly} reason={practice.question} onReveal={onReveal}/></> : practice.choices.length>0 && <fieldset>
      <legend>{practice.question}</legend>
      {practice.choices.map(([label], index) => <button type="button" key={index} aria-pressed={picked === index} data-correct={index===practice.correct}
        onClick={() => {setPicked(index);onReveal?.();}}>{label}</button>)}
      <div role="status" ref={feedback}>{picked !== null && practice.choices[picked] && <p className={picked===practice.correct?'grammar-right':'grammar-wrong'}>{picked===practice.correct?'✓ 맞아요. ':'✕ 아니에요. '}{practice.choices[picked][1].replace(/^맞아요\.\s*/,'')} {picked !== practice.correct && '다시 골라 보세요.'}</p>}</div>
    </fieldset>)}
    {page==='write' && (edit&&practice.writingPrompt?<InlineText label="직접 쓰기 안내" value={practice.writingPrompt} onChange={writingPrompt=>edit.practice(p=>({...p,writingPrompt}))}/>:practice.writingPrompt && <label className="block">{practice.writingPrompt}
      <textarea value={writing} onChange={e=>setWriting(e.target.value)} rows={3} className="block w-full rounded-lg bg-white p-2 text-slate-900" placeholder="내가 전하고 싶은 말을 적어 보세요." />
    </label>)}
  </div>;
}
