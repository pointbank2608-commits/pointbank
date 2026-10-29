import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseShadowText } from '../lib/shadowLines';
import { clipLength, clipThumb, formatClipTime, useVideoClips, type VideoClip } from '../lib/videoClips';
import ShadowBoard from './ShadowBoard';
import ClipThumbnail from './ClipThumbnail';
import {clipActivities,clipSearchText,clipTopics,estimateClipMinutes,type ClipActivity} from '../lib/clipActivities';
import {Link} from 'react-router-dom';
import '../styles/video-library-v2.css';

/**
 * 영상 라이브러리 고르기(2026-10-03) — 쉐도잉 슬라이드 추가 패널·"영상 하나로 수업" 레시피에서 쓴다.
 * 시리즈·레벨·검색으로 거르고, 장면을 누르면 위에 미리보기(쉐도잉 칠판)와 "이 장면 넣기" 버튼이 뜬다.
 */
export default function VideoClipLibrary({ onPick, pickLabel, tall = false }: { onPick: (clip: VideoClip, activities?:ClipActivity[]) => void; pickLabel?: string; /** 메뉴 페이지: 목록을 화면 높이만큼 */ tall?: boolean }) {
  const { t } = useTranslation();
  const { clips: allClips, error } = useVideoClips();
  const clips=useMemo(()=>allClips?.filter(c=>!c.pack?.phonicsSong)??null,[allClips]);
  const [topic,setTopic]=useState('');
  const [series, setSeries] = useState<string>('');
  const [level, setLevel] = useState<number>(0);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const seriesList = useMemo(() => [...new Set((clips ?? []).map((c) => c.series))], [clips]);
  const levels = useMemo(() => [...new Set((clips ?? []).map((c) => c.level))].sort((a, b) => a - b), [clips]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (clips ?? []).filter(
      (c) =>
        (!series || c.series === series) && (!topic||c.tags.includes(topic)) &&
        (!level || c.level === level) &&
        (!q || clipSearchText(c).includes(q)),
    );
  }, [clips, series, level, query,topic]);
  const selected = (clips ?? []).find((c) => c.id === selectedId) ?? null;

  if (clips === null) return <div className="py-6 text-center font-caption text-caption text-on-surface-variant">{t('common.loading')}</div>;
  if (clips.length === 0) {
    return <div className="rounded-xl bg-surface-container-low p-6 text-center font-body-md text-body-md text-on-surface-variant">{t(error ? 'videoLibrary.notReady' : 'videoLibrary.empty')}</div>;
  }

  const chip = (on: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-secondary-container/40'}`;

  return (
    <div className="space-y-3">
      {selected && <ClipPreview clip={selected} onPick={(activities)=>onPick(selected,activities)} onClose={() => setSelectedId(null)} pickLabel={pickLabel} />}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('readyMedia.videoSearch')}
          className="min-w-[180px] flex-1 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-1.5 text-sm outline-none focus:border-primary"
        />
        {levels.length > 1 && (
          <div className="flex gap-1">
            <button type="button" className={chip(level === 0)} onClick={() => setLevel(0)}>
              {t('videoLibrary.allLevels')}
            </button>
            {levels.map((l) => (
              <button key={l} type="button" className={chip(level === l)} onClick={() => setLevel(l)}>
                Lv.{l}
              </button>
            ))}
          </div>
        )}
      </div>
      <label>{t('readyMedia.topics')} <select value={topic} onChange={e=>setTopic(e.target.value)} className="rounded-lg border bg-white p-2"><option value="">{t('readyMedia.allTopics')}</option>{clipTopics(clips).map(tag=><option key={tag}>{tag}</option>)}</select></label>
      {/* 좁은 화면: 시리즈 칩 한 줄 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 md:hidden">
        <button type="button" className={chip(!series)} onClick={() => setSeries('')}>
          {t('videoLibrary.allSeries', { count: clips.length })}
        </button>
        {seriesList.map((s) => (
          <button key={s} type="button" className={chip(series === s)} onClick={() => setSeries(s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="md:grid md:grid-cols-[200px_minmax(0,1fr)] md:items-start md:gap-4">
        {/* 넓은 화면: 왼쪽 시리즈 목록(2026-10-03 사용자 요청) */}
        <nav className="hidden max-h-[calc(100vh-260px)] flex-col gap-1 overflow-y-auto rounded-xl bg-surface-container-low p-2 md:flex" aria-label={t('videoLibrary.seriesNav')}>
          <div className="px-2 pb-1 pt-1 font-label-md text-label-md text-on-surface-variant">{t('videoLibrary.seriesNav')}</div>
          {[{ key: '', name: t('videoLibrary.allSeriesShort'), count: clips.length, thumb: null as string | null }, ...seriesList.map((s) => {
            const first = clips.find((c) => c.series === s);
            return { key: s, name: s, count: clips.filter((c) => c.series === s).length, thumb: first ? clipThumb(first.youtube_id) : null };
          })].map((it) => {
            const on = series === it.key;
            return (
              <button
                key={it.key || 'all'}
                type="button"
                onClick={() => setSeries(it.key)}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${on ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-secondary-container/40'}`}
              >
                {it.thumb ? (
                  <ClipThumbnail id={clips.find(c=>c.series===it.key)?.youtube_id??''} className="h-8 w-8 shrink-0 rounded-md object-cover"/>
                ) : (
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${on ? 'bg-on-primary/20' : 'bg-surface-container-high'}`}>
                    <span className="material-symbols-outlined text-[18px]">video_library</span>
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate font-label-md text-label-md">{it.name}</span>
                <span className={`shrink-0 rounded-full px-1.5 text-xs tabular-nums ${on ? 'bg-on-primary/20' : 'bg-surface-container-high text-on-surface-variant'}`}>{it.count}</span>
              </button>
            );
          })}
        </nav>

        <div className={`grid ${tall ? 'max-h-[calc(100vh-260px)] min-h-[420px]' : 'max-h-[560px]'} min-w-0 auto-rows-max grid-cols-2 content-start gap-3 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4`}>
          {shown.map((c) => {

            const on = c.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`overflow-hidden rounded-xl border-2 bg-surface-container-lowest text-left shadow-sm transition-colors ${on ? 'border-primary' : 'border-transparent hover:border-primary/40'}`}
              >
                <div className="relative aspect-video bg-surface-container-high">
                  <ClipThumbnail id={c.youtube_id} className="h-full w-full object-cover"/>
                  <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums">{formatClipTime(clipLength(c))}</span>
                  <span className="absolute left-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-bold text-deep-navy">Lv.{c.level}</span>
                </div>
                <div className="space-y-0.5 p-2">
                  <div className="truncate font-caption text-caption text-on-surface-variant">{c.series}</div>
                  <div className="line-clamp-2 font-label-md text-label-md text-on-surface">{c.title}</div>
                  <div className="line-clamp-2 text-xs text-on-surface-variant">{c.words.slice(0,5).join(' · ')}</div><div className="line-clamp-1 text-xs">{c.pack?.grammar?.sentence??parseShadowText(c.script)[0]?.en.replace(/\*\*/g,'')}</div>
                  <div className="font-caption text-caption text-on-surface-variant">{t('readyMedia.time',{time:formatClipTime(clipLength(c))})} · {t('readyMedia.estimate',estimateClipMinutes(c))}</div>
                </div>
              </button>
            );
          })}
          {shown.length === 0 && <div className="col-span-full py-6 text-center font-caption text-caption text-on-surface-variant">{t('videoLibrary.noMatch')}</div>}
        </div>
      </div>
      <p className="font-caption text-caption text-on-surface-variant">{t('videoLibrary.note')}</p>
    </div>
  );
}

function ClipPreview({clip,onPick,onClose,pickLabel}:{clip:VideoClip;onPick:(activities:ClipActivity[])=>void;onClose:()=>void;pickLabel?:string}){
 const {t}=useTranslation();const choices=useMemo(()=>clipActivities(clip),[clip]);const [activities,setActivities]=useState<ClipActivity[]>(()=>choices.filter(x=>['words','shadow','questions'].includes(x)));const [learning,setLearning]=useState(false);const stage=useRef<HTMLDivElement>(null);
 useEffect(()=>{setLearning(false);setActivities(choices.filter(x=>['words','shadow','questions'].includes(x)));},[clip.id,choices]);
 const lines=parseShadowText(clip.script);const expressions=clip.pack?.grammar?.sentence?[clip.pack.grammar.sentence]:lines.slice(0,2).map(l=>l.en.replace(/\*\*/g,''));
 return <article className="vl-detail"><header className="vl-detail-heading"><div><div className="vl-badges"><span>{clip.series}</span><span>Lv.{clip.level}</span>{clip.tags.slice(0,2).map(tag=><span key={tag}>{tag}</span>)}</div><h2>{clip.title}</h2><p>{clip.summary}</p></div><button type="button" aria-label={t('mediaV2.close')} onClick={onClose}>×</button></header>
  <div className="vl-meta"><span>{t('readyMedia.time',{time:formatClipTime(clipLength(clip))})}</span><span>{t('readyMedia.estimate',estimateClipMinutes(clip,activities))}</span></div>
  <div className="vl-detail-grid"><div ref={stage} className="vl-stage"><ShadowBoard key={clip.id} flow="video" rememberKey={`clip:${clip.id}`} source={clip.script} title={clip.title} videoUrl={`https://www.youtube.com/watch?v=${clip.youtube_id}`}/></div><aside className="vl-learning-card"><h3>{t('readyMedia.words')}</h3><div className="vl-expression-list">{expressions.map((text,i)=><p key={i}>{text}</p>)}</div><div className="vl-core-words">{(clip.pack.words??[]).slice(0,4).map(w=><div key={w.word}><strong>{w.word}</strong><span>{w.meaning}</span></div>)}</div><button type="button" aria-expanded={learning} onClick={()=>setLearning(v=>!v)}>{t(learning?'mediaV2.hidePreview':'mediaV2.preview')} →</button></aside></div>
  {learning&&<section className="vl-full-learning" data-learning-preview><h3>{t('mediaV2.preview')}</h3><p>{(clip.pack.words??[]).map(w=>w.word+' — '+w.meaning).join(' · ')}</p>{clip.pack.questions?.map((q,i)=><p key={i}>{i+1}. {q.q}</p>)}</section>}
  <fieldset className="vl-activity-order"><legend>{t('readyMedia.recommend')}</legend>{choices.map((activity,i)=><label key={activity} className={activities.includes(activity)?'is-selected':''}><input type="checkbox" checked={activities.includes(activity)} onChange={e=>setActivities(prev=>e.target.checked?[...prev,activity]:prev.filter(x=>x!==activity))}/><b>{i+1}</b><span>{t('readyMedia.'+activity)}</span></label>)}</fieldset>
  <div className="vl-action-bar"><button type="button" onClick={()=>stage.current?.scrollIntoView({block:'center',behavior:'smooth'})}>{t('readyMedia.watch')}</button>{(clip.script.trim()||clip.pack.questions?.length)&&<Link to={`/materials/video-worksheet?clip=${clip.id}`}>{t('readyMedia.printSheet')}</Link>}<button type="button" className="is-primary" disabled={!activities.length} aria-label={pickLabel??t('readyMedia.makeLesson')} onClick={()=>onPick(activities)}>{pickLabel??t('readyMedia.makeLesson')}</button></div><p className="vl-time-note">{t('readyMedia.estimateBasis')}</p>
 </article>;
}
