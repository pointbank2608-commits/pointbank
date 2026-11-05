import type {GameItem} from './types';
export const MAX_POP_CARDS=100;
export const MAX_ROUND_CARDS=200;
/** 라운드당 카드 수. 비어 있거나 0이면 null(= 예전처럼 낱말 전부 + POP 카드). */
export function popcornRoundCards(value?:number):number|null{
 return typeof value==='number'&&Number.isFinite(value)&&value>=1?Math.min(MAX_ROUND_CARDS,Math.round(value)):null;
}
/** Old saves retain the original 25% rule. Explicit zero is a valid practice deck.
 * roundCards가 있으면 POP 카드는 그 카드 수를 넘지 않고, 기본값은 라운드 카드의 25%다. */
export function popcornCount(words:number,value?:number,roundCards?:number):number{
 const total=popcornRoundCards(roundCards);
 const base=total??words;
 const n=typeof value==='number'&&Number.isFinite(value)?Math.min(MAX_POP_CARDS,Math.max(0,Math.round(value))):Math.max(1,Math.round(base*.25));
 return total?Math.min(n,total):n;
}
function shuffle<T>(arr:T[]):T[]{
 for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;
}
/** 한 라운드의 카드 더미. roundCards가 있으면 낱말이 몇 개든 정확히 그 장수만 만든다
 * (낱말이 모자라면 섞어서 반복, 많으면 무작위로 일부만). */
export function popcornDeck(items:GameItem[],value?:number,roundCards?:number):(GameItem|'pop')[]{
 const total=popcornRoundCards(roundCards);
 const pops=popcornCount(items.length,value,roundCards);
 if(!total||items.length===0)return shuffle([...items,...Array<'pop'>(pops).fill('pop')]);
 const wordSlots=total-pops;
 const words:GameItem[]=[];
 while(words.length<wordSlots)words.push(...shuffle([...items]));
 return shuffle([...words.slice(0,wordSlots),...Array<'pop'>(pops).fill('pop')]);
}
