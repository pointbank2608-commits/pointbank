import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const root = fileURLToPath(new URL('../../', import.meta.url));
const points = JSON.parse(readFileSync(resolve(root, 'src/data/grammarPoints.json')));
for (const point of points) {
  assert.ok(point.goal && point.steps.length === 6, point.id);
  for (const step of point.steps) for (const key of ['prompt','hint','answer','followUp']) {
    assert.ok(step[key]?.trim() && !step[key].includes('undefined'), point.id + ' ' + key);
  }
}
assert.equal(new Set(points.map(p => p.steps[1].practice.why[0][0]+'|'+p.steps[1].practice.why[0][1])).size, points.length);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ||
  '../../node_modules/homework-test-tools/node_modules/playwright/index.mjs');
const origin = 'https://grammar-check.invalid';
const academy = '00000000-0000-4000-8000-000000000001';
const name = '[중등] 조동사 can — 도움 요청하기';
const draft = { ...points.find(p => p.id === 'i-can'), name, audience: 'middle' };
const fixture = `
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import MyGrammarLibrary from '/src/components/MyGrammarLibrary';
import LessonActivityPicker from '/src/components/LessonActivityPicker';
import LessonSlideSorter from '/src/components/LessonSlideSorter';
import {ToastProvider} from '/src/context/ToastContext';
import {lessonGameSources} from '/src/lib/lessonGameContent';
import GrammarBoard from '/src/components/GrammarBoard';
import {grammarSlidePoint} from '/src/lib/grammar';
import i18n from '/src/i18n';
import '/src/tailwind.css';
await i18n.changeLanguage('ko');
function App() {
  const [pick, setPick] = useState(false);
  const [slide, setSlide] = useState(null);
  const [editingLesson, setEditingLesson] = useState(false);
  if (editingLesson) return <ToastProvider><LessonSlideSorter academyId="${academy}" classId={null}
    lessonName="test" slides={[slide]} onChange={slides=>setSlide(slides[0])} wordListId="" wordLists={[]}/></ToastProvider>;
  return <><button onClick={()=>{setPick(true);setSlide(null)}}>활동 추가 열기</button>
    <button onClick={()=>setSlide({kind:'grammar',id:'sample',grammarId:'m-modals'})}>기본 문법 열기</button>
    {slide && <button onClick={()=>setEditingLesson(true)}>수업 수정 열기</button>}
    {slide ? <div data-testid="classroom-board" style={{width:'100%',aspectRatio:'16/9'}}><GrammarBoard point={grammarSlidePoint(slide)} /></div>
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
  const page = await browser.newPage({viewport:{width:1180,height:850}});
  const pdfPage = await browser.newPage();
  await pdfPage.setContent('<main>Can you please open the door?</main>');
  const pdf = await pdfPage.pdf(); await pdfPage.close();
  const rows = new Map();
  let enabled = false, calls = 0, inserts = 0;
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if(path.includes('/storage/v1/object/') && path.includes('/lesson-slide-images/')){
      return req.method()==='POST'?route.fulfill({json:{Key:path}}):route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG2sAAAAASUVORK5CYII=','base64')});
    }
    if (path.endsWith('/academy_scan_access')) return route.fulfill({json:{enabled}});
    if (path.endsWith('/teacher_grammar_blocks')) {
      if (req.method()==='POST') {
        const row = req.postDataJSON(); rows.set(row.id,{...row,revision:1});
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
  const imported = page.getByRole('button',{name:new RegExp('도움 요청하기')});
  await imported.nth(1).waitFor();
  assert.equal(await page.getByPlaceholder(/문법 찾기/).inputValue(),'');
  assert.equal(rows.size,2);
  await imported.first().click();
  await page.getByRole('heading',{name:'1 / 6 · 쓰임 지도'}).waitFor();
  await page.getByRole('button',{name:'수업 수정 열기'}).click();
  const detail = page.locator('[data-lesson-slide-detail]');
  const button = name => detail.getByRole('button',{name,exact:true});
  await button('다음').click();
  await button('힌트').click();
  await button('문법 내용 수정').click();
  await detail.getByRole('heading',{name:'2 / 6 · 두 장면 비교하기'}).waitFor();
  await button('2. 힌트').waitFor();
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
  await button('2. 칠판 질문').dblclick();
  await detail.getByRole('textbox',{name:'2. 칠판 질문'}).fill('문을 닫아 달라고 어떻게 부탁할까요?');
  await detail.getByLabel('대상 학년').selectOption('10');
  await detail.getByRole('spinbutton').fill('3');
  assert.equal(await detail.getByLabel('편집할 단계').inputValue(),'1');
  await detail.getByLabel('단계 그림 추가·교체').setInputFiles({name:'new-map.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG2sAAAAASUVORK5CYII=','base64')});
  await detail.getByLabel('그림 설명',{exact:true}).fill('선생님이 바꾼 장면 그림');
  await button('내 문법에 저장하고 이 슬라이드에 적용').click();
  await button('문법 내용 수정').waitFor();
  await detail.getByRole('heading',{name:'2 / 6 · 두 장면 비교하기'}).waitFor();
  await detail.getByText('문을 닫아 달라고 어떻게 부탁할까요?',{exact:true}).waitFor();
  await detail.getByRole('button',{name:'문법 제목 수정 · '+renamed}).waitFor();
  await page.locator('[data-slide-id="slide-1"]').getByText(renamed,{exact:true}).last().waitFor();
  await detail.locator('.aspect-video').getByText(renamed,{exact:true}).first().waitFor();
  enabled=false; await page.reload();
  await openPicker();
  assert.equal(await create.count(),0);
  await page.getByRole('button',{name:'내 문법에서 불러오기'}).click();
  await page.getByRole('button',{name:new RegExp(renamed)}).click();
  await page.getByRole('heading',{name:'1 / 6 · 쓰임 지도'}).waitFor();
  const board=page.getByTestId('classroom-board');
  await board.getByRole('button',{name:/다음$/}).click();
  await board.getByAltText('선생님이 바꾼 장면 그림').waitFor();
  await board.getByRole('button',{name:/다음$/}).click();
  await board.getByRole('button',{name:/다음$/}).click();
  await board.locator('button[data-correct=false]').first().click();
  await board.locator('.grammar-wrong').getByText(/아니에요/).or(board.locator('p.grammar-wrong')).first().waitFor();
  await board.locator('button[data-correct=true]').click();
  await board.locator('p.grammar-right').waitFor();
  for(let i=0;i<2;i++)await board.getByRole('button',{name:/다음$/}).click();
  assert.equal(await board.getByRole('button',{name:'내 답과 예시 비교하기'}).isDisabled(),true);
  assert.equal(await board.getByRole('button',{name:'예문 보기'}).count(),0);
  await board.getByRole('textbox').fill('Can I film the show?');
  await board.getByRole('button',{name:'내 답과 예시 비교하기'}).click();
  await board.getByRole('heading',{name:'심화 연습 · 1 / 3'}).waitFor();
  assert.equal(await page.getByRole('button',{name:/다음$/}).isDisabled(),true);
  await page.getByRole('button',{name:'기본 문법 열기'}).click();
  await page.getByRole('heading',{name:'1 / 6 · 쓰임 지도'}).waitFor();
  for (let step=0;step<3;step++) await page.getByRole('button',{name:/다음$/}).click();
  await page.getByRole('button',{name:'힌트',exact:false}).click();
  await page.getByRole('button',{name:'예시 답과 이유',exact:false}).click();
  assert.match(await page.getByTestId('classroom-board').innerText(), /손목/);
  if (process.env.GRAMMAR_PREVIEW_PNG) await page.getByTestId('classroom-board').screenshot({path:process.env.GRAMMAR_PREVIEW_PNG});
  assert.deepEqual(errors,[]);
  console.log(points.length+' catalog boards, '+points.length*6+' stages; Chrome PDF → save retry → reload → import → all six stages passed.');
} finally { await browser.close(); }
