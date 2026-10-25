import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exampleWorksheet } from '../../lib/worksheetActivitySamples';
import type { WorksheetDocument } from '../../lib/worksheetStudio';
import WorksheetActivitySheets from './WorksheetActivitySheets';

/** Read-only examples. Opening or changing audience never touches the teacher's saved work. */
export default function WorksheetSampleDialog({ activityId, onClose, onUse }: {
  activityId:string; onClose:()=>void; onUse:(doc:WorksheetDocument)=>'storageLimit'|'saveFailed'|null;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null), viewport = useRef<HTMLDivElement>(null), sheets = useRef<HTMLDivElement>(null);
  const doc = useMemo(()=>exampleWorksheet(activityId),[activityId]);
  const [audience,setAudience] = useState<'student'|'teacher'>('student');
  const [scale,setScale] = useState(1),[pages,setPages] = useState(0);
  const [startError,setStartError] = useState<'storageLimit'|'saveFailed'|null>(null);
  const landscape = activityId==='basic-miniBook' && audience==='student';
  const title = t(`worksheetStudio.activities.${activityId}.title`);
  useEffect(()=>{
    const el=dialog.current!,trigger=document.activeElement;el.showModal();
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    return ()=>{document.body.style.overflow=previous;if(el.open)el.close();if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus({preventScroll:true});};
  },[]);
  useLayoutEffect(()=>{
    const el=viewport.current;if(!el)return;
    const resize=()=>{const css=getComputedStyle(el);const width=el.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight);setScale(Math.min(1,width/(landscape?1063:704)));};
    resize();const observer=new ResizeObserver(resize);observer.observe(el);
    setPages(sheets.current?.querySelectorAll('.print-board').length||0);
    el.scrollTop=0;
    return ()=>observer.disconnect();
  },[landscape,audience,activityId]);
  return <dialog ref={dialog} className="ws-sample-dialog worksheet-studio no-print" aria-labelledby="ws-sample-title" onCancel={e=>{e.preventDefault();onClose();}} onKeyDown={e=>{
    if(e.key!=='Tab')return;
    const targets=[...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
    if(!targets.length)return;e.preventDefault();
    const index=targets.indexOf(document.activeElement as HTMLElement);
    targets[(index+(e.shiftKey?-1:1)+targets.length)%targets.length].focus();
  }}>
    <header className="ws-sample-header">
      <div><span className="ws-purpose-label">{t('worksheetStudio.samplePreview')}</span><h2 id="ws-sample-title">{title}</h2></div>
      <button type="button" className="ws-button" onClick={onClose}>{t('worksheetStudio.closeSample')}</button>
    </header>
    <div className="ws-sample-intro"><p>{t(`worksheetStudio.activities.${activityId}.goal`)}</p><p>{t('worksheetStudio.samplePreviewHint')}</p>
      <p className="ws-tip"><strong>{t('worksheetStudio.tip')}: </strong>{t(`worksheetStudio.activities.${activityId}.tip`)}</p>
    </div>
    <div className="ws-sample-toolbar"><div className="ws-actions">
      <button type="button" className="ws-button" aria-pressed={audience==='student'} onClick={()=>setAudience('student')}>{t('worksheetStudio.student')}</button>
      <button type="button" className="ws-button" aria-pressed={audience==='teacher'} onClick={()=>setAudience('teacher')}>{t('worksheetStudio.teacher')}</button>
    </div><span role="status">{t('worksheetStudio.sampleAllPages',{count:pages})}</span></div>
    <div ref={viewport} className="ws-sample-viewport" data-sample-audience={audience}>
      <div ref={sheets} className={`ws-preview-stack${landscape?' ws-landscape-stack':''}`} style={{zoom:scale}}>
        <WorksheetActivitySheets doc={doc} audience={audience}/>
      </div>
    </div>
    <footer className="ws-sample-footer"><div><p>{t('worksheetStudio.sampleKeepWork')}</p>{startError&&<p role="alert">{t(`worksheetStudio.${startError}`)}</p>}</div><button type="button" className="ws-button ws-primary" onClick={()=>setStartError(onUse(structuredClone(doc)))}>{t('worksheetStudio.useSample')}</button></footer>
  </dialog>;
}
