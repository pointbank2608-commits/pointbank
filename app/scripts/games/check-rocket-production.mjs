import assert from 'node:assert/strict';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const env=await readFile('.env.local','utf8');
const ref=env.match(/VITE_SUPABASE_URL=https:\/\/([^.]+)/)[1];
const uid='00000000-0000-4000-8000-000000000001',aid='00000000-0000-4000-8000-0000000000aa',exp=Math.floor(Date.now()/1000)+86400;
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const user={id:uid,aud:'authenticated',role:'authenticated',email:'phonics-test@example.com',app_metadata:{},user_metadata:{}};
const session={access_token:`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:uid,role:'authenticated',exp,aud:'authenticated'})}.test-only`,refresh_token:'test-only',expires_at:exp,expires_in:86400,token_type:'bearer',user};
const profile={id:uid,academy_id:aid,role:'owner',display_name:'Phonics QA'};
const academy={id:aid,name:'QA',point_unit:'별',plan:'paid',plan_status:'active',deletion_requested_at:null,features:{group:true,solo:true,homework:true}};
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(({key,session})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('classbank.lang','ko');localStorage.setItem('classbank.printWatermark','off');},{key:`sb-${ref}-auth-token`,session});
let mediaRows=[];
await context.route('**/*.supabase.co/**',async route=>{
 const req=route.request(),url=req.url(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 const single=(req.headers().accept??'').includes('vnd.pgrst.object');let data=single?{}:[];
 if(url.includes('/rest/v1/rpc/my_deletion_request'))data=null;else if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/'))data=session;
 else if(url.includes('/rest/v1/profiles'))data=single?profile:[profile];else if(url.includes('/rest/v1/academies'))data=single?academy:[academy];
 else if(url.includes('/rest/v1/phonics_bank'))data=mediaRows;
 else if(url.includes('/rest/v1/word_lists'))data=[{id:'ux-diagram-list',academy_id:aid,class_id:null,name:'UX점검 그림 연결',kind:'word',items:[{id:'ux-dog',word:'dog',meaning:'강아지',image_url:null}],updated_at:'2026-10-28'}];
 else if(url.includes('/rest/v1/word_bank'))data=[{id:'ux-bank-dog',word:'dog',meaning:'강아지',image_url:'/word-bank-images/dog.webp',example_sentence:null,category:'animal'}];
 return route.fulfill({status:200,headers,json:data});
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));






try{
 await page.goto('https://pointbank-ten.vercel.app/games/sentencerocket');const guide=page.locator('[data-game-guide]');const sentence=guide.getByRole('button',{name:'문장으로 만들기',exact:false});await sentence.waitFor();assert.equal(await sentence.isDisabled(),false);assert.equal(await guide.getByRole('button',{name:'단어로 만들기',exact:false}).isDisabled(),true);await sentence.click();await page.getByRole('textbox',{name:'문장 입력',exact:true}).fill('The monkey is eating a banana.');await page.getByLabel('구 블록 경계 ( | 로 구분, 교사 직접 지정)',{exact:true}).fill('The monkey | is eating | a banana.');await guide.getByRole('button',{name:'완료',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.locator('[data-play-mode]').getAttribute('data-play-mode'),'prepare');await page.locator('[data-game-ready-overlay]').getByRole('button',{name:'게임 시작',exact:true}).click();await page.locator('[data-play-mode=play]').waitFor();assert.equal(await page.locator('[data-piece]').count(),3);assert.deepEqual(errors,[]);await page.screenshot({path:'../output/ux-remaining/rocket-production.png'});const result={passed:true,production:'https://pointbank-ten.vercel.app',backend:'isolated UX점검 API responses; no production data writes',sentenceEnabled:true,customPhraseBlocks:3,doneToReady:true,start:true,errors};await writeFile('../output/ux-remaining/rocket-production-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){console.error((await page.locator('body').innerText()).slice(-3500));throw e;}finally{await browser.close();}
