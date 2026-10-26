import {useTranslation} from 'react-i18next';
export type CatchLevel = 1 | 2 | 3 | 4 | 5;
export const CATCH_DEFAULT_SECONDS: Record<CatchLevel, number> = {1:2,2:3,3:5,4:5,5:6};
export default function CatchSentenceSettings({level,seconds,disabled=false,onChange}:{level:CatchLevel;seconds:number;disabled?:boolean;onChange:(patch:{level?:CatchLevel;seconds?:number})=>void}){
 const {t}=useTranslation();
 return <fieldset className="my-3 space-y-3 rounded-xl border border-outline-variant bg-white p-4" disabled={disabled} data-catch-settings>
  <legend className="px-2 font-bold text-deep-navy">{t('gameCatchSentence.levelTimeSettings')}</legend>
  <div className="flex flex-wrap gap-2">{([1,2,3,4,5] as CatchLevel[]).map(l=><button type="button" key={l} aria-pressed={level===l} onClick={()=>onChange({level:l,seconds:CATCH_DEFAULT_SECONDS[l]})} className={`min-h-11 rounded-xl border px-3 py-2 font-bold ${level===l?'border-primary bg-primary !text-white':'border-outline-variant bg-white text-deep-navy'}`}>{t('gameCatchSentence.levelChip',{n:l})}</button>)}</div>
  <label className="block font-bold text-deep-navy">{t('gameCatchSentence.displaySeconds')}<input type="number" min={1} max={10} step={0.5} value={seconds} onChange={e=>{if(e.target.value.trim())onChange({seconds:Math.max(1,Math.min(10,Math.round(Number(e.target.value)*2)/2||1))});}} className="ml-2 min-h-11 w-24 rounded-lg border border-outline-variant bg-white px-3 py-2 text-deep-navy"/></label>
 </fieldset>;
}
