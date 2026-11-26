import fs from 'node:fs';
import ts from 'typescript';
const root=new URL('../../../',import.meta.url);
const file=path=>new URL(path,root);
const read=path=>fs.readFileSync(file(path),'utf8');
const json=path=>JSON.parse(read(path));
const write=(path,data)=>fs.writeFileSync(file(path),JSON.stringify(data,null,2)+'\n');
async function sharedModule(name) {
 const js=ts.transpileModule(read('supabase/functions/_shared/'+name+'.ts'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
const {compileWorkshop,extensionPool}=await sharedModule('grammarWorkshop');
const {canMap}=await sharedModule('canMap');
const intentions=new Map(read('app/scripts/grammar/scene-intentions.txt').trim().split(/\r?\n/).map(line=>{
 const [id,...entries]=line.split('|');
 if(entries.length!==2)throw Error('Missing scene intentions: '+id);
 return [id,entries.map(entry=>entry.split('~'))];
}));
const rows=new Map(read('app/scripts/grammar/visual-scenes.txt').trim().split(/\r?\n/).map(line=>{
  const [id,...values]=line.split('|'); if(values.length!==7) throw Error(id); return [id,values];
}));
const folder='app/src/data/grammarSheets/bank/';
const glosses=new Map(read('app/scripts/grammar/chunk-meanings.txt').trim().split(/\r?\n/).map(line=>{
 const [id,...groups]=line.split('|');return [id,groups.map(group=>group.split('~'))];
}));
const sceneArt=new Map(read('app/scripts/grammar/scene-art.txt').trim().split(/\r?\n/).flatMap(line=>{
 const [name,ids]=line.split('|');
 const image='/word-bank-images/'+name+'.webp';
 if(!fs.existsSync(file('app/public'+image)))throw Error('Missing artwork '+image);
 return ids.split(' ').map(id=>[id,image]);
}));
const readings=new Map(read('app/scripts/grammar/reading-items.txt').trim().split(/\r?\n/).map(line=>{
 const [id,passage,question,answer,a,b,reason]=line.split('|');
 if(!reason||!passage||!question||new Set([answer,a,b]).size!==3)throw Error('Incomplete passage: '+id);
 const options=[a,b];const correct=id.length%3;options.splice(correct,0,answer);
 return [id,{prompt:passage+'\n'+question,options,correct,reason}];
}));
const misconceptions=new Map(read('app/scripts/grammar/scene-misconceptions.txt').trim().split(/\r?\n/).map(s=>s.split('|')));
const banks=new Map(fs.readdirSync(file(folder)).flatMap(f=>json(folder+f)).map(b=>[b.id,b]));
const points=json('app/src/data/grammarPoints.json');
const clean=s=>s.replaceAll('**','').trim();
const choice=c=>({prompt:c.p,options:c.c,correct:c.a,reason:c.why});
const imgNouns='map key pen pencil bird dog cap cat box cup pool apple peach bottle rice bag bread corn gate library bike clock house soup picture water helmet camera rain ticket tree drum guitar book park road window umbrella film train bus bell flag letter card desk ball school shoe table milk coin salt glasses swim swimming'.split(' ');
function panel(label,parts,ko) {
 const words=parts.toLowerCase().split(/[^a-z]+/);
 const art=imgNouns.find(w=>words.includes(w) && fs.existsSync(file('app/public/word-bank-images/'+w+'.webp')));
 return {label,chunks:parts.split('~'),meaning:ko,...(art?{image:'/word-bank-images/'+art+'.webp'}:{})};
}
// These are settings for the learner, not extra rules to memorize.
// Each assignment also contains a sentence and model specific to its topic.
function schoolSettings(id) {
 const settings=[
  [/^(this-is|it-is|these-those|a-an|plural|i-have|possessive|apostrophe-s|there-is|m-there-be|m-noun-count|countable-uncountable|h-article-noun|h-quantifiers|m-indefinite-pronouns)$/,
   ['교실에서 물건 찾기 놀이를 해요.','동아리 전시에서 관람객을 안내해요.','교환학생을 위해 전시실 영어 안내 음성을 녹음해요.']],
  [/(time-day|date-months|frequency|present-vs-progressive|tense-|past|future|sequence|used-to|when-if|m-prep-time|m-present-perfect|present-progressive)/,
   ['하루 그림 일기를 보며 짝에게 들려줘요.','친구가 여러 날의 일을 헷갈려 해서 음성 메시지를 남겨요.','학교 방송에서 기자가 사건이 언제 일어나는지 전해요.']],
  [/(superlative|compar|describe|adj-noun|m-adj-adv|too-enough|how-many|m-exclamation)/,
   ['친구가 그림을 보지 않고도 모습을 떠올리게 해요.','동아리 친구가 여러 후보의 차이를 알 수 있게 설명해요.','학교 신문 독자가 대상을 정확히 떠올리도록 비교해요.']],
  [/(can|modals|have-to|imperative|lets|m-if-conditional|as-long-as|so-that-purpose|subjunctive-demand)/,
   ['친구와 놀이를 시작하기 전에 대화를 나눠요.','동아리 활동 전에 친구와 가능한 일을 확인해요.','행사 준비팀이 진행 전에 행동과 조건을 확인해요.']],
  [/(question|whats-wrong|how-are-you|how-do-you|does-he|did-you|is-it|directions|relative-adverb)/,
   ['친구와 질문 카드를 주고받아요.','처음 만난 동아리 친구에게 궁금한 점을 확인해요.','학생 기자가 인터뷰에서 필요한 정보를 확인해요.']],
  [/(because|although|conj|h-negation|so$|and-but|sequence|correlative)/,
   ['그림 두 장을 이어 친구에게 이야기를 들려줘요.','친구가 오해하지 않도록 상황과 이유를 메시지에 담아요.','학생회가 두 내용의 관계를 분명하게 설명해요.']],
  [/(relative|participle|passive|reported|emphasis|inversion|ellipsis|agreement|parallelism|pronoun-reference)/,
   ['그림 속에서 누구에게 어떤 일이 생겼는지 들려줘요.','친구의 말을 듣고 학급 게시판에 정확하게 옮겨요.','학생 편집자가 독자에게 오해 없이 정보를 전달해요.']],
  [/(want|jobs|gerund|inf-|to-inf|m-it-to|h-noun-clause|i-think|h-wish|m-subjunctive)/,
   ['친구가 어떤 생각을 하는지 듣고 말풍선을 완성해요.','동아리 친구와 생각이나 계획을 나눠요.','교내 인터뷰에서 말한 사람의 뜻을 정확히 전달해요.']],
 ];
 const fallback=['친구에게 보여 줄 그림책에 말풍선을 넣어요.','학교 영어 방송의 짧은 대화를 준비해요.','학교 소식지에 실을 짧은 대화를 작성해요.'];
 return settings.find(([pattern])=>pattern.test(id))?.[1]??fallback;
}
function build(p,b,grade) {
 const [scene,en,ko,en2,ko2,why,because]=rows.get(p.id);
 const pair=[panel('장면 A',en,ko),panel('장면 B',en2,ko2)];
 const art=sceneArt.get(p.id)??pair.find(line=>line.image)?.image;
 for(const [i,line] of pair.entries()){
   const [intent,response]=intentions.get(p.id)[i];
   Object.assign(line,{label:intent,setting:scene,response,rationale:because});
   if(!line.image)line.image=art;
   line.glosses=glosses.get(p.id)?.[i];
   if(line.glosses?.length!==line.chunks.length)throw Error('Unmatched meaning chunks: '+p.id);
 }
 if(pair.some(line=>!line.image)||!readings.has(p.id))throw Error('Missing art or reading for '+p.id);
 const model=r=>({en:clean(r.en),ko:clean(r.ko)});
 const variants=schoolSettings(p.id).map((intro,i)=>{
   const r=b.b.review[[1,3,5][i]];
   return {opening:intro+' '+scene,task:intro+' 다음 뜻을 전하는 영어 문장을 직접 써 보세요.\n'+r.ko,model:r.model};
 });
 if(['i-can','can-i-may-i','m-modals','do-you-can-you'].includes(p.id)){
  const targets=p.id==='do-you-can-you'?[
   ['친구가 평소에 그림을 그리는지 물어보세요.','Do you draw pictures?'],
   ['축제 반주자가 필요해요. 친구가 피아노를 칠 줄 아는지 물어보세요.','Can you play the piano?'],
   ['방송반 지원자가 평소 녹음을 하는지, 혼자 영상을 편집할 줄 아는지 각각 물어보세요.','Do you record audio regularly? Can you edit videos on your own?']
  ]:[['친구가 색연필을 갖고 있어요. 파란색 하나를 빌려도 되는지 물어보세요.','Can I borrow your blue pencil?'],
   ['전시회에서 직원에게 내가 사진을 찍어도 되는지, 친구에게 우리 사진을 찍어 줄지 물어보세요.','Can I take photos here? Can you take a photo of us?'],
   ['학교 축제에서 진행자에게 공연을 촬영해도 되는지 묻고, 팀원에게 카메라를 맡아 달라고 부탁하세요.','Can I film the performance? Can you operate the camera?']];
  targets.forEach(([task,model],i)=>Object.assign(variants[i],{task,model}));
 }
 const misconception=misconceptions.get(p.id);
 if(!misconception)throw Error('Missing contrast: '+p.id);
 const source={scene,pair,why,because,misconception,reading:readings.get(p.id),map:p.usage?.length?p.usage:[ko,ko2],
  clue:choice(b.b.choose[0]),apply:choice(b.b.choose[3]),elementary:variants[0],middle:variants[1],high:variants[2],
  models:b.b.build.map(model).concat(b.buildExtra?.map(model)??[]),
  choices:[...b.choose,...b.b.choose.filter((_,i)=>i!==0&&i!==3)].map(choice),
  repairs:[...b.correct,...b.b.correct].map(r=>({wrong:r.w,right:r.r,reason:r.why}))};
 source.map=pair.map(line=>line.label+': '+line.meaning);
 source.mapScenes=pair;
 if(p.id==='this-is'){
   source.map.push('사람 소개하기: 이쪽은 내 친구야.');
   source.mapScenes=[...pair,{label:'지우 → 동아리 친구들',setting:'민서가 지우 옆에 서 있어요. 지우가 처음 만난 친구들에게 민서를 소개해요.',
     chunks:['This','is','my friend.'],glosses:['이쪽은','~이야','내 친구'],meaning:'이쪽은 내 친구야.',image:'/word-bank-images/friend.webp',
     response:'친구들이 민서를 보며 반갑다고 인사해요.',rationale:'this가 가리키는 것은 옆에 서 있는 민서예요. 사람을 소개할 때에는 “이것”보다 “이쪽은”이나 “이분은”이 자연스러워요.'}];
 }
 // Stage five rehearses the communicative goal. A secondary feature such as
 // the article in “That is a desk” must not become the target of this task.
 const target=b.b.review[0];
 const contrast=b.b.review.find((r,i)=>i>0 && ![1,3,5].includes(i) && r.ko!==target.ko && r.model!==target.model);
 if(contrast && p.id!=='do-you-can-you'){
   const options=[target.model,contrast.model];
   const correct=p.id.length%2;
   if(correct)options.reverse();
   source.apply={prompt:'“'+target.ko+'”\n이 말을 영어로 전하려고 해요. 어떤 문장을 쓸까요?',
     options,correct,reason:target.model+' → '+target.ko+' 다른 문장인 '+contrast.model+'의 뜻은 “'+contrast.ko+'”예요.'};
 }
 // Find the clue in a scene before choosing an isolated form. The bank supplies
 // fresh follow-on exercises; the explanation compares this topic's actual lines.
 source.clue={prompt:scene+'\n'+en.replaceAll('~',' ')+'\n'+en2.replaceAll('~',' ')+'\n'+why,
   options:[because,misconception],correct:0,reason:because};
 if(p.id.length%2){source.clue.options.reverse();source.clue.correct=1;}
 if(['i-can','can-i-may-i','m-modals','do-you-can-you'].includes(p.id)){
   source.clue={prompt:'두 사람이 모두 “Can you open this door?”라고 물어요. 한 사람은 학생의 손목 움직임을 확인하는 치료사이고, 다른 사람은 상자를 든 친구예요. “응, 열 수 있어”라고만 하고 지나가면 누가 여전히 곤란할까요?',
     options:['치료사','상자를 든 친구'],correct:1,reason:'친구의 두 손은 이미 꽉 차 있어요. 친구가 기다린 건 문을 열 수 있다는 말보다 실제로 문을 열어 주는 행동이에요.'};
   const atlas=canMap({label:'지우 → 민서',setting:'수영을 마친 지우의 두 손이 젖었어요. 수건은 민서 옆에 있어요.',chunks:['Can','you','pass my towel?'],glosses:['해 줄 수 있을까','네가','내 수건을 건네다'],meaning:'내 수건 좀 건네줄래?',image:'/word-bank-images/pool.webp',response:'민서가 수건을 건네요.',rationale:'지우는 민서의 실력을 조사하지 않아요. 지금 필요한 수건을 받아야 하니 행동을 부탁해요.'});
   const extra=atlas.mapScenes.map((panel,i)=>({panel,entry:atlas.map[i]}))
    .filter(({panel})=>!pair.some(line=>line.chunks.join(' ')===panel.chunks.join(' ')));
   source.map.push(...extra.map(item=>item.entry));
   source.mapScenes=[...pair,...extra.map(item=>item.panel)];
 }
 const otherExamples=(p.examples??[]).flatMap((example,i)=>p.translations?.[i]?
   [clean(example)+'  →  '+clean(p.translations[i])]:[]);
 const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const seen=new Set([...(p.examples??[]),...pair.map(line=>line.chunks.join(' ')),...source.apply.options].map(normalize));
 for(const variant of variants){
   if(seen.has(normalize(variant.model))){
     const fresh=b.b.review.find(item=>!seen.has(normalize(item.model))&&!variants.some(v=>v.model===item.model));
     if(!fresh)throw Error('No unseen transfer for '+p.id);
     variant.task=variant.task.split('\n')[0]+'\n'+fresh.ko;
     variant.model=fresh.model;
   }
   seen.add(normalize(variant.model));
 }
 const lesson=compileWorkshop(source,grade);
 lesson.steps[0].practice.title=p.id==='i-can'?'수영장에서 만나는 can':
   p.id==='this-is'?'교실에서 만나는 This is와 That is':p.goal || '지우와 민서의 수영 이야기';
 if(otherExamples.length)lesson.steps[0].practice.why.push(['이 밖에 어디에서 이 표현을 만날까요?', [...(p.usage??[]),...otherExamples].join('\n')]);
 if(source.clue.prompt.includes('손목 움직임')) Object.assign(lesson.steps[3].practice,{panels:[],image:'/grammar-scenes/open-door.jpg',imageDescription:'왼쪽은 손목이 회복됐는지 확인하는 치료사, 오른쪽은 양손에 짐을 든 친구가 문 앞에 서 있는 모습.'});
 for(let g=1;g<=12;g++) if(extensionPool({...lesson.workshop,grade:g}).length<15) throw Error('Insufficient exercises: '+p.id);
 return lesson;
}
for(const p of points) {
 const g=Number(p.grade.match(/\d+/)?.[0])||1;
 const grade=p.grade.startsWith('초')?g:p.grade.startsWith('고')?9+g:p.grade.startsWith('중')?6+g:7;
 Object.assign(p,build(p,banks.get(p.id),Math.min(12,grade)));
}
write('app/src/data/grammarPoints.json',points);
const specialBank=structuredClone(banks.get('i-can'));
specialBank.b.choose[0]={p:'친구가 일주일에 몇 번이나 수영장에 가는지 조사해요. ____ you swim every week?',c:['Do','Are'],a:0,why:'매주 하는 일인지 묻는 질문은 Do you swim every week?예요.'};
specialBank.b.choose[3]={p:'기타 반주를 할 줄 아는 사람을 찾아요. 어떤 질문이 알맞을까요?',c:['Do you listen to music every day?','Can you play the guitar?'],a:1,why:'알고 싶은 것은 음악 듣는 습관이 아니라 연주 능력이에요.'};
specialBank.b.build=[
 ['Do you cook on Fridays?','금요일마다 요리하니?'],['Can you bake bread?','빵을 구울 줄 아니?'],
 ['Do you ride to school?','평소 자전거로 등교하니?'],['Can you ride without help?','혼자서 탈 줄 아니?'],
 ['Do you read before bed?','자기 전에 책을 읽니?'],['Can you read this sign?','이 표지판을 읽을 수 있니?'],
 ['Do you play chess at lunch?','점심시간에 체스를 두니?'],['Can you teach me chess?','나에게 체스를 가르쳐 줄래?'],
 ['Do you draw every day?','매일 그림을 그리니?'],['Can you draw faces?','얼굴을 그릴 줄 아니?']
].map(([en,ko])=>({en,ko}));
specialBank.buildExtra=[];
specialBank.choose=specialBank.b.build.map(({en,ko},i)=>({
 p:ko+'\n____ '+en.slice(en.indexOf(' ')+1),c:['Do','Can'],a:i%2,
 why:i%2?'상대가 '+(i===7?'지금 가르쳐 줄지 부탁하는 말이에요.':'그 행동을 할 수 있는지 궁금해요.'):'알고 싶은 것은 평소 실제로 하는 일이에요.'
}));
specialBank.correct=[
 ['Does you play chess?','Do you play chess?','you와 함께 평소 일을 물으면 Do로 시작해요.'],
 ['Can you to dance?','Can you dance?','can 뒤에는 to 없이 동사의 기본 모양을 써요.'],
 ['Do you reads every night?','Do you read every night?','Do가 앞에 있으므로 뒤에는 read를 써요.'],
 ['Can you are swim?','Can you swim?','swim이 이미 행동을 말하므로 are를 더 붙이지 않아요.'],
 ['Do can you draw?','Can you draw?','그릴 능력을 물을 때 Can이 질문을 시작해요.']
].map(([w,r,why])=>({w,r,why}));
specialBank.b.correct=[];
const special=build({id:'do-you-can-you',usage:['평소 생활: Do you swim?','능력: Can you swim?','부탁: Can you help me?']},specialBank,7);
write('app/src/data/doYouCanYouWorkshop.json',special);
if(rows.size!==points.length+1) throw Error('Catalog and scene source differ');
console.log('Built '+rows.size+' illustrated grammar lessons');
