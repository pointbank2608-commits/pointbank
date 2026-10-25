import { ELEMENTARY800_VERB_CONTINUATION } from '../data/elementary800VerbContinuation';
import words from '../data/elementary800Words.json';
import { WORKBOOK_COLOR_PATHS } from './workbookImageManifest';
import type { WordBankEntry } from './types';

/** Canonical 048 list; a/an share number 1. Never infer membership from level/origin. */
export const ELEMENTARY800 = new Map(words.map(row => [row.word.toLowerCase(), row.no]));
export const ORIGINAL_VERBS = [
 'be go come run walk jump sit stand see look hear listen play like love want make do give take help thank say ask open',
 'fly swim dance climb catch throw hold carry kick hit laugh cry smile sing draw paint write read learn teach cook buy sell show watch',
 'arrive forget remember think know understand speak tell introduce meet build fix close fill cover turn slide pull push wait wear wash join blow burn',
 'become begin end start finish grow die march excite surprise matter handle knock cut clean count cross follow feel hate hope hurt practice study try',
].map(line => line.split(' '));
function elementaryNumber(row:WordBankEntry):number|undefined {
 const no=ELEMENTARY800.get(row.word.trim().toLowerCase());
 // Current dictionary rows explicitly mark the 800-list senses. Older schemas
 // and the reviewed continuation omit this column and use the canonical word map.
 if(row.moe800_no!==undefined && row.moe800_no!==no)return undefined;
 return no;
}
const existingPictures=new Set(WORKBOOK_COLOR_PATHS);
/** Prefer the exact dictionary sense ID; never borrow another meaning's picture. */
function pictureOf(row:WordBankEntry):string|null {
 const local=`/word-bank-images/${row.id}.webp`;
 return row.image_url?.replace(/^(\/word-bank-images\/.+)\.png$/, '$1.webp') || (existingPictures.has(local)?local:null);
}
const originalVerbSet = new Set(ORIGINAL_VERBS.flat());
export const POS_ORDER = ['verb','noun','adjective','adverb','pronoun','preposition','conjunction','determiner','number','interjection','auxiliary','interrogative','other'] as const;
export type WorkbookPos = typeof POS_ORDER[number];
const aliases: Record<string,WorkbookPos> = { '동사':'verb','명사':'noun','형용사':'adjective','부사':'adverb','대명사':'pronoun','전치사':'preposition','접속사':'conjunction','관사':'determiner','한정사':'determiner','수사':'number','감탄사':'interjection','조동사':'auxiliary','의문사':'interrogative', verb:'verb', noun:'noun', adjective:'adjective', adverb:'adverb', pronoun:'pronoun', preposition:'preposition', conjunction:'conjunction', article:'determiner', determiner:'determiner', numeral:'number', interjection:'interjection', auxiliary:'auxiliary' };
export function partsOfSpeech(value:string): WorkbookPos[] {
 return [...new Set(value.split(/[,/·ㆍ;|&]+/).map(s=>aliases[s.trim().toLowerCase()] ?? 'other'))];
}
export interface WorkbookWord extends WordBankEntry { elementaryNo:number; difficulty:number; }
export interface VocabularyBooklet { id:string;pos:WorkbookPos;level:number;entries:WorkbookWord[]; }
/** Sort once by dictionary difficulty, then stable existing curriculum order. No random sorting or mutations. */
export function buildElementaryBooklets(bank:WordBankEntry[]):VocabularyBooklet[] {
 const groups=new Map<WorkbookPos,Map<string,WorkbookWord>>();
 for(const row of bank){
  const key=row.word.trim().toLowerCase(),no=elementaryNumber(row);
  if(!no || !row.meaning?.trim())continue;
  for(const pos of partsOfSpeech(row.part_of_speech || '')){
   if(pos==='verb'&&originalVerbSet.has(key))continue;
   const group=groups.get(pos)??new Map<string,WorkbookWord>();groups.set(pos,group);
   const prev=group.get(key);
   if(!prev || row.sense_number<prev.sense_number || (row.sense_number===prev.sense_number && row.id.localeCompare(prev.id)<0))
    group.set(key,{...row,image_url:pictureOf(row),elementaryNo:no,difficulty:Math.min(4,Math.max(1,row.level??1))});
  }
 }
 return POS_ORDER.flatMap(pos=>{
  const entries=[...(groups.get(pos)?.values()??[])].sort((a,b)=>a.difficulty-b.difficulty || a.elementaryNo-b.elementaryNo || a.id.localeCompare(b.id));
  const levels:VocabularyBooklet[]=[];
  for(let i=0;i<entries.length;i+=25){const level=i/25+(pos==='verb'?5:1);levels.push({id:`${pos}-${level}`,pos,level,entries:entries.slice(i,i+25)});}
  return levels;
 });
}
export function chunkWorkbook<T>(list:T[],size:number):T[][] {const pages:T[][]=[];for(let i=0;i<list.length;i+=size)pages.push(list.slice(i,i+size));return pages;}
export function elementaryCoverage(bank:WordBankEntry[]) {return new Set(bank.filter(w=>w.meaning?.trim()).map(w=>elementaryNumber(w)).filter(Boolean)).size;}
export function bookPageCount(book:VocabularyBooklet,kind:string,cover:boolean,guide:boolean,copies:number){return Number(cover)+Number(guide)+(kind!=='writing'?Math.ceil(book.entries.length/16)*copies:0)+(kind!=='cards'?Math.ceil(book.entries.length/4):0);}

/** Keep the printed continuation stable, while other parts reuse the live dictionary. */
export function workbookBankWithVerbContinuation(bank:WordBankEntry[]):WordBankEntry[] {
 const ids=new Set(ELEMENTARY800_VERB_CONTINUATION.map(w=>w.id));
 return [...bank.filter(w=>!ids.has(w.id)),...ELEMENTARY800_VERB_CONTINUATION];
}
