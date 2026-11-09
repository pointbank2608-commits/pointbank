import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pathAct, pathOpen, type PathActionResult, type PathState } from '../../lib/learningPaths';
import { useLearningActivity } from '../../lib/learningSensors/useLearningActivity';
import { speak } from '../../lib/speech';
import type { HwQuestion } from '../../lib/homework/types';
import QuestionCard from '../homework/QuestionCard';
import { openVocabCues, type CueState } from '../../lib/vocabCues';
import VocabCuePlayer from './VocabCuePlayer';

interface PlayerProps { homework?: boolean; token: string; assignment: string; title: string; onExit: () => void; onHelp?: (position: number) => Promise<void> }

export default function LearningPathPlayer(props: PlayerProps) {
  return <LearningPathEntry key={`${props.token}:${props.assignment}`} {...props}/>;
}

function LearningPathEntry(props: PlayerProps) {
  const { token, assignment } = props;
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const [cue, setCue] = useState<CueState | null | undefined>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    openVocabCues(token, assignment).then(result => {
      if (active) setCue(result);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [token, assignment, retry]);
  if (cue === null) return <LegacyLearningPathPlayer {...props}/>;
  if (cue) return <VocabCuePlayer {...props} initial={cue}/>;
  return <main className="mx-auto max-w-xl space-y-4 p-5">
    <button type="button" className="min-h-11 underline" onClick={props.onExit}>{en ? 'Exit' : '나가기'}</button>
    {error ? <div role="alert" className="space-y-2"><p>{en ? 'Could not open the lesson.' : '수업을 열지 못했어요.'}</p>
      <button type="button" className="min-h-11 underline" onClick={() => { setError(false); setRetry(value => value + 1); }}>{en ? 'Try again' : '다시 연결'}</button>
    </div> : <p role="status">{en ? 'Preparing your lesson…' : '수업을 준비하고 있어요…'}</p>}
  </main>;
}

function LegacyLearningPathPlayer({ token, assignment, title, onExit, onHelp, homework=false }: PlayerProps) {
  const { i18n } = useTranslation(); const en=i18n.language.startsWith('en'); const l=(ko:string,english:string)=>en?english:ko;
  const [state,setState]=useState<PathState|null>(null); const [feedback,setFeedback]=useState<PathActionResult['feedback']>();
  const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [helpSent,setHelpSent]=useState(false);
  const [balloonOpen,setBalloonOpen]=useState(false);
  const [popped,setPopped]=useState<number[]>([]);
  const pending=useRef<{id:string;position:number;action:'answer'|'unknown'|'continue'|'hint';value:string|null}|null>(null);
  const feedbackPosition=useRef<number|null>(null);
  const sensor=useLearningActivity(state ? { source:'solo',credential:token,resource:assignment,runId:state.run_id } : undefined,
    feedback ? feedbackPosition.current : state&&!state.waiting&&!state.finished?state.position:null);
  const open=useCallback(async()=>{setError('');try{setState(await pathOpen(token,assignment));}catch{setError('open');}},[token,assignment]);
  useEffect(()=>{let alive=true;setState(null);pathOpen(token,assignment).then(s=>alive&&setState(s)).catch(()=>alive&&setError('open'));return()=>{alive=false;};},[token,assignment]);
  useEffect(() => { setHelpSent(false);setBalloonOpen(false);setPopped([]); }, [state?.position]);
  async function send(request:NonNullable<typeof pending.current>){
    if(busy)return;setBusy(true);setError('');
    try{const r=await pathAct(token,assignment,request.id,request.position,request.action,request.value);pending.current=null;
      if(request.action==='hint')sensor('hint');
      if(r.feedback?.answer)sensor('revealed');
      if(r.game_correct===false){
        const choices=(r.state.step as { game_choices?: string[] }|null)?.game_choices ?? [];
        const index=choices.indexOf(request.value ?? '');
        if(index>=0)setPopped(current=>current.includes(index)?current:[...current,index]);
      }
      feedbackPosition.current=request.position;setFeedback(r.feedback);setState(r.state);
    }catch(e){if(e instanceof Error&&e.message.includes('path_changed')){pending.current=null;await open();setFeedback(undefined);}else setError(pending.current?'send':'open');}
    finally{setBusy(false);}
  }
  function act(action:NonNullable<typeof pending.current>['action'],value:string|null=null){
    if(!state||busy||feedback||pending.current)return;
    if(action==='answer'||action==='unknown'||(action==='continue'&&value!==null))sensor('submitted');
    const request={id:crypto.randomUUID(),position:state.position,action,value};pending.current=request;void send(request);
  }
  const btn='min-h-12 rounded-2xl bg-[#3b5bdb] px-6 py-3 text-lg font-bold text-white disabled:opacity-50';
  const phases:Record<string,string>={diagnostic:l('먼저 혼자 떠올려요','Try it first'),learn:l('단어를 확인해요','Learn the word'),practice:l('도움을 받으며 연습해요','Practise with support'),check:l('혼자 다시 확인해요','Check on your own'),delayed_check:l('시간이 지난 뒤 다시 확인해요','Check after a delay')};
  const q=state?.step as unknown as Record<string,unknown>|null;
  const isTrain=q?.vocab_game==='spelling-train-v1';
  const choices=q?.vocab_game==='meaning-balloon-v1'&&Array.isArray(q.game_choices)?q.game_choices as string[]:null;
  const question:HwQuestion|null=q&&q.t!=='meet'?{id:`${state?.run_id}:${state?.position}:${state?.round}`,qtype:q.t==='spell'?'order':'text',prompt:String(q.meaning||''),tokens:q.t==='spell'?q.letters as string[]:undefined,joiner:'',skill:'',word:'',style:isTrain?'train':undefined,gen:isTrain?'vocab-spelling-train-v1':'path-v1'}:null;
  return <main className="min-h-dvh bg-[#f8f1e3] text-[#1c2742]"><div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 p-5">
    <header className="flex items-start gap-3"><button type="button" onClick={onExit} className="min-h-11 rounded-full border border-[#d9d3c3] px-4">{l('나가기','Exit')}</button><div className="min-w-0 flex-1"><h1 className="text-xl font-bold">{title}</h1>{state&&<p className="mt-1 text-sm text-[#5b6580]">{state.round===0||feedback?.phase==='check'?(homework?l('오늘의 숙제','Today’s homework'):l('오늘의 학습','Initial lesson')):l('복습 확인','Review check')} · {Math.min(state.goal_index+1,state.words)} / {state.words}</p>}</div></header>
    {error&&<div role="alert" className="space-y-3 rounded-2xl border border-amber-400 p-4"><p>{l('연결을 확인한 뒤 이어서 진행해 주세요. 답은 같은 요청으로 다시 보냅니다.','Check your connection and continue. The same request will be retried.')}</p><button type="button" className={btn} disabled={busy} onClick={()=>pending.current?void send(pending.current):void open()}>{l('다시 연결','Reconnect')}</button></div>}
    {!state&&!error&&<p role="status">{l('수업을 준비하고 있어요…','Preparing your lesson…')}</p>}
    {state&&(state.waiting||state.finished)&&!feedback?<section className="my-auto space-y-5 rounded-3xl bg-white shadow-sm ring-1 ring-[#eadfc5] p-7 text-center"><div className="text-5xl" aria-hidden="true">✓</div><h2 className="text-2xl font-bold">{state.finished?l('계획한 확인을 모두 마쳤어요','All planned checks are complete'):homework?l('오늘 숙제를 마쳤어요','Today’s homework is complete'):l('오늘은 여기까지예요','That is enough for today')}</h2><p>{state.finished?l('배운 내용과 복습 기록을 선생님이 확인할 수 있어요.','Your teacher can review your learning records.'):l('시간을 두고 다시 떠올리는 연습이 남아 있어요.','You will practise recalling the words after a delay.')}</p>{state.due_at&&!state.finished&&<p>{l('다음 확인: ','Next check: ')}{new Date(state.due_at).toLocaleString(en?'en-US':'ko-KR')}</p>}<button className={btn} onClick={onExit}>{l('학생 홈으로','Student home')}</button></section>
    :feedback?<section className="my-auto space-y-5 rounded-3xl bg-white shadow-sm ring-1 ring-[#eadfc5] p-7 text-center"><h2 className="text-2xl font-bold">{feedback.correct?l('잘 떠올렸어요','You recalled it'):l('다시 배울 기회예요','A chance to learn again')}</h2>{feedback.phase==='diagnostic'?<p>{feedback.correct?l('반복 설명은 줄이고 혼자 확인하는 단계로 갈게요.','We will shorten the explanation and move to a check.'):l('단어를 확인한 뒤 짧게 연습해 볼게요.','Let us learn the word and practise briefly.')}</p>:feedback.answer&&<p className="rounded-2xl bg-white shadow-sm ring-1 ring-[#eadfc5] p-4 text-3xl font-bold">{feedback.answer}</p>}<button type="button" className={btn} onClick={()=>setFeedback(undefined)}>{l('계속하기','Continue')}</button></section>
    :state&&q?<><h2 className="text-center text-xl font-bold">{isTrain?l('철자 기차','Spelling train'):choices&&balloonOpen?l('뜻 풍선 터뜨리기','Vocabulary balloons'):phases[state.phase]}</h2>
      {choices&&balloonOpen?<div className="flex flex-1 flex-col gap-3">
        <div className="overflow-hidden rounded-3xl">
          <QuestionCard q={{id:`${state.run_id}:${state.position}:balloon`,qtype:'choice',style:'balloon',prompt:String(q.meaning),choices,skill:'',word:'',gen:'vocab-meaning-balloon-v1'}}
            disabled={busy||!!error} eliminated={popped}
            onAnswer={index=>{const choice=choices[Number(index)];if(choice)act('continue',choice);}}/>
        </div>
        {!!popped.length&&<p role="status" className="text-center">{l('방금 본 단어가 적힌 다른 풍선을 골라요.','Try another balloon with the word you just saw.')}</p>}
        <button type="button" className="min-h-11 underline" disabled={busy||!!error} onClick={()=>{sensor('revealed');setBalloonOpen(false);}}>{l('단어 다시 보기','See the word again')}</button>
      </div>:q.t==='meet'?<section className="my-auto space-y-5 rounded-3xl bg-white shadow-sm ring-1 ring-[#eadfc5] p-7 text-center">{!!q.imageUrl&&<img src={String(q.imageUrl)} alt="" className="mx-auto h-40 w-40 rounded-2xl bg-white object-contain"/>}<p className="break-words text-4xl font-bold">{String(q.word)}</p><p className="text-2xl">{String(q.meaning)}</p>{!!q.example&&<p className="text-lg text-[#5b6580]">{String(q.example)}</p>}<button className="min-h-11 rounded-full border border-[#d9d3c3] px-5" onClick={()=>{sensor('audio');speak(String(q.word));}}>{l('발음 듣기','Listen')}</button><div><button className={btn} disabled={busy||!!error} onClick={()=>choices?setBalloonOpen(true):act('continue')}>{choices?l('가리고 풍선 고르기','Hide the word and play'):l('가리고 연습하기','Hide and practise')}</button></div></section>
      :question&&<div className="flex flex-1 flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-[#eadfc5]"><QuestionCard q={question} onAnswer={value=>act('answer',q.t==='spell'?(JSON.parse(value) as string[]).join(''):value)} onSensor={sensor} disabled={busy||!!error}/></div>}
      {state.phase==='practice'&&<div className="text-center">{state.hint?<p>{l('첫 글자: ','First letter: ')}{state.hint}</p>:<button className="min-h-11 rounded-full border border-[#d9d3c3] px-5" disabled={busy||!!error} onClick={()=>act('hint')}>{l('작은 힌트 보기','Small hint')}</button>}</div>}
      {q.t!=='meet'&&<button className="min-h-11 text-[#5b6580] underline" disabled={busy||!!error} onClick={()=>act('unknown')}>{l('아직 모르겠어요','I do not know yet')}</button>}
      {onHelp&&<button className="min-h-11 rounded-full border border-[#d9d3c3] px-4" disabled={busy||helpSent} onClick={async()=>{try{await onHelp(state.position);sensor('help_requested');setHelpSent(true);}catch{setError('open');}}}>{helpSent?l('선생님께 도움을 요청했어요','Help requested'):l('선생님 도움이 필요해요','Ask your teacher for help')}</button>}
    </>:null}
  </div></main>;
}
