import {useTranslation} from 'react-i18next';
import {builderParts,courseWord,readerSentence,type CourseUnit,type CourseSlide} from '../../data/phonicsLessons';
import {Stage1Lines,Stage1Picture,Stage1Speaker,Stage1Word} from './Stage1Art';
import type {PhonicsBankEntry} from '../../lib/types';
import '../../styles/phonics-lessons.css';

const rotate=<T,>(items:T[])=>items.length>1?[...items.slice(1),items[0]]:items;
function MarkedSentence({text,unit}:{text:string;unit:CourseUnit}){return <>{text.split(/(\b[a-z]+(?:-[a-z]+)*\b)/gi).map((part,i)=>{const entry=[...unit.reading.entries,...unit.entries].find(e=>e.word.toLowerCase()===part.toLowerCase());return entry?<Stage1Word key={i} entry={{...entry,word:part}}/>:part;})}</>;}
export default function PhonicsCourseSlide({unit:u,slide:s,index,total}:{unit:CourseUnit;slide:CourseSlide;index:number;total:number}){
 const {t}=useTranslation();
 const words=s.entryIds.map(id=>courseWord(u,id)),groups=s.groupIds.length?u.groups.filter(g=>s.groupIds.includes(g.id)):u.groups;
 const answer=s.phase>0,gameAnswer=s.phase===2;
 const tile=(entry:PhonicsBankEntry,label=true,speaker=true)=> <div className={'pc-word-card '+(answer&&s.answerIds.includes(entry.id)?'pc-answer':'')} key={entry.id} data-entry={entry.id}>{u.id==='course-4-7'&&entry.word==='fish'&&s.kind==='readChoose'?<div className="pc-plural-fish"><Stage1Picture entry={entry}/><Stage1Picture entry={entry}/></div>:<Stage1Picture entry={entry}/>} {label&&<Stage1Word entry={entry}/>} {speaker&&<Stage1Speaker entry={entry}/>}</div>;
 const cards=(labels=true)=><div className="pc-word-grid">{words.map(e=>tile(e,labels))}</div>;
 const ruleBlocks=()=> <div className="pc-rule-blocks">{groups.map((g,i)=>u.step===1?<div className="pc-letter-pair" key={g.id}><span className={'pc-pastel pc-tone-'+i%4}>{g.label[0]}</span><span className={'pc-pastel pc-tone-'+i%4}>{g.label[1]}</span></div>:<div key={g.id} className={'pc-pastel pc-tone-'+i%4}>{g.label}</div>)}</div>;
 const sentence=(id:string)=>readerSentence(u,id);
 const scene=()=>{
  const targetIndex=s.sceneTarget?s.entryIds.indexOf(s.sceneTarget):-1;
  // Coordinates stay fixed across scene/read steps; only the arrow and sentence change.
  const coordinates=u.reader==='bl-cl-fl'?[[13,78],[68,18],[87,63],[40,76]]:[[15,65],[40,25],[58,68],[83,50]];
  return <div className="pc-reader-scene" data-course-scene={u.reader}>
   {u.reader==='bl-cl-fl'?<img src="/phonics-course/level4-unit1-scene.webp" alt=""/>:<div className="pc-reader-objects">{words.map((e,i)=><div key={e.id} data-scene-entry={e.id} style={{left:(coordinates[i][0]-12)+'%',top:(coordinates[i][1]-25)+'%'}}>{u.id==='course-4-7'&&e.word==='fish'?<div className="pc-plural-fish"><Stage1Picture entry={e}/><Stage1Picture entry={e}/></div>:<Stage1Picture entry={e}/>}</div>)}</div>}
   {targetIndex>=0&&<svg viewBox="0 0 100 56" aria-hidden className="pc-reader-arrow"><line x1={coordinates[targetIndex][0]-9} y1={coordinates[targetIndex][1]*.56-10} x2={coordinates[targetIndex][0]} y2={coordinates[targetIndex][1]*.56} stroke="#df3048" strokeWidth="1.2"/><polygon points={`${coordinates[targetIndex][0]},${coordinates[targetIndex][1]*.56} ${coordinates[targetIndex][0]-4},${coordinates[targetIndex][1]*.56-1.8} ${coordinates[targetIndex][0]-1.4},${coordinates[targetIndex][1]*.56-4.2}`} fill="#df3048"/></svg>}
  </div>;
 };
 let body;
 switch(s.kind){
  case 'cover':case 'lesson':case 'finish':case 'extra':case 'end':case 'transition':body=<><strong className="pc-big-title">{s.kind==='cover'?`Unit ${u.number}`:s.title}</strong>{s.kind==='cover'&&ruleBlocks()}<p className="pc-large-hint">{s.hint}</p></>;break;
  case 'sounds':case 'letter':body=<>{s.text?<strong className="pc-big-title">{s.text}</strong>:ruleBlocks()}{s.kind==='sounds'&&words.length>0&&<div className="pc-small-pictures">{cards()}</div>}</>;break;
  case 'introduce':body=<div className="pc-introduce">{ruleBlocks()}{tile(words[0])}</div>;break;
  case 'letterMatch':body=<div className="pc-letter-match"><div>{groups.map(g=><strong className="pc-pastel pc-tone-1" key={g.id}>{g.label[0]}</strong>)}</div><div>{rotate(groups).map(g=><strong className="pc-pastel pc-tone-2" key={g.id}>{g.label[1]}</strong>)}</div></div>;break;
  case 'guess':case 'shadow':body=<div className="pc-single pc-guess"><Stage1Picture entry={words[0]} shadow={s.kind==='shadow'&&!answer}/>{answer&&<Stage1Word entry={words[0]}/>}</div>;break;
  case 'missing':body=<div className="pc-missing-grid" data-game-phase={s.phase}>{words.map(e=><div key={e.id} className={s.phase===2&&s.answerIds.includes(e.id)?'pc-answer':''}>{s.phase===1&&s.answerIds.includes(e.id)?<span>?</span>:<Stage1Picture entry={e}/>}</div>)}</div>;break;
  case 'word':case 'group':case 'choose':case 'odd':body=<>{s.kind==='choose'&&<Stage1Speaker entry={courseWord(u,s.answerIds[0])}/>}<div className={words.length===1?'pc-single':'pc-cards-wrap'}>{cards(s.kind!=='choose'||answer)}</div></>;break;
  case 'builder':{
   const target=u.groups.find(g=>g.entries.some(e=>e.id===words[0].id))!;const twoSounds=u.step===4&&target.ruleId.startsWith('blend-')&&!['sh','ch','wh','ng'].includes(target.sound);
   body=<div className="pc-builder">{twoSounds&&<div className="pc-blend-formation">{target.sound.split('').map((c,i)=><span key={i}>{i>0?' + ':''}{c}</span>)}<span> → {target.sound}</span></div>}<div className="pc-builder-parts">{builderParts(words[0],u.step).map((part,i)=><span key={i} className={'pc-pastel pc-tone-'+i%4} data-builder-part={part}>{part}</span>)}</div><div className="pc-builder-word">{tile(words[0])}</div>{u.step===3&&<div className="pc-magic-e"><span>Silent e · {target.sound.replace('_','…')}</span></div>}</div>;break;
  }
  case 'match':{
   const pictures=rotate(words);
   body=<div className="pc-match" data-match-order={pictures.map(e=>e.id).join('|')}><div className="pc-match-words">{words.map((e,i)=><div key={e.id}>{s.groupIds.length?<strong className="pc-match-rule">{u.groups.find(g=>g.entries.some(w=>w.id===e.id))?.label}</strong>:<Stage1Word entry={e}/>}<span className="pc-match-dot">●</span>{answer&&<small>{pictures.findIndex(p=>p.id===e.id)+1}</small>}<span className="pc-match-number">{String.fromCharCode(65+i)}</span></div>)}</div><div className="pc-match-pictures">{pictures.map((e,i)=><div key={e.id}><span>{i+1}</span><Stage1Picture entry={e}/>{answer&&<small>{String.fromCharCode(65+words.findIndex(w=>w.id===e.id))}</small>}</div>)}</div></div>;break;
  }
  case 'writeLetter':body=<div className="pc-letter-writing">{groups.map(g=><div key={g.id}><div className="pc-capitals"><span>{g.label[0]}</span><span>{g.label[1]}</span></div><Stage1Lines text={g.label[0]+'   '+g.label[1]} trace/></div>)}</div>;break;
  case 'write':body=<div className="pc-writing">{words.map(e=><div key={e.id}><Stage1Picture entry={e}/><Stage1Word entry={e}/><Stage1Lines text={e.word} trace/><Stage1Lines/></div>)}</div>;break;
  case 'complete':body=<div className="pc-word-grid">{words.map(e=><div className="pc-word-card" key={e.id}><Stage1Picture entry={e}/><Stage1Word entry={e} blank={!answer}/></div>)}</div>;break;
  case 'sort':body=<><div className="pc-sort-bank">{words.map(e=><Stage1Word key={e.id} entry={e}/>)}</div><div className="pc-sort-bins">{u.groups.filter(g=>g.entries.some(e=>s.entryIds.includes(e.id))).map((g,i)=><div className={'pc-pastel pc-tone-'+i%4} key={g.id}><strong>{g.label}</strong>{answer&&g.entries.filter(e=>s.entryIds.includes(e.id)).map(e=><Stage1Word entry={e} key={e.id}/>)}</div>)}</div></>;break;
  case 'puzzle':body=<div className="pc-game" data-game-phase={s.phase}><div className={'pc-puzzle pc-puzzle-'+s.phase}>{[0,1,2,3].map(i=><div key={i} className={'pc-piece pc-piece-'+i} style={{backgroundImage:`url("${words[0].image_url}")`}}/>)}</div>{gameAnswer&&<Stage1Word entry={words[0]}/>}</div>;break;
  case 'memory':body=<div className="pc-memory" data-game-phase={s.phase}>{s.phase===0?<Stage1Word entry={words[0]}/>:gameAnswer?<>{tile(words[0])}</>:<span className="pc-recall" aria-label={t('phonicsLesson.recall')}>?</span>}</div>;break;
  case 'readIntro':body=<><strong className="pc-big-title pc-reader-pattern">{s.hint}</strong>{s.draft&&<p className="pc-review-note">{t('phonicsLesson.draftHint')}</p>}</>;break;
  case 'sight':body=<div className="pc-sight">{s.text?.split(' ').map((word,i)=><strong key={i} className={'pc-pastel pc-tone-'+i%4}>{word}</strong>)}<Stage1Speaker text={s.text}/></div>;break;
  case 'findSight':body=u.reader==='abc'?<div className="pc-word-grid">{words.map(e=><div className="pc-word-card" key={e.id}><Stage1Picture entry={e}/><p className="pc-sentence"><span className={answer?'pc-pastel pc-tone-3':''}>a</span> <Stage1Word entry={e}/></p></div>)}</div>:<div className="pc-sentence-parts">{['Look','at','the',words[0].word+'.'].map((word,i)=><span key={i} className={answer&&i<3?'pc-pastel pc-tone-'+i:'pc-pastel'}>{word}</span>)}</div>;break;
  case 'scene':case 'read':body=<>{scene()}{s.text&&<p className="pc-sentence"><MarkedSentence text={s.text} unit={u}/><Stage1Speaker text={s.text}/></p>}</>;break;
  case 'readTogether':body=<div className="pc-read-all">{words.map(e=><div key={e.id}><Stage1Picture entry={e}/><p><MarkedSentence text={sentence(e.id)} unit={u}/></p><Stage1Speaker text={sentence(e.id)}/></div>)}</div>;break;
  case 'readChoose':body=<><p className="pc-sentence">{s.hint}<Stage1Speaker text={s.hint}/></p><div className="pc-cards-wrap"><div className="pc-word-grid">{words.map(e=>u.reader==='bl-cl-fl'&&e.word==='block'?<div key={e.id} className={'pc-word-card '+(answer&&s.answerIds.includes(e.id)?'pc-answer':'')}><img className="s1-picture" src="/phonics-course/level4-unit1-black-block.webp" alt=""/></div>:tile(e,false,false))}</div></div></>;break;
  case 'readAlone':body=<div className="pc-sentence-parts">{words.map(e=><Stage1Word key={e.id} entry={e}/>)}</div>;break;
  case 'readComplete':body=<><div className="pc-single">{tile(words[0],false,false)}</div><p className="pc-sentence">I see a {answer?words[0].word:'________'}.</p></>;break;
  case 'sentenceBuild':{
   const text=sentence(words[0].id);const parts=text.split(' ');const order=answer?parts:rotate(parts);
   body=<><div className="pc-sentence-parts">{order.map((w,i)=><span className={'pc-pastel pc-tone-'+i%4} key={i}>{w}</span>)}</div><div className="pc-small-pictures">{cards(false)}</div></>;break;
  }
 }
 return <article className={'s1-slide pc-lesson-slide pc-level-'+u.step} data-course-slide={s.id} data-course-kind={s.kind}>
  <header className="s1-slide-brand"><strong>ClassBank</strong><span>LEVEL {u.step} · UNIT {u.number} · {u.groups.map(g=>g.label).join(' · ')}</span></header>
  <h2 className="s1-slide-title">{s.title}</h2><div className="s1-slide-body">{s.draft&&<span className="pc-draft-badge">{t('phonicsLesson.readDraft')}</span>}<p className="pc-slide-hint">{!['cover','lesson','finish','extra','end','readIntro'].includes(s.kind)&&s.hint}</p>{body}</div>
  <footer className="s1-slide-footer"><span>{s.lesson==='extra'?'Extra Practice':`Lesson ${s.lesson}`} · {u.groups.map(g=>g.label).join(' · ')}</span><progress value={index+1} max={total}/><span>{index+1} / {total}</span></footer>
 </article>;
}
