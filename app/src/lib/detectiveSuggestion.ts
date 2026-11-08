import {adventureId, type DetectiveCase, type DetectiveError} from './adventureGames';
import {baseOf, third} from './sentenceFactory';
import {ingForm} from './grammar';
/** Conservative whole-token comparison. Insertions/deletions and separated edits need teacher review. */
export function detectiveSuggestion(incorrect:string,correct:string):Omit<DetectiveError,'id'>|null {
 const a=[...incorrect.matchAll(/\S+/g)],b=[...correct.matchAll(/\S+/g)];
 if(!a.length||a.length!==b.length)return null;
 const changed=a.map((token,i)=>token[0]===b[i][0]?-1:i).filter(i=>i>=0);
 if(!changed.length||changed.at(-1)!-changed[0]+1!==changed.length)return null;
 const first=changed[0],last=changed.at(-1)!;
 const start=a[first].index!,end=a[last].index!+a[last][0].length,replacement=correct.slice(b[first].index!,b[last].index!+b[last][0].length);
 return {start,end,replacement,choices:[incorrect.slice(start,end),replacement]};
}

export function caseFromCorrect(correct: string, id: string = adventureId()): DetectiveCase {
 const variant=detectiveVariants(correct)[0];
 return {id,correct,incorrect:variant?.incorrect??'',errors:variant?[{id:adventureId(),...variant.error}]:[],accepted:[],explanation:''};
}

/** Only change the finite verb in an affirmative, simple pronoun clause. */
export function detectiveVariants(input: string) {
 const correct=input.trim();
 const m=/^(I|You|He|She|It|We|They) ([a-z]+)( [a-z]+(?: [a-z]+)*)?\.$/.exec(correct);
 if(!m || /\b(and|or|but|if|that|than|not|never|either|neither|who|which)\b/.test(m[3]??''))return [];
 const [,subject,verb,tail='']=m;
 const singular=/^(He|She|It)$/.test(subject);
 const expected=subject==='I'?'am':singular?'is':'are';
 const parsed=baseOf(verb);
 let wrong: string[]=[];
 if(verb===expected && tail) wrong=['am','is','are'].filter(v=>v!==verb);
 else if(parsed?.tense==='present' && parsed.third===singular && parsed.base!=='do'){
   if(singular) wrong=[...(['read','put','cut'].includes(parsed.base)?[]:[parsed.base]), ingForm(parsed.base)];
   else wrong=[third(parsed.base),ingForm(parsed.base)];
 }
 // Past forms can be valid in the same context. Never propose one as a mistake.
 return wrong.filter(v=>v!==verb && (v===parsed?.base || !parsed || baseOf(v)?.tense==='present' || v===ingForm(parsed.base))).flatMap(v=>{
  const incorrect=`${subject} ${v}${tail}.`;
  const error=detectiveSuggestion(incorrect,correct);
  return error && incorrect.slice(0,error.start)+error.replacement+incorrect.slice(error.end)===correct ? [{correct,incorrect,error}] : [];
 });
}
