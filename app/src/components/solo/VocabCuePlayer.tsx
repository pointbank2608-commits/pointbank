import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { actVocabCues, cueDate, cueLabel, openVocabCues, type CueAction, type CueActionResult, type CueRequest, type CueState } from '../../lib/vocabCues';
import { useLearningActivity } from '../../lib/learningSensors/useLearningActivity';
import { speak, speakVerified } from '../../lib/speech';
import QuestionCard from '../homework/QuestionCard';

const primary = 'min-h-12 rounded-2xl bg-primary px-5 py-3 font-bold text-on-primary disabled:opacity-40';
const secondary = 'min-h-11 rounded-full border border-outline-variant px-4 disabled:opacity-40';

function HighlightedSentence({ sentence, target }: { sentence: string; target: string }) {
  const parts = sentence.split(new RegExp(`(\\b${target}\\b)`, 'gi'));
  return <p className="text-xl leading-relaxed" lang="en">{parts.map((part, index) => index % 2 ?
    <strong className="underline decoration-primary decoration-2 underline-offset-4" key={index}>{part}</strong> : part)}</p>;
}

function CueExplanation({ item, en, onListen }: {
  item: NonNullable<CueState['item']>; en: boolean; onListen: (word: string, rate?: number) => void;
}) {
  const support = item.support;
  const l = (ko: string, english: string) => en ? english : ko;
  if (!support || !item.text) return null;
  if (support.kind === 'listen_contrast' || support.kind === 'read_contrast') {
    return <div className="space-y-2 rounded-xl bg-[#edf3ff] p-3">
      <p>{support.kind === 'listen_contrast' ? l('두 단어의 소리를 차례대로 비교해요.','Listen to the two words and compare their sounds.') :
        l('앞에서 고른 뜻과 이 단어의 뜻을 비교해요.','Compare this word with the meaning you chose earlier.')}</p>
      <div className="grid grid-cols-2 gap-2">{[{word:item.text,meaning:item.meaning},{word:support.word,meaning:support.meaning}].map(entry =>
        <div key={entry.word} className="space-y-1 rounded-lg bg-white p-2">
          <p className="break-words font-bold" lang="en">{entry.word}</p><p>{entry.meaning}</p>
          {support.kind === 'listen_contrast' && <button type="button" className={secondary} onClick={()=>onListen(entry.word)}>
            {l(`${entry.word} 듣기`, `Listen to ${entry.word}`)}</button>}
        </div>)}</div>
    </div>;
  }
  if (support.kind === 'spell_compare') {
    return <div className="space-y-1 rounded-xl bg-[#edf3ff] p-3">
      <p>{l('앞에서부터 글자를 나란히 비교해요.','Compare the letters from the beginning.')}</p>
      <p>{l('내가 쓴 단어','Your spelling')} · <span className="font-mono" lang="en">{support.attempt}</span></p>
      <p>{l('맞는 철자','Correct spelling')} · <span className="font-mono" lang="en">{[...item.text].map((letter,index)=>
        <span key={index} className={letter!==support.attempt[index]?'rounded bg-amber-200 font-bold underline':undefined}>{letter}</span>)}</span></p>
    </div>;
  }
  if (support.kind === 'spell_chunks') return <div className="space-y-1 rounded-xl bg-[#edf3ff] p-3">
    <p>{l('글자를 두 개씩 묶어서 기억해요.','Remember the letters in groups of two.')}</p>
    <p className="break-words font-mono font-bold" lang="en">{item.text.match(/.{1,2}/g)?.join(' · ')}</p>
  </div>;
  if (support.kind === 'listen_slow') return <button type="button" className={secondary} onClick={()=>onListen(item.text!,0.65)}>
    {l('천천히 듣고 소리 살피기','Listen more slowly')}</button>;
  if (support.kind === 'read_example' && item.example) return <div className="rounded-xl bg-[#edf3ff] p-3">
    <p>{l('문장에서 단어를 찾아 뜻을 연결해요.','Find the word in the sentence and connect it to the meaning.')}</p>
    <HighlightedSentence sentence={item.example} target={item.text}/>
  </div>;
  return null;
}

export default function VocabCuePlayer({ initial, token, assignment, title, onExit, onHelp }: {
  initial: CueState; token: string; assignment: string; title: string; onExit: () => void;
  onHelp?: (position: number) => Promise<void>;
}) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const l = (ko: string, english: string) => en ? english : ko;
  const [state, setState] = useState(initial);
  const [feedback, setFeedback] = useState<CueActionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [heardRevision, setHeardRevision] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [soundError, setSoundError] = useState(false);
  const [helpRevision, setHelpRevision] = useState<number | null>(null);
  const pending = useRef<CueRequest | null>(null);
  const previousPosition = useRef<number | null>(null);
  const sensor = useLearningActivity({ source: 'solo', credential: token, resource: assignment, runId: state.run_id },
    feedback ? previousPosition.current : state.item ? state.position : null);
  const item = state.item;
  const listening = item?.mode === 'listen' && state.phase !== 'learn';
  const waitingToOpen = !!state.starts_at && state.waiting && state.phase !== 'review';

  async function send(request: CueRequest) {
    setBusy(true);
    setError(false);
    try {
      const next = await actVocabCues(token, assignment, request);
      pending.current = null;
      if (next.answer) sensor('revealed');
      previousPosition.current = state.position;
      setFeedback(next.feedback && !next.unavailable ? next : null);
      setSoundError(false);
      setState(next.state);
    } catch (cause) {
      if (cause instanceof Error && cause.message.includes('path_changed')) {
        pending.current = null;
        try {
          const current = await openVocabCues(token, assignment);
          if (current) { setState(current); setFeedback(null); }
          else setError(true);
        } catch { setError(true); }
      } else setError(true);
    } finally { setBusy(false); }
  }

  function act(action: CueAction, value: string | null = null) {
    if (busy || pending.current || feedback || !item) return;
    const request = { id: crypto.randomUUID(), revision: state.revision, action, value };
    pending.current = request;
    if (action === 'answer' || action === 'unknown') sensor('submitted');
    void send(request);
  }

  async function listen() {
    if (!item?.audio || playing) return;
    setPlaying(true);
    setSoundError(false);
    sensor('audio');
    const played = await speakVerified(item.audio);
    if (played) setHeardRevision(state.revision);
    else setSoundError(true);
    setPlaying(false);
  }

  async function retry() {
    if (pending.current) { await send(pending.current); return; }
    setBusy(true);
    try {
      const current = await openVocabCues(token, assignment);
      if (current) { setState(current); setError(false); }
    } catch { setError(true); }
    finally { setBusy(false); }
  }

  const stages = {
    diagnostic: l('먼저 혼자 확인해요','Try it on your own'),
    learn: l('막힌 단어만 살펴봐요','Review the word that needed help'),
    practice: item?.game === 'balloon' ? l('뜻 풍선 터뜨리기','Meaning balloons') : item?.game === 'train' ? l('철자 기차','Spelling train') : l('짧게 연습해요','Practise briefly'),
    check: l('도움 없이 다시 확인해요','Check again without help'),
    review: l('시간이 지난 뒤 다시 확인해요','Check again after a delay'),
    context: l('새 문장에서 뜻을 찾아요','Find the meaning in a new sentence'),
  };
  return <main className="min-h-dvh bg-[#f8f1e3] text-[#1c2742]">
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center gap-3"><button type="button" className={secondary} onClick={onExit}>{l('나가기','Exit')}</button>
        <h1 className="min-w-0 break-words text-xl font-bold">{title}</h1>
      </header>
      {state.focus_due_at && !state.finished && <p className="rounded-xl bg-white px-4 py-2 text-sm">
        {l('필수 목표 확인 기준','Essential goal deadline')} · {cueDate(state.focus_due_at,en,true)}
      </p>}
      {error && <div role="alert" className="space-y-2 rounded-xl bg-amber-50 p-4">
        <p>{l('연결을 확인한 뒤 다시 시도해 주세요.','Check your connection and try again.')}</p>
        <button type="button" className={primary} disabled={busy} onClick={() => void retry()}>{l('다시 연결','Reconnect')}</button>
      </div>}
      {feedback ? <section className="my-auto space-y-4 rounded-3xl bg-white p-6 text-center">
        <h2 className="text-xl font-bold">{feedback.correct ? l('맞았어요','Correct') : l('이번에는 어려웠어요','That was difficult this time')}</h2>
        {feedback.answer && <p>{l('이 답을 기억해요','Remember this answer')} · <strong>{feedback.answer}</strong></p>}
        <button type="button" className={primary} onClick={() => setFeedback(null)}>{l('계속하기','Continue')}</button>
      </section> : state.finished || state.waiting ? <section className="my-auto space-y-4 rounded-3xl bg-white p-6 text-center">
        <h2 className="text-xl font-bold">{state.finished ? l('오늘의 확인을 마쳤어요','You finished today’s check') :
          waitingToOpen ? l('예정된 학습이에요','This activity is scheduled') : l('오늘은 여기까지예요','That is enough for today')}</h2>
        {!!state.gap_count && <p>{l(`처음 막힌 항목 ${state.gap_count}개 중 ${state.verified_count}개를 도움 없이 다시 맞혔어요.`,
          `You independently verified ${state.verified_count} of ${state.gap_count} initial gaps.`)}</p>}
        {state.verified_count * 5 < state.gap_count * 4 && <p>{l('남은 항목은 선생님이 이어서 확인할 수 있어요.','Your teacher can follow up on the remaining items.')}</p>}
        {state.waiting && state.due_at && <p>{waitingToOpen ? l('시작 예정 ', 'Opens ') : l('다음 복습 ', 'Next review ')}{cueDate(state.due_at,en,true)}</p>}
        <button type="button" className={primary} onClick={onExit}>{l('학생 홈으로','Student home')}</button>
      </section> : item && <>
        <h2 className="text-center text-xl font-bold">{stages[state.phase]}</h2>
        {item.essential && <p className="text-center text-sm font-bold text-primary">{l('다음 수업 전 필수 목표','Essential before the next class')}</p>}
        {item.mode !== 'context' && <p className="text-center text-sm">{cueLabel(item.mode, en)}</p>}
        {state.phase === 'learn' ? <section className="space-y-4 rounded-3xl bg-white p-6 text-center">
          {item.image && <img src={item.image} alt="" className="mx-auto size-32 rounded-xl object-contain"/>}
          <p className="break-words text-3xl font-bold" lang="en">{item.text}</p><p>{item.meaning}</p>
          {item.example && item.support?.kind!=='read_example' && <p lang="en">{item.example}</p>}
          {item.audio && item.support?.kind!=='listen_contrast' && <button type="button" className={secondary} onClick={() => { sensor('audio'); speak(item.audio!); }}>{l('발음 듣기','Listen to pronunciation')}</button>}
          <CueExplanation item={item} en={en} onListen={(word,rate)=>{sensor('audio');speak(word,rate);}}/>
          <div><button type="button" className={primary} disabled={busy || error} onClick={() => act('continue')}>{l('가리고 연습하기','Hide and practise')}</button></div>
        </section> : <>
          {listening && <div className="space-y-2 text-center">
            <button type="button" className={primary} disabled={playing || busy || error} onClick={() => void listen()}>{playing ? l('재생 중…','Playing…') : l('단어 듣기','Play the word')}</button>
            {soundError && <p role="status">{l('음성을 재생하지 못했어요. 다시 듣거나 건너뛰어 주세요.','Audio did not play. Try again or skip.')}</p>}
          </div>}
          {item.target && item.text && <div className="rounded-xl bg-white p-4 text-center">
            <HighlightedSentence sentence={item.text} target={item.target}/>
          </div>}
          <div className="overflow-hidden rounded-3xl bg-white">
            <QuestionCard key={state.revision} q={{
              id: `cue:${state.run_id}:${state.revision}`,
              qtype: item.mode === 'spell' ? item.game === 'train' ? 'order' : 'text' : 'choice',
              prompt: item.target ? l('밑줄 친 단어는 여기서 어떤 뜻인가요?', 'What does the underlined word mean here?') :
                listening ? l('들은 단어의 뜻을 골라요','Choose the meaning of the word you hear') : item.text ?? '',
              tokens: item.letters ?? undefined, joiner: '', choices: item.choices ?? undefined,
              style: item.game ?? undefined, skill: '', word: '',
              gen: item.game === 'train' ? 'vocab-spelling-train-v1' : 'vocab-cues',
            }} disabled={busy || error || playing || (listening && heardRevision !== state.revision)}
              onAnswer={value => {
                if (item.mode !== 'spell') {
                  const option = item.choices?.[Number(value)];
                  if (option) act('answer', option);
                } else act('answer', item.game === 'train' ? (JSON.parse(value) as string[]).join('') : value);
              }}/>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className={secondary} disabled={busy || error || playing || (listening && heardRevision !== state.revision)} onClick={() => act('unknown')}>{l('아직 모르겠어요','I do not know yet')}</button>
            {listening && <button type="button" className={secondary} disabled={busy || error || playing} onClick={() => act('unavailable')}>{l('소리가 안 들려요','I cannot hear the audio')}</button>}
          </div>
        </>}
        {onHelp && state.position !== null && <button type="button" className={secondary}
          disabled={busy || error || helpRevision === state.revision} onClick={async () => {
            setHelpRevision(state.revision);
            try { await onHelp(state.position!); sensor('help_requested'); }
            catch { setHelpRevision(null); setError(true); }
          }}>{helpRevision === state.revision ? l('선생님께 도움을 요청했어요','Help requested') : l('선생님 도움이 필요해요','Ask your teacher for help')}</button>}
      </>}
    </div>
  </main>;
}
