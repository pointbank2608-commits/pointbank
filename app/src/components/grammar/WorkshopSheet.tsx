import {useState, type ReactNode} from 'react';
import type {GuidedPractice} from '../../data/doYouCanYou';
import AccessibleDialog from '../AccessibleDialog';
import {SceneMap} from './GuidedPracticePanel';
import './workshop-board.css';

export default function WorkshopSheet({grade,step,total,title,topic,prompt,map,children,footer,onMap,className=''}:{
  grade?:number;step:number;total:number;title:string;topic?:ReactNode;prompt:ReactNode;
  map?:GuidedPractice;children:ReactNode;footer?:ReactNode;onMap?:()=>void;className?:string;
}) {
  const [open,setOpen]=useState(false);
  const level=grade ? (grade<=6?'초'+grade:grade<=9?'중'+(grade-6):'고'+(grade-9))+' ' : '';
  return <section className={'workshop-board '+className} aria-label="문법 수업"><div className="workshop-sheet">
    <header><strong>클래스뱅크 · {level}문법</strong>{map?.map?.length && step<total-1 ?
      <button type="button" onClick={()=>{setOpen(true);onMap?.();}}>장면 지도 열기</button>:null}</header>
    <progress max={total} value={step+1} aria-label="수업 진행"/>
    <div className="workshop-body" key={step}>
      <div className="workshop-chapter"><span>{step+1} / {total}단계</span><small className="workshop-topic">{topic}</small></div>
      <h2>{title}</h2>{prompt && <div className="workshop-prompt">{prompt}</div>}{children}
    </div>
    {footer && <footer>{footer}</footer>}
  </div>{open && map && <AccessibleDialog label="장면 지도" onClose={()=>setOpen(false)}>
    <section className="space-y-4 p-5"><h2 className="text-xl font-bold">장면 지도</h2>
      <div className="guided-practice"><SceneMap practice={map}/></div>
      <button type="button" className="rounded-lg border px-4 py-2" onClick={()=>setOpen(false)}>닫기</button>
    </section></AccessibleDialog>}</section>;
}
