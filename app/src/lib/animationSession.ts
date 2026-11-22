import type { VideoClip } from './videoClips';
import type { AnimationExpression, VideoSlide } from './types';
import { parseShadowText } from './shadowLines';

/** A lesson owns its selection; catalog chapters remain immutable. */
export function animationEpisodeWords(chapters: VideoClip[], saved: VideoSlide['animationSession']) {
  return [...new Map([...chapters.flatMap(c => c.pack.words ?? []), ...(saved?.words ?? [])]
    .map(word => [word.word + '|' + word.meaning, word])).values()];
}

export function animationEpisodeSource(chapters: VideoClip[]) {
  return [...new Set(chapters.map(chapter => chapter.script).filter(Boolean))].join('\n');
}

export function animationPracticeLines(source: string, start = 0, end = Infinity) {
  const unique = new Map(parseShadowText(source)
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
