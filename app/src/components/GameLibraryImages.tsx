import {useEffect,useMemo,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {fetchWordBank} from '../lib/api';
import type {FullCardItem} from '../lib/types';

/** Reuse existing pictures without uploading or changing a saved word list. */
export default function GameLibraryImages({cards=[],onChoose}:{cards?:FullCardItem[];onChoose:(url:string)=>void}){
  const {t}=useTranslation();
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[limit,setLimit]=useState(24);
  const [bank,setBank]=useState<FullCardItem[]|null>(null);
  const [failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{if(!open||bank)return;let active=true;setFailed(false);void fetchWordBank().then(rows=>{if(active)setBank(rows.map(row=>({id:row.id,word:row.word,meaning:row.meaning,imageUrl:row.image_url})));}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[open,bank,retry]);
  const pictures=useMemo(()=>{
    const seen=new Set<string>(),term=query.trim().toLowerCase();
    return [...cards,...(bank||[])].filter(card=>{
      if(!card.imageUrl||term&&!`${card.word} ${card.meaning}`.toLowerCase().includes(term)||seen.has(card.imageUrl))return false;
      seen.add(card.imageUrl);return true;
    });
  },[cards,bank,query]);
  return <div className="w-full space-y-3" data-game-library-images>
    <button type="button" className="min-h-11 rounded-xl border px-4 py-2 font-bold text-primary" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{t('imagePicker.library')}</button>
    {open&&<div className="space-y-3 rounded-xl border bg-white p-3">
      <p>{t('imagePicker.libraryHint')}</p>
      <label className="block">{t('imagePicker.search')}<input className="ml-2 max-w-full rounded-lg border p-2" value={query} onChange={event=>{setQuery(event.target.value);setLimit(24);}}/></label>
      {!bank&&!failed&&<p role="status">{t('common.loading')}</p>}
      {failed&&<p role="alert">{t('guide.failed')} <button type="button" className="min-h-11 rounded-lg border px-4" onClick={()=>setRetry(value=>value+1)}>{t('guide.retry')}</button></p>}
      <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">{pictures.slice(0,limit).map(card=><button key={card.imageUrl} type="button" className="min-w-0 rounded-xl border p-2 text-center focus-visible:outline-4 focus-visible:outline-primary" onClick={()=>{onChoose(card.imageUrl!);setOpen(false);}} aria-label={t('imagePicker.choose',{word:card.word})}><img loading="lazy" className="mx-auto h-20 w-full object-contain" src={card.imageUrl!} alt=""/><span className="block truncate">{card.word}</span><small className="block truncate">{card.meaning}</small></button>)}</div>
      {bank&&!pictures.length&&<p>{t('imagePicker.noMatches')}</p>}
      {pictures.length>limit&&<button type="button" className="min-h-11 rounded-lg border px-4" onClick={()=>setLimit(value=>value+24)}>{t('imagePicker.more')}</button>}
    </div>}
  </div>;
}
