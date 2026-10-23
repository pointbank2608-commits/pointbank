// Regression checks for the six-picture-activity policy (historical command name retained).
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {writeFile,mkdir,access} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try {
 const c=await server.ssrLoadModule('/src/data/phonicsCurriculum.ts');
 const p=await server.ssrLoadModule('/src/data/phonicsWorkbook.ts');
 const m=await server.ssrLoadModule('/src/data/phonicsMedia.ts');
 const entries=c.curriculumEntries();
 const units=[...p.buildPhonicsWorkbook(entries,4),...p.buildPhonicsWorkbook(entries,5)];
 assert.equal(units.length,80);
 const find=w=>units.find(u=>u.words.includes(w));
 for(const w of ['black','blank','clam','glob','brush'])assert(p.workbookPrintable(find(w)),w);
 for(const w of ['them','then','term'])assert(!p.workbookPrintable(find(w)),w);
 assert.deepEqual(units.find(u=>u.ruleId==='blend-br').targets.brush.red,[0,1]);
 assert.deepEqual(units.find(u=>u.family==='sh'&&u.words.includes('brush')).targets.brush.blank,[3,4]);
 assert.equal(c.wordBySpelling('thin').meaning,'얇은');assert.equal(c.wordBySpelling('thick').meaning,'두꺼운');
 assert.equal(c.wordBySpelling('thin').lineartUrl,'/word-bank-lineart/thin-v2.webp');
 for(const u of units)for(const w of u.words){
  assert.deepEqual(u.targets[w].blank,u.targets[w].red);
  for(const q of p.phonicsCircleRows(u))assert.equal(q.choices.filter(x=>x===q.word).length,1);
 }
 const black=find('black');
 assert(!p.workbookPrintable({...black,words:[]}));
 assert(!p.workbookPrintable(p.withVerifiedWorkbookAssets(black,{[black.images.black]:false})));
 const before=entries.find(e=>e.word==='black');
 const uploaded={...before,id:'stored-upload',word:'BLACK',image_url:'/uploads/black-v2.webp',lineart_url:'/uploads/black-outline-v2.webp'};
 const updated=m.withPhonicsMediaUpdates(entries,[uploaded]);
 const after=updated.find(e=>e.id===before.id);
 assert.equal(after.image_url,uploaded.image_url);assert.equal(after.lineart_url,uploaded.lineart_url);
 assert.deepEqual({...after,image_url:before.image_url,lineart_url:before.lineart_url},before);
 assert(p.workbookPrintable(p.buildPhonicsWorkbook(updated,4)[0]));
 const missingOutline=m.withPhonicsMediaUpdates(entries,[{...uploaded,lineart_url:null}]);
 assert.equal(missingOutline.find(e=>e.id===before.id).lineart_url,null);
 assert(!p.workbookPrintable(p.buildPhonicsWorkbook(missingOutline,4)[0]));
 assert.deepEqual(m.withPhonicsMediaUpdates(entries,[{...uploaded,image_url:'/phonics-images/black.png'}]),entries);
 assert.deepEqual(m.withPhonicsMediaUpdates(entries,[uploaded,{...uploaded,image_url:'/uploads/conflict.webp'}]),entries);
 for(const word of Object.values(c.PHONICS_WORDS))for(const key of ['imageUrl','lineartUrl'])if(word[key]?.startsWith('/'))await access('public'+word[key]);
 const missing=units.flatMap(u=>u.issues.filter(i=>i.type==='color'||i.type==='lineart').map(i=>({step:u.step,unit:u.unit,unitId:u.id,word:i.word,kind:i.type})));
 const result={passed:true,stages:[4,5].map(step=>{const us=units.filter(u=>u.step===step);return {step,units:us.length,entries:us.reduce((n,u)=>n+u.words.length,0),printable:us.filter(p.workbookPrintable).length};}),missing};
 await mkdir('../output/phonics-six-activities',{recursive:true});await writeFile('../output/phonics-six-activities/data-checks.json',JSON.stringify(result,null,2));
 const lines=['# 완성 워크북 자산 현황','','완성 워크북은 컬러 그림과 별도 선화를 모두 갖춘 경우에만 기존 6가지 활동으로 제공한다. 읽기·쓰기 대체 템플릿은 사용하지 않는다.','','| 단어 | 부족한 자료 | 영향받는 유닛 |','|---|---|---|'];
 for(const w of [...new Set(missing.map(i=>i.word))]){const rs=missing.filter(i=>i.word===w);lines.push('| '+w+' | '+[...new Set(rs.map(i=>i.kind))].join(', ')+' | '+[...new Set(rs.map(i=>i.unitId))].join(', ')+' |');}
 lines.push('','them: 대명사의 목적격을 정확히 드러내는 컬러 장면 검토 필요. then: 현재 단일 장면으로 시간 순서가 드러나지 않음. term: 학교 건물 그림만으로 학기 의미가 불명확함. 이 세 항목은 임의 선화를 제작해 완료 처리하지 않았다.');
 await writeFile('../docs/phonics-workbook-asset-audit.md',lines.join('\n')+'\n');
 console.log(JSON.stringify(result));
}finally{await server.close();}
