import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { speakSequence } from '../../lib/speech';

export default function FlipDeck({ text, busy, onDone, onListen }: { text:string; busy:boolean; onDone:()=>void; onListen?:()=>void }) {
  const { t, i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const cards = text.split('\n').map(line=>line.split('|').map(part=>part.trim())).filter(parts=>parts[0]);
  const [index,setIndex] = useState(0);
  const [flipped,setFlipped] = useState(false);
  const [seen,setSeen] = useState<Set<number>>(new Set());
  if (!cards.length) return null;
  const [word,meaning,example] = cards[index];
  const all = seen.size === cards.length;
  const button = 'flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl px-3 font-bold disabled:opacity-45';
  function go(next:number) {setIndex(next);setFlipped(false);}
  function listen(count:number) {
    onListen?.();
    speakSequence(Array<string>(count).fill(flipped&&example?example:word));
  }
  return <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
    <div className="flex items-center gap-3 text-sm font-bold">
      <span>{en?'Look and listen':'보고 듣기'}</span>
      <progress value={index+1} max={cards.length} className="h-2 min-w-0 flex-1 overflow-hidden rounded-full accent-blue-400" aria-label={en?'Card progress':'카드 진행률'}/>
      <span>{index+1} / {cards.length}</span>
    </div>
    <button type="button" onClick={()=>{setFlipped(v=>!v);setSeen(old=>new Set(old).add(index));}} aria-label={flipped?t('studentHw.flipBack'):t('studentHw.flipFront')}
      className="flex min-h-56 flex-1 flex-col items-center justify-center gap-4 rounded-3xl bg-white p-6 text-center text-deep-navy shadow-xl">
      <span lang="en" className="max-w-full break-words text-4xl font-extrabold">{word}</span>
      {flipped?<><span className="text-2xl font-bold">{meaning}</span>{example&&<span lang="en" className="border-t pt-3 text-lg">{example}</span>}</>:<span>{t('studentHw.flipTap')}</span>}
    </button>
    <div className="flex gap-2">
      <button type="button" className={button+' bg-blue-600 text-white'} onClick={()=>listen(1)}><span className="material-symbols-outlined" aria-hidden>volume_up</span>{t('studentHw.listen')}</button>
      <button type="button" className={button+' bg-slate-100 text-deep-navy'} onClick={()=>listen(3)}><span className="material-symbols-outlined" aria-hidden>repeat</span>{en?'Listen 3 times':'반복 듣기'}</button>
    </div>
    <div className="mt-auto flex gap-2 pb-[env(safe-area-inset-bottom)]">
      <button type="button" className={button+' bg-[#efe8d4] text-[#1c2742]'} disabled={index===0||busy} onClick={()=>go(index-1)}><span className="material-symbols-outlined" aria-hidden>chevron_left</span>{t('studentHw.back')}</button>
      <button type="button" className={button+' bg-blue-600 text-white'} disabled={busy||(index===cards.length-1&&!all)} onClick={()=>index<cards.length-1?go(index+1):onDone()}>
        {index<cards.length-1?t('studentHw.nextStep'):all?t('studentHw.flipDone'):t('studentHw.flipAll')}<span className="material-symbols-outlined" aria-hidden>chevron_right</span>
      </button>
    </div>
  </div>;
}
