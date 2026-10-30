import NumberRangeFill from './NumberRangeFill';

import { useCallback,useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {useGameWorkspace} from '../context/GameWorkspaceContext';
import type { GameWorkspaceBridge } from '../context/GameWorkspaceContext';
import { GAME_CATALOG } from '../lib/gameCatalog';
import { isBombReading, guideKindProblem, guideFamily, fillDistractors, splitCards, guideKinds, guideRows, guideContent, guideProblem, type GuideKind } from '../lib/gameGuide';
import { prepareClassroomGame, classroomGameRequirement } from '../lib/gameWorkspace';

import { useRecoverableField } from '../lib/useRecoverableField';
import { insertPhrase } from '../lib/storybook';
import { SENTENCE_PATTERNS, getSentencePattern, slotLabelKey, type SentenceSlot } from '../lib/sentencePatterns';
import type { FullCardItem, GameItem, GameTemplate, WordList } from '../lib/types';
import GameSourcePicker from './GameSourcePicker';
import LadderResultSetup from './LadderResultSetup';
import { ladderResultDraft, ladderSlots } from '../lib/ladderSetup';
import GameImagePicker from './GameImagePicker';
import {enrichCards,loadWordBank} from '../lib/wordBankCache';
import { guideButton as button } from './GameCreateButton';

interface Props {
  /** 설정 화면의 "숫자로 만들기" 단추처럼, 열자마자 이 방식을 고른다 */
  presetKind?:GuideKind|null;onPresetUsed?:()=>void;
  info:GameWorkspaceBridge;active:boolean;canStart:boolean;busy:boolean;
  run:(fn:()=>Promise<void>)=>Promise<boolean>;
  complete:()=>void;editRevision:number;
  nativeVisible:(visible:boolean)=>void;

}
type Launch={kind:GuideKind;cards?:FullCardItem[];ownerId?:string;academyId?:string};
export default function GameSetupGuide({info,active,canStart,busy,run,complete,editRevision,nativeVisible,presetKind,onPresetUsed}:Props){
  const workspace=useGameWorkspace();
  const {t}=useTranslation();const {session,academy}=useAuth();const location=useLocation();
  const [kind,setKind]=useState<GuideKind>('word');const [step,setStep]=useState(0);const [native,setNative]=useState(false);const [error,setError]=useState('');
  const [raw,setRaw]=useRecoverableField(`guide:${info.gameType}:${kind}:rows`);
  const [paste,setPaste]=useRecoverableField(`guide:${info.gameType}:${kind}:paste`);

  const [extra,setExtra]=useRecoverableField(`guide:${info.gameType}:extra`);
  const [towerStart,setTowerStart]=useRecoverableField(`guide:${info.gameType}:start`,info.selected?.config.storybook?.start||'I play.');
  const [source,setSource]=useState('');const selection=useRef({start:0,end:0});const launchConsumed=useRef('');
  const heading=useRef<HTMLHeadingElement>(null);
  const resultSection=useRef<HTMLDivElement>(null);
  const [diagram,setDiagram]=useRecoverableField(`guide:${info.gameType}:diagram`,info.selected?.config.diagramImageUrl||'');
  const [diagramCards,setDiagramCards]=useState<FullCardItem[]>([]),[diagramTarget,setDiagramTarget]=useState<number|null>(null);
  const [pattern,setPattern]=useRecoverableField(`guide:${info.gameType}:pattern`,info.selected?.config.watermelonPatternId||'svo');
  const pendingRows=useRef<{kind:GuideKind;rows:string[][]}|null>(null);
  const asNames=kind==='names'||kind==='numbers';
  const family=guideFamily(info.gameType);const dedicated=family==='builtin'&&info.gameType!=='timer';
  // Built-in roleplay and generated activities need no extra input with their defaults.
  // Their optional editors remain in the separate settings panel.
  const inlineNative=dedicated&&!['airport','restaurant','icecream','doctor','shopping','mathgen'].includes(info.gameType);
  const steps=[0,1];
  let rows:string[][]=[];try{const stored=raw?JSON.parse(raw):null;rows=Array.isArray(stored)&&stored.every(r=>Array.isArray(r)&&r.every(s=>typeof s==='string'))?stored:[];}catch{/* recover malformed tab data safely */}
  const write=useCallback((next:string[][])=>setRaw(JSON.stringify(next)),[setRaw]);
  const resultCount=rows.filter(r=>r[0]?.trim()).length;
  const resultDraft=ladderResultDraft(extra,info.selected?.config.results);
  if(!extra&&info.selected?.config.ladderResultOrder==='random')resultDraft.order='random';
  // 시한폭탄은 단어·문장이 "읽을 내용"이라 참가자(items)는 그대로 두고, 예전 방식으로 단어가 참가자 칸에 들어간 활동만 기본 참가자로 되돌린다.
  const bombPeople=():GameItem[]=>{const own=info.selected;if(!own)return [];const words=new Set((own.config.classroomSource?.cards||[]).map(c=>c.word));return own.items.length&&own.items.every(i=>words.has(i.label))?[]:own.items;};
  const seed=(template:GameTemplate)=>{const next=guideRows(template,kind);write(next.length?next:[['','']]);};
  async function importSource(rawCards:FullCardItem[],list?:WordList){
    if(!info.selected)return;
    const cards=splitCards(rawCards).filter(c=>!(['quiz','online','ox'].includes(family)&&c.partOfSpeech==='문법'));
    setError('');
    if(asNames){write(cards.map(c=>[c.word]));return;}
    if(family==='diagram'){
      setDiagramCards(enrichCards(cards,await loadWordBank()));
      write(cards.map(card=>[card.word,'','']));setDiagram('');setDiagramTarget(0);return;
    }
    if(family==='bridge'){setSource(cards[0]?.word||'');write(cards.map(c=>[c.word,'','','']));return;}
    if(family==='tower'){setTowerStart(cards[0]?.word||'');write([['','0','','']]);return;}
    if(family==='image'||family==='groups'){
      const config={...info.selected.config,classroomSource:{id:list?.id||'composition',name:list?.name||'',kind:'word' as const,version:list?.updated_at||'',cards}};
      if(!await run(()=>info.applyGuide({items:info.selected!.items,config})))throw new Error('import_failed');
      write(cards.map(c=>family==='image'?[c.word,c.imageUrl||'']:[c.word,c.category||'']));return;
    }
    const content=prepareClassroomGame(info.gameType,cards,kind==='sentence'?'sentence':'word');
    if(!content)throw new Error('incompatible_source');
    const next={...info.selected,items:isBombReading(info.gameType,kind)&&bombPeople().length?bombPeople():content.items,config:{...info.selected.config,...content.config,classroomSource:{id:list?.id||'composition',name:list?.name||'',kind:kind==='sentence'?'sentence' as const:'word' as const,version:list?.updated_at||'',cards}}};
    if(!await run(()=>info.applyGuide({items:next.items,config:next.config})))throw new Error('import_failed');
    seed(next);
  }
  function sourceReason(list:WordList){
    if(['bridge','tower','image','groups','diagram'].includes(family))return null;
    if(prepareClassroomGame(info.gameType,list))return null;
    const requirement=classroomGameRequirement(info.gameType,list.kind||'word');return t(requirement.key,{count:requirement.count});
  }
  const setCell=(i:number,j:number,value:string)=>{const next=rows.map(r=>[...r]);next[i]||=[];next[i][j]=value;write(next);};
  useEffect(()=>{nativeVisible(active&&step===1&&native&&inlineNative);},[active,step,native,inlineNative,nativeVisible]);
  useEffect(()=>{if(active)heading.current?.focus();},[active,step]);
  useEffect(()=>{if(!active||!presetKind||!info.selected||info.loading||busy)return;onPresetUsed?.();void choose(presetKind);},[active,presetKind,info.selected,info.loading]); // eslint-disable-line react-hooks/exhaustive-deps
  // Route payloads are scoped just like existing quick sources. They never write saved data.
  useEffect(()=>{
    const launch=(location.state as {guideLaunch?:Launch}|null)?.guideLaunch;
    if(!active||!info.selected||info.loading||!launch||launchConsumed.current===location.key)return;
    if(launch.ownerId!==session?.user.id||launch.academyId!==academy?.id)return;
    launchConsumed.current=location.key;
    const k=launch.kind;if(!guideKinds(info.gameType).includes(k))return;
    setKind(k);
    if(k==='sample'){void run(()=>info.sampleGuide()).then(ok=>{if(ok)complete();});return;}
    const cards=splitCards(launch.cards||[]).filter(c=>!(['quiz','online','ox'].includes(family)&&c.partOfSpeech==='문법'));const prepared=(k==='names'||k==='numbers')?null:prepareClassroomGame(info.gameType,cards,k==='sentence'?'sentence':'word');
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
  const edited=useRef(0);
  const missingSourceHandled=useRef('');
  useEffect(()=>{
    const incoming=(location.state as {quickSource?:{ownerId?:string;academyId?:string;id?:string}}|null)?.quickSource;
    const supplied=info.selected?.config.classroomSource;
    if(!active||info.loading||!supplied||incoming?.ownerId!==session?.user.id||incoming?.academyId!==academy?.id||incoming?.id!==supplied.id||missingSourceHandled.current===location.key)return;
    if(prepareClassroomGame(info.gameType,supplied.cards,supplied.kind))return;
    missingSourceHandled.current=location.key;
    setKind(supplied.kind);setStep(1);
    write(supplied.cards.map(card=>family==='image'?[card.word,card.imageUrl||'']:family==='groups'?[card.word,card.category||'']:[card.word,card.meaning]));
    const requirement=classroomGameRequirement(info.gameType,supplied.kind);
    setError(t(requirement.key,{count:requirement.count}));
  },[active,info.loading,info.selected,info.gameType,location.state,location.key,session?.user.id,academy?.id,family,write,t]);
  useEffect(()=>{if(!active||!editRevision||edited.current===editRevision||!info.selected)return;
    edited.current=editRevision;const k=info.selected.config.setupKind || info.selected.config.classroomSource?.kind || (guideKinds(info.gameType).includes('word')?'word':guideKinds(info.gameType).includes('names')?'names':'sentence');
    setKind(k);write(guideRows(info.selected,k));setNative(dedicated);setStep(1);setError('');
  },[active,editRevision,info.selected,info.gameType,dedicated,write]);
  const problem=info.selected?guideProblem(info.selected):'incomplete';
  async function choose(k:GuideKind){
    setError('');setKind(k);setNative(dedicated);
    if(k==='sample'){if(await run(()=>info.sampleGuide()))complete();return;}
    if(!info.selected)return;
    // A guided edit of a saved activity always creates a temporary copy first.
    if(!dedicated&&!['bridge','tower','monster','diagram','slots'].includes(family)&&(k!==kind||!raw)){
      if(await run(()=>info.beginMaterial(k==='sentence'?'sentence':'word')))setStep(1);
    } else if(await run(()=>info.applyGuide({items:info.selected!.items,config:info.selected!.config})))setStep(1);
  }
  async function next(advanced=false){
    if(!info.selected)return;
    setError('');
    if(step===1){
      if(!dedicated&&!native){
        const work=['quiz','online'].includes(family)?fillDistractors(rows):rows;
        if(work!==rows&&work.some((r,i)=>r.length!==rows[i].length))write(work);
        const invalid=work.findIndex(r=>{
          if(!r.some(s=>s.trim()))return false;
          if(['pairs','groups','image'].includes(family))return !r[0]?.trim()||!r[1]?.trim();
          if(family==='ox')return !r[0]?.trim()||!['O','X'].includes(r[1]?.toUpperCase());
          if(['quiz','online'].includes(family))return !r[0]?.trim()||!r[1]?.trim()||!r.slice(2).some(s=>s.trim())||new Set(r.slice(1).filter(Boolean).map(s=>s.trim().toLowerCase())).size!==r.slice(1).filter(Boolean).length;
          return false;
        });
        if(invalid>=0){setError(t('launchUx.invalidRow',{row:invalid+1}));requestAnimationFrame(()=>{const inputs=Array.from(heading.current?.parentElement?.querySelectorAll<HTMLInputElement>(`[data-guide-row="${invalid}"] input`)||[]);(inputs.find(n=>!n.value.trim())||inputs[0])?.focus();});return;}
        if(family==='diagram'){
          const unplaced=work.findIndex(row=>row[0]?.trim()&&(!row[1]?.trim()||!row[2]?.trim()));
          if(unplaced>=0){setDiagramTarget(unplaced);setError(t('guide.diagramMissingPoint',{row:unplaced+1}));return;}
        }
        if(isBombReading(info.gameType,kind)&&!work.some(r=>r[0]?.trim())){setError(t('guide.incomplete'));return;}
        const mismatch=guideKindProblem(info.gameType,work,kind);
        if(mismatch){setError(t(`launchUx.kind_${mismatch.reason}`,{row:mismatch.row+1}));requestAnimationFrame(()=>{heading.current?.parentElement?.querySelectorAll<HTMLInputElement>(`[data-guide-row="${mismatch.row}"] input`)[mismatch.col]?.focus();});return;}
        const content=guideContent(info.gameType,work,kind,{...info.selected.config,...(family==='diagram'?{diagramImageUrl:diagram}:{}),...(family==='slots'?{watermelonPatternId:pattern}:{})},towerStart,bombPeople());
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
        content.config.setupKind=kind==='sample'?undefined:kind;
        const check=guideProblem({...info.selected,...content});if(check){const count=work.filter(r=>r[0]?.trim()).length;const minimum=family==='list'?GAME_CATALOG.find(g=>g.type===info.gameType)?.minItems||1:0;setError(minimum>count?t('launchUx.minimum',{count,minimum}):t('launchUx.problem',{reason:t(`guide.${check}`),count}));return;}
        if(!await run(()=>info.applyGuide(content)))return;
      }else if(workspace?.commitPreparation){if(!await workspace.commitPreparation()){setError(t(`guide.${problem||'incomplete'}`));return;}}
      else if(problem||!canStart){setError(t(`guide.${problem||'incomplete'}`));return;}
      if(advanced)workspace?.open('settings');else complete();
    }
  }
  const columns=asNames?[kind==='numbers'?'numberColumn':['wheel','ladder','order'].includes(info.gameType)?'itemColumn':'nameColumn']:family==='diagram'?['answer']:family==='slots'?['wordColumn','position']:family==='pairs'?info.gameType==='typeanswer'?['question',kind==='sentence'?'answerSentence':'answerWord']:kind==='sentence'?['sentenceColumn','translation']:['wordColumn','meaning']:['quiz','online','bridge','monster'].includes(family)?['question','answer','wrong','wrong']:family==='ox'?['statementColumn','ox']:family==='groups'?['wordColumn','group']:family==='image'?['answer','image']:family==='tower'?['phrase','position','wrong','wrong']:['wheel','ladder','order'].includes(info.gameType)?[kind==='sentence'?'sentenceColumn':kind==='word'?'wordColumn':'itemColumn']:kind==='sentence'?['sentenceColumn','translation']:['wordColumn','meaning'];
  const gameHint=t(`guide.gameHints.${info.gameType}_${kind}`,{defaultValue:t(`guide.gameHints.${info.gameType}`,{defaultValue:''})});
  let previous=towerStart;
  const towerPrevious=rows.map(r=>{const p=previous;previous=insertPhrase(previous,r[0]||'',Number(r[1])||0);return p;});
  if(!active)return null;
  return <section className="space-y-5 p-4 sm:p-6" data-game-guide data-guide-step={step}>
    <p className="font-bold text-primary" role="status">{t('guide.step',{current:steps.indexOf(step)+1,total:steps.length})} · {t(step===0?'guide.chooseSource':'guide.content')}</p>
    <h2 ref={heading} tabIndex={-1} className="text-2xl font-black">{t(step===0?'guide.title':'guide.chooseContent')}</h2>
    {error&&step!==1&&<p role="alert" className="rounded-xl bg-error-container p-4">{error}</p>}
    {step===0&&<div className="grid grid-cols-2 gap-3">{(['sample','word','sentence','names'] as GuideKind[]).map(k=><button className={`${button} min-h-28 text-left disabled:opacity-100! disabled:bg-slate-100 disabled:text-slate-600 ${k==='sample'?'bg-sky-50! border-primary':''}`} key={k} disabled={busy||info.loading||!guideKinds(info.gameType).includes(k)} aria-disabled={!guideKinds(info.gameType).includes(k)} onClick={()=>void choose(k)}><span className="block text-xl">{t(`guide.${k}`)}</span><span className="mt-2 block font-normal">{t(guideKinds(info.gameType).includes(k)?`guide.${k}Hint`:`launchUx.unsupported_${k}`)}</span></button>)}{dedicated&&<button className={button} onClick={()=>void choose(info.gameType==='timer'?'names':'word')}>{t('guide.keepDefault')}</button>}</div>}
    {step===1&&<>
      <p className="text-sm text-on-surface-variant">{t('launchUx.contentRestart')}</p>
      <p className="rounded-xl bg-sky-50 p-4 text-lg">{t(`guide.hints.${family}_${kind}`,{defaultValue:t(`guide.hints.${family}`)})}</p>
      {gameHint&&<p>{gameHint}</p>}
      {!native&&kind==='numbers'&&<NumberRangeFill existingLabels={rows.map(r=>r[0]||'').filter(Boolean)} onFill={(labels,replace)=>{const keep=replace?[]:rows.filter(r=>r[0]?.trim());const next=[...keep,...labels.map(l=>[l])];write(next.length?next:[['']]);}} />}
      {!native&&kind!=='sample'&&kind!=='numbers'&&<GameSourcePicker kind={kind} onPick={importSource} canUse={sourceReason} onDirect={()=>{setNative(false);requestAnimationFrame(()=>heading.current?.parentElement?.querySelector<HTMLInputElement>('fieldset input')?.focus());}} />}
      {!dedicated&&!native&&<>

        {family==='diagram'&&<div className="space-y-3"><p>{t('guide.diagramSourceHint')}</p><GameImagePicker library libraryCards={diagramCards} academyId={info.academyId} value={diagram||null} onChange={url=>setDiagram(url||'')}/>{diagram&&<div className="relative w-fit"><button type="button" className="block rounded-xl focus-visible:outline-4 focus-visible:outline-primary" data-diagram-position-image aria-label={t('guide.hints.diagram')} onClick={e=>{const bounds=e.currentTarget.getBoundingClientRect(),keyboard=e.detail===0;const position=[String(keyboard?.5:(e.clientX-bounds.left)/bounds.width),String(keyboard?.5:(e.clientY-bounds.top)/bounds.height)];const index=diagramTarget!==null&&diagramTarget<rows.length?diagramTarget:rows.findIndex(row=>row[0]&&(!row[1]||!row[2]));if(index>=0){write(rows.map((row,i)=>i===index?[row[0],...position]:row));setDiagramTarget(null);}else write([...rows.filter(row=>row[0]),['',...position]]);setError('');}}><img src={diagram} className="max-h-80 max-w-full cursor-crosshair" alt=""/></button>{rows.map((row,i)=>row[1]&&row[2]?<span key={i} aria-hidden className="pointer-events-none absolute rounded-full bg-primary px-2 text-white" style={{left:`${Number(row[1])*100}%`,top:`${Number(row[2])*100}%`}}>{i+1}</span>:null)}</div>}</div>}
        {family==='slots'&&<label className="block font-bold">{t('gameWatermelon.slotLabel')}<select className="ml-2 rounded-xl border p-3" value={pattern} onChange={e=>setPattern(e.target.value)}>{SENTENCE_PATTERNS.filter(p=>p.playable).map(p=><option key={p.id} value={p.id}>{t(p.nameKey)}</option>)}</select></label>}
        {family==='tower'&&<label className="block font-bold">{t('guide.startSentence')}<input className="mt-2 w-full rounded-xl border p-3" value={towerStart} onChange={e=>setTowerStart(e.target.value)}/></label>}
        {family==='bridge'&&<div className="space-y-2 rounded-xl border p-3"><label className="block">{t('guide.blank')}<input value={source} className="mt-2 w-full rounded-xl border p-3" onChange={e=>setSource(e.target.value)} onSelect={e=>{selection.current={start:e.currentTarget.selectionStart||0,end:e.currentTarget.selectionEnd||0};}}/></label><button className={button} onClick={()=>{const {start,end}=selection.current;if(end>start){write([...rows.filter(r=>r[0]),[source.slice(0,start)+'___'+source.slice(end),source.slice(start,end),'','']]);}}}>{t('guide.makeBlank')}</button></div>}
        <div className="space-y-3">{rows.map((row,i)=><fieldset key={i} data-guide-row={i} className="rounded-2xl border bg-surface-container-lowest p-4"><legend className="px-2 font-bold">{i+1}</legend>
          {family==='diagram'&&<button type="button" data-diagram-target={i} aria-pressed={diagramTarget===i} className={button} onClick={()=>setDiagramTarget(i)}>{t(diagramTarget===i?'guide.diagramClickPoint':row[1]&&row[2]?'guide.diagramMovePoint':'guide.diagramSetPoint',{row:i+1})}</button>}
          {family==='tower'&&<div className="mb-3 space-y-2"><p>{t('guide.towerHint')}</p><div className="flex flex-wrap gap-1">{[0,...Array.from(towerPrevious[i].matchAll(/\s+/g),m=>m.index!+m[0].length),towerPrevious[i].length].map((pos,j)=><button type="button" className={`${button} ${Number(row[1])===pos?'border-primary bg-sky-50!':''}`} key={`${pos}-${j}`} onClick={()=>setCell(i,1,String(pos))}>{towerPrevious[i].slice(0,pos)} ▏ {towerPrevious[i].slice(pos)}</button>)}</div><p>{t('guide.result')}: {insertPhrase(towerPrevious[i],row[0]||'',Number(row[1])||0)}</p></div>}
          <div className="grid gap-3 sm:grid-cols-2">{columns.map((col,j)=>family==='tower'&&j===1?null:<label key={`${col}-${j}`} className="block font-bold">{t(`guide.${col}`)}{col==='wrong'?` ${j-1}`:''}{family==='slots'&&j===1?<select aria-label={t('gameWatermelon.slotLabel')} className="mt-1 w-full rounded-xl border p-3" value={row[j]||''} onChange={e=>setCell(i,j,e.target.value)}><option value="">—</option>{getSentencePattern(pattern).slots.map(slot=><option key={slot} value={slot}>{t(slotLabelKey(slot as SentenceSlot))}</option>)}</select>:col==='image'?<GameImagePicker academyId={info.academyId} value={row[j]||null} onChange={url=>setCell(i,j,url||'')} previewHeight={96}/>:col==='ox'?<select aria-label={t('guide.ox')} className="mt-1 w-full rounded-xl border bg-white p-3" value={row[j]||''} onChange={e=>setCell(i,j,e.target.value)}><option value="">—</option><option>O</option><option>X</option></select>:<input className="mt-1 w-full rounded-xl border bg-white p-3 font-normal" value={row[j]||''} onChange={e=>setCell(i,j,e.target.value)} />}</label>)}</div>
          <button className={`${button} mt-3`} aria-label={`${t('guide.remove')} ${i+1}`} onClick={()=>write(rows.filter((_,n)=>n!==i))}>{t('guide.remove')}</button>
        </fieldset>)}</div>{family!=='diagram'&&<button className={button} onClick={()=>write([...rows,columns.map(()=> '')])}>+ {t('guide.add')}</button>}
        <details><summary className="cursor-pointer py-3 font-bold text-primary">{t('guide.paste')}</summary><label className="block">{t(`guide.pasteHint_${kind}`,{defaultValue:t('guide.pasteHint')})}<textarea className="mt-2 min-h-32 w-full rounded-xl border p-3" value={paste} onChange={e=>setPaste(e.target.value)}/></label><button className={button} disabled={!paste.trim()} onClick={()=>{const next=paste.split(/\r?\n/).filter(s=>s.trim()).map(s=>s.split(/\t|\s*\|\s*/));write([...rows.filter(r=>r.some(s=>s.trim())),...next]);}}>{t('guide.applyPaste')}</button></details>
        {info.gameType==='ladder'&&<div ref={resultSection}><LadderResultSetup draft={resultDraft} count={resultCount} onChange={draft=>{setExtra(JSON.stringify(draft));setError('');}} /></div>}
      </>}
      <button className={button} onClick={()=>dedicated?workspace?.open('settings'):void next(true)}>{t('guide.native')}</button>
      {native&&<p>{t('guide.nativeReview')}</p>}
    </>}
    {error&&step===1&&<p role="alert" className="rounded-xl bg-error-container p-3 font-bold" data-guide-error>{error}</p>}
    <footer className="flex flex-wrap gap-3 border-t pt-4">{step>0&&<button className={button} disabled={busy} onClick={()=>{setStep(0);setError('');}}>{t('guide.back')}</button>}{step===1&&<button className={`${button} bg-primary! text-white!`} disabled={busy||info.loading} onClick={()=>void next()}>{t('launchUx.done')}</button>}</footer>
  </section>;
}
