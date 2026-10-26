import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';

/** Shared by the preparation dialog and the legacy in-board editor. */
export default function BombRangePicker({min,max,onChange}:{min:number;max:number;onChange:(min:number,max:number)=>void}){
 const {t}=useTranslation();const [low,setLow]=useState(String(min)),[high,setHigh]=useState(String(max));
 useEffect(()=>{setLow(String(min));setHigh(String(max));},[min,max]);
 function commit(){
  if(!low.trim()||!high.trim()||!Number.isFinite(Number(low))||!Number.isFinite(Number(high))){setLow(String(min));setHigh(String(max));return;}
  const nextMin=Math.max(1,Math.round(Number(low))),nextMax=Math.max(nextMin,Math.round(Number(high)));
  setLow(String(nextMin));setHigh(String(nextMax));onChange(nextMin,nextMax);
 }
 const input='min-h-11 w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-base text-on-surface focus-visible:outline-2 focus-visible:outline-primary';
 return <fieldset className="my-3 rounded-xl border border-outline-variant bg-white p-4" data-bomb-range>
  <legend className="px-2 font-bold text-deep-navy">{t('gameBomb.rangeLabel')}</legend>
  <div className="grid grid-cols-2 gap-3">
   <label className="min-w-0 text-sm font-bold text-deep-navy">{t('gameBomb.minTime')}<input type="number" min={1} step={1} value={low} onChange={e=>setLow(e.target.value)} onBlur={commit} className={input}/></label>
   <label className="min-w-0 text-sm font-bold text-deep-navy">{t('gameBomb.maxTime')}<input type="number" min={1} step={1} value={high} onChange={e=>setHigh(e.target.value)} onBlur={commit} className={input}/></label>
  </div>
  <p className="mt-2 text-sm text-on-surface-variant">{t('gameBomb.rangeHint')}</p>
 </fieldset>;
}
