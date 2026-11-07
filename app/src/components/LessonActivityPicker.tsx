import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from './AccessibleDialog';
import { GROUP_ACTIVITIES, activityCategory, readRecentActivities, type ActivityCategory } from '../lib/lessonActivities';
import { BoardThemeChips } from './CanvasSlideEditor';
import { LessonActivityExample, type CanvasExample } from './LessonActivityExample';
import { WORKSHEET_TAB_CATALOG } from '../lib/materialsCatalog';
import type { FullCardItem, LessonSlide, PhonicsBankEntry } from '../lib/types';
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

const worksheetCards: BlockDef[] = WORKSHEET_TAB_CATALOG.map(tab => ({
  id: `worksheet.${tab.tab}`, role: 'main', category: 'print', icon: tab.icon, uses: ['group'], status: 'ready',
  nameKey: `materials.worksheet.${tab.labelKey}`, slide: { kind: 'material', materialId: 'worksheet' },
}));
const activities = [...GROUP_ACTIVITIES, ...worksheetCards];
const canvasLayouts: CanvasExample[] = ['title', 'word', 'blank'];

export default function LessonActivityPicker({onPick,onBundle,onClose,canAttachHelper,storageKey,cards,selected,sourceName,sourceKind,entries,lessonName}:{
 onPick:(b:BlockDef,layout?:CanvasExample,theme?:string|null)=>void;onBundle:()=>void;onClose:()=>void;canAttachHelper:boolean;storageKey:string;
 cards:FullCardItem[];selected:LessonSlide|null;sourceName:string;entries:PhonicsBankEntry[];lessonName:string;
 sourceKind:'word'|'sentence';
}){
 const {t,i18n}=useTranslation(),ko=i18n.language.startsWith('ko');
 const [cat,setCat]=useState<ActivityCategory>('recent'),[query,setQuery]=useState('');
 const [theme, setTheme] = useState<string | null>('green');
 const [preview, setPreview] = useState<{ block: BlockDef; layout?: CanvasExample } | null>(null);
 const previewOrigin = useRef<HTMLButtonElement | null>(null);
 const back = useRef<HTMLButtonElement>(null);
 const locked=useRef(false);
 const closePreview = () => {
   setPreview(null);
   requestAnimationFrame(() => previewOrigin.current?.focus());
 };
 useEffect(() => { if (preview) back.current?.focus(); }, [preview]);
 const listRef=useRef<HTMLElement>(null);
 useEffect(()=>{if(listRef.current)listRef.current.scrollTop=0;},[cat,query,preview]);
 const recent=useMemo(()=>readRecentActivities(storageKey).filter(id=>id==='wordset'||activities.some(b=>b.id===id)),[storageKey]);
 const name=(b:BlockDef)=>b.id==='learn.shadow'?t('lessonUx.shadow'):b.nameKey?t(b.nameKey):b.name?.[ko?'ko':'en']??b.id;
 const q=query.trim().toLocaleLowerCase();
 const defaults=['learn.wordShow','learn.study','learn.shadow','practice.quiz','game.matchup','media.video','free.canvas','learn.stem'];
 const ids=recent.length?recent:defaults;
 const shown=q?activities.filter(b=>`${name(b)} ${b.name?.ko??''} ${b.name?.en??''} ${ALIASES[b.id]??''} ${t('lessonUx.'+activityCategory(b))}`.toLocaleLowerCase().includes(q)):
  cat==='recent'?ids.map(id=>activities.find(b=>b.id===id)).filter((b):b is BlockDef=>!!b):activities.filter(b=>activityCategory(b)===cat);
 const bundleShown=!q||`${t('lessonUx.bundle')} 단어장으로 단어 수업 word lesson set bundle`.toLocaleLowerCase().includes(q);
 const choose=(b:BlockDef,layout?:CanvasExample)=>{if(locked.current)return;locked.current=true;onPick(b,layout,theme);};
 const canvasTitle = lessonName.trim() || t('lessonUx.sampleTitle');
 const selectedName = sourceName || t('lessonUx.linked');
 const canvasVisible = shown.some(b => b.id === 'free.canvas');
 const example = (block: BlockDef, layout?: CanvasExample, large = false) => <LessonActivityExample
   block={block} cards={cards} sourceKind={sourceKind} selected={selected} entries={entries} layout={layout} theme={theme} title={canvasTitle} large={large} />;
 useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[]);
 return <AccessibleDialog label={t('lessonUx.add')} onClose={preview ? closePreview : onClose}>
  <div className="lesson-activity-picker">
   <header><div><h2>{t('lessonUx.add')}</h2><button type="button" onClick={onClose} aria-label={t('lessonUx.close')}><span className="material-symbols-outlined" aria-hidden>close</span></button></div>
    <label className="activity-search"><span className="material-symbols-outlined" aria-hidden>search</span><input autoFocus value={query} onChange={e=>{setQuery(e.target.value);setPreview(null);}} placeholder={t('lessonUx.search')} aria-label={t('lessonUx.search')}/></label>
    {cards.length > 0 && <p className="activity-source"><span className="material-symbols-outlined" aria-hidden>menu_book</span>{selectedName} · {t(sourceKind === 'sentence' ? 'lessonUx.sentenceCount' : 'curriculum.slides.previewWordCount', { count: cards.length })}</p>}
   </header>
   <div className="activity-body">
    <nav aria-label={t('lessonUx.add')}>{CATEGORIES.map((c,i)=><button key={c} type="button" aria-pressed={cat===c&&!q} onClick={()=>{setCat(c);setQuery('');setPreview(null);}}><span className="material-symbols-outlined" aria-hidden>{ICONS[i]}</span>{t('lessonUx.'+c)}</button>)}</nav>
    <section ref={listRef} className="activity-list" tabIndex={0} aria-label={t('lessonUx.chooseActivity')}>
     <h3>{t('lessonUx.'+(q?'results':cat==='recent'&&!recent.length?'defaults':cat))}</h3>
     <p className="activity-caption">{t(q?'lessonUx.allSearch':'lessonUx.chooseActivity')}</p>
     {!shown.length&&!bundleShown&&<p>{t('lessonUx.empty')}</p>}
     <div hidden={!!preview}>
     {canvasVisible && <div className="mb-3">
       <BoardThemeChips value={theme} onChange={value => setTheme(value?.id ?? null)} />
     </div>}
     <div className="activity-grid">{shown.flatMap(block => (block.id === 'free.canvas' ? canvasLayouts : [undefined]).map(layout => {
       const info = INFO[block.id];
       const helper = block.category === 'helper';
       const disabled = !!info || (helper && !canAttachHelper);
       const label = layout ? t(`curriculum.canvas.layout_${layout}`) : name(block);
       const description = info ? t('curriculum.library.' + info)
         : helper ? t(canAttachHelper ? 'curriculum.library.helperHint' : 'lessonUx.needSlide')
         : block.descriptionKey ? t(block.descriptionKey) : undefined;
       return <article className="activity-card" key={block.id + (layout ?? '')}>
         <button type="button" className="activity-card-main" data-activity-id={block.id} data-canvas-layout={layout}
           aria-label={label} disabled={disabled} onClick={() => choose(block,layout)}>
           <span className="activity-card-label"><span className="material-symbols-outlined activity-icon" aria-hidden>{block.icon}</span><strong>{label}</strong></span>
           {!helper && example(block, layout)}
           {description && <small className="activity-description">{description}</small>}
         </button>
         {!helper && <button type="button" className="activity-preview-button" aria-label={t('lessonUx.previewActivity', { name: label })}
           onClick={event => { previewOrigin.current=event.currentTarget;setPreview({block,layout}); }}>
           {t('lessonUx.preview')}
         </button>}
       </article>;
     }))}</div>
     </div>
     {preview && <div className="activity-expanded">
       <button ref={back} type="button" className="activity-preview-button" onClick={closePreview}>← {t('lessonUx.backToActivities')}</button>
       <h3>{preview.layout ? t(`curriculum.canvas.layout_${preview.layout}`) : name(preview.block)}</h3>
       {example(preview.block, preview.layout, true)}
     </div>}
     {!preview&&((q&&bundleShown)||(!q&&cat==='recent'&&recent.includes('wordset')))&&<button type="button" className="activity-bundle" onClick={()=>{if(!locked.current){locked.current=true;onBundle();}}}>{t('lessonUx.bundle')} · {t('lessonUx.bundleCount')}</button>}
    </section>
   </div>
   <footer><span className="material-symbols-outlined" aria-hidden>stacks</span><div><strong>{t('lessonUx.bundle')}</strong><small>{t('lessonUx.bundleFlow')}</small></div><span>{t('lessonUx.bundleCount')}</span><button type="button" onClick={()=>{if(!locked.current){locked.current=true;onBundle();}}}>{t('lessonUx.configure')}</button></footer>
  </div>
 </AccessibleDialog>;
}
