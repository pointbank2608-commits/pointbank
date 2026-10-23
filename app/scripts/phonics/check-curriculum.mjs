import { createServer } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const oracle=JSON.parse(await readFile('scripts/phonics/approved-words.json','utf8')).stages;
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const c=await server.ssrLoadModule('/src/data/phonicsCurriculum.ts');
 const w=await server.ssrLoadModule('/src/data/cvcWorkbook.ts');
 const p=await server.ssrLoadModule('/src/data/phonicsWorkbook.ts');
 const {savedPhonicsEntries}=await server.ssrLoadModule('/src/lib/phonicsSelection.ts');
 const {fillPhonicsMarks}=await server.ssrLoadModule('/src/lib/phonicsFill.ts');
 const {buildPhonicsBlankPages,buildPhonicsCirclePages,makeRng}=await server.ssrLoadModule('/src/lib/worksheetGenerators.ts');
 const all=c.curriculumEntries(), base=c.curriculumEntries(false), summaries=[];
 const keys={th_thin:'th-voiceless',th_this:'th-voiced',ow_long_o:'ow-long-o',oo_book:'oo-short',oo_moon:'oo-long',ow_cow:'ow-diphthong'};
 for(let step=1;step<=5;step++){
   const units=c.unitsForStep(step), rows=base.filter(e=>e.step===step), expected=Object.values(oracle[step].basic).flat();
   assert.deepEqual(rows.map(e=>e.word),expected,`Stage ${step}: approved word order`);
   for(const [key,words] of Object.entries(oracle[step].basic)){
     const actual=step===2||step===3?units.filter(u=>u.name===key).flatMap(u=>u.entries):rows.filter(e=>e.ruleId===(step===1?'letter-'+key.toLowerCase():keys[key]??(step===4?'blend-':'vowel-')+key));
     assert.deepEqual(actual.map(e=>e.word),words,`Rule ${key}`);
     if(step>=4){const pieces=units.filter(u=>u.ruleId===actual[0].ruleId).map(u=>u.entries.length);const plans={3:[3],4:[2,2],5:[3,2],6:[3,3]};assert.deepEqual(pieces,plans[words.length]);}
   }
   for(const [key,words] of Object.entries(oracle[step].extension)){
     const extensions=step===2||step===3?units.find(u=>u.name===key).extensions:all.filter(e=>e.step===step&&e.tier==='extension'&&e.ruleId===(keys[key]??(step===4?'blend-':'vowel-')+key));
     assert.deepEqual(extensions.map(e=>e.word),words,`Extension ${key}`);
   }
   summaries.push({step,units:units.length,displayEntries:rows.length,distinctWords:new Set(rows.map(e=>e.wordId)).size});
 }
 assert.equal(new Set(c.PHONICS_UNITS.map(u=>u.id)).size,c.PHONICS_UNITS.length);
 assert.equal(new Set(c.PHONICS_RULES.map(r=>r.id)).size,c.PHONICS_RULES.length);
 assert.equal(new Set(all.map(e=>e.id)).size,all.length);
 for(const e of all){assert.equal(e.pattern_marked.replace(/[{}]/g,''),e.word);assert(e.targets.length);assert(e.meaning?.trim());assert(e.audio.provider==='web-speech');}
 const ad=c.unitById('cvc-ad');assert.deepEqual(ad.entries.map(e=>e.word),['dad','bad','sad']);
 assert.deepEqual(c.selectPhonicsEntries(all,2,false,'cvc-ad').map(e=>e.word),['dad','bad','sad']);
 assert.deepEqual(c.selectPhonicsEntries(all,2,true,'cvc-ad').map(e=>e.word),['dad','bad','sad','mad']);
 assert.deepEqual(w.CVC_UNITS.find(u=>u.id==='cvc-ad').words,['dad','bad','sad']);
 assert.deepEqual(w.CVC_UNITS.find(u=>u.id==='cvc-an').words,['fan','can','man']);
 assert.equal(w.LONG_UNITS.length,22);assert(w.LONG_UNITS.every(u=>!['-eed','-eet','-eep','-eat'].includes(u.family)));
 assert(!base.some(e=>e.step===4&&e.targets.map(i=>e.word[i]).join('')==='lk'));
 assert(base.some(e=>e.step===1&&e.word==='milk'));
 assert.equal(base.find(e=>e.word==='Ted').word,'Ted');assert.equal(base.find(e=>e.word==='June').word,'June');
 assert.deepEqual(base.filter(e=>e.step===1&&e.ruleId==='letter-x').map(e=>e.targets),[[2],[2],[2]]);
 assert.deepEqual(base.filter(e=>e.step===1&&e.ruleId==='letter-q').map(e=>e.targets),[[0,1],[0,1],[0,1]]);
 const brush=base.filter(e=>e.step===4&&e.word==='brush');assert.equal(brush.length,2);assert.deepEqual(brush.map(e=>e.targets),[[0,1],[3,4]]);
 for(const pair of [['th-voiceless','th-voiced'],['oo-short','oo-long'],['ow-long-o','ow-diphthong']])assert.notEqual(c.PHONICS_RULES.find(r=>r.id===pair[0]).sound,c.PHONICS_RULES.find(r=>r.id===pair[1]).sound);
 const magic=base.find(e=>e.step===3&&e.word==='cake');assert.deepEqual(magic.targets,[1,3]);
 const cards=[magic,...brush].map(e=>({id:e.id,word:e.word,meaning:e.meaning,imageUrl:e.image_url,category:e.rule,patternMarked:e.pattern_marked}));
 const blanks=buildPhonicsBlankPages(cards,makeRng(1));assert.deepEqual(blanks.pages.flat().map(r=>r.answers),[['a','e'],['br'],['sh']]);
 assert.deepEqual(buildPhonicsCirclePages(cards).pages.flat().map(r=>r.letters.flatMap((x,i)=>x.hit?[i]:[])),[[1,3],[0,1],[3,4]]);
 for(let n=1;n<=26;n++){const resolved=w.resolveWorkbookSelection('long',{cvcUnits:[n]});assert.equal(resolved.units.length,1);assert.equal(resolved.missing.length,0);}
 assert.deepEqual(w.resolveWorkbookSelection('long',{cvcUnits:[23]}).units[0].words,['seed','feed','weed']);
 assert.deepEqual(w.resolveWorkbookSelection('long',{cvcUnits:[26]}).units[0].words,['seat','meat','heat']);
 for(const state of [{cvcUnits:[999]},{phonicsUnitIds:['missing-unit']},{phonicsUnitIds:[]},{phonicsUnitIds:'bad-reference'}])assert.equal(w.resolveWorkbookSelection('long',state).units.length,0);
 for(const unit of [...w.CVC_UNITS,...w.LONG_UNITS,...w.LONG_LEGACY_UNITS])for(const q of w.cvcCircleRows(unit)){assert.equal(q.choices.length,3);assert.equal(q.choices.filter(choice=>choice===q.word).length,1);}
 const legacy={id:'x-ray-s1',word:'x-ray',meaning:'엑스레이',step:1,rule:'X',pattern_marked:'{x}-ray',image_url:null,sort_order:1};
 const merged=c.withLegacyPhonics([legacy]);assert.deepEqual(merged.find(e=>e.id===legacy.id),{...legacy,tier:'legacy'});
 assert(!c.selectPhonicsEntries(merged,1,true).some(e=>e.word==='x-ray'));
 const old={id:'saved',word:'teacher',meaning:'선생님',imageUrl:null,category:'er',patternMarked:'teach{er}'};
 const restored=savedPhonicsEntries([old],all)[0];assert.equal(restored.word,old.word);assert.equal(restored.pattern_marked,old.patternMarked);assert.equal(restored.meaning,old.meaning);
 const filled=fillPhonicsMarks([{id:'saved-blank-image',word:'dad',meaning:'아빠',category:all.find(e=>e.word==='dad').rule,imageUrl:null}],all,true)[0];
 assert(filled.patternMarked);assert.equal(filled.imageUrl,null);
 const unresolved={id:'past-brush',word:'brush',meaning:'솔',imageUrl:null,category:'unknown-historical-sh-rule'};
 assert.equal(fillPhonicsMarks([unresolved],all,true)[0].patternMarked,undefined);
 assert.equal(savedPhonicsEntries([unresolved],all).length,0);
 const statuses=[];
 for(const step of [4,5]){
   const units=p.buildPhonicsWorkbook(all,step);
   assert.deepEqual(units.map(u=>u.id),c.unitsForStep(step).map(u=>u.id));
   assert.deepEqual(units.flatMap(u=>u.words),base.filter(e=>e.step===step).map(e=>e.word));
   for(const unit of units){const qs=p.phonicsCircleRows(unit);assert(qs.every(q=>q.choices.filter(x=>x===q.word).length===1));assert(new Set(qs.map(q=>q.choices.indexOf(q.word))).size>1);}
   statuses.push({step,units:units.length,printableUnits:units.filter(p.workbookPrintable).length,fullPictureUnits:units.filter(u=>!p.workbookUsesText(u)).length});
 }
 const fs=await import('node:fs');const issues=[];
 for(const [id,word] of Object.entries(c.PHONICS_WORDS)){
   for(const [kind,path] of [['color',word.imageUrl],['lineart',word.lineartUrl]]){
     if(path)assert(fs.existsSync('public'+path),`${id}: broken ${path}`);
     else issues.push({wordId:id,word:word.word,kind,units:c.PHONICS_UNITS.filter(u=>[...u.entries,...u.extensions].some(e=>e.wordId===id)).map(u=>u.id)});
   }
 }
 const result={passed:true,summaries,statuses,distinctWords:Object.keys(c.PHONICS_WORDS).length,assetIssues:issues,reviewWords:['glob','glum','bran','prim','prop'],audio:'Existing free browser speech; no recordings generated'};
 await mkdir('../output/phonics-curriculum',{recursive:true});await writeFile('../output/phonics-curriculum/data-audit.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({...result,assetIssues:{count:issues.length,words:[...new Set(issues.map(i=>i.word))]}}));
}finally{await server.close();}
