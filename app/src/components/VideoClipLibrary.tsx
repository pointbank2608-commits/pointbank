import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseShadowText, shadowSpeakers } from '../lib/shadowLines';
import { clipLength, clipThumb, formatClipTime, useVideoClips, type VideoClip } from '../lib/videoClips';
import ShadowBoard from './ShadowBoard';
import ClipThumbnail from './ClipThumbnail';
import {clipActivities,clipSearchText,clipTopics,estimateClipMinutes,type ClipActivity} from '../lib/clipActivities';
import {Link} from 'react-router-dom';

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

function ClipPreview({ clip, onPick, onClose, pickLabel }: { clip: VideoClip; onPick: (activities:ClipActivity[]) => void; onClose: () => void; pickLabel?: string }) {
  const { t } = useTranslation();
  const lines = parseShadowText(clip.script);
  const speakers = shadowSpeakers(lines);
  const stageRef = useRef<HTMLDivElement>(null);
  const choices=useMemo(()=>clipActivities(clip),[clip]);
  const [activities,setActivities]=useState<ClipActivity[]>(()=>choices.filter(x=>['words','shadow','questions'].includes(x)));
  useEffect(()=>setActivities(choices.filter(x=>['words','shadow','questions'].includes(x))),[clip.id,choices]);
  const [fallbackFull,setFallbackFull]=useState(false);
  const [isFull, setIsFull] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFull(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setFallbackFull(false);};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[]);
  async function toggleFullscreen() {
    if(fallbackFull){setFallbackFull(false);return;}
    if (document.fullscreenElement) {await document.exitFullscreen();return;}
    try{if(!stageRef.current?.requestFullscreen)throw Error('unsupported');await stageRef.current.requestFullscreen();}catch{setFallbackFull(true);}
  }
  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-secondary-container/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-caption text-caption text-on-surface-variant">
            {clip.series} · Lv.{clip.level} · {formatClipTime(Number(clip.start_sec))}–{formatClipTime(Number(clip.end_sec))}
          </div>
          <div className="font-title-md text-title-md text-deep-navy">{clip.title}</div>
          {clip.summary && <p className="font-body-md text-body-md text-on-surface-variant">{clip.summary}</p>}
          <div className="mt-1 font-caption text-caption text-on-surface-variant">
            {t('curriculum.shadow.lineCount', { count: lines.length })}
            {speakers.length > 0 && ` · ${t('curriculum.shadow.speakers', { names: speakers.join(', ') })}`}
          </div>
          {clip.words.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {clip.words.map((w) => (
                <span key={w} className="rounded-full bg-surface-container-lowest px-2 py-0.5 text-xs text-on-surface">
                  {w}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={t('readyMedia.fullscreen')}
            className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 font-label-md text-label-md text-on-surface hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-[18px]">fullscreen</span>
            {t('readyMedia.fullscreen')}
          </button>
          <button
            type="button"
            onClick={()=>onPick(activities)}
            aria-label={pickLabel ?? t('readyMedia.makeLesson')}
            disabled={!activities.length}
            className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            {pickLabel ?? t('readyMedia.makeLesson')}
          </button>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>
      <p className="text-sm">{t('readyMedia.time',{time:formatClipTime(clipLength(clip))})} · {t('readyMedia.levelHint',{level:clip.level})} · {t('readyMedia.estimate',estimateClipMinutes(clip,activities))}</p><p className="text-xs text-slate-600">{t('readyMedia.estimateBasis')}</p>
      <details open className="rounded-xl border bg-white p-3"><summary className="font-bold">{t('readyMedia.recommend')}</summary><div className="my-3 flex flex-wrap gap-4">{choices.map(activity=><label key={activity}><input type="checkbox" checked={activities.includes(activity)} onChange={e=>setActivities(prev=>e.target.checked?[...prev,activity]:prev.filter(x=>x!==activity))}/> {t('readyMedia.'+activity)}</label>)}</div>{clip.pack?.words?.length&&<p>{clip.pack.words.map(w=>w.word+' — '+w.meaning).join(' · ')}</p>}{clip.pack?.questions?.map((q,i)=><p key={i}>{i+1}. {q.q}</p>)}</details>
      <div className="flex flex-wrap gap-3"><button type="button" className="rounded-lg border bg-white px-4 py-2" onClick={()=>stageRef.current?.scrollIntoView({block:'center',behavior:'smooth'})}>{t('readyMedia.watch')}</button>{(clip.script.trim()||clip.pack?.questions?.length)&&<Link className="rounded-lg border bg-white px-4 py-2" to={`/materials/video-worksheet?clip=${clip.id}`}>{t('readyMedia.printSheet')}</Link>}</div>
      {/* 화면에 맞춰 크게(가로는 칸 전체, 세로는 창 높이의 약 75%까지) + 전체 화면(2026-10-05 사용자 요청) */}
      <div ref={stageRef} data-video-full={isFull||fallbackFull} className={(fallbackFull?'fixed inset-0 z-[200] h-dvh max-w-none bg-black p-5 ':'')+"relative mx-auto aspect-video w-full max-w-[calc(75vh*16/9)] bg-surface-container-low [&:fullscreen]:max-w-none [&:fullscreen]:bg-black [&:fullscreen]:px-[2vh] [&:fullscreen]:pb-[2vh] [&:fullscreen]:pt-[5vh]"}>
        <ShadowBoard flow="video" expanded={isFull||fallbackFull} rememberKey={`clip:${clip.id}`} key={clip.id} source={clip.script} title={clip.title} videoUrl={`https://www.youtube.com/watch?v=${clip.youtube_id}`} />
        {(isFull||fallbackFull) && (
          <button
            type="button"
            onClick={toggleFullscreen}
            className="absolute left-1/2 top-[0.4vh] z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-sm text-white hover:bg-white/30"
          >
            <span className="material-symbols-outlined text-[18px]">fullscreen_exit</span>
            {t('videoLibrary.exitFullscreen')}
          </button>
        )}
      </div>
    </div>
  );
}
