export type School = 'elementary' | 'middle' | 'high';
export interface SceneLine { label: string; chunks: string[]; glosses?:string[]; meaning: string; image?: string; setting?:string; response?:string; rationale?:string }
export interface TransferScene { opening: string; task: string; model: string }
export interface DrillChoice { prompt: string; options: string[]; correct: number; reason: string; previousPrompt?:string; previousVersion?:string }
export function choiceVersion(q:DrillChoice):string {
  const text=JSON.stringify([q.prompt,q.options,q.correct,q.reason]);
  let hash=2166136261;
  for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
  return (hash>>>0).toString(36);
}
export function refreshCatalogChoices(saved:Workshop, catalog?:Workshop):Workshop {
  if (!catalog || saved===catalog) return saved;
  const revised=new Map(catalog.choices.filter(q=>q.previousVersion).map(q=>[q.previousVersion,q]));
  let changed=false;
  const choices=saved.choices.map(q=>{
    const update=revised.get(choiceVersion(q));
    if (!update || update.previousPrompt!==q.prompt) return q;
    changed=true;
    return update;
  });
  return changed?{...saved,choices}:saved;
}
export interface DrillModel { en: string; ko: string }
export interface WorkshopSource {
  map: string[];
  mapScenes?: SceneLine[];
  scene: string; pair: SceneLine[]; why: string; because: string; misconception:string;
  clue: DrillChoice; apply: DrillChoice; reading: DrillChoice;
  elementary: TransferScene; middle: TransferScene; high: TransferScene;
  models: DrillModel[]; choices: DrillChoice[];
  repairs: { wrong: string; right: string; reason: string }[];
}
export interface Workshop {
  meaningChoices?: DrillChoice[];
  interpretation?:DrillChoice;
  reading?:DrillChoice;
  overrides?: Record<string,ExtensionQuestion>;
  countsByGrade?: Record<string,number>;
  version: 1; grade: number; count: number;
  scenes: Record<School, TransferScene>;
  models: DrillModel[]; choices: DrillChoice[]; repairs: WorkshopSource['repairs'];
}
export function schoolOf(grade: number): School {
  return grade <= 6 ? 'elementary' : grade <= 9 ? 'middle' : 'high';
}
export const stageTitles = ['쓰임 지도', '두 장면 비교하기', '문장 조립하기', '장면의 단서 찾기', '의도에 맞게 고르고 쓰기', '새 상황에서 혼자 쓰기'];
export function compileWorkshop(source: WorkshopSource, grade: number, count = 5) {
  const {pair, why, because, scene, map, clue, apply} = source;
  const [first, second] = pair;
  const whole = (line: SceneLine) => line.chunks.join(' ');
  const whyPair: [string,string] = [why,because];
  function choice(item: DrillChoice) {
    return {question:item.prompt, choices:item.options.map((label,i): [string,string] => [label,
      i === item.correct ? item.reason : '고른 말은 “' + label + '”예요. ' + item.reason]), correct:item.correct};
  }
  const sceneTask = (index: number, prompt: string, hint: string, answer: string, followUp: string) =>
    ({prompt, hint, answer, followUp, practice:{title:stageTitles[index], why:[whyPair]}});
  const opening=sceneTask(0,scene,first.meaning,because,'이 쓰임을 내 말로 설명해 보세요.');
  const compare=sceneTask(1,'두 장면에서 강조되는 말과 우리말 뜻을 함께 읽어 보세요.',why,because,second.meaning);
  const assemble=sceneTask(2,'우리말 뜻을 읽고 영어 조각을 순서대로 놓으세요.',first.chunks[0],whole(first),first.meaning);
  const find=sceneTask(3,scene,why,clue.reason,'어떤 말이 선택의 단서였나요?');
  const decide=sceneTask(4,apply.prompt,apply.reason,apply.options[apply.correct]+' · '+apply.reason,'고른 말이 어떤 단서와 어울리는지 짚어 보세요.');
  const transfer=sceneTask(5,'새 장면에서 전하고 싶은 내용을 영어로 써 보세요.','먼저 스스로 써 보세요.',source[schoolOf(grade)].model,'예시와 표현이 달라도 의도가 전달되는지 확인해 보세요.');
  const interpret:DrillChoice={prompt:scene+'\nA. '+whole(first)+'\nB. '+whole(second)+'\n두 표현을 문맥에 맞게 설명한 것을 고르세요.',
    options:[because,source.misconception],correct:0,reason:because};
  if(first.meaning.length%2){interpret.options.reverse();interpret.correct=1;}
  const mapQuestions=map.map((line,index) => {
    const parts=line.split(/[:：]/);
    return {label:parts[0].trim(), text:parts.slice(1).join(':').trim() || line, ...(source.mapScenes?.[index] ? {panelIndex:index} : {})};
  });
  const steps=[
    {...opening,practice:{...opening.practice,map:mapQuestions,panels:source.mapScenes ?? [first],question:'',choices:[] as [string,string][],correct:0}},
    {...compare,practice:{...compare.practice,panels:pair,question:'',choices:[] as [string,string][],correct:0}},
    {...assemble,practice:{...assemble.practice,why:[['어떤 덩어리부터 읽으면 돼요?',first.chunks.join(' → ')+' 순서로 이으면 “'+first.meaning+'”라는 뜻이에요. '+because]] as [string,string][],assembly:first.chunks,question:first.meaning,choices:[] as [string,string][],correct:0}},
    {...find,prompt:clue.prompt,practice:{...find.practice,panels:[second],why:[['어떤 단서로 고르나요?',clue.reason]] as [string,string][],...choice(clue),question:'장면에 맞는 답을 골라 보세요.'}},
    {...decide,practice:{...decide.practice,why:[['왜 이 표현이 어울려요?',apply.reason]] as [string,string][],...choice(apply),question:'알맞은 표현을 고르세요.',writingPrompt:'고른 표현을 사용해 한 문장을 써 보세요.'}},
    {...transfer,practice:{title:stageTitles[5],why:[['왜 먼저 내 문장을 써요?','예시를 보기 전에 상대에게 하고 싶은 말을 떠올려 보세요.']] as [string,string][],independentPrompts:['내 문장']}},
  ];
  const workshop: Workshop={version:1,grade,count,scenes:{elementary:source.elementary,middle:source.middle,high:source.high},
    models:source.models,choices:source.choices,repairs:source.repairs,interpretation:interpret,reading:source.reading};
  return {steps,workshop};
}

export interface ExtensionQuestion { kind:'choice'|'order'|'write'; title:string; prompt:string; answer:string; reason:string; options?:string[]; previousPrompt?:string }
export function meaningChoices(workshop:Workshop):DrillChoice[] {
  if (workshop.meaningChoices) return workshop.meaningChoices;
  return workshop.models.flatMap((m,i)=>{
    const other=workshop.models.find(x=>x.en!==m.en && x.ko!==m.ko);
    if (!other) return [];
    const correct=i%2;
    return [{prompt:m.en,options:correct?[other.ko,m.ko]:[m.ko,other.ko],correct,reason:m.en+' → '+m.ko}];
  });
}
export function extensionPool(workshop: Workshop): ExtensionQuestion[] {
  const {grade, models, choices, repairs}=workshop;
  const school=schoolOf(grade);
  const rotate=<T,>(items:T[])=>items.length ? [...items.slice(grade % items.length), ...items.slice(0,grade % items.length)] : [];
  const groups:ExtensionQuestion[][]=[];
  const choiceItems:ExtensionQuestion[]=rotate(choices).map(c=>({kind:'choice',
    title:c.prompt.includes('_')?(school==='elementary'?'빈자리 채우기':'문맥 빈칸'):'문맥에 맞는 표현',
    prompt:c.prompt,previousPrompt:c.previousPrompt,answer:c.options[c.correct],options:c.options,reason:c.reason}));
  const ordering:ExtensionQuestion[]=rotate(models).filter(m=>m.en.trim().split(/\s+/).length>=3).map(m=>({kind:'order',title:'순서 맞추기',prompt:m.ko,answer:m.en,reason:m.ko}));
  const meanings=rotate(meaningChoices(workshop)).map(q=>({kind:'choice' as const,
    title:school==='high'?'문맥 속 의미 추론':'문장과 뜻 짝짓기',
    prompt:school==='high'?'다음 발언의 의미로 알맞은 것을 고르세요.\n'+q.prompt:q.prompt,
    options:q.options,answer:q.options[q.correct],reason:q.reason}));
  if(school==='elementary') {
    const matches=meanings;
    if(grade<=3) groups.push(matches,ordering,choiceItems);
    else if(grade<=5) groups.push(ordering,matches,choiceItems);
    else groups.push(choiceItems,ordering,matches);
  } else {
    const repair:ExtensionQuestion[]=rotate(repairs).map(r=>({kind:'write',title:'어법 고쳐 쓰기',prompt:r.wrong+'\n어색한 곳 하나를 고쳐 문장 전체를 적으세요.',answer:r.right,reason:r.reason}));
    const writing:ExtensionQuestion[]=rotate(models).map(m=>({kind:'write',title:'서술형 영작',prompt:m.ko,answer:m.en,reason:'전달하려는 뜻 · '+m.ko}));
    if(grade===7 || grade===10) groups.push(choiceItems,repair,writing);
    else if(grade===8 || grade===11) groups.push(repair,choiceItems,writing);
    else groups.push(writing,repair,choiceItems);
    if(school==='middle') groups.push(ordering);
    if(school==='high') {
      groups.unshift(meanings);
    }
  }
  const result:ExtensionQuestion[]=[];
  const seen=new Set<string>();
  if(grade>=8 && workshop.reading){
    const q=workshop.reading;
    result.push({kind:'choice',title:school==='high'?'모의고사형 · 영어 지문 읽기':'내신형 · 짧은 글 읽기',prompt:q.prompt,options:q.options,answer:q.options[q.correct],reason:q.reason});
    seen.add(q.prompt);
  }
  if(school!=='elementary' && workshop.interpretation){
    const q=workshop.interpretation;
    result.push({kind:'choice',title:school==='high'?'모의고사형 · 문맥 추론':'내신형 · 쓰임 비교',prompt:q.prompt,options:q.options,answer:q.options[q.correct],reason:q.reason});
    seen.add(q.prompt);
  }
  for(let i=0;i<Math.max(...groups.map(g=>g.length));i++) for(const g of groups) {
    const item=g[i];
    if(item && !seen.has(item.prompt)){seen.add(item.prompt);result.push(item);}
  }
  return result.map(item=>workshop.overrides?.[item.kind+'|'+(item.previousPrompt??item.prompt)]??item);
}
