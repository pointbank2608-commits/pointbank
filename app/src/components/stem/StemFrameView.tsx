import {useEffect,useMemo,useRef,useState} from 'react';
import {I18nextProvider,useTranslation} from 'react-i18next';
import FindMissing from '../FindMissing';
import {StemReportSheet} from './StemReport';
import StemReportPreview from './StemReport';
import type {StemFrame,StemMeta} from '../../lib/stemTypes';
import {extractYoutubeId} from '../../lib/youtube';
import LessonSlideContent from '../LessonSlideContent';
import StemIllustratedSlide from './StemIllustratedSlide';
import '../../styles/stem.css';
import '../../styles/stem-illustrated.css';

function MiniReport({report}:{report:StemMeta['report']}){
 const ref=useRef<HTMLDivElement>(null);const [scale,setScale]=useState(.4);
 useEffect(()=>{const el=ref.current;if(!el)return;const resize=new ResizeObserver(()=>setScale(el.clientWidth/(210*96/25.4)));resize.observe(el);return()=>resize.disconnect();},[]);
 return <div ref={ref} className="stem-mini-report"><div style={{transform:`scale(${scale})`,transformOrigin:'top left',width:'210mm'}}><StemReportSheet report={report}/></div></div>;
}

export default function StemFrameView({frame,meta,interactive=true}:{frame:StemFrame;meta:StemMeta;interactive?:boolean}){
 meta=frame.metaOverride||meta;
 if(frame.report)meta={...meta,report:frame.report};
 const {i18n}=useTranslation();const english=useMemo(()=>i18n.cloneInstance({lng:'en'}),[i18n]);const [reportOpen,setReportOpen]=useState(false);
 const cards=meta.vocabulary.filter(w=>!frame.vocabularyIds?.length||frame.vocabularyIds.includes(w.id));
 if(frame.mode==='existing'&&frame.existing)return <LessonSlideContent slide={frame.existing} words={meta.vocabulary} fill={false} lessonName={meta.title} attendance={null}/>;
 if(frame.mode==='image'&&frame.imageUrl)return <div className="stem-stage" lang="en"><img className="stem-original" src={frame.imageUrl} alt={frame.title} draggable={false}/></div>;
 if(frame.mode==='missing')return <div className="stem-stage stem-native stem-missing" data-stem-theme={meta.presentation} lang="en"><h2>{frame.title}</h2><p>Close your eyes! Open your eyes! What’s missing?</p>{interactive?<I18nextProvider i18n={english}><FindMissing items={cards.map(w=>({id:w.id,label:w.word}))} revealCount={1} shuffleCards={false} memorizeSeconds={null} cardImages={Object.fromEntries(cards.filter(w=>w.imageUrl).map(w=>[w.id,w.imageUrl!]))}/></I18nextProvider>:<div className="stem-word-grid">{cards.map(w=><div key={w.id}>{w.imageUrl&&<img src={w.imageUrl} alt=""/>}<b>{w.word}</b></div>)}</div>}</div>;
 if(frame.mode==='report')return <div className="stem-stage stem-native stem-report-stage" data-stem-theme={meta.presentation} lang="en"><div><h2>{frame.title}</h2><p>{meta.report.title}</p><p>Write your prediction and result.</p><p>Put the pictures in order.</p><p>Show what you learned.</p>{interactive&&<button onClick={()=>setReportOpen(true)}>Preview &amp; Print Report</button>}</div><MiniReport report={meta.report}/>{meta.mascotUrl&&<img className="stem-report-mascot" src={meta.mascotUrl} alt=""/>}{reportOpen&&<StemReportPreview report={meta.report} onClose={()=>setReportOpen(false)}/>}</div>;
 if(frame.mode==='video'){const id=extractYoutubeId(frame.videoUrl||'');return <div className="stem-stage">{id&&<iframe title={frame.title} src={`https://www.youtube-nocookie.com/embed/${id}`} allow="encrypted-media; picture-in-picture" allowFullScreen/>}</div>;}
 if(frame.mode==='game')return <div className="stem-stage stem-native"><h2>{frame.title}</h2><p>This saved game opens in My Lessons.</p></div>;
 if(meta.presentation==='science-lab')return <StemIllustratedSlide frame={frame} meta={meta} cards={cards}/>;
 return <div className={`stem-stage stem-native stem-layout-${frame.layout}${frame.mode==='text'&&frame.imageUrl&&!frame.illustrations?.length?' stem-has-picture':''}`} data-stem-theme={meta.presentation} lang="en"><h2>{frame.title}</h2>{frame.mode==='vocabulary'?<div className="stem-word-grid">{cards.map(w=><div key={w.id}>{w.imageUrl&&<img src={w.imageUrl} alt=""/>}<b>{w.word}</b><p>{w.example}</p></div>)}</div>:<><div className="stem-illustrations">{frame.illustrations?.map((im,i)=><figure key={i}><img src={im.imageUrl} alt=""/><figcaption>{im.caption}</figcaption></figure>)}</div>{!frame.illustrations?.length&&frame.imageUrl&&<img className="stem-inline-image" src={frame.imageUrl} alt=""/>}<div className="stem-lines">{frame.lines.map((line,i)=><p key={i}>{frame.layout==='experiment-steps'?`${i+1}. `:''}{line}</p>)}</div></>}</div>;
}
