import type {ReactNode} from 'react';

export default function AnimationActivityWindow({title,label,onClose,children}:{title:string;label:string;onClose:()=>void;children:ReactNode}){
 return <div className="animation-window-anchor"><section className="animation-activity-window" aria-label={label}>
  <header><h2>{title}</h2><button className="animation-close" onClick={onClose}>× 닫기</button></header>
  <div className="animation-window-body">{children}</div>
 </section></div>;
}
