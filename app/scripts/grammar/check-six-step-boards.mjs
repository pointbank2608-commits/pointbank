import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build, createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const root = fileURLToPath(new URL('../../', import.meta.url));
const points = [
  ...JSON.parse(readFileSync(resolve(root, 'src/data/grammarPoints.json'))),
  {id:'do-you-can-you',...JSON.parse(readFileSync(resolve(root, 'src/data/doYouCanYouWorkshop.json')))},
];
for (const point of points) {
  assert.equal(point.steps.length,6,point.id);
  const atlas=point.steps[0].practice;
  assert.ok(atlas.map.length>=2,point.id);
  assert.equal(new Set(atlas.map.map(entry=>entry.panelIndex)).size,atlas.map.length,point.id);
  for(const entry of atlas.map) {
    const panel=atlas.panels[entry.panelIndex];
    assert.ok(entry.label && entry.text && panel?.setting && panel.response && panel.rationale,point.id);
    assert.equal(panel.chunks.length,panel.glosses.length,point.id);
    assert.ok(panel.image && readFileSync(resolve(root,'public','.'+panel.image)).length>0,point.id);
  }
  for (const step of point.steps) for (const key of ['prompt','hint','answer','followUp']) {
    assert.ok(step[key]?.trim() && !step[key].includes('undefined'), point.id + ' ' + key);
  }
}
assert.equal(new Set(points.map(p => p.steps[1].practice.why[0][0]+'|'+p.steps[1].practice.why[0][1])).size, points.length);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ||
  '../../node_modules/homework-test-tools/node_modules/playwright/index.mjs');
const origin = 'https://grammar-check.invalid';
const academy = '00000000-0000-4000-8000-000000000001';
const loader = await createServer({root,configFile:false,server:{middlewareMode:true,hmr:false},
  plugins:[{name:'offline-grammar-data',enforce:'pre',load(id){
    if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts'))return 'export const supabase = {};';
  }}]});
let draft;
try {
  const {photoRequestLesson}=await loader.ssrLoadModule(resolve(root,'../supabase/functions/extract-textbook/requestLesson.ts'));
  draft=photoRequestLesson([{en:'Can you please close the door?',ko:'문 좀 닫아 줄래?'}],7,5);
  const {GRAMMAR_POINTS}=await loader.ssrLoadModule('/src/lib/grammar.ts');
  const {buildSoloGrammarLesson}=await loader.ssrLoadModule('/src/lib/soloLessons.ts');
  const {lessonPages}=await loader.ssrLoadModule('/src/components/grammar/lessonPages.ts');
  const stages=['1 / 6','2 / 6','3 / 6','4 / 6','5 / 6','6 / 6'];
  for(const point of GRAMMAR_POINTS){
    const six=buildSoloGrammarLesson(point).steps.slice(0,6);
    assert.deepEqual(six.map(s=>s.pattern),stages,point.id);
    for(const editing of [false,true]){
      const pages=six.map((s,i)=>lessonPages(i,s.practice,editing,point.workshop.count>0));
      assert.deepEqual(pages[0].slice(0,3),['map','scene','more'],point.id);
      assert.equal(pages[1][0],'examples',point.id);
      assert.deepEqual(pages[2],['activity'],point.id);
      assert.ok(pages[3].includes('activity'),point.id);
      assert.deepEqual(pages[4],['activity','write'],point.id);
      assert.ok(pages[5].indexOf('review')>pages[5].indexOf('task'),point.id);
    }
  }
  const old=structuredClone(GRAMMAR_POINTS[0]);
  old.steps[0].practice.map[0].label='선생님이 바꾼 쓰임';
  delete old.steps[3].practice;
  const repaired=buildSoloGrammarLesson(old).steps;
  assert.deepEqual(repaired.slice(0,6).map(s=>s.pattern),stages);
  assert.equal(repaired[0].practice.map[0].label,'선생님이 바꾼 쓰임');
  const custom=buildSoloGrammarLesson({...old,id:'old-custom',steps:undefined,workshop:undefined});
  assert.deepEqual(custom.steps.slice(0,6).map(s=>s.pattern),stages);
  const {buildSoloPopSongLesson}=await loader.ssrLoadModule('/src/lib/soloPopSongs.ts');
  const {SONG_LESSONS}=await loader.ssrLoadModule('/src/lib/songLessons.ts');
  for(const song of SONG_LESSONS){
    const rules=buildSoloPopSongLesson(song).steps.filter(s=>s.t==='rule');
    assert.deepEqual(rules.map(s=>s.pattern),song.grammarIds.slice(0,2).flatMap(()=>stages),song.id);
  }
} finally {await loader.close();}
const name = draft.name;
const fixture = `
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import MyGrammarLibrary from '/src/components/MyGrammarLibrary';
import LessonActivityPicker from '/src/components/LessonActivityPicker';
import LessonSlideSorter from '/src/components/LessonSlideSorter';
import {ToastProvider} from '/src/context/ToastContext';
import {lessonGameSources} from '/src/lib/lessonGameContent';
import GrammarBoard from '/src/components/GrammarBoard';
import LessonSlideContent from '/src/components/LessonSlideContent';
import SoloPlayer from '/src/components/solo/SoloPlayer';
import {buildSoloGrammarLesson} from '/src/lib/soloLessons';
import {PresentSyncContext} from '/src/lib/presentSync';
import {GRAMMAR_POINTS, grammarSlidePoint} from '/src/lib/grammar';
import i18n from '/src/i18n';
import '/src/tailwind.css';
await i18n.changeLanguage('ko');
function App() {
  const [pick, setPick] = useState(false);
  const [slide, setSlide] = useState(null);
  const [editingLesson, setEditingLesson] = useState(false);
  const [solo, setSolo] = useState(false);
  const [catalogId, setCatalogId] = useState(GRAMMAR_POINTS[0].id);
  const [remoteOpen, setRemoteOpen] = useState(false);
  if (location.search === '?watch') return <>
    <button onClick={()=>setRemoteOpen(!remoteOpen)}>교사 공개 상태 변경</button>
    <div style={{height:'75vh'}}><PresentSyncContext.Provider value={{role:'student', remote:{step:5,modelOpen:remoteOpen}, report:()=>{}}}>
      <GrammarBoard mode="classroom" point={GRAMMAR_POINTS[0]}/>
    </PresentSyncContext.Provider></div>
  </>;
  if (location.search === '?catalog') {
    const point = GRAMMAR_POINTS.find(p => p.id === catalogId);
    return <><select aria-label="검사할 문법" value={catalogId} onChange={e=>setCatalogId(e.target.value)}>
      {GRAMMAR_POINTS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <div style={{height:'calc(100dvh - 96px)'}}><GrammarBoard mode="classroom" point={point} initialPosition={{step:1}}/></div></>;
  }
  if (solo) return <SoloPlayer steps={buildSoloGrammarLesson(grammarSlidePoint(slide)).steps} startAt={5} api={{}} onExit={()=>setSolo(false)}/>;
  if (editingLesson) return <ToastProvider><LessonSlideSorter academyId="${academy}" classId={null}
    lessonName="test" slides={[slide]} onChange={slides=>setSlide(slides[0])} wordListId="" wordLists={[]}/></ToastProvider>;
  return <><button onClick={()=>{setPick(true);setSlide(null)}}>활동 추가 열기</button>
    <button onClick={()=>setSlide({kind:'grammar',id:'sample',grammarId:'this-is',content:{name:'선생님의 지도 수업',examples:['This is my map.'],pattern:'This is / That is',explain:'두 지도를 가리켜요.'}})}>기본 문법 열기</button>
    {slide && <button onClick={()=>setEditingLesson(true)}>수업 수정 열기</button>}
    {slide && <button onClick={()=>setSolo(true)}>개별수업 마지막 과제 열기</button>}
    {slide ? <div data-testid="classroom-board" style={{position:'relative',height:'calc(100dvh - 96px)'}}><LessonSlideContent slide={slide} words={[]} fill lessonName="수업" attendance={null} onGrammarCue={(action,index)=>{(window.grammarCues??=[]).push([action,index])}}/></div>
    : !pick && <MyGrammarLibrary/>}
    {pick && <LessonActivityPicker academyId="${academy}" storageKey="test" slides={[]} cards={[]} entries={[]}
      gameSources={lessonGameSources([],null,[])} lessonName="test" sourceName="" selected={null}
      onClose={()=>setPick(false)} onGrammarPick={(grammarId,block)=>{
        setSlide({...block,grammarId,kind:'grammar',id:'slide-1'});setPick(false);
      }}/>}</>;
}
createRoot(document.getElementById('root')).render(<App/>);`;
const bundle = await build({ root, configFile: false, logLevel:'error',
  define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(origin),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('test-key')},
  plugins:[react(),tailwindcss(),{
  name:'grammar-test', enforce:'pre', load(id) {
    const path = id.replaceAll('\\','/');
    if (path.endsWith('/scripts/games/focus.tsx')) return fixture;
    if (path.endsWith('/context/AuthContext.tsx')) return 'export const useAuth=()=>({academy:{id:"' + academy + '"},profile:{id:"teacher"}});';
    if (path.endsWith('/lib/supabase.ts')) return 'import {createClient} from "@supabase/supabase-js"; export const supabase=createClient("' + origin + '","test-key",{auth:{persistSession:false}});';
  }
}],build:{target:'esnext',write:false,copyPublicDir:false,rollupOptions:{input:resolve(root,'scripts/games/focus.html')}}});
const assets = new Map(bundle.output.map(file => ['/'+file.fileName, file.type==='chunk'?file.code:file.source]));
const browser = await chromium.launch({ channel: process.env.GRAMMAR_BROWSER_CHANNEL || 'chrome', headless: true });
try {
  const page = await browser.newPage({viewport:{width:1180,height:850},hasTouch:true});
  const pdfPage = await browser.newPage();
  await pdfPage.setContent('<main>Can you please open the door?</main>');
  const pdf = await pdfPage.pdf(); await pdfPage.close();
  const rows = new Map();
  let enabled = false, calls = 0, inserts = 0;
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (/^\/word-bank-images\/[a-z-]+\.webp$/.test(path)) {
      return route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,'public','.'+path))});
    }
    if(path.includes('/storage/v1/object/') && path.includes('/lesson-slide-images/')){
      return req.method()==='POST'?route.fulfill({json:{Key:path}}):route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG2sAAAAASUVORK5CYII=','base64')});
    }
    if (path.endsWith('/academy_scan_access')) return route.fulfill({json:{enabled}});
    if (path.endsWith('/teacher_grammar_blocks')) {
      if (req.method()==='POST') {
        const row = req.postDataJSON();
        if(!row.id){
          const id=crypto.randomUUID();
          rows.set(id,{...row,id,revision:1});
          return route.fulfill({json:{id,revision:1}});
        }
        rows.set(row.id,{...row,revision:1});
        // First insert commits, but client loses the success response.
        return ++inserts === 1 ? route.fulfill({status:409,json:{message:'temporary'}}) : route.fulfill({status:201,body:''});
      }
      if(req.method()==='PATCH'){
        const id=new URL(req.url()).searchParams.get('id').slice(3);
        const patch=req.postDataJSON(); const previous=rows.get(id);
        assert.equal(patch.revision,previous.revision+1);
        rows.set(id,{...previous,...patch});
        return route.fulfill({json:{id,revision:patch.revision}});
      }
      return route.fulfill({json:[...rows.values()]});
    }
    if (path.endsWith('/extract-textbook')) {
      const body = req.postDataBuffer().toString('latin1');
      assert.ok(body.includes('name="mode"') && body.includes('grammar') && body.includes('name="audience"'));
      assert.ok(body.includes('image/jpeg'), 'PDF rendered into an image');
      calls++;
      return route.fulfill({json:{content:draft}});
    }
    if (assets.has(path)) return route.fulfill({body:assets.get(path),contentType:/\.m?js$/.test(path)?'text/javascript':path.endsWith('.css')?'text/css':'text/html'});
    return route.abort();
  });
  await page.goto(origin+'/scripts/games/focus.html');
  await page.getByText('저장한 문법 블록이 없어요.').waitFor({timeout:5000}).catch(async error => {
    throw new Error([error.message, await page.locator('body').innerText(), ...errors].join('\n'));
  });
  const create = page.getByRole('button',{name:'문법 뚝딱 만들기',exact:true});
  assert.equal(await create.count(),0);
  enabled = true;
  await page.reload(); await create.click();
  assert.equal(await page.locator('input[capture="environment"]').count(),1);
  await page.locator('input[type=file][multiple]').setInputFiles({name:'unit.pdf',mimeType:'application/pdf',buffer:pdf});
  await page.getByRole('button',{name:'문법 블록 만들고 저장'}).click();
  await page.getByRole('button',{name:'다시 시도'}).click({timeout:10000}).catch(async error => {
    throw new Error([error.message, await page.locator('body').innerText(), calls, inserts, ...errors].join('\n'));
  });
  await page.getByText('내 문법에 저장했어요.').waitFor();
  assert.equal(calls,1); assert.equal(inserts,2); assert.equal(rows.size,1);
  const libraryCard=page.getByRole('button',{name:/도움을 부탁하고/});
  const preview=page.getByRole('dialog',{name:'문법 미리보기'});
  await libraryCard.click();
  assert.deepEqual(await preview.locator('header.workshop-edit-toolbar button').allTextContents(),['취소','편집']);
  assert.equal(await preview.locator('.workshop-edit-target,.workshop-item-add,.workshop-item-remove').count(),0);
  await preview.locator('.grammar-map-options button').first().click();
  await preview.getByRole('button',{name:'다음 단계'}).click();
  await preview.getByRole('button',{name:'편집',exact:true}).click();
  const libraryEditor=page.getByRole('dialog',{name:'문법 내용 수정'});
  await libraryEditor.getByText('2 / 6단계',{exact:true}).waitFor();
  await libraryEditor.getByRole('button',{name:'단계 제목 수정'}).waitFor();
  await libraryEditor.getByRole('button',{name:'취소'}).click();
  await libraryCard.click();
  await preview.getByText('1 / 6단계',{exact:true}).waitFor();
  await preview.getByRole('button',{name:'취소'}).click();
  assert.equal(await preview.count(),0);
  assert.equal([...rows.values()][0].revision,1);
  const openPicker = async () => {
    await page.getByRole('button',{name:'활동 추가 열기'}).click();
    await page.getByRole('navigation').getByRole('button',{name:'문법',exact:true}).click();
  };
  await openPicker();
  await create.click();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog',{name:'활동 추가',exact:true}).waitFor({timeout:3000});
  await page.getByRole('button',{name:'내 문법에서 불러오기'}).click();
  await page.getByPlaceholder(/문법 찾기/).fill('no match');
  await create.click();
  await page.locator('input[type=file][multiple]').setInputFiles({name:'lesson.pdf',mimeType:'application/pdf',buffer:pdf});
  await page.getByRole('button',{name:'문법 블록 만들고 저장'}).click();
  const imported = page.getByRole('button',{name:/도움을 부탁하고/});
  await imported.nth(1).waitFor();
  assert.equal(await page.getByPlaceholder(/문법 찾기/).inputValue(),'');
  assert.equal(rows.size,2);
  await imported.first().click();
  await page.getByRole('heading',{name:'교실에서 만나는 can'}).waitFor();
  await page.getByRole('button',{name:'수업 수정 열기'}).click();
  const detail = page.locator('[data-lesson-slide-detail]');
  if (process.env.GRAMMAR_PREP_PNG) await detail.getByRole('navigation',{name:'수업 준비 한눈에 보기'}).screenshot({path:process.env.GRAMMAR_PREP_PNG});
  const button = name => detail.getByRole('button',{name,exact:true});
  const map = detail.locator('.grammar-atlas');
  assert.equal(await map.getByRole('button').count(),6);
  await map.getByRole('button',{name:/허락해 주기/}).click();
  const card=map.locator('article');
  await card.getByText('지우가 물에 들어가요.',{exact:false}).waitFor();
  await card.locator('summary').click();
  await card.getByText(/선생님이 지우를 부를 때는 you/).waitFor();
  await card.locator('img').evaluate(img=>img.decode());
  assert.ok(await detail.locator('.workshop-body').evaluate(el=>el.clientHeight>=el.scrollHeight-1));
  if(process.env.GRAMMAR_MAP_PNG)await detail.locator('.workshop-board').screenshot({path:process.env.GRAMMAR_MAP_PNG});
  await button('다음 단계').click();
  assert.equal(await button('힌트').count(),0);
  const illustrations=detail.locator('.grammar-scene-grid img');
  assert.equal(await illustrations.count(),2);
  await illustrations.evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await detail.locator('.grammar-scene-grid summary').first().click();
  if (process.env.GRAMMAR_PREVIEW_PNG) await detail.locator('.workshop-board').screenshot({path:process.env.GRAMMAR_PREVIEW_PNG});
  await button('뜻 확인하기 →').click();
  await detail.getByText('Can you는 ‘할 줄 아니?’라면서요. 여기서는 왜 부탁이에요?',{exact:true}).click();
  await detail.getByText(/지우 앞에는 지금 해결할 일이 있어요/).first().waitFor();
  await detail.locator('.workshop-board button[data-correct=false]').click();
  await detail.locator('p.grammar-wrong').filter({hasText:/아니에요.*now\(지금\)/}).waitFor();
  assert.ok(await detail.locator('p.grammar-wrong').evaluate(p => p.getBoundingClientRect().bottom <= p.closest('.workshop-body').getBoundingClientRect().bottom+1));
  await button('편집').click();
  assert.equal(await detail.getByLabel('편집할 단계').count(),0);
  assert.equal(await detail.getByLabel('편집할 쪽').inputValue(),'1');
  await detail.getByLabel('편집할 쪽').selectOption('0');
  await button('단계 제목 수정').waitFor();
  await button('예문 수정 · Can').first().click();
  const sentenceEditor=detail.getByRole('group',{name:'예문 수정'});
  await sentenceEditor.getByLabel('영어',{exact:true}).fill('Could');
  await sentenceEditor.getByRole('button',{name:'편집 닫기'}).click();
  await button('↶ 되돌리기').click();
  await detail.getByRole('button',{name:'예문 수정 · Can',exact:true}).first().waitFor();
  await detail.locator('summary').filter({hasText:'수업 설정'}).click();
  assert.equal(await button('2. 힌트').count(),0);
  assert.equal(await button('예문 보기').count(),0);
  await detail.getByRole('navigation',{name:'수업 준비 한눈에 보기'}).getByRole('button',{name:/마지막 과제/}).click();
  await detail.getByLabel('편집할 쪽').selectOption({label:'3. 심화 연습'});
  const drills=detail.getByRole('region',{name:'심화 문제 편집'});
  const longText='문장을 끝까지 읽고 어떤 행동을 말하는지 생각해 보세요. '.repeat(12);
  for(const name of ['문제','1번 보기','풀이']) {
    await drills.getByRole('textbox',{name,exact:true}).fill(longText+'\n마지막 줄');
  }
  for(const width of [1180,390]) {
    await page.setViewportSize({width,height:850});
    for(const name of ['문제','1번 보기','풀이']) {
      const field=drills.getByRole('textbox',{name,exact:true});
      assert.ok(await field.evaluate(el=>el.scrollWidth<=el.clientWidth+1 && el.scrollHeight<=el.clientHeight+1),name+' clipped at '+width);
    }
  }
  await page.setViewportSize({width:1180,height:850});
  await detail.getByRole('navigation',{name:'수업 준비 한눈에 보기'}).getByRole('button',{name:/비교할 예문/}).click();
  const title = detail.getByRole('textbox',{name:'문법 제목',exact:true});
  await detail.getByRole('button',{name:/^문법 제목 수정/}).click();
  assert.equal(await title.evaluate(el => el === document.activeElement),true);
  await title.fill('취소할 제목');
  await button('취소').click();
  assert.equal(await detail.getByRole('button',{name:'문법 제목 수정 · '+name}).count(),1);
  await detail.getByRole('button',{name:/^문법 제목 수정/}).click();
  assert.equal(await title.inputValue(),name);
  assert.equal(await title.evaluate(el => el === document.activeElement),true);
  const renamed = '부탁하고 거절하기';
  await title.fill(renamed);
  const example=detail.locator('.grammar-scene-grid article').first();
  await example.getByRole('button',{name:'문장 전체 뜻 수정'}).click();
  await example.getByRole('textbox',{name:'문장 전체 뜻'}).fill('문을 닫아 줄 수 있어?');
  await example.getByRole('button',{name:'예문 수정 · Can',exact:true}).click();
  await example.getByLabel('영어',{exact:true}).fill('Could');
  await example.getByRole('button',{name:'편집 닫기'}).click();
  await detail.getByLabel('편집할 쪽').selectOption('1');
  await button('왜 질문 추가').click();
  await detail.getByText('새 질문',{exact:true}).click();
  await detail.getByRole('button',{name:'질문 제목 수정'}).last().click();
  await detail.getByRole('textbox',{name:'질문 제목'}).fill('어떻게 부탁할까요?');
  await detail.getByRole('button',{name:'펼쳐 볼 설명 수정'}).last().click();
  await detail.getByRole('textbox',{name:'펼쳐 볼 설명'}).fill('친구가 해 주길 바라는 행동을 말해요.');
  await detail.getByLabel('편집할 쪽').selectOption('0');
  await button('장면 안내 수정').click();
  await detail.getByRole('textbox',{name:'장면 안내'}).fill('문을 닫아 달라고 어떻게 부탁할까요?');
  await detail.locator('summary').filter({hasText:'수업 설정'}).click();
  await detail.getByLabel('대상 학년').selectOption('10');
  await detail.getByRole('spinbutton').fill('3');
  assert.equal(await detail.getByLabel('편집할 단계').count(),0);
  await detail.getByLabel('단계 그림 파일',{exact:true}).setInputFiles({name:'new-map.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG2sAAAAASUVORK5CYII=','base64')});
  await button('그림 설명 수정').click();
  await detail.getByLabel('그림 설명',{exact:true}).fill('선생님이 바꾼 장면 그림');
  await button('내 문법에 저장하고 수업에 적용').click();
  await button('편집').waitFor();
  const overview=detail.getByRole('navigation',{name:'수업 준비 한눈에 보기'});
  await overview.getByText(draft.goal).waitFor();
  await overview.getByText(draft.steps[1].practice.panels[0].chunks.join(' ').replace(/^Can/,'Could'),{exact:true}).waitFor();
  await overview.getByText(draft.steps[1].practice.panels[1].chunks.join(' '),{exact:true}).waitFor();
  await button('뜻 확인하기 →').click();
  await detail.getByText('어떻게 부탁할까요?',{exact:true}).waitFor();
  await overview.getByText(draft.workshop.scenes.high.task).waitFor();
  await overview.getByRole('button',{name:/마지막 과제/}).click();
  await detail.getByRole('heading',{name:draft.steps[5].practice.title}).waitFor();
  await overview.getByRole('button',{name:/비교할 예문/}).click();
  await detail.getByRole('heading',{name:'지우의 부탁, 민서의 대답'}).waitFor();
  await detail.getByText('문을 닫아 달라고 어떻게 부탁할까요?',{exact:true}).waitFor();
  await detail.getByRole('button',{name:'문법 제목 수정 · '+renamed}).waitFor();
  await page.locator('[data-slide-id="slide-1"]').getByText(renamed,{exact:true}).last().waitFor();
  await detail.locator('.workshop-reading').getByText(renamed,{exact:true}).first().waitFor();
  enabled=false; await page.reload();
  await openPicker();
  assert.equal(await create.count(),0);
  await page.getByRole('button',{name:'내 문법에서 불러오기'}).click();
  await page.getByRole('button',{name:new RegExp(renamed)}).click();
  await page.getByRole('heading',{name:'교실에서 만나는 can'}).waitFor();
  const board=page.getByTestId('classroom-board');
  assert.equal(await board.locator('.grammar-atlas article').count(),0);
  await board.locator('.grammar-map-options button').first().click();
  await board.getByRole('button',{name:'더 궁금해요'}).click();
  await board.getByText('1 / 6단계',{exact:true}).waitFor();
  await board.getByRole('button',{name:'← 장면 읽기'}).click();
  await board.getByRole('button',{name:'다음 단계'}).click();
  await board.getByAltText('선생님이 바꾼 장면 그림').waitFor();
  await board.getByText('문을 닫아 줄 수 있어?',{exact:true}).waitFor();
  assert.equal(await board.getByText('어떻게 부탁할까요?',{exact:true}).count(),0);
  for(const [width,height] of [[1024,768],[1280,720],[1366,768],[1920,1080]]) {
    await page.setViewportSize({width,height});
    await checkComparison(board, 'photo '+width);
  }
  await page.setViewportSize({width:1366,height:768});
  await board.getByRole('button',{name:'뜻 확인하기 →'}).click();
  await board.getByText('어떻게 부탁할까요?',{exact:true}).waitFor();
  await board.getByRole('button',{name:'다음 단계'}).click();
  const order=board.locator('.grammar-order');
  for(const chunk of draft.steps[2].practice.assembly) await order.getByRole('button',{name:chunk,exact:true}).click();
  await order.getByRole('button',{name:'순서 확인'}).click();
  await order.locator('p.grammar-right').waitFor();
  await board.getByRole('button',{name:'다음 단계'}).click();
  if(draft.steps[3].practice.panels?.length)await board.getByRole('button',{name:'단서 찾기 →'}).click();
  await board.locator('button[data-correct=false]').first().click();
  await board.locator('.grammar-wrong').getByText(/아니에요/).or(board.locator('p.grammar-wrong')).first().waitFor();
  await board.locator('button[data-correct=true]').click();
  await board.locator('p.grammar-right').waitFor();
  await board.getByRole('button',{name:'다음 단계'}).click();
  await board.locator('button[data-correct=true]').click();
  await board.getByRole('button',{name:'직접 쓰기 →'}).click();
  await board.getByRole('textbox').fill("Sorry, I can't. My class starts now.");
  await board.getByRole('button',{name:'← 질문 고르기'}).click();
  await board.locator('button[data-correct=true][aria-pressed=true]').waitFor();
  await board.getByRole('button',{name:'직접 쓰기 →'}).click();
  assert.equal(await board.getByRole('textbox').inputValue(),"Sorry, I can't. My class starts now.");
  await board.getByRole('button',{name:'다음 단계'}).click();
  assert.equal(await board.getByRole('textbox').count(),0);
  assert.equal(await board.getByRole('button',{name:'예문 보기'}).count(),0);
  await board.getByRole('button',{name:'예시 답 보기'}).click();
  await board.getByRole('button',{name:'심화 연습 →'}).click();
  await board.getByRole('heading',{name:'심화 연습 · 1 / 3'}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.grammarCues.filter(([action,i])=>i===5 && action!=='shown')),[['revealed',5]]);
  assert.equal(await board.getByRole('button',{name:'다음 단계'}).isDisabled(),true);
  await page.getByRole('button',{name:'개별수업 마지막 과제 열기'}).click();
  const solo=page.getByRole('region',{name:'문법 수업'});
  const compare=solo.getByRole('button',{name:'내 답과 예시 비교하기'});
  await compare.waitFor();
  assert.equal(await solo.locator('.question-model').count(),0);
  await solo.getByRole('textbox').fill('   ');
  assert.ok(await compare.isDisabled());
  await solo.getByRole('textbox').fill("Can you move this chair?");
  await compare.click();
  await solo.locator('.question-model').waitFor();
  await solo.getByRole('button',{name:'← 혼자 쓰기'}).click();
  assert.equal(await solo.getByRole('textbox').inputValue(),'Can you move this chair?');
  await page.reload();
  await page.getByRole('button',{name:'기본 문법 열기'}).click();
  await page.getByRole('heading',{name:'교실에서 만나는 This is와 That is'}).waitFor();
  await page.getByRole('button',{name:'수업 수정 열기'}).click();
  await detail.locator('.workshop-reading').getByRole('heading',{name:'교실에서 만나는 This is와 That is'}).waitFor();
  assert.equal(await detail.getByText('수업을 시작할 때',{exact:true}).count(),0);
  const thisMap=detail.locator('.grammar-atlas');
  await thisMap.getByRole('button',{name:/멀리 가리키기/}).click();
  await thisMap.locator('summary').click();
  await thisMap.getByText(/거리가 달라져요/).waitFor();
  await button('편집').click();
  await detail.getByLabel('편집할 쪽').selectOption('0');
  const minus=thisMap.locator('.workshop-map-item').filter({hasText:'멀리 가리키기'}).getByRole('button',{name:/카드 삭제/});
  await minus.click();
  assert.equal(await minus.count(),0);
  await button('↶ 되돌리기').click();
  await minus.waitFor();
  await button('쓰임 카드 추가').click();
  await button('다른 쓰임 고르기').click();
  await thisMap.getByRole('button',{name:'새 쓰임 카드 삭제'}).click();
  assert.equal(await thisMap.getByRole('button',{name:'새 쓰임 카드 삭제'}).count(),0);
  await button('쓰임 카드 추가').tap();
  const newScene=thisMap.locator('article');
  for(const [field,value] of [['쓰임 이름','가까운 물건'],['쓰임 설명','가까운 물건을 가리켜요.'],['말하는 사람','지우'],['문장 전체 뜻','이건 내 컵이야.']]){
    await newScene.getByRole('button',{name:field+' 수정'}).tap();
    await newScene.getByRole('textbox',{name:field}).fill(value);
  }
  await newScene.getByRole('button',{name:/^예문 수정/}).tap();
  await newScene.getByLabel('영어',{exact:true}).fill('This is my cup.');
  await newScene.getByLabel('우리말 뜻',{exact:true}).fill('이건 내 컵이야.');
  await newScene.getByRole('button',{name:'편집 닫기'}).tap();
  const uploadChooser=page.waitForEvent('filechooser');
  await newScene.getByRole('button',{name:'지우 그림 추가'}).tap();
  await (await uploadChooser).setFiles({name:'cup.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG2sAAAAASUVORK5CYII=','base64')});
  await newScene.getByRole('button',{name:'지우 그림 바꾸기'}).waitFor();
  await button('내 문법에 저장하고 수업에 적용').tap();
  await button('편집').waitFor();
  await thisMap.getByText('This is my cup.',{exact:true}).waitFor();
  await newScene.locator('img').evaluate(img=>img.decode());
  const stored=[...rows.values()].find(r=>r.block.content.steps[0].practice.map.some(m=>m.label==='가까운 물건'));
  assert(stored,'catalog edit must also be saved to the library');
  const added=stored.block.content.steps[0].practice.map.find(m=>m.label==='가까운 물건');
  assert.equal(stored.block.content.steps[0].practice.panels[added.panelIndex].chunks[0],'This is my cup.');
  assert.equal(await thisMap.locator('.workshop-item-remove,.workshop-item-add').count(),0);
  if(process.env.GRAMMAR_BUILTIN_PNG)await detail.locator('.workshop-reading').screenshot({path:process.env.GRAMMAR_BUILTIN_PNG});
  await page.reload(); await page.getByRole('button',{name:'기본 문법 열기'}).click();
  const builtInMap=board.locator('.grammar-atlas');
  for (const option of await builtInMap.getByRole('button').all()) {
    await option.click();
    const scene=builtInMap.locator('article');
    await scene.getByText('상대의 반응',{exact:true}).waitFor();
    await scene.locator('summary').click();
    await scene.locator('img').evaluate(img=>img.decode());
    await board.getByRole('button',{name:'다른 쓰임 고르기'}).click();
  }
  await board.getByRole('button',{name:'장면 지도 열기'}).click();
  await page.getByRole('dialog',{name:'장면 지도'}).getByRole('button',{name:'닫기'}).click();
  for (let stage=0;stage<6;stage++) {
    if(stage===0)await builtInMap.getByRole('button').first().click();
    if(stage===1 || stage===3 || stage===4)await board.locator('footer .workshop-page-actions button').last().click();
    for(const label of ['힌트','예시 답과 이유','예문 보기'])
      assert.equal(await board.getByRole('button',{name:label,exact:true}).count(),0);
    if(stage<5)await board.getByRole('button',{name:'다음 단계'}).click();
  }
  assert.equal(await board.locator('summary').count(),0);
  assert.equal(await board.getByRole('button',{name:'장면 지도 열기'}).count(),0);
  assert.deepEqual(errors,[]);
  await page.goto(origin+'/scripts/games/focus.html?catalog');
  const catalog=page.getByRole('combobox',{name:'검사할 문법'});
  for (const point of points) {
    await catalog.selectOption(point.id);
    await checkComparison(page.locator('.workshop-board'),point.id);
    if (point.id === 'do-you-can-you' && process.env.GRAMMAR_CLASSROOM_PNG)
      await page.locator('.workshop-board').screenshot({path:process.env.GRAMMAR_CLASSROOM_PNG});
  }
  await page.goto(origin+'/scripts/games/focus.html?watch');
  const follow=page.getByRole('region',{name:'문법 수업'});
  await follow.getByRole('button',{name:'예시 답 보기'}).waitFor();
  assert.ok(await follow.getByRole('button',{name:'예시 답 보기'}).isDisabled());
  await page.getByRole('button',{name:'교사 공개 상태 변경'}).click();
  await follow.locator('.question-model').waitFor();
  await page.getByRole('button',{name:'교사 공개 상태 변경'}).click();
  await follow.getByRole('button',{name:'예시 답 보기'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log(points.length+' catalog boards, '+points.length*6+' stages; photo fixture, preparation, projected pairs, oral reveal, follow view and solo writing passed.');
} finally { await browser.close(); }

async function checkComparison(board, label) {
  const pair = board.locator('.grammar-scene-grid .scene-sentence');
  await pair.first().waitFor();
  const visible = await pair.evaluateAll(sentences => {
    const body = sentences[0].closest('.workshop-body');
    const frame = body.getBoundingClientRect();
    return sentences.length === 2 && body.scrollTop === 0 && sentences.every(sentence => {
      const box = sentence.getBoundingClientRect();
      return box.top >= frame.top && box.bottom <= Math.min(frame.bottom, innerHeight) &&
        box.left >= frame.left && box.right <= frame.right + 1;
    });
  });
  assert.ok(visible, label+' comparison must show both complete sentences before scrolling');
}
