import '../styles/episode-activities.css';
import type {ReactNode} from 'react';
import {useTranslation} from 'react-i18next';

type Props={
  title:string; label:string; onClose:()=>void; children:ReactNode;
  headerActions?:ReactNode; layout?:'pass'|'missing-setup';
  progress?:string; onList?:()=>void; footer?:ReactNode;
};
export default function AnimationActivityWindow({title,label,onClose,children,headerActions,layout,progress,onList,footer}:Props){
 const {t}=useTranslation();
 return <div className="animation-window-anchor"><section className="animation-activity-window" aria-label={label} data-layout={layout}>
  <header>{onList&&<button className="episode-list-back" onClick={onList} aria-label={t('episodeActivities.list')} title={t('episodeActivities.list')}>←</button>}
   <h2>{title}</h2>{headerActions}{progress&&<span className="episode-progress" aria-live="polite">{progress}</span>}
   <button className="animation-close" onClick={onClose}>× {t('episodeActivities.close')}</button></header>
  <div className="animation-window-body">{children}</div>
  {footer&&<footer className="episode-activity-footer">{footer}</footer>}
 </section></div>;
}
