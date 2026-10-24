import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { speak } from '../../lib/speech';
import type { PhonicsBankEntry } from '../../lib/types';
import { stage1Entry, type Stage1Unit } from '../../data/phonicsStage1';
import artwork from '../../data/phonics/stage1Artwork.json';
import wordAssets from '../../data/phonics/words.json';

export function Stage1Word({entry,blank=false}:{entry:PhonicsBankEntry;blank?:boolean}) {
  const marks=entry.targets??[];
  return <span className="s1-word" data-word-id={entry.wordId}>{[...entry.word].map((c,i)=>marks.includes(i)
    ? blank?<span key={i} className="s1-letter-blank" data-target-blank/>:<span key={i} className="s1-target">{c}</span>:<span key={i}>{c}</span>)}</span>;
}
export function Stage1Picture({entry,shadow=false}:{entry:PhonicsBankEntry;shadow?:boolean}) {
  const {t}=useTranslation();const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[entry.image_url]);
  const art=(artwork.shadows as Record<string,{url:string;viewBox:string}>)[entry.wordId??''];
  const original=(wordAssets as Record<string,{imageUrl:string|null}>)[entry.wordId??''];
  if(!entry.image_url||failed)return <span className="s1-media-error" role="alert">{t('phonicsStage1.mediaError')}</span>;
  if(shadow&&art&&entry.image_url===original?.imageUrl)return <svg className="s1-picture" viewBox={art.viewBox} role="img" aria-label="What is it?" data-shadow={entry.wordId}><image href={art.url} width="1280" height="720"/></svg>;
  return <img className="s1-picture" src={entry.image_url} alt="" data-picture-word={entry.wordId} onError={()=>setFailed(true)}/>;
}
export function Stage1Speaker({entry,text}:{entry?:PhonicsBankEntry;text?:string}) {
  const {t}=useTranslation();const [failed,setFailed]=useState(false);
  const recording=entry?.audio?.recordingUrl;
  const available=!!recording||(typeof window!=='undefined'&&'speechSynthesis' in window);
  const label=text??entry?.word??'';
  return <span className="s1-speaker-wrap"><button className="s1-speaker no-print" type="button" aria-label={t('phonicsStage1.audio')} title={t(available?'phonicsStage1.audioInfo':'phonicsStage1.audioUnavailable')} disabled={!available||!label} onClick={()=>{
    setFailed(false);if(recording){const audio=new Audio(recording);audio.onerror=()=>setFailed(true);void audio.play().catch(()=>setFailed(true));}else if(available)speak(label);
  }}><svg aria-hidden viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3zM16 8q4 4 0 8M19 5q7 7 0 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>{failed&&<small role="alert">{t('phonicsStage1.audioFailed')}</small>}</span>;
}
export function Stage1Lines({text='',trace=false}:{text?:string;trace?:boolean}) {
  return <div className="s1-writing-lines" data-writing={trace?'trace':'independent'}>{trace&&<span>{text}</span>}</div>;
}
/** One scene component and stable word-ID coordinates for slides and workbook p.7. */
export function Stage1Scene({unit,arrow,onChoose}:{unit:Stage1Unit;arrow?:string;onChoose?:(id:string)=>void}) {
  if(!unit.reader)return null;
  const slots=unit.reader.scene as Record<string,{x:number;y:number;w:number;h:number}>;
  const pointed=arrow?slots[arrow]:null;
  return <div className="s1-scene" data-stage1-scene={unit.id} data-scene-arrow={arrow??''}>
    <div className="s1-scene-ground"/>
    {unit.reader.wordIds.map(id=>{const p=slots[id],entry=stage1Entry(unit,id);return <button key={id} type="button" className="s1-scene-object" style={{left:p.x+'%',top:p.y+'%',width:p.w+'%',height:p.h+'%'}} onClick={()=>onChoose?.(id)} disabled={!onChoose} aria-label={onChoose?entry.word:undefined} data-scene-word={id}><Stage1Picture entry={entry}/></button>;})}
    {pointed&&<svg className="s1-scene-arrow" viewBox="0 0 1000 480" aria-hidden><defs><marker id={'s1-arrow-'+arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#dc2626"/></marker></defs><path d={`M${(pointed.x+pointed.w/2)*10-90} ${pointed.y*4.8+15} L${(pointed.x+pointed.w/2)*10} ${(pointed.y+pointed.h/2)*4.8}`} fill="none" stroke="#dc2626" strokeWidth="10" markerEnd={`url(#s1-arrow-${arrow})`}/></svg>}
  </div>;
}
