import {adventureId, type DetectiveCase, type DetectiveError} from './adventureGames';
import {baseOf, third} from './sentenceFactory';

export const DETECTIVE_RULES = [
  {id:'articles', ko:'관사 a/an', en:'Articles a/an', example:'She eats an apple every morning.', explanation:'a와 an은 바로 뒤에 오는 소리에 맞춰 써요.'},
  {id:'number', ko:'명사 단수·복수', en:'Singular and plural nouns', example:'I have two pencils.', explanation:'둘 이상을 나타낼 때는 이 명사를 복수형으로 써요.'},
  {id:'agreement', ko:'주어·동사 일치', en:'Subject–verb agreement', example:'She goes to school every day.', explanation:'현재형 동사는 주어에 맞는 형태로 써요.'},
  {id:'questions', ko:'의문문·부정문의 do', en:'Do in questions and negatives', example:'Did she go home?', explanation:'do, does, did 뒤의 본동사는 원형을 써요.'},
  {id:'tense', ko:'과거형', en:'Past tense', example:'Yesterday, she went home.', explanation:'이 동사의 과거형은 끝에 -ed를 붙이는 방식으로 만들지 않아요.'},
  {id:'prepositions', ko:'고정 전치사', en:'Fixed prepositions', example:'She depends on her team.', explanation:'이 표현에서는 동사와 짝을 이루는 전치사를 써요.'},
  {id:'pronouns', ko:'목적격 대명사', en:'Object pronouns', example:'Dad called her.', explanation:'동사의 목적어 자리에는 목적격 대명사를 써요.'},
  {id:'verb-form', ko:'조동사·동사 형태', en:'Modals and verb forms', example:'She can swim.', explanation:'이 조동사 뒤에는 to 없이 동사원형을 써요.'},
  {id:'comparison', ko:'비교급', en:'Comparatives', example:'This bag is bigger than mine.', explanation:'-er 비교급에 more를 겹쳐 쓰지 않아요.'},
] as const;
export type DetectiveRule = typeof DETECTIVE_RULES[number]['id'];
export const defaultDetectiveRules = DETECTIVE_RULES.map(rule => rule.id);
type Variant = {correct:string; incorrect:string; error:Omit<DetectiveError,'id'>; rule:DetectiveRule; explanation:string};

export function detectiveSuggestion(incorrect:string,correct:string):Omit<DetectiveError,'id'>|null {
 const a=[...incorrect.matchAll(/\S+/g)],b=[...correct.matchAll(/\S+/g)];
 if(!a.length||!b.length)return null;
 if(a.length!==b.length){
   let first=0;
   while(first<Math.min(a.length,b.length)&&a[first][0]===b[first][0])first++;
   let lastA=a.length,lastB=b.length;
   while(lastA>first&&lastB>first&&a[lastA-1][0]===b[lastB-1][0]){
     lastA--;
     lastB--;
   }
   // A pure insertion/deletion before an existing token has an unambiguous button on the board.
   if((lastA!==first&&lastB!==first)||!a[lastA]||!b[lastB])return null;
   const start=a[first].index!,end=a[lastA].index!;
   const replacement=correct.slice(b[first].index!,b[lastB].index!);
   if(incorrect.slice(0,start)+replacement+incorrect.slice(end)!==correct)return null;
   return {start,end,replacement,choices:[incorrect.slice(start,end),replacement]};
 }
 const changed=a.map((token,i)=>token[0]===b[i][0]?-1:i).filter(i=>i>=0);
 if(!changed.length||changed.at(-1)!-changed[0]+1!==changed.length)return null;
 const first=changed[0],last=changed.at(-1)!;
 const start=a[first].index!,end=a[last].index!+a[last][0].length,replacement=correct.slice(b[first].index!,b[last].index!+b[last][0].length);
 return {start,end,replacement,choices:[incorrect.slice(start,end),replacement]};
}

const singularNouns = 'apple|orange|egg|umbrella|ant|elephant|owl|banana|book|dog|cat|pencil|car|cup|box|chair|desk|kite|bag|bus|sandwich';
const pluralNouns: Record<string,string> = {apples:'apple',bananas:'banana',pencils:'pencil',cats:'cat',dogs:'dog',books:'book',boxes:'box',buses:'bus',chairs:'chair',cars:'car',bags:'bag',children:'child',teeth:'tooth',feet:'foot'};
const pluralBySingular = new Map(Object.entries(pluralNouns).map(([plural, singular]) => [singular, plural]));
const countableNouns = new Set(singularNouns.split('|'));
const actionVerbs = new Set('go come run swim walk talk write sing sleep sit stand jump climb dance smile laugh work study read cook cry wait play listen travel fly'.split(' '));
const comparativeByAdjective: Record<string,string> = {big:'bigger',small:'smaller',tall:'taller',short:'shorter',fast:'faster',slow:'slower',old:'older',young:'younger',strong:'stronger',weak:'weaker',good:'better',bad:'worse'};
const prepositionModels: Record<string,string> = {listen:'She listens to her teacher.',look:'She looks at the picture.',depend:'She depends on her team.',rely:'She relies on her team.'};
const objectToSubject: Record<string,string> = {me:'I',us:'we',him:'he',her:'she',them:'they'};
const finiteVerbs = /^(I|You|He|She|It|We|They) ([a-z]+)(?=\s|[.!?]|$)/;
const complexTail = /\b(and|or|but|if|that|not|either|neither|who|which)\b|[,;:]/i;

export function detectiveVariants(input: string, selected: readonly string[] = defaultDetectiveRules): Variant[] {
 const correct=input.trim();
 if(!/^[A-Z][a-zA-Z '’-]*(?:, [a-zA-Z '’-]+)?[.!?]?$/.test(correct))return [];
 const variants: Variant[] = [];
 function change(rule:DetectiveRule, offset:number, original:string, wrong:string, explanation?:string) {
   if(!selected.includes(rule)||original===wrong)return;
   const incorrect=correct.slice(0,offset)+wrong+correct.slice(offset+original.length);
   const error={start:offset,end:offset+wrong.length,replacement:original,choices:[wrong,original]};
   if(variants.some(v=>v.incorrect===incorrect&&v.rule===rule))return;
   variants.push({correct,incorrect,error,rule,explanation:explanation??DETECTIVE_RULES.find(r=>r.id===rule)!.explanation});
 }
 const clause=finiteVerbs.exec(correct);
 if(clause&&!complexTail.test(correct.slice(clause[0].length))){
   const [,subject,verb]=clause;
   const singular=/^(He|She|It)$/.test(subject);
   const expected=subject==='I'?'am':singular?'is':'are';
   const parsed=baseOf(verb);
   if(verb===expected && !/^[.!]?$/u.test(correct.slice(clause[0].length))){
     for(const wrong of ['is','are','am'])change('agreement',subject.length+1,verb,wrong);
   }else if(parsed?.tense==='present'&&parsed.third===singular&&!['do','read','put','cut','hit','set'].includes(parsed.base)){
     change('agreement',subject.length+1,verb,singular?parsed.base:third(parsed.base));
   }
 }
 // Known nouns let us distinguish vowel sounds and avoid guessing whether an article is required.
 for(const m of correct.matchAll(new RegExp('\\b(a|an) ('+singularNouns+')(?=[.!?]| (?:every|today|yesterday|tomorrow|on|in|at|under|after|before|with|for|near|from)\\b|$)','g'))){
   const [,article,noun]=m;
   if(article!==(/^[aeiou]/.test(noun)?'an':'a'))continue;
   change('articles',m.index!,article,article==='a'?'an':'a');
   if(/^(pencil|desk|kite|umbrella|bag|chair)$/.test(noun)){
     change('articles',m.index!,article+' ','','이 문장에서 단수 명사 앞에 a 또는 an이 필요해요.');
   }
 }
 for(const m of correct.matchAll(/\b(?:two|three|four|five|six|seven|eight|nine|ten|many) ([a-z]+)(?=[.!?]| (?:on|in|at|under|after|before|near|today)\b|$)/g)){
   if(pluralNouns[m[1]])change('number',m.index!+m[0].length-m[1].length,m[1],pluralNouns[m[1]]);
 }
 const question=/^(?:(?:Where|When|Why|How|What) )?(?:Do|Does|Did) (?:I|you|he|she|it|we|they) ([a-z]+)\b/.exec(correct);
 const negative=/^(?:I|You|He|She|It|We|They) (?:do not|does not|did not|don['’]t|doesn['’]t|didn['’]t) ([a-z]+)\b/.exec(correct);
 const doMatch=question??negative;
 if(doMatch && (!question || correct.endsWith('?'))){
   const verb=doMatch[1], parsed=baseOf(verb);
   if(parsed?.tense==='present'&&!parsed.third)change('questions',doMatch[0].length-verb.length,verb,third(verb));
 }
 const past=/^(?:Yesterday,? |Last (?:night|week|year),? )(?:I|you|he|she|it|we|they) ([a-z]+)\b/i.exec(correct);
 if(past){
   const verb=past[1], parsed=baseOf(verb);
   if(parsed?.tense==='past'&&['go','eat','take','see','buy','run','swim','write','sing','drink','find','speak'].includes(parsed.base))
     change('tense',past[0].length-verb.length,verb,parsed.base+'ed');
 }
 const prep=/\b(?:(?:depends?|depended|relies|rely|relied) on|(?:listens?|listened) to|(?:looks?|looked) at)(?= (?:the|a|an|my|your|his|her|our|their|it|us|them|him|me)\b)/g;
 for(const m of correct.matchAll(prep))change('prepositions',m.index!+m[0].length-2,m[0].slice(-2),'of');
 const object=/\b(?:called|saw|helped|met|found|thanked|invited) (me|us|him|her|them)(?=[.!?]|$)/g;
 for(const m of correct.matchAll(object))change('pronouns',m.index!+m[0].length-m[1].length,m[1],objectToSubject[m[1]]);
 const modal=/^(?:I|You|He|She|It|We|They) (?:can|could|will|would|should|must|may|might) (?:not )?([a-z]+)\b/.exec(correct);
 if(modal){
   const verb=modal[1],parsed=baseOf(verb);
   if(verb==='be'||(parsed?.tense==='present'&&!parsed.third)){
     const index=modal[0].length-verb.length;
     if(parsed)change('verb-form',index,verb,third(verb));
     change('verb-form',index,'','to ');
   }
 }
 const comparativeWords='bigger|smaller|taller|shorter|older|younger|faster|slower|longer|stronger|weaker|cheaper|easier|harder|better|worse';
 const predicative=new RegExp('\\b(?:am|is|are|was|were|looks?|seems?|feels?) ('+comparativeWords+')(?= than\\b)','g');
 const singularComparison=new RegExp('\\b(?:has|have|had) a ('+comparativeWords+')(?= (?:'+singularNouns+') than\\b)','g');
 for(const m of [...correct.matchAll(predicative),...correct.matchAll(singularComparison)]){
   change('comparison',m.index!+m[0].length-m[1].length,'','more ');
 }
 return variants;
}

export function detectiveCaseFromVariant(variant:Variant, id:string=adventureId(), context?:string):DetectiveCase {
 const {correct,incorrect,error,rule,explanation}=variant;
 return {id,correct,incorrect,errors:[{id:adventureId(),...error}],rule,context,accepted:[],explanation};
}

export function caseFromCorrect(correct:string,id:string=adventureId(),rules:readonly string[]=defaultDetectiveRules):DetectiveCase {
 const variant=detectiveVariants(correct,rules)[0];
 return variant?detectiveCaseFromVariant(variant,id):{id,correct,incorrect:'',errors:[],accepted:[],explanation:''};
}

function wordVariants(input:string, rules:readonly string[]):Variant[] {
 const word=input.toLowerCase();
 const models:string[]=[];
 if(countableNouns.has(word))models.push(`I see ${/^[aeiou]/.test(word)?'an':'a'} ${word}.`);
 const plural=pluralBySingular.get(word)??(Object.hasOwn(pluralNouns,word)?word:undefined);
 if(plural)models.push(`I see two ${plural}.`);
 if(Object.hasOwn(objectToSubject,word))models.push(`Dad called ${word}.`);
 if(Object.hasOwn(prepositionModels,word))models.push(prepositionModels[word]);
 const comparative=Object.hasOwn(comparativeByAdjective,word)?comparativeByAdjective[word]:undefined;
 if(comparative)models.push(`This one is ${comparative} than that one.`);
 const verb=baseOf(word);
 if(verb&&actionVerbs.has(verb.base)){
   models.push(`She ${third(verb.base)} every day.`, `Does she ${verb.base}?`, `She can ${verb.base}.`);
   if(verb.tense==='past')models.push(`Yesterday, she ${word}.`);
 }
 return models.flatMap(model=>detectiveVariants(model,rules));
}

export function previewDetectiveDraft(text:string, rules:readonly string[], source:'words'|'sentences'='sentences'){
 const rows=text.split(/\r?\n/).flatMap((line,index)=>{
   const [sentence,...context]=line.split('|');
   const correct=sentence.trim();
   return correct?[{index,correct,context:context.join('|').trim(),variants:source==='words'?wordVariants(correct,rules):detectiveVariants(correct,rules)}]:[];
 });
 const byRule=new Map(rules.map(rule=>[rule,[] as {variant:Variant;context:string;index:number}[]]));
 // Assign sentences with fewer eligible rules first, then balance the rule totals.
 for(const row of [...rows].sort((a,b)=>new Set(a.variants.map(v=>v.rule)).size-new Set(b.variants.map(v=>v.rule)).size)){
   const eligible=[...new Set(row.variants.map(variant=>variant.rule))];
   const rule=eligible.sort((a,b)=>byRule.get(a)!.length-byRule.get(b)!.length)[0];
   if(!rule)continue;
   const group=byRule.get(rule)!;
   const alternatives=row.variants.filter(variant=>variant.rule===rule);
   const variant=alternatives[group.length % alternatives.length];
   group.push({variant,context:row.context,index:row.index});
 }
 const groups=[...byRule.values()];
 const ready=Array.from({length:Math.max(0,...groups.map(group=>group.length))},(_,index)=>groups.flatMap(group=>group[index]?[group[index]]:[])).flat();
 return {ready,review:rows.filter(row=>!row.variants.length),counts:byRule};
}
