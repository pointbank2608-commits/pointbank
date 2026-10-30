import type {StemBlock,StemFrame,StemLesson} from './stemTypes';

export type StemInsertKind=StemBlock|'image'|'video'|'game'|'missing';
/** Block structure uses existing frame IDs and lesson storage; no second lesson model. */
export function insertStemFrame(frames:StemFrame[],frame:StemFrame,index:number){const next=[...frames];next.splice(Math.max(0,Math.min(index,next.length)),0,frame);return next;}
export function moveStemFrame(frames:StemFrame[],id:string,target:number){const from=frames.findIndex(f=>f.id===id);if(from<0||target<0||target>=frames.length)return frames;const next=[...frames];const [frame]=next.splice(from,1);next.splice(target,0,frame);return next;}
export function duplicateStemFrame(frame:StemFrame,lesson:StemLesson):StemFrame{
 const copy={...structuredClone(frame),id:crypto.randomUUID()};
 // A copied report has its own questions while retaining the common report component.
 if(copy.mode==='report')copy.report=structuredClone(frame.report||(frame.metaOverride||lesson.meta).report);
 return copy;
}
export function createStemFrame(kind:StemInsertKind):StemFrame{
 const block:StemBlock=kind==='image'?'introduction':kind==='video'?'concept':kind==='game'||kind==='missing'?'review':kind;
 const title:Record<StemBlock,string>={introduction:'Introduction',concept:'Science Concept',vocabulary:'Science Words',prediction:'Let’s Predict!',experiment:'Let’s Experiment!',review:'Review & Challenge',report:'My Science Report',wrapup:'Wrap-up'};
 return {id:crypto.randomUUID(),block,title:kind==='video'?'Watch and Notice':kind==='image'?'Look and Think!':kind==='missing'?'What’s Missing?':title[block],mode:kind==='image'?'image':kind==='video'?'video':kind==='game'?'game':kind==='missing'?'missing':kind==='report'?'report':kind==='vocabulary'?'vocabulary':'text',layout:block==='introduction'?'picture-question':block==='vocabulary'?'vocabulary-cards':block==='prediction'?'prediction':block==='experiment'?'experiment-steps':block==='review'?'game-instructions':block==='report'?'report-instructions':block==='wrapup'?'wrap-up':'science-concept',lines:[]};
}
