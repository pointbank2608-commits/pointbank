import { useLearningActivity } from '../lib/learningSensors/useLearningActivity';
import type { SensorContext } from '../lib/learningSensors/core';
import { useMemo, useRef, useState } from 'react';
import { parseShadowText, shadowLineAtTime } from '../lib/shadowLines';
import { VideoControl } from './TeachingVideoFrame';
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
  const [playerKey] = useState(() => crypto.randomUUID());
  const player = useRef<TeachingVideoControl | null>(null);
  const practiceSensor = useLearningActivity(observation && !previewQuestion ? {source:'group',resource:observation.lessonId,credential:''} : undefined, observation?.position ?? null, null);
  const served = useRef(new Set<string>());
  const [ready,setReady] = useState(false);
  const [active, setActive] = useState<VideoQuestion | null>(previewQuestion ?? null);
  const activeRef = useRef<VideoQuestion | null>(previewQuestion ?? null);
  const replaying = useRef(false);
  const replayEntered = useRef(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const questions = sortedQuestions(previewQuestion ? [previewQuestion] : slide.timedQuestions ?? []);
  const lines = useMemo(() => parseShadowText(source).filter(line => line.start >= (slide.startSec ?? 0) && line.end <= (slide.endSec ?? Infinity)),[source,slide.startSec,slide.endSec]);
  const [practice,setPractice] = useState<Practice|null>(null);
  const practiceRef = useRef<Practice|null>(null);
  const updatePractice = (next:Practice|null) => { practiceRef.current=next;setPractice(next); };
  const pause = () => player.current?.pause();
  const dismissQuestion = () => { if(activeRef.current)served.current.add(activeRef.current.id);activeRef.current=null;setActive(null); };
  const resumeQuestion = () => {
    if(!activeRef.current)return false;
    const time=activeRef.current.at;pause();replaying.current=false;setIsReplaying(false);dismissQuestion();player.current?.playFrom(time+.04);return true;
  };
  const timeChanged = (time: number, playing: boolean, ended: boolean) => {
    const currentPractice=practiceRef.current;
    if(currentPractice){
      const line=lines[currentPractice.index];
      if(!line)return;
      if(currentPractice.phase==='seeking'){
        if(Math.abs(time-(currentPractice.target??line.start))<.35)updatePractice({...currentPractice,phase:'ready'});
      }else if(currentPractice.phase==='listening' && (playing||ended) && time>=line.end-.02){
        pause();player.current?.seek(Math.max(line.start,line.end-.04));updatePractice({...currentPractice,phase:'speak',heard:true});
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
    if(!playing&&!ended)return;
    const next=nextVideoQuestion(questions,served.current,time);
    if(next){pause();player.current?.seek(next.at);activeRef.current=next;setActive(next);if(!previewQuestion)observe?.('shown',next);}
  };
  const openPractice = () => {
    pause();replaying.current=false;setIsReplaying(false);dismissQuestion();
    updatePractice({index:shadowLineAtTime(lines,player.current?.getTime()??slide.startSec??0),phase:'ready',heard:false});
  };
  const moveLine = (index:number) => {
    if(index<0||index>=lines.length)return;
    pause();updatePractice({index,phase:'seeking',heard:false});player.current?.seek(lines[index].start);
  };
  const listen = () => {
    if(!practice)return;
    if(practice.phase==='listening'){pause();updatePractice({...practice,phase:'ready'});return;}
    practiceSensor('audio');updatePractice({...practice,phase:'listening'});player.current?.playFrom(lines[practice.index].start);
  };
  const returnVideo = () => {
    pause();const time=player.current?.getTime()??0;
    questions.filter(q=>q.at<=time+.03).forEach(q=>served.current.add(q.id));updatePractice(null);
  };
  const line=practice?lines[practice.index]:undefined;
  const card=active&&<div className="vq-overlay" data-active-question={active.id}><strong className="vq-question-number">질문 {questions.findIndex(q=>q.id===active.id)+1}</strong><VideoQuestionCard key={active.id} question={active} cancelReplay={()=>{pause();if(activeRef.current)player.current?.seek(activeRef.current.at);replaying.current=false;setIsReplaying(false);}} observation={observation&&!previewQuestion?{context:{source:'group',resource:observation.lessonId,credential:''},position:observation.position,question:questions.findIndex(q=>q.id===active.id)}:undefined} pause={pause} replaying={isReplaying} observe={action=>{if(!previewQuestion)observe?.(action,active);}} replay={active.replayStart===undefined||!Number.isFinite(active.replayStart)||active.replayStart<(slide.startSec??0)||active.replayStart>=active.at?undefined:()=>{replaying.current=true;replayEntered.current=false;setIsReplaying(true);player.current?.playFrom(active.replayStart!);}}/></div>;
  return <div className="vq-lesson vq-classroom" data-shadow-mode={!!practice}>
    <div className="vq-player"><PlainTeachingVideo fullscreenDocument rememberKey={playerKey} videoUrl={slide.videoUrl} title={slide.title} start={slide.startSec} end={slide.endSec} simple source={source} controlRef={player} onSeek={time=>{if(practiceRef.current)updatePractice({index:shadowLineAtTime(lines,time),phase:"seeking",heard:false,target:time});}} onTime={timeChanged} playbackLocked={!!active} onResume={resumeQuestion} overlay={card} compactControls settingsLabel="수업 설정" activeQuestionId={active?.id} lockedTime={active&&!isReplaying?active.at:undefined} questionMarkers={questions} onQuestionMarker={id=>{const q=questions.find(q=>q.id===id);if(!q||practiceRef.current)return;pause();player.current?.seek(q.at);activeRef.current=q;setActive(q);}} onReady={()=>{setReady(true);if(previewQuestion)player.current?.seek(previewQuestion.at);else if(autoPlay)player.current?.playFrom(slide.startSec??0);}}
      practice={practice&&line?<section className="vq-practice" aria-label="듣고 따라 하기 대사"><strong>{practice.index+1}/{lines.length}</strong><div>{practice.phase==='seeking'?<p role="status">문장 장면을 불러오고 있어요.</p>:<><p lang="en">{line.en.replace(/\*\*/g,'')}</p><p lang="ko">{line.ko}</p></>}{practice.phase==='speak'&&<p role="status">따라 말해 보세요.</p>}</div></section>:undefined}
      mainControls={practice?<><VideoControl name="skip_previous" label="이전 문장" onClick={()=>moveLine(practice.index-1)} disabled={!ready||practice.index===0||practice.phase==='seeking'}/><VideoControl primary name={practice.phase==='listening'?'pause':'play_arrow'} label={practice.phase==='listening'?'일시정지':practice.heard?'다시 듣기':'이 문장 듣기'} onClick={listen} disabled={!ready||practice.phase==='seeking'}/><VideoControl name="skip_next" label="다음 문장" onClick={()=>moveLine(practice.index+1)} disabled={!ready||practice.index===lines.length-1||practice.phase==='seeking'}/></>:undefined}
      tools={lines.length>0&&!previewQuestion?<button type="button" className="vq-practice-toggle" disabled={!ready} onClick={practice?returnVideo:openPractice}>{practice?'영상으로 돌아가기':'듣고 따라 하기'}</button>:undefined}/></div>
  </div>;
}
