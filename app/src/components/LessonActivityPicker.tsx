import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from './AccessibleDialog';
import { GROUP_ACTIVITIES, activityCategory, readRecentActivities, type ActivityCategory } from '../lib/lessonActivities';
import { BoardThemeChips } from './CanvasSlideEditor';
import { LessonActivityExample, type CanvasExample } from './LessonActivityExample';
import { materialSections, WORKSHEET_TAB_CATALOG } from '../lib/materialsCatalog';
import { GAME_BROWSE_GROUPS, gameBrowseGroups, type GameBrowseGroup } from '../lib/gameBrowse';
import { GAME_CATALOG } from '../lib/gameCatalog';
import { isNativeGameReady } from '../lib/gamePreparation';
import { useVideoClips } from '../lib/videoClips';
import { READY_STEM } from '../data/stemLessons';
import type { StemLesson } from '../lib/stemTypes';
import StemFrameView from './stem/StemFrameView';
import { prepareClassroomGame } from '../lib/gameWorkspace';
import type { GameContent } from '../lib/gameFromWords';
import type { FullCardItem, GameType, LessonSlide, PdfSlide, PhonicsBankEntry } from '../lib/types';
import type { BlockDef } from '../lib/blocks/types';
import '../styles/lesson-activity-picker.css';

const CATEGORIES:ActivityCategory[]=['recent','learn','games','media','print','free'];
const ICONS=['history','menu_book','sports_esports','perm_media','description','edit_square'];
const INFO:Record<string,string>={'helper.textbox':'infoTextbox','helper.picture':'infoPicture','helper.annotation':'infoAnnotation','helper.points':'infoPoints'};
const ALIASES:Record<string,string>={
 'learn.shadow':'따라 말하기 쉐도잉 shadowing speak repeat', 'media.video':'유튜브 링크 youtube video 영상',
 'media.image':'이미지 업로드 그림 사진 image upload', 'media.web':'웹페이지 캔바 이북 e-book ebook canva web',
 'media.pdf':'외부 문서 워크시트 읽기 자료 document pdf upload',
 'learn.reading.cloze':'빈칸 듣기 listening cloze', 'learn.reading.lines':'노래 지문 song reading',
 'free.canvas':'텍스트 글상자 그림 편집 title blank word cards 단어 카드',
};

export const worksheetCards: BlockDef[] = WORKSHEET_TAB_CATALOG.map(tab => ({
  id: `worksheet.${tab.tab}`, role: 'main', category: 'print', icon: tab.icon, uses: ['group'], status: 'ready',
  nameKey: `materials.worksheet.${tab.labelKey}`, slide: { kind: 'material', materialId: 'worksheet' },
}));
const activities = [...GROUP_ACTIVITIES, ...worksheetCards];
const gameGroups = new Map(GAME_CATALOG.map(game => [game.type, gameBrowseGroups(game)]));
const gameCards = activities.filter(block => activityCategory(block) === 'games');
const belongsToGameGroup = (block: BlockDef, group: GameBrowseGroup) => block.slide?.kind === 'phonicsGame'
  ? group === 'phonics' : !!block.slide?.gameType && !!gameGroups.get(block.slide.gameType)?.includes(group);
export const printSections = materialSections().map(section => ({
  ...section,
  blocks: section.items.flatMap(material => [
    ...GROUP_ACTIVITIES.filter(block => block.slide?.materialId === material.id),
    ...(material.id === 'worksheet' ? worksheetCards : []),
  ]),
}));
const canvasLayouts: CanvasExample[] = ['title', 'word', 'blank'];

export default function LessonActivityPicker({onPick,onPdf,onStem,onBundle,onClose,canAttachHelper,storageKey,cards,gameCards:sourceCards,selected,sourceName,sourceKind,entries,lessonName,academyId}:{
 onPick:(b:BlockDef,layout?:CanvasExample,theme?:string|null)=>void;onBundle:()=>void;onClose:()=>void;canAttachHelper:boolean;storageKey:string;
 cards:FullCardItem[];gameCards:FullCardItem[];selected:LessonSlide|null;sourceName:string;entries:PhonicsBankEntry[];lessonName:string;
 sourceKind:'word'|'sentence';academyId:string;onPdf:(asset:Omit<PdfSlide,'id'|'kind'>)=>void;
 onStem:(lesson:StemLesson)=>void;
}){
 const {t,i18n}=useTranslation(),ko=i18n.language.startsWith('ko');
 const [cat,setCat]=useState<ActivityCategory>('recent'),[query,setQuery]=useState('');
 const [gameGroup, setGameGroup] = useState<GameBrowseGroup | 'all'>('all');
 const [pdfBusy, setPdfBusy] = useState(false);
 const [pdfError, setPdfError] = useState('');
 const {clips}=useVideoClips();
 const [stemOpen,setStemOpen]=useState(false);
 const [stemPreview,setStemPreview]=useState<StemLesson|null>(null);
 const [stemPage,setStemPage]=useState(0);
 const pdfInput = useRef<HTMLInputElement>(null);
 const pdfButton = useRef<HTMLButtonElement>(null);
 const locked=useRef(false);
 const active = useRef(true);
 useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
 async function choosePdf(file: File) {
   if (locked.current) return;
   locked.current = true;
   setPdfBusy(true);
   setPdfError('');
   try {
     const { uploadLessonPdf } = await import('../lib/lessonPdf');
     const asset = await uploadLessonPdf(academyId, file);
     if (active.current) onPdf(asset);
   } catch (error) {
     if (active.current) {
       setPdfError(error instanceof Error && error.message.startsWith('lessonUx.') ? error.message : 'lessonUx.pdfUploadError');
       requestAnimationFrame(() => pdfButton.current?.focus());
     }
   } finally {
     if (active.current) { locked.current = false; setPdfBusy(false); }
   }
 }
 const [theme, setTheme] = useState<string | null>('green');
 const [preview, setPreview] = useState<{ block: BlockDef; layout?: CanvasExample } | null>(null);
 const previewOrigin = useRef<HTMLButtonElement | null>(null);
 const back = useRef<HTMLButtonElement>(null);
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
  cat==='recent'?ids.map(id=>activities.find(b=>b.id===id)).filter((b):b is BlockDef=>!!b):
  cat==='games'?gameCards.filter(block=>gameGroup==='all'||belongsToGameGroup(block,gameGroup)):
  cat==='print'?printSections.flatMap(section=>section.blocks):activities.filter(b=>activityCategory(b)===cat);
 const bundleShown=!q||`${t('lessonUx.bundle')} 단어장으로 단어 수업 word lesson set bundle`.toLocaleLowerCase().includes(q);
 const choose=(b:BlockDef,layout?:CanvasExample)=>{if(locked.current)return;if(b.id==='media.pdf'){pdfInput.current?.click();return;}if(b.slide?.kind==='stem'){setStemOpen(true);return;}locked.current=true;onPick(b,layout,theme);};
 const canvasTitle = lessonName.trim() || t('lessonUx.sampleTitle');
 const selectedName = sourceName || t('lessonUx.linked');
 const canvasVisible = shown.some(b => b.id === 'free.canvas');
 const gameExamples = useMemo(() => new Map<GameType,GameContent | null>(), [sourceCards, sourceKind]);
 function exampleGame(type?: GameType) {
   if (!type) return null;
   if (type === 'wordtrain' && sourceKind !== 'sentence') return null;
   if (!gameExamples.has(type)) {
     const content = prepareClassroomGame(type, sourceCards, sourceKind);
     gameExamples.set(type, content && isNativeGameReady({game_type:type, items:content.items, config:content.config ?? {}}) ? content : null);
   }
   return gameExamples.get(type) ?? null;
 }
 const example = (block: BlockDef, layout?: CanvasExample, large = false) => <LessonActivityExample
   block={block} cards={block.slide?.gameType ? sourceCards : cards} sourceKind={sourceKind} prepared={exampleGame(block.slide?.gameType)} selected={selected} entries={entries} layout={layout} theme={theme} title={canvasTitle} large={large} sampleVideo={clips?.[0]} />;
 useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[]);
 return <AccessibleDialog label={t('lessonUx.add')} onClose={pdfBusy ? () => {} : stemPreview ? ()=>setStemPreview(null) : stemOpen ? ()=>setStemOpen(false) : preview ? closePreview : onClose}>
  <div className="lesson-activity-picker">
   <header><div><h2>{t('lessonUx.add')}</h2><button type="button" disabled={pdfBusy} onClick={onClose} aria-label={t('lessonUx.close')}><span className="material-symbols-outlined" aria-hidden>close</span></button></div>
    <label className="activity-search"><span className="material-symbols-outlined" aria-hidden>search</span><input autoFocus value={query} onChange={e=>{setQuery(e.target.value);setPreview(null);setStemOpen(false);setStemPreview(null);}} placeholder={t('lessonUx.search')} aria-label={t('lessonUx.search')}/></label>
    {cards.length > 0 && <p className="activity-source"><span className="material-symbols-outlined" aria-hidden>menu_book</span>{selectedName} · {t(sourceKind === 'sentence' ? 'lessonUx.sentenceCount' : 'curriculum.slides.previewWordCount', { count: cards.length })}</p>}
   </header>
   <div className="activity-body">
    <nav aria-label={t('lessonUx.add')}>{CATEGORIES.map((c,i)=><button key={c} type="button" aria-pressed={cat===c&&!q} onClick={()=>{if(cat!==c)setGameGroup('all');setCat(c);setQuery('');setPreview(null);setStemOpen(false);setStemPreview(null);}}><span className="material-symbols-outlined" aria-hidden>{ICONS[i]}</span>{t('lessonUx.'+c)}</button>)}</nav>
    <section ref={listRef} className="activity-list" tabIndex={0} aria-label={t('lessonUx.chooseActivity')}>
     <h3>{t('lessonUx.'+(q?'results':cat==='recent'&&!recent.length?'defaults':cat))}</h3>
     <p className="activity-caption">{t(q?'lessonUx.allSearch':'lessonUx.chooseActivity')}</p>
     {pdfBusy && <p role="status">{t('lessonUx.pdfUploading')}</p>}
     {pdfError && <p role="alert" className="text-error">{t(pdfError)}</p>}
     {!shown.length&&!bundleShown&&<p>{t('lessonUx.empty')}</p>}
     <div hidden={!!preview||stemOpen}>
     {!q && cat==='games' && <div className="activity-game-filters" role="group" aria-label={t('lessonUx.games')}>
       {(['all', ...GAME_BROWSE_GROUPS] as const).map(group => <button key={group} type="button" aria-pressed={group===gameGroup}
         onClick={()=>setGameGroup(group)}>{t(group==='all'?'gameCategory.all':`gameBrowse.${group}`)} {group==='all'?gameCards.length:gameCards.filter(block=>belongsToGameGroup(block,group)).length}</button>)}
     </div>}
     {canvasVisible && <div className="mb-3">
       <BoardThemeChips value={theme} onChange={value => setTheme(value?.id ?? null)} />
     </div>}
     {(!q && cat==='print' ? printSections : [{key:'all', blocks:shown}]).map(section => <section key={section.key}>
     {section.key!=='all' && <h4 className="my-3 font-bold">{t(`materials.group_${section.key}`)}</h4>}
     <div className="activity-grid">{section.blocks.flatMap(block => (block.id === 'free.canvas' ? canvasLayouts : [undefined]).map(layout => {
       const info = INFO[block.id];
       const helper = block.category === 'helper';
       const disabled = !!info || (helper && !canAttachHelper);
       const label = layout ? t(`curriculum.canvas.layout_${layout}`) : name(block);
       const description = info ? t('curriculum.library.' + info)
         : helper ? t(canAttachHelper ? 'curriculum.library.helperHint' : 'lessonUx.needSlide')
         : block.descriptionKey ? t(block.descriptionKey) : undefined;
       return <article className="activity-card" key={block.id + (layout ?? '')}>
         <button ref={block.id==='media.pdf'?pdfButton:undefined} type="button" className="activity-card-main" data-activity-id={block.id} data-canvas-layout={layout}
           aria-label={label} disabled={disabled || pdfBusy} onClick={() => choose(block,layout)}>
           <span className="activity-card-label"><span className="material-symbols-outlined activity-icon" aria-hidden>{block.icon}</span><strong>{label}</strong></span>
           {!helper && example(block, layout)}
           {description && <small className="activity-description">{description}</small>}
         </button>
         {!helper && block.id!=='media.pdf' && <button type="button" className="activity-preview-button" aria-label={t('lessonUx.previewActivity', { name: label })}
           onClick={event => { previewOrigin.current=event.currentTarget;if(block.slide?.kind==='stem')setStemOpen(true);else setPreview({block,layout}); }}>
           {t('lessonUx.preview')}
         </button>}
       </article>;
     }))}</div></section>)}
     </div>
     {stemOpen && <div className="activity-expanded">
       <button type="button" className="activity-preview-button" onClick={()=>stemPreview?setStemPreview(null):setStemOpen(false)}>← {t(stemPreview?'stem.ready':'lessonUx.backToActivities')}</button>
       {stemPreview ? <>
         <h3>{stemPreview.meta.title}</h3>
         <StemFrameView key={stemPreview.frames[stemPage].id} frame={stemPreview.frames[stemPage]} meta={stemPreview.meta} interactive={false}/>
         <div className="my-3 flex items-center justify-center gap-4">
           <button type="button" disabled={stemPage===0} onClick={()=>setStemPage(stemPage-1)}>{t('stem.previous')}</button>
           <span aria-live="polite">{stemPage+1} / {stemPreview.frames.length}</span>
           <button type="button" disabled={stemPage+1===stemPreview.frames.length} onClick={()=>setStemPage(stemPage+1)}>{t('stem.next')}</button>
         </div>
         <button type="button" className="rounded-lg bg-primary px-4 py-2 text-white" onClick={()=>{if(!locked.current){locked.current=true;onStem(stemPreview);}}}>{t('stem.addLesson')}</button>
       </> : <div className="activity-grid">{READY_STEM.map(lesson=><article className="activity-card p-3" key={lesson.meta.sourceId}>
         <img className="aspect-video w-full rounded-lg object-cover" src={lesson.frames.find(frame=>frame.imageUrl)?.imageUrl??'/ui2/m-paper.webp'} alt=""/>
         <h4 className="mt-2 font-bold">{lesson.meta.title}</h4><p>{lesson.meta.description}</p>
         <p className="text-sm">{lesson.meta.grade} · {lesson.meta.level}</p>
         <p className="text-sm">{t('stem.minutes',{count:lesson.meta.duration})} · {t('stem.slides',{count:lesson.frames.length})} · {t(lesson.frames.some(frame=>frame.mode==='report')?'stem.report':'stem.noReport')}</p>
         <button type="button" className="activity-preview-button" onClick={()=>{setStemPage(0);setStemPreview(lesson);}}>{t('stem.preview')}</button>
       </article>)}</div>}
     </div>}
     <input ref={pdfInput} type="file" accept="application/pdf,.pdf" aria-label={t('lessonUx.pdfSelect')} hidden
       onChange={event => { const file=event.target.files?.[0];event.target.value='';if(file)void choosePdf(file); }}/>
     {preview && <div className="activity-expanded">
       <button ref={back} type="button" className="activity-preview-button" onClick={closePreview}>← {t('lessonUx.backToActivities')}</button>
       <h3>{preview.layout ? t(`curriculum.canvas.layout_${preview.layout}`) : name(preview.block)}</h3>
       {example(preview.block, preview.layout, true)}
     </div>}
     {!preview&&!stemOpen&&((q&&bundleShown)||(!q&&cat==='recent'&&recent.includes('wordset')))&&<button type="button" className="activity-bundle" onClick={()=>{if(!locked.current){locked.current=true;onBundle();}}}>{t('lessonUx.bundle')} · {t('lessonUx.bundleCount')}</button>}
    </section>
   </div>
   <footer><span className="material-symbols-outlined" aria-hidden>stacks</span><div><strong>{t('lessonUx.bundle')}</strong><small>{t('lessonUx.bundleFlow')}</small></div><span>{t('lessonUx.bundleCount')}</span><button type="button" onClick={()=>{if(!locked.current){locked.current=true;onBundle();}}}>{t('lessonUx.configure')}</button></footer>
  </div>
 </AccessibleDialog>;
}
