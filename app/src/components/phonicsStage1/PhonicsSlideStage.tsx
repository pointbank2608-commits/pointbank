import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';

/** Fit the original 16:9 canvas inside both available dimensions. */
export default function PhonicsSlideStage({children,index,total,onMove}:{children:ReactNode;index:number;total:number;onMove:(index:number)=>void}){
 const {t}=useTranslation();const area=useRef<HTMLDivElement>(null);const [width,setWidth]=useState<number>();
 useEffect(()=>{const node=area.current;if(!node)return;const resize=new ResizeObserver(([entry])=>setWidth(Math.max(0,Math.min(entry.contentRect.width,entry.contentRect.height*16/9))));resize.observe(node);return()=>resize.disconnect();},[]);
 return <div className="pc-slide-stage">
  <button type="button" className="pc-side-arrow" aria-label={t('phonicsLesson.previous')} disabled={index<=0} onClick={()=>onMove(index-1)}>‹</button>
  <div ref={area} className="pc-stage-area"><div className="pc-stage-canvas" style={{width:width===undefined?'100%':width}}>{children}</div></div>
  <button type="button" className="pc-side-arrow" aria-label={t('phonicsLesson.next')} data-course-next disabled={index>=total-1} onClick={()=>onMove(index+1)}>›</button>
 </div>;
}
