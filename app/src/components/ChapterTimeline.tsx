export type TimelineChapter={title:string;start:number;end:number;selected?:boolean};

/** One native slider provides pointer dragging, touch and keyboard seeking. */
export default function ChapterTimeline({chapters,start,end,time,disabled,onSeek}:{chapters:readonly TimelineChapter[];start:number;end:number;time:number;disabled:boolean;onSeek:(time:number)=>void}){
 const length=Math.max(.01,end-start),value=Math.max(start,Math.min(end,time));
 const clock=(n:number)=>`${Math.floor(Math.max(0,n)/60)}:${String(Math.floor(Math.max(0,n)%60)).padStart(2,'0')}`;
 return <div className="chapter-timeline" data-chapter-timeline>
  <div className="chapter-segments" aria-hidden="true">{chapters.map(c=>{
   const begin=Math.max(start,c.start),finish=Math.min(end,c.end),progress=c.selected===false?0:Math.max(0,Math.min(1,(value-begin)/(finish-begin)));
   return finish>begin&&<span key={c.start} data-selected={c.selected!==false} data-start={c.start} data-end={c.end} data-progress={progress} title={c.title} style={{left:`${(begin-start)/length*100}%`,width:`${(finish-begin)/length*100}%`}}><i style={{width:`${progress*100}%`}}/></span>;
  })}</div>
  <input type="range" aria-label="재생 위치" aria-valuetext={`${clock(value-start)} / ${clock(Math.round(length))}`} disabled={disabled} min={start} max={end} step={.01} value={value} onChange={e=>onSeek(Number(e.target.value))} onKeyDown={e=>{
   const delta:Record<string,number>={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1,PageDown:-10,PageUp:10};
   if(e.key in delta){e.preventDefault();onSeek(Math.max(start,Math.min(end,value+delta[e.key])));}
  }}/>
 </div>;
}
