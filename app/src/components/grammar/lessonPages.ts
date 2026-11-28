import type { GuidedPractice } from '../../data/doYouCanYou';

export type LessonPage = 'map' | 'scene' | 'more' | 'examples' | 'activity' | 'write' | 'task' | 'review' | 'extensions';

export const pageLabels: Record<LessonPage,string> = {
  map:'쓰임 고르기', scene:'장면 읽기', more:'더 궁금해요', examples:'예문 살펴보기', activity:'뜻 확인하기',
  write:'직접 쓰기', task:'혼자 쓰기', review:'예시와 비교', extensions:'심화 연습',
};

export function lessonPages(step:number, p:GuidedPractice, editing:boolean, drills:boolean):LessonPage[] {
  if (p.independentPrompts) return [...p.independentPrompts.map(()=>'task' as const),'review',...(drills?['extensions' as const]:[])];
  const pages:LessonPage[]=[];
  if(step===0 && p.map && (p.map.length || editing)) {
    pages.push('map');
    if(p.map.length) pages.push('scene');
    if(p.why.length || editing) pages.push('more');
    // Earlier saved solo lessons kept their examples separate from the map entries.
    if(p.panels?.length && !p.map.some(entry=>entry.panelIndex!==undefined)) pages.push('examples');
  } else if (!p.assembly && (p.panels?.length || editing && p.panels)) pages.push('examples');
  if(p.assembly || p.choices.length || !pages.length && !p.writingPrompt) pages.push('activity');
  if(p.writingPrompt) pages.push('write');
  return pages;
}
