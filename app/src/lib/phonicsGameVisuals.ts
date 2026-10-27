import type {PhonicsGame} from './phonicsGames';

export type PhonicsWorld = 'train'|'workshop'|'garden'|'diner'|'coast'|'island';
export type ClayProp = 'engine'|'carriage'|'robot'|'bridge'|'monster'|'boat'|'chest'|'dino'|'sprout'|'rocket'|'book'|'basket';
export const CLAY_PROPS:ClayProp[]=['engine','carriage','robot','bridge','monster','boat','chest','dino','sprout','rocket','book','basket'];
export const PHONICS_WORLDS:Record<PhonicsWorld,{ko:string;en:string;color:string;prop:ClayProp}>={
 train:{ko:'기차 마을',en:'Train Village',color:'#d9eee8',prop:'engine'},
 workshop:{ko:'장난감 공방',en:'Toy Workshop',color:'#f8e5ce',prop:'robot'},
 garden:{ko:'마법 정원',en:'Magic Garden',color:'#e9e0f5',prop:'bridge'},
 diner:{ko:'몬스터 식당',en:'Monster Cafe',color:'#f7ddd4',prop:'monster'},
 coast:{ko:'바닷가 놀이터',en:'Seaside Play',color:'#d5edf1',prop:'boat'},
 island:{ko:'탐험 섬',en:'Explorer Island',color:'#e6ecd2',prop:'dino'},
};
export interface PhonicsVisual {world:PhonicsWorld;prop:ClayProp;action:'float'|'pair'|'collect'|'repair'|'connect'|'travel'|'grow'|'feed'|'fish'|'discover'|'read';ko:string;en:string;}
const v=(world:PhonicsWorld,prop:ClayProp,action:PhonicsVisual['action'],ko:string,en:string):PhonicsVisual=>({world,prop,action,ko,en});
/** Every game has an explicit scene, movable prop and a learning-linked reaction. */
export const PHONICS_VISUALS:Record<string,PhonicsVisual>={
 'sound-balloons':v('coast','robot','float','풍선 친구를 만나러 가요','Meet the balloon friends'),
 'letter-partners':v('workshop','robot','pair','글자 친구에게 짝을 찾아줘요','Find each letter a friend'),
 'sound-baskets':v('garden','basket','collect','바구니에 소리 선물을 담아요','Gather sound gifts in a basket'),
 'letter-explorers':v('island','robot','discover','숨어 있는 글자를 발견해요','Discover the hidden letters'),
 'letter-trails':v('workshop','robot','repair','점토 글자 길을 만들어요','Make a trail through the clay'),
 'sound-train':v('train','engine','connect','객차를 연결하면 기차가 출발해요','Connect the carriages to depart'),
 'onset-change':v('workshop','robot','repair','첫 블록을 바꾸면 새 단어가 돼요','Swap the first block for a new word'),
 'family-homes':v('train','carriage','collect','같은 패밀리는 같은 객차에 타요','Each family shares a carriage'),
 'vowel-repair':v('workshop','robot','repair','모음 부품으로 장난감을 고쳐요','Repair the toy with a vowel part'),
 'sound-steps':v('garden','robot','travel','글자 발판을 이어 건너가요','Cross the stepping-letter path'),
 'magic-bridge':v('garden','bridge','connect','모음과 e를 이어 다리를 켜요','Connect the vowel and e to light the bridge'),
 'magic-lab':v('garden','sprout','grow','끝 e를 찾아 마법 꽃을 깨워요','Find final e to wake the magic flower'),
 'magic-builder':v('workshop','robot','connect','글자 조각으로 마법 장난감을 만들어요','Build a magic toy from letter pieces'),
 'magic-families':v('train','engine','collect','매직 e 친구를 같은 열차에 태워요','Board the magic e family train'),
 'rescue-e':v('garden','sprout','grow','잃어버린 e를 찾아 정원을 피워요','Find final e and help the garden bloom'),
 'blend-launch':v('island','rocket','connect','두 자음 소리를 이어 로켓을 준비해요','Join both consonant sounds to fuel the rocket'),
 'digraph-friends':v('workshop','robot','pair','두 글자가 한 소리 친구가 돼요','Two letters become one sound friend'),
 'sound-position':v('island','robot','discover','돋보기처럼 단어 속 위치를 살펴요','Explore the spelling’s place in the word'),
 'odd-friend':v('garden','basket','discover','다른 규칙의 친구를 찾아줘요','Find the friend with a different pattern'),
 'consonant-repair':v('workshop','robot','repair','빠진 자음 부품을 찾아 끼워요','Fit the missing consonant part'),
 'same-sound-roads':v('train','carriage','travel','철자에 맞는 기차역으로 보내요','Send each spelling to its station'),
 'two-oo':v('garden','book','discover','book과 moon의 소리 문을 찾아요','Find the book and moon sound gates'),
 'ow-crossroads':v('island','robot','travel','snow와 cow의 소리 길을 찾아요','Find the snow and cow sound paths'),
 'vowel-chef':v('diner','monster','feed','모음 재료를 넣어 요리를 완성해요','Add the vowel ingredient to finish cooking'),
 'r-journey':v('train','engine','travel','R 소리 여행 열차를 출발시켜요','Depart on the r-sound railway'),
 'sound-fishing':v('coast','boat','fish','단어 물고기를 낚아 올려요','Reel in the word fish'),
 'monster-diner':v('diner','monster','feed','읽은 단어를 몬스터에게 먹여요','Feed the monster the word you read'),
 'memory-cards':v('workshop','robot','pair','장난감 상자의 짝을 기억해요','Remember the pairs in the toy box'),
 'missing-card':v('island','chest','discover','보물 상자에서 사라진 카드를 찾아요','Find the card missing from the chest'),
 'picture-puzzle':v('workshop','robot','discover','점토 조각을 열어 그림을 발견해요','Uncover a picture beneath the clay pieces'),
 'sound-bingo':v('garden','sprout','grow','빙고 길을 따라 꽃을 피워요','Grow flowers along a bingo path'),
 'word-treasure':v('island','chest','discover','먼저 읽고 보물 상자를 열어요','Read first, then open the treasure'),
 'sorting-factory':v('workshop','robot','collect','규칙에 맞는 장난감 상자로 보내요','Sort words into their toy boxes'),
 'read-and-move':v('island','robot','travel','문장을 읽고 탐험 친구를 안내해요','Read and guide your explorer'),
 'sentence-bridge':v('garden','bridge','connect','문장을 이으면 다리가 완성돼요','Build a bridge with a sentence'),
 'phonics-farm':v('garden','sprout','grow','씨앗을 심고 물을 주어 수확해요','Plant, water and harvest'),
 'dino-expedition':v('island','dino','discover','발자국을 따라 공룡 친구를 만나요','Follow the tracks to a dinosaur friend'),
 'space-rescue':v('island','rocket','travel','로켓을 준비해 친구를 구하러 가요','Prepare your rocket for a rescue'),
 'phonics-island':v('island','chest','travel','해변과 숲을 지나 보물에 도착해요','Cross the island and reach the treasure'),
 'our-storybook':v('garden','book','read','한 장씩 읽어 우리 책을 완성해요','Read one page at a time to finish our book'),
};
export const worldBackground=(world:PhonicsWorld)=>`/skins/phonics-v2/${world}.webp`;
export const gameVisual=(game:PhonicsGame)=>PHONICS_VISUALS[game.id];

export interface VillageReward {world:PhonicsWorld;gameId:string;unitId:string;label:string;}
/** A shared, current-tab classroom display, never a student score or server record. */
const rewardKey='classbank.phonics.village.v2';
export function readVillageRewards():VillageReward[]{
 try{const data:unknown=JSON.parse(sessionStorage.getItem(rewardKey)??'[]');if(!Array.isArray(data))return [];return data.filter((x):x is VillageReward=>typeof x==='object'&&x!==null&&typeof x.gameId==='string'&&typeof x.unitId==='string'&&typeof x.label==='string'&&Object.hasOwn(PHONICS_WORLDS,x.world)).slice(-24);}catch{return [];}
}
export function addVillageReward(reward:VillageReward){
 const previous=readVillageRewards();const next=[...previous.filter(x=>x.gameId!==reward.gameId||x.unitId!==reward.unitId),reward].slice(-24);
 try{sessionStorage.setItem(rewardKey,JSON.stringify(next));}catch{/* Private browsing still supports the current in-memory celebration. */}
 return next;
}
