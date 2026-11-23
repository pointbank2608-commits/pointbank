import {useState, type PointerEvent} from 'react';
import {useTranslation} from 'react-i18next';
import '../styles/animation-word-scene.css';

type Props = {
  sceneTime:number;
  times:number[];
  onScene:(time:number)=>void;
  onReveal:()=>void;
  onList:()=>void;
  onClose:()=>void;
};

export default function AnimationScenePeek({sceneTime,times,onScene,onReveal,onList,onClose}:Props) {
  const {t}=useTranslation();
  const [revealed,setRevealed]=useState(false);
  const next=times.find(time=>time>sceneTime);
  function light(event:PointerEvent<HTMLDivElement>) {
    const mask=event.currentTarget;
    const rect=mask.getBoundingClientRect();
    mask.style.setProperty('--light-x', (event.clientX-rect.left)+'px');
    mask.style.setProperty('--light-y', (event.clientY-rect.top)+'px');
    mask.dataset.lit='true';
  }
  function advance() {
    if (!revealed) {
      onReveal();
      setRevealed(true);
    } else if (next!==undefined) {
      onScene(next);
      setRevealed(false);
    } else onList();
  }
  return <section className="episode-scene-peek" aria-label={t('episodeActivities.scene')}>
    {!revealed&&<div className="episode-scene-mask" onPointerEnter={light} onPointerMove={light} onPointerDown={light}
      onPointerLeave={event=>{delete event.currentTarget.dataset.lit;}} onPointerCancel={event=>{delete event.currentTarget.dataset.lit;}}/>}
    <button className="episode-overlay-close" onClick={onClose}>× {t('episodeActivities.close')}</button>
    <button className="episode-scene-action" onClick={advance}>
      {t(!revealed?'episodeActivities.showScene':next!==undefined?'episodeActivities.nextScene':'episodeActivities.list')}
    </button>
  </section>;
}
