// The worksheet bank also contains prompts designed for a teacher to contextualize.
// Only reuse independent clozes with an identified cue. Otherwise use the topic's
// bilingual examples to put the intended meaning in front of the learner.
const formTopics=new Set((
  'this-is a-an plural third-s prepositions frequency past-regular past-irregular object-pronouns adj-noun date-months '+
  'm-pronoun-case m-be-verb m-general-verb m-relative-whose m-past-progressive '+
  'm-to-inf-noun m-comparative-emphasis tense-past h-prep-relative m-perception m-gerund-vs-inf '+
  'tense-present tense-present-perfect-progressive tense-past-perfect tense-future-perfect tense-future-perfect-progressive'
).split(' '));
const verbShape=/\b(?:can|should|must|will|did not|didn’t|didn't|doesn't|don't) ____/i;
const closedClasses=[
  /^(?:a|an)$/, /^(?:am|is|are)$/, /^(?:has|have)$/, /^(?:was|were)$/,
  /^(?:for|since)$/, /^(?:much|many)$/, /^(?:do|does)$/,
];
const intentions={
  and:'두 내용을 나란히 보태어 말해요.',but:'앞말과 뒤의 차이가 드러나게 말해요.',
  so:'앞의 일 때문에 뒤의 일이 생겼다고 말해요.',because:'뒤에 이유를 붙여 설명해요.',
  or:'두 가지 중 하나를 고르게 해요.',when:'그 일이 실제로 일어난 때를 알려 줘요.',
  if:'그 일이 일어날 경우를 가정해요.',although:'예상과 달리 뒤의 일이 일어났다는 뜻이에요.',
};
const explicit=new Map([
 ['____ you jump?', ['수영 코치가 점프할 줄 아는지 확인해요. 평소에 자주 뛰는지는 묻지 않아요.']],
 ['Can you tell me how I ____ get there?', ['길을 몰라요. 거기까지 갈 수 있는 방법을 묻고 싶어요.']],
 ['Can you tell me when the train ____?', ['강조하는 말 없이 기차 시간표를 그대로 물어요.']],
 ['I ____ to eat ice cream.', ['지금 아이스크림을 먹고 싶다는 뜻이에요.']],
 ['My brother is a baby. He ____ walk.', ['동생은 아직 첫걸음을 떼기 전이에요.']],
 ['They ____ make a snowman. There is a lot of snow.', ['아이들이 눈 뭉치는 법을 배워 이제 스스로 눈사람을 만들 수 있어요.']],
 ['She ____ sing well. She has a beautiful voice.', ['친구가 노래를 잘 부를 수 있다고 소개해요.']],
 ['I have no pen. I ____ write my name.', ['종이에 서명해야 하는데 쓸 도구가 전혀 없어서 서명을 못 해요.']],
]);
// Some alternatives are grammatical in other contexts. Put the writer's
// specific intention in the task before retaining those alternatives.
function contextFor(id,q) {
  const answer=q.options[q.correct].toLowerCase();
  if(id==='wh-questions' && !/[가-힣]/.test(q.prompt)){
    return ({where:'찾고 있는 물건이 어느 장소에 있는지 물어요.',who:'눈앞에 있는 사람이 누구인지 물어요.',what:'상대에게 이름을 알려 달라고 해요.'})[answer];
  }
  if(id==='weather')return ({
    sunny:'햇빛이 환하고 하늘에 구름이 한 점도 없어요.',cloudy:'하늘이 회색 구름으로 뒤덮였어요.',
    windy:'바람이 세게 불어서 깃발이 펄럭여요.',snowing:'지금 하늘에서 하얀 눈송이가 떨어져요.',
    hot:'밖은 35도예요. 더위를 말해 보세요.',cold:'기온이 영하로 떨어졌어요.',
    raining:'창문에 빗방울이 떨어지고 있어요.',warm:'봄볕에 공기가 포근해요.',
  })[answer];
  if((id==='how-are-you' || id==='i-am') && !/[가-힣]/.test(q.prompt))return ({
    sleepy:'잠이 쏟아져서 자꾸 눈이 감겨요.',tired:'오래 걸어 몸에 힘이 없어요.',happy:'좋은 소식에 기분이 무척 좋아요.',
    thirsty:'목이 말라 물을 찾고 있어요.',hungry:'아침을 걸렀더니 배에서 꼬르륵 소리가 나요.',
    full:'이미 배가 꽉 차서 더 먹거나 마시기 어려워요.',sad:'소중한 것을 잃어 마음이 슬퍼요.',
    hot:'땀이 날 만큼 더워요.',cold:'추워서 몸이 떨려요.',
  })[answer];
  if(id==='m-indirect-question' && q.prompt==='Can you tell me when the train ____?')
    return '기차의 정기 출발 시각을 묻습니다. 특별한 강조 없이 시간표대로 표현하세요.';
  if(id==='m-reported-speech') return '시간이 한참 지난 뒤, 다른 장소에서 그때의 말을 전해요. 시점과 장소를 옮겨 빈칸을 채우세요.';
  if(id==='h-subjunctive-demand') return '사실을 보고하는 글이 아니라, 상대에게 어떤 행동을 하라고 요구하는 공식 문서예요. that절은 동사원형을 쓰는 방식으로 완성하세요.';
  if(id==='h-emotion-participle'){
    if(answer.endsWith('ed')) return '주어나 등장인물이 어떤 기분을 느꼈는지 표현하세요.';
    if(answer.endsWith('ing')) return '어떤 일이나 대상이 사람에게 그런 기분을 일으킨다고 설명하세요.';
  }
  if(id==='m-have-to'){
    if(answer==='must not')return '안내판에 이 행동이 금지되어 있다고 적혀 있어요.';
    if(answer.includes("n't have to"))return '해도 괜찮지만 꼭 해야 하는 일은 아니라고 말해요.';
    if(answer==='had to')return '지난 일기에 그때 꼭 해야 했던 일을 적었어요.';
    return '지금 따라야 하는 규칙이나 피할 수 없는 일정에 관해 말해요.';
  }
  if(id==='m-present-vs-progressive' && !['know','want','has','like'].includes(answer)){
    return /\b(?:am|is|are)\b/.test(answer)?'현장 중계 중이에요. 바로 이 순간 진행 중인 일을 말하세요.':'관찰 기록을 요약해요. 평소 반복되는 일이나 일반적인 사실을 말하세요.';
  }
  if(id==='h-wish-as-if'){
    if(answer.startsWith('had ') || /gone to the concert|seen a ghost/.test(q.prompt))
      return '이미 지나간 일이 실제와 달랐다면 어땠을지 상상해요. 말하는 때보다 앞선 일을 나타내세요.';
    if(answer==='were' || answer==='could' || answer==='knew')
      return '지금 사실과 다른 상황을 상상해요. 실제 일을 그대로 전하는 말과 구별하세요.';
  }
  if(id==='m-indirect-question' && /did |does |is | are/.test(q.options.join(' ')))
    return '문장 안에 궁금한 내용을 넣어요. 되묻거나 특별히 강조하지 않고 보통 어순으로 물어보세요.';
  if(id==='m-to-inf-noun' && q.options.some(o=>/ing\b/.test(o))) {
    if(/need ____/.test(q.prompt))return '주어가 직접 다음 행동을 할 필요가 있다는 뜻으로 말해요.';
  }
}
const custom={
  'm-to-inf-noun': {prompt:'어제 도서관에서 만화책과 소설 중 무엇을 읽을지 정했어요. 그때 내린 결정을 일기에 적으세요.\nYesterday, I ____ to read a novel.',options:['want','decided','hope','plan'],correct:1,
    reason:'Yesterday는 어제이고, 무엇을 읽을지 이미 정했어요. decide(결정하다)의 과거형 decided 뒤에 to read가 와요. want는 지금 읽고 싶다는 말이에요.'},
  'm-indirect-question': {prompt:'지우가 집으로 가는 길을 물어요. “내가 어떻게 갈 수 있는지”를 한 문장 안에 넣으세요.\nCan you tell me how ____ get home?',options:['I can','can I','do I'],correct:0,
    reason:'큰 질문은 Can you tell me로 이미 시작했어요. 그 안에서 방법을 물을 때는 how 다음에 행동할 사람 I를 놓고 can을 이어 써요.'},
};
const norm=s=>s.normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]+/g,' ').trim();
const words=s=>new Set(norm(s).split(' '));
const difference=(a,b)=>[...a].filter(x=>!b.has(x)).length;
function contrast(target,models) {
  const en=words(target.en), ko=words(target.ko);
  return models.map(other=>{
    const e=words(other.en), k=words(other.ko);
    if (!difference(en,e) || !difference(e,en) || !difference(ko,k) || !difference(k,ko)) return {score:-1,other};
    // Prefer another example of the structure, with distinct information to tell them apart.
    const common=[...en].filter(w=>e.has(w)).length;
    return {score:common/Math.max(en.size,e.size),other};
  }).filter(row=>row.score>=0).sort((a,b)=>b.score-a.score)[0]?.other;
}
function exercise(target,other,index) {
  const a=target.en.split(/\s+/), b=other.en.split(/\s+/);
  let first=0,last=0;
  while(first<Math.min(a.length,b.length)-1 && a[first]===b[first])first++;
  while(last<Math.min(a.length,b.length)-first-1 && a.at(-last-1)===b.at(-last-1))last++;
  const gap=first+last>0;
  const stem=[...a.slice(0,first),'____',...a.slice(a.length-last)].join(' ');
  const answer=a.slice(first,a.length-last).join(' '), foil=b.slice(first,b.length-last).join(' ');
  const correct=index%2;
  return {prompt:gap?'“'+target.ko+'”라는 뜻으로 완성하세요.\n'+stem:'다음 뜻을 그대로 전할 문장을 고르세요.\n“'+target.ko+'”',
    options:correct?[foil,answer]:[answer,foil],correct,
    reason:target.en+'는 “'+target.ko+'”라는 뜻이에요. '+other.en+'는 “'+other.ko+'”라는 다른 내용을 전해요.'};
}
export function groundCatalogChoices(id,source,bank,choiceVersion) {
  const models=[...source.models,...[...bank.review,...bank.b.review].map(r=>({en:r.model,ko:r.ko})),
    ...source.pair.map(line=>({en:line.chunks.join(' '),ko:line.meaning}))];
  const used=new Set();
  source.choices=source.choices.map((q,i)=>{
    const old=q.prompt, key=q.options[q.correct];
    let next;
    if(i===0 && custom[id]) next=custom[id];
    else if(explicit.has(old)) next={...q,prompt:explicit.get(old)[0]+'\n'+old};
    else if(['and-but','m-conj-coordinating','pos-conjunction','because','so','m-because-although','m-conj-when-if-that'].includes(id) && intentions[key.toLowerCase()])
      next={...q,prompt:intentions[key.toLowerCase()]+'\n'+old};
    else if(new Set(q.options.map(norm)).size===q.options.length && contextFor(id,q)) next={...q,prompt:contextFor(id,q)+'\n'+old};
    else if(formTopics.has(id) || closedClasses.some(re=>q.options.every(o=>re.test(o.toLowerCase()))) ||
      (verbShape.test(old) && q.options.every(o=>o.toLowerCase().startsWith(key.toLowerCase().slice(0,3)))) ||
      (id==='do-you-can-you' && i<10)) next=q;
    else {
      for(let offset=0;offset<models.length*2;offset++){
        const target=models[(i+offset)%models.length], alternatives=models.filter(m=>m.en!==target.en);
        const preferred=contrast(target,alternatives);
        const other=offset<models.length?preferred:contrast(target,alternatives.filter(m=>m.en!==preferred?.en));
        if(!other) continue;
        const candidate=exercise(target,other,i);
        if(used.has(candidate.prompt)) continue;
        used.add(candidate.prompt);
        next=candidate;
        break;
      }
    }
    if(!next)throw Error('Missing self-contained exercise: '+id+' '+i);
    return next.prompt===old?next:{...next,previousPrompt:old,previousVersion:choiceVersion(q)};
  });
}
