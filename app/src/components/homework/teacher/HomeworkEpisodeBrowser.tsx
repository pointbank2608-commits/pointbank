import { useState, type ReactNode } from 'react';
import { sourceTime } from '../../../lib/animationSources';
import type { HomeworkEpisode } from '../../../lib/homework/materialSources';
import './homework-episode-browser.css';

export type EpisodeView = { series: string; query: string; id: string };
type Chapter = HomeworkEpisode['materials'][number];

function EpisodeImage({episode}: {episode:HomeworkEpisode}) {
  const [failed,setFailed] = useState<string[]>([]);
  const src = [episode.thumbnail,episode.videoThumbnail].find(url=>url && !failed.includes(url));
  return <span className="hw-episode-image" aria-hidden="true">{src
    ? <img src={src} loading="lazy" alt="" onError={()=>setFailed(previous=>[...previous,src])}/>
    : <span className="material-symbols-outlined">movie</span>}</span>;
}

export default function HomeworkEpisodeBrowser({episodes,view,onView,selected,onChoose,next,en}: {
  episodes:HomeworkEpisode[]; view:EpisodeView; onView:(view:EpisodeView)=>void;
  selected:(chapter:Chapter)=>boolean; onChoose:(chapter:Chapter)=>void; next:ReactNode; en:boolean;
}) {
  const current = episodes.find(e=>e.id===view.id) ?? (!view.id ? episodes.find(e=>e.materials.some(selected)) : undefined);
  const query = view.query.trim().toLocaleLowerCase();
  const visible = episodes.filter(e=>(!view.series || view.series===e.series)
    && e.searchTitles.some(title=>title.toLocaleLowerCase().includes(query)));
  const count = episodes.reduce((n,e)=>n+e.materials.filter(selected).length,0);
  const searchLabel = en?'Search episode titles':'에피소드 제목 검색';
  return <div className="hw-episode-browser">
    <section className="hw-episode-pane">
      <h2>{en?'Select an episode':'에피소드 선택'}</h2>
      <div className="hw-episode-filters">
        <label>{en?'Series':'시리즈'}<select value={view.series} onChange={e=>onView({...view,series:e.target.value})}>
          <option value="">{en?'All':'전체'}</option>
          {[...new Set(episodes.map(e=>e.series).filter(Boolean))].map(series=><option key={series}>{series}</option>)}
        </select></label>
        <label className="hw-episode-search"><span aria-hidden="true" className="material-symbols-outlined">search</span>
          <input type="search" aria-label={searchLabel} placeholder={searchLabel} value={view.query} onChange={e=>onView({...view,query:e.target.value})}/>
        </label>
      </div>
      <div className="hw-episode-scroll" key={view.series+'|'+view.query} tabIndex={0} role="region" aria-label={en?'Episodes':'에피소드 목록'}>
        {visible.map(episode=><button type="button" key={episode.id} aria-pressed={current?.id===episode.id}
          onClick={()=>onView({...view,id:episode.id})}>
          <EpisodeImage episode={episode}/><strong>{episode.title}</strong>
        </button>)}
        {!visible.length && <p>{en?'No results.':'검색 결과가 없어요.'}</p>}
      </div>
    </section>
    <section className="hw-episode-pane hw-episode-selected">
      <h2>{en?'Chapters for this homework':'숙제에 넣을 챕터'}</h2>
      {current ? <>
        <div className="hw-episode-current"><EpisodeImage key={current.id} episode={current}/><strong>{current.title}</strong></div>
        <div className="hw-episode-chapters">{current.materials.map(chapter=><label key={chapter.id} data-checked={selected(chapter)}>
          <input type="checkbox" checked={selected(chapter)} aria-label={chapter.chapter.title} onChange={()=>onChoose(chapter)}/>
          <strong>{chapter.chapter.title}</strong>
          <span>{sourceTime(chapter.scene.start-current.start)}–{sourceTime(chapter.scene.end-current.start)}</span>
        </label>)}
        {!current.materials.length && <p>{en?'No chapters registered.':'등록된 챕터가 없어요.'}</p>}</div>
      </> : <p>{en?'Select an episode on the left.':'왼쪽에서 에피소드를 선택해 주세요.'}</p>}
      <div className="hw-episode-actions"><strong aria-live="polite">{en?`${count} chapters selected`:`챕터 ${count}개 선택`}</strong>{next}</div>
    </section>
  </div>;
}
