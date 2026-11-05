// Synthetic test fixture only; production code never imports this file.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '../../src/tailwind.css';
import i18n from '../../src/i18n';
import HomeworkRunner from '../../src/components/homework/HomeworkRunner';
import SoloPlayer from '../../src/components/solo/SoloPlayer';
import WordMemoryStudentPage from '../../src/pages/WordMemoryStudentPage';
import LearningSensorsPanel from '../../src/components/admin/LearningSensorsPanel';
import { useLearningActivity } from '../../src/lib/learningSensors/useLearningActivity';
void i18n.changeLanguage('ko');
const params = new URLSearchParams(location.search);
const kind = params.get('kind') || 'hook';
const preview = params.has('preview');
const resource = '10000000-0000-4000-8000-000000000001';
function HookFixture() {
  const [position,setPosition]=useState(0);
  const [mounted,setMounted]=useState(true);
  const sensor=useLearningActivity(mounted && !preview ? {source:'solo',credential:'synthetic-secret',resource}:undefined,position);
  return <><button onClick={()=>setPosition(p=>p+1)}>next activity</button><button onClick={()=>sensor('hint')}>hint action</button><button onClick={()=>setMounted(false)}>stop sensor</button></>;
}
const item={id:resource,kind:'quiz',title:'합성 단어 확인',config:{},content:{questions:[{id:'q1',qtype:'choice',style:'meaning',prompt:'cat',choices:['고양이','개'],skill:'vocab.meaning',word:'cat',gen:'synthetic'}]}};
const api={sensor:{source:'homework',credential:'synthetic-secret'},submit:async()=>({correct:false,answer:'고양이'}),progress:async()=>{},finish:async()=>({score:0,total:1})};
const soloApi={sensor:{source:'solo',credential:'synthetic-secret',resource},answer:async()=>false,advance:async()=>({answer:'고양이'}),reveal:async()=> '고양이',submitTest:async()=>({})};
const content=kind==='homework'? <HomeworkRunner title="합성 숙제" items={[item] as any} initialAnswers={new Map()} finishedItems={new Set()} shadowLinesDone={new Map()} alreadyFinished={false} api={api as any} saveState="saved" startImmediately preview={preview}/>
  :kind==='solo'? <SoloPlayer steps={[{t:'pickMeaning',word:'cat',options:['고양이','개']}]} api={soloApi as any} onExit={()=>{}} preview={preview}/>
  :kind==='word_memory'? <MemoryRouter initialEntries={['/wm/synthetic-access']}><Routes><Route path="/wm/:access" element={<WordMemoryStudentPage/>}/></Routes></MemoryRouter>
  :kind==='admin'? <LearningSensorsPanel/> : <HookFixture/>;
createRoot(document.getElementById('root')!).render(content);
