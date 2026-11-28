import { useEffect, useRef, useState } from 'react';
import type { Workshop } from '../../../../supabase/functions/_shared/grammarWorkshop';
import { classroomStep, parseMarked } from '../../lib/grammar';
import { useSyncedSubState } from '../../lib/presentSync';
import {InlineText} from './InlineWorkshopEdit';
import PagedWorkshopStage from './PagedWorkshopStage';
import type { GrammarBoardProps } from '../GrammarBoard';
import GrammarPrepOverview from './GrammarPrepOverview';
import './workshop-board.css';

export default function WorkshopBoard({point, workshop, mode, interactive = true, keyboard = interactive,
  editor, initialPosition, onPositionChange, onCue, className = ''}: GrammarBoardProps & {workshop: Workshop}) {
  const last = (point.steps?.length ?? 1) - 1;
  const [step, setStep] = useState(Math.max(0, Math.min(last, initialPosition?.step ?? 0)));
  const [scene,setScene]=useState(initialPosition?.scene??0);
  const [page,setPage]=useState(initialPosition?.page??0);
  const visited=useRef(new Map<number,{page:number;scene:number}>());
  const lesson = classroomStep(point, step);
  const cue = useRef(onCue);
  cue.current = onCue;
  const follower = useSyncedSubState({step, page, scene, view: 'lesson', modelOpen:step===last && page>0}, remote => {
    setStep(Math.max(0, Math.min(last, Number(remote.step) || 0)));
    setPage(Number(remote.page) || (remote.modelOpen?1:0));
    setScene(Number(remote.scene)||0);
  });
  function goToStep(index: number, back=false) {
    visited.current.set(step,{page,scene});
    const previous=back?visited.current.get(index):undefined;
    setStep(index);
    setPage(previous?.page??0);
    setScene(previous?.scene??0);
  }
  useEffect(() => {
    cue.current?.('shown', step);
  }, [step]);
  useEffect(() => {
    onPositionChange?.({step, page, scene, view: 'lesson', hintOpen: false, answerOpen: false, showKo: false, shown: 0});
  }, [step, scene, page, onPositionChange]);
  if (!lesson?.practice) return null;
  const edit=editor?.stage(step);
  const grade = workshop.grade;
  const prompt = parseMarked(lesson.prompt).map((part, i) => part.strong ? <strong key={i}>{part.text}</strong> : part.text);
  return <>{mode === 'prepare' && <GrammarPrepOverview point={point} onStage={goToStep} onGoal={editor?.goal}/>}
    <PagedWorkshopStage key={step} grade={grade} step={step} total={last+1} page={page} scene={scene} onPage={setPage} onScene={setScene}
      title={<InlineText label="단계 제목" value={lesson.practice.title} onChange={edit?title=>edit.practice(p=>({...p,title})):undefined}/>}
      className={className} map={interactive&&!edit?point.steps?.[0].practice:undefined} onHelp={()=>onCue?.('hint',step)}
      topic={(step!==last || editor) && point.name.split(' — ')[0]}
      prompt={<InlineText label="장면 안내" value={lesson.prompt} onChange={editor?v=>editor.prompt(step,v):undefined}>{prompt}</InlineText>}
      practice={lesson.practice} drillEditor={editor?.drills} workshop={workshop} edit={edit} finalModel={lesson.answer} followUp={lesson.followUp}
      classroom={mode==='classroom'} locked={follower} keyboard={keyboard} interactive={interactive}
      review={[lesson.answer,lesson.followUp].join('\n\n')}
      onReveal={()=>{onCue?.('submitted',step);onCue?.('revealed',step);}}
      onModelOpen={mode==='classroom'?()=>onCue?.('revealed',step):undefined}
      onPrevious={step>0?()=>goToStep(step-1,true):undefined} onNext={step<last?()=>goToStep(step+1):undefined}/></>;
}
