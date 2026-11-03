import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {WordList} from '../../lib/types';
export default function WorksheetSourceDialog({lists,loading,failed,kind,onReload,onApply,onClose,canAppend}:{lists:WordList[];loading:boolean;failed:boolean;kind?:'word'|'sentence';onReload:()=>void;onApply:(list:WordList,append:boolean)=>void;onClose:()=>void;canAppend:boolean}){
 const {t}=useTranslation(),[candidate,setCandidate]=useState<WordList|null>(null),dialog=useRef<HTMLDialogElement>(null);const tr=(key:string)=>t('worksheetStudio.'+key);
 const reloadRef=useRef(onReload);reloadRef.current=onReload;
 useEffect(()=>{const el=dialog.current;el?.showModal();reloadRef.current();return()=>{el?.close();};},[]); // load the current library whenever the chooser opens
 return <dialog ref={dialog} className="ws-source-dialog no-print" aria-label={tr('changeSource')} onCancel={e=>{e.preventDefault();onClose();}}><header><h2>{tr('changeSource')}</h2><button type="button" className="ws-button" onClick={onClose}>{tr('cancelSource')}</button></header>
  {loading?<p role="status">{t('common.loading')}</p>:failed?<p role="alert">{tr('loadSourceFailed')} <button type="button" className="ws-button" onClick={onReload}>{tr('retrySource')}</button></p>:<div className="ws-source-choices">{lists.filter(l=>!kind||(l.kind||'word')===kind).map(list=><button type="button" className="ws-button" key={list.id} aria-pressed={candidate?.id===list.id} onClick={()=>setCandidate(list)}>{list.name} · {list.items.length}</button>)}</div>}
  {!loading&&!failed&&candidate&&<footer><p>{candidate.name} · {candidate.items.length}</p>{canAppend&&<button type="button" className="ws-button" onClick={()=>onApply(candidate,true)}>{tr('append')}</button>}<button type="button" className="ws-button ws-primary" onClick={()=>onApply(candidate,false)}>{tr('replace')}</button></footer>}
 </dialog>;
}
