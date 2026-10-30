import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import AccessibleDialog from '../AccessibleDialog';
import StemFrameView from './StemFrameView';
import type {StemLesson} from '../../lib/stemTypes';

export default function StemPlayer({lesson,onClose,onRunSaved,initialIndex=0}:{lesson:StemLesson;onClose:()=>void;onRunSaved?:(index:number)=>void;initialIndex?:number}){
 const {t}=useTranslation();const [index,setIndex]=useState(()=>Math.max(0,Math.min(initialIndex,lesson.frames.length-1))),[running,setRunning]=useState(false);const box=useRef<HTMLDivElement>(null);
 const frame=lesson.frames[index];
 const exit=()=>{if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});setRunning(false);};
 useEffect(()=>()=>{if(document.fullscreenElement===box.current)void document.exitFullscreen().catch(()=>{});},[]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(!running||e.target instanceof HTMLElement&&e.target.closest('button,input,textarea,select')||document.querySelectorAll('dialog[open]').length>1)return;if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();setIndex(i=>Math.min(i+1,lesson.frames.length-1));}if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();setIndex(i=>Math.max(i-1,0));}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[running,lesson.frames.length]);
 function start(){if(frame.mode==='game'&&onRunSaved){onRunSaved(index);return;}setRunning(true);void box.current?.requestFullscreen?.().catch(()=>{});}
 return <AccessibleDialog label={lesson.meta.title} onClose={()=>running?exit():onClose()}><div ref={box} className={`stem-player ${running?'is-running':''}`}>
  <div className="stem-toolbar"><span className="stem-player-title">{lesson.meta.title}</span><div className="stem-actions">{running&&<button onClick={exit}>{t('stem.exitFullscreen')}</button>}<button onClick={()=>{exit();onClose();}}>{t('stem.back')}</button></div></div>
  <div className="stem-stage-fit"><StemFrameView key={frame.id} frame={frame} meta={lesson.meta} interactive={running}/>{!running&&<div className="stem-start-overlay"><button className="stem-primary" disabled={frame.mode==='game'&&!onRunSaved} onClick={start}>{t(frame.mode==='game'&&!onRunSaved?'stem.saveFirst':'stem.start')}</button></div>}</div>
  <div className="stem-toolbar"><button onClick={()=>setIndex(i=>i-1)} disabled={!index}>{t('stem.previous')}</button><span aria-live="polite">{t('stem.presentCount',{n:index+1,total:lesson.frames.length})}</span><button onClick={()=>setIndex(i=>i+1)} disabled={index===lesson.frames.length-1}>{t('stem.next')}</button></div>
  {!running&&<div className="stem-preview-strip">{lesson.frames.map((f,i)=><button key={f.id} aria-current={index===i} aria-label={`${i+1}. ${f.title}`} onClick={()=>setIndex(i)}>{i+1}</button>)}</div>}
  {running&&frame.mode==='game'&&onRunSaved&&<button onClick={()=>onRunSaved(index)}>{t('stem.start')}</button>}
 </div></AccessibleDialog>;
}
