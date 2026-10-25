import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { chunk, makeRng, shuffled } from '../../lib/worksheetGenerators';
import { worksheetActivity } from '../../lib/worksheetActivityCatalog';
import { hasOpenAnswers, studioLegacyPages, safePicture, soundGroups, type StudioTask, type StudioWord, type WorksheetDocument } from '../../lib/worksheetStudio';
import { chainCue, listeningChoices, passageChunks, printableCrossword, studentBlocks, teacherAnswers, teacherCues, type StudioPaperBlock } from '../../lib/worksheetActivityPrinting';
import WorksheetSheets, { WorksheetAnswerSheets } from './WorksheetSheets';
import TracingRow from './TracingRow';

function Lines({count=2}:{count?:number}) {return <div className="ws-lines" aria-hidden="true">{Array.from({length:count},(_,i)=><div key={i}/>)}</div>;}
function Picture({src,large=false}:{src?:string|null;large?:boolean}) {return src&&safePicture(src)?<img className={large?'ws-picture ws-picture-large':'ws-picture'} src={src} alt="" onLoad={e=>{e.currentTarget.style.visibility='visible';}} onError={e=>{e.currentTarget.style.visibility='hidden';}}/>:null;}
function Box({title,children,large=false}:{title:string;children?:ReactNode;large?:boolean}) {return <section className={`ws-box${large?' ws-box-large':''}`}><strong>{title}</strong>{children||<Lines count={large?5:2}/>}</section>;}
function Paper({doc,children,label,page}:{doc:WorksheetDocument;children:ReactNode;label?:string;page:number}) {
 const {t}=useTranslation();
 return <section className="ws-paper print-board" data-studio-paper data-activity={doc.activityId}>
  <header className="ws-paper-heading"><div><span className="ws-brand">ClassBank</span>{label&&<span className="ws-sheet-label">{label}</span>}<h2>{doc.title}</h2></div><div className="ws-name">{t('worksheetStudio.name')}: __________<br/>{t('worksheetStudio.date')}: __________</div></header>
  <p className="ws-instruction">{doc.instruction}</p>
  <div className="ws-paper-body">{children}</div><footer>ClassBank <span>{page}</span></footer>
 </section>;
}
function Text({text}:{text:string}) {return <div className="ws-reading-text">{text}</div>;}
function DataTable({heads,rows}:{heads:string[];rows:ReactNode[][]}) {return <table className="ws-table"><thead><tr>{heads.map((h,i)=><th key={i}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table>;}
function CrosswordPanel({words,solved=false}:{words:StudioWord[];solved?:boolean}) {
 const {t}=useTranslation(),puzzle=printableCrossword(words);
 return <><div className="ws-crossword" style={{gridTemplateColumns:`repeat(${puzzle.grid[0]?.length||1},5.4mm)`}}>{puzzle.grid.flatMap((r,ri)=>r.map((letter,ci)=><div key={`${ri}:${ci}`} className={letter?'ws-crossword-cell':'ws-crossword-empty'}>{letter&&<><small>{puzzle.entries.find(e=>e.row===ri&&e.col===ci)?.number}</small>{solved&&letter}</>}</div>))}</div><div className="ws-crossword-clues">{['across','down'].map(dir=><div key={dir}><h3>{t(`worksheetStudio.${dir}`)}</h3>{puzzle.entries.filter(e=>e.dir===dir).map(e=><p key={e.word.id}>{e.number}. {e.word.meaning}{solved&&` — ${e.word.word}`}</p>)}</div>)}</div></>;
}

function StudentBlock({doc,block}:{doc:WorksheetDocument;block:StudioPaperBlock}) {
 const {t}=useTranslation();const tr=(key:string)=>t(`worksheetStudio.${key}`),ws=block.words||[],rows=block.rows||[],offset=block.offset||0;
 const linked=(row:StudioTask)=>doc.words.find(w=>w.id===row.wordId);
 switch(block.kind){
 case 'text':return <Text text={block.text||''}/>;
 case 'substitution':return <><DataTable heads={doc.columns.split('\n').map((_,i)=>String(i+1))} rows={Array.from({length:Math.max(...doc.columns.split('\n').map(c=>c.split('|').length))},(_,i)=>doc.columns.split('\n').map(c=>c.split('|')[i]||''))}/>{doc.tasks.map(r=><Box key={r.id} title={r.prompt} large/>)}</>;
 case 'alphabet':return <div className="ws-exercises">{ws.map((w,i)=>{const letter=w.word.charAt(0);return <div className="ws-alphabet-row" key={w.id}><b>{offset+i+1}.</b><div><TracingRow word={`${letter.toUpperCase()} ${letter.toLowerCase()}`} trace last/><p>{letter.toUpperCase()} → ______</p></div></div>;})}</div>;
 case 'wordList':return <DataTable heads={[tr('word'),tr('meaning'),tr('example')]} rows={ws.map(w=>[<span key={w.id}><Picture src={w.imageUrl}/><b>{w.word}</b></span>,w.meaning,w.example||''])}/>;
 case 'wordCards':return <div className="ws-cut-grid">{ws.map(w=><div key={w.id}><Picture src={w.imageUrl}/><b>{w.word}</b><small>{w.meaning}</small></div>)}</div>;
 case 'wordTracing':return <div className="ws-exercises">{ws.map(w=><section key={w.id}><p><b>{w.word}</b> · {w.meaning}</p><TracingRow word={w.word} trace last={false} gapMm={3} emMm={Math.min(15,130/Math.max(w.word.length,1))}/><TracingRow word={w.word} trace={false} last/></section>)}</div>;
 case 'sounds':return <div className="ws-exercises">{ws.map((w,i)=><div className="ws-sound-row" key={w.id}><b>{offset+i+1}.</b><Picture src={w.imageUrl}/><div className="ws-sound-boxes">{(soundGroups(w.word,w.sounds||'')||[]).map((g,j)=><span key={j} className={g.span===2?'ws-double-sound':''} style={{width:`${g.span*14}mm`}}/>)}</div></div>)}</div>;
 case 'chain':return <div className="ws-exercises">{ws.map((w,i)=><div className="ws-chain-row" key={w.id}><b>{offset+i+1}.</b><div>{i===0?<strong>{w.word}</strong>:<><p>{chainCue(ws[i-1],w)}</p><Lines count={1}/></>}</div></div>)}</div>;
 case 'syllables':return <div className="ws-exercises">{ws.map((w,i)=><div className="ws-exercise" key={w.id}><p><b>{offset+i+1}. {w.word}</b></p><Lines count={2}/></div>)}</div>;
 case 'pairs':{
  if(doc.activityId==='minimalPairs')return <div className="ws-exercises">{ws.map((w,i)=><div className="ws-pair-row" key={w.id}><b>{offset+i+1}.</b><span>{w.word}</span><span>{w.partner}</span></div>)}</div>;
  const right=shuffled(ws,makeRng(doc.seed+offset));
  return <div className="ws-match-columns"><div>{ws.map((w,i)=><p key={w.id}>{offset+i+1}. {w.word} <i>○</i></p>)}</div><div>{right.map((w,i)=><p key={w.id}><i>○</i> {String.fromCharCode(65+i)}. {w.partner||w.meaning}</p>)}</div></div>;
 }
 case 'frayer':return <><h3 className="ws-focus-word">{ws[0]?.word}</h3><div className="ws-four-boxes">{['definition','features','examples','nonexamples'].map(k=><Box key={k} title={tr(k)} large/>)}</div></>;
 case 'morphology':return <div className="ws-exercises">{ws.map((w,i)=><div className="ws-exercise" key={w.id}><p><b>{offset+i+1}.</b> {w.parts?.split('|').join(' + ')}</p><Lines count={2}/></div>)}</div>;
 case 'questions':return <>{['decodable','readingQuestions','inference'].includes(doc.activityId)&&doc.topic&&<Text text={doc.topic}/>} {block.text&&<Text text={block.text}/>}<div className="ws-exercises">{rows.map((r,i)=><div className="ws-exercise" key={r.id}><p><b>{offset+i+1}.</b> {r.prompt}</p><Picture src={linked(r)?.imageUrl}/>{r.options.length>0&&<div className="ws-options">{r.options.map((v,j)=><span key={j}>{String.fromCharCode(65+j)}. {v}</span>)}</div>}<Lines count={doc.activityId==='inference'?3:2}/>{doc.activityId==='inference'&&<><small>{tr('evidence')}</small><Lines count={1}/></>}</div>)}</div></>;
 case 'sequence':return <div className="ws-sequence-cards">{shuffled(rows,makeRng(doc.seed+offset)).map(r=><div className="ws-sequence-card" key={r.id}><span className="ws-order-box"/><Picture src={linked(r)?.imageUrl}/><p>{r.prompt}</p></div>)}</div>;
 case 'storyMap':return <div className="ws-organiser">{rows.map(r=><Box key={r.id} title={r.prompt}/>)}</div>;
 case 'mainIdea':return <div className="ws-organiser"><Box title={rows[0]?.prompt||tr('main')}/><div className="ws-detail-branches">↓　↓　↓</div>{rows.slice(1).map(r=><Box key={r.id} title={r.prompt}/>)}</div>;
 case 'venn':return <><div className="ws-venn"><svg viewBox="0 0 660 400" aria-hidden="true"><ellipse cx="235" cy="200" rx="225" ry="190"/><ellipse cx="425" cy="200" rx="225" ry="190"/></svg><div><strong>{doc.left}</strong><Lines count={6}/></div><div><strong>{tr('both')}</strong><Lines count={6}/></div><div><strong>{doc.right}</strong><Lines count={6}/></div></div><Box title={rows[3]?.prompt||tr('final')}/></>;
 case 'listenChoice':{
  const choices=listeningChoices(doc).slice(offset,offset+ws.length);return <div className="ws-listen-choices">{choices.map((item,i)=><div className="ws-choice-question" key={item.word.id}><b>{offset+i+1}.</b><div>{item.choices.map((w,j)=><div key={w.id}><Picture src={w.imageUrl} large/><strong>{String.fromCharCode(65+j)}</strong></div>)}</div></div>)}</div>;
 }
 case 'listenColor':return <div className="ws-color-grid">{ws.map((w,i)=><div key={w.id}><b>{offset+i+1}.</b><Picture src={w.lineartUrl} large/></div>)}</div>;
 case 'draw':return <div className="ws-drawing-panels">{rows.map((r,i)=><div key={r.id}><strong>{offset+i+1}. {r.prompt}</strong><div className="ws-draw-area"/></div>)}</div>;
 case 'map':return <><div className="ws-map-axis">A　　　　　　　　 B　　　　　　　　C</div><div className="ws-map-grid">{ws.map((w,i)=><div key={w.id}><small>{'ABC'[i%3]}{Math.floor(i/3)+1}{i===0?` · ${tr('start')}`:''}</small><Picture src={w.imageUrl}/><strong>{w.word}</strong></div>)}</div><Lines count={2}/></>;
 case 'table':return <DataTable heads={[doc.left,doc.right]} rows={rows.map(r=>[r.prompt,<Lines key={r.id} count={1}/>])}/>;
 case 'dictation':return <div className="ws-exercises">{rows.map((r,i)=><div className="ws-exercise" key={r.id}><b>{offset+i+1}.</b><Lines count={2}/></div>)}</div>;
 case 'dictogloss':return <><p>{doc.tasks.map(r=>r.prompt).join(' · ')}</p><Box title={tr('notes')} large/><Box title={tr('final')} large/><Box title={tr('check')}/></>;
 case 'survey':return <DataTable heads={[tr('question'),tr('person'),tr('response')]} rows={rows.map(r=>[r.prompt,<Lines key="name" count={2}/>,<Lines key="detail" count={2}/>])}/>;
 case 'informationGap':return <DataTable heads={[doc.left,doc.right]} rows={rows.map((r,i)=>[r.prompt,(offset+i)%2===(block.role==='A'?0:1)?r.answer:<Lines key={r.id} count={1}/>])}/>;
 case 'difference':{
  const order=ws.map((_,i)=>i);if(block.role==='B'&&order.length>=3)[order[0],order[1],order[2]]=[order[2],order[0],order[1]];
  return <><div className="ws-scene-grid">{Array.from({length:9},(_,i)=><div key={i}><small>{offset+i+1}</small>{ws[order[i]]&&<Picture src={ws[order[i]].imageUrl} large/>}</div>)}</div><Box title={tr('details')}/></>;
 }
 case 'barrier':return <><div className="ws-placement-grid">{Array.from({length:6},(_,i)=><div key={i}><small>{offset+i+1}</small>{block.role==='A'&&ws[i]&&<Picture src={ws[i].imageUrl} large/>}</div>)}</div><Lines count={2}/></>;
 case 'placementCards':return <div className="ws-cut-grid">{ws.map(w=><div key={w.id}><Picture src={w.imageUrl} large/></div>)}</div>;
 case 'roleplay':return <><Text text={doc.topic}/><div className="ws-role-cards">{rows.map(r=><section className="ws-role-card" key={r.id}><h3>{r.prompt}</h3><Text text={r.detail}/><p><b>{r.answer}</b></p><Lines count={3}/></section>)}</div></>;
 case 'ranking':return <><Text text={doc.topic}/><DataTable heads={[tr('item'),tr('rank'),tr('groupRank'),tr('reason')]} rows={rows.map(r=>[r.prompt,'','',<Lines key={r.id} count={1}/>])}/><Box title={tr('conclusion')}/></>;
 case 'jigsaw':return <><Text text={doc.topic}/>{rows.map(r=><section className="ws-exercise" key={r.id}><h3>{r.prompt}</h3><Text text={r.answer}/><p>{r.detail}</p><Lines count={3}/></section>)}<Box title={tr('notes')}/></>;
 case 'coverWrite':return <><p className="ws-fold-label">{tr('fold')}</p><table className="ws-table ws-cover-table"><tbody>{ws.map(w=><tr key={w.id}><td><b>{w.word}</b><Picture src={w.imageUrl}/></td><td><Lines count={2}/></td><td><Lines count={2}/></td></tr>)}</tbody></table></>;
 case 'pictureWrite':return <div className="ws-exercises">{rows.map((r,i)=><div className="ws-picture-write" key={r.id}><Picture src={linked(r)?.imageUrl} large/><div><p>{offset+i+1}. {r.prompt}</p><Lines count={3}/></div></div>)}</div>;
 case 'expansion':return <div className="ws-exercises">{rows.map(r=><div className="ws-exercise" key={r.id}><h3>{r.prompt}</h3><p>{r.detail}</p><DataTable heads={[tr('where'),tr('when'),tr('details')]} rows={[[<Lines key="a" count={1}/>,<Lines key="b" count={1}/>,<Lines key="c" count={1}/>]]}/><Lines count={3}/></div>)}</div>;
 case 'paragraph':case 'recount':case 'opinion':case 'form':return <><Text text={doc.topic}/><div className="ws-planning">{rows.map(r=><Box key={r.id} title={r.prompt}/>)}</div><Box title={tr('final')} large/>{block.kind==='form'&&<small>{tr('privacy')}</small>}</>;
 case 'comic':return <><Text text={doc.topic}/><div className="ws-comic-panels">{rows.map(r=><section key={r.id}><strong>{r.prompt}</strong><div className="ws-comic-draw"/><div className="ws-speech-bubble"><Lines count={2}/></div></section>)}</div></>;
 case 'checklist':return <><DataTable heads={[tr('check'),tr('notYet'),tr('independent')]} rows={rows.map(r=>[r.prompt,'□','□'])}/><Box title={tr('nextStep')}/><Box title={tr('final')} large/></>;
 case 'bingo':{
  const grid=ws.length>=8?3:2,picks=shuffled(ws,makeRng(doc.seed+(block.index||0))),cells:Array<StudioWord|null>=[...picks.slice(0,grid*grid-(grid===3?1:0))];if(grid===3)cells.splice(4,0,null);
  return <div className="ws-bingo" style={{gridTemplateColumns:`repeat(${grid},1fr)`}}>{cells.map((w,i)=><div key={i}>{w?<><Picture src={w.imageUrl}/><b>{w.word}</b></>:<b>FREE</b>}</div>)}</div>;
 }
 case 'memory':return <div className="ws-cut-grid">{ws.map((w,i)=><div key={`${w.id}:${i}`}>{w.partner==='picture'?<Picture src={w.imageUrl} large/>:<strong className="ws-memory-word">{w.word}</strong>}</div>)}</div>;
 case 'domino':return <div className="ws-dominoes">{shuffled(ws.map((w,i)=>({left:w.meaning,right:ws[(i+1)%ws.length].word,id:w.id})),makeRng(doc.seed+offset)).map(p=><div key={p.id}><span>{p.left}</span><span>{p.right}</span></div>)}</div>;
 case 'crossword':return <CrosswordPanel words={ws}/>;
 case 'rollRead':{
  const cols=doc.words.some(w=>w.word.length>20)?3:6;return <DataTable heads={[tr('step'),'',...Array(cols-1).fill('')]} rows={Array.from({length:6},(_,i)=>[String(i+1),...Array.from({length:cols},(_,j)=>{const w=ws[(i*cols+j)%ws.length];return <span key={j}>□ {w?.word}</span>;})])}/>;
 }
 case 'record':{
  const count=rows.length||ws.length;return <><h3>{tr('record')}</h3><div className="ws-exercises">{Array.from({length:count},(_,i)=><div className="ws-record-row" key={i}><b>{offset+i+1}.</b><Lines count={1}/></div>)}</div></>;
 }
 case 'wallText':return <><h3>{tr('wallCards')}</h3><div className="ws-wall-cards">{rows.map((r,i)=><div key={r.id}><b>{offset+i+1}.</b><p>{r.prompt}</p></div>)}</div></>;
 case 'wallPictures':return <><h3>{tr('wallCards')}</h3><div className="ws-cut-grid">{ws.map((w,i)=><div key={w.id}><small>{offset+i+1}</small><Picture src={w.imageUrl}/><b>{w.word}</b></div>)}</div></>;
 case 'functional':return <><h3>{doc.left}</h3><DataTable heads={[tr('item'),doc.right]} rows={rows.map(r=>[r.prompt,r.answer])}/></>;
 case 'poster':return <><Text text={doc.topic}/><div className="ws-planning">{rows.map(r=><Box key={r.id} title={r.prompt}/>)}</div><div className="ws-poster-canvas"/></>;
 case 'kwl':return <><h3>{doc.topic}</h3><div className="ws-kwl">{rows.slice(0,3).map(r=><Box key={r.id} title={r.prompt} large/>)}</div></>;
 case 'rubric':return <><Text text={doc.topic}/><DataTable heads={[tr('check'),tr('notYet'),tr('withHelp'),tr('independent')]} rows={rows.map(r=>[r.prompt,'□','□','□'])}/><Box title={tr('strength')}/><Box title={tr('nextStep')}/></>;
 case 'exit':return <div className="ws-exercises">{rows.map((r,i)=><Box key={r.id} title={`${i+1}. ${r.prompt}`}/>)}</div>;
 case 'review':return <div className="ws-exercises">{ws.map((w,i)=><div className="ws-exercise" key={w.id}><p>{offset+i+1}. {w.meaning}</p><Lines count={1}/></div>)}<Box title={tr('useSentence')}/></div>;
 default:throw Error('unimplemented_sheet:'+block.kind);
 }
}

export default function WorksheetActivitySheets({doc,audience}:{doc:WorksheetDocument;audience:'student'|'teacher'}) {
 const {t}=useTranslation();const activity=worksheetActivity(doc.activityId)!;
 const legacy=studioLegacyPages(doc);let page=0;
 if(audience==='student'&&legacy.length)return <>{legacy.map((data,i)=><WorksheetSheets key={i} data={data} includeAnswers={false} heading={{title:doc.title,instruction:doc.instruction}}/>)}</>;
 if(audience==='student')return <>{studentBlocks(doc).map((block,i)=><Paper key={i} doc={doc} label={block.role?`${t('worksheetStudio.section')} ${block.role}`:undefined} page={++page}><StudentBlock doc={doc} block={block}/></Paper>)}</>;
 const cues=teacherCues(doc),answers=teacherAnswers(doc),cuePages:string[][]=[];let cuePage:string[]=[];let cueLength=0;
 for(const cue of cues){if(cuePage.length&&(cueLength+cue.length>1000||cuePage.length===5)){cuePages.push(cuePage);cuePage=[];cueLength=0;}cuePage.push(cue);cueLength+=cue.length;}if(cuePage.length)cuePages.push(cuePage);
 const dedicatedLegacy=legacy.some(d=>!['askAnswer','boardGame','coloring','miniBook'].includes(d.kind));
 return <>
  <Paper doc={doc} label={t('worksheetStudio.teacherHeading')} page={++page}>
   <div className="ws-teacher-guide"><h3>{t('worksheetStudio.goal')}</h3><p>{t(`worksheetStudio.activities.${activity.id}.goal`)}</p><p>{t('worksheetStudio.people.'+activity.people)} · {t('worksheetStudio.time',{count:activity.minutes})}</p><p>{t('worksheetStudio.prepare')}</p><p>{t('worksheetStudio.model')}</p><p>{t('worksheetStudio.finish')}</p><Box title={t('worksheetStudio.tip')}><p>{t(`worksheetStudio.activities.${activity.id}.tip`)}</p></Box>{hasOpenAnswers(doc)&&<p>{t('worksheetStudio.openAnswer')}</p>}</div>
  </Paper>
  {cuePages.map((items,i)=><Paper doc={doc} label={t('worksheetStudio.readAloud')} page={++page} key={`c${i}`}><div className="ws-exercises">{items.map((text,j)=><Text key={j} text={text}/>)}</div></Paper>)}
  {doc.passage&&passageChunks(doc.passage).map((text,i)=><Paper doc={doc} label={t('worksheetStudio.studentSource')} page={++page} key={`p${i}`}><Text text={text}/></Paper>)}
  {dedicatedLegacy?legacy.map((data,i)=><WorksheetAnswerSheets key={i} data={data}/>):activity.layout==='crossword'?chunk(doc.words,3).map((words,i)=><Paper doc={doc} label={t('worksheetStudio.answerHeading')} page={++page} key={`x${i}`}><CrosswordPanel words={words} solved/></Paper>):chunk(answers,2).map((items,i)=><Paper doc={doc} label={t('worksheetStudio.answerHeading')} page={++page} key={`a${i}`}><div className="ws-exercises">{items.map((r,j)=><section className="ws-teacher-answer" key={j}><h3>{r.prompt}</h3><p>{r.answer||t('worksheetStudio.openAnswer')}</p>{r.detail&&<small>{r.detail}</small>}</section>)}</div></Paper>)}
 </>;
}
