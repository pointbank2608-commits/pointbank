import {worksheetActivity} from './worksheetActivityCatalog';
import {addKnownWorksheetSounds} from './worksheetActivitySamples';
import {lineartUrlForWord} from './lineart';
import {isWorksheetEmpty,sentenceTokens} from './worksheetGenerators';
import {parsePattern} from './phonicsPattern';
import {phonemeParts,phonemeDistance,rhymeOfPhones,soundGroups,studioLegacyPages,worksheetIssues,type WorksheetDocument,type StudioWord} from './worksheetStudio';
import {studentBlocks} from './worksheetActivityPrinting';

const oneSound=(a:StudioWord,b:StudioWord)=>{
 const x=phonemeParts(a.phonemes),y=phonemeParts(b.phonemes);
 return a.word.toLowerCase()!==b.word.toLowerCase()&&x.length>0&&x.length===y.length&&phonemeDistance(x,y)===1;
};
/** One validated source for the student sheet, preview, counts and teacher key. */
export function prepareWorksheet(original:WorksheetDocument){
 const activity=worksheetActivity(original.activityId)!;const id=original.activityId;
 let words=original.words.map(addKnownWorksheetSounds);
 if(original.selectedWordIds)words=words.filter(w=>original.selectedWordIds!.includes(w.id));
 else if(id==='frayer')words=words.slice(0,1);
 const validSounds=(w:StudioWord)=>!!soundGroups(w.word,w.sounds||'');
 const hasPhones=(w:StudioWord)=>phonemeParts(w.phonemes).length>0;
 if(['pictureMatch','readMatch','listenChoice','difference','barrier','pictureWrite','memory','basic-cutPaste'].includes(id))words=words.filter(w=>!!w.imageUrl);
 if(['basic-coloring','listenColor'].includes(id))words=words.map(w=>({...w,lineartUrl:w.lineartUrl===undefined?lineartUrlForWord(w.word):w.lineartUrl})).filter(w=>!!w.lineartUrl);
 if(id==='soundBoxes')words=words.filter(validSounds);
 if(id==='syllables')words=words.filter(w=>!!w.syllables&&w.syllables.replaceAll('|','').toLowerCase()===w.word.toLowerCase()&&Number.isInteger(w.stress)&&w.stress!>=1&&w.stress!<=w.syllables.split('|').length);
 if(id==='morphology')words=words.filter(w=>!!w.parts&&w.parts.replaceAll('|','').toLowerCase()===w.word.toLowerCase());
 if(['readMatch','sentenceOrder'].includes(id))words=words.filter(w=>!!sentenceTokens(w.example));
 if(id==='targetLetters')words=words.filter(w=>!!w.patternMarked&&parsePattern(w.patternMarked).some(p=>p.marked)&&parsePattern(w.patternMarked).map(p=>p.text).join('').toLowerCase()===w.word.toLowerCase());
 if(id==='rhyme')words=words.filter(w=>!!rhymeOfPhones(w));
 if(id==='soundSort')words=words.filter(w=>!!w.soundGroup);
 if(['wordSearch','scramble'].includes(id))words=words.filter(w=>/^[a-z]{3,12}$/i.test(w.word));
 if(id==='collocations')words=words.filter(w=>!!w.partner?.trim()&&/^[a-z][a-z '-]*$/i.test(w.partner.trim()));
 if(id==='meaningPairs')words=words.filter(w=>!!(w.partner||w.meaning)?.trim()).map(w=>({...w,partner:w.partner||w.meaning}));
 if(id==='minimalPairs')words=words.flatMap(w=>{
   if(!validSounds(w)||!hasPhones(w))return [];
   const explicit={...w,word:w.partner||'',sounds:w.partnerSounds,phonemes:w.partnerPhonemes};
   const partner=w.partner?explicit:words.find(other=>validSounds(other)&&oneSound(w,other));
   return partner&&validSounds(partner)&&oneSound(w,partner)?[{...w,partner:partner.word,partnerSounds:partner.sounds,partnerPhonemes:partner.phonemes}]:[];
 });
 if(id==='wordChain'){
   const pool=words.filter(w=>validSounds(w)&&hasPhones(w));let best:StudioWord[]=[];
   for(const start of pool){const chain=[start];let next:StudioWord|undefined;
     while((next=pool.find(w=>!chain.includes(w)&&oneSound(chain.at(-1)!,w))))chain.push(next);
     if(chain.length>best.length)best=chain;
   }words=best.length>=2?best:[];
 }
 let doc={...original,words};
 if(original.words.length!==words.length||words.some((w,i)=>w.id!==original.words[i]?.id)){
   const ids=new Set(words.map(w=>w.id));doc={...doc,tasks:doc.tasks.filter(t=>!t.wordId||ids.has(t.wordId))};
 }
 let legacy=studioLegacyPages(doc);
 // Legacy generators can legitimately use only a subset (e.g. rhyme, odd-one-out).
 if(activity.legacy&&legacy.length){
   const used=new Set<string>();const known=new Set(words.map(w=>w.word));
   const collect=(value:unknown):void=>{if(typeof value==='string'&&known.has(value))used.add(value);else if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')Object.values(value).forEach(collect);};
   legacy.forEach(data=>collect(data));
   if(['soundSort','rhyme','wordSearch','targetLetters','basic-coloring'].includes(id)){
     words=words.filter(w=>used.has(w.word));doc={...doc,words};legacy=studioLegacyPages(doc);
   }
 }
 const pages=activity.legacy?legacy.reduce((n,data)=>n+(isWorksheetEmpty(data)?0:('pages' in data?data.pages.length:'books' in data?data.books.length:1)*(data.kind==='cutPaste'?2:1)),0):studentBlocks(doc).length;
 let issues=worksheetIssues(doc);
 if(!pages&&!issues.some(i=>i.key==='noTasks'))issues=[...issues,{key:'noTasks'}];
 if(id==='minimalPairs'&&!words.length&&!issues.length)issues=[{key:'noTasks'}];
 const ready=pages>0&&issues.length===0;
 return {doc,legacy,pages:ready?pages:0,issues,ready,usedCount:activity.mode==='content'?0:words.length,totalCount:Math.max(original.source?.total??0,original.words.length),excluded:original.words.filter(w=>!words.some(x=>x.id===w.id))};
}

export function worksheetRequirement(id:string){
 if(id==='sentenceOrder'||id==='readMatch')return 'sentences';
 if(['soundBoxes','wordChain','minimalPairs','rhyme'].includes(id))return 'sounds';
 if(id==='syllables')return 'stress';
 if(id==='soundSort')return 'groups';
 if(id==='targetLetters')return 'pattern';
 if(id==='collocations')return 'partners';
 if(['basic-coloring','listenColor'].includes(id))return 'lineart';
 if(['pictureMatch','basic-cutPaste','listenChoice'].includes(id))return 'pictures';
 return 'content';
}
