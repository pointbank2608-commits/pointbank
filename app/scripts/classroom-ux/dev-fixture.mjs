// Local, synthetic browser fixture. No production requests or learning events.
import { createServer } from 'vite';
const ref='classroom-fixture';
const uid='00000000-0000-4000-8000-000000000001',aid='00000000-0000-4000-8000-0000000000aa';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'classroom-qa@example.test',app_metadata:{},user_metadata:{}};
const exp=Math.floor(Date.now()/1000)+86400,b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const session={access_token:`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:uid,role:'authenticated',exp,aud:'authenticated'})}.test-only`,refresh_token:'test-only',expires_at:exp,expires_in:86400,token_type:'bearer',user};
const bootstrap=({ref,session,user,uid,aid})=>{
 localStorage.setItem(`sb-${ref}-auth-token`,JSON.stringify(session));localStorage.setItem('classbank.lang','ko');
 const profile={id:uid,academy_id:aid,role:'owner',display_name:'수업 확인'},academy={id:aid,name:'수업 확인',point_unit:'별',plan:'paid',plan_status:'active',features:{group:true,solo:true,homework:true}};
 const animalWords=['cat','dog','pig','cow','duck','horse'];
 let lists=[{id:'qa-words',name:'집·농장 동물',kind:'word',academy_id:aid,class_id:null,items:animalWords.map((word,i)=>({id:'w'+i,word,meaning:['고양이','개','돼지','소','오리','말'][i],image_url:`/phonics-images/${word}.webp`}))},{id:'qa-sentences',name:'집·농장 동물',kind:'sentence',academy_id:aid,class_id:null,items:['I like cats.','I can see a dog.','The pig is pink.','I have a duck.'].map((word,i)=>({id:'s'+i,word,meaning:'문장 '+(i+1),image_url:null}))}];
 let lessons=[{id:'qa-lesson',academy_id:aid,class_id:'qa-class',name:'함께 쓰는 수업',word_list_id:'qa-words',slides:[],updated_at:'2026-11-19'}];
 const clips=[{id:'qa-clip',series:'수업 확인용 영상',title:'I like it.',summary:'한 문장 연습',youtube_id:'aqz-KE-bpKQ',channel:'Sample',start_sec:0,end_sec:8,level:1,tags:['일상'],script:'[0:01-0:04] I **like** it. | 나는 그게 좋아요.\n[0:04-0:07] I can do it. | 나는 할 수 있어요.',words:['like'],pack:{},sort_order:1,hidden:false}];
 const nativeSpeech=window.speechSynthesis?.speak.bind(window.speechSynthesis);if(nativeSpeech)window.speechSynthesis.speak=utterance=>{console.log('[classroom audio] '+utterance.text);return nativeSpeech(utterance);};document.addEventListener('play',event=>{if(event.target instanceof HTMLAudioElement)console.log('[classroom recording] '+event.target.currentSrc);},true);
 const native=window.fetch.bind(window);window.fetch=async(input,init)=>{
  const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  if(!raw.includes('.supabase.co/'))return native(input,init);
  const url=new URL(raw),path=url.pathname,method=init?.method??(input instanceof Request?input.method:'GET');
  const headers=new Headers(init?.headers??(input instanceof Request?input.headers:undefined));const single=(headers.get('accept')??'').includes('vnd.pgrst.object');let data=single?{}:[];
  if(path.includes('/auth/v1/user'))data=user;else if(path.includes('/auth/v1/'))data=session;
  else if(path.endsWith('/profiles'))data=single?profile:[profile];else if(path.endsWith('/academies'))data=single?academy:[academy];
  else if(path.endsWith('/classes'))data=[{id:'qa-class',academy_id:aid,name:'확인 반',sort_order:0}];
  else if(path.endsWith('/word_lists')){if(method==='POST'){const body=JSON.parse(init.body);const row={...body,id:crypto.randomUUID()};lists.push(row);data=single?row:[row];}else data=lists.filter(x=>!url.searchParams.has('id')||url.searchParams.get('id')==='eq.'+x.id);if(single&&Array.isArray(data))data=data[0]??{};}
  else if(path.endsWith('/curriculum_lessons')){if(method==='POST'){const row={...JSON.parse(init.body),id:crypto.randomUUID()};lessons.push(row);data=single?row:[row];}else data=lessons;}
  else if(path.endsWith('/video_clips'))data=clips;
  else if(path.endsWith('/rpc/my_deletion_request'))data=null;
  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
 };
};
const server=await createServer({define:{'import.meta.env.VITE_LEARNING_SENSORS_ENABLED':'"false"','import.meta.env.VITE_SUPABASE_URL':'"https://classroom-fixture.supabase.co"','import.meta.env.VITE_SUPABASE_ANON_KEY':'"test-only"'},plugins:[{name:'synthetic-classroom-fixture',transformIndexHtml(){return [{tag:'script',children:`(${bootstrap.toString()})(${JSON.stringify({ref,session,user,uid,aid})})`,injectTo:'head-prepend'}];}}],server:{host:'127.0.0.1',port:Number(process.env.CLASSROOM_QA_PORT||5272),strictPort:true}});
await server.listen();console.log('Synthetic classroom fixture: http://127.0.0.1:5272');
