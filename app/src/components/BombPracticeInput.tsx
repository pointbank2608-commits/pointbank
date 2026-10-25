import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import GameSourcePicker from './GameSourcePicker';

/** Practice content is separate from the participant rows and never edits a source list. */
export default function BombPracticeInput({value,onChange}:{value:string;onChange:(value:string)=>void}) {
 const {t}=useTranslation();const id=useId();const input=useRef<HTMLTextAreaElement>(null);
 return <section className="space-y-3" aria-label={t('guide.bombWords')} data-bomb-practice>
  <label htmlFor={id} className="block font-bold">{t('guide.bombWords')}</label>
  <GameSourcePicker kind="sentence" onDirect={()=>input.current?.focus()} onPick={cards=>{
   const seen=new Set(value.split(/\r?\n/).map(line=>line.trim()));
   const added=cards.flatMap(card=>card.word.split(/\r?\n/)).map(line=>line.trim()).filter(line=>{if(!line||seen.has(line))return false;seen.add(line);return true;});
   if(added.length)onChange(value+(value&&!value.endsWith('\n')?'\n':'')+added.join('\n'));
  }}/>
  <p className="text-sm text-on-surface-variant">{t('source.bombPracticeHint')}</p>
  <textarea id={id} ref={input} className="min-h-24 w-full rounded-xl border p-3 font-normal" value={value} onChange={e=>onChange(e.target.value)}/>
 </section>;
}
