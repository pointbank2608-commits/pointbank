import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {ToastProvider} from '../../src/context/ToastContext';
import StemFrameView from '../../src/components/stem/StemFrameView';
import StemIllustratedSlide from '../../src/components/stem/StemIllustratedSlide';
import {StemReportSheet} from '../../src/components/stem/StemReport';
import {PAPER_BRIDGES} from '../../src/data/stemPaperBridges';
import {SURFACE_TENSION} from '../../src/data/stemLessons';
import i18n from '../../src/i18n';
import '../../src/tailwind.css';
void i18n.changeLanguage('en');
const query=new URLSearchParams(location.search);
const lesson=query.get('topic')==='surface'?SURFACE_TENSION:PAPER_BRIDGES;
function Review(){
 const [index,setIndex]=useState(Number(query.get('slide')||1)-1);
 useEffect(()=>{(window as any).__setSlide=(n:number)=>setIndex(n-1);(window as any).__lesson=lesson;},[]);
 if(query.has('report'))return <div id="standalone-report"><StemReportSheet report={lesson.meta.report}/></div>;
 const frame=lesson.frames[index];
 return <main className="sample-shell"><header><b>ClassBank · {lesson.meta.title}</b><span>Review sample</span><a href={'?topic='+(lesson===PAPER_BRIDGES?'surface':'bridges')}>Compare {lesson===PAPER_BRIDGES?'Surface Tension':'Paper Bridges'}</a></header><div className="sample-fit">{frame.mode==='video'&&query.has('capture')?<StemIllustratedSlide frame={{...frame,mode:'text',imageUrl:'/stem/paper-bridges/dynamic/folded.webp',lines:['What did they change?','What stayed the same?','Watch the video after Test 1.']}} meta={lesson.meta} cards={[]}/>:<StemFrameView key={frame.id} frame={frame} meta={lesson.meta} interactive={!query.has('capture')}/>}</div><footer><button disabled={!index} onClick={()=>setIndex(i=>i-1)}>Previous</button><span>{index+1} / {lesson.frames.length}</span><button disabled={index===lesson.frames.length-1} onClick={()=>setIndex(i=>i+1)}>Next</button><a href="?report=1">A4 Report</a><a href={`/stem?copy=${lesson.meta.sourceId}`}>복제해서 블록 편집</a></footer></main>;
}
const style=document.createElement('style');style.textContent=`body{margin:0;background:#0e2238}.sample-shell{height:100dvh;display:flex;flex-direction:column;padding:12px;box-sizing:border-box;gap:10px;color:white}.sample-shell header,.sample-shell footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.sample-shell button,.sample-shell a{border-radius:10px;background:white;color:#12365c;padding:10px 15px;min-height:44px}.sample-shell .sample-fit{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}.sample-fit>.stem-stage{width:min(100%,calc((100dvh - 140px)*16/9));flex:none;height:auto;max-height:100%;aspect-ratio:16/9}#standalone-report{width:210mm;margin:auto;background:white}@page{size:A4;margin:0}@media print{body{background:white}#standalone-report{margin:0}}`;document.head.append(style);
createRoot(document.getElementById('root')!).render(<BrowserRouter><ToastProvider><Review/></ToastProvider></BrowserRouter>);
