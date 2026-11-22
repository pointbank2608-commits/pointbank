import {useMemo,useRef,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {createCurriculumLesson,fetchAllCurriculumLessons,updateCurriculumLesson} from '../lib/api';
import {effectiveSlides} from '../lib/lessonSlides';
import {findVideoQuestionLesson} from '../lib/videoQuestionLessons';
import {useLearningActivity} from '../lib/learningSensors/useLearningActivity';
import {animationPracticeLines} from '../lib/animationSession';
import {nextVideoQuestion,sortedQuestions,type VideoQuestion} from '../lib/videoQuestions';
import {shadowLineAtTime} from '../lib/shadowLines';
import type {VideoSlide} from '../lib/types';
import type {VideoClip} from '../lib/videoClips';
import PlainTeachingVideo,{type TeachingVideoControl} from './PlainTeachingVideo';
import {VideoQuestionCard} from './TimedVideoLesson';
import AnimationQuestionEditor from './AnimationQuestionEditor';
import AnimationActivityPanel from './AnimationActivityPanel';
import AnimationPracticePanel,{type PracticeSentence} from './AnimationPracticePanel';

type Props={slide:VideoSlide;source?:string;previewQuestion?:VideoQuestion;observe?:(action:'shown'|'submitted'|'revealed'|'audio',q:VideoQuestion)=>void;observation?:{lessonId:string;position:number};autoPlay?:boolean};
export default function AnimationClassroomPlayer({slide:initial,source='',previewQuestion,observe,observation,autoPlay=false}:Props){
 const {academy,profile}=useAuth();const [slide,setSlide]=useState(initial);
 source=slide.animationSession?.source??slide.source??source;
 const [activity,setActivity]=useState('video'),[questionsOn,setQuestionsOn]=useState(!!previewQuestion),[fullSource,setFullSource]=useState(false);
 const [active,setActive]=useState<VideoQuestion|null>(previewQuestion??null),[isReplaying,setIsReplaying]=useState(false),[openTime,setOpenTime]=useState(slide.startSec??0);
 const player=useRef<TeachingVideoControl|null>(null),activeRef=useRef(active),served=useRef(new Set<string>()),previous=useRef(slide.startSec??0),full=useRef(false),returnTime=useRef(0),replaying=useRef(false),replayEntered=useRef(false);
 const segment=useRef<{line:PracticeSentence;done:()=>void}|null>(null);
 const [playerKey]=useState(()=>crypto.randomUUID());
 const sensor=useLearningActivity(observation&&!previewQuestion?{source:'group',resource:observation.lessonId,credential:''}:undefined,observation?.position??null,null);
 const lines=useMemo(()=>animationPracticeLines(source,slide.startSec,slide.endSec),[source,slide.startSec,slide.endSec]);
 const questions=sortedQuestions(previewQuestion?[previewQuestion]:slide.timedQuestions??[]).filter(q=>q.at>=(slide.startSec??0)&&q.at<=(slide.endSec??Infinity));
 const pause=()=>player.current?.pause();
 const dismiss=()=>{if(activeRef.current)served.current.add(activeRef.current.id);activeRef.current=null;setActive(null);replaying.current=false;setIsReplaying(false);};
 const closeActivity=()=>{pause();segment.current=null;if(activity!=='video')player.current?.seek(returnTime.current);setActivity('video');};
 const listen=(line:PracticeSentence,done=()=>{})=>{if(line.start===undefined||line.end===undefined)return;pause();sensor('audio');segment.current={line,done};player.current?.playFrom(line.start);};
 const timeChanged=(time:number,playing:boolean,ended:boolean)=>{
  if(full.current)return;const before=previous.current;previous.current=time;
  if(time<before-.35)questions.filter(q=>q.at>=time-.03).forEach(q=>served.current.delete(q.id));
  if(segment.current){const {line,done}=segment.current;if((playing||ended)&&time>=line.end!-.02){pause();player.current?.seek(Math.max(line.start!,line.end!-.04));segment.current=null;done();}return;}
  if(replaying.current&&activeRef.current){if(!replayEntered.current){if(playing&&time<activeRef.current.at-.03)replayEntered.current=true;else return;}if((playing||ended)&&time>=activeRef.current.at-.02){pause();player.current?.seek(activeRef.current.at);replaying.current=false;setIsReplaying(false);}return;}
  if(activeRef.current){if(playing)pause();return;}
  if(!questionsOn||activity!=='video'||(!playing&&!ended))return;
  const next=nextVideoQuestion(questions,served.current,time,Math.min(before,time));
  if(next){pause();player.current?.seek(next.at);activeRef.current=next;setActive(next);if(!previewQuestion)observe?.('shown',next);}
 };
 const resume=()=>{if(full.current||!activeRef.current)return false;const time=activeRef.current.at;dismiss();player.current?.playFrom(time+.04);return true;};
 const menu=(id:string)=>{
  if(id==='questions'){if(questionsOn&&activeRef.current){const time=activeRef.current.at;dismiss();if(activity==='video')player.current?.playFrom(time+.04);}setQuestionsOn(v=>!v);return;}
  pause();segment.current=null;dismiss();sensor('shown');
  if(id==='video'||activity===id){closeActivity();return;}
  if(activity==='video')returnTime.current=player.current?.getTime()??slide.startSec??0;
  setOpenTime(player.current?.getTime()??slide.startSec??0);setActivity(id);
 };
 const save=async(next:VideoSlide)=>{
  if(!academy||!profile)throw Error('로그인이 필요해요.');
  const rows=await fetchAllCurriculumLessons(academy.id);
  const owner=rows.find(row=>row.created_by===profile.id&&effectiveSlides(row).some(s=>s.id===next.id));
  const ownedSlide=owner&&effectiveSlides(owner).find(s=>s.id===next.id);
  const persisted={...next,questionLesson:ownedSlide?.kind==='video'?ownedSlide.questionLesson??next.questionLesson:true};
  if(owner)await updateCurriculumLesson(owner.id,{playlist:effectiveSlides(owner).map(s=>s.id===next.id?persisted:s)});
  else{
   const found=findVideoQuestionLesson(rows,next.clipId??'',profile.id,next.animationEpisode?.id);
   const saved={...next,id:found?.slide.id??next.id,questionLesson:true as const};
   if(found)await updateCurriculumLesson(found.lesson.id,{playlist:effectiveSlides(found.lesson).map(s=>s.id===saved.id?saved:s)});
   else await createCurriculumLesson({academyId:academy.id,classId:null,name:`${next.title??'애니메이션'} · 영상 질문`,wordListId:null,videoUrl:null,level:null,playlist:[saved],teacherId:profile.id});
  }
  setSlide(persisted);
 };
 const reviewLines:PracticeSentence[]=lines.filter(l=>l.en.split(/\s+/).length>1);
 if(!reviewLines.length)reviewLines.push(...(slide.animationSession?.practiceSentences??[]).map(en=>({en,ko:''})));
 const reviewLine=reviewLines.length?reviewLines[Math.max(0,shadowLineAtTime(reviewLines.filter((l):l is typeof lines[number]=>l.start!==undefined&&l.end!==undefined&&'speaker'in l),openTime))]:undefined;
 const editorClip={id:slide.clipId??slide.id,title:slide.title??'영상',youtube_id:'',start_sec:slide.startSec??0,end_sec:slide.endSec??0,script:source,pack:{}} as VideoClip;
 const overlay=activity==='words'||activity==='review'?<AnimationActivityPanel key={activity} kind={activity} slide={slide} line={reviewLine} listen={()=>{if(reviewLine)listen(reviewLine);}} onClose={closeActivity} observe={sensor}/>:activity==='practice'?<AnimationPracticePanel slide={slide} lines={lines} time={openTime} seek={line=>{if(line.start!==undefined)player.current?.seek(line.start);}} pause={()=>{pause();segment.current=null;}} listen={listen} onClose={closeActivity} observe={sensor}/>:activity==='editor'?<div className="animation-editor-panel"><AnimationQuestionEditor embedded clip={editorClip} initialSlide={slide} initialAt={openTime} onSave={save} onClose={closeActivity}/></div>:active&&<div className="vq-overlay" data-active-question={active.id}><strong className="vq-question-number">질문 {questions.findIndex(q=>q.id===active.id)+1}</strong><VideoQuestionCard key={active.id} question={active} pause={pause} replaying={isReplaying} observe={action=>{if(!previewQuestion)observe?.(action,active);}} observation={observation&&!previewQuestion?{context:{source:'group',resource:observation.lessonId,credential:''},position:observation.position,question:questions.findIndex(q=>q.id===active.id)}:undefined} replay={active.replayStart!==undefined&&active.replayStart<(active.at)&&active.replayStart>=(slide.startSec??0)?()=>{replaying.current=true;replayEntered.current=false;setIsReplaying(true);player.current?.playFrom(active.replayStart!);}:undefined} cancelReplay={()=>{pause();if(activeRef.current)player.current?.seek(activeRef.current.at);replaying.current=false;setIsReplaying(false);}}/></div>;
 return <div className="vq-lesson vq-classroom"><div className="vq-player"><PlainTeachingVideo rememberKey={playerKey} controlRef={player} videoUrl={slide.videoUrl} title={slide.title} start={slide.startSec} end={slide.endSec} source={source} simple compactControls settingsLabel="설정" chapters={slide.animationSession?undefined:slide.chapters}
  onTime={timeChanged} onSeek={time=>{previous.current=time;questions.filter(q=>q.at>=time-.03).forEach(q=>served.current.delete(q.id));}}
  onReady={()=>{if(previewQuestion)player.current?.seek(previewQuestion.at);else if(autoPlay)player.current?.playFrom(slide.startSec??0);}}
  onResume={resume} playbackLocked={!!active&&!fullSource} activeQuestionId={active?.id} lockedTime={active&&!isReplaying&&!fullSource?active.at:undefined} questionMarkers={questionsOn&&!fullSource?questions:[]} onQuestionMarker={id=>{const q=questions.find(q=>q.id===id);if(!q)return;pause();setActivity('video');player.current?.seek(q.at);activeRef.current=q;setActive(q);}}
  overlay={<div hidden={fullSource}>{overlay}</div>}
  tools={<><button onClick={()=>{pause();if(!full.current){returnTime.current=player.current?.getTime()??slide.startSec??0;player.current?.setRange(slide.animationSession?.originalStart??slide.animationEpisode?.start??0,slide.animationSession?.originalEnd??slide.animationEpisode?.end??player.current?.getDuration()??0);full.current=true;setFullSource(true);}else{player.current?.setRange(slide.startSec??0,slide.endSec??player.current.getDuration());player.current?.seek(returnTime.current);full.current=false;setFullSource(false);}}}>{fullSource?'수업 구간으로 돌아가기':'원본 전체 보기'}</button><nav hidden={fullSource} className="animation-menu" aria-label="수업 활동">{[['video','영상 보기'],['words','단어'],['questions','질문과 함께 보기'],['editor','질문 편집'],['practice','문장 연습'],['review','복습 활동']].map(([id,label])=><button key={id} aria-pressed={id==='questions'?questionsOn:activity===id} onClick={()=>menu(id)}>{label}{id==='questions'&&<span className="animation-switch" data-on={questionsOn} aria-hidden="true"><span/></span>}</button>)}</nav></>}/></div></div>;
}
