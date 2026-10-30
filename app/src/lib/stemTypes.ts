import type {FullCardItem, GameType, LessonSlide} from './types';

export const STEM_BLOCKS = ['introduction','concept','vocabulary','prediction','experiment','review','report','wrapup'] as const;
export type StemBlock = typeof STEM_BLOCKS[number];
export const STEM_LAYOUTS = ['cover','picture-question','science-concept','vocabulary-cards','speaking','prediction','experiment-steps','results','game-instructions','report-instructions','wrap-up'] as const;
export type StemLayout = typeof STEM_LAYOUTS[number];
export interface StemReport {
 mascotUrl?:string;
 title:string; question:string; prediction:string; result:string;
 steps:{id:string;text:string;imageUrl:string}[];
 questions:{id:string;prompt:string;options:string[];answer:string}[];
 wordBank:string[]; sentences:string[]; showWordBank:boolean;
}
export interface StemFrame {
 metaOverride?:StemMeta;
 id:string; block:StemBlock; layout:StemLayout; title:string; lines:string[];
 mode:'image'|'text'|'vocabulary'|'missing'|'report'|'video'|'game'|'existing';
 imageUrl?:string; imagePath?:string; originalImageUrl?:string; illustrations?:{imageUrl:string;caption:string}[];
 /** Optional full-bleed scene; student text stays editable above it. */
 backgroundUrl?:string;
 /** Optional per-block report; older lessons continue using stemMeta.report. */
 report?:StemReport;
 videoUrl?:string; gameType?:GameType; templateId?:string; vocabularyIds?:string[];
 /** Preserve other existing lesson blocks when a teacher combines activities in My Lessons. */
 existing?:LessonSlide;
}
export interface StemMeta {
 presentation?:'science-lab'; reviewSample?:boolean;
 mascotUrl?:string;
 schema:1; sourceId:string; title:string; description:string; grade:string; level:string; duration:number;
 language:'en'; category:string; objectives:string[]; materials:string[]; safety:string[];
 vocabulary:FullCardItem[]; report:StemReport; ownerId:string|null; visibility:'provided'|'academy'; published:boolean;
}
export interface StemLesson {meta:StemMeta;frames:StemFrame[]}
export interface StemSlide {id:string;kind:'stem';frame:StemFrame;stemMeta:StemMeta}
