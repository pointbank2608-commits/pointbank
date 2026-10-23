import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { observedBank } from '../workbooks/observed-bank.mjs';
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
await context.route('**/*.supabase.co/**',async route=>{
 const req=route.request(),url=req.url(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 const single=(req.headers().accept??'').includes('vnd.pgrst.object');let data=single?{}:[];
 if(url.includes('/rest/v1/rpc/my_deletion_request'))data=null;else if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/'))data=session;
 else if(url.includes('/rest/v1/profiles'))data=single?profile:[profile];else if(url.includes('/rest/v1/academies'))data=single?academy:[academy];
 else if(url.includes('/rest/v1/phonics_bank'))data=[...observedBank,{id:'old-x-ray',word:'x-ray',pattern_marked:'{x}-ray',step:1,rule:'X',meaning:'엑스레이',image_url:null,sort_order:999}];
 return route.fulfill({status:200,headers,json:data});
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const root=process.env.PHONICS_QA_URL??'http://127.0.0.1:5180';


const manifest=JSON.parse(await readFile('scripts/phonics/generated-color-cards.json','utf8'));
const curriculum=JSON.parse(await readFile('src/data/phonics/curriculum.json','utf8'));
const accepted=manifest.records.filter(r=>r.status==='accepted');
assert.equal(accepted.length,16);
await mkdir('../output/phonics-color-images',{recursive:true});
const checks=[];
await page.goto(root+'/phonics');
for(const asset of accepted){
 const rule=curriculum.rules.find(r=>[4,5].includes(r.step)&&r.groups.some(g=>g.patterns.some(p=>p.replaceAll(/[{}]/g,'')===asset.word)));
 const group=rule.groups.find(g=>g.patterns.some(p=>p.replaceAll(/[{}]/g,'')===asset.word));
 const wordIndex=group.patterns.findIndex(p=>p.replaceAll(/[{}]/g,'')===asset.word);
 const sizes={3:[3],4:[2,2],5:[3,2],6:[3,3]}[group.patterns.length];let offset=0,part=0;
 for(let i=0;i<sizes.length;i++){if(wordIndex<offset+sizes[i]){part=i;break;}offset+=sizes[i];}
 const unitId=group.unitIds[part];
 await page.getByRole('button',{name:rule.step+'단계',exact:true}).click();
 await page.getByLabel('학습 유닛',{exact:true}).selectOption(unitId);
 const image=page.locator(`img[src="/phonics-images/${asset.word}.webp"]`).first();await image.waitFor();await image.evaluate(el=>el.decode());
 assert.deepEqual(await image.evaluate(el=>[el.naturalWidth,el.naturalHeight,getComputedStyle(el).objectFit]),[1024,1024,'contain']);
 await image.locator('..').click();
 const lightbox=page.locator('.fixed.inset-0.z-50').filter({has:page.locator('img')});await lightbox.waitFor();
 const enlarged=lightbox.locator('img');await enlarged.evaluate(el=>el.decode());
 assert((await enlarged.getAttribute('src')).endsWith('/'+asset.word+'.webp'));
 assert.equal(await enlarged.evaluate(el=>getComputedStyle(el).objectFit),'contain');
 if(['clam','flap','fern','glum'].includes(asset.word))await page.screenshot({path:'../output/phonics-color-images/'+asset.word+'-enlarged.png',fullPage:false});
 await page.keyboard.press('Escape');
 await page.goto(root+'/materials/phonics-stage-'+rule.step+'-workbook');
 await page.getByRole('button',{name:'선택 지우기',exact:true}).click();
 // The option contains exactly this approved unit's words, never an extension.
 const unitWords=group.patterns.slice(offset,offset+sizes[part]).map(p=>p.replaceAll(/[{}]/g,''));
 const checkbox=page.getByRole('checkbox',{name:new RegExp(unitWords.join(' · '))});
 if(await checkbox.isDisabled()){
  assert.equal(asset.word,'fern'); // Its unchanged unit also contains term, whose outline needs semantic review.
  checks.push({word:asset.word,step:rule.step,unitId,thumbnail:true,enlarged:true,workbook:false,reason:'term outline review'});
  await page.goto(root+'/phonics');continue;
 }
 await checkbox.check();
 await page.waitForFunction(()=>document.querySelectorAll('.print-board').length===2);
 const pictures=page.locator(`.print-board img[src="/phonics-images/${asset.word}.webp"]`);
 assert.equal(await pictures.count(),5);await pictures.first().evaluate(el=>el.decode());
 assert.equal(await page.getByRole('button',{name:'선택 유닛 인쇄',exact:true}).isEnabled(),true);
 if(['clam','fern','glob'].includes(asset.word)){
  await page.emulateMedia({media:'print'});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.print-board img')].map(i=>i.decode()));});
  const bounds=await page.locator('.print-board').evaluateAll(els=>els.map(el=>({height:el.getBoundingClientRect().height,overflow:el.scrollWidth-el.clientWidth})));
  assert(bounds.every(b=>b.height<1032&&b.overflow<2));
  await page.screenshot({path:'../output/phonics-color-images/'+asset.word+'-workbook.png',fullPage:true});
  await page.emulateMedia({media:'screen'});
 }
 checks.push({word:asset.word,step:rule.step,unitId,thumbnail:true,enlarged:true,workbook:true});
 await page.goto(root+'/phonics');
}
await page.setViewportSize({width:390,height:850});
await page.getByRole('button',{name:'4단계',exact:true}).click();await page.getByLabel('학습 유닛',{exact:true}).selectOption('blend-gl-b');
await page.locator('img[src="/phonics-images/glum.webp"]').evaluate(el=>el.decode());
await page.screenshot({path:'../output/phonics-color-images/mobile-cards.png',fullPage:false});
assert.deepEqual(errors,[]);
await writeFile('../output/phonics-color-images/browser-checks.json',JSON.stringify({passed:true,checks,reviewOnly:['them'],errors},null,2));
await browser.close();console.log('PASS: all 16 generated source cards and enlargement; 15 printable units, fern unit correctly waits for term outline.');
