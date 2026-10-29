import PlainTeachingVideo from './PlainTeachingVideo';
/** Legacy video slides retain their range controls, now in the shared teaching frame. */
export default function YoutubeShadowingPlayer({videoUrl,fit=false,start,end,title,rememberKey}:{videoUrl:string;fit?:boolean;start?:number;end?:number;title?:string;rememberKey?:string}){
 return <div className={fit?'h-full w-full':'h-[min(76vh,760px)] min-h-[500px]'}><PlainTeachingVideo key={`${rememberKey??''}:${videoUrl}:${start??0}:${end??''}`} videoUrl={videoUrl} title={title} start={start} end={end} rememberKey={rememberKey}/></div>;
}
