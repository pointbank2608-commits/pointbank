import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { writeFile, mkdir, readdir, access } from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try {
 const c=await server.ssrLoadModule('/src/data/phonicsCurriculum.ts');
 const p=await server.ssrLoadModule('/src/data/phonicsWorkbook.ts');
 const tasks=await server.ssrLoadModule('/src/data/phonicsWorkbookTasks.ts');
 const units=[...p.buildPhonicsWorkbook(c.curriculumEntries(),4),...p.buildPhonicsWorkbook(c.curriculumEntries(),5)];
 assert.equal(units.length,80);assert(units.every(p.workbookPrintable));
 const find=word=>units.find(u=>u.words.includes(word));
 assert(!p.workbookUsesText(find('black')));
 assert(p.workbookHasPictures(find('blank')));assert(!p.workbookHasLineart(find('blank')));
 assert.deepEqual(find('clam').words,['clam','clock']);assert(find('clam').images.clock);assert(!find('clam').images.clam);
 assert(!p.workbookHasPictures(find('glob')));assert.deepEqual(find('glob').words,['glob','glum']);
 assert.deepEqual(units.find(u=>u.ruleId==='blend-br').targets.brush.red,[0,1]);
 assert.deepEqual(units.find(u=>u.family==='sh'&&u.words.includes('brush')).targets.brush.blank,[3,4]);
 for(const unit of units)for(const word of unit.words){
  const letters=tasks.workbookLetterOrder(word);assert.deepEqual([...letters].sort(),[...word].sort());assert.notEqual(letters.join(''),word);
  assert(unit.meanings[word]);
  const blank=unit.targets[word].blank;assert.deepEqual(blank,unit.targets[word].red);
  assert(blank.every(i=>Number.isInteger(i)&&i>=0&&i<word.length));
 }
 const invalid=c.curriculumEntries().map(e=>e.word==='black'&&e.step===4?{...e,pattern_marked:'black'}:e);
 assert(!p.workbookPrintable(p.buildPhonicsWorkbook(invalid,4)[0]));
 const black=find('black');assert(!p.workbookPrintable({...black,words:[]}));
 assert(!p.workbookPrintable({...black,targets:{...black.targets,black:{red:[99],blank:[99]}}}));
 const failed=p.withVerifiedWorkbookAssets(black,{[black.images.black]:false});
 assert(p.workbookPrintable(failed));assert(!p.workbookHasPictures(failed));assert(!failed.images.black);
 assert(!p.workbookPrintable({...failed,meanings:{}}));
 const files=await readdir('public',{recursive:true});const imageFiles=files.filter(f=>/\.(webp|png|jpg|svg)$/i.test(f));
 const unresolved=[];
 for(const word of Object.values(c.PHONICS_WORDS))for(const kind of ['imageUrl','lineartUrl']){
  if(word[kind]){
   await access('public'+word[kind]);
   assert(imageFiles.some(f=>'/'+f.replaceAll('\\','/')===word[kind]),word.word+': asset path case mismatch');
  }
  else {
   const exact=imageFiles.filter(f=>f.replaceAll('\\','/').split('/').at(-1).replace(/\.[^.]+$/,'').toLowerCase()===word.word.toLowerCase());
   const eligible=kind==='lineartUrl'?exact.filter(f=>f.replaceAll('\\','/').startsWith('word-bank-lineart/')):exact;
   if(eligible.length)unresolved.push({word:word.word,kind,exact:eligible});
  }
 }
 assert.deepEqual(unresolved,[],'An existing exact word asset is not mapped');
 const missing=[];
 for(const unit of units)for(const issue of unit.issues.filter(i=>i.type==='color'||i.type==='lineart'))missing.push({unitId:unit.id,unit:unit.unit,step:unit.step,word:issue.word,kind:issue.type});
 const result={passed:true,unmappedExistingAssets:unresolved,stages:[4,5].map(step=>{const us=units.filter(u=>u.step===step);return {step,units:us.length,entries:us.reduce((n,u)=>n+u.words.length,0),printable:us.filter(p.workbookPrintable).length,fullPicture:us.filter(u=>!p.workbookUsesText(u)).length,colorOnly:us.filter(u=>p.workbookHasPictures(u)&&!p.workbookHasLineart(u)).length,textOnly:us.filter(u=>!p.workbookHasPictures(u)).length};}),missing};
 await mkdir('../output/phonics-fallback',{recursive:true});await writeFile('../output/phonics-fallback/data-checks.json',JSON.stringify(result,null,2));
 const lines=['# 4·5단계 워크북 자산 조사 및 보완 목록','','공통 단어 ID·표기·대소문자·실제 파일 경로를 대조했다. 정확한 단어명으로 존재하지만 연결되지 않은 컬러·선화 파일은 0개다. brush는 기존 솔/빗 그림에 맞춰 공통 뜻을 ‘솔, 빗’으로 바로잡았다. 기본 단어·순서·ID는 유지했다. blank/blink는 사전 컬러 그림에 연결되어 있으며 선화만 없다. clam/glob/glum에는 대응 그림이 없다. shell/globe처럼 철자나 의미가 다른 자산은 대신 사용하지 않는다.','','파일이 없다는 이유로 단어를 변경하지 않는다. 자산 부족은 활동 대체로 처리하며, 아래 자료는 원래 그림 활동을 복원할 때 제작할 목록이다.','','| 단어 | 필요한 자료 | 영향받는 유닛 |','|---|---|---|'];
 for(const word of [...new Set(missing.map(i=>i.word))].sort()){
  const rows=missing.filter(i=>i.word===word);lines.push('| '+word+' | '+[...new Set(rows.map(i=>i.kind==='color'?'컬러 그림':'색칠용 선화'))].join(' · ')+' | '+[...new Set(rows.map(i=>i.step+'단계 '+i.unit+' ('+i.unitId+')'))].join(', ')+' |');
 }
 await writeFile('../docs/phonics-workbook-asset-audit.md',lines.join('\n')+'\n');
 console.log(JSON.stringify({...result,missing:{color:[...new Set(missing.filter(i=>i.kind==='color').map(i=>i.word))],lineartCount:new Set(missing.filter(i=>i.kind==='lineart').map(i=>i.word)).size}}));
} finally {await server.close();}
