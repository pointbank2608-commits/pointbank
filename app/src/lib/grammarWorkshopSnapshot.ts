import { refreshCatalogChoices, stageTitles, type SceneLine, type Workshop } from '../../../supabase/functions/_shared/grammarWorkshop';
import type { GrammarPoint, GrammarTeachingStep } from './grammar';
import type { GuidedPractice } from '../data/doYouCanYou';

// Upgrade on read. A teacher's stored copy is written only by the normal Save action.
export function workshopSnapshot(point:GrammarPoint, catalog?:GrammarPoint | null):GrammarPoint & {workshop:Workshop} {
  if (point.workshop && catalog?.workshop && point.workshop!==catalog.workshop)
    point={...point,workshop:refreshCatalogChoices(point.workshop,catalog.workshop)};
  const saved=point.steps ?? [];
  const atlas=saved[0]?.practice;
  if(point.workshop && saved.length===6 && atlas?.map?.length &&
    atlas.map.every(entry=>entry.panelIndex!==undefined && atlas.panels?.[entry.panelIndex])) {
    return {...point,workshop:point.workshop};
  }
  const models=point.examples.map((en,i)=>({en:en.replaceAll('**',''),ko:point.translations?.[i] ?? ''}));
  const grade=point.workshop?.grade ?? catalog?.workshop?.grade ??
    (point.audience==='high'?10:point.audience==='elementary'?3:7);
  const finalModel=saved[5]?.answer || models.at(-1)?.en || point.pattern;
  const scene={opening:saved[0]?.prompt || point.explain,task:saved[5]?.prompt || '이 표현을 쓸 만한 다른 상황을 떠올리고 영어로 한 문장을 써 보세요.',model:finalModel};
  const workshop=point.workshop ?? catalog?.workshop ?? {version:1,grade,count:0,
    scenes:{elementary:scene,middle:scene,high:scene},models,choices:[],repairs:[]};
  const oldPanels=saved[1]?.practice?.panels ?? atlas?.panels;
  const sceneExamples=models.length ? models : [{en:point.pattern,ko:point.explain}];
  const panels:SceneLine[]=oldPanels?.length ? oldPanels : sceneExamples.map(m=>({
    label:m.ko || m.en,chunks:m.en.split(/\s+/),meaning:m.ko,setting:point.explain,
    rationale:point.tip || point.explain,
  }));
  const makePractice=(i:number):GuidedPractice=>{
    const title=stageTitles[i];
    const why:[string,string][]=[['왜 이렇게 말할까요?',saved[i]?.answer || point.explain]];
    const base={title,why,question:'',choices:[] as [string,string][],correct:0};
    if(i===0)return {...base,map:panels.map((p,n)=>({label:p.label,text:p.meaning,panelIndex:n})),panels};
    if(i===1)return {...base,panels:panels.slice(0,2)};
    if(i===2)return {...base,assembly:panels[0]?.chunks,question:panels[0]?.meaning ?? ''};
    if(i===5)return {title,why,independentPrompts:[scene.task]};
    return {...base,writingPrompt:saved[i]?.followUp || '장면에 어울리는 표현을 적어 보세요.'};
  };
  const steps:GrammarTeachingStep[]=stageTitles.map((_,i)=>{
    const old=saved[i], reference=catalog?.steps?.[i];
    const practice=old?.practice ?? reference?.practice ?? makePractice(i);
    if(i!==0)return {...(reference ?? {prompt:point.explain,hint:'',answer:finalModel,followUp:''}),...old,practice};
    const current=reference?.practice ?? makePractice(0);
    // Keep old, individually edited use notes accessible alongside the new scene cards.
    const notes=atlas?.map?.map(m=>[m.label,m.text] as [string,string]) ?? [];
    return {...(reference ?? {prompt:scene.opening,hint:'',answer:point.explain,followUp:''}),...old,
      practice:{...practice,map:current.map,panels:current.panels,why:[...practice.why,...notes]}};
  });
  return {...point,workshop,steps};
}
