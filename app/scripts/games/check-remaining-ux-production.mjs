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
 return route.fulfill({status:200,headers,json:data});
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));




await mkdir('../output/ux-remaining',{recursive:true});const results=[];
try{
 for(const id of ['balloonpop','wordtrain','wordfishing','grammardetective']){
  await page.goto('https://pointbank-ten.vercel.app/games/'+id);const guide=page.locator('[data-game-guide]');await guide.waitFor();
  const sentence=guide.getByRole('button',{name:'문장으로 만들기',exact:false});const row={game:id,sentenceDisabled:await sentence.isDisabled()};
  if(id!=='grammardetective'){
   await guide.getByRole('button',{name:id==='wordtrain'?'문장으로 만들기':'단어로 만들기',exact:false}).click();
   await page.getByRole('textbox',{name:id==='wordtrain'?'문장 입력':'단어 입력',exact:true}).fill(id==='wordtrain'?'I like cats.\nWe like dogs.':'apple / 사과\nbanana / 바나나\ncat / 고양이\ndog / 개');
   await guide.getByRole('button',{name:'완료',exact:true}).click();row.stillOpen=await guide.isVisible();row.error=await guide.locator('[data-guide-error]').textContent().catch(()=>null);
  }
  results.push(row);await page.screenshot({path:'../output/ux-remaining/production-'+id+'.png',fullPage:true});
 }
 await page.goto('https://pointbank-ten.vercel.app/phonics/lesson?unit=course-2-1&lesson=2');await page.locator('.pc-player-controls select').waitFor();const ids=await page.locator('.pc-player-controls option').evaluateAll(ns=>ns.filter(n=>n.textContent.includes('Read and Remember')).map(n=>({id:n.value,title:n.textContent})));results.push({phonicsMemoryAddresses:ids});
 console.log(JSON.stringify({production:true,backend:'isolated synthetic API responses; no real writes',results,errors},null,2));await writeFile('../output/ux-remaining/production-baseline.json',JSON.stringify({results,errors},null,2));
}finally{await browser.close();}
