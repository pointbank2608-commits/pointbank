import { useLearningActivity } from '../lib/learningSensors/useLearningActivity';
import type { SensorContext } from '../lib/learningSensors/core';
import { useMemo, useRef, useState } from 'react';
import { shadowLineAtTime } from '../lib/shadowLines';
import { animationPracticeLines } from '../lib/animationSession';
import { VideoControl } from './TeachingVideoFrame';
import AnimationActivityPanel from './AnimationActivityPanel';
import AnimationSentenceModes from './AnimationSentenceModes';
import PlainTeachingVideo, { type TeachingVideoControl } from './PlainTeachingVideo';
import { nextVideoQuestion, sentenceWords, shuffledWordIndices, sortedQuestions, type VideoQuestion } from '../lib/videoQuestions';
import type { VideoSlide } from '../lib/types';
import '../styles/video-questions.css';

export function VideoQuestionCard({ question: q, pause, replay, replaying = false, observe, observation, cancelReplay }: { question: VideoQuestion; cancelReplay?:()=>void; pause: () => void; replay?: () => void; replaying?: boolean; observe?: (action: 'submitted' | 'revealed' | 'audio') => void; observation?: {context:SensorContext;position:number;question:number} }) {
  const sensor=useLearningActivity(observation?.context,observation?.position??null,observation?.question??null);
  const report=(action:'submitted'|'revealed'|'audio')=>{sensor(action);observe?.(action);};
  const [choice, setChoice] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [order, setOrder] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [shuffled] = useState(() => q.kind === 'scramble' ? shuffledWordIndices(q.sentence) : []);
  const words = q.kind === 'cloze' || q.kind === 'scramble' ? sentenceWords(q.sentence) : [];
  const reveal = () => { pause(); setRevealed(true); report('revealed'); };
  return <section className="vq-question" aria-label="영상 중간 질문" data-question-kind={q.kind} aria-busy={replaying}>
    <h3>{q.kind === 'spoken' || q.kind === 'choice' ? q.prompt : q.kind === 'cloze' ? '대사를 듣고 빈칸을 말해 보세요.' : '카드를 눌러 문장을 완성해 보세요.'}</h3>
    {q.kind === 'choice' && <div className="vq-choices">{q.choices.map((text, i) => <button key={i} aria-pressed={choice === i} disabled={replaying} className={revealed && i === q.answerIndex ? 'is-correct' : ''} onClick={() => { pause(); setChoice(i); report('submitted'); }}>{text}{revealed && i === q.answerIndex ? ' ✓' : ''}</button>)}</div>}
    {q.kind === 'cloze' && <p className="vq-sentence">{words.map((word, i) => <span key={i}>{!revealed && q.hiddenWordIndices.includes(i) ? '____' : word} </span>)}</p>}
    {q.kind === 'scramble' && <>
      <div className="vq-answer" aria-label="답안 줄">{order.map(i => <button key={i} disabled={replaying} onClick={() => { pause(); setOrder(order.filter(index => index !== i)); setChecked(null); }}>{words[i]}</button>)}</div>
      <div className="vq-choices" aria-label="단어 카드">{shuffled.map(i => <button key={i} disabled={order.includes(i) || replaying} onClick={() => { pause(); setOrder([...order, i]); setChecked(null); }}>{words[i]}</button>)}</div>
      {checked !== null && <p role="status">{checked ? '맞았어요!' : '순서를 바꾸어 다시 확인해 보세요.'}</p>}
      {revealed && <p className="vq-sentence">{q.sentence}</p>}
    </>}
    {q.kind === 'spoken' && revealed && <p className="vq-sentence">{q.modelAnswer}</p>}
    <div className="vq-actions">
      {replay && <button disabled={replaying} onClick={() => { report('audio'); replay(); }}>장면 다시 보기</button>}
      {q.kind === 'scramble' && <button disabled={replaying} onClick={() => { pause(); setChecked(order.map(i => words[i]).join(' ') === words.join(' ')); report('submitted'); }}>답 확인</button>}
      {(q.kind !== 'spoken' || q.modelAnswer?.trim()) && <button disabled={replaying} onClick={reveal}>{q.kind === 'spoken' ? '예시 답 보기' : '정답 보기'}</button>}

    </div>
    {replaying && <p role="status">질문 장면을 다시 보고 있어요. <button onClick={cancelReplay}>다시 보기 멈추기</button></p>}
  </section>;
}

type Practice = { index:number; phase:'ready'|'seeking'|'listening'|'speak'; heard:boolean;target?:number };
export default function TimedVideoLesson({ slide, source = '', previewQuestion, observe, observation, autoPlay = false }: { slide: VideoSlide; source?: string; previewQuestion?: VideoQuestion; observe?: (action: 'shown' | 'submitted' | 'revealed' | 'audio', question: VideoQuestion) => void; observation?:{lessonId:string;position:number};autoPlay?:boolean }) {
  source=slide.animationSession?.source??source;
  const [activity,setActivity]=useState<'video'|'words'|'review'>('video');
  const [questionsOn,setQuestionsOn]=useState(!!previewQuestion);
  const [practiceMode,setPracticeMode]=useState('follow');const [actor,setActor]=useState('');
  const [fullSource,setFullSource]=useState(false);const fullRef=useRef(false);const returnTime=useRef(0);
  const [playerKey] = useState(() => crypto.randomUUID());
  const player = useRef<TeachingVideoControl | null>(null);
  const practiceSensor = useLearningActivity(observation && !previewQuestion ? {source:'group',resource:observation.lessonId,credential:''} : undefined, observation?.position ?? null, null);
  const served = useRef(new Set<string>());
  const previousTime = useRef(slide.startSec ?? 0);
  const [ready,setReady] = useState(false);
  const [active, setActive] = useState<VideoQuestion | null>(previewQuestion ?? null);
  const activeRef = useRef<VideoQuestion | null>(previewQuestion ?? null);
  const replaying = useRef(false);
  const replayEntered = useRef(false);
  const roleHelp = useRef(false);
  const reviewPlayback = useRef<(typeof lines)[number] | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const questions = sortedQuestions(previewQuestion ? [previewQuestion] : slide.timedQuestions ?? []).filter(q => q.at >= (slide.startSec ?? 0) && q.at <= (slide.endSec ?? Infinity));
  const lines = useMemo(() => animationPracticeLines(source,slide.startSec,slide.endSec),[source,slide.startSec,slide.endSec]);
  const [practice,setPractice] = useState<Practice|null>(null);
  const practiceRef = useRef<Practice|null>(null);
  const updatePractice = (next:Practice|null) => { practiceRef.current=next;setPractice(next); };
  const pause = () => player.current?.pause();
  const dismissQuestion = () => { if(activeRef.current)served.current.add(activeRef.current.id);activeRef.current=null;setActive(null); };
  const resumeQuestion = () => {
    if(fullRef.current||!activeRef.current)return false;
    const time=activeRef.current.at;pause();replaying.current=false;setIsReplaying(false);dismissQuestion();player.current?.playFrom(time+.04);return true;
  };
  const timeChanged = (time: number, playing: boolean, ended: boolean) => {
    if(fullRef.current)return;
    const before = previousTime.current;
    previousTime.current = time;
    if (time < before - .35) questions.filter(q => q.at >= time - .03).forEach(q => served.current.delete(q.id));
    if(reviewPlayback.current){
      const segment=reviewPlayback.current;
      if((playing||ended)&&time>=segment.end-.02){pause();player.current?.seek(segment.end-.04);reviewPlayback.current=null;}
      return;
    }
    const currentPractice=practiceRef.current;
    if(currentPractice){
      const line=lines[currentPractice.index];
      if(!line)return;
      if(currentPractice.phase==='seeking'){
        if(Math.abs(time-(currentPractice.target??line.start))<.35)updatePractice({...currentPractice,phase:'ready'});
      }else if(currentPractice.phase==='listening' && (playing||ended) && time>=line.end-.02){
        if(practiceMode==='role'&&actor&&!roleHelp.current&&currentPractice.index+1<lines.length){const n=currentPractice.index+1;pause();const mine=lines[n].speaker===actor;updatePractice({index:n,phase:mine?'ready':'listening',heard:false});if(mine)player.current?.seek(lines[n].start);else player.current?.playFrom(lines[n].start);return;}roleHelp.current=false;pause();player.current?.seek(Math.max(line.start,line.end-.04));updatePractice({...currentPractice,phase:'speak',heard:true});
      }
      return;
    }
    if(replaying.current){
      if(!replayEntered.current){
        if(playing&&activeRef.current&&(time<activeRef.current.at-.03||time>activeRef.current.at+.2))replayEntered.current=true;else return;
      }
      if(activeRef.current&&time>=activeRef.current.at-.03){pause();player.current?.seek(activeRef.current.at);replaying.current=false;setIsReplaying(false);}return;
    }
    if(activeRef.current){if(playing)pause();return;}
    if(!questionsOn||activity!=='video')return;
    if(!playing&&!ended)return;
    const next=nextVideoQuestion(questions,served.current,time,Math.min(before,time));
    if(next){pause();player.current?.seek(next.at);activeRef.current=next;setActive(next);if(!previewQuestion)observe?.('shown',next);}
  };
  const openPractice = () => {
    if(!lines.length)return;
    pause();replaying.current=false;setIsReplaying(false);dismissQuestion();
    updatePractice({index:shadowLineAtTime(lines,player.current?.getTime()??slide.startSec??0),phase:'ready',heard:false});
  };
  const moveLine = (index:number) => {
    if(index<0||index>=lines.length)return;
    pause();updatePractice({index,phase:'seeking',heard:false});player.current?.seek(lines[index].start);
  };
  const nextPracticeLine = (from:number, direction:number, mode=practiceMode) => {
    let index=from+direction;
    while(index>=0&&index<lines.length&&mode==='scramble'&&sentenceWords(lines[index].en).length<2)index+=direction;
    return index>=0&&index<lines.length?index:-1;
  };
  const changePracticeMode = (mode:string) => {
    pause();practiceSensor('shown');setPracticeMode(mode);
    if(!practice)return;
    if(mode==='scramble'&&sentenceWords(lines[practice.index].en).length<2){
      const index=nextPracticeLine(practice.index,1,mode);
      if(index>=0){moveLine(index);return;}
    }
    updatePractice({...practice,phase:'ready'});
  };
  const advancePractice = () => {
    if(!practice)return;
    const index=nextPracticeLine(practice.index,1);
    if(index<0)return;
    const mine=practiceMode==='role'&&!!actor&&lines[index].speaker===actor;
    pause();updatePractice({index,phase:mine?'ready':'listening',heard:false});
    if(mine)player.current?.seek(lines[index].start);else player.current?.playFrom(lines[index].start);
  };
  const listen = (force=false) => {
    if(!practice)return;
    if(practice.phase==='listening'){pause();updatePractice({...practice,phase:'ready'});return;}
    if(practiceMode==='role'&&!force&&lines[practice.index].speaker===actor){pause();player.current?.seek(lines[practice.index].start);updatePractice({...practice,phase:'ready'});return;}
    roleHelp.current=force;practiceSensor('audio');updatePractice({...practice,phase:'listening'});player.current?.playFrom(lines[practice.index].start);
  };
  const line=practice?lines[practice.index]:undefined;
  const reviewLines=lines.filter(l=>sentenceWords(l.en).length>1);
  const reviewLine=reviewLines[shadowLineAtTime(reviewLines,player.current?.getTime()??slide.startSec??0)];
  const card=activity!=='video'?<AnimationActivityPanel kind={activity} slide={slide} line={reviewLine} observe={practiceSensor} listen={()=>{if(reviewLine){reviewPlayback.current=reviewLine;practiceSensor('audio');player.current?.playFrom(reviewLine.start);}}} onClose={()=>{pause();reviewPlayback.current=null;updatePractice(null);setActivity('video');}}/>:active&&<div className="vq-overlay" data-active-question={active.id}><strong className="vq-question-number">질문 {questions.findIndex(q=>q.id===active.id)+1}</strong><VideoQuestionCard key={active.id} question={active} cancelReplay={()=>{pause();if(activeRef.current)player.current?.seek(activeRef.current.at);replaying.current=false;setIsReplaying(false);}} observation={observation&&!previewQuestion?{context:{source:'group',resource:observation.lessonId,credential:''},position:observation.position,question:questions.findIndex(q=>q.id===active.id)}:undefined} pause={pause} replaying={isReplaying} observe={action=>{if(!previewQuestion)observe?.(action,active);}} replay={active.replayStart===undefined||!Number.isFinite(active.replayStart)||active.replayStart<(slide.startSec??0)||active.replayStart>=active.at?undefined:()=>{replaying.current=true;replayEntered.current=false;setIsReplaying(true);player.current?.playFrom(active.replayStart!);}}/></div>;
  return <div className="vq-lesson vq-classroom" data-shadow-mode={!!practice}>
    <div className="vq-player"><PlainTeachingVideo rememberKey={playerKey} videoUrl={slide.videoUrl} title={slide.title} start={slide.startSec} end={slide.endSec} simple source={source} controlRef={player} onSeek={time=>{previousTime.current=time;questions.filter(q=>q.at>=time-.03).forEach(q=>served.current.delete(q.id));if(practiceRef.current)updatePractice({index:shadowLineAtTime(lines,time),phase:"seeking",heard:false,target:time});}} onTime={timeChanged} playbackLocked={!!active&&!fullSource} onResume={resumeQuestion} overlay={<div hidden={fullSource}>{card}</div>} compactControls settingsLabel="설정" activeQuestionId={active?.id} lockedTime={active&&!isReplaying&&!fullSource?active.at:undefined} questionMarkers={questionsOn&&!fullSource?questions:[]} onQuestionMarker={id=>{const q=questions.find(q=>q.id===id);if(!q||practiceRef.current)return;pause();player.current?.seek(q.at);activeRef.current=q;setActive(q);}} onReady={()=>{setReady(true);if(previewQuestion)player.current?.seek(previewQuestion.at);else if(autoPlay)player.current?.playFrom(slide.startSec??0);}}
      practice={!fullSource&&practice&&line?<section className="vq-practice" aria-label="듣고 따라 하기 대사"><strong>{practice.index+1}/{lines.length}</strong><div><AnimationSentenceModes line={line} lines={lines} slide={slide} phase={practice.phase} mode={practiceMode} onMode={changePracticeMode} onRole={setActor} pause={pause} observe={practiceSensor} listen={()=>listen(true)}/>{practice.phase==='seeking'?<p role="status">문장 장면을 불러오고 있어요.</p>:<>{!['cloze','scramble'].includes(practiceMode)&&<p lang="en">{line.en.replace(/\*\*/g,'')}</p>}<p lang="ko">{line.ko}</p></>}</div></section>:undefined}
      mainControls={!fullSource&&practice?<><VideoControl name="skip_previous" label="‹ 이전" onClick={()=>moveLine(nextPracticeLine(practice.index,-1))} disabled={!ready||nextPracticeLine(practice.index,-1)<0||practice.phase==='seeking'}/><VideoControl primary name={practice.phase==='listening'?'pause':'play_arrow'} label={practice.phase==='listening'?'일시정지':'↻ 다시 듣기'} onClick={()=>listen()} disabled={!ready||practice.phase==='seeking'}/><VideoControl name="skip_next" label="다음 ›" onClick={advancePractice} disabled={!ready||nextPracticeLine(practice.index,1)<0||practice.phase==='seeking'}/></>:undefined}
      tools={<><button onClick={()=>{pause();if(!fullRef.current){returnTime.current=player.current?.getTime()??slide.startSec??0;player.current?.setRange(0,player.current?.getDuration()??0);fullRef.current=true;setFullSource(true);}else{player.current?.setRange(slide.startSec??0,slide.endSec??player.current.getDuration());player.current?.seek(returnTime.current);fullRef.current=false;setFullSource(false);}}}>{fullSource?'수업 구간으로 돌아가기':'원본 전체 보기'}</button><nav hidden={fullSource} className="animation-menu" aria-label="수업 활동">{[['video','영상 보기'],['words','단어'],['questions','질문과 함께 보기'],['practice','문장 연습'],['review','복습 활동']].map(([id,label])=><button key={id} aria-pressed={id==='questions'?questionsOn:id==='practice'?!!practice:activity===id&&!practice} onClick={()=>{reviewPlayback.current=null;if(id!=='questions')practiceSensor('shown');if(id==='questions'){if(questionsOn&&activeRef.current)resumeQuestion();setQuestionsOn(v=>!v);setActivity('video');updatePractice(null);dismissQuestion();return;}pause();if(id==='practice'){setActivity('video');openPractice();return;}updatePractice(null);if(id!=='video')dismissQuestion();setActivity(id as 'video'|'words'|'review');}}>{label}</button>)}</nav></>}/></div>
  </div>;
}
