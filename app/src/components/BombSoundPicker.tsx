import {useId} from 'react';
import {useTranslation} from 'react-i18next';
import type {BombSound} from '../lib/bombSound';
export default function BombSoundPicker({value,onChange,disabled=false}:{value?:BombSound;onChange:(value:BombSound)=>void;disabled?:boolean}) {
 const {t}=useTranslation();const group=useId();const selected=value==='music'?'music':'clock';
 return <fieldset className="my-3 rounded-xl border border-outline-variant bg-white p-4" disabled={disabled} data-bomb-sound>
  <legend className="px-2 font-bold text-deep-navy">{t('bombSound.label')}</legend>
  <div className="flex flex-wrap gap-2">{(['clock','music'] as const).map(sound=><label key={sound} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 font-bold ${(selected===sound)?'border-primary bg-[#e6f2ff] text-deep-navy':'border-outline-variant text-on-surface'}`}><input className="scroll-my-40" type="radio" name={group} checked={selected===sound} onChange={()=>onChange(sound)}/>{t(`bombSound.${sound}`)}</label>)}</div>
  <p className="mt-2 text-sm text-on-surface-variant">{t('bombSound.hint')}</p>
 </fieldset>;
}
