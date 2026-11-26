import { useEffect, useRef, useState } from 'react';
import type { Workshop } from '../../../../supabase/functions/_shared/grammarWorkshop';
import { classroomStep, parseMarked } from '../../lib/grammar';
import { useSyncedSubState } from '../../lib/presentSync';
import WorkshopSheet from './WorkshopSheet';
import type { GrammarBoardProps } from '../GrammarBoard';
import GuidedPracticePanel from './GuidedPracticePanel';
import './workshop-board.css';

export default function WorkshopBoard({point, workshop, interactive = true, keyboard = interactive,
  editor, initialPosition, onPositionChange, requestedStage, onCue, className = ''}: GrammarBoardProps & {workshop: Workshop}) {
  const last = (point.steps?.length ?? 1) - 1;
  const [step, setStep] = useState(Math.max(0, Math.min(last, initialPosition?.step ?? 0)));
  const lesson = classroomStep(point, step);
  const cue = useRef(onCue);
  cue.current = onCue;
  const follower = useSyncedSubState({step, view: 'lesson'}, remote => {
    setStep(Math.max(0, Math.min(last, Number(remote.step) || 0)));
  });
  useEffect(() => {
    if (requestedStage) setStep(requestedStage.index);
  }, [requestedStage]);
  useEffect(() => {
    cue.current?.('shown', step);
    onPositionChange?.({step, view: 'lesson', hintOpen: false, answerOpen: false, showKo: false, shown: 0});
  }, [step, onPositionChange]);
  useEffect(() => {
    if (!keyboard || follower) return;
    const handle = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable=true],dialog,[role="dialog"]')) return;
      if (event.key === ' ' && event.target instanceof Element && event.target.closest('button,summary')) return;
      const direction = ['ArrowRight', 'PageDown', ' '].includes(event.key) ? 1 : ['ArrowLeft', 'PageUp'].includes(event.key) ? -1 : 0;
      const next = step + direction;
      if (!direction || next < 0 || next > last) return;
      event.preventDefault();
      event.stopPropagation();
      setStep(next);
    };
    document.addEventListener('keydown', handle, true);
    return () => document.removeEventListener('keydown', handle, true);
  }, [keyboard, follower, step, last]);
  if (!lesson?.practice) return null;
  const grade = workshop.grade;
  const prompt = parseMarked(lesson.prompt).map((part, i) => part.strong ? <strong key={i}>{part.text}</strong> : part.text);
  return <WorkshopSheet grade={grade} step={step} total={last+1} title={lesson.practice.title}
    className={className} map={interactive?point.steps?.[0].practice:undefined} onMap={()=>onCue?.('hint',step)}
    topic={(step!==last || editor) && (editor?editor.field('name',point.name,point.name):point.name.split(' — ')[0])}
    prompt={editor?editor.field('prompt',lesson.prompt,prompt,step):prompt}
    footer={interactive && <>
      <button type="button" disabled={step===0 || follower} onClick={()=>setStep(step-1)}>이전 단계</button>
      <button type="button" disabled={step===last || follower} onClick={()=>setStep(step+1)}>다음 단계</button></>}>
    <div inert={!interactive}><GuidedPracticePanel practice={lesson.practice} workshop={workshop}
      review={[lesson.answer,lesson.followUp].join('\n\n')} onHelp={()=>onCue?.('hint',step)}
      onReveal={()=>{onCue?.('submitted',step);onCue?.('revealed',step);}}/></div>
  </WorkshopSheet>;
}
