import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AccessibleDialog from './AccessibleDialog';
import { animationTimedLines } from '../lib/animationScene';
import { newBlock } from '../lib/homework/blocks';
import type { VideoClip } from '../lib/videoClips';

export default function AnimationRecordingHomework({clip,classId}:{clip:VideoClip;classId?:string|null}) {
  const navigate = useNavigate();
  const [open,setOpen] = useState(false);
  const [selected,setSelected] = useState<number[]>([]);
  const lines = animationTimedLines(clip);
  if (!lines.length) return <p>녹음 숙제에는 시작과 끝 시간이 등록된 대사가 필요해요.</p>;
  function prepare() {
    const items = lines.flatMap((line,index)=>{
      if (!selected.includes(index)) return [];
      const item = newBlock('speak');
      const text = line.en.replace(/\*\*/g,'');
      item.title = text;
      Object.assign(item.config.block!,{
        text,translation:line.ko,videoUrl:'https://www.youtube.com/watch?v='+clip.youtube_id,
        start:line.start,end:line.end,stages:['model'],
        source:{lessonId:'',slideId:'',version:'animation-timed-line-v1',materialId:clip.id},
      });
      return [item];
    });
    navigate('/homework',{state:{fromClassId:classId,recordingLesson:{title:clip.title+' · 따라 말하기',items}}});
  }
  return <>
    <button type="button" onClick={()=>setOpen(true)}>녹음 숙제 내기</button>
    {open&&<AccessibleDialog label="녹음 숙제 대사 선택" onClose={()=>setOpen(false)}>
      <div className="max-h-[80dvh] space-y-4 overflow-auto p-5">
        <h2 className="text-xl font-bold">{clip.title}</h2>
        <p>연습한 대사를 고르세요. 2~4개를 권장해요.</p>
        {lines.map((line,index)=><label className="flex gap-2 py-1" key={index}><input type="checkbox" checked={selected.includes(index)} onChange={e=>setSelected(current=>e.target.checked?[...current,index]:current.filter(i=>i!==index))}/>{line.en.replace(/\*\*/g,'')}</label>)}
        <div className="flex gap-3"><button type="button" onClick={()=>setOpen(false)}>닫기</button><button type="button" disabled={!selected.length} onClick={prepare}>선택한 대사로 숙제 준비 · {selected.length}개</button></div>
      </div>
    </AccessibleDialog>}
  </>;
}
