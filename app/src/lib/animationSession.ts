import type { VideoClip } from './videoClips';
import type { AnimationExpression, VideoSlide } from './types';
import { parseShadowText } from './shadowLines';
import type { EpisodeMaterial } from './animationEpisodes';
import { sceneQuestions, sceneTeaching } from './animationScene';
import {chapterTeaching} from '../data/animationChapterTeaching';

/** A lesson owns its selection; catalog chapters remain immutable. */
export function animationEpisodeWords(chapters: VideoClip[], saved: VideoSlide['animationSession']) {
  return [...new Map([...chapters.flatMap(c => c.pack.words ?? []), ...(saved?.words ?? [])]
    .map(word => [word.word + '|' + word.meaning, word])).values()];
}

export function animationEpisodeSource(chapters: VideoClip[]) {
  return [...new Set(chapters.map(chapter => chapter.script).filter(Boolean))].join('\n');
}

export function animationPracticeLines(source: string, start = 0, end = Infinity) {
  // Untimed text must never acquire the parser's synthetic 3-second timing.
  const timed=source.split(/\r?\n/).filter(line=>/^\s*\[\d{1,3}:\d{2}(?:\.\d+)?\s*[-–—]\s*\d{1,3}:\d{2}/.test(line)).join('\n');
  const unique = new Map(parseShadowText(timed)
    .filter(line => line.start >= start && line.end <= end)
    .map(line => [`${line.start}|${line.end}|${line.en}`, line]));
  return [...unique.values()].sort((a, b) => a.start - b.start || a.end - b.end);
}

export function animationRangeInvalid(start: number, end: number, duration: number) {
  return !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || (duration > 0 && end > duration);
}

export function animationExpressionFits(sentence: string, expression: AnimationExpression) {
  const normalize=(text:string)=>text.replace(/[‘’]/g,"'").replace(/\*\*/g,'').toLowerCase().trim();
  const original=normalize(expression.original??'');
  if(original)return normalize(sentence).includes(original);
  // Reviewed patterns may end with an ellipsis or a grammar placeholder.
  const prefix=normalize(expression.text).split(/…|\.{3}|\+/)[0].replace(/[?.!]$/,'').trim();
  return !!prefix&&normalize(sentence).includes(prefix);
}

export function animationSourceText(lines: {start:number;end:number;en:string;ko:string;speaker:string|null}[]) {
  const stamp=(time:number)=>`${Math.floor(time/60)}:${(time%60).toFixed(3).padStart(6,'0')}`;
  return lines.map(line=>`[${stamp(line.start)}-${stamp(line.end)}] ${line.speaker?line.speaker+': ':''}${line.en}${line.ko?' | '+line.ko:''}`).join('\n');
}

/** Adapt the reviewed episode without changing catalogue rows or chapter boundaries. */
export function animationEpisodeClip(material:EpisodeMaterial):VideoClip {
  const {episode,source,lines,words}=material;
  const rows=source.rows.filter(row=>row.start_sec<episode.end&&row.end_sec>episode.start);
  const teaching=rows.map(sceneTeaching);
  const questions=[...new Map(rows.flatMap(row=>sceneQuestions(row,{start:episode.start,end:episode.end})).map(q=>[q.q,q])).values()];
  return {...source.rows[0],title:episode.title,start_sec:episode.start,end_sec:episode.end,script:animationSourceText(lines),
    pack:{words:words.map(word=>({word:word.word,meaning:word.meaning,example:word.example,time:word.start,imageUrl:word.imageUrl??undefined})),questions,
      scene:{range:{start:episode.start,end:episode.end},
        expression:teaching.find(t=>t.expression)?.expression,
        print:Object.assign({},...teaching.map(t=>t.print)),questionEvidence:Object.assign({},...teaching.map(t=>t.questionEvidence)),
        choices:Object.assign({},...teaching.map(t=>t.choices)),definitions:Object.assign({},...teaching.map(t=>t.definitions)),
        wordPictures:Object.assign({},...teaching.map(t=>t.wordPictures)),scrambleSentences:[...new Set(teaching.flatMap(t=>t.scrambleSentences??[]))]}}};
}

/** One selection snapshot feeds both classroom activities and the real print renderer. */
export function animationSelectedClip(material:EpisodeMaterial,chapterStarts:number[],wordIds:string[]):VideoClip {
 const selected=material.chapters.filter(c=>chapterStarts.includes(c.start));
 const inSelection=(time:number)=>selected.some(c=>time>=c.start&&time<c.end);
 const clip=animationEpisodeClip(material);
 const rows=material.source.rows.filter(row=>selected.some(c=>row.start_sec<c.end&&row.end_sec>c.start));
 const reviewed=chapterTeaching[material.episode.id];
 const chapterData=material.chapters.flatMap((c,i)=>chapterStarts.includes(c.start)&&reviewed?.chapters[i]?[reviewed.chapters[i]]:[]);
 const questions=[...rows.flatMap(row=>selected.flatMap(c=>sceneQuestions(row,{start:c.start,end:c.end}))),...chapterData.flatMap(c=>c.questions.map(({q,a})=>({q,a})))];
 const expressions=[...chapterData.flatMap(c=>c.expression?[c.expression]:[]),...rows.flatMap(row=>{const e=sceneTeaching(row).expression;return e?[e]:[];})];
 const words=material.words.filter(w=>wordIds.includes(w.id)&&w.chapterIds.some(i=>chapterStarts.includes(material.chapters[i].start)));
 const lines=material.lines.filter(l=>inSelection(l.start)&&selected.some(c=>l.start>=c.start&&l.end<=c.end));
 return {...clip,start_sec:selected[0]?.start??material.episode.start,end_sec:selected.at(-1)?.end??material.episode.end,script:animationSourceText(lines),
  pack:{words:words.map(w=>({word:w.word,meaning:w.meaning,example:w.example,time:w.start,imageUrl:w.imageUrl??undefined})),questions:[...new Map(questions.map(q=>[q.q,q])).values()],scene:{range:{start:selected[0]?.start??0,end:selected.at(-1)?.end??0},
   expression:expressions[0]?{...expressions[0],explanation:expressions[0].explanation??''}:undefined,choices:Object.assign({},...rows.map(row=>sceneTeaching(row).choices),...chapterData.map(c=>Object.fromEntries(c.questions.map(q=>[q.q,q.choices])))),
   scrambleSentences:lines.map(l=>l.en),print:Object.assign({},...rows.map(row=>sceneTeaching(row).print)),wordPictures:Object.assign({},...rows.map(row=>sceneTeaching(row).wordPictures))}}};
}
