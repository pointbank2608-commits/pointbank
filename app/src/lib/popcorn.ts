import type {GameItem} from './types';
export const MAX_POP_CARDS=100;
/** Old saves retain the original 25% rule. Explicit zero is a valid practice deck. */
export function popcornCount(words:number,value?:number):number{
 return typeof value==='number'&&Number.isFinite(value)?Math.min(MAX_POP_CARDS,Math.max(0,Math.round(value))):Math.max(1,Math.round(words*.25));
}
export function popcornDeck(items:GameItem[],value?:number):(GameItem|'pop')[]{
 const deck:(GameItem|'pop')[]=[...items,...Array<'pop'>(popcornCount(items.length,value)).fill('pop')];
 for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}return deck;
}
