import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import type { GameWorkspaceBridge } from '../context/GameWorkspaceContext';
import { guideFamily, guideKinds, guideRows, guideContent, guideProblem, type GuideKind } from '../lib/gameGuide';
import { prepareClassroomGame, classroomGameRequirement } from '../lib/gameWorkspace';
import { gamePreparation } from '../lib/gamePreparation';
import { useRecoverableField } from '../lib/useRecoverableField';
import { insertPhrase } from '../lib/storybook';
import { SENTENCE_PATTERNS, getSentencePattern, slotLabelKey, type SentenceSlot } from '../lib/sentencePatterns';
import type { FullCardItem, GameTemplate, WordList } from '../lib/types';
import GameSourcePicker from './GameSourcePicker';
import LadderResultSetup from './LadderResultSetup';
import { ladderResultDraft, ladderSlots } from '../lib/ladderSetup';
import GameImagePicker from './GameImagePicker';
import { guideButton as button } from './GameCreateButton';

interface Props {
  info:GameWorkspaceBridge;active:boolean;canStart:boolean;busy:boolean;
  run:(fn:()=>Promise<void>)=>Promise<boolean>;
  start:()=>void;openTeams:()=>void;
  nativeVisible:(visible:boolean)=>void;
  setParticipants:(text:string)=>void;
}
type Launch={kind:GuideKind;cards?:FullCardItem[];ownerId?:string;academyId?:string};
export default function GameSetupGuide({info,active,canStart,busy,run,start,openTeams,nativeVisible,setParticipants}:Props){
  const {t}=useTranslation();const {session,academy}=useAuth();const location=useLocation();
  const [kind,setKind]=useState<GuideKind>('word');const [step,setStep]=useState(0);const [native,setNative]=useState(false);const [error,setError]=useState('');
  const [raw,setRaw]=useRecoverableField(`guide:${info.gameType}:${kind}:rows`);
  const [paste,setPaste]=useRecoverableField(`guide:${info.gameType}:${kind}:paste`);
  const [names,setNames]=useRecoverableField(`guide:${info.gameType}:people`);
  const [extra,setExtra]=useRecoverableField(`guide:${info.gameType}:extra`);
  const [towerStart,setTowerStart]=useRecoverableField(`guide:${info.gameType}:start`,info.selected?.config.storybook?.start||'I play.');
  const [source,setSource]=useState('');const selection=useRef({start:0,end:0});const launchConsumed=useRef('');
  const heading=useRef<HTMLHeadingElement>(null);
  const resultSection=useRef<HTMLDivElement>(null);
  const [diagram,setDiagram]=useRecoverableField(`guide:${info.gameType}:diagram`,info.selected?.config.diagramImageUrl||'');
  const [pattern,setPattern]=useRecoverableField(`guide:${info.gameType}:pattern`,info.selected?.config.watermelonPatternId||'svo');
  const pendingRows=useRef<{kind:GuideKind;rows:string[][]}|null>(null);
  const family=guideFamily(info.gameType);const dedicated=family==='builtin';
  const manualPeople=gamePreparation(info.gameType).manualTurns;
  const needsPeople=(kind!=='names'||info.gameType==='timer')&&(manualPeople||info.teamCount!==undefined||['tictactoe','connect4','baskin31','twodice','gameshowquiz','winlosequiz','saveorgive','lightning','timer'].includes(info.gameType));
  const steps=needsPeople?[0,1,2,3]:[0,1,3];
  let rows:string[][]=[];try{const stored=raw?JSON.parse(raw):null;rows=Array.isArray(stored)&&stored.every(r=>Array.isArray(r)&&r.every(s=>typeof s==='string'))?stored:[];}catch{/* recover malformed tab data safely */}
  const write=(next:string[][])=>setRaw(JSON.stringify(next));
  const resultCount=rows.filter(r=>r[0]?.trim()).length;
  const resultDraft=ladderResultDraft(extra,info.selected?.config.results);
  if(!extra&&info.selected?.config.ladderResultOrder==='random')resultDraft.order='random';
  const seed=(template:GameTemplate)=>{const next=guideRows(template,kind);write(next.length?next:[['','']]);};
  async function importSource(cards:FullCardItem[],list?:WordList){
    if(!info.selected)return;
    setError('');
    if(kind==='names'){write(cards.map(c=>[c.word]));if(info.gameType==='timer')setNames(cards.map(c=>c.word).join('\n'));return;}
    if(family==='bridge'){setSource(cards[0]?.word||'');write(cards.map(c=>[c.word,'','','']));return;}
    if(family==='tower'){setTowerStart(cards[0]?.word||'');write([['','0','','']]);return;}
    if(family==='image'||family==='groups'){
      const config={...info.selected.config,classroomSource:{id:list?.id||'composition',name:list?.name||'',kind:'word' as const,version:list?.updated_at||'',cards}};
      if(!await run(()=>info.applyGuide({items:info.selected!.items,config})))throw new Error('import_failed');
      write(cards.map(c=>family==='image'?[c.word,c.imageUrl||'']:[c.word,c.category||'']));return;
    }
    const content=prepareClassroomGame(info.gameType,cards,kind==='sentence'?'sentence':'word');
    if(!content)throw new Error('incompatible_source');
    const next={...info.selected,items:content.items,config:{...info.selected.config,...content.config,classroomSource:{id:list?.id||'composition',name:list?.name||'',kind:kind==='sentence'?'sentence' as const:'word' as const,version:list?.updated_at||'',cards}}};
    if(!await run(()=>info.applyGuide({items:next.items,config:next.config})))throw new Error('import_failed');
    seed(next);
  }
  function sourceReason(list:WordList){
    if(['bridge','tower','image','groups'].includes(family))return null;
    if(prepareClassroomGame(info.gameType,list))return null;
    const requirement=classroomGameRequirement(info.gameType,list.kind||'word');return t(requirement.key,{count:requirement.count});
  }
  const setCell=(i:number,j:number,value:string)=>{const next=rows.map(r=>[...r]);next[i]||=[];next[i][j]=value;write(next);};
  useEffect(()=>{nativeVisible(active&&step===1&&native);},[active,step,native,nativeVisible]);
  useEffect(()=>{if(active)heading.current?.focus();},[active,step]);
  // Route payloads are scoped just like existing quick sources. They never write saved data.
  useEffect(()=>{
    const launch=(location.state as {guideLaunch?:Launch}|null)?.guideLaunch;
    if(!active||!info.selected||info.loading||!launch||launchConsumed.current===location.key)return;
    if(launch.ownerId!==session?.user.id||launch.academyId!==academy?.id)return;
    launchConsumed.current=location.key;
    const k=launch.kind;if(!guideKinds(info.gameType).includes(k))return;
    setKind(k);
    if(k==='sample'){void run(()=>info.sampleGuide()).then(ok=>{if(ok)setStep(3);});return;}
    const cards=launch.cards||[];const prepared=k==='names'?null:prepareClassroomGame(info.gameType,cards,k==='sentence'?'sentence':'word');
    const content=prepared?{items:prepared.items,config:{...info.selected.config,...prepared.config,classroomSource:{id:'composition',name:'',kind:k==='sentence'?'sentence' as const:'word' as const,version:'',cards}}}:guideContent(info.gameType,cards.map(c=>family==='image'?[c.word,c.imageUrl||'']:family==='bridge'?[c.word,'','','']:family==='tower'?['','0','','']:[c.word,c.meaning]),k,info.selected.config,towerStart);
    if(family==='bridge')setSource(cards[0]?.word||'');
    if(family==='tower')setTowerStart(cards[0]?.word||'');
    pendingRows.current={kind:k,rows:guideRows({...info.selected,...content},k)};
    void run(()=>info.applyGuide(content)).then(ok=>{if(ok){setStep(1);}});
  },[active,info.loading,info.selected,location.key,session?.user.id,academy?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    if(!active||step!==1||!info.selected)return;
    if(pendingRows.current?.kind===kind){write(pendingRows.current.rows.length?pendingRows.current.rows:[['','']]);pendingRows.current=null;return;}
    if(raw)return;
    const initial=guideRows(info.selected,kind);if(initial.length)write(initial);else write([['','']]);
  },[active,step,raw,info.selected,kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const problem=info.selected?guideProblem(info.selected):'incomplete';
  async function choose(k:GuideKind){
    setError('');setKind(k);setNative(false);
    if(k==='sample'){if(await run(()=>info.sampleGuide()))setStep(3);return;}
    if(!info.selected)return;
    // A guided edit of a saved activity always creates a temporary copy first.
    if(!dedicated&&!['bridge','tower','monster','diagram','slots'].includes(family)&&(k!==kind||!raw)){
      if(await run(()=>info.beginMaterial(k==='sentence'?'sentence':'word')))setStep(1);
    } else if(await run(()=>info.applyGuide({items:info.selected!.items,config:info.selected!.config})))setStep(1);
  }
  async function next(){
    if(!info.selected)return;
    setError('');
    if(step===1){
      if(!dedicated&&!native){
        if(['pairs','groups','image'].includes(family)&&rows.some(r=>r.some(s=>s.trim())&&(!r[0]?.trim()||!r[1]?.trim()))){setError(t('guide.incomplete'));return;}
        if(family==='ox'&&rows.some(r=>r[0]?.trim()&&!['O','X'].includes(r[1]?.toUpperCase()))){setError(t('guide.incomplete'));return;}
        if(['quiz','online'].includes(family)&&rows.some(r=>r.some(Boolean)&&(!r[0]?.trim()||!r[1]?.trim()||!r.slice(2).some(s=>s.trim())||new Set(r.slice(1).filter(Boolean).map(s=>s.trim().toLowerCase())).size!==r.slice(1).filter(Boolean).length))){setError(t('guide.incomplete'));return;}
        const content=guideContent(info.gameType,rows,kind,{...info.selected.config,...(family==='diagram'?{diagramImageUrl:diagram}:{}),...(family==='slots'?{watermelonPatternId:pattern}:{})},towerStart);
        if(info.gameType==='ladder'){
          const slots=ladderSlots(resultDraft,content.items.length);
          const missing=slots.filter(s=>!s.miss&&!s.label.trim()).length;
          if(missing){
            setError(t('guide.ladder.missing',{count:missing}));
            resultSection.current?.querySelector<HTMLInputElement>(`[data-ladder-result="${slots.findIndex(s=>!s.miss&&!s.label.trim())}"]`)?.focus();
            return;
          }
          content.config.results=slots.map((slot,i)=>({id:`result-${i}`,label:slot.miss?t('guide.ladder.miss'):slot.label.trim()}));
          content.config.ladderResultOrder=resultDraft.order;
        }
        if(info.gameType==='bomb')content.config.words=extra.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map((label,i)=>({id:`practice-${i}`,label}));
        const check=guideProblem({...info.selected,...content});if(check){setError(t(`guide.${check}`));return;}
        if(!await run(()=>info.applyGuide(content)))return;
      }else if(problem||!canStart){setError(t(`guide.${problem||'incomplete'}`));return;}
      setStep(needsPeople?2:3);
    }else if(step===2){
      if(manualPeople)setParticipants(names);
      if(info.gameType==='saveorgive'&&names.trim()){
        const participants=names.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map((label,i)=>({id:`guide-person-${i}`,label}));
        if(!await run(()=>info.applyGuide({items:info.selected!.items,config:{...info.selected!.config,saveOrGiveMode:'individual',saveOrGiveParticipants:participants}})))return;
      }
      if(info.gameType==='timer'&&names.trim()){
        const config={...info.selected.config};delete config.classroomSource;
        if(!await run(()=>info.applyGuide({items:names.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map((label,i)=>({id:`guide-person-${i}`,label})),config})))return;
      }
      setStep(3);
    }
  }
  const columns=kind==='names'?['nameColumn']:family==='diagram'?['answer']:family==='slots'?['wordColumn','position']:family==='pairs'?info.gameType==='typeanswer'?['question','answer']:kind==='sentence'?['sentenceColumn','translation']:['wordColumn','meaning']:['quiz','online','bridge','monster'].includes(family)?['question','answer','wrong','wrong']:family==='ox'?['sentenceColumn','ox']:family==='groups'?['wordColumn','group']:family==='image'?['answer','image']:family==='tower'?['phrase','position','wrong','wrong']:kind==='sentence'?['sentenceColumn','translation']:['wordColumn','meaning'];
  let previous=towerStart;
  const towerPrevious=rows.map(r=>{const p=previous;previous=insertPhrase(previous,r[0]||'',Number(r[1])||0);return p;});
  if(!active)return null;
  return <section className="space-y-5 p-4 sm:p-6" data-game-guide data-guide-step={step}>
    <p className="font-bold text-primary" role="status">{t('guide.step',{current:steps.indexOf(step)+1,total:steps.length})} · {t(step===0?'guide.chooseSource':step===1?'guide.content':step===2?'guide.participation':'guide.review')}</p>
    <h2 ref={heading} tabIndex={-1} className="text-2xl font-black">{t(step===0?'guide.title':step===1?'guide.chooseContent':step===2?'guide.participation':'guide.ready')}</h2>
    {error&&<p role="alert" className="rounded-xl bg-error-container p-4">{error}</p>}
    {step===0&&<div className="grid gap-3 sm:grid-cols-2">{guideKinds(info.gameType).map(k=><button className={`${button} min-h-28 text-left ${k==='sample'?'bg-sky-50! border-primary':''}`} key={k} disabled={busy||info.loading} onClick={()=>void choose(k)}><span className="block text-xl">{t(`guide.${k}`)}</span><span className="mt-2 block font-normal">{t(`guide.${k}Hint`)}</span></button>)}{dedicated&&<button className={button} onClick={()=>void choose(info.gameType==='timer'?'names':'word')}>{t('guide.keepDefault')}</button>}</div>}
    {step===1&&<>
      <p className="rounded-xl bg-sky-50 p-4 text-lg">{t(`guide.hints.${family}`)}</p>
      {t(`guide.gameHints.${info.gameType}`,{defaultValue:''})&&<p>{t(`guide.gameHints.${info.gameType}`,{defaultValue:''})}</p>}
      {!native&&kind!=='sample'&&<GameSourcePicker kind={kind} onPick={importSource} canUse={sourceReason} />}
      {!dedicated&&!native&&<>

        {family==='diagram'&&<div className="space-y-3"><GameImagePicker academyId={info.academyId} value={diagram||null} onChange={url=>setDiagram(url||'')}/>{diagram&&<div className="relative w-fit"><button type="button" className="block rounded-xl focus-visible:outline-4 focus-visible:outline-primary" aria-label={t('guide.hints.diagram')} onClick={e=>{const bounds=e.currentTarget.getBoundingClientRect();const keyboard=e.detail===0;write([...rows.filter(r=>r[0]),['',String(keyboard ? .5 : (e.clientX-bounds.left)/bounds.width),String(keyboard ? .5 : (e.clientY-bounds.top)/bounds.height)]]);}}><img src={diagram} className="max-h-80 max-w-full cursor-crosshair" alt=""/></button>{rows.map((r,i)=><span key={i} aria-hidden className="pointer-events-none absolute rounded-full bg-primary px-2 text-white" style={{left:`${Number(r[1])*100}%`,top:`${Number(r[2])*100}%`}}>{i+1}</span>)}</div>}</div>}
        {family==='slots'&&<label className="block font-bold">{t('gameWatermelon.slotLabel')}<select className="ml-2 rounded-xl border p-3" value={pattern} onChange={e=>setPattern(e.target.value)}>{SENTENCE_PATTERNS.filter(p=>p.playable).map(p=><option key={p.id} value={p.id}>{t(p.nameKey)}</option>)}</select></label>}
        {family==='tower'&&<label className="block font-bold">{t('guide.startSentence')}<input className="mt-2 w-full rounded-xl border p-3" value={towerStart} onChange={e=>setTowerStart(e.target.value)}/></label>}
        {family==='bridge'&&<div className="space-y-2 rounded-xl border p-3"><label className="block">{t('guide.blank')}<input value={source} className="mt-2 w-full rounded-xl border p-3" onChange={e=>setSource(e.target.value)} onSelect={e=>{selection.current={start:e.currentTarget.selectionStart||0,end:e.currentTarget.selectionEnd||0};}}/></label><button className={button} onClick={()=>{const {start,end}=selection.current;if(end>start){write([...rows.filter(r=>r[0]),[source.slice(0,start)+'___'+source.slice(end),source.slice(start,end),'','']]);}}}>{t('guide.makeBlank')}</button></div>}
        <div className="space-y-3">{rows.map((row,i)=><fieldset key={i} className="rounded-2xl border bg-surface-container-lowest p-4"><legend className="px-2 font-bold">{i+1}</legend>
          {family==='tower'&&<div className="mb-3 space-y-2"><p>{t('guide.towerHint')}</p><div className="flex flex-wrap gap-1">{[0,...Array.from(towerPrevious[i].matchAll(/\s+/g),m=>m.index!+m[0].length),towerPrevious[i].length].map((pos,j)=><button type="button" className={`${button} ${Number(row[1])===pos?'border-primary bg-sky-50!':''}`} key={`${pos}-${j}`} onClick={()=>setCell(i,1,String(pos))}>{towerPrevious[i].slice(0,pos)} ▏ {towerPrevious[i].slice(pos)}</button>)}</div><p>{t('guide.result')}: {insertPhrase(towerPrevious[i],row[0]||'',Number(row[1])||0)}</p></div>}
          <div className="grid gap-3 sm:grid-cols-2">{columns.map((col,j)=>family==='tower'&&j===1?null:<label key={`${col}-${j}`} className="block font-bold">{t(`guide.${col}`)}{col==='wrong'?` ${j-1}`:''}{family==='slots'&&j===1?<select aria-label={t('gameWatermelon.slotLabel')} className="mt-1 w-full rounded-xl border p-3" value={row[j]||''} onChange={e=>setCell(i,j,e.target.value)}><option value="">—</option>{getSentencePattern(pattern).slots.map(slot=><option key={slot} value={slot}>{t(slotLabelKey(slot as SentenceSlot))}</option>)}</select>:col==='image'?<GameImagePicker academyId={info.academyId} value={row[j]||null} onChange={url=>setCell(i,j,url||'')} previewHeight={96}/>:col==='ox'?<select aria-label={t('guide.ox')} className="mt-1 w-full rounded-xl border bg-white p-3" value={row[j]||''} onChange={e=>setCell(i,j,e.target.value)}><option value="">—</option><option>O</option><option>X</option></select>:<input className="mt-1 w-full rounded-xl border bg-white p-3 font-normal" value={row[j]||''} onChange={e=>setCell(i,j,e.target.value)} />}</label>)}</div>
          <button className={`${button} mt-3`} aria-label={`${t('guide.remove')} ${i+1}`} onClick={()=>write(rows.filter((_,n)=>n!==i))}>{t('guide.remove')}</button>
        </fieldset>)}</div>{family!=='diagram'&&<button className={button} onClick={()=>write([...rows,columns.map(()=> '')])}>+ {t('guide.add')}</button>}
        <details><summary className="cursor-pointer py-3 font-bold text-primary">{t('guide.paste')}</summary><label className="block">{t('guide.pasteHint')}<textarea className="mt-2 min-h-32 w-full rounded-xl border p-3" value={paste} onChange={e=>setPaste(e.target.value)}/></label><button className={button} disabled={!paste.trim()} onClick={()=>{const next=paste.split(/\r?\n/).filter(s=>s.trim()).map(s=>s.split(/\t|\s*\|\s*/));write([...rows.filter(r=>r.some(s=>s.trim())),...next]);}}>{t('guide.applyPaste')}</button></details>
        {info.gameType==='ladder'&&<div ref={resultSection}><LadderResultSetup draft={resultDraft} count={resultCount} onChange={draft=>{setExtra(JSON.stringify(draft));setError('');}} /></div>}
        {info.gameType==='bomb'&&<label className="block font-bold">{t('guide.bombWords')}<textarea className="mt-2 min-h-24 w-full rounded-xl border p-3 font-normal" value={extra} onChange={e=>setExtra(e.target.value)}/></label>}
      </>}
      <button className={button} onClick={()=>setNative(v=>!v)}>{t('guide.native')}</button>
      {native&&<p>{t('guide.nativeReview')}</p>}
    </>}
    {step===2&&<><p>{t('guide.peopleHint')}</p>{info.teamCount!==undefined?<label className="block font-bold">{t('guide.teamCount')}<select className="ml-3 rounded-xl border p-3" value={info.teamCount} disabled={busy} onChange={e=>void run(()=>info.configureTeams(Number(e.target.value)))}>{Array.from({length:info.gameType==='telepathy'?5:info.gameType==='lastbox'||info.gameType==='mysterybox'?7:3},(_,i)=>i+2).map(n=><option key={n}>{n}</option>)}</select></label>:['tictactoe','connect4','baskin31','twodice','gameshowquiz','winlosequiz'].includes(info.gameType)?<p>{t('guide.teamFixed')}</p>:<p>{t('guide.defaultPeople')}</p>}
      {info.gameType==='lightning'&&<label>{t('flow.count_participants',{count:info.selected?.config.lightningPlayers||8})}<input className="ml-2 rounded-xl border p-3" aria-label={t('guide.participation')} type="number" min={2} max={40} value={info.selected?.config.lightningPlayers||8} onChange={e=>{const count=Number(e.target.value);if(count>=2&&count<=40&&info.selected)void run(()=>info.applyGuide({items:info.selected!.items,config:{...info.selected!.config,lightningPlayers:count}}));}}/></label>}
      {(manualPeople||info.gameType==='saveorgive'||info.gameType==='timer')&&<GameSourcePicker kind="names" onPick={cards=>setNames(cards.map(c=>c.word).join('\n'))} />}
      {(manualPeople||info.gameType==='saveorgive'||info.gameType==='timer')&&<label className="block">{t('guide.peopleNames')}<textarea className="mt-2 min-h-24 w-full rounded-xl border p-3" value={names} onChange={e=>setNames(e.target.value)}/></label>}{manualPeople&&<button className={button} onClick={()=>{setParticipants(names);openTeams();}}>{t('guide.teamNames')}</button>}<p className="text-sm">{t('guide.teamNative')}</p>
    </>}
    {step===3&&<><p>{t(kind==='sample'?'guide.sampleNotice':'guide.temporary')}</p>{info.gameType==='quizshow'&&<p className="rounded-xl bg-amber-50 p-4">{t('guide.online')}</p>}
      <div className="max-h-64 overflow-auto rounded-xl border p-3">{info.selected&&guideRows(info.selected,kind).map((r,i)=><p key={i} className="border-b py-2">{r.filter(s=>s&&!s.startsWith('/')).join(' · ')}</p>)}</div>
      {info.gameType==='ladder'&&<div className="rounded-xl border p-3"><p className="font-bold">{t('guide.ladder.title')} · {t(info.selected?.config.ladderResultOrder==='random'?'guide.ladder.random':'guide.ladder.input')}</p><p className="whitespace-pre-wrap">{info.selected?.config.results?.map((r,i)=>`${i+1}. ${r.label}`).join('\n')}</p></div>}
      {problem&&<p role="alert">{t(`guide.${problem}`)}</p>}
      <button className={`${button} bg-primary! px-8! text-xl! text-white!`} disabled={busy||!canStart||!!problem} onClick={start}>▶ {t('guide.start')}</button><button className={button} onClick={()=>setStep(0)}>{t('guide.editMine')}</button><p>{t('guide.saveLater')}</p>
    </>}
    {error&&step===1&&info.gameType==='ladder'&&<p className="rounded-xl bg-error-container p-3 font-bold">{error}</p>}
    <footer className="flex flex-wrap gap-3 border-t pt-4">{step>0&&<button className={button} disabled={busy} onClick={()=>{setStep(n=>n===3&&!needsPeople?1:Math.max(0,n-1));setError('');}}>{t('guide.back')}</button>}{(step===1||step===2)&&<button className={`${button} bg-primary! text-white!`} disabled={busy||info.loading} onClick={()=>void next()}>{t('guide.next')}</button>}</footer>
  </section>;
}
