import {useTranslation} from 'react-i18next';
export type TimerPlayMode='practice'|'ranked';
export default function TimerPlaySettings({mode,showTimer,onChange}:{mode:TimerPlayMode;showTimer:boolean;onChange:(patch:{mode?:TimerPlayMode;showTimer?:boolean})=>void}){
 const {t}=useTranslation();const button='min-h-11 rounded-xl border px-3 py-2 font-bold';
 return <fieldset className="my-3 space-y-3 rounded-xl border border-outline-variant bg-white p-4" data-timer-play-settings>
  <legend className="px-2 font-bold text-deep-navy">{t('gameTimer.playSettings')}</legend>
  <div className="flex flex-wrap gap-2">{(['practice','ranked'] as const).map(value=><button type="button" key={value} aria-pressed={mode===value} className={`${button} ${mode===value?'border-primary bg-primary !text-white':'border-outline-variant bg-white text-deep-navy'}`} onClick={()=>onChange({mode:value})}>{t(value==='practice'?'gameTimer.modePractice':'gameTimer.modeRanked')}</button>)}</div>
  <div className="flex flex-wrap gap-2">{[true,false].map(value=><button type="button" key={String(value)} aria-pressed={showTimer===value} className={`${button} ${showTimer===value?'border-primary bg-primary !text-white':'border-outline-variant bg-white text-deep-navy'}`} onClick={()=>onChange({showTimer:value})}>{t(value?'gameTimer.showTimerOn':'gameTimer.showTimerOff')}</button>)}</div>
 </fieldset>;
}
