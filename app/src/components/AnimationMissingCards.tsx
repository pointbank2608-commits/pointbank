import {useEffect,useMemo,useState} from 'react';
import {useTranslation} from 'react-i18next';
import AnimationActivityWindow from './AnimationActivityWindow';
import {useWordBankEnriched} from '../lib/wordBankCache';
import {WORKBOOK_COLOR_PATHS} from '../lib/workbookImageManifest';

type Word={word:string;meaning:string;imageUrl?:string|null};
const pictures=new Set(WORKBOOK_COLOR_PATHS);
type Phase='setup'|'memory'|'prompt'|'guess'|'answer';

function shuffle<T,>(items:T[]) {
  const result=[...items];
  for (let i=result.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}
export default function AnimationMissingCards({words,onClose,onList,observe}:{
  words:Word[];onClose:()=>void;onList:()=>void;observe?:(action:'shown'|'revealed')=>void
}) {
  const {t}=useTranslation();
  const selected=useMemo(()=>words.map((word,i)=>({...word,id:String(i),imageUrl:word.imageUrl??null})),[words]);
  const enriched=useWordBankEnriched(selected);
  const pool=useMemo(()=>[...new Map(enriched.map(word=>{
    const key=word.word.trim().toLowerCase();
    const path='/word-bank-images/'+key.replace(/\s+/g,'-')+'.webp';
    return [key,{...word,imageUrl:word.imageUrl??(pictures.has(path)?path:null)}] as const;
  })).values()],[enriched]);
  const sizes=[...new Set([6,8].map(n=>Math.min(n,pool.length)))];
  const [wanted,setWanted]=useState(6),[seconds,setSeconds]=useState(5),[round,setRound]=useState(0);
  const [phase,setPhase]=useState<Phase>('setup');
  const [deck,setDeck]=useState<Word[]>([]),[remaining,setRemaining]=useState<Word[]>([]),[missing,setMissing]=useState<Word>();
  const [loaded,setLoaded]=useState<Set<string>>(()=>new Set()),[failed,setFailed]=useState<Set<string>>(()=>new Set());
  const size=Math.min(wanted,pool.length),total=size?Math.ceil(pool.length/size):0;
  const ready=deck.every(card=>!card.imageUrl||loaded.has(card.imageUrl)||failed.has(card.imageUrl));
  useEffect(()=>{
    if(phase==='memory'&&ready){const timer=setTimeout(()=>setPhase('prompt'),seconds*1000);return ()=>clearTimeout(timer);}
    if(phase==='prompt'){const timer=setTimeout(()=>setPhase('guess'),1000);return ()=>clearTimeout(timer);}
  },[phase,ready,seconds]);
  function start(number:number) {
    const cards=shuffle(Array.from({length:size},(_,i)=>pool[(number*size+i)%pool.length]));
    const hidden=cards[Math.floor(Math.random()*cards.length)];
    setDeck(cards);setMissing(hidden);setRemaining(shuffle(cards.filter(card=>card!==hidden)));
    setRound(number);setPhase('memory');observe?.('shown');
  }
  const guessing=phase==='guess',answered=phase==='answer';
  const board=guessing?remaining:answered&&missing?[missing]:deck;
  const setup=phase==='setup'&&pool.length>=2;
  const footer=pool.length>=2&&phase!=='setup'&&<>
    <small>{phase==='memory'?t('episodeActivities.remember'):guessing?t('episodeActivities.guess'):''}</small>
    {guessing&&<button onClick={()=>{setPhase('answer');observe?.('revealed');}}>{t('animationPass.answer')}</button>}
    {answered&&<button onClick={()=>round+1<total?start(round+1):onList()}>{t(round+1<total?'episodeActivities.nextRound':'episodeActivities.list')}</button>}
  </>;
  return <AnimationActivityWindow title="What’s Missing?" label="What’s Missing?" onClose={onClose} onList={onList}
    layout={setup?'missing-setup':undefined}
    headerActions={setup&&<button className="episode-primary" onClick={()=>start(0)}>{t('episodeActivities.start')}</button>}
    progress={total?t('episodeActivities.round',{number:round+1,total}):undefined} footer={footer}>
    {pool.length<2?<p>{t('episodeActivities.few')}</p>:<div className="episode-missing">
      {phase==='setup'&&<div className="episode-missing-settings">
        <div>{t('episodeActivities.cards')} {sizes.map(n=><button key={n} aria-pressed={size===n} onClick={()=>setWanted(n)}>{t('episodeActivities.cardCount',{count:n})}</button>)}</div>
        <div>{t('episodeActivities.memory')} {[3,5].map(n=><button key={n} aria-pressed={seconds===n} onClick={()=>setSeconds(n)}>{t('episodeActivities.seconds',{count:n})}</button>)}</div>
      </div>}
      {setup?<div className="episode-setup-board"><div className="episode-missing-grid" data-columns={size>6?4:3} data-phase="setup">
        {Array.from({length:size},(_,i)=><span key={i} className="episode-card-back"/>)}
      </div></div>:phase==='prompt'?<div className="episode-missing-prompt" role="status"><strong>?</strong>What’s Missing?</div>:
      <div className="episode-missing-grid" data-columns={answered?1:size>6?4:3} data-phase={phase} aria-busy={phase==='memory'&&!ready}>
        {board.map(card=><div key={card.word} className="episode-picture-card">
          {card.imageUrl&&!failed.has(card.imageUrl)&&<img src={card.imageUrl} alt=""
            onLoad={()=>setLoaded(previous=>new Set(previous).add(card.imageUrl!))}
            onError={()=>setFailed(previous=>new Set(previous).add(card.imageUrl!))}/>}
          <strong lang="en">{card.word}</strong>
        </div>)}
      </div>}
    </div>}
  </AnimationActivityWindow>;
}
