import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GrammarPickerPanel from './GrammarPickerPanel';
import MyGrammarLibrary from './MyGrammarLibrary';
import { AiGrammarCreateButton } from './AiGrammarCreator';
import type { GrammarPreset } from '../lib/myGrammar';
import AccessibleDialog from './AccessibleDialog';
import { GROUP_ACTIVITIES, activityCategory, readRecentActivities, type ActivityCategory } from '../lib/lessonActivities';
import { BoardThemeChips } from './CanvasSlideEditor';
import { activityMaterial, LessonActivityExample, type CanvasExample } from './LessonActivityExample';
import { workbookOfMaterial } from '../data/cvcWorkbook';
import { workbookStep } from './LessonPrintPreview';
import LessonWorkbookUnits, { type LessonWorkbookSelection } from './worksheets/LessonWorkbookUnits';
import { materialSections, WORKSHEET_TAB_CATALOG } from '../lib/materialsCatalog';
import { GAME_BROWSE_GROUPS, gameBrowseGroups, type GameBrowseGroup } from '../lib/gameBrowse';
import { GAME_CATALOG } from '../lib/gameCatalog';
import { useVideoClips } from '../lib/videoClips';
import { READY_STEM } from '../data/stemLessons';
import type { StemLesson } from '../lib/stemTypes';
import StemFrameView from './stem/StemFrameView';
import { resolveLessonGame, type lessonGameSources, type LessonGameMatch } from '../lib/lessonGameContent';
import { lessonPhonicsTopic, matchUnitForWords, phonicsSlideState } from '../lib/phonicsLessonGame';
import type { FullCardItem, GameType, LessonSlide, MaterialSlide, PdfSlide, PhonicsBankEntry } from '../lib/types';
import LessonWorksheetChooser from './worksheets/LessonWorksheetChooser';
import SightWordWorksheets from './worksheets/SightWordWorksheets';
import type { BlockDef } from '../lib/blocks/types';
import '../styles/lesson-activity-picker.css';

const CATEGORIES:ActivityCategory[]=['recent','learn','grammar','games','media','print','free'];
const ICONS=['history','menu_book','rule','sports_esports','perm_media','description','edit_square'];
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
const pptCard:BlockDef={id:'media.ppt',role:'main',category:'media',icon:'upload_file',uses:['group'],status:'ready',nameKey:'lessonPpt.title'};
const activities = [...GROUP_ACTIVITIES, ...worksheetCards, pptCard];
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
const printGroups = {
  words: ['words', 'elementary800'],
  phonics: ['phonics'],
  sightwords: [],
  other: ['gamecards', 'roleplay', 'other'],
} as const;
type PrintTab = keyof typeof printGroups;
export type ActivityWorksheetOptions = Pick<MaterialSlide, 'words' | 'topic' | 'worksheetTab'> & LessonWorkbookSelection;

function isWorkbook(block: BlockDef) {
  const materialId = block.slide?.materialId;
  return !!materialId && !!(workbookOfMaterial(materialId) || workbookStep(materialId));
}

export default function LessonActivityPicker({onPick,onGrammarPick,onVideo,onPdf,onSightWord,onPowerPoint,onStem,onBundle,onClose,canAttachHelper,storageKey,cards,gameSources,slides,replaceTargetId,insertAfterId,selected,sourceName,entries,lessonName,academyId}:{
 onGrammarPick:(grammarId:string, preset?: GrammarPreset)=>void;
 onPick:(b:BlockDef,layout?:CanvasExample,theme?:string|null, worksheet?:ActivityWorksheetOptions)=>void;onBundle:()=>void;onClose:()=>void;canAttachHelper:boolean;storageKey:string;
 cards:FullCardItem[];gameSources:ReturnType<typeof lessonGameSources>;slides:LessonSlide[];replaceTargetId:string|null;insertAfterId?:string|null;
 selected:LessonSlide|null;sourceName:string;entries:PhonicsBankEntry[];lessonName:string;
 academyId:string;onPdf:(asset:Omit<PdfSlide,'id'|'kind'>)=>void;
 onStem:(lesson:StemLesson)=>void; onPowerPoint?:()=>void;
 onSightWord:(url:string,title:string)=>void;
 onVideo?:(block:BlockDef,source:'provided'|'custom')=>void;
}){
 const {t,i18n}=useTranslation(),ko=i18n.language.startsWith('ko');
 const [cat,setCat]=useState<ActivityCategory>('recent'),[query,setQuery]=useState('');
 const [gameGroup, setGameGroup] = useState<GameBrowseGroup | 'all'>('all');
 const [printTab,setPrintTab] = useState<PrintTab>('words');
 const printTabSections = printGroups[printTab].flatMap(key=>printSections.filter(section=>section.key===key));
 const [pdfBusy, setPdfBusy] = useState(false);
 const [pdfError, setPdfError] = useState('');
 const {clips}=useVideoClips();
 const [stemOpen,setStemOpen]=useState(false);
 const [worksheetBlock,setWorksheetBlock]=useState<BlockDef|null>(null);
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
 const [myGrammar, setMyGrammar] = useState(false);
 const [grammarRevision, setGrammarRevision] = useState(0);
 const [preview, setPreview] = useState<{ block: BlockDef; layout?: CanvasExample; workbook?: MaterialSlide } | null>(null);
 const previewOrigin = useRef<HTMLButtonElement | null>(null);
 const back = useRef<HTMLButtonElement>(null);
 const openPreview = (block: BlockDef, layout: CanvasExample | undefined, trigger: HTMLButtonElement) => {
   previewOrigin.current = trigger;
   setPreview({block, layout, workbook: isWorkbook(block) ? activityMaterial(block, null) : undefined});
 };
 const closePreview = () => {
   setPreview(null);
   requestAnimationFrame(() => previewOrigin.current?.focus());
 };
 const previewId = preview?.block.id;
 useEffect(() => { if (previewId) back.current?.focus(); }, [previewId]);
 const listRef=useRef<HTMLElement>(null);
 useEffect(()=>{if(listRef.current)listRef.current.scrollTop=0;},[cat,query,previewId]);
 const recent=useMemo(()=>readRecentActivities(storageKey).filter(id=>id==='wordset'||activities.some(b=>b.id===id)),[storageKey]);
 const name=(b:BlockDef)=>b.id==='learn.shadow'?t('lessonUx.shadow'):b.nameKey?t(b.nameKey):b.name?.[ko?'ko':'en']??b.id;
 const grammarOpen = cat === 'grammar';
 const searchLabel = t(grammarOpen ? 'grammar.searchPlaceholder' : 'lessonUx.search');
 const q=query.trim().toLocaleLowerCase();
 const defaults=['learn.wordShow','learn.study','learn.shadow','practice.quiz','game.matchup','media.video','free.canvas','learn.stem'];
 const ids=recent.length?recent:defaults;
 const filtered=q?activities.filter(b=>`${name(b)} ${b.name?.ko??''} ${b.name?.en??''} ${ALIASES[b.id]??''} ${t('lessonUx.'+activityCategory(b))}`.toLocaleLowerCase().includes(q)):
  cat==='recent'?ids.map(id=>activities.find(b=>b.id===id)).filter((b):b is BlockDef=>!!b):
  cat==='games'?gameCards.filter(block=>gameGroup==='all'||belongsToGameGroup(block,gameGroup)):
  cat==='print'?printSections.flatMap(section=>section.blocks):activities.filter(b=>activityCategory(b)===cat);
 const bundleShown=!q||`${t('lessonUx.bundle')} 단어장으로 단어 수업 word lesson set bundle`.toLocaleLowerCase().includes(q);
 const choose=(b:BlockDef,layout?:CanvasExample)=>{if(locked.current)return;if(b.slide?.kind==='grammar'){setCat('grammar');setQuery('');setPreview(null);return;}if(b.id==='media.ppt'){onPowerPoint?.();return;}if(b.id==='media.pdf'){pdfInput.current?.click();return;}if(b.slide?.kind==='stem'){setStemOpen(true);return;}if(b.slide?.materialId==='library'||(b.slide?.materialId==='worksheet'&&!b.id.startsWith('worksheet.'))){setWorksheetBlock(b);return;}locked.current=true;onPick(b,layout,theme);};
 const canvasTitle = lessonName.trim() || t('lessonUx.sampleTitle');
 const selectedName = sourceName || t('lessonUx.linked');
 const after = insertAfterId ? slides.findIndex(slide => slide.id === insertAfterId) : -1;
 const insertionIndex = after < 0 ? slides.length : after + 1;
 const gameExamples = useMemo(() => {
   const matches = new Map<GameType, LessonGameMatch>();
   const replacing = slides.findIndex(slide => slide.id === replaceTargetId);
   for (const block of gameCards) {
     const gameType = block.slide?.gameType;
     if (!gameType || block.slide?.kind !== 'game') continue;
     const candidate = { id: 'activity-picker-preview', kind: 'game', gameType } as const;
     const playlist = [...slides];
     playlist.splice(replacing < 0 ? insertionIndex : replacing, replacing < 0 ? 0 : 1, candidate);
     matches.set(gameType, resolveLessonGame(candidate, playlist, gameSources));
   }
   return matches;
 }, [slides, replaceTargetId, insertionIndex, gameSources]);
 const gamePriority = (block: BlockDef) => {
   const match = block.slide?.gameType ? gameExamples.get(block.slide.gameType) : null;
   return !match?.content ? 2 : match.kind === 'builtin' ? 1 : 0;
 };
 const mediaOrder=['media.image','media.video','media.pdf','media.ppt','media.web','learn.shadow','learn.reading.cloze'];
 const shown = !q && cat === 'games' ? [...filtered].sort((a, b) => gamePriority(a) - gamePriority(b)) : !q&&cat==='media'?[...filtered].sort((a,b)=>mediaOrder.indexOf(a.id)-mediaOrder.indexOf(b.id)):filtered;
 const canvasVisible = shown.some(b => b.id === 'free.canvas');
 const phonicsMatches = useMemo(() => {
   const candidate = { id: 'phonics-activity-preview', kind: 'phonicsGame', gameId: '' } as const;
   const playlist = [...slides];
   const replacing = slides.findIndex(slide => slide.id === replaceTargetId);
   playlist.splice(replacing < 0 ? insertionIndex : replacing, replacing < 0 ? 0 : 1, candidate);
   const workbookTopic = lessonPhonicsTopic(playlist, candidate);
   const topic = workbookTopic === undefined ? matchUnitForWords(gameSources.cards) : workbookTopic;
   return new Map(gameCards.flatMap(block => {
     const id = block.slide?.phonicsGameId;
     return id ? [[id, phonicsSlideState(id, undefined, gameSources.cards, !ko, undefined, topic)] as const] : [];
   }));
 }, [slides, replaceTargetId, insertionIndex, gameSources.cards, ko]);
 const example = (block: BlockDef, layout?: CanvasExample, large = false, material: LessonSlide | null = selected) => <LessonActivityExample
   key={material?.kind === 'material' ? material.phonicsUnitIds?.join(',') : undefined}
   block={block} cards={cards} gameMatch={block.slide?.gameType ? gameExamples.get(block.slide.gameType) : undefined}
   phonicsMatch={block.slide?.phonicsGameId ? phonicsMatches.get(block.slide.phonicsGameId) : undefined}
   selected={material} entries={entries} layout={layout} theme={theme} title={canvasTitle} large={large} sampleVideo={clips?.[0]} />;
 const workbook = preview?.workbook;
 const workbookReady = !!workbook?.phonicsUnitIds?.length;
 useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[]);
 return <AccessibleDialog label={t('lessonUx.add')} onClose={pdfBusy ? () => {} : worksheetBlock ? ()=>setWorksheetBlock(null) : stemPreview ? ()=>setStemPreview(null) : stemOpen ? ()=>setStemOpen(false) : preview ? closePreview : onClose}>
  <div className="lesson-activity-picker">
   <header><div><h2>{t('lessonUx.add')}</h2><button type="button" disabled={pdfBusy} onClick={onClose} aria-label={t('lessonUx.close')}><span className="material-symbols-outlined" aria-hidden>close</span></button></div>
    <label className="activity-search"><span className="material-symbols-outlined" aria-hidden>search</span><input autoFocus value={query} onChange={e=>{setQuery(e.target.value);setPreview(null);setStemOpen(false);setStemPreview(null);}} placeholder={searchLabel} aria-label={searchLabel}/></label>
    {cards.length > 0 && <p className="activity-source"><span className="material-symbols-outlined" aria-hidden>menu_book</span>{selectedName} · {t(gameSources.kind === 'sentence' ? 'lessonUx.sentenceCount' : 'curriculum.slides.previewWordCount', { count: cards.length })}</p>}
   </header>
   <div className="activity-body">
    <nav aria-label={t('lessonUx.add')}>{CATEGORIES.map((c,i)=><button key={c} type="button" aria-pressed={cat===c&&(!q||grammarOpen)} onClick={()=>{if(cat!==c)setGameGroup('all');if(c==='print'&&(cat!==c||q))setPrintTab('words');setCat(c);setQuery('');setPreview(null);setStemOpen(false);setStemPreview(null);}}><span className="material-symbols-outlined" aria-hidden>{ICONS[i]}</span>{t('lessonUx.'+c)}</button>)}</nav>
    <section ref={listRef} className="activity-list" tabIndex={0} aria-label={t('lessonUx.chooseActivity')}>
     {grammarOpen ? <>
       <h3>{t('lessonUx.grammar')}</h3>
       <div className="mb-3 flex flex-wrap gap-2">
         {([false,true] as const).map(mine => <button key={String(mine)} type="button" aria-pressed={myGrammar === mine}
           className={`min-h-10 rounded-lg border px-3 font-bold ${myGrammar === mine ? 'bg-primary text-white' : 'bg-white text-primary'}`}
           onClick={() => setMyGrammar(mine)}>{t(mine ? 'myGrammar.import' : 'myGrammar.catalog')}</button>)}
         <AiGrammarCreateButton onSaved={() => {
           setQuery('');
           setMyGrammar(true);
           setGrammarRevision(n => n + 1);
         }} />
       </div>
       {myGrammar ? <MyGrammarLibrary key={grammarRevision} query={query} onPick={preset => {
         if (locked.current) return;
         locked.current = true;
         onGrammarPick(preset.grammarId, preset);
       }} /> : <GrammarPickerPanel searchQuery={query} onPick={grammarId => {
         if (locked.current) return;
         locked.current = true;
         onGrammarPick(grammarId);
       }} />}
     </> : <>
     <h3>{t('lessonUx.'+(q?'results':cat==='recent'&&!recent.length?'defaults':cat))}</h3>
     <p className="activity-caption">{t(q?'lessonUx.allSearch':'lessonUx.chooseActivity')}</p>
     {pdfBusy && <p role="status">{t('lessonUx.pdfUploading')}</p>}
     {pdfError && <p role="alert" className="text-error">{t(pdfError)}</p>}
     {!shown.length&&!bundleShown&&<p>{t('lessonUx.empty')}</p>}
     <div hidden={!!preview||stemOpen||!!worksheetBlock}>
     {!q && cat==='print' && <>
       <div className="activity-game-filters" role="group" aria-label={t('lessonUx.print')}>
         {(Object.keys(printGroups) as PrintTab[]).map(tab=><button type="button" key={tab} aria-pressed={printTab===tab}
           onClick={()=>setPrintTab(tab)}>{tab==='sightwords'?(ko?'사이트워드':'Sight words'):t(`materials.group_${tab}`)}</button>)}
       </div>
       {printTab==='sightwords'&&<SightWordWorksheets onAdd={(url,title)=>{if(!locked.current){locked.current=true;onSightWord(url,title);}}}/>}
     </>}
     {!q && cat==='games' && <div className="activity-game-filters" role="group" aria-label={t('lessonUx.games')}>
       {(['all', ...GAME_BROWSE_GROUPS] as const).map(group => <button key={group} type="button" aria-pressed={group===gameGroup}
         onClick={()=>setGameGroup(group)}>{t(group==='all'?'gameCategory.all':`gameBrowse.${group}`)} {group==='all'?gameCards.length:gameCards.filter(block=>belongsToGameGroup(block,group)).length}</button>)}
     </div>}
     {canvasVisible && <div className="mb-3">
       <BoardThemeChips value={theme} onChange={value => setTheme(value?.id ?? null)} />
     </div>}
     {(!q && cat==='print' ? printTabSections : [{key:'all', blocks:shown}]).map(section => <section key={section.key}>
     {section.key!=='all' && <h4 className="my-3 font-bold">{t(`materials.group_${section.key}`)}</h4>}
     <div className="activity-grid">{section.blocks.flatMap(block => (block.id === 'free.canvas' ? canvasLayouts : [undefined]).map(layout => {
       const videoActivity=['learn.shadow','learn.reading.cloze'].includes(block.id);
       if(videoActivity){const shadow=block.id==='learn.shadow';const label=shadow?(ko?'따라 말하기(쉐도잉)':'Shadowing'):(ko?'빈칸 듣기':'Listening cloze');return <article className="activity-card activity-video-card" key={block.id} data-activity-id={block.id}>
         <div className="activity-card-main"><span className="activity-card-label"><strong>{label}</strong></span><div className="video-activity-scene" aria-label={label+' 예시'}><span className="video-example-line">{shadow?'I like it.':'I ____ it.'}</span><span className="video-example-controls">▶ {ko?'재생':'Play'}　{shadow?'↻ '+(ko?'다시 듣기':'Replay'):'✓ '+(ko?'정답 보기':'Answer')}</span></div><small className="activity-description">{shadow?(ko?'영상 속 대사를 한 문장씩 듣고 따라 말해요.':'Listen and repeat each line from a video.'):(ko?'영상 속 문장을 듣고 빠진 단어를 맞혀요.':'Listen to a video and find the missing word.')}</small></div>
         <div className="video-activity-starts"><button type="button" className="video-activity-primary" onClick={()=>onVideo?onVideo(block,'provided'):choose(block)}>{ko?'준비된 영상으로 시작':'Start with a prepared video'}</button><button type="button" onClick={()=>onVideo?onVideo(block,'custom'):choose(block)}>{ko?'내 영상으로 만들기':'Use my video'}</button></div>
       </article>;}
       const info = INFO[block.id];
       const helper = block.category === 'helper';
       const disabled = !!info || (helper && !canAttachHelper);
       const label = layout ? t(`curriculum.canvas.layout_${layout}`) : name(block);
       const description = info ? t('curriculum.library.' + info)
         : helper ? t(canAttachHelper ? 'curriculum.library.helperHint' : 'lessonUx.needSlide')
         : block.descriptionKey ? t(block.descriptionKey) : undefined;
       return <article className="activity-card" key={block.id + (layout ?? '')}>
         <button ref={block.id==='media.pdf'?pdfButton:undefined} type="button" className="activity-card-main" data-activity-id={block.id} data-canvas-layout={layout}
           aria-label={label} disabled={disabled || pdfBusy} onClick={event => {
             if (isWorkbook(block)) openPreview(block,layout,event.currentTarget);
             else choose(block,layout);
           }}>
           <span className="activity-card-label"><span className="material-symbols-outlined activity-icon" aria-hidden>{block.icon}</span><strong>{label}</strong></span>
           {!helper && (block.id==='media.ppt'?<p>PowerPoint 파일에서 슬라이드를 가져와요.</p>:example(block, layout))}
           {description && <small className="activity-description">{description}</small>}
         </button>
         {!helper && !['media.pdf','media.ppt'].includes(block.id) && <button type="button" className="activity-preview-button" aria-label={t('lessonUx.previewActivity', { name: label })}
           onClick={event => {if(block.slide?.kind==='stem')setStemOpen(true);else openPreview(block,layout,event.currentTarget);}}>
           {t('lessonUx.preview')}
         </button>}
       </article>;
     }))}</div></section>)}
     </div>
     {worksheetBlock&&<div className="activity-expanded">
       <button type="button" className="activity-preview-button" onClick={()=>setWorksheetBlock(null)}>← {t('lessonUx.backToActivities')}</button>
       <h3>{name(worksheetBlock)}</h3>
       <LessonWorksheetChooser key={worksheetBlock.id} topicMode={worksheetBlock.slide?.materialId==='library'}
         academyId={academyId} lessonWords={gameSources.kind==='word'?cards:[]} onAdd={(worksheetTab,words,topic)=>{
           if(locked.current)return;
           locked.current=true;
           onPick(worksheetBlock,undefined,theme,{worksheetTab,words,topic});
         }}/>
     </div>}
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
       {workbook && <>
         <LessonWorkbookUnits slide={workbook} entries={entries} onUpdate={patch => {
           setPreview({...preview, workbook: {...workbook, ...patch}});
         }} />
         <div>
           <button type="button" className="rounded-lg bg-primary px-4 py-2 font-bold text-white disabled:bg-slate-200 disabled:text-slate-600"
             disabled={!workbookReady} onClick={() => {
               if (locked.current || !workbookReady) return;
               locked.current = true;
               onPick(preview.block, undefined, theme, {cvcUnits: workbook.cvcUnits, phonicsUnitIds: workbook.phonicsUnitIds});
             }}>{t('lessonUx.addWorksheet')}</button>
         </div>
       </>}
       {example(preview.block, preview.layout, true, workbook
         ? workbookReady ? workbook : activityMaterial(preview.block, null)
         : selected)}
     </div>}
     {!preview&&!stemOpen&&!worksheetBlock&&((q&&bundleShown)||(!q&&cat==='recent'&&recent.includes('wordset')))&&<button type="button" className="activity-bundle" onClick={()=>{if(!locked.current){locked.current=true;onBundle();}}}>{t('lessonUx.bundle')} · {t('lessonUx.bundleCount')}</button>}
     </>}
    </section>
   </div>
   {!grammarOpen && <footer><span className="material-symbols-outlined" aria-hidden>stacks</span><div><strong>{t('lessonUx.bundle')}</strong><small>{t('lessonUx.bundleFlow')}</small></div><span>{t('lessonUx.bundleCount')}</span><button type="button" onClick={()=>{if(!locked.current){locked.current=true;onBundle();}}}>{t('lessonUx.configure')}</button></footer>}
  </div>
 </AccessibleDialog>;
}
