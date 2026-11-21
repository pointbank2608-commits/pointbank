import {useEffect,useMemo,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useVideoClips} from '../lib/videoClips';
import {animationEpisodeLibrary,type EpisodeMaterial} from '../lib/animationEpisodes';
import {sourceTime} from '../lib/animationSources';
import type {ReactNode} from 'react';

export default function AnimationEpisodeLibrary({title,renderDetail}:{title?:string;renderDetail:(material:EpisodeMaterial,onBack:()=>void)=>ReactNode}){
  const {t}=useTranslation();
  const {clips,error}=useVideoClips();
  const [query,setQuery]=useState('');
  const [series,setSeries]=useState('');
  const [selected,setSelected]=useState<string|null>(null);
  const detailRoot=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{if(selected)detailRoot.current?.scrollIntoView({block:'start'});},[selected]);
  const library=useMemo(()=>animationEpisodeLibrary(clips??[]),[clips]);
  const current=library.episodes.find(material=>material.episode.id===selected);
  const visible=library.episodes.filter(({episode,source,words})=>(!series||source.series===series)&&
    `${episode.title} ${source.series} ${source.title} ${words.map(word=>word.word+' '+word.meaning).join(' ')}`.toLowerCase().includes(query.toLowerCase().trim()));
  if(current)return <div ref={detailRoot}>{renderDetail(current,()=>setSelected(null))}</div>;
  return <section className="space-y-5" aria-label={title??t('animationSolo.title')}>
    <header><h2 className="text-2xl font-bold text-deep-navy">{title??t('animationSolo.title')}</h2><p className="mt-2 text-sm text-on-surface-variant">{t('animationSolo.episodeIntro')}</p></header>
    <div className="flex flex-wrap gap-3">
      <label className="min-w-40 flex-1 font-bold">{t('animationSolo.search')}<input type="search" className="mt-1 block min-h-11 w-full rounded-xl border border-outline-variant bg-white px-3 font-normal" placeholder={t('animationSolo.placeholder')} value={query} onChange={event=>setQuery(event.target.value)}/></label>
      <label className="font-bold">{t('animationSolo.series')}<select className="mt-1 block min-h-11 rounded-xl border border-outline-variant bg-white px-3 font-normal" value={series} onChange={event=>setSeries(event.target.value)}><option value="">{t('animationSolo.allSeries')}</option>{[...new Set(library.sources.map(source=>source.series))].map(name=><option key={name}>{name}</option>)}</select></label>
    </div>
    {!clips&&!error&&<p role="status">{t('animationSolo.loading')}</p>}
    {error&&<p role="alert">{t('animationSolo.loadError')}</p>}
    {clips&&<p className="text-sm text-on-surface-variant">{t('animationSolo.episodeCount',{count:visible.length,originals:library.sources.length})}</p>}
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {visible.map(material=><button type="button" data-episode-id={material.episode.id} key={material.episode.id} onClick={()=>setSelected(material.episode.id)} className="overflow-hidden rounded-2xl border border-outline-variant bg-white text-left shadow-card transition hover:border-primary">
        <div className="relative aspect-video"><img src={material.episode.thumbnail??`https://i.ytimg.com/vi/${material.source.youtubeId}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover"/><span className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-1 text-sm font-bold text-white">{sourceTime(material.episode.end-material.episode.start)}</span></div>
        <div className="space-y-2 p-4"><p className="text-sm font-bold text-primary">{material.source.series}</p><h3 className="font-bold text-deep-navy">{material.episode.title}</h3>{material.episode.titleOrigin==='summary'&&<small className="block text-on-surface-variant">{t('animationSolo.contentTitle')}</small>}<p className="text-sm text-on-surface-variant">{material.episode.chapters.length?t('animationSolo.chapterCount',{count:material.episode.chapters.length}):t('animationSolo.chapterPending')}</p><p className="text-sm">{t('animationSolo.wordCount',{count:material.words.length})}</p><span className="inline-block min-h-10 pt-2 font-bold text-primary">{t('animationSolo.openEpisode')} →</span></div>
      </button>)}
    </div>
    {!!library.pending.length&&<details className="rounded-xl border border-outline-variant bg-white p-4"><summary className="cursor-pointer font-bold">{t('animationSolo.episodesPending',{count:library.pending.length})}</summary><p className="my-3 text-sm text-on-surface-variant">{t('animationSolo.episodeReviewNotice')}</p><ul className="space-y-2 text-sm">{library.pending.map(source=><li key={source.youtubeId}>{source.series} · {source.title} · {sourceTime(source.duration)}</li>)}</ul></details>}
    {clips&&!visible.length&&<p>{t('animationSolo.empty')}</p>}
  </section>;
}
