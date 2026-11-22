import {createPortal} from 'react-dom';
import AnimationActivityWindow from './AnimationActivityWindow';
import {useEffect,useMemo,useState} from 'react';
import type {VideoSlide} from '../lib/types';
import type {ShadowLine} from '../lib/shadowLines';
import {animationExpressionFits} from '../lib/animationSession';
import {VideoQuestionCard} from './TimedVideoLesson';
export type PracticeSentence={en:string;ko:string;speaker?:string|null;start?:number;end?:number};
export default function AnimationPracticePanel({slide,lines,time,listen,pause,seek,onClose,observe,mode,onMode,captionHost}:{mode:string;onMode:(mode:string)=>void;captionHost:HTMLElement|null;slide:VideoSlide;lines:ShadowLine[];time:number;listen:(line:PracticeSentence,done:()=>void)=>void;pause:()=>void;seek:(line:PracticeSentence)=>void;onClose:()=>void;observe?:(action:'shown'|'submitted'|'revealed'|'audio')=>void}){
 const setMode=onMode;const [index,setIndex]=useState(0),[phase,setPhase]=useState('ready'),[seconds,setSeconds]=useState(0),[actor,setActor]=useState(''),[currentText,setCurrentText]=useState('');
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
 useEffect(()=>{if(phase!=='speak')return;setSeconds(3);const t=setInterval(()=>setSeconds(s=>Math.max(0,s-1)),1000);return()=>clearInterval(t);},[phase,index]);
 const play=(next:PracticeSentence)=>{pause();setPhase('listening');listen(next,()=>setPhase('speak'));};
 const move=(next:number,playNow=true)=>{if(next<0||next>=candidates.length)return;pause();setIndex(next);setCurrentText(candidates[next].en);setPhase('ready');if(playNow&&candidates[next].start!==undefined)play(candidates[next]);else seek(candidates[next]);};
 const choose=(id:string)=>{pause();observe?.('shown');setMode(id);setPhase('ready');const collection:PracticeSentence[]=id==='expression'?[...lines,...text].filter(l=>expressions.some(e=>animationExpressionFits(l.en,e))):id==='scramble'?[...lines,...text].filter(l=>l.en.split(/\s+/).length>1):lines;const same=collection.findIndex(l=>l.en===currentText);const current=collection.findIndex(l=>l.start!==undefined&&l.start<=time&&l.end!>time);const at=same>=0?same:current>=0?current:collection.findLastIndex(l=>l.start!==undefined&&l.start<=time);setIndex(Math.max(0,at));setCurrentText(collection[Math.max(0,at)]?.en??'');if(collection[Math.max(0,at)])seek(collection[Math.max(0,at)]);};
 const expression=line&&expressions.find(e=>animationExpressionFits(line.en,e));
 if(mode==='follow')return captionHost?createPortal(<section className="classroom-follow" aria-label="듣고 따라 말하기">
  <div className="classroom-follow-line"><button aria-label="이전 문장" disabled={!line||index===0} onClick={()=>move(index-1,false)}>❮</button><div className="classroom-follow-text">{line?<><p lang="en">{line.en}</p><p lang="ko">{line.ko||'등록된 한글 해석이 없어요.'}</p></>:<p>이 구간에는 시간이 등록된 대사가 없어요.</p>}</div><button aria-label="다음 문장" disabled={!line||index===candidates.length-1} onClick={()=>move(index+1,false)}>❯</button></div>
  <footer><span>{line?index+1:0}/{candidates.length}</span><button disabled={!line} onClick={()=>line&&play(line)}>{phase==='speak'?'다시 듣기':'이 문장 듣기'}</button><span role="status">{phase==='speak'?'따라 말해 보세요':phase==='listening'?'대사를 듣고 있어요.':''}</span><button onClick={()=>{pause();setMode('');}}>활동 목록</button><button onClick={()=>{pause();onClose();}}>닫기</button></footer>
 </section>,captionHost):null;
 return <AnimationActivityWindow title={mode?'문장 연습':'문장 연습 활동 선택'} label="문장 연습 패널" onClose={()=>{pause();onClose();}}>
  {!mode?<div className="animation-review-grid">{[['follow','듣고 따라 말하기'],['cloze','빈칸 듣기'],['scramble','문장 순서 맞추기'],['expression','표현 바꿔 말하기']].map(([id,label])=><button key={id} onClick={()=>choose(id)}>{label}</button>)}{speakers.length>=2&&<button onClick={()=>choose('role')}>역할 나누기</button>}</div>:<>
   <button onClick={()=>{pause();setMode('');}}>← 활동 목록</button>
   {!line?<p role="status">{mode==='expression'?'이 챕터에는 등록된 표현 바꾸기 문장이 없어요.':'이 활동에 사용할 실제 대사와 음성 구간이 없어요. 문장 순서 맞추기나 표현 바꾸기는 등록된 문장만 있어도 사용할 수 있어요.'}</p>:<>
    <p>{index+1}/{candidates.length} · {mode==='follow'?'듣고 따라 말하기':mode==='cloze'?'빈칸 듣기':mode==='scramble'?'문장 순서 맞추기':mode==='role'?'역할 나누기':'표현 바꿔 말하기'}</p>
    {['follow','expression','role'].includes(mode)&&<p className="vq-sentence">{line.en}</p>}{line.ko&&<p>{line.ko}</p>}
    {mode==='follow'&&phase==='speak'&&<p role="status">따라 말해요 · {seconds||'다음 문장을 기다려요'}</p>}
    {(mode==='cloze'||mode==='scramble')&&<VideoQuestionCard key={mode+index+line.en} pause={()=>{pause();setPhase('ready');}} observe={observe} question={mode==='cloze'?{id:'practice',kind:'cloze',at:line.end??0,sentence:line.en,hiddenWordIndices:[Math.min(1,line.en.trim().split(/\s+/).length-1)]}:{id:'practice',kind:'scramble',at:line.end??0,sentence:line.en}}/>}
    {mode==='expression'&&expression&&<div><strong>{expression.text}</strong><p>{expression.explanation}</p>{expression.examples.map(e=><p key={e.answer}>{e.situation} → {e.answer}</p>)}</div>}
    {mode==='role'&&<><label>내 역할<select value={actor} onChange={e=>setActor(e.target.value)}><option value="">인물을 선택하세요</option>{speakers.map(s=><option key={s} value={s!}>{s}</option>)}</select></label>{actor===line.speaker&&<p>내 차례 · {line.en}</p>}</>}
    {phase==='listening'&&<p role="status">대사를 듣고 있어요.</p>}
    <div className="vq-actions"><button disabled={index===0} onClick={()=>move(index-1,false)}>‹ 이전</button>{line.start!==undefined&&line.end!==undefined?<button onClick={()=>play(line)}>{phase==='speak'?'↻ 다시 듣기':'이 문장 듣기'}</button>:<small>문장 재생 시간이 없어 듣기 없이 진행해요.</small>}<button disabled={index===candidates.length-1} onClick={()=>{
      if(mode==='role'&&actor){let n=index+1;const run=()=>{if(n>=candidates.length)return;setIndex(n);const l=candidates[n];if(l.speaker===actor){pause();seek(l);setPhase('ready');return;}setPhase('listening');listen(l,()=>{n++;run();});};run();}else move(index+1);
    }}>다음 ›</button></div>
   </>}
  </>}
 </AnimationActivityWindow>;
}
