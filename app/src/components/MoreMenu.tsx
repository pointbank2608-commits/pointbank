import {createPortal} from 'react-dom';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
export interface MoreMenuItem {key:string;label:string;icon?:string;danger?:boolean;onSelect:()=>void}
interface Props {triggerLabel:string;items:MoreMenuItem[];className?:string}
/** Top-layer menu stays outside card clipping; old browsers use a portal. */
export default function MoreMenu({triggerLabel,items,className=''}:Props){
 const [open,setOpen]=useState(false),wrap=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
 const usePopover=typeof HTMLElement!=='undefined'&&'showPopover' in HTMLElement.prototype;
 useLayoutEffect(()=>{
  const node=menu.current;if(!open||!node||!trigger.current)return;
  if(usePopover)node.showPopover();
  const position=()=>{const r=trigger.current!.getBoundingClientRect(),height=node.getBoundingClientRect().height;
   node.style.left=`${Math.max(8,Math.min(innerWidth-node.offsetWidth-8,r.right-node.offsetWidth))}px`;
   node.style.top=`${Math.max(8,r.bottom+height+8>innerHeight?r.top-height-4:r.bottom+4)}px`;
   node.style.maxHeight=`${innerHeight-16}px`;
  };
  position();node.querySelector<HTMLButtonElement>('button')?.focus();
  const resize=new ResizeObserver(position);resize.observe(node);
  window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
  return()=>{resize.disconnect();if(usePopover&&node.matches(':popover-open'))node.hidePopover();window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);};
 },[open,usePopover]);
 useEffect(()=>{
  if(!open)return;
  const down=(e:PointerEvent)=>{if(!wrap.current?.contains(e.target as Node)&&!menu.current?.contains(e.target as Node))setOpen(false);};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);trigger.current?.focus();}};
  document.addEventListener('pointerdown',down);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('pointerdown',down);document.removeEventListener('keydown',key);};
 },[open]);
 const popup=open?<div ref={menu} popover={usePopover?'manual':undefined} role="menu" aria-label={triggerLabel}
  style={{position:'fixed',zIndex:2147483647,margin:0,overflowY:'auto',maxWidth:'calc(100vw - 16px)'}}
  className="w-56 rounded-xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-lg"
  onKeyDown={e=>{const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button')),index=buttons.indexOf(document.activeElement as HTMLButtonElement);
   if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}
   if(e.key==='Tab'){setOpen(false);trigger.current?.focus();}
  }}>
  {items.map(item=><div key={item.key} className={item.danger?'mt-1 border-t border-outline-variant/50 pt-1':''}>
   <button type="button" role="menuitem" onClick={()=>{setOpen(false);trigger.current?.focus();item.onSelect();}}
    className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left font-label-md text-label-md hover:bg-surface-container-low ${item.danger?'text-error':'text-on-surface'}`}>
    {item.icon&&<span className="material-symbols-outlined text-[18px]" aria-hidden>{item.icon}</span>}{item.label}
   </button></div>)}
 </div>:null;
 return <div ref={wrap} className={`relative ${className}`}><button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open}
  onClick={()=>setOpen(value=>!value)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);}}}
  className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-outline-variant px-3 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary">
  <span className="material-symbols-outlined text-[18px]" aria-hidden>more_horiz</span>{triggerLabel}
 </button>{popup&&(usePopover?popup:createPortal(popup,trigger.current?.closest('dialog')||document.fullscreenElement||document.body))}</div>;
}
