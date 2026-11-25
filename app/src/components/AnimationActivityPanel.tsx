import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import AnimationActivityWindow from './AnimationActivityWindow';
import AnimationSentenceCard from './AnimationSentenceCard';
import AnimationActivityMenu from './AnimationActivityMenu';
import AnimationPassWord from './AnimationPassWord';
import AnimationWordCards from './AnimationWordCards';
import AnimationScenePeek from './AnimationScenePeek';
import AnimationMissingCards from './AnimationMissingCards';
import {speak} from '../lib/speech';
import type {VideoSlide} from '../lib/types';
import type {PracticeSentence} from './AnimationPracticePanel';

type Props={
  kind:'words'|'review';slide:VideoSlide;line?:PracticeSentence;listen:()=>void;onClose:()=>void;
  review:string;setReview:(mode:string)=>void;captionHost:HTMLElement|null;
  times:number[];getTime:()=>number;pause:()=>void;seek:(time:number)=>void;
  observe?:(action:'shown'|'revealed'|'audio')=>void
};
export default function AnimationActivityPanel({kind,review,setReview,captionHost,slide,line,listen,onClose,observe,times,getTime,pause,seek}:Props){
 const {t}=useTranslation();
 const words=slide.animationSession?.words??[];
 const [revealed,setRevealed]=useState(false),[sceneTime,setSceneTime]=useState(0);
 function open(id:string) {
   if(id==='scene') {
     pause();
     const current=getTime();
     const outside=slide.chapters?.length&&!slide.chapters.some(ch=>ch.selected!==false&&current>=ch.start&&current<ch.end);
     const first=times[0]??slide.chapters?.find(ch=>ch.selected!==false)?.start??current;
     const initial=outside||current<first?first:current;
     if(initial!==current)seek(initial);
     setSceneTime(initial);
   }
   setRevealed(false);setReview(id);
 }
 const list=()=>setReview('');
 if(kind==='words')return <AnimationWordCards words={words} onClose={onClose} onReveal={()=>observe?.('revealed')} pronounce={word=>{observe?.('audio');speak(word);}}/>;
 if(review==='scene')return <AnimationScenePeek sceneTime={sceneTime} times={times} onScene={time=>{seek(time);setSceneTime(time);}} onReveal={()=>{pause();observe?.('revealed');}} onList={list} onClose={onClose}/>;
 if(review==='pass')return <AnimationPassWord words={words} observe={observe} onClose={onClose} onList={list}/>;
 if(review==='missing')return <AnimationMissingCards words={words} observe={observe} onClose={onClose} onList={list}/>;
 if(!review)return <AnimationActivityWindow title={t('episodeActivities.review')} label="복습 활동 패널" onClose={onClose}><AnimationActivityMenu kind="review" choose={open}/></AnimationActivityWindow>;
 const tokens=line?.en.replace(/\*\*/g,'').split(/\s+/)??[];
 const gapIndex=Math.max(0,tokens.findIndex(token=>words.some(w=>w.word.toLowerCase()===token.toLowerCase().replace(/[^a-z]/g,''))));
 const actions=line&&<>
   {line.start!==undefined&&line.end!==undefined&&<button className="sentence-primary" onClick={listen}>대사 듣기</button>}
   <button onClick={()=>{setRevealed(true);observe?.('revealed');}}>{t('animationPass.answer')}</button>
 </>;
 return <AnimationSentenceCard host={captionHost} title={t('episodeActivities.gap')} actions={actions} onClose={onClose} onList={list}>
   {line?<><h3 lang="en">{tokens.map((token,i)=>!revealed&&i===gapIndex?'____':token).join(' ')}</h3>
     {revealed&&<p>빠진 단어: {tokens[gapIndex]}</p>}</>:<p role="status">이 챕터에 문장 자료가 없어요. 다른 복습 활동은 선택한 단어로 진행할 수 있어요.</p>}
 </AnimationSentenceCard>;
}
