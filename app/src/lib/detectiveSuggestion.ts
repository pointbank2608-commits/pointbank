import type {DetectiveError} from './adventureGames';
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
