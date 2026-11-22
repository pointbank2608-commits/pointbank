import {useMemo,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import PlainTeachingVideo,{type TeachingVideoControl} from '../PlainTeachingVideo';
import {episodeLessonDraft,type EpisodeMaterial} from '../../lib/animationEpisodes';
import {sourceTime} from '../../lib/animationSources';
import {VIDEO_LESSON_MINUTES} from '../../lib/caillouVideoCourse';
import {createSoloLesson} from '../../lib/soloApi';
import {createWordList} from '../../lib/api';
import {useToast} from '../../context/ToastContext';
import SoloCatalogModal from './SoloCatalogModal';
import type {EpisodeGroupSelection} from '../../lib/animationEpisodeGroup';
import {useNavigate} from 'react-router-dom';

export default function EpisodeLessonPanel({material,academyId,classId,teacherId,onBack,onSaved,onGroupLesson,onGroupPreview}:{material:EpisodeMaterial;academyId:string;classId:string|null;teacherId?:string;onBack:()=>void;onSaved?:()=>void;onGroupLesson?:(selection:EpisodeGroupSelection)=>void;onGroupPreview?:(selection:EpisodeGroupSelection)=>void}){
  const {t}=useTranslation();const {notify}=useToast();const navigate=useNavigate();const [worksheetError,setWorksheetError]=useState('');
  const {episode,source,chapters,words}=material;
  const [selectedChapters,setSelectedChapters]=useState(chapters.map((_,index)=>index));
  const [selectedWords,setSelectedWords]=useState(words.map(word=>word.id));
  const [scope,setScope]=useState<'episode'|'chapters'>('episode');
  const [wordChapter,setWordChapter]=useState(0);
  const [minutes,setMinutes]=useState<number>(onGroupLesson?30:10);
  const [configuring,setConfiguring]=useState(false);
  const [ready,setReady]=useState(false);
  const [now,setNow]=useState(episode.start);
  const [saving,setSaving]=useState(false);const saveLock=useRef(false);
  const control=useRef<TeachingVideoControl|null>(null);
  const activeChapter=Math.max(0,chapters.findIndex(chapter=>now>=chapter.start&&now<chapter.end));
  const visibleWords=scope==='episode'?words:words.filter(word=>word.chapterIds.includes(wordChapter));
  const effective=words.filter(word=>selectedWords.includes(word.id)&&word.chapterIds.some(index=>selectedChapters.includes(index)));
  const draft=useMemo(()=>episodeLessonDraft(material,selectedChapters,selectedWords,minutes),[material,selectedChapters,selectedWords,minutes]);
  const hasActivities=draft.steps.some(step=>step.t==='meet'||step.t==='lineSing');
  const groupSelection=():EpisodeGroupSelection=>({episodeId:episode.id,chapterStarts:chapters.filter((_,index)=>selectedChapters.includes(index)).map(chapter=>chapter.start),wordIds:effective.map(word=>word.id),minutes});
  function toggleChapter(index:number){
    const next=selectedChapters.includes(index)?selectedChapters.filter(value=>value!==index):[...selectedChapters,index].sort((a,b)=>a-b);
    setSelectedChapters(next);
    // Keep individual choices when a chapter is temporarily excluded or tabs change.
    setWorksheetError('');
  }
  return <section className="min-w-0 space-y-5 break-words" data-episode-detail={episode.id}>
    <button type="button" onClick={onBack} className="min-h-11 font-bold text-primary">← {t('animationSolo.backEpisodes')}</button>
    <header><p className="text-sm font-bold text-primary">{source.series}</p><div className="flex items-center gap-4"><h2 className="mt-1 min-w-0 text-2xl font-bold text-deep-navy">{episode.title}</h2>{onGroupLesson&&<button className="min-h-12 shrink-0 rounded-xl bg-primary px-5 font-bold text-white" onClick={()=>{if(!selectedChapters.length){setWorksheetError('워크시트를 열려면 챕터를 하나 이상 선택해 주세요.');return;}control.current?.pause();const params=new URLSearchParams({episode:episode.id,chapters:JSON.stringify(groupSelection().chapterStarts),words:JSON.stringify(effective.map(w=>w.id))});navigate('/materials/video-worksheet?'+params.toString());}}>워크시트</button>}</div>{worksheetError&&<p role="alert" className="mt-2 text-red-700">{worksheetError}</p>}<p className="mt-2 text-sm">{t('animationSolo.episodeDuration',{time:sourceTime(episode.end-episode.start)})} · 챕터 {chapters.length}개</p>{episode.boundary?.method==='original-video-and-indexed-frames'&&<p className="mt-2 text-sm text-on-surface-variant">{t('animationSolo.boundaryNotice',{seconds:episode.boundary.sampleSeconds})}</p>}{episode.boundary?.revision===2&&<p className="mt-2 text-sm text-on-surface-variant">{t('animationSolo.boundaryVerifiedNotice')}</p>}</header>
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
      <div className="h-[480px] min-w-0 w-full"><PlainTeachingVideo key={episode.id} videoUrl={`https://www.youtube.com/watch?v=${source.youtubeId}`} title={episode.title} start={episode.start} end={episode.end} simple controlRef={control} chapters={chapters} onReady={()=>setReady(true)} onTime={time=>setNow(time)} onChapterSelect={index=>{setScope('chapters');setWordChapter(index);}}/></div>
      <fieldset className="max-h-[480px] min-w-0 space-y-2 overflow-y-auto rounded-2xl border border-outline-variant bg-white p-4"><legend className="px-1 font-bold">{t('animationSolo.chooseChapters')}</legend>
        {!episode.chapters.length&&<p className="text-sm text-on-surface-variant">{t('animationSolo.chapterPendingDetail')}</p>}
        {chapters.map((chapter,index)=><div key={chapter.start} className={'flex items-center gap-3 rounded-xl border p-3 '+(activeChapter===index?'border-primary bg-sky-50':'border-outline-variant')}>
          <input aria-label={t('animationSolo.selectChapter',{title:chapter.title})} type="checkbox" checked={selectedChapters.includes(index)} onChange={()=>toggleChapter(index)}/>
          <button type="button" disabled={!ready} onClick={()=>{control.current?.playFrom(chapter.start);setScope('chapters');setWordChapter(index);}} className="min-h-11 min-w-0 flex-1 text-left disabled:opacity-60"><span className="block text-xs text-on-surface-variant">{sourceTime(chapter.start-episode.start)}–{sourceTime(chapter.end-episode.start)}</span><span className="font-bold">{chapter.title}</span>{chapter.intent&&<small className="mt-1 block text-on-surface-variant">{chapter.intent}</small>}</button>
        </div>)}
      </fieldset>
    </div>
    <section className="space-y-3 rounded-2xl border border-outline-variant bg-white p-5">
      <h3 className="text-xl font-bold">{t('animationSolo.episodeWords')}</h3>
      <div className="flex flex-wrap items-center gap-3"><button type="button" aria-pressed={scope==='episode'} className="min-h-11 rounded-xl border px-3" onClick={()=>setScope('episode')}>{t('animationSolo.allEpisodeWords')}</button><button type="button" aria-pressed={scope==='chapters'} className="min-h-11 rounded-xl border px-3" onClick={()=>setScope('chapters')}>{t('animationSolo.chapterWords')}</button><span>{t('animationSolo.selectedWordCount',{count:effective.length})}</span></div>
      {scope==='chapters'&&<select aria-label={t('animationSolo.wordChapter')} className="min-h-11 max-w-full rounded-xl border bg-white px-3" value={wordChapter} onChange={event=>setWordChapter(Number(event.target.value))}>{chapters.map((chapter,index)=><option key={chapter.start} value={index}>{chapter.title}</option>)}</select>}
      <p className="text-sm text-on-surface-variant">{t('animationSolo.wordCoverageNotice')}</p>
      <div className="grid max-h-96 gap-2 overflow-auto sm:grid-cols-2">{visibleWords.map(word=>{
        const scriptHere=word.basis==='script'&&(scope==='episode'||word.scriptChapterIds.includes(wordChapter));
        return <label key={word.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant p-3"><input type="checkbox" className="mt-1" aria-label={`${word.word} · ${word.meaning}`} checked={selectedWords.includes(word.id)} onChange={()=>setSelectedWords(current=>current.includes(word.id)?current.filter(id=>id!==word.id):[...current,word.id])}/><span><strong>{word.word}</strong> · {word.meaning}<small className="mt-1 block text-on-surface-variant">{t(scriptHere?'animationSolo.scriptWord':'animationSolo.contextWord')}</small>{scriptHere&&word.example&&<small className="mt-1 block text-on-surface-variant">{word.example}</small>}<small className="block text-primary">{word.chapterIds.map(index=>chapters[index].title).join(' · ')}</small></span></label>;
      })}</div>
      {!visibleWords.length&&<p>{t('animationSolo.noChapterWords')}</p>}
      <div className="flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded-xl border px-4" onClick={()=>setSelectedWords(words.filter(word=>word.chapterIds.some(index=>selectedChapters.includes(index))).map(word=>word.id))}>{t('animationSolo.selectAllWords')}</button>
        <button type="button" disabled={!teacherId||!effective.length||saving} className="min-h-11 rounded-xl border px-4 disabled:opacity-50" onClick={async()=>{
          if(saveLock.current||!teacherId)return;saveLock.current=true;setSaving(true);
          try{await createWordList({academyId,classId,teacherId,name:episode.title,groupName:t(onGroupLesson?'animationSolo.groupTitle':'animationSolo.title'),items:effective.map(word=>({id:word.id,word:word.word,meaning:word.meaning,image_url:word.imageUrl,category:source.series,example:word.example,
            videoSource:{version:1,youtubeId:source.youtubeId,episodeId:episode.id,episodeStart:episode.start,episodeEnd:episode.end,basis:word.basis,chapters:word.chapterIds.map(index=>({start:chapters[index].start,end:chapters[index].end,basis:word.scriptChapterIds.includes(index)?'script' as const:'scene-context' as const}))}}))});notify(t('animationSolo.wordListSaved'));}
          catch{notify(t('animationSolo.saveError'),'error');}finally{saveLock.current=false;setSaving(false);}
        }}>{t('animationSolo.saveWordList')}</button></div>
    </section>
    <div className="flex flex-wrap items-center gap-3"><fieldset className="flex gap-2"><legend className="mb-2 font-bold">{t('animationSolo.time')}</legend>{(onGroupLesson?[30,40]:VIDEO_LESSON_MINUTES).map(value=><label className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3" key={value}><input type="radio" name="episodeMinutes" checked={minutes===value} onChange={()=>setMinutes(value)}/>{t('animationSolo.minutes',{count:value})}</label>)}</fieldset>
      {onGroupPreview&&<button type="button" className="min-h-12 rounded-xl border border-primary px-5 font-bold text-primary disabled:opacity-50" disabled={!selectedChapters.length} onClick={()=>{control.current?.pause();onGroupPreview(groupSelection());}}>단체수업 미리보기</button>}
      <button type="button" className="min-h-12 rounded-xl bg-primary px-5 font-bold text-on-primary disabled:opacity-50" disabled={!selectedChapters.length||(!onGroupLesson&&!hasActivities)} onClick={()=>{control.current?.pause();if(onGroupLesson)onGroupLesson(groupSelection());else setConfiguring(true);}}>{t(onGroupLesson?'animationSolo.makeGroupLesson':'animationSolo.preview')}</button>
    </div>
    {!hasActivities&&!onGroupLesson&&<p className="text-sm text-on-surface-variant">{t('animationSolo.activitiesPending')}</p>}
    <details className="text-sm text-on-surface-variant"><summary className="cursor-pointer">{t('animationSolo.originalInfo')}</summary><p>{source.title} · {sourceTime(episode.start)}–{sourceTime(episode.end)}</p></details>
    {configuring&&<SoloCatalogModal academyId={academyId} classId={classId} initialVideoDraft={{draft,source:`animation-episode-${source.youtubeId}-${Math.round(episode.start*1000)}-v${episode.boundary?.revision??1}`}} allowInitialVideoSave={!!classId} onClose={()=>setConfiguring(false)} onScratch={async()=>{}} onBatch={async(lessons,level,sourceId)=>{
      if(!classId)return;
      for(const lesson of lessons)await createSoloLesson({academyId,classId,name:lesson.name,minutes:lesson.minutes,level,source:sourceId,steps:lesson.steps});
      notify(t('animationSolo.saved'));setConfiguring(false);onSaved?.();
    }}/>}
  </section>;
}
