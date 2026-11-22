import {useEffect,useState} from 'react';
import type {ShadowLine} from '../lib/shadowLines';
import type {VideoSlide} from '../lib/types';
import {VideoQuestionCard} from './TimedVideoLesson';
import {animationExpressionFits} from '../lib/animationSession';

export default function AnimationSentenceModes({line,lines,slide,phase,mode,onMode,onRole,pause,listen,observe}:{line:ShadowLine;lines:ShadowLine[];slide:VideoSlide;phase:string;mode:string;onMode:(v:string)=>void;onRole:(v:string)=>void;pause:()=>void;listen:()=>void;observe?:(action:'submitted'|'revealed'|'audio')=>void}){
 const [seconds,setSeconds]=useState(0),[actor,setActor]=useState('');
 useEffect(()=>{if(phase!=='speak')return;setSeconds(3);const t=setInterval(()=>setSeconds(v=>Math.max(0,v-1)),1000);return()=>clearInterval(t);},[phase,line.start]);
 const expressions=slide.animationSession?.expressions??(slide.animationSession?.expression?[slide.animationSession.expression]:[]);const expression=expressions.find(e=>animationExpressionFits(line.en,e));
 const sentence=line.en.replace(/\*\*/g,'');const speakers=[...new Set(lines.map(l=>l.speaker).filter(Boolean))];
 return <><div className="vq-actions">{[['follow','듣고 따라 말하기'],['cloze','빈칸 듣기'],['scramble','문장 순서 맞추기'],['expression','표현 바꿔 말하기'],['role','역할 나누기']].map(([id,label])=><button key={id} aria-pressed={mode===id} onClick={()=>onMode(id)}>{label}</button>)}</div>
 {mode==='follow'&&phase==='speak'&&<p role="status">따라 말해요 · {seconds||'다음 문장을 기다려요'}</p>}
 {(mode==='cloze'||mode==='scramble')&&(mode==='scramble'&&sentence.trim().split(/\s+/).length<2?<p>한 단어 대사예요. 다음 문장을 선택해 주세요.</p>:<VideoQuestionCard key={line.start+mode} question={mode==='cloze'?{id:'practice',kind:'cloze',at:line.end,sentence,hiddenWordIndices:[Math.min(1,sentence.trim().split(/\s+/).length-1)]}:{id:'practice',kind:'scramble',at:line.end,sentence}} pause={pause} observe={observe}/>)}
 {mode==='expression'&&(expression?expression.examples.map((ex,i)=><p key={i}>{ex.situation} → {ex.answer}</p>):<p>이 대사에는 등록된 표현 바꾸기 연습이 없어요.</p>)}
 {mode==='role'&&<>{speakers.length<2?<p>화자가 구분된 대화 구간이 필요해요.</p>:<label>내 역할<select value={actor} onChange={e=>{setActor(e.target.value);onRole(e.target.value);}}><option value="">인물을 선택하세요</option>{speakers.map(s=><option key={s} value={s!}>{s}</option>)}</select></label>}{actor===line.speaker&&<p>내 차례 · {sentence}</p>}<button onClick={listen}>원래 대사 듣기</button></>}
 </>;
}
