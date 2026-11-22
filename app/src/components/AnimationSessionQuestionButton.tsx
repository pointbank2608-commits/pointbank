import {useState} from 'react';
import {useVideoClips} from '../lib/videoClips';
import type {VideoSlide} from '../lib/types';
import AnimationQuestionEditor from './AnimationQuestionEditor';
import AnimationPreparation from './AnimationPreparation';
export default function AnimationSessionQuestionButton({slide,onChange}:{slide:VideoSlide;onChange:(value:Partial<VideoSlide>)=>void}){
 const {clips}=useVideoClips();const clip=clips?.find(c=>c.id===slide.clipId);const [open,setOpen]=useState(false);
 const [preparing,setPreparing]=useState(false);
 return <><button type="button" disabled={!clip} onClick={()=>setPreparing(true)}>수업 구간·단어 편집</button><button type="button" disabled={!clip} onClick={()=>setOpen(true)}>이 수업의 질문 편집</button><small>변경한 내용은 수업의 저장 버튼으로 보관해 주세요.</small>{preparing&&clip&&<AnimationPreparation clip={clip} chapters={clips?.filter(c=>c.youtube_id===clip.youtube_id)??[clip]} initialSlide={slide} onSave={async next=>onChange(next)} onClose={()=>setPreparing(false)}/>}{open&&clip&&<AnimationQuestionEditor clip={clip} initialSlide={slide} onSave={async next=>onChange({timedQuestions:next.timedQuestions})} onClose={()=>setOpen(false)}/>}</>;
}
