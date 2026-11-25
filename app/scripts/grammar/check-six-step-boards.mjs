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
assert.equal(new Set(points.map(p => p.steps[4].prompt)).size, points.length);
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
import GrammarBoard from '/src/components/GrammarBoard';
import {grammarSlidePoint} from '/src/lib/grammar';
import i18n from '/src/i18n';
import '/src/tailwind.css';
await i18n.changeLanguage('ko');
function App() {
  const [pick, setPick] = useState(false);
  const [slide, setSlide] = useState(null);
  return <><button onClick={()=>{setPick(true);setSlide(null)}}>내 문법에서 불러오기</button>
    <button onClick={()=>setSlide({kind:'grammar',id:'sample',grammarId:'m-modals'})}>기본 문법 열기</button>
    {slide ? <div data-testid="classroom-board" style={{width:'100%',aspectRatio:'16/9'}}><GrammarBoard point={grammarSlidePoint(slide)} /></div>
    : <MyGrammarLibrary key={String(pick)} onPick={pick ? block=>setSlide({...block,kind:'grammar',id:'slide-1'}) : undefined}/>}</>;
}
createRoot(document.getElementById('root')).render(<App/>);`;
const bundle = await build({ root, configFile: false, logLevel:'error', plugins:[react(),tailwindcss(),{
  name:'grammar-test', enforce:'pre', load(id) {
    const path = id.replaceAll('\\','/');
    if (path.endsWith('/scripts/games/focus.tsx')) return fixture;
    if (path.endsWith('/context/AuthContext.tsx')) return 'export const useAuth=()=>({academy:{id:"' + academy + '"},profile:{id:"teacher"}});';
    if (path.endsWith('/lib/supabase.ts')) return 'import {createClient} from "@supabase/supabase-js"; export const supabase=createClient("' + origin + '","test-key",{auth:{persistSession:false}});';
  }
}],build:{target:'esnext',write:false,copyPublicDir:false,rollupOptions:{input:resolve(root,'scripts/games/focus.html')}}});
const assets = new Map(bundle.output.map(file => ['/'+file.fileName, file.type==='chunk'?file.code:file.source]));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
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
    if (path.endsWith('/academy_scan_access')) return route.fulfill({json:{enabled}});
    if (path.endsWith('/teacher_grammar_blocks')) {
      if (req.method()==='POST') {
        const row = req.postDataJSON(); rows.set(row.id,{...row,revision:1});
        // First insert commits, but client loses the success response.
        return ++inserts === 1 ? route.fulfill({status:409,json:{message:'temporary'}}) : route.fulfill({status:201,body:''});
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
  await page.getByText('저장한 문법 블록이 없어요.').waitFor();
  const create = page.getByRole('button',{name:'AI로 내 문법 만들기',exact:true});
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
  enabled=false; await page.reload();
  await page.getByRole('button',{name:'내 문법에서 불러오기'}).click();
  await page.getByRole('button',{name:new RegExp('도움 요청하기')}).click();
  await page.getByRole('heading',{name:'1 / 6 · 언제 쓸까?'}).waitFor();
  for (let index=0;index<6;index++) {
    await page.getByRole('button',{name:'힌트',exact:false}).click();
    await page.getByText(draft.steps[index].hint,{exact:false}).last().waitFor();
    await page.getByRole('button',{name:'예시 답과 이유',exact:false}).click();
    if (index<5) await page.getByRole('button',{name:/다음$/}).click();
  }
  assert.equal(await page.getByRole('button',{name:/다음$/}).isDisabled(),true);
  await page.getByRole('button',{name:'기본 문법 열기'}).click();
  await page.getByRole('heading',{name:'1 / 6 · 언제 쓸까?'}).waitFor();
  for (let step=0;step<3;step++) await page.getByRole('button',{name:/다음$/}).click();
  await page.getByRole('button',{name:'힌트',exact:false}).click();
  await page.getByRole('button',{name:'예시 답과 이유',exact:false}).click();
  assert.match(await page.getByTestId('classroom-board').innerText(), /No problem/);
  if (process.env.GRAMMAR_PREVIEW_PNG) await page.getByTestId('classroom-board').screenshot({path:process.env.GRAMMAR_PREVIEW_PNG});
  assert.deepEqual(errors,[]);
  console.log(points.length+' catalog boards, '+points.length*6+' stages; Chrome PDF → save retry → reload → import → all six stages passed.');
} finally { await browser.close(); }
