import {useMemo,useRef,useState,type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {createCurriculumLesson,fetchAllCurriculumLessons,updateCurriculumLesson} from '../lib/api';
import {effectiveSlides} from '../lib/lessonSlides';
import {animationEpisodeClip,animationSourceText} from '../lib/animationSession';
import {sceneLesson} from '../lib/animationScene';
import {sourceTime} from '../lib/animationSources';
import type {EpisodeMaterial} from '../lib/animationEpisodes';
import type {CurriculumLesson,VideoSlide} from '../lib/types';
import {findVideoQuestionLesson} from '../lib/videoQuestionLessons';
import AccessibleDialog from './AccessibleDialog';
import AnimationPreparation from './AnimationPreparation';
import AnimationQuestionEditor from './AnimationQuestionEditor';
import TimedVideoLesson from './TimedVideoLesson';

export default function AnimationEpisodeClassroom({material,classId,onBack,legacy}:{material:EpisodeMaterial;classId:string|null;onBack:()=>void;legacy:ReactNode}){
  const {academy,profile}=useAuth();
  const clip=useMemo(()=>animationEpisodeClip(material),[material]);
  const base=useMemo<VideoSlide>(()=>({id:crypto.randomUUID(),kind:'video',clipId:clip.id,title:material.episode.title,
    videoUrl:`https://www.youtube.com/watch?v=${material.source.youtubeId}`,startSec:material.episode.start,endSec:material.episode.end,
    source:animationSourceText(material.lines),chapters:material.chapters.map(c=>({title:c.title,start:c.start,end:c.end})),
    animationEpisode:{id:material.episode.id,revision:material.episode.boundary?.revision??1,start:material.episode.start,end:material.episode.end},
    animationSession:{source:animationSourceText(material.lines),words:[],originalUrl:`https://www.youtube.com/watch?v=${material.source.youtubeId}`,
      originalStart:material.episode.start,originalEnd:material.episode.end,expressions:material.source.rows.flatMap(row=>{const e=sceneLesson(row).expression;return e?[e]:[];})},
    timedQuestions:[],questionLesson:true,questionVersion:1}),[material,clip.id]);
  const [editor,setEditor]=useState<VideoSlide|null>(null),[playback,setPlayback]=useState<VideoSlide|null>(null);
  const [legacyOpen,setLegacyOpen]=useState(false);
  const [preparation,setPreparation]=useState<VideoSlide|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const savedLesson=useRef<CurriculumLesson|null>(null);
  const load=async()=>{
    if(!academy||!profile)throw Error('로그인이 필요해요.');
    const found=findVideoQuestionLesson(await fetchAllCurriculumLessons(academy.id),clip.id,profile.id,material.episode.id);
    savedLesson.current=found?.lesson??null;
    return found?.slide??base;
  };
  const open=async(kind:'editor'|'playback'|'prepare')=>{
    setLoading(true);setError('');
    try{const slide=await load();if(kind==='editor')setEditor(slide);else if(kind==='prepare')setPreparation({...slide,id:crypto.randomUUID(),questionLesson:false});else setPlayback(slide);}
    catch{setError('저장한 질문을 불러오지 못했어요. 다시 시도해 주세요.');}
    finally{setLoading(false);}
  };
  const saveQuestions=async(next:VideoSlide)=>{
    if(!academy||!profile)throw Error('로그인이 필요해요.');
    if(savedLesson.current){
      const row=savedLesson.current;
      const playlist=effectiveSlides(row).map(s=>s.id===next.id?next:s);
      await updateCurriculumLesson(row.id,{playlist});savedLesson.current={...row,playlist};
    }else savedLesson.current=await createCurriculumLesson({academyId:academy.id,classId,name:`${material.episode.title} · 영상 질문`,wordListId:null,videoUrl:null,level:null,playlist:[next],teacherId:profile.id});
    setEditor(next);
  };
  return <section className="space-y-4" data-episode-detail={material.episode.id}>
    <button type="button" onClick={onBack}>← 에피소드 목록</button>
    <header><p>{material.source.series}</p><h2 className="text-2xl font-bold">{material.episode.title}</h2><p>영상 길이 {sourceTime(material.episode.end-material.episode.start)} · 챕터 {material.chapters.length}개</p></header>
    <button type="button" className="relative block aspect-video w-full overflow-hidden rounded-2xl bg-slate-900" aria-label="영상 보기" disabled={loading} onClick={()=>void open('playback')}>
      <img src={material.episode.thumbnail??`https://i.ytimg.com/vi/${material.source.youtubeId}/hqdefault.jpg`} alt="" className="h-full w-full object-cover"/>
      <span className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-blue-600 text-4xl text-white">▶</span>
    </button>
    <div className="vl-action-bar"><button disabled={loading} onClick={()=>void open('editor')}>질문 넣기</button><Link to={`/materials/video-worksheet?episode=${encodeURIComponent(material.episode.id)}`}>활동지</Link><button disabled={loading} onClick={()=>void open('prepare')}>이 영상으로 수업 만들기</button></div>
    {loading&&<p role="status">저장한 질문을 불러오고 있어요.</p>}{error&&<p role="alert">{error}</p>}
    <details onToggle={e=>setLegacyOpen(e.currentTarget.open)}><summary>기존 챕터로 수업 구성</summary>{legacyOpen&&legacy}</details>
    {preparation&&<AnimationPreparation clip={clip} chapters={[clip]} material={material} initialSlide={preparation} startPreparing={false} classId={classId} onClose={()=>setPreparation(null)}/>}
    {editor&&<AnimationQuestionEditor clip={clip} initialSlide={editor} onSave={saveQuestions} onClose={()=>setEditor(null)}/>}
    {playback&&<AccessibleDialog label="수업용 영상" onClose={()=>setPlayback(null)}><div className="vl-player-surface"><header><strong>{material.episode.title}</strong><button onClick={()=>setPlayback(null)}>수업 준비로 돌아가기</button></header><div className="vl-player-content"><TimedVideoLesson slide={playback} autoPlay/></div></div></AccessibleDialog>}
  </section>;
}
