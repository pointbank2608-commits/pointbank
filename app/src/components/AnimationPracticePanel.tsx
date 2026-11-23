import {createPortal} from 'react-dom';
import AnimationActivityWindow from './AnimationActivityWindow';
import AnimationPracticeScramble from './AnimationPracticeScramble';
import AnimationActivityMenu from './AnimationActivityMenu';
import {useTranslation} from 'react-i18next';
import {speak} from '../lib/speech';
import {useMemo,useState} from 'react';
import type {VideoSlide} from '../lib/types';
import type {ShadowLine} from '../lib/shadowLines';
import {animationExpressionFits} from '../lib/animationSession';

export type PracticeSentence={en:string;ko:string;speaker?:string|null;start?:number;end?:number};
export default function AnimationPracticePanel({slide,lines,time,listen,pause,seek,onClose,observe,mode,onMode,captionHost}:{mode:string;onMode:(mode:string)=>void;captionHost:HTMLElement|null;slide:VideoSlide;lines:ShadowLine[];time:number;listen:(line:PracticeSentence,done:()=>void)=>void;pause:()=>void;seek:(line:PracticeSentence)=>void;onClose:()=>void;observe?:(action:'shown'|'submitted'|'revealed'|'audio')=>void}){
 const {t}=useTranslation();
 const [example,setExample]=useState(0),[answer,setAnswer]=useState(false);
 const setMode=onMode;const [index,setIndex]=useState(0),[phase,setPhase]=useState('ready'),[actor,setActor]=useState(''),[currentText,setCurrentText]=useState('');
 const expressions=useMemo(()=>slide.animationSession?.expressions??(slide.animationSession?.expression?[slide.animationSession.expression]:[]),[slide.animationSession]);
 const text=useMemo(()=>[...new Set([...(slide.animationSession?.practiceSentences??[]),...(slide.animationSession?.words.map(w=>('example' in w?String(w.example):''))??[])])].filter(Boolean).map(en=>({en,ko:''})),[slide]);
 const candidates:PracticeSentence[]=useMemo(()=>{
  const all:PracticeSentence[]=[...lines,...text.filter(t=>!lines.some(l=>l.en===t.en))];
  if(mode==='follow'||mode==='cloze'||mode==='role')return lines;
  if(mode==='scramble')return all.filter(l=>l.en.trim().split(/\s+/).length>1);
  if(mode==='expression')return all.filter(l=>expressions.some(e=>animationExpressionFits(l.en,e)));
  return all;
 },[mode,lines,text,expressions]);
 const line=candidates[Math.min(index,Math.max(0,candidates.length-1))];
 const speakers=[...new Set(lines.map(l=>l.speaker).filter(Boolean))];
 const play=(next:PracticeSentence)=>{pause();setPhase('listening');listen(next,()=>setPhase('speak'));};
 const move=(next:number,playNow=true)=>{if(next<0||next>=candidates.length)return;pause();setIndex(next);setExample(0);setAnswer(false);setCurrentText(candidates[next].en);setPhase('ready');if(playNow&&candidates[next].start!==undefined)play(candidates[next]);else seek(candidates[next]);};
 const choose=(id:string)=>{pause();observe?.('shown');setMode(id);setExample(0);setAnswer(false);setPhase('ready');const collection:PracticeSentence[]=id==='expression'?[...lines,...text].filter(l=>expressions.some(e=>animationExpressionFits(l.en,e))):id==='scramble'?[...lines,...text].filter(l=>l.en.split(/\s+/).length>1):lines;const same=collection.findIndex(l=>l.en===currentText);const current=collection.findIndex(l=>l.start!==undefined&&l.start<=time&&l.end!>time);const at=same>=0?same:current>=0?current:collection.findLastIndex(l=>l.start!==undefined&&l.start<=time);setIndex(Math.max(0,at));setCurrentText(collection[Math.max(0,at)]?.en??'');if(collection[Math.max(0,at)])seek(collection[Math.max(0,at)]);};
 const expression=line&&expressions.find(e=>animationExpressionFits(line.en,e));
 if(mode==='follow')return captionHost?createPortal(<section className="classroom-follow" aria-label="듣고 따라 말하기">
  <div className="classroom-follow-line"><button aria-label="이전 문장" disabled={!line||index===0} onClick={()=>move(index-1,false)}>❮</button><div className="classroom-follow-text">{line?<><p lang="en">{line.en.replace(/\*\*/g,'')}</p><p lang="ko">{line.ko||'등록된 한글 해석이 없어요.'}</p></>:<p>이 구간에는 시간이 등록된 대사가 없어요.</p>}</div><button aria-label="다음 문장" disabled={!line||index===candidates.length-1} onClick={()=>move(index+1,false)}>❯</button></div>
  <footer><span>{line?index+1:0}/{candidates.length}</span><button disabled={!line} onClick={()=>line&&play(line)}>{phase==='speak'?'다시 듣기':'이 문장 듣기'}</button><span role="status">{phase==='speak'?'따라 말해 보세요':phase==='listening'?'대사를 듣고 있어요.':''}</span><button onClick={()=>{pause();setMode('');}}>활동 목록</button><button onClick={()=>{pause();onClose();}}>닫기</button></footer>
 </section>,captionHost):null;
 const leave=()=>{pause();setMode('');};
 if(!mode)return <AnimationActivityWindow title={t('episodeActivities.practice')} label="문장 연습 패널" onClose={onClose}><AnimationActivityMenu kind="practice" choose={choose}/></AnimationActivityWindow>;
 const english=line?.en.replace(/\*\*/g,'')??'';
 const tokens=english.split(/\s+/);
 const marked=line?.en.indexOf('**')??-1;
 const blank=marked>=0?(line?.en.slice(0,marked).trim().split(/\s+/).filter(Boolean).length??0):Math.min(1,tokens.length-1);
 const selectedExample=expression?.examples[example];
 const stem=expression?.text.split(/…|\.{3}/)[0].trim()??'';
 function parts(answer:string) {
   const prefix=stem&&answer.toLowerCase().startsWith(stem.toLowerCase())?answer.slice(0,stem.length):'';
   return [prefix,answer.slice(prefix.length).trim()];
 }
 function nextLine() {
   if(mode==='role'&&actor) {
     let n=index+1;
     const run=()=>{if(n>=candidates.length)return;const next=candidates[n];setIndex(n);setCurrentText(next.en);
       if(next.speaker===actor){pause();seek(next);setPhase('ready');return;}
       setPhase('listening');listen(next,()=>{n++;run();});
     };run();
   }else move(index+1,false);
 }
 const footer=line&&<>
   <button disabled={index===0} onClick={()=>move(index-1,false)}>← {t('episodeActivities.previous')}</button>
   {mode==='expression'&&selectedExample?<button onClick={()=>{pause();observe?.('audio');speak(selectedExample.answer);}}>{t('episodeActivities.listen')}</button>:
    mode!=='scramble'&&line.start!==undefined&&line.end!==undefined&&<button onClick={()=>play(line)}>{t(phase==='speak'?'episodeActivities.repeat':'episodeActivities.listen')}</button>}
   <button disabled={index===candidates.length-1} onClick={nextLine}>{t('episodeActivities.next')} →</button>
 </>;
 return <AnimationActivityWindow title={t('episodeActivities.'+mode)} label="문장 연습 패널" onList={leave} onClose={()=>{pause();onClose();}}
    progress={line?((index+1)+' / '+candidates.length):undefined} footer={footer}>
   {!line?<p role="status">{mode==='expression'?'이 챕터에는 등록된 표현 바꾸기 문장이 없어요.':'이 활동에 사용할 대사가 없어요.'}</p>:
   <div className="episode-practice-content">
     {mode==='scramble'&&<AnimationPracticeScramble key={index+english} en={english} ko={line.ko} observe={()=>observe?.('submitted')}/>}
     {mode==='cloze'&&<><p>{t('episodeActivities.blankHint')}</p><div className="episode-sentence-board"><h3 lang="en">{tokens.map((token,i)=>i===blank&&!answer?'____':token).join(' ')}</h3>{answer&&<p>{line.ko}</p>}</div>
       <button aria-pressed={answer} onClick={()=>{pause();setAnswer(true);observe?.('revealed');}}>{t('animationPass.answer')}</button></>}
     {mode==='expression'&&expression&&<><p>{t('episodeActivities.changeHint')}</p><div className="episode-sentence-board">
       <h3 lang="en">{parts(selectedExample?.answer??english)[0]} <em>{parts(selectedExample?.answer??english)[1]}</em></h3><p>{selectedExample?.situation??expression.explanation}</p></div>
       <div className="episode-choice-row">{expression.examples.map((e,i)=><button key={e.answer} aria-pressed={example===i} onClick={()=>{pause();setExample(i);}}>{parts(e.answer)[1]}</button>)}</div></>}
     {mode==='role'&&<><div className="episode-choice-row">{t('episodeActivities.myRole')} {speakers.map(s=><button key={s} aria-pressed={(actor||speakers[0])===s} onClick={()=>{pause();setActor(s!);}}>{s}</button>)}</div>
       <div className="episode-sentence-board"><small>{line.speaker}{line.speaker&&(actor||speakers[0])===line.speaker?' · '+t('episodeActivities.myTurn'):''}</small><h3 lang="en">{english}</h3><p>{line.ko}</p></div></>}
   </div>}
 </AnimationActivityWindow>;
}
