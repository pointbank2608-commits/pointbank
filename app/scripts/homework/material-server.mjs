// Local browser QA: fixture teacher session and lists, real homework SQL in an ephemeral database.
import { createGuidedServer } from './guided-server.mjs';
import { readFileSync } from 'node:fs';
import { fixtureIds } from './block-fixture.mjs';
import { materialDatabase, wordCards, sentenceCards } from './material-fixture.mjs';
import { installMaterialProjects, curriculumFixture } from './material-project-fixture.mjs';

const port=Number(process.env.HOMEWORK_QA_PORT || 5497);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid fixture port');
const origin='http://127.0.0.1:'+port;
const {db,students}=await materialDatabase();
await installMaterialProjects(db);
const bank=await curriculumFixture(db);
const audioModule=process.env.HOMEWORK_AUDIO_QA==='1' ? await import('./material-audio-fixture.mjs') : null;
const handleAudio=audioModule && await audioModule.createAudioFixture(db,origin);
// Other application modules construct a client during import. Keep their base URL local too.
process.env.VITE_SUPABASE_URL = origin;
process.env.VITE_SUPABASE_ANON_KEY = 'isolated-homework-fixture';
process.env.VITE_LEARNING_SENSORS = 'false';
const {a,c}=fixtureIds;
const listVersion = new Date().toISOString();
const lists=[['word',wordCards],['sentence',sentenceCards]].map(([kind,cards])=>({
  id:crypto.randomUUID(),academy_id:a,class_id:c,name:'Family Road Trip',kind,
  items:cards.map(card=>({id:card.id,word:card.word,meaning:card.meaning,image_url:card.imageUrl,category:null})),
  created_at:listVersion,updated_at:listVersion,created_by:fixtureIds.owner,
}));
if (audioModule) lists.push({...lists[0],id:crypto.randomUUID(), name:'녹음 검수 · road', items:lists[0].items.slice(0,1)});
if (process.env.HOMEWORK_PICKER_QA==='1') {
  const card=sentenceCards[0];
  const block={schemaVersion:1,type:'study',completion:'confirm',method:'material:listen',groupKey:'qa-picker',
    materialName:lists[1].name,text:card.word,translation:card.meaning,imageUrl:'',audioUrl:'',videoUrl:'',
    start:0,end:30,question:'',stages:['model'],hiddenWords:[],repeats:1};
  const draft={id:crypto.randomUUID(),revision:0,template:false,title:'활동 추가 검수 · Family Road Trip',
    items:[{kind:'worksheet',title:'문장 보고 듣기',config:{block},content:{questions:[]}}]};
  await db.query('select hw_assign_draft($1,$2,$3,null,$4)',[c,JSON.stringify(draft),[students[0].id],crypto.randomUUID()]);
}
// Only the catalogue row is adapted. Words, dialogue, roles and timing come
// from the same checked-in episode and chapter teaching data as the application.
const catalogue=JSON.parse(readFileSync(new URL('../../src/data/animationEpisodes.json',import.meta.url),'utf8'));
const caillou=catalogue.find(source=>source.youtubeId==='DhKIqYVB_Ws');
const videoClips=[{id:crypto.randomUUID(),youtube_id:caillou.youtubeId,title:caillou.title,series:'Caillou',
  start_sec:caillou.episodes[0].start,end_sec:caillou.episodes[0].end,hidden:false,tags:[],words:[],pack:{},script:''}];
const signatures={
  hw_class_overview:['p_class_id'],hw_assignment_summary:['p_assignment_id'],hw_block_results:['p_assignment'],
  hw_publication:['p_assignment'],hw_edit_activities:['p_assignment','p_version','p_title','p_due','p_items','p_item_ids'],
  hw_reissue_publication:['p_source','p_draft','p_students','p_due','p_request'],
  hw_assign_short:['p_class','p_draft','p_students','p_due','p_request'],
  hw_assign_draft:['p_class','p_draft','p_students','p_due','p_request'],
  hw_assign_materials:['p_class','p_students','p_draft','p_due','p_request','p_project'],
  wm_plan_list:['p_class_id'],wm_plan_progress:['p_plan'],wm_plan_cards:['p_plan','p_from','p_to'],
  wm_plan_briefing:['p_plan'],wm_plan_steps:['p_plan'],wm_student_links:['p_token'],
  wm_open:['p_access'],wm_today_state:['p_access'],wm_collection:['p_access'],
  wm_ack:['p_access','p_session','p_q','p_client'],wm_hint:['p_access','p_session','p_q'],
  wm_answer:['p_access','p_session','p_q','p_response','p_client'],
  student_login_by_phone:['p_name','p_phone','p_device'],student_login_for_homework:['p_homework_code','p_name','p_phone','p_device'],
  student_logout:['p_token'],student_home:['p_token'],hw_open_personal:['p_access'],
  student_open_homework_target:['p_token','p_access'],student_open_homework:['p_token','p_code'],
  hw_state:['p_token'],hw_finish:['p_token'],hw_progress:['p_token','p_item_id','p_event','p_meta','p_client_id'],
  hw_submit:['p_token','p_item_id','p_q_index','p_response','p_client_id','p_ms'],
};
const client=`${audioModule?.syntheticAudioSetup || ''}export const supabase={${audioModule?.audioInvoke || ''}
channel(){return {on(){return this},subscribe(){return this},unsubscribe(){}}},removeChannel(){},
from(table){
  const q=new Proxy({}, {get(_,key) {
    if(key==='then')return (resolve,reject)=>{
      const result=Promise.resolve({data:table==='video_clips'?window.__guided.videoClips:[],error:null});
      return result.then(resolve,reject);
    };
    return ()=>q;
  }});
  return q;
},
rpc:async(name,args)=>(await fetch('/test-rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})})).json()
};`;
const server=await createGuidedServer(port,{
  client,academy:a,seed:{students,classes:[{id:c,name:'테스트 반',academy_id:a}],lists,lessons:[],videoClips,bank},
  async handle(req,res){
    if(req.url?.startsWith('/audio/') && handleAudio){await handleAudio(req,res);return;}
    if(req.method!=='POST'||req.headers['content-type']!=='application/json'||req.headers.origin!==origin){res.writeHead(403);res.end();return;}
    try{
      let body='';for await(const chunk of req){body+=chunk;if(body.length>1500000)throw Error('request too large');}
      const {name,args={}}=JSON.parse(body);
      const proc=name==='student_home_with_vocab_schedule'?'student_home':name;
      const keys=Object.hasOwn(signatures,proc)?signatures[proc]:null;
      let data=null;
      if(keys){
        const params=keys.map(k=>typeof args[k]==='object' && args[k]!==null && (!Array.isArray(args[k]) || k==='p_items')?JSON.stringify(args[k]):args[k]??null);
        const binds=keys.map((_,i)=>'$'+(i+1)).join(',');
        data=(await db.query('select '+proc+'('+binds+') as v',params)).rows[0].v;
      }else if(name==='hw_recording_originals'){
        data=(await db.query('select * from public.hw_recording_originals($1)',[args.p_assignment])).rows;
      }else if(name==='learning_homework_summary')data={plans:[],limit:200};
      else if(name==='academy_homework_usage')data={active_students:0};
      else if(name!=='my_deletion_request')data=[];
      res.end(JSON.stringify({data,error:null}));
    }catch(error){console.error(error.message);res.end(JSON.stringify({data:null,error:{message:error.message}}));}
  },
});
await server.listen();
console.log('Local homework QA at '+origin+'/homework'+(handleAudio?' (synthetic microphone)':''));
