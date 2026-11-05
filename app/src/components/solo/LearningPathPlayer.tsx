import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pathAct, pathOpen, type PathActionResult, type PathState } from '../../lib/learningPaths';
import { useLearningActivity } from '../../lib/learningSensors/useLearningActivity';
import { speak } from '../../lib/speech';
import type { HwQuestion } from '../../lib/homework/types';
import QuestionCard from '../homework/QuestionCard';

export default function LearningPathPlayer({ token, assignment, title, onExit, onHelp, homework=false }: { homework?: boolean; token: string; assignment: string; title: string; onExit: () => void; onHelp?: (position: number) => Promise<void> }) {
  const { i18n } = useTranslation(); const en=i18n.language.startsWith('en'); const l=(ko:string,english:string)=>en?english:ko;
  const [state,setState]=useState<PathState|null>(null); const [feedback,setFeedback]=useState<PathActionResult['feedback']>();
  const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [helpSent,setHelpSent]=useState(false);
  const pending=useRef<{id:string;position:number;action:'answer'|'unknown'|'continue'|'hint';value:string|null}|null>(null);
  const feedbackPosition=useRef<number|null>(null);
  const sensor=useLearningActivity(state ? { source:'solo',credential:token,resource:assignment,runId:state.run_id } : undefined,
    feedback ? feedbackPosition.current : state&&!state.waiting&&!state.finished?state.position:null);
  const open=useCallback(async()=>{setError('');try{setState(await pathOpen(token,assignment));}catch{setError('open');}},[token,assignment]);
  useEffect(()=>{let alive=true;setState(null);pathOpen(token,assignment).then(s=>alive&&setState(s)).catch(()=>alive&&setError('open'));return()=>{alive=false;};},[token,assignment]);
  useEffect(() => { setHelpSent(false); }, [state?.position]);
  async function send(request:NonNullable<typeof pending.current>){
    if(busy)return;setBusy(true);setError('');
    try{const r=await pathAct(token,assignment,request.id,request.position,request.action,request.value);pending.current=null;
      if(request.action==='hint')sensor('hint');
      if(r.feedback?.answer)sensor('revealed');
      feedbackPosition.current=request.position;setFeedback(r.feedback);setState(r.state);
    }catch(e){if(e instanceof Error&&e.message.includes('path_changed')){pending.current=null;await open();setFeedback(undefined);}else setError(pending.current?'send':'open');}
    finally{setBusy(false);}
  }
  function act(action:NonNullable<typeof pending.current>['action'],value:string|null=null){
    if(!state||busy||feedback||pending.current)return;
    if(action==='answer'||action==='unknown')sensor('submitted');
    const request={id:crypto.randomUUID(),position:state.position,action,value};pending.current=request;void send(request);
  }
  const btn='min-h-12 rounded-2xl bg-warm-yellow px-6 py-3 text-lg font-bold text-deep-navy disabled:opacity-50';
  const phases:Record<string,string>={diagnostic:l('먼저 혼자 떠올려요','Try it first'),learn:l('단어를 확인해요','Learn the word'),practice:l('도움을 받으며 연습해요','Practise with support'),check:l('혼자 다시 확인해요','Check on your own'),delayed_check:l('시간이 지난 뒤 다시 확인해요','Check after a delay')};
  const q=state?.step as unknown as Record<string,unknown>|null;
  const question:HwQuestion|null=q&&q.t!=='meet'?{id:`${state?.run_id}:${state?.position}:${state?.round}`,qtype:q.t==='spell'?'order':'text',prompt:String(q.meaning||''),tokens:q.t==='spell'?q.letters as string[]:undefined,joiner:'',skill:'',word:'',gen:'path-v1'}:null;
  return <main className="min-h-dvh bg-[#16213e] text-white"><div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 p-5">
    <header className="flex items-start gap-3"><button type="button" onClick={onExit} className="min-h-11 rounded-full border border-white/30 px-4">{l('나가기','Exit')}</button><div className="min-w-0 flex-1"><h1 className="text-xl font-bold">{title}</h1>{state&&<p className="mt-1 text-sm text-white/70">{state.round===0||feedback?.phase==='check'?(homework?l('오늘의 숙제','Today’s homework'):l('오늘의 학습','Initial lesson')):l('복습 확인','Review check')} · {Math.min(state.goal_index+1,state.words)} / {state.words}</p>}</div></header>
    {error&&<div role="alert" className="space-y-3 rounded-2xl border border-amber-300/50 p-4"><p>{l('연결을 확인한 뒤 이어서 진행해 주세요. 답은 같은 요청으로 다시 보냅니다.','Check your connection and continue. The same request will be retried.')}</p><button type="button" className={btn} disabled={busy} onClick={()=>pending.current?void send(pending.current):void open()}>{l('다시 연결','Reconnect')}</button></div>}
    {!state&&!error&&<p role="status">{l('수업을 준비하고 있어요…','Preparing your lesson…')}</p>}
    {state&&(state.waiting||state.finished)&&!feedback?<section className="my-auto space-y-5 rounded-3xl bg-white/10 p-7 text-center"><div className="text-5xl" aria-hidden="true">✓</div><h2 className="text-2xl font-bold">{state.finished?l('계획한 확인을 모두 마쳤어요','All planned checks are complete'):homework?l('오늘 숙제를 마쳤어요','Today’s homework is complete'):l('오늘은 여기까지예요','That is enough for today')}</h2><p>{state.finished?l('배운 내용과 복습 기록을 선생님이 확인할 수 있어요.','Your teacher can review your learning records.'):l('시간을 두고 다시 떠올리는 연습이 남아 있어요.','You will practise recalling the words after a delay.')}</p>{state.due_at&&!state.finished&&<p>{l('다음 확인: ','Next check: ')}{new Date(state.due_at).toLocaleString(en?'en-US':'ko-KR')}</p>}<button className={btn} onClick={onExit}>{l('학생 홈으로','Student home')}</button></section>
    :feedback?<section className="my-auto space-y-5 rounded-3xl bg-white/10 p-7 text-center"><h2 className="text-2xl font-bold">{feedback.correct?l('잘 떠올렸어요','You recalled it'):l('다시 배울 기회예요','A chance to learn again')}</h2>{feedback.phase==='diagnostic'?<p>{feedback.correct?l('반복 설명은 줄이고 혼자 확인하는 단계로 갈게요.','We will shorten the explanation and move to a check.'):l('단어를 확인한 뒤 짧게 연습해 볼게요.','Let us learn the word and practise briefly.')}</p>:feedback.answer&&<p className="rounded-2xl bg-white/10 p-4 text-3xl font-bold">{feedback.answer}</p>}<button type="button" className={btn} onClick={()=>setFeedback(undefined)}>{l('계속하기','Continue')}</button></section>
    :state&&q?<><h2 className="text-center text-xl font-bold">{phases[state.phase]}</h2>
      {q.t==='meet'?<section className="my-auto space-y-5 rounded-3xl bg-white/10 p-7 text-center">{!!q.imageUrl&&<img src={String(q.imageUrl)} alt="" className="mx-auto h-40 w-40 rounded-2xl bg-white object-contain"/>}<p className="text-4xl font-bold">{String(q.word)}</p><p className="text-2xl">{String(q.meaning)}</p>{!!q.example&&<p className="text-lg text-white/80">{String(q.example)}</p>}<button className="min-h-11 rounded-full border border-white/30 px-5" onClick={()=>{sensor('audio');speak(String(q.word));}}>{l('발음 듣기','Listen')}</button><div><button className={btn} disabled={busy||!!error} onClick={()=>act('continue')}>{l('가리고 연습하기','Hide and practise')}</button></div></section>
      :question&&<div className="flex flex-1 flex-col overflow-hidden rounded-3xl bg-white/5"><QuestionCard q={question} onAnswer={value=>act('answer',q.t==='spell'?(JSON.parse(value) as string[]).join(''):value)} onSensor={sensor} disabled={busy||!!error}/></div>}
      {state.phase==='practice'&&<div className="text-center">{state.hint?<p>{l('첫 글자: ','First letter: ')}{state.hint}</p>:<button className="min-h-11 rounded-full border border-white/30 px-5" disabled={busy||!!error} onClick={()=>act('hint')}>{l('작은 힌트 보기','Small hint')}</button>}</div>}
      {q.t!=='meet'&&<button className="min-h-11 text-white/70 underline" disabled={busy||!!error} onClick={()=>act('unknown')}>{l('아직 모르겠어요','I do not know yet')}</button>}
      {onHelp&&<button className="min-h-11 rounded-full border border-white/30 px-4" disabled={busy||helpSent} onClick={async()=>{try{await onHelp(state.position);sensor('help_requested');setHelpSent(true);}catch{setError('open');}}}>{helpSent?l('선생님께 도움을 요청했어요','Help requested'):l('선생님 도움이 필요해요','Ask your teacher for help')}</button>}
    </>:null}
  </div></main>;
}
