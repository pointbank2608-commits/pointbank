import {useEffect,type ReactNode,type RefObject} from 'react';
import {useGameHistory} from '../context/GameHistoryContext';
import {useToast} from '../context/ToastContext';
import {useTranslation} from 'react-i18next';

export default function GameHistoryRegion({children,identity,containerRef}:{children:ReactNode;identity:string;containerRef:RefObject<HTMLElement|null>}) {
  const history=useGameHistory();
  const {notify}=useToast(),{i18n}=useTranslation();
  useEffect(()=>{history?.clear();},[history,identity]);
  useEffect(()=>{
    const el=containerRef.current;if(!el||!history)return;
    el.dataset.gameHistoryRegion='';
    let frame=0;
    let activation:Element|null=null;
    const execute=(redo=false)=>void(redo?history.redo():history.undo()).catch(()=>notify(i18n.language.startsWith('en')?'Could not restore the game. Please try again.':'게임을 복원하지 못했어요. 다시 시도해 주세요.','error'));
    const changed=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>history.changed());};
    const begin=(event:Event)=>{
      if(!event.isTrusted&&event.target instanceof Element&&event.target.closest('[data-initial-game-start],[data-initial-game-start-container]'))return;
      if(!(event.target instanceof Element)||event.target.closest('[data-game-history-controls], [data-history-ignore]'))return;
      if(history.restoring){event.preventDefault();event.stopImmediatePropagation();return;}
      if(event instanceof KeyboardEvent){if(event.ctrlKey||event.metaKey||event.altKey||event.key==='Tab'||event.key==='Escape')return;}
      const target=event.target.closest('button,input,select,textarea,[role="button"]')??event.target;
      // Pointer-down games and native button clicks are one gesture, not two history entries.
      if(event.type==='click'){
        const paired=activation===target;activation=null;
        if(paired){changed();return;}
      }else if(event.type==='pointerdown'||event.type==='keydown')activation=target;
      history.begin();changed();
    };
    const key=(event:KeyboardEvent)=>{
      const target=event.target;
      if(!(target instanceof Element)||target.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(target.closest('[role="dialog"],dialog')&&!target.closest(`[data-game-history-owned="${history.owner}"]`))return;
      const stage=el.closest<HTMLElement>('[data-game-stage]')??el.querySelector<HTMLElement>('[data-game-stage]');
      if(!stage||stage.inert)return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
        event.preventDefault();event.stopImmediatePropagation();execute(event.shiftKey);return;
      }
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){
        event.preventDefault();event.stopImmediatePropagation();execute(true);return;
      }
      if(target===document.body||target===document.documentElement)begin(event);
    };
    const owned=(event:Event)=>{if(event.target instanceof Element&&!el.contains(event.target)&&event.target.closest(`[data-game-history-owned="${history.owner}"]`))begin(event);};
    el.addEventListener('pointerdown',begin,true);el.addEventListener('click',begin,true);el.addEventListener('keydown',begin,true);el.addEventListener('change',begin,true);
    document.addEventListener('keydown',key,true);
    document.addEventListener('pointerdown',owned,true);document.addEventListener('click',owned,true);document.addEventListener('change',owned,true);
    return()=>{delete el.dataset.gameHistoryRegion;cancelAnimationFrame(frame);document.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',owned,true);document.removeEventListener('click',owned,true);document.removeEventListener('change',owned,true);el.removeEventListener('pointerdown',begin,true);el.removeEventListener('click',begin,true);el.removeEventListener('keydown',begin,true);el.removeEventListener('change',begin,true);};
  },[history,containerRef,notify,i18n]);
  return <>{children}</>;
}
