import { useEffect, useRef, useState } from 'react';
import type { GuidedPractice } from '../../data/doYouCanYou';
import { WordOrder, WorkshopExercises } from './WorkshopExercises';
import type { SceneLine, Workshop } from '../../../../supabase/functions/_shared/grammarWorkshop';
import './guided-practice.css';

function SceneCard({panel, title, onHelp}:{panel:SceneLine; title?:string; onHelp?:()=>void}) {
  return <article className="grammar-scene-card">
    {panel.image && <img src={panel.image} alt=""/>}{title && panel.label!==title && <p className="scene-speaker">{panel.label}</p>}
    <h3>{title || panel.label}</h3>{panel.setting && <p>{panel.setting}</p>}
    <div className="scene-sentence">{panel.chunks.map((chunk,j)=><span className="grammar-chunk" data-role={/^(can|must|may|should|do|does|did)$/i.test(chunk)?'helper':/^(I|you|we|she|he|it|they)$/i.test(chunk)?'person':undefined} key={j}>
      <b lang="en">{chunk}</b>{panel.glosses?.[j]&&<small>{panel.glosses[j]}</small>}</span>)}</div>
    <p>{panel.meaning}</p>{panel.response && <p><b>상대의 반응</b> · {panel.response}</p>}
    {panel.rationale && <details onToggle={e=>{if(e.currentTarget.open)onHelp?.();}}><summary>왜 이런 뜻일까?</summary><p>{panel.rationale}</p></details>}
  </article>;
}

export function SceneMap({practice,onHelp}:{practice:GuidedPractice;onHelp?:()=>void}) {
  const [selected,setSelected]=useState(0);
  const entries=practice.map;
  if(!entries?.length)return null;
  const entry=entries[selected] ?? entries[0];
  const panel=entry.panelIndex===undefined?undefined:practice.panels?.[entry.panelIndex];
  return <div className="grammar-atlas">
    <div className="grammar-map-options">{entries.map((item,i)=><button type="button" key={i} aria-pressed={i===selected}
      onClick={()=>{setSelected(i);onHelp?.();}}><b>{item.label}</b>{item.panelIndex!==undefined && <small>{item.text}</small>}</button>)}</div>
    <div aria-live="polite" key={selected}>{panel ? <SceneCard title={entry.label} panel={panel} onHelp={onHelp}/> : <article className="grammar-scene-card"><h3>{entry.label}</h3><p>{entry.text}</p></article>}</div>
  </div>;
}

export default function GuidedPracticePanel({ practice, review, onHelp, onReveal, workshop }: { practice: GuidedPractice; review?: string; onHelp?: () => void; onReveal?: () => void; workshop?: Workshop }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (picked !== null) feedback.current?.scrollIntoView({block: 'nearest'});
  }, [picked]);
  const why = ([question, explanation]: [string, string]) => <details key={question} onToggle={event => {
      if (event.currentTarget.open) onHelp?.();
    }}>
      <summary>{question}</summary>
      <p>{explanation}</p>
    </details>;
  const artwork = practice.image && <img src={practice.image} alt={practice.imageDescription ?? ''} className="max-h-48 rounded-lg object-contain" />;
  if (practice.independentPrompts) return <div className="guided-practice">{artwork}
    {practice.independentPrompts.map((label, index) => <label className="question-draft" key={label}>{label}
      <textarea rows={2} value={drafts[index] ?? ''} onChange={event => {
        const next = [...drafts];
        next[index] = event.target.value;
        setDrafts(next);
      }} />
    </label>)}
    {reviewing ? <><p className="question-model">{review}</p>{practice.why.map(why)}{workshop && <WorkshopExercises workshop={workshop} onReveal={onReveal}/>}</> :
      <button type="button" disabled={!practice.independentPrompts.every((_, i) => drafts[i]?.trim())}
        onClick={() => { setReviewing(true); onReveal?.(); }}>내 답과 예시 비교하기</button>}
  </div>;
  return <div className="guided-practice">{artwork}
    {practice.map?.length && <SceneMap practice={practice} onHelp={onHelp}/>}
    {!practice.map?.some(entry=>entry.panelIndex!==undefined) && !!practice.panels?.length && <div className="grammar-scene-grid">{practice.panels.map((panel,i)=><SceneCard key={i} panel={panel} onHelp={onHelp}/>)}</div>}
    {practice.why.map(why)}
    {practice.assembly ? <><p>{practice.question}</p><WordOrder words={practice.assembly} reason={practice.question} onReveal={onReveal}/></> : practice.choices.length>0 && <fieldset>
      <legend>{practice.question}</legend>
      {practice.choices.map(([label], index) => <button type="button" key={index} aria-pressed={picked === index} data-correct={index===practice.correct}
        onClick={() => {setPicked(index);onReveal?.();}}>{label}</button>)}
      <div role="status" ref={feedback}>{picked !== null && practice.choices[picked] && <p className={picked===practice.correct?'grammar-right':'grammar-wrong'}>{picked===practice.correct?'✓ 맞아요. ':'✕ 아니에요. '}{practice.choices[picked][1].replace(/^맞아요\.\s*/,'')} {picked !== practice.correct && '다시 골라 보세요.'}</p>}</div>
    </fieldset>}
    {practice.writingPrompt && <label className="block">{practice.writingPrompt}
      <textarea rows={3} className="block w-full rounded-lg bg-white p-2 text-slate-900" placeholder="내가 전하고 싶은 말을 적어 보세요." />
    </label>}
  </div>;
}
