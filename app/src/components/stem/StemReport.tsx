import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import AccessibleDialog from '../AccessibleDialog';
import type {StemReport as Report} from '../../lib/stemTypes';
import {stemReportOrder} from '../../lib/stem';
import '../../styles/stem.css';

export function StemReportSheet({report,showBank=report.showWordBank}:{report:Report;showBank?:boolean}){
 const order=stemReportOrder(report.steps.length);
 return <article className="stem-report-sheet" lang="en" data-stem-report>
  <header><div><small>ClassBank · SCIENCE LAB</small><h1>MY SCIENCE REPORT</h1><h2>{report.title}</h2></div>{report.mascotUrl&&<img src={report.mascotUrl} alt=""/>}</header>
  <p className="stem-report-name">Name: _____________________ <span>Date: __________________</span></p>
  <section><h3>1. My Question</h3><div className="stem-report-question">{report.question}</div></section>
  <section><h3>2. My Prediction &amp; Result</h3><p>{report.prediction}</p><p>{report.result}</p></section>
  {order.length>0&&<section><h3>3. My Experiment</h3><p className="stem-report-instruction">What did I do? Put the pictures in order (1–{order.length}).</p><div className="stem-report-steps">{order.map(i=><div key={report.steps[i].id} data-report-step={report.steps[i].id}><span className="stem-step-number"/><img src={report.steps[i].imageUrl} alt={report.steps[i].text}/><p>{report.steps[i].text}</p></div>)}</div></section>}
  {report.questions.length>0&&<section><h3>4. What Did I Learn?</h3><p className="stem-report-instruction">Choose the correct words.</p>{report.questions.map((q,i)=><div className="stem-report-choice" key={q.id}><p>{i+1}. {q.prompt}</p><p className="stem-report-options">{q.options.join('  /  ')}</p></div>)}</section>}
  <section><h3>5. My Science Sentence</h3><p className="stem-report-instruction">Complete the sentences.</p>{showBank&&report.wordBank.length>0&&<div className="stem-report-bank"><b>Word Bank</b>　{report.wordBank.join(' / ')}<small>Change the verb if needed.</small></div>}{report.sentences.map((line,i)=><p key={i} className="stem-report-writing">{line}</p>)}</section>
 </article>;
}
export default function StemReportPreview({report,onClose}:{report:Report;onClose:()=>void}){
 const {t}=useTranslation();const [bank,setBank]=useState(report.showWordBank),[error,setError]=useState('');const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>()=>document.body.classList.remove('stem-printing'),[]);
 async function print(){
  setError('');await document.fonts.ready;const el=ref.current?.querySelector<HTMLElement>('[data-stem-report]');if(!el)return;
  const images=[...el.querySelectorAll('img')];await Promise.allSettled(images.map(im=>im.decode()));
  if(images.some(im=>!im.complete||!im.naturalWidth)){setError(t('stem.reportAssets'));return;}
  if(el.scrollHeight>el.clientHeight+2){setError(t('stem.reportTooLong'));return;}
  document.body.classList.add('stem-printing');window.addEventListener('afterprint',()=>document.body.classList.remove('stem-printing'),{once:true});window.print();
 }
 return createPortal(<><AccessibleDialog label={t('stem.reportPreview')} onClose={onClose}><div className="stem-report-dialog"><div className="stem-toolbar"><h2>{t('stem.reportPreview')}</h2><button onClick={onClose}>{t('stem.close')}</button></div><div className="stem-toolbar"><label><input type="checkbox" checked={bank} onChange={e=>setBank(e.target.checked)}/> {t('stem.wordBank')}</label><button className="stem-primary" onClick={()=>void print()}>{t('stem.print')}</button></div><p>{t('stem.reportFit')}</p>{error&&<p role="alert" className="stem-error">{error}</p>}<div ref={ref} className="stem-report-preview"><StemReportSheet report={report} showBank={bank}/></div></div></AccessibleDialog><div id="stem-print-root" aria-hidden="true"><StemReportSheet report={report} showBank={bank}/></div></>,document.body);
}
