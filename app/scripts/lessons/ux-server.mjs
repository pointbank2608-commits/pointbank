import {createServer} from 'vite';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const list=(id,cls,words)=>({id,name:id==='words-a'?'파닉스 A·B·C':id==='words-c'?'다른 반 단어장 C':'공용 단어장',academy_id:'academy',class_id:cls,kind:'word',items:words.split(' ').map((word,i)=>({id:id+i,word,meaning:word+' 뜻',image_url:id==='words-a'?'/phonics-images/'+word+'.webp':null})),created_at:'2026-11-01'});
const lesson=(id,cls,name)=>({id,class_id:cls,name,academy_id:'academy',word_list_id:'words-a',created_by:'teacher',created_at:'2026-11-01',updated_at:'2026-11-01',playlist:[{id:id+'slide',kind:'canvas',elements:[{id:id+'title',type:'text',x:15,y:35,w:70,h:28,text:'Phonics A · B · C',fontSize:9,color:'#17375e',bold:true,align:'center',font:'sans',fill:null}]}]});
const seed={classes:[{id:'a',name:'3:30 리딩',academy_id:'academy'},{id:'b',name:'단어장 없는 반',academy_id:'academy'},{id:'c',name:'다른 반',academy_id:'academy'}],lists:[list('words-a','a','apple ant axe bag bat bus cap cat cup'),list('words-c','c','red blue green yellow'),list('shared',null,'sun moon star sky')],lessons:[lesson('lesson-a','a','기존 리딩 수업'),lesson('lesson-shared',null,'모든 반 공용 수업'),lesson('lesson-b','b','다른 반 수업')],calls:[],notices:[],templates:[],fail:false,delays:{},counter:0};
export async function createLessonUxServer(port=5416,baseline=false){
const setup=`window.__lessonQA=JSON.parse(localStorage.getItem('lesson-ux-qa')||'null')||${JSON.stringify(seed)};window.__saveLessonQA=()=>localStorage.setItem('lesson-ux-qa',JSON.stringify(window.__lessonQA));`;
const names=[...readFileSync(resolve(root,'src/lib/api.ts'),'utf8').matchAll(/export (?:async )?function (\w+)|export const (\w+)/g)].map(m=>m[1]||m[2]);
const api=`import { isActivityDraft, patchActivityDraft } from '/src/lib/quickActivity.ts';
${setup}
const scope=(rows,id)=>structuredClone(rows.filter(x=>!x.class_id||x.class_id===id));
const funcs={fetchCurriculumLessonById:async id=>structuredClone(window.__lessonQA.lessons.find(row=>row.id===id)??null),fetchClasses:async()=>window.__lessonQA.classes,fetchWordLists:async(_,id,kind='word')=>{const db=window.__lessonQA,rows=scope(db.lists,id);const fail=db.fail;await new Promise(r=>setTimeout(r,db.delays[id]||30));if(fail)throw Error('Test connection error');return kind==='all'?rows:rows.filter(x=>(x.kind||'word')===kind);},fetchAllWordLists:async()=>structuredClone(window.__lessonQA.lists),fetchCurriculumLessons:async(_,id)=>{const rows=scope(window.__lessonQA.lessons,id);await new Promise(r=>setTimeout(r,window.__lessonQA.delays[id]||30));return rows;},fetchDeletedLessons:async()=>[],fetchWordBank:async()=>[{id:'picture-apple',word:'apple',meaning:'사과',image_url:'/phonics-images/apple.webp'}],uploadGameImage:async()=>({path:'fixture-upload.webp',url:'/phonics-images/ant.webp'}),fetchGameTemplates:async(_a,_c,type)=>window.__lessonQA.templates.filter(x=>x.game_type===type),fetchGameTemplateById:async id=>structuredClone(window.__lessonQA.templates.find(x=>x.id===id)),fetchStudentsOfClass:async()=>[],updateGameTemplate: async (id, patch) => {
  if (isActivityDraft(id)) {
    patchActivityDraft(id, patch);
    return;
  }
  const template = window.__lessonQA.templates.find(row => row.id === id);
  Object.assign(template, patch);
  window.__saveLessonQA();
},createGameTemplate:async p=>{const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,game_type:p.gameType,items:p.items,config:p.config,name:p.name};window.__lessonQA.templates.push(row);window.__saveLessonQA();return row;},createCurriculumLesson:async p=>{if(window.__lessonQA.failSave)throw Error('Test save failure');const row={id:crypto.randomUUID(),name:p.name,class_id:p.classId,academy_id:p.academyId,word_list_id:p.wordListId,playlist:p.playlist,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};window.__lessonQA.lessons.push(row);window.__saveLessonQA();return structuredClone(row);},updateCurriculumLesson:async(id,patch)=>{const row=window.__lessonQA.lessons.find(x=>x.id===id);Object.assign(row,structuredClone(patch));window.__saveLessonQA();return row;}};
${names.map(n=>`export const ${n}=async(...args)=>{window.__lessonQA.calls.push({name:'${n}',args:structuredClone(args)});return (funcs.${n}||(async()=>[]))(...args);};`).join('\n')}`;
const auth=`const value={academy:{id:'academy',name:'QA ClassBank',deleted_at:null,features:{homework:true,group:true},plan:'paid'},profile:{id:'teacher',role:'teacher',display_name:'QA 선생님'},session:{user:{id:'teacher'}},isStaff:true,isAdmin:false,isPaid:true,hasFullAccess:true,pointUnit:'별',trial:{active:false,daysLeft:7},signOut:async()=>{}};export const useAuth=()=>value;`;
const db=`${setup}
const storage={from(bucket){
 if(bucket!=='lesson-pdfs')throw Error('Unexpected storage bucket: '+bucket);
 const key=path=>'qa-lesson-pdf:'+path;
 return {
  async upload(path,blob){const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});localStorage.setItem(key(path),data);return {data:{path},error:null};},
  async download(path){const url=localStorage.getItem(key(path));return url?{data:await fetch(url).then(r=>r.blob()),error:null}:{data:null,error:{message:'Missing file'}};},
  async createSignedUrl(path){return {data:{signedUrl:localStorage.getItem(key(path))},error:null};},
  async remove(paths){paths.forEach(path=>localStorage.removeItem(key(path)));return {error:null};}
 };
}};
export const supabase={storage,channel:()=>({on(){return this},subscribe(){return this},unsubscribe(){}}),from(table){const q=new Proxy({}, {get(_,key){return key==='then'?(resolve)=>resolve({data:table==='video_clips'?[{id:'qa-video',youtube_id:'abcdefghijk',title:'Sample classroom film',series:'Sample',script:'[0:00-0:04] Hello!',words:[],tags:[],pack:{},start_sec:0,end_sec:4}]:[],error:null}):()=>q;}});return q;},rpc:async name=>({data:name==='my_deletion_request'?null:[],error:null})};`;
const before=['src/pages/CurriculumPage.tsx','src/components/LessonSlideSorter.tsx','src/components/QuickLessonWizard.tsx','src/components/LessonRecipePicker.tsx'];
return createServer({root,cacheDir:'node_modules/.vite/qa-lesson-'+baseline,logLevel:'error',plugins:[{name:'lesson-isolated',enforce:'pre',configureServer(s){s.middlewares.use((req,res,next)=>{if(/^\/(curriculum(?:\/[^/?]+\/slide\/[^/?]+)?|games(?:\/[^/?]+)?|phonics-games(?:\/[^/?]+)?|materials(?:\/[^/?]+)?)(\?|$)/.test(req.url||''))req.url='/scripts/lessons/ux-fixture.html?go='+encodeURIComponent(req.url);next();});},load(id){const p=id.replaceAll('\\','/').split('?')[0];if(p.endsWith('/src/lib/api.ts'))return api;if(p.endsWith('/src/lib/supabase.ts'))return db;if(p.endsWith('/src/context/AuthContext.tsx'))return auth;if(p.endsWith('/src/context/ToastContext.tsx'))return `let timer;function showNotice(message,kind){window.__lessonQA.notices.push([message,kind]);document.querySelector('[data-preview-toast]')?.remove();const toast=document.createElement('div');toast.dataset.previewToast='';toast.setAttribute('role','status');toast.className='fixed left-1/2 bottom-6 -translate-x-1/2 max-w-[90vw] px-5 py-2.5 rounded-full bg-deep-navy text-white shadow-lg z-50';toast.textContent=message;document.body.append(toast);clearTimeout(timer);timer=setTimeout(()=>toast.remove(),2500);}const value={notify:showNotice,run:async (f,message)=>{try{await f();if(message)showNotice(message);return true;}catch(e){showNotice(e.message,'error');return false;}}};export const useToast=()=>value;`;const file=before.find(x=>p.endsWith('/'+x));if(baseline&&file)return execFileSync('git',['show','HEAD:app/'+file],{cwd:resolve(root,'..'),encoding:'utf8'});}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false}});
}
