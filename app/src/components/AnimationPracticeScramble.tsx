import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {sentenceWords} from '../lib/videoQuestions';

// Keep the ends of long lines on the board and group the middle around phrase boundaries.
function sentenceCards(en:string) {
  const tokens=sentenceWords(en);
  if(tokens.length<7)return {prefix:'',suffix:'',cards:tokens};
  const prefix=tokens.splice(0,2).join(' ');
  const suffix=tokens.splice(tokens.length-(/[,;]$/.test(tokens.at(-2)??'')?2:1)).join(' ');
  const chunks:string[][]=[];
  for(const word of tokens) {
    const last=chunks.at(-1);
    if(!last||last.length>=4||(/^(?:and|but|for|with|from|at|in|on|to)$/i.test(word)&&last[0].toLowerCase()!==word.toLowerCase()))chunks.push([word]);
    else last.push(word);
  }
  const cards=chunks.length>1?chunks.map(chunk=>chunk.join(' ')):tokens;
  return {prefix,suffix,cards};
}

export default function AnimationPracticeScramble({en,ko,observe}:{en:string;ko:string;observe?:()=>void}) {
  const {t}=useTranslation();
  const {prefix,suffix,cards:words}=sentenceCards(en);
  const [cards]=useState(()=>{
    const ids=words.map((_,i)=>i);
    for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
    if(ids.length>1&&ids.every((id,i)=>id===i))ids.push(ids.shift()!);
    return ids;
  });
  const [order,setOrder]=useState<number[]>([]);
  const complete=order.length===words.length;
  const correct=complete&&order.every((id,index)=>words[id]===words[index]);
  function add(id:number) {
    setOrder([...order,id]);
    if(order.length+1===words.length)observe?.();
  }
  return <div className="episode-scramble" data-result={complete?(correct?'correct':'wrong'):undefined}>
    {ko&&<p lang="ko">{ko}</p>}
    <div className="episode-answer-slots">{prefix} {words.map((_,i)=>i<order.length?
      <button key={i} onClick={()=>setOrder(order.filter((__,slot)=>slot!==i))}>{words[order[i]]}</button>:<span key={i}>{i+1}</span>)} {suffix}</div>
    <p>{t('episodeActivities.orderHint')}</p>
    <div className="episode-choice-row">{cards.map(id=><button key={id} disabled={order.includes(id)} onClick={()=>add(id)}>{words[id]}</button>)}</div>
    {complete&&<strong role="status">{t(correct?'episodeActivities.correct':'episodeActivities.wrong')}</strong>}
    {order.length>0&&<button onClick={()=>setOrder([])}>{t('episodeActivities.retry')}</button>}
  </div>;
}
