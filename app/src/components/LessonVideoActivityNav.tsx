import {useTranslation} from 'react-i18next';
import {fetchVideoClips,type VideoClip} from '../lib/videoClips';
import {lessonActivityLabel} from '../lib/lessonActivityLabels';
import {useEffect,useState} from 'react';
import {useLessonRunner} from '../context/LessonRunnerContext';
import {VIDEO_CHROME_EVENT} from '../lib/videoChrome';
import '../styles/video-teaching.css';
/** Actual saved order only. Route changes leave the document fullscreen intact. */
export default function LessonVideoActivityNav(){
 const {t}=useTranslation();
 const [clips,setClips]=useState<VideoClip[]>([]);
 useEffect(()=>{let active=true;fetchVideoClips().then(rows=>{if(active)setClips(rows);}).catch(()=>{});return()=>{active=false;};},[]);
 const {runner,goTo}=useLessonRunner();const [visible,setVisible]=useState(true);
 useEffect(()=>{const change=(e:Event)=>setVisible((e as CustomEvent<boolean>).detail);window.addEventListener(VIDEO_CHROME_EVENT,change);return()=>window.removeEventListener(VIDEO_CHROME_EVENT,change);},[]);
 if(!runner||!runner.steps.some(s=>s.kind==='shadow'||s.kind==='video'))return null;
 // The runner appends a generic print shortcut. It is not a saved activity.
 const selectedSteps=runner.steps.map((step,index)=>({step,index})).filter(({step})=>!!step.slideId);
 return <nav data-lesson-video-nav style={{opacity:visible?1:0,pointerEvents:visible?'auto':'none'}} onPointerEnter={e=>{if(e.pointerType!=='touch')window.dispatchEvent(new CustomEvent('classbank:video-nav-focus',{detail:true}));}} onPointerLeave={()=>window.dispatchEvent(new CustomEvent('classbank:video-nav-focus',{detail:false}))} onFocusCapture={e=>{if(!(e.target as HTMLElement).matches(':focus-visible'))return;window.dispatchEvent(new CustomEvent('classbank:video-nav-focus',{detail:true}));}} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))window.dispatchEvent(new CustomEvent('classbank:video-nav-focus',{detail:false}));}}>{selectedSteps.map(({step,index:i})=><button type="button" key={`${step.slideId??'step'}:${i}`} aria-current={runner.stepIndex===i?'step':undefined} onClick={()=>goTo(i)}>{i+1}. {lessonActivityLabel(step,clips,t)}</button>)}</nav>;
}
