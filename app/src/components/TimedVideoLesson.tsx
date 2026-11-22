import { useLearningActivity } from '../lib/learningSensors/useLearningActivity';
import type { SensorContext } from '../lib/learningSensors/core';
import { useState } from 'react';
import type {ComponentProps} from 'react';
import AnimationClassroomPlayer from './AnimationClassroomPlayer';
import { sentenceWords, shuffledWordIndices, type VideoQuestion } from '../lib/videoQuestions';
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


export default function TimedVideoLesson(props:ComponentProps<typeof AnimationClassroomPlayer>){return <AnimationClassroomPlayer {...props}/>;}
