import { useState } from 'react';
import '../../styles/ready-class-workbook.css';

const sets = [
  { id:'01', words:['I','see','a'], sentences:['I see a pig.','I see a hen.'], prompt:'I ___ a pig.', choices:['see','a'] },
  { id:'02', words:['can','it'], sentences:['I see a pig.','I can see it.'], prompt:'I ___ see a pig.', choices:['can','a'] },
  { id:'03', words:['the','is'], sentences:['The cat is big.','The pig is wet.'], prompt:'The cat ___ big.', choices:['is','the'] },
  { id:'R1', words:['I','see','a','can','it','the','is'], sentences:['I can see a cat.','The hen is wet.'], prompt:'The hen ___ wet.', choices:['is','see'] },
  { id:'04', words:['in','on'], sentences:['The cat is in the box.','The cat is on the box.'], prompt:'The cat is ___ the box. (inside)', choices:['on','in'] },
  { id:'05', words:['my','and'], sentences:['I can see my cat and my dog.','My cat is big and wet.'], prompt:'I see a cat ___ a dog.', choices:['my','and'] },
  { id:'06', words:['you','we'], sentences:['Can you see it?','We can see it.'], prompt:'Can ___ see it?', choices:['it','you'] },
  { id:'R2', words:['in','on','my','and','you','we','can','see','it','the','is','a','I'], sentences:['We can see a dog in the box.','Can you see my cat and my dog?'], prompt:'Can you see my cat ___ my dog?', choices:['and','on'] },
];
const title = (id: string) => id.startsWith('R') ? 'Review ' + id.slice(1) : 'Set ' + id;

export default function SightWordWorksheets() {
  const [active,setActive] = useState('01');
  const set = sets.find(item=>item.id===active)!;
  const review = active.startsWith('R');
  const targets = set.words.slice(0,review?4:3);
  const distractors = sets.slice(0,sets.indexOf(set)+1).flatMap(item=>item.words);
  return <section className="rc-workbook">
    <div className="no-print">
      <h2 className="text-2xl font-bold">사이트워드</h2>
      <p>수업 전후 3~5분에 쓰는 A4 활동지예요. 세트를 골라 바로 미리 보거나 인쇄하세요.</p>
      <div className="my-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{sets.map(item=>
        <button key={item.id} type="button" aria-pressed={active===item.id} onClick={()=>setActive(item.id)}
          className={`rounded-xl border-2 bg-white p-4 text-left ${active===item.id?'border-primary':'border-outline-variant'}`}>
          <strong className="block">{title(item.id)} · {item.id.startsWith('R')?'누적 복습':'기본 세트'}</strong>
          <span className="block">{item.words.join(' · ')}</span><span lang="en">{item.sentences[0]}</span>
        </button>)}</div>
      <div className="rc-controls"><strong>{title(active)} 미리보기</strong><button type="button" data-print onClick={()=>window.print()}>인쇄</button></div>
    </div>
    <div className="rc-preview"><article className="rc-sheet" lang="en">
      <div className="rc-band" style={{background:'#fff0b9'}}><h1>Sight Words · {title(active)}</h1></div>
      <div className="rc-name">Name <span/> Date <span/></div>
      <div className="rc-body" style={{gap:'9mm'}}>
        <section><h2>{review?'Review the Words':'Read the Words'}</h2><div className="rc-review-words" style={{background:'#eef6ff'}}>{set.words.map(word=><strong key={word}>{word}</strong>)}</div></section>
        <section><h2>Find and Circle</h2><p>Read the first word. Circle the same word.</p>
          {targets.map((word,index)=>{
            const others=[...new Set(distractors)].filter(other=>other!==word).slice(0,4);
            const choices=[...others]; choices.splice(index% (choices.length+1),0,word);
            return <div key={word} className="rc-review-row" style={{background:'#f2f7ff'}}><strong>{word}</strong><div>{choices.map(choice=><span key={choice}>{choice}</span>)}</div></div>;
          })}
        </section>
        <section><h2>Read the Sentences</h2>{set.sentences.map((sentence,index)=><p key={sentence} style={{fontSize:'6mm',lineHeight:1.55}}>
          {index===0&&!review?sentence.split(/(\s+)/).map((part,i)=>set.words.some(word=>word.toLowerCase()===part.replace(/[.!?]/g,'').toLowerCase())?<strong key={i}>{part}</strong>:part):sentence}</p>)}</section>
        <section><h2>Quick Check</h2><p>Choose a word. Read the sentence.</p><p style={{fontSize:'6mm'}}>{set.prompt}</p><p style={{fontSize:'5mm'}}>{set.choices.join('     /     ')}</p></section>
      </div><footer>ClassBank <span>1 / 1</span></footer>
    </article></div>
  </section>;
}
