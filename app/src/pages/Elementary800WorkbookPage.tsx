import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWordBank } from '../lib/api';
import { bookPageCount, buildElementaryBooklets, elementaryCoverage, workbookBankWithVerbContinuation, POS_ORDER, type WorkbookPos } from '../lib/elementary800Workbook';
import type { WordBankEntry } from '../lib/types';
import Elementary800Sheets from '../components/worksheets/Elementary800Sheets';
import Elementary800Actions from '../components/Elementary800Actions';
import { originalVerbBooklets } from '../lib/elementary800Sources';
import '../styles/elementary800.css';

const pdfRoot='/workbooks/elementary800/';
export default function Elementary800WorkbookPage(){
 const {t}=useTranslation();const [params]=useSearchParams();const original=params.get('tab')!=='workbook';
 return <div className="space-y-5"><div className="no-print e800-controls"><Link to="/materials">← {t('elementary800.back')}</Link><h1 className="mt-4">{t('elementary800.title')}</h1><p>{t('elementary800.description')}</p>
 <nav className="e800-tabs" aria-label={t('elementary800.title')}><Link to="?tab=original" aria-current={original?'page':undefined}>{t('elementary800.original')}</Link><Link to="?tab=workbook" aria-current={!original?'page':undefined}>{t('elementary800.workbook')}</Link></nav>
 </div>{original?<OriginalWorkbook/>:<WorkbookBuilder/>}</div>;
}
function OriginalWorkbook(){
 const {t}=useTranslation();const [level,setLevel]=useState(0);const file=pdfRoot+(level?`verbs-level${level}.pdf`:'verbs-level1-4.pdf');
 return <section className="e800-controls no-print"><h2>{t('elementary800.originalTitle')}</h2><p>{t('elementary800.sourceNote')}</p><p className="text-sm">{t('elementary800.originalNote')}</p><div className="e800-levels">{[0,1,2,3,4].map(n=><div key={n} className="e800-original-card"><label><input type="radio" name="original-level" checked={level===n} onChange={()=>setLevel(n)}/><strong>{n?t('elementary800.level',{level:n}):t('elementary800.all')}</strong></label><p>{t('elementary800.pages',{count:n?10:40})} · {t('elementary800.count',{count:n?25:100})}</p></div>)}</div><div className="flex flex-wrap gap-3"><a className="e800-button e800-button-primary" href={file} target="_blank" rel="noopener">{t('elementary800.open')} ↗</a><a className="e800-button" href={file} download>{t('elementary800.download')}</a></div><p>{t('elementary800.pdfHint')}</p>
 <OriginalVocabulary level={level}/>
 <section className="mt-8 border-t pt-5"><h2>{t('elementary800.continuationTitle')}</h2><p>{t('elementary800.continuationDescription')}</p><div className="e800-levels">{[5,6,7].map(n=><div key={n} className="e800-original-card"><h3 className="font-bold">Level {n}</h3><p>{t('elementary800.count',{count:n===7?21:25})} · {t('elementary800.pages',{count:n===7?9:10})}</p><a className="e800-button" href={`${pdfRoot}verbs-level${n}.pdf`} target="_blank" rel="noopener">{t('elementary800.open')}</a><Link className="e800-button mt-2" to={`?tab=workbook&pos=verb&levels=verb-${n}`}>{t('elementary800.reuseLevel')}</Link></div>)}</div><div className="flex flex-wrap gap-3"><a className="e800-button" href={`${pdfRoot}verbs-level5-7.pdf`} download>{t('elementary800.continuationDownload')}</a><a className="e800-button e800-button-primary" href={`${pdfRoot}verbs-level1-7.pdf`} download>{t('elementary800.completeDownload')}</a></div></section>
 <iframe key={file} className="e800-original-preview" src={file+'#view=FitH'} title={t('elementary800.preview')}/></section>;
}
function OriginalVocabulary({level}:{level:number}) {
 const {t}=useTranslation();const [bank,setBank]=useState<WordBankEntry[]|null>(null);const [error,setError]=useState(false);const [attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;setBank(null);setError(false);void fetchWordBank().then(rows=>{if(active)setBank(rows);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[attempt]);
 const books=useMemo(()=>originalVerbBooklets(bank??[]).filter(book=>!level||book.level===level),[bank,level]);
 const complete=books.every(book=>book.entries.length===25);
 return <div className="mt-5"><p>{t('elementary800.originalReuse')}</p>{!bank&&!error&&<p role="status">{t('elementary800.loading')}</p>}{(error||(bank&&!complete))&&<div role="alert"><p>{t('elementary800.originalMissing')}</p><button className="e800-button" onClick={()=>setAttempt(n=>n+1)}>{t('elementary800.retry')}</button></div>}{bank&&complete&&<Elementary800Actions books={books}/>}</div>;
}
function WorkbookBuilder(){
 const {t}=useTranslation();const [params,setParams]=useSearchParams();
 const initialPos=POS_ORDER.includes(params.get('pos') as WorkbookPos)?params.get('pos') as WorkbookPos:'verb';
 const [pos,setPos]=useState<WorkbookPos>(initialPos);const [selected,setSelected]=useState<string[]>(()=>params.get('levels')?.split(',')??[]);
 const [bank,setBank]=useState<WordBankEntry[]>([]);const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');const [attempt,setAttempt]=useState(0);
 const [kind,setKind]=useState('both');const [copies,setCopies]=useState(1);const [cover,setCover]=useState(true);const [guide,setGuide]=useState(false);const [mono,setMono]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const preview=useRef<HTMLDivElement>(null);
 useEffect(()=>{let alive=true;setStatus('loading');void fetchWordBank().then(rows=>{if(alive){setBank(rows);setStatus(rows.length?'ready':'error');}}).catch(()=>{if(alive)setStatus('error');});return()=>{alive=false;};},[attempt]);
 const books=useMemo(()=>buildElementaryBooklets(workbookBankWithVerbContinuation(bank)),[bank]);const available=books.filter(b=>b.pos===pos);const chosen=available.filter(b=>selected.includes(b.id));
 const coverage=elementaryCoverage(bank);const words=chosen.flatMap(b=>b.entries);const images=words.filter(w=>!w.image_url).length;const examples=words.filter(w=>!w.example_sentence).length;
 function choose(next:string[]){setSelected(next);setError('');setParams({tab:'workbook',pos,levels:next.join(',')},{replace:true});}
 function changePos(next:WorkbookPos){setPos(next);setSelected([]);setError('');setParams({tab:'workbook',pos:next},{replace:true});}
 const pages=chosen.reduce((n,b)=>n+bookPageCount(b,kind,cover,guide,copies),0);
 async function print(){setBusy(true);setError('');try{
  await document.fonts.ready;
  const pictures=Array.from(preview.current?.querySelectorAll('img')??[]);
  await Promise.all(pictures.map(image=>image.decode()));
  if(preview.current?.querySelector('[data-image-failed]'))throw new Error('picture');
  window.print();
 }catch{setError(t('elementary800.printError'));}finally{setBusy(false);}}
 return <><section className="e800-controls no-print"><p>{t('elementary800.sort')}</p><p>{t('elementary800.sequence')}</p>
 {status==='loading'&&<p role="status">{t('elementary800.loading')}</p>}
 {status==='error'&&<div role="alert"><p>{t('elementary800.error')}</p><button className="e800-button" onClick={()=>setAttempt(n=>n+1)}>{t('elementary800.retry')}</button></div>}
 {status==='ready'&&<><p>{t('elementary800.coverage',{count:coverage})}</p>{coverage<800&&<p className="e800-notice" role="status">{t('elementary800.incomplete')}</p>}
 <label className="font-bold">{t('elementary800.posLabel')} <select value={pos} onChange={e=>changePos(e.target.value as WorkbookPos)}>{POS_ORDER.map(id=><option value={id} key={id}>{t(`elementary800.pos.${id}`)} ({books.filter(b=>b.pos===id).reduce((n,b)=>n+b.entries.length,0)})</option>)}</select></label>
 <fieldset className="mt-5"><legend className="font-bold">{t('elementary800.levels')}</legend><div className="flex flex-wrap gap-3 mt-2"><button className="e800-button" disabled={!available.length} onClick={()=>choose(available.map(b=>b.id))}>{t('elementary800.selectAll')}</button><button className="e800-button" disabled={!selected.length} onClick={()=>choose([])}>{t('elementary800.clear')}</button></div><div className="e800-levels">{available.map(book=><label key={book.id}><input type="checkbox" checked={selected.includes(book.id)} onChange={e=>choose(e.target.checked?[...selected,book.id]:selected.filter(id=>id!==book.id))}/><span><strong>{t('elementary800.level',{level:book.level})}</strong><br/>{t('elementary800.count',{count:book.entries.length})}<br/><small>{book.entries.slice(0,3).map(w=>w.word).join(' · ')}…</small></span></label>)}</div>{!available.length&&<p role="status">{t('elementary800.empty')}</p>}</fieldset>
 <Elementary800Actions books={chosen}/>
 <div className="e800-options"><label>{t('elementary800.mode')}<select value={kind} onChange={e=>setKind(e.target.value)}>{['both','cards','writing'].map(id=><option key={id} value={id}>{t(`elementary800.${id}`)}</option>)}</select></label>{kind!=='writing'&&<label>{t('elementary800.copies')}<select value={copies} onChange={e=>setCopies(Number(e.target.value))}><option value={1}>{t('elementary800.one')}</option><option value={2}>{t('elementary800.two')}</option><option value={4}>{t('elementary800.four')}</option></select></label>}
 <label><input type="checkbox" checked={cover} onChange={e=>setCover(e.target.checked)}/>{t('elementary800.cover')}</label><label><input type="checkbox" checked={guide} onChange={e=>setGuide(e.target.checked)}/>{t('elementary800.guide')}</label><label><input type="checkbox" checked={mono} onChange={e=>setMono(e.target.checked)}/>{t('elementary800.mono')}</label></div>
 {(images>0||examples>0)&&chosen.length>0&&<p className="e800-notice" role="status">{t('elementary800.missing',{images,examples})}</p>}
 <p>{t('elementary800.pages',{count:pages})}</p><button className="e800-button e800-button-primary" disabled={!chosen.length||busy} onClick={()=>void print()}>{t(busy?'elementary800.printing':'elementary800.print')}</button>{error&&<p role="alert">{error}</p>}
 {!chosen.length&&<p>{t('elementary800.selectHint')}</p>}
 </>}
 </section><div ref={preview} className="e800-preview-scroll"><Elementary800Sheets books={chosen} kind={kind} copies={copies} cover={cover} guide={guide} mono={mono}/></div></>;
}
