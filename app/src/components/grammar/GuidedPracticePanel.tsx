import { useState } from 'react';
import type { GuidedPractice } from '../../data/doYouCanYou';
import { WordOrder, WorkshopExercises } from './WorkshopExercises';
import type { Workshop } from '../../../../supabase/functions/_shared/grammarWorkshop';
import './guided-practice.css';

export default function GuidedPracticePanel({ practice, review, onHelp, onReveal, workshop }: { practice: GuidedPractice; review?: string; onHelp?: () => void; onReveal?: () => void; workshop?: Workshop }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
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
    {practice.why.slice(0, 1).map(why)}
    {reviewing ? <><p className="question-model">{review}</p>{practice.why.slice(1).map(why)}{workshop && <WorkshopExercises workshop={workshop} onReveal={onReveal}/>}</> :
      <button type="button" disabled={!practice.independentPrompts.every((_, i) => drafts[i]?.trim())}
        onClick={() => { setReviewing(true); onReveal?.(); }}>내 답과 예시 비교하기</button>}
  </div>;
  return <div className="guided-practice">{artwork}
    {practice.map?.map((entry,i)=><details key={i} onToggle={e=>{if(e.currentTarget.open)onHelp?.();}}><summary>{entry.label}</summary><p>{entry.text}</p></details>)}
    {practice.panels && <div className="grammar-scene-grid">{practice.panels.map((panel,i)=><article key={i}>
      {panel.image && <img src={panel.image} alt=""/>}<strong>{panel.label}</strong>
      <div>{panel.chunks.map((chunk,j)=><span className="grammar-chunk" data-role={/^(can|must|may|should|do|does|did)$/i.test(chunk)?'helper':/^(I|you|we|she|he|it|they)$/i.test(chunk)?'person':undefined} key={j}>
        <b lang="en">{chunk}</b>{panel.glosses?.[j]&&<small>{panel.glosses[j]}</small>}</span>)}</div>
      <p>{panel.meaning}</p></article>)}</div>}
    {practice.why.map(why)}
    {practice.assembly ? <><p>{practice.question}</p><WordOrder words={practice.assembly} reason={practice.question} onReveal={onReveal}/></> : practice.choices.length>0 && <fieldset>
      <legend>{practice.question}</legend>
      {practice.choices.map(([label], index) => <button type="button" key={index} aria-pressed={picked === index} data-correct={index===practice.correct}
        onClick={() => {setPicked(index);onReveal?.();}}>{label}</button>)}
      <div role="status">{picked !== null && practice.choices[picked] && <p className={picked===practice.correct?'grammar-right':'grammar-wrong'}>{picked===practice.correct?'✓ 맞아요. ':'✕ 아니에요. '}{practice.choices[picked][1].replace(/^맞아요\.\s*/,'')} {picked !== practice.correct && '다시 골라 보세요.'}</p>}</div>
    </fieldset>}
    {practice.writingPrompt && <label className="block">{practice.writingPrompt}
      <textarea rows={3} className="block w-full rounded-lg bg-white p-2 text-slate-900" placeholder="내가 전하고 싶은 말을 적어 보세요." />
    </label>}
  </div>;
}
