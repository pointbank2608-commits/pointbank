import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from './AccessibleDialog';
import { GROUP_ACTIVITIES, activityCategory, readRecentActivities, type ActivityCategory } from '../lib/lessonActivities';
import type { BlockDef } from '../lib/blocks/types';
import '../styles/lesson-activity-picker.css';

const CATEGORIES:ActivityCategory[]=['recent','learn','games','media','print','free'];
const ICONS=['history','menu_book','sports_esports','perm_media','description','edit_square'];
const INFO:Record<string,string>={'helper.textbox':'infoTextbox','helper.picture':'infoPicture','helper.annotation':'infoAnnotation','helper.points':'infoPoints'};
const ALIASES:Record<string,string>={
 'learn.shadow':'따라 말하기 쉐도잉 shadowing speak repeat', 'media.video':'유튜브 링크 youtube video 영상',
 'media.image':'이미지 업로드 그림 사진 image upload', 'media.web':'웹페이지 캔바 이북 e-book ebook canva web',
 'learn.reading.cloze':'빈칸 듣기 listening cloze', 'learn.reading.lines':'노래 지문 song reading',
 'free.canvas':'텍스트 글상자 그림 편집 title blank word cards 단어 카드',
};

export default function LessonActivityPicker({onPick,onBundle,onClose,canAttachHelper,storageKey}:{
 onPick:(b:BlockDef)=>void;onBundle:()=>void;onClose:()=>void;canAttachHelper:boolean;storageKey:string;
}){
 const {t,i18n}=useTranslation(),ko=i18n.language.startsWith('ko');
 const [cat,setCat]=useState<ActivityCategory>('recent'),[query,setQuery]=useState('');
 const locked=useRef(false);
 const listRef=useRef<HTMLElement>(null);
 useEffect(()=>{if(listRef.current)listRef.current.scrollTop=0;},[cat,query]);
 const recent=useMemo(()=>readRecentActivities(storageKey).filter(id=>id==='wordset'||GROUP_ACTIVITIES.some(b=>b.id===id)),[storageKey]);
 const name=(b:BlockDef)=>b.id==='learn.shadow'?t('lessonUx.shadow'):b.nameKey?t(b.nameKey):b.name?.[ko?'ko':'en']??b.id;
 const q=query.trim().toLocaleLowerCase();
 const defaults=['learn.wordShow','learn.study','learn.shadow','practice.quiz','game.matchup','media.video','free.canvas','learn.stem'];
 const ids=recent.length?recent:defaults;
 const shown=q?GROUP_ACTIVITIES.filter(b=>`${name(b)} ${b.name?.ko??''} ${b.name?.en??''} ${ALIASES[b.id]??''} ${t('lessonUx.'+activityCategory(b))}`.toLocaleLowerCase().includes(q)):
  cat==='recent'?ids.map(id=>GROUP_ACTIVITIES.find(b=>b.id===id)).filter((b):b is BlockDef=>!!b):GROUP_ACTIVITIES.filter(b=>activityCategory(b)===cat);
 const bundleShown=!q||`${t('lessonUx.bundle')} 단어장으로 단어 수업 word lesson set bundle`.toLocaleLowerCase().includes(q);
 const choose=(b:BlockDef)=>{if(locked.current)return;locked.current=true;onPick(b);};
 useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[]);
 return <AccessibleDialog label={t('lessonUx.add')} onClose={onClose}>
  <div className="lesson-activity-picker">
   <header><div><h2>{t('lessonUx.add')}</h2><button type="button" onClick={onClose} aria-label={t('lessonUx.close')}><span className="material-symbols-outlined" aria-hidden>close</span></button></div>
    <label className="activity-search"><span className="material-symbols-outlined" aria-hidden>search</span><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('lessonUx.search')} aria-label={t('lessonUx.search')}/></label>
   </header>
   <div className="activity-body">
    <nav aria-label={t('lessonUx.add')}>{CATEGORIES.map((c,i)=><button key={c} type="button" aria-pressed={cat===c&&!q} onClick={()=>{setCat(c);setQuery('');}}><span className="material-symbols-outlined" aria-hidden>{ICONS[i]}</span>{t('lessonUx.'+c)}</button>)}</nav>
    <section ref={listRef} className="activity-list" tabIndex={0} aria-label={t('lessonUx.chooseActivity')}>
     <h3>{t('lessonUx.'+(q?'results':cat==='recent'&&!recent.length?'defaults':cat))}</h3>
     <p className="activity-caption">{t(q?'lessonUx.allSearch':'lessonUx.chooseActivity')}</p>
     {!shown.length&&!bundleShown&&<p>{t('lessonUx.empty')}</p>}
     <div className="activity-grid">{shown.map(b=>{
      const info=INFO[b.id];const helper=b.category==='helper';const disabled=!!info||(helper&&!canAttachHelper);
      return <button type="button" key={b.id} data-activity-id={b.id} disabled={disabled} onClick={()=>choose(b)}>
       <span className="material-symbols-outlined activity-icon" aria-hidden>{b.icon}</span><span><strong>{name(b)}</strong>
       {info?<small>{t('curriculum.library.'+info)}</small>:helper?<small>{t(canAttachHelper?'curriculum.library.helperHint':'lessonUx.needSlide')}</small>:b.needs?.words&&b.needs.words.min>1&&b.needs.words.min<=30?<small>{t('curriculum.library.needWords',{n:b.needs.words.min})}</small>:null}
       </span>
      </button>;
     })}</div>
     {((q&&bundleShown)||(!q&&cat==='recent'&&recent.includes('wordset')))&&<button type="button" className="activity-bundle" onClick={()=>{if(!locked.current){locked.current=true;onBundle();}}}>{t('lessonUx.bundle')} · {t('lessonUx.bundleCount')}</button>}
    </section>
   </div>
   <footer><span className="material-symbols-outlined" aria-hidden>stacks</span><div><strong>{t('lessonUx.bundle')}</strong><small>{t('lessonUx.bundleFlow')}</small></div><span>{t('lessonUx.bundleCount')}</span><button type="button" onClick={()=>{if(!locked.current){locked.current=true;onBundle();}}}>{t('lessonUx.configure')}</button></footer>
  </div>
 </AccessibleDialog>;
}
