import {useEffect,useState} from 'react';
import {useLessonRunner} from '../context/LessonRunnerContext';
import {VIDEO_CHROME_EVENT} from '../lib/videoChrome';
import '../styles/video-teaching.css';
/** Actual saved order only. Route changes leave the document fullscreen intact. */
export default function LessonVideoActivityNav(){
 const {runner,goTo}=useLessonRunner();const [visible,setVisible]=useState(true);
 useEffect(()=>{const change=(e:Event)=>setVisible((e as CustomEvent<boolean>).detail);window.addEventListener(VIDEO_CHROME_EVENT,change);return()=>window.removeEventListener(VIDEO_CHROME_EVENT,change);},[]);
 if(!runner||!runner.steps.some(s=>s.kind==='shadow'||s.kind==='video'))return null;
 return <nav data-lesson-video-nav style={{opacity:visible?1:0,pointerEvents:visible?'auto':'none'}} onMouseEnter={()=>window.dispatchEvent(new CustomEvent('classbank:video-nav-focus',{detail:true}))} onMouseLeave={()=>window.dispatchEvent(new CustomEvent('classbank:video-nav-focus',{detail:false}))} onFocusCapture={()=>window.dispatchEvent(new CustomEvent('classbank:video-nav-focus',{detail:true}))} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))window.dispatchEvent(new CustomEvent('classbank:video-nav-focus',{detail:false}));}}>{runner.steps.map((step,i)=><button type="button" key={step.slideId??i} aria-current={runner.stepIndex===i?'step':undefined} onClick={()=>goTo(i)}>{i+1}. {step.label}</button>)}</nav>;
}
