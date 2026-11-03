import type {FullCardItem,PhonicsBankEntry,WordList} from './types';
import type {MaterialsHandoffState} from './materialsHandoff';
import {wordListToCards} from './gameFromWords';
import {exampleWorksheet,addKnownWorksheetSounds} from './worksheetActivitySamples';
import {replaceStudioWords,studioWordsFromCards,type WorksheetDocument} from './worksheetStudio';
export interface WorksheetSource {id:string;name:string;kind:'word'|'sentence';cards:FullCardItem[];revision:string;}
function revision(cards:FullCardItem[]){let hash=2166136261;for(const c of JSON.stringify(cards)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);}
export function worksheetSource(id:string,name:string,kind:'word'|'sentence',cards:FullCardItem[]):WorksheetSource{return {id,name,kind,cards:structuredClone(cards),revision:revision(cards)};}
export function sourceFromList(list:WordList){return worksheetSource(list.id,list.name,list.kind==='sentence'?'sentence':'word',wordListToCards(list));}
export function sourceFromHandoff(state:MaterialsHandoffState):WorksheetSource|null {
 if(!state.materialsWords?.length)return null;
 return worksheetSource(state.materialsSourceId||`handoff:${revision(state.materialsWords)}`,state.materialsSourceName||'선택한 자료',state.materialsKind==='sentence'?'sentence':'word',state.materialsWords);
}
export function rememberWorksheetSource(owner:string,source:WorksheetSource){try{sessionStorage.setItem(`${owner}:source:${source.id}`,JSON.stringify(source));}catch{/* selection remains in this page */}}
export function restoreWorksheetSource(owner:string,id:string):WorksheetSource|null {try{const s=JSON.parse(sessionStorage.getItem(`${owner}:source:${id}`)||'null');return s?.id===id&&typeof s.name==='string'&&Array.isArray(s.cards)&&s.cards.every((c:FullCardItem)=>typeof c.id==='string'&&typeof c.word==='string')?s:null;}catch{return null;}}
export function documentFromSource(id:string,source:WorksheetSource|null,bank:PhonicsBankEntry[],previous?:WorksheetDocument):WorksheetDocument {
 if(!source)return previous||exampleWorksheet(id);
 if(previous?.source?.id===source.id&&previous.source.revision===source.revision)return previous;
 const cards=source.kind==='sentence'?source.cards.map(card=>({...card,example:card.word})):source.cards;
 const fresh=replaceStudioWords(exampleWorksheet(id),studioWordsFromCards(cards,bank).map(addKnownWorksheetSounds));
 return {...fresh,source:{id:source.id,name:source.name,kind:source.kind,total:source.cards.length,revision:source.revision}};
}
