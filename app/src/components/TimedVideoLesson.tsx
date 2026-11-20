import { useLearningActivity } from '../lib/learningSensors/useLearningActivity';
import type { SensorContext } from '../lib/learningSensors/core';
import { useRef, useState } from 'react';
import PlainTeachingVideo, { type TeachingVideoControl } from './PlainTeachingVideo';
import { nextVideoQuestion, sentenceWords, shuffledWordIndices, type VideoQuestion } from '../lib/videoQuestions';
import type { VideoSlide } from '../lib/types';
import '../styles/video-questions.css';

export function VideoQuestionCard({ question: q, pause, replay, continuing, replaying = false, observe, observation, cancelReplay }: { question: VideoQuestion; cancelReplay?:()=>void; pause: () => void; replay?: () => void; continuing: () => void; replaying?: boolean; observe?: (action: 'submitted' | 'revealed' | 'audio') => void; observation?: {context:SensorContext;position:number;question:number} }) {
  const sensor=useLearningActivity(observation?.context,observation?.position??null,observation?.question??null);
  const report=(action:'submitted'|'revealed'|'audio')=>{sensor(action);observe?.(action);};
  const [choice, setChoice] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [order, setOrder] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [shuffled] = useState(() => q.kind === 'scramble' ? shuffledWordIndices(q.sentence) : []);
  const words = q.kind === 'cloze' || q.kind === 'scramble' ? sentenceWords(q.sentence) : [];
  const reveal = () => { pause(); setRevealed(true); report('revealed'); };
  return <section className="vq-question" aria-label="영상 중간 질문" aria-busy={replaying}>
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
      <button disabled={replaying} className="vq-primary" onClick={continuing}>계속 보기</button>
    </div>
    {replaying && <p role="status">질문 장면을 다시 보고 있어요. <button onClick={cancelReplay}>다시 보기 멈추기</button></p>}
  </section>;
}

export default function TimedVideoLesson({ slide, source = '', previewQuestion, observe, observation }: { slide: VideoSlide; source?: string; previewQuestion?: VideoQuestion; observe?: (action: 'shown' | 'submitted' | 'revealed' | 'audio', question: VideoQuestion) => void; observation?:{lessonId:string;position:number} }) {
  const [playerKey] = useState(() => crypto.randomUUID());
  const player = useRef<TeachingVideoControl | null>(null);
  const served = useRef(new Set<string>());
  const [active, setActive] = useState<VideoQuestion | null>(null);
  const activeRef = useRef<VideoQuestion | null>(null);
  const replaying = useRef(false);
  const replayEntered=useRef(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const questions = previewQuestion ? [previewQuestion] : slide.timedQuestions ?? [];
  const pause = () => player.current?.pause();
  const timeChanged = (time: number, playing: boolean, ended: boolean) => {
    if (replaying.current) {
      if (!replayEntered.current) {
        // YouTube seekTo is asynchronous: ignore the old paused question frame.
        if (playing && activeRef.current && (time < activeRef.current.at - .03 || time > activeRef.current.at + .2)) replayEntered.current=true;
        else return;
      }
      if (activeRef.current && time >= activeRef.current.at - .03) {
        pause(); player.current?.seek(activeRef.current.at); replaying.current = false; setIsReplaying(false);
      }
      return;
    }
    if (activeRef.current) { if (playing) pause(); return; }
    if (!playing && !ended) return;
    const next = nextVideoQuestion(questions, served.current, time);
    if (next) { pause(); player.current?.seek(next.at); activeRef.current = next; setActive(next); observe?.('shown', next); }
  };
  return <div className="vq-lesson">
    <div className="vq-player"><PlainTeachingVideo fullscreenDocument rememberKey={playerKey} videoUrl={slide.videoUrl} title={slide.title} start={slide.startSec} end={slide.endSec} simple source={source} controlRef={player} onTime={timeChanged} playbackLocked={!!active} onReady={() => { if (previewQuestion) player.current?.playFrom(Math.max(slide.startSec ?? 0, previewQuestion.at - 1)); }}/></div>
    {active && <VideoQuestionCard key={active.id} question={active} cancelReplay={()=>{pause();if(activeRef.current)player.current?.seek(activeRef.current.at);replaying.current=false;setIsReplaying(false);}} observation={observation&&!previewQuestion?{context:{source:'group',resource:observation.lessonId,credential:''},position:observation.position,question:questions.findIndex(q=>q.id===active.id)}:undefined} pause={pause} replaying={isReplaying} observe={action => observe?.(action, active)} replay={active.replayStart === undefined ? undefined : () => { replaying.current = true; replayEntered.current=false; setIsReplaying(true); player.current?.playFrom(active.replayStart!); }} continuing={() => { pause(); served.current.add(active.id); activeRef.current = null; setActive(null); player.current?.playFrom(active.at + .04); }}/>}
  </div>;
}
