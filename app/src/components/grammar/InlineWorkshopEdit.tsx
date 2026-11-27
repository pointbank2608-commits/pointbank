import {createContext, useContext, useId, useRef, useState, type ReactNode} from 'react';
import type {GuidedPractice} from '../../data/doYouCanYou';
import type {SceneLine} from '../../../../supabase/functions/_shared/grammarWorkshop';

export interface StageEdit {
  practice: (change: (current: GuidedPractice) => GuidedPractice) => void;
  task: (text: string) => void;
  model: (text: string) => void;
  followUp: (text: string) => void;
  upload: (file: File, apply: (url: string) => void) => Promise<void>;
}

export function ItemAction({kind,label,onClick,disabled=false}:{kind:'add'|'remove';label:string;onClick:()=>void;disabled?:boolean}){
  const action=kind==='add'?'추가':'삭제';
  return <button type="button" className={'workshop-item-'+kind} aria-label={label+' '+action} title={label+' '+action} disabled={disabled} onClick={onClick}>
    {kind==='add'?'＋ '+label:'−'}</button>;
}

export const ActiveTextContext=createContext<{active:string|null;select:(id:string|null)=>void}|null>(null);

export function InlineText({label,value,onChange,children,emptyLabel}:{label:string;value:string;onChange?:(v:string)=>void;children?:ReactNode;emptyLabel?:string}) {
  const active=useContext(ActiveTextContext);
  const id=useId();
  const original=useRef(value);
  if(!onChange)return children??value;
  if(active?.active===id)return <textarea aria-label={label} autoFocus rows={1} className="workshop-text-input" value={value}
    onFocus={e=>e.target.select()} onChange={e=>onChange(e.target.value)}
    onKeyDown={e=>{
      if(e.nativeEvent.isComposing || e.keyCode===229)return;
      if(e.key==='Escape'){e.stopPropagation();onChange(original.current);active.select(null);}
      if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();active.select(null);}
    }}/>;
  return <button type="button" className="workshop-edit-target" aria-label={label+' 수정'} onClick={()=>{original.current=value;active?.select(id);}}>
    {children??(value||emptyLabel||label)}
  </button>;
}

export function InlineImage({edit,src,label,alt='',onChange}:{edit:StageEdit;src?:string;label:string;alt?:string;onChange:(url:string)=>void}) {
  const input=useRef<HTMLInputElement>(null);
  return <span className="workshop-image-control">
    <button type="button" aria-label={label+(src?' 바꾸기':' 추가')} onClick={()=>input.current?.click()}>
      {src&&<img src={src} alt={alt}/>}<small>{src?'그림 바꾸기':'＋ 그림'}</small>
    </button>
    {src&&<ItemAction kind="remove" label={label} onClick={()=>onChange('')}/>}
    <input hidden type="file" aria-label={label+' 파일'} ref={input} accept="image/png,image/jpeg,image/webp"
      onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void edit.upload(file,onChange);}}/>
  </span>;
}

export function SceneSentence({panel,onChange}:{panel:SceneLine;onChange?:(patch:Partial<SceneLine>)=>void}) {
  const [active,setActive]=useState<number|null>(null);
  if(active!==null && onChange && panel.chunks[active]!==undefined) {
    function remove(index:number) {
      setActive(Math.max(0,Math.min(index,panel.chunks.length-2)));
      onChange?.({chunks:panel.chunks.filter((_,i)=>i!==index),glosses:panel.glosses?.filter((_,i)=>i!==index)});
    }
    return <fieldset className="workshop-sentence-editor"><legend>예문 수정</legend>
      <div className="scene-sentence">{panel.chunks.map((chunk,i)=><button type="button" key={i} aria-pressed={i===active} onClick={()=>setActive(i)}>{chunk||'새 조각'}</button>)}</div>
      {panel.chunks.map((chunk,i)=>i===active&&<div className="workshop-piece" key={i}>
        <label>영어<input autoFocus={i===active} value={chunk} onFocus={e=>e.target.select()} onChange={e=>onChange({chunks:panel.chunks.map((s,j)=>j===i?e.target.value:s)})}/></label>
        <label>우리말 뜻<input value={panel.glosses?.[i]??''} onChange={e=>{
          const glosses=panel.chunks.map((_,j)=>j===i?e.target.value:panel.glosses?.[j]??'');
          onChange({glosses:glosses.some(Boolean)?glosses:undefined});
        }}/></label>
        <ItemAction kind="remove" label={(i+1)+'번째 조각'} disabled={panel.chunks.length===1} onClick={()=>remove(i)}/>
      </div>)}
      <button type="button" onClick={()=>{
        setActive(panel.chunks.length);
        onChange({chunks:[...panel.chunks,''],glosses:panel.glosses&&[...panel.glosses,'']});
      }}>＋ 조각</button>
      <button type="button" onClick={()=>setActive(null)}>편집 닫기</button>
    </fieldset>;
  }
  return <div className="scene-sentence">{panel.chunks.map((chunk,i)=>{
    const role=/^(can|must|may|should|do|does|did)$/i.test(chunk)?'helper':/^(I|you|we|she|he|it|they)$/i.test(chunk)?'person':undefined;
    const content=<><b lang="en">{chunk||(onChange?'영어 예문 입력':'')}</b>{panel.glosses?.[i]&&<small>{panel.glosses[i]}</small>}</>;
    return onChange?<button key={i} type="button" className="grammar-chunk" data-role={role} aria-label={'예문 수정 · '+chunk} onClick={()=>setActive(i)}>{content}</button>:
      <span className="grammar-chunk" data-role={role} key={i}>{content}</span>;
  })}</div>;
}
