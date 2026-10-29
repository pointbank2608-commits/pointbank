import { courseUnits, pictureContext, type CourseUnit } from '../data/phonicsLessons';
import { PHONICS_RULES, curriculumEntries } from '../data/phonicsCurriculum';
import type { PhonicsBankEntry } from './types';

export type PhonicsMechanic = 'choice'|'pairs'|'sort'|'hunt'|'trace'|'build'|'change'|'fill'|'bridge'|'lab'|'position'|'odd'|'memory'|'missing'|'puzzle'|'bingo'|'read'|'sentence'|'adventure';
export interface PhonicsGame {
 id:string; number:number; ko:string; en:string; stages:number[]; mechanic:PhonicsMechanic; icon:string;
 goal:[string,string]; rules?:string[]; theme?:string;
}
const game=(number:number,id:string,ko:string,en:string,stages:number[],mechanic:PhonicsMechanic,icon:string,goal:[string,string],rules?:string[],theme?:string):PhonicsGame=>({number,id,ko,en,stages,mechanic,icon,goal,rules,theme});
export const PHONICS_GAMES:PhonicsGame[]=[
 game(1,'sound-balloons','소리 풍선','Sound Balloons',[1],'choice','celebration',['대표 단어를 듣고 목표 글자를 찾아요.','Hear a sample word and find its target letter.']),
 game(2,'letter-partners','알파벳 짝꿍','Letter Partners',[1],'pairs','join',['대문자와 소문자를 연결해요.','Match uppercase and lowercase letters.']),
 game(3,'sound-baskets','소리 바구니','Sound Baskets',[1],'sort','shopping_basket',['그림 단어를 목표 글자 바구니에 넣어요.','Sort words by their target letter.']),
 game(4,'letter-explorers','글자 탐험대','Letter Explorers',[1],'hunt','search',['여러 글자 속에서 같은 대소문자를 모두 찾아요.','Find every uppercase and lowercase target letter.']),
 game(5,'letter-trails','글자 길 그리기','Letter Trails',[1],'trace','draw',['글자를 따라 쓰고 선생님과 확인해요.','Trace a letter and check it with your teacher.']),
 game(6,'sound-train','소리 기차','Sound Train',[2],'build','train',['첫소리와 워드패밀리를 연결해요.','Join an onset and a word family.']),
 game(7,'onset-change','첫소리 변신','Onset Switch',[2],'change','swap_horiz',['첫 글자를 바꾸어 같은 패밀리의 단어를 만들어요.','Change the onset to make another family word.']),
 game(8,'family-homes','워드패밀리 집','Word Family Homes',[2],'sort','home',['같은 워드패밀리끼리 모아요.','Sort words into word families.']),
 game(9,'vowel-repair','모음 수리소','Vowel Repair',[2],'fill','build',['빠진 단모음을 넣어요.','Replace a missing short vowel.']),
 game(10,'sound-steps','소리 발판','Word Steps',[2],'build','stairs',['글자 발판을 순서대로 밟아 단어를 완성해요.','Choose letter steps in spelling order.']),
 game(11,'magic-bridge','매직 e 다리','Magic E Bridge',[3],'bridge','conversion_path',['단어 안의 모음과 끝 e를 연결해요.','Connect the vowel to the final e.']),
 game(12,'magic-lab','매직 e 연구소','Magic E Lab',[3],'lab','science',['끝 e를 찾아 모음과의 관계를 확인해요.','Find final e and explore the vowel pattern.']),
 game(13,'magic-builder','매직 e 조립소','Magic E Builder',[3],'build','extension',['모음과 e의 자리를 지키며 조립해요.','Build a word, keeping vowel and e in place.']),
 game(14,'magic-families','패밀리 열차','Magic Family Train',[3],'sort','train',['같은 매직 e 패밀리 단어를 태워요.','Sort words by magic e family.']),
 game(15,'rescue-e','끝 e 구조대','Rescue Final E',[3],'fill','health_and_safety',['단어 끝에서 빠진 e를 되찾아요.','Restore the missing final e.']),
 game(16,'blend-launch','두 소리 출발!','Blend Launch',[4],'build','rocket_launch',['자음군의 두 글자를 나누어 조립하고 두 소리를 말해요.','Build a consonant blend and say both sounds.'],['blend-bl','blend-cl','blend-fl','blend-gl','blend-pl','blend-br','blend-cr','blend-dr','blend-fr','blend-gr','blend-pr','blend-tr','blend-st_initial','blend-sk_initial','blend-sk_final','blend-mp_final','blend-nd_final','blend-nk_final']),
 game(17,'digraph-friends','한 소리 친구','Digraph Friends',[4],'fill','group',['한 소리를 나타내는 글자 묶음을 넣어요.','Fill a spelling unit that represents one sound.'],['blend-sh','blend-ch','th-voiceless','th-voiced','blend-ng']),
 game(18,'sound-position','앞뒤 소리 탐정','Sound Position',[4],'position','search',['목표 철자가 단어의 앞·뒤 어디에 있는지 찾아요.','Find the target spelling at the start or end.']),
 game(19,'odd-friend','다른 친구 찾기','Odd Friend Out',[2,3,4,5],'odd','person_search',['철자 규칙이 다른 단어를 찾아요.','Find the word with a different spelling pattern.']),
 game(20,'consonant-repair','자음 조각 수리','Consonant Repair',[4],'fill','construction',['빠진 자음군이나 이중자음을 넣어요.','Restore the missing consonant spelling.']),
 game(21,'same-sound-roads','같은 소리 두 길','Same Sound Roads',[5],'sort','alt_route',['같은 소리라도 철자에 따라 다른 길로 보내요.','Sort a shared sound by its different spellings.'],['vowel-ee','vowel-ea','vowel-ai','vowel-ay','vowel-oa','ow-long-o','vowel-oi','vowel-oy','vowel-ou','ow-diphthong']),
 game(22,'two-oo','두 소리 oo','Two OO Sounds',[5],'sort','hearing',['book의 oo와 moon의 oo를 구별해요.','Separate oo as in book from oo as in moon.'],['oo-short','oo-long']),
 game(23,'ow-crossroads','ow 갈림길','OW Crossroads',[5],'sort','signpost',['snow의 ow와 cow의 ow를 비교해요.','Compare ow as in snow and ow as in cow.'],['ow-long-o','ow-diphthong']),
 game(24,'vowel-chef','모음 조합 요리사','Vowel Chef',[5],'fill','restaurant',['단어를 듣고 필요한 모음 조합을 넣어요.','Hear a word and add its vowel spelling.']),
 game(25,'r-journey','R 소리 여행','R Sound Journey',[5],'choice','explore',['R 모음 단어를 듣고 찾아요.','Listen for words with r-controlled vowels.'],['vowel-ar','vowel-er','vowel-ir','vowel-or','vowel-ur']),
 game(26,'sound-fishing','소리 낚시','Sound Fishing',[1,2,3,4,5],'choice','set_meal',['들은 단어의 그림을 낚아요.','Catch the picture of the spoken word.']),
 game(27,'monster-diner','몬스터 식당','Monster Diner',[1,2,3,4,5],'read','pets',['단어를 읽고 알맞은 그림을 먹이로 줘요.','Read a word and feed the matching picture.']),
 game(28,'memory-cards','기억 카드','Memory Cards',[1,2,3,4,5],'memory','view_carousel',['그림과 단어의 위치를 기억해 연결해요.','Remember and pair pictures with words.']),
 game(29,'missing-card','사라진 카드','Missing Card',[1,2,3,4,5],'missing','visibility_off',['카드를 기억한 다음 사라진 단어를 찾아요.','Remember the cards and find the missing word.']),
 game(30,'picture-puzzle','그림 퍼즐','Picture Puzzle',[1,2,3,4,5],'puzzle','extension',['그림 조각을 열고 단어를 찾아요.','Uncover a picture and find its word.']),
 game(31,'sound-bingo','소리 빙고','Sound Bingo',[1,2,3,4,5],'bingo','grid_on',['들은 단어를 찾아 빙고 줄을 만들어요.','Find spoken words and complete a bingo line.']),
 game(32,'word-treasure','단어 보물찾기','Word Treasure',[2,3,4,5],'read','diamond',['그림 없이 단어를 읽은 뒤 보물을 찾아요.','Read first, then find the matching treasure.']),
 game(33,'sorting-factory','소리 분류 공장','Spelling Factory',[1,2,3,4,5],'sort','factory',['단어를 오늘 배운 철자 규칙별로 보내요.','Route words by the spelling patterns learned today.']),
 game(34,'read-and-move','읽고 움직여','Read and Move',[1,4],'read','touch_app',['승인된 문장을 읽고 장면의 대상을 찾아요.','Read an approved sentence and find its object.']),
 game(35,'sentence-bridge','문장 다리','Sentence Bridge',[1,4],'sentence','linear_scale',['승인된 문장의 단어를 순서대로 놓아요.','Arrange words from an approved sentence.']),
 game(36,'phonics-farm','파닉스 농장','Phonics Farm',[1,2,3,4,5],'adventure','agriculture',['씨앗·물주기·수확 미션을 완수해요.','Complete planting, watering and harvest missions.'],undefined,'farm'),
 game(37,'dino-expedition','공룡 탐험','Dino Expedition',[1,2,3,4,5],'adventure','landscape',['발자국·알·공룡 발견 미션에 도전해요.','Follow tracks, discover eggs and meet a dinosaur.'],undefined,'dino'),
 game(38,'space-rescue','우주 구조대','Space Rescue',[1,2,3,4,5],'adventure','rocket_launch',['연료·수리·구조 미션을 해결해요.','Complete fuel, repair and rescue missions.'],undefined,'space'),
 game(39,'phonics-island','파닉스 섬','Phonics Island',[1,2,3,4,5],'adventure','map',['해변에서 숲을 지나 보물에 도착해요.','Travel from the beach through the forest to treasure.'],undefined,'island'),
 game(40,'our-storybook','우리 이야기책','Our Storybook',[1,4],'adventure','auto_stories',['승인된 문장을 읽고 이야기책을 완성해요.','Read approved sentences and complete a storybook.'],undefined,'book'),
];

export const phonicsGameUnits=()=>courseUnits(curriculumEntries(false));
export const gameName=(g:PhonicsGame,en:boolean)=>en?g.en:g.ko;
export const groupOf=(u:CourseUnit,e:PhonicsBankEntry)=>u.groups.find(g=>g.entries.some(x=>x.id===e.id))!;
export function groupLabel(u:CourseUnit,e:PhonicsBankEntry){return groupOf(u,e).label;}
export function gamePool(g:PhonicsGame,u:CourseUnit){
 // OW comparison explicitly combines the two confirmed OW groups; no other later words are added.
 const base=g.id==='ow-crossroads'?phonicsGameUnits().filter(x=>x.step===5).flatMap(x=>x.entries):u.entries;
 const allowed=g.rules?base.filter(e=>g.rules!.includes(e.ruleId!)):base;
 return [...new Map(allowed.map(e=>[e.id,e])).values()];
}
export function gameAvailability(g:PhonicsGame,u:CourseUnit,en=false):string|null{
 if(!g.stages.includes(u.step))return en?'Choose a matching level.':'이 게임에 맞는 단계를 선택해 주세요.';
 if(g.id==='ow-crossroads'&&u.number<6)return en?'Review in Level 5 Unit 6, after learning both OW sounds.':'두 ow 발음을 배운 5단계 Unit 6부터 복습해요.';
 if(['read-and-move','sentence-bridge','our-storybook'].includes(g.id)&&u.reading.status!=='approved')return en?'Reading sentences are awaiting review.':'이 유닛의 읽기 문장은 검토 중이에요.';
 const pool=gamePool(g,u);if(!pool.length)return en?'Choose a unit with this spelling pattern.':'해당 규칙이 있는 유닛을 선택해 주세요.';
 if(['sound-fishing','monster-diner','word-treasure','picture-puzzle','memory-cards'].includes(g.id)&&pool.filter(pictureEligible).length<2)return en?'This game needs two words with clear pictures.':'명확한 그림이 있는 단어가 2개 이상 필요해요.';
 const distinct=new Set(pool.map(e=>e.word.toLowerCase())).size;
 if(['choice','read','memory','missing','puzzle','bingo'].includes(g.mechanic)&&distinct<2)return en?'This game needs two different words.':'서로 다른 단어가 2개 이상 필요해요.';
 if(['sort','odd'].includes(g.mechanic)){
  const groups=new Set(pool.map(e=>patternKey(u,e)));
  if(groups.size<2)return en?'Choose a unit with two spelling groups.':'규칙·패밀리가 2개 이상인 유닛에서 할 수 있어요.';
 }
 return null;
}
export function shuffled<T>(items:T[],seed:number):T[]{const a=[...items];let n=(seed>>>0)||1;for(let i=a.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)>>>0;const j=n%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function targetText(e:PhonicsBankEntry){return (e.targets??[]).map(i=>e.word[i]).join('');}
/** Alphabet Q is written Q/q while its model words highlight qu. */
export function alphabetGlyph(e:PhonicsBankEntry){return e.ruleId?.startsWith('letter-')?e.ruleId.slice(7):targetText(e);}
export function patternKey(u:CourseUnit,e:PhonicsBankEntry):string{
 const group=u.groups.find(g=>g.entries.some(x=>x.id===e.id));
 if(group)return group.id;
 return e.ruleId!; // cross-unit OW uses distinct rule IDs
}
export function patternLabel(u:CourseUnit,e:PhonicsBankEntry):string{
 return u.groups.some(g=>g.entries.some(x=>x.id===e.id))?groupLabel(u,e):e.rule;
}
/** 빈칸 게임에서 한 낱말의 빈칸 위치·정답·가려진 모양. 한 문제에 낱말이 여러 개인 규칙(batch)도 같은 계산을 쓴다. */
export function blankOf(g:Pick<PhonicsGame,'id'>,entry:PhonicsBankEntry){
 let positions=entry.targets??[];
 if(g.id==='vowel-repair')positions=[...entry.word].flatMap((c,i)=>/[aeiou]/i.test(c)?[i]:[]);
 if(g.id==='rescue-e')positions=[entry.word.length-1];
 const answer=positions.map(i=>entry.word[i]).join('');
 const masked=[...entry.word].map((c,i)=>positions.includes(i)?'_':c).join('');
 return {answer,masked,positions};
}
export interface GameRound {entry:PhonicsBankEntry;options:PhonicsBankEntry[];tokens:string[];answer:string;masked:string;source?:PhonicsBankEntry;sentence?:string;}
export function makeRound(g:PhonicsGame,u:CourseUnit,index:number,seed:number):GameRound{
 const pool=gamePool(g,u);if(!pool.length)throw new Error('No eligible phonics entries');
 const sequence=shuffled(pool,seed);let entry=sequence[index%sequence.length];
 const picturePool=pool.filter(e=>e.image_url&&!pictureContext(e));
 if(['choice','read','memory','puzzle'].includes(g.mechanic)&&g.id!=='sound-balloons'&&picturePool.length>=2)entry=shuffled(picturePool,seed)[index%picturePool.length];
 let source:PhonicsBankEntry|undefined;
 if(g.mechanic==='change'){
  const candidates=pool.filter(e=>pool.some(x=>x.id!==e.id&&patternKey(u,x)===patternKey(u,e)));
  entry=shuffled(candidates,seed)[index%candidates.length];source=pool.find(e=>e.id!==entry.id&&patternKey(u,e)===patternKey(u,entry));
 }
 const optionPool=['sound-fishing','monster-diner','word-treasure','picture-puzzle'].includes(g.id)?picturePool:pool;
 const unique=[...new Map(optionPool.filter(e=>e.word!==entry.word).map(e=>[e.word,e])).values()];
 const options=shuffled([entry,...shuffled(unique,seed+index+31).slice(0,3)],seed+index+17);
 const {answer,masked,positions}=blankOf(g,entry);
 let tokens=[...entry.word];
 if(g.id==='sound-train'){
  const family=groupOf(u,entry).label.replace(/^-/,'');const onset=entry.word.slice(0,-family.length);tokens=onset?[onset,family]:[family];
 }else if(g.id==='blend-launch'){
  // Blend targets remain separate letters, unlike digraph tiles.
  tokens=[...entry.word];
 }else if(g.mechanic==='build'&&u.step>=4){
  tokens=[];for(let i=0;i<entry.word.length;){if(positions.includes(i)){let j=i+1;while(positions.includes(j))j++;tokens.push(entry.word.slice(i,j));i=j;}else tokens.push(entry.word[i++]);}
 }
 let sentence:string|undefined;
 if(['read-and-move','sentence-bridge','our-storybook'].includes(g.id)){
  if(u.reading.status!=='approved')throw new Error('Draft reader cannot enter a game');
  const n=index%u.reading.entries.length;entry=u.reading.entries[n];sentence=u.reading.sentences[n];
  return {entry,options:shuffled(u.reading.entries,seed+index),tokens:sentence.split(/\s+/),answer:sentence,masked:'',sentence};
 }
 return {entry,options,tokens,answer,masked,source};
}
export const pictureEligible=(e:PhonicsBankEntry)=>Boolean(e.image_url&&!pictureContext(e));
export const phonicsRule=(id:string)=>PHONICS_RULES.find(r=>r.id===id);
