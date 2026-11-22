import {useRef,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {createCurriculumLesson,updateCurriculumLesson} from '../lib/api';
import {learningRange,sceneLesson} from '../lib/animationScene';
import {animationEpisodeWords,animationEpisodeSource,animationRangeInvalid} from '../lib/animationSession';
import {formatQuestionTime} from '../lib/videoQuestions';
import type {VideoClip} from '../lib/videoClips';
import type {EpisodeMaterial} from '../lib/animationEpisodes';
import type {VideoSlide} from '../lib/types';
import PlainTeachingVideo,{type TeachingVideoControl} from './PlainTeachingVideo';
import AnimationQuestionEditor from './AnimationQuestionEditor';
import TimedVideoLesson from './TimedVideoLesson';
import AccessibleDialog from './AccessibleDialog';

export default function AnimationPreparation({clip,chapters,onClose,initialSlide,onSave,material,startPreparing,classId=null}:{clip:VideoClip;chapters:VideoClip[];onClose:()=>void;initialSlide?:VideoSlide;onSave?:(slide:VideoSlide)=>Promise<void>;material?:EpisodeMaterial;startPreparing?:boolean;classId?:string|null}){
 const {academy,profile}=useAuth();const player=useRef<TeachingVideoControl|null>(null);
 const originalStart=initialSlide?.animationSession?.originalStart??material?.episode.start??0;const originalEnd=initialSlide?.animationSession?.originalEnd??material?.episode.end;
 const selections=material?.chapters??chapters.map(c=>({title:c.title,start:Number(c.start_sec),end:Number(c.end_sec)}));
 const range=learningRange(clip);const [start,setStart]=useState(initialSlide?.startSec??range?.start??0),[end,setEnd]=useState(initialSlide?.endSec??range?.end??0),[duration,setDuration]=useState(0);
 const [manual,setManual]=useState(false),[prepare,setPrepare]=useState(startPreparing??!!initialSlide),[edit,setEdit]=useState(false),[running,setRunning]=useState(false),[expanded,setExpanded]=useState(true),[preview,setPreview]=useState(false);
 const allWords=animationEpisodeWords(chapters,initialSlide?.animationSession);
 const [chosen,setChosen]=useState<string[]>(initialSlide?.animationSession?.words.map(w=>w.word+'|'+w.meaning)??[]),[lessonId,setLessonId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [questions,setQuestions]=useState<NonNullable<VideoSlide['timedQuestions']>>(initialSlide?.timedQuestions??[]);
 const [slideId]=useState(()=>initialSlide?.id??crypto.randomUUID());
 const source=initialSlide?.animationSession?.source??animationEpisodeSource(chapters);
 const activeQuestions=questions.filter(q=>q.at>=start&&q.at<=end);
 const slide:VideoSlide={...initialSlide,id:slideId,kind:'video',clipId:clip.id,title:clip.title,videoUrl:`https://www.youtube.com/watch?v=${clip.youtube_id}`,startSec:start,endSec:end,timedQuestions:activeQuestions,questionVersion:1,source,chapters:selections.filter(c=>c.end>start&&c.start<end).map(c=>({...c,start:Math.max(c.start,start),end:Math.min(c.end,end)})),animationSession:{...initialSlide?.animationSession,source,originalStart,originalEnd,words:allWords.filter(w=>chosen.includes(w.word+'|'+w.meaning)),originalUrl:`https://www.youtube.com/watch?v=${clip.youtube_id}`,expression:initialSlide?.animationSession?.expression??sceneLesson(clip).expression,expressions:initialSlide?.animationSession?.expressions??chapters.flatMap(c=>{const expression=sceneLesson(c).expression;return expression?[expression]:[];})}};
 const invalid=start<originalStart||animationRangeInvalid(start,end,originalEnd??duration);
 const save=async(next=slide)=>{
  if(onSave){await onSave(next);return;}if(!academy||!profile)throw Error('로그인이 필요해요.');
  if(lessonId)await updateCurriculumLesson(lessonId,{playlist:[next]});else{const row=await createCurriculumLesson({academyId:academy.id,classId,name:`${clip.title} · ${formatQuestionTime(start-originalStart)}–${formatQuestionTime(end-originalStart)}`,wordListId:null,videoUrl:null,level:null,playlist:[next],teacherId:profile.id});setLessonId(row.id);}
 };
 return <AccessibleDialog label="애니메이션 수업 준비" onClose={onClose}><div className="vq-editor"><header><h2>{clip.title} · 수업 준비</h2><button onClick={onClose}>닫기</button></header>
 {!prepare?<><div className="vq-player"><PlainTeachingVideo videoUrl={slide.videoUrl} title="원본 전체 영상" start={originalStart} end={originalEnd} selectedRange={[start,end]} simple controlRef={player} onReady={()=>setDuration(player.current?.getDuration()??0)} onTime={time=>{if(preview&&time>=end){player.current?.pause();setPreview(false);}}}/></div><h3>수업 구간 선택하기</h3><div className="vq-actions"><button aria-pressed={!manual} onClick={()=>setManual(false)}>챕터로 선택</button><button aria-pressed={manual} onClick={()=>setManual(true)}>직접 구간 정하기</button></div>
 {!manual?<div className="vq-timeline">{selections.map(c=><button key={c.start} onClick={()=>{setStart(c.start);setEnd(c.end);player.current?.seek(c.start);}}>{c.title} · {formatQuestionTime(c.start-originalStart)}–{formatQuestionTime(c.end-originalStart)}</button>)}</div>:<div className="vq-actions"><button onClick={()=>setStart(player.current?.getTime()??0)}>여기서 시작</button><button onClick={()=>setEnd(player.current?.getTime()??0)}>여기서 끝</button></div>}
 {(['시작','종료'] as const).map((label,i)=><label key={label}>{label} 시각 (초)<div className="vq-time"><button onClick={()=>i?setEnd(v=>Math.max(0,v-1)):setStart(v=>Math.max(0,v-1))}>−1초</button><input type="number" min="0" step="0.01" value={(i?end:start)-originalStart} onChange={e=>i?setEnd(Number(e.target.value)+originalStart):setStart(Number(e.target.value)+originalStart)}/><button onClick={()=>i?setEnd(v=>v+1):setStart(v=>v+1)}>+1초</button></div></label>)}
 <p>{formatQuestionTime(start-originalStart)} → {formatQuestionTime(end-originalStart)} · 선택 구간 {formatQuestionTime(end-start)}</p>{invalid&&<p role="alert">시작은 종료보다 앞서고 두 시각 모두 원본 영상 안에 있어야 해요.</p>}
 <div className="vq-actions"><button disabled={invalid} onClick={()=>{setPreview(true);player.current?.playFrom(start);}}>선택 구간 미리보기</button><button disabled={invalid} onClick={()=>{player.current?.pause();setPrepare(true);}}>이 구간으로 수업 준비</button></div></>:<>
 <h3>선택한 구간</h3><p>{formatQuestionTime(start-originalStart)}–{formatQuestionTime(end-originalStart)} · {formatQuestionTime(end-start)}</p><button onClick={()=>setPrepare(false)}>구간 다시 선택</button>
 <h3>수업에 쓸 단어 · {chosen.length}개 선택 / 전체 {allWords.length}개</h3><button onClick={()=>setExpanded(v=>!v)}>{expanded?'완료':'단어 선택 펼치기'}</button>{expanded&&<div style={{maxHeight:280,overflow:'auto'}}>{allWords.map(w=><label key={w.word+'|'+w.meaning}><span><input type="checkbox" checked={chosen.includes(w.word+'|'+w.meaning)} onChange={e=>setChosen(v=>e.target.checked?[...v,w.word+'|'+w.meaning]:v.filter(k=>k!==w.word+'|'+w.meaning))}/>{w.word} · {w.meaning}</span></label>)}</div>}
 <h3>영상 질문 {activeQuestions.length}개{!activeQuestions.length&&' · 선택 사항'}</h3><button onClick={()=>setEdit(true)}>{activeQuestions.length?'질문 편집':'+ 질문 입력하기'}</button>
 <div className="vq-actions"><button className="vq-primary" onClick={()=>setRunning(true)}>수업 시작</button><button disabled={busy} onClick={()=>{setBusy(true);void save().then(()=>setError(onSave?'편집에 반영했습니다. 수업의 저장 버튼으로 보관해 주세요.':'내 수업에 저장했습니다.')).catch(()=>setError('저장하지 못했어요. 다시 시도해 주세요.')).finally(()=>setBusy(false));}}>내 수업에 담기</button></div>{error&&<p role="status">{error}</p>}</>}
 {edit&&<AnimationQuestionEditor clip={clip} initialSlide={slide} onSave={async next=>{await save(next);setQuestions(next.timedQuestions??[]);}} onClose={()=>setEdit(false)}/>}
 {running&&<AccessibleDialog label="구간 수업" onClose={()=>setRunning(false)}><div className="vl-player-surface"><button onClick={()=>setRunning(false)}>수업 준비로 돌아가기</button><div className="vl-player-content"><TimedVideoLesson slide={slide} source={source} autoPlay/></div></div></AccessibleDialog>}
 </div></AccessibleDialog>;
}
