import { useState, useRef, useEffect, type PointerEvent, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { sentencePieces, sentenceOrderCorrect, type AdventureSentence } from '../../lib/adventureGames';
import { shuffled } from '../../lib/storybook';

export default function ArrangePieces({sentence,disabled,train,onOrder}:{sentence:AdventureSentence;disabled:boolean;train:boolean;onOrder:(ids:string[])=>void}){
  const [pieces]=useState(()=>sentencePieces(sentence));
  const [order,setOrder]=useState(()=>{const out=shuffled(pieces.map(p=>p.id));if(sentenceOrderCorrect(sentence,out))out.push(out.shift()!);return out;});
  const [selected,setSelected]=useState<string|null>(null);
  useEffect(()=>onOrder(order),[order,onOrder]);
  const [ghost,setGhost]=useState<{text:string;x:number;y:number}|null>(null);
  const origin=useRef<{id:string;x:number;y:number;moved:boolean}|null>(null);
  const nodes=useRef(new Map<string,HTMLButtonElement>());
  function apply(next:string[]){setOrder(next);setSelected(null);onOrder(next);}
  function move(id:string,to:number){const from=order.indexOf(id);if(from<0||to<0||to>=order.length)return;const next=[...order];next.splice(from,1);next.splice(to,0,id);apply(next);}
  function down(e:PointerEvent<HTMLButtonElement>,id:string){if(disabled||e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);origin.current={id,x:e.clientX,y:e.clientY,moved:false};}
  function drag(e:PointerEvent<HTMLButtonElement>){const o=origin.current;if(!o)return;if(Math.hypot(e.clientX-o.x,e.clientY-o.y)>8)o.moved=true;if(o.moved)setGhost({text:pieces.find(p=>p.id===o.id)!.text,x:e.clientX,y:e.clientY});}
  function up(e:PointerEvent<HTMLButtonElement>){const o=origin.current;if(!o)return;if(o.moved){e.currentTarget.dataset.dragged='yes';const target=[...nodes.current].find(([,node])=>{const r=node.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;});if(target)move(o.id,order.indexOf(target[0]));}origin.current=null;setGhost(null);}
  return <><div className={train?'ad-carriages':'ad-chunks'} aria-label="문장 블록 배열">
    {order.map((id,i)=><button key={id} ref={node=>{if(node)nodes.current.set(id,node);else nodes.current.delete(id);}} type="button" data-piece={id} data-piece-text={pieces.find(p=>p.id===id)!.text} className={`ad-piece ${selected===id?'is-selected':''}`} style={{'--tile':['#ffc2d6','#ffe6a7','#b9ead5','#b8e7f5','#d8c8fa'][i%5]} as CSSProperties} aria-label={`${i+1}번 블록 ${pieces.find(p=>p.id===id)!.text}`} aria-pressed={selected===id} disabled={disabled} onPointerDown={e=>down(e,id)} onPointerMove={drag} onPointerUp={up} onPointerCancel={()=>{origin.current=null;setGhost(null);}} onClick={e=>{if(e.currentTarget.dataset.dragged){delete e.currentTarget.dataset.dragged;return;}if(selected&&selected!==id){const next=[...order],a=next.indexOf(selected),b=next.indexOf(id);[next[a],next[b]]=[next[b],next[a]];apply(next);}else setSelected(selected===id?null:id);}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(id,i+(e.key==='ArrowLeft'?-1:1));}}}>
      <small>{i+1}</small><span>{pieces.find(p=>p.id===id)!.text}</span>{train&&<i className="ad-wheels"/>}
    </button>)}
  </div><p className="ad-control-help">드래그하거나, 두 블록을 차례로 눌러 자리를 바꿔요. 키보드 ← →도 가능해요.</p>
    <button className="ad-secondary" disabled={disabled} onClick={()=>{const next=shuffled(order);apply(next);}}>↻ 다시 배열하기</button>
    {ghost&&createPortal(<div className="ad-drag-ghost" style={{left:ghost.x,top:ghost.y}}>{ghost.text}</div>,document.fullscreenElement||document.body)}
  </>;
}
