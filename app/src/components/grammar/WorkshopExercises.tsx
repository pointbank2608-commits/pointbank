import { useState } from 'react';
import { extensionPool, type ExtensionQuestion, type Workshop } from '../../../../supabase/functions/_shared/grammarWorkshop';
import './guided-practice.css';

export function WordOrder({ words, reason, onReveal }: { words: string[]; reason: string; onReveal?: () => void }) {
  const [order,setOrder]=useState<number[]>([]);
  const [checked,setChecked]=useState(false);
  const sequence=words.map((_,i)=>i);
  const split=Math.ceil(sequence.length/2);
  const mixed=[...sequence.slice(split),...sequence.slice(0,split)];
  const answer=order.map(i=>words[i]).join(' ');
  const correct=answer===words.join(' ');
  return <div className="grammar-order">
    <div>{mixed.map(i=><button type="button" key={i} disabled={order.includes(i)} onClick={()=>setOrder([...order,i])}>{words[i]}</button>)}</div>
    <p aria-live="polite">{answer}</p>
    <button type="button" disabled={!order.length} onClick={()=>{setOrder([]);setChecked(false);}}>다시 놓기</button>
    <button type="button" disabled={order.length!==words.length || checked} onClick={()=>{setChecked(true);onReveal?.();}}>순서 확인</button>
    {checked && <p role="status" className={correct?'grammar-right':'grammar-wrong'}>{correct?'✓ 맞아요. '+reason:'✕ 아니에요. 놓은 조각을 처음부터 읽고 다시 놓아 보세요.'}</p>}
  </div>;
}
export function ExtensionItem({ item, onReveal }: {item: ExtensionQuestion; onReveal?:()=>void}) {
  const [response,setResponse]=useState('');
  const [show,setShow]=useState(false);
  return <div className="guided-practice">
    <h3 className="font-bold">{item.title}</h3><p className="whitespace-pre-line">{item.prompt}</p>
    {item.kind==='order'?<WordOrder words={item.answer.split(/\s+/)} reason={item.reason} onReveal={onReveal}/>:
      item.kind==='choice'?<><div>{item.options?.map((o,i)=><button type="button" key={i} aria-pressed={response===o} data-correct={o===item.answer}
        onClick={()=>{setResponse(o);onReveal?.();}}>{o}</button>)}</div>{response&&<p role="status" className={response===item.answer?'grammar-right':'grammar-wrong'}>
        {response===item.answer?'✓ 맞아요. ':'✕ 아니에요. '}{item.reason}</p>}</>:
      <label className="block">내 답<textarea value={response} onChange={e=>setResponse(e.target.value)}/>
        <button type="button" disabled={!response.trim()} onClick={()=>{setShow(true);onReveal?.();}}>예시와 비교</button>
        {show&&<span className="question-model block">{item.answer}<br/>{item.reason}</span>}</label>}
  </div>;
}
export function WorkshopExercises({workshop,onReveal}:{workshop:Workshop;onReveal?:()=>void}) {
  const questions=extensionPool(workshop).slice(0,workshop.count);
  const [index,setIndex]=useState(0);
  const question=questions[Math.min(index,questions.length-1)];
  if (!question) return null;
  return <section className="guided-practice mt-4 rounded-xl border p-3">
    <h3>심화 연습 · {Math.min(index+1,questions.length)} / {questions.length}</h3>
    <ExtensionItem key={index+'-'+question.prompt} item={question} onReveal={onReveal}/>
    <button type="button" disabled={!index} onClick={()=>setIndex(index-1)}>이전 문제</button>
    <button type="button" disabled={index+1>=questions.length} onClick={()=>setIndex(index+1)}>다음 문제</button>
  </section>;
}
