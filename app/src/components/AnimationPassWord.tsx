import {useLayoutEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import AnimationActivityWindow from './AnimationActivityWindow';
import '../styles/animation-pass-word.css';

const durations={fast:450,normal:700,slow:1000} as const;
type Speed=keyof typeof durations;
type Phase='idle'|'running'|'finished'|'answer';

/** A speed press sends the current lesson word once; navigation never sends a word. */
export default function AnimationPassWord({words,observe,onList,onClose}:{onList:()=>void;onClose:()=>void;words:{word:string}[];observe?:(action:'shown'|'revealed')=>void}){
 const {t}=useTranslation();
 const [state,setState]=useState<{index:number;speed:Speed;run:number;phase:Phase}>({index:0,speed:'normal',run:0,phase:'idle'});
 const track=useRef<HTMLDivElement>(null),word=useRef<HTMLSpanElement>(null);
 const current=words[state.index]?.word;
 useLayoutEffect(()=>{
  if(state.phase!=='running'||!track.current||!word.current)return;
  const animation=word.current.animate([
   {transform:`translate(${-word.current.getBoundingClientRect().width}px, -50%)`},
   {transform:`translate(${track.current.clientWidth}px, -50%)`},
  ],{duration:durations[state.speed],easing:'linear',iterations:1});
  animation.onfinish=()=>setState(value=>value.run===state.run?{...value,phase:'finished'}:value);
  return()=>{animation.onfinish=null;animation.cancel();};
 },[state,current]);
 const footer=words.length>0&&<>
  <button aria-label={t('animationPass.previous')} disabled={state.index===0} onClick={()=>setState(value=>({...value,index:value.index-1,phase:'idle'}))}>← {t('episodeActivities.previous')}</button>
  <button disabled={state.phase!=='finished'&&state.phase!=='answer'} onClick={()=>{setState(value=>({...value,phase:'answer'}));observe?.('revealed');}}>{t('animationPass.answer')}</button>
  <button aria-label={t('animationPass.next')} disabled={state.index===words.length-1} onClick={()=>setState(value=>({...value,index:value.index+1,phase:'idle'}))}>{t('episodeActivities.next')} →</button>
 </>;
 return <AnimationActivityWindow title={t('episodeActivities.pass')} label="Pass the Word" onClose={onClose} onList={onList} footer={footer} progress={words.length?((state.index+1)+' / '+words.length):undefined}>
 {!words.length?<p role="status">{t('animationPass.empty')}</p>:<div className="animation-pass-word" data-phase={state.phase}>
  <div className="animation-pass-speeds" aria-label={t('animationPass.speed')}>
   {(['fast','normal','slow'] as const).map(speed=><button key={speed} aria-pressed={state.speed===speed} onClick={()=>{setState(value=>({...value,speed,run:value.run+1,phase:'running'}));observe?.('shown');}}>{t(`animationPass.${speed}`)}</button>)}
  </div>
  <div ref={track} className="animation-pass-track" aria-label={t('animationPass.track')}>
   {state.phase==='idle'&&<p>{t('animationPass.waiting')}</p>}
   <span ref={word} className="animation-pass-moving" lang="en" aria-hidden={state.phase!=='answer'}>{current}</span>
  </div>
 </div>}
 </AnimationActivityWindow>;
}
