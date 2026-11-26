import { compileWorkshop, schoolOf, type DrillChoice, type DrillModel, type SceneLine, type WorkshopSource } from '../_shared/grammarWorkshop.ts';

// Keep the action constant so the learner can see what changing its place does.
const actions=[
  ['write a book','책 쓰기','책 쓰는 건 재미있어.','나는 책을 쓰고 싶어.','내 꿈은 책을 쓰는 거야.','book'],
  ['draw pictures','그림 그리기','그림 그리는 건 재미있어.','나는 그림을 그리고 싶어.','내 꿈은 그림을 그리는 거야.','pen'],
  ['play the guitar','기타 치기','기타 치는 건 재미있어.','나는 기타를 치고 싶어.','내 꿈은 기타를 치는 거야.','guitar'],
  ['play soccer','축구하기','축구하는 건 재미있어.','나는 축구를 하고 싶어.','내 꿈은 축구를 하는 거야.','ball'],
  ['help others','다른 사람 돕기','다른 사람을 돕는 건 재미있어.','나는 다른 사람을 돕고 싶어.','내 꿈은 다른 사람을 돕는 거야.','school'],
] as const;
const choice=(prompt:string,options:string[],correct:number,reason:string):DrillChoice=>({prompt,options,correct,reason});
const models=[
  ['To sing is fun.','노래하는 것은 재미있다.'],['I want to dance.','나는 춤추고 싶다.'],
  ['My plan is to cook dinner.','내 계획은 저녁을 요리하는 것이다.'],['We decided to walk home.','우리는 집까지 걸어가기로 했다.'],
  ['Her goal is to finish the race.','그녀의 목표는 경주를 끝내는 것이다.'],['To read takes time.','읽는 데에는 시간이 걸린다.'],
  ['I hope to see the sea.','나는 바다를 보기를 바란다.'],['They plan to visit a farm.','그들은 농장을 방문할 계획이다.'],
  ['To learn a song is exciting.','노래 한 곡을 배우는 것은 신난다.'],['My wish is to meet the writer.','내 소원은 그 작가를 만나는 것이다.'],
].map(([en,ko])=>({en,ko}));
const choices=[
  choice('To draw is fun. 이 문장에서 무엇이 재미있다는 뜻일까요?',['그림 그리는 것','재미를 느끼는 사람'],0,'To draw는 그림을 그리는 일이에요. 그 일이 재미있다고 말해요.'),
  choice('Mina wants to read. 민서가 원하는 일을 나타내는 부분은?',['Mina','to read'],1,'wants 다음의 to read가 “무엇을 원해?”에 답해요.'),
  choice('My plan is to swim. 수영하는 것은 누구의 어떤 내용을 알려 줄까요?',['내 계획이 무엇인지','내가 지금 어디 있는지'],0,'My plan is 뒤에 계획을 풀어 주는 말이 나와요.'),
  choice('어제 우리는 걸어가기로 마음을 정했어요. Yesterday we ____ to walk home.',['want','decided','hope'],1,'어제(yesterday) 마음을 정한 일을 말해요. decide의 과거형 decided를 써요.'),
  choice('“나는 노래하고 싶어.” 하고 원하는 행동을 말해요. I want ____ sing.',['to','at','by'],0,'want 뒤에 원하는 행동을 붙일 때 to sing이라고 해요.'),
  choice('To read books takes time. 시간이 걸리는 일을 통째로 고르세요.',['time','takes time','To read books'],2,'무엇이 시간이 걸릴까요? 책을 읽는 일 전체예요.'),
  choice('Her goal is to run a race. to run a race는 무엇을 설명해 주나요?',['Her goal','달리는 장소'],0,'is의 양옆을 이어 읽으면 “그녀의 목표 = 경주에 나가는 것”이에요.'),
  choice('I hope to see you. 희망하는 내용은 어느 쪽일까요?',['희망을 가진 나','너를 만나는 일'],1,'hope 뒤의 to see you가 바라는 일이에요.'),
  choice('They went to school. 여기서 to 다음에는 장소 school이 있어요. 이 to의 뜻은?',['~하는 것','~로'],1,'school은 행동 이름이 아니라 장소예요. 여기서는 학교로 갔다고 말해요.'),
  choice('다음 중 ‘돕는 것’ 자체가 문장의 주인공인 문장은?',['To help is important.','I want to help.'],0,'첫 문장은 무엇이 중요한지 말해요. 둘째 문장은 내가 어떤 일을 원하는지 말해요.'),
];
const repairs=[
  ['I want to reads.','I want to read.','to 다음 행동은 기본 모양 read예요.'],
  ['My goal is to winning.','My goal is to win.','목표의 내용을 말할 때 to 다음에는 win을 써요.'],
  ['We decided visit the park.','We decided to visit the park.','결정한 행동은 decided 뒤에 to visit으로 붙여요.'],
  ['To singing is fun.','To sing is fun.','노래하는 일을 to로 시작하려면 sing의 기본 모양을 써요.'],
  ['They hope to went home.','They hope to go home.','바라는 행동을 붙이는 to 뒤에서는 went 대신 go를 써요.'],
].map(([wrong,right,reason])=>({wrong,right,reason}));

export function photoInfinitiveLesson(printed:DrillModel[],grade:number,count:number) {
  const action=actions.find(([en])=>printed.some(row=>row.en.toLowerCase().includes('to '+en)))??actions[0];
  const [verb,activity,subjectKo,wantKo,dreamKo,art]=action;
  const scene='지우와 민서가 동아리 소개 카드를 써요. 카드에 적을 활동은 ‘'+activity+'’예요.';
  const picture='/word-bank-images/'+art+'.webp';
  const why='똑같은 행동인데 왜 이름이 주어·목적어·보어로 달라요?';
  const because='I want 뒤에서는 “무엇을 원해?”에 답하니 목적어예요. My dream is 뒤에서는 “내 꿈이 뭐야?”에 답해요. 꿈의 내용을 채워 주니 보어예요. 같은 행동을 말해도 어떤 질문의 답인지 보면 구별할 수 있어요.';
  function panel(label:string,setting:string,chunks:string[],glosses:string[],meaning:string,response:string,rationale:string):SceneLine {
    return {label,setting,chunks,glosses,meaning,response,rationale,image:picture};
  }
  const subject=panel('지우 · 활동 소개','지우는 어떤 일이 재미있는지 소개해요.',
    ['To '+verb,'is','fun.'],[activity,'~이다','재미있는'],subjectKo,'민서는 어떤 일이 재미있는지 알게 돼요.',
    '“무엇이 재미있어?”라고 물어보세요. to부터 행동을 끝까지 묶은 말이 답이에요. 이 자리를 주어라고 불러요.');
  const object=panel('지우 · 하고 싶은 일','지우에게 동아리에서 무엇을 하고 싶은지 물어요.',
    ['I','want','to '+verb+'.'],['나는','원해',activity],wantKo,'민서는 지우가 하고 싶은 일을 알게 돼요.',
    'I want까지만 들으면 “무엇을 원해?”가 남아요. 뒤의 to 덩어리가 그 답이에요. 원하는 대상을 알려 주니 목적어예요.');
  const complement=panel('민서 · 내 꿈 소개','민서는 자기 꿈이 무엇인지 소개해요.',
    ['My dream','is','to '+verb+'.'],['내 꿈은','~이다',activity],dreamKo,'지우는 민서의 꿈이 무엇인지 알게 돼요.',
    'My dream is 뒤에 꿈의 내용을 붙여요. “내 꿈 = 이 활동”처럼 양쪽이 같은 내용을 가리켜요. 이렇게 설명을 채워 주는 말을 보어라고 해요.');
  const source:WorkshopSource={scene,why,because,pair:[object,complement],
    map:['주어: 무엇이 재미있나요?','목적어: 무엇을 원하나요?','보어: 꿈의 내용은 무엇인가요?'],mapScenes:[subject,object,complement],
    misconception:'두 문장 모두 to가 뒤에 있으므로 둘 다 원하는 대상만 말해요.',
    clue:choices[2],apply:choice('발표할 때 “나는 노래하고 싶어.”라고 말하려고 해요. 내 바람을 담은 문장은?',
      ['I want to sing.','To sing is fun.'],0,'하고 싶다는 단서에 want가 어울려요. 두 번째 문장은 노래하는 일이 재미있다고 소개해요.'),
    reading:choice('Mina likes music. Her goal is to play the drums. What is her goal?',
      ['To play the drums.','To teach art.','To buy a violin.'],0,'Her goal is 다음 말이 목표의 내용을 그대로 알려 줘요.'),
    elementary:{opening:'친구와 쉬는 날 하고 싶은 일을 나눠요.',task:'친구에게 “나는 쿠키를 만들고 싶어.”라고 영어로 말해 보세요.',model:'I want to make cookies.'},
    middle:{opening:'동아리에서 이번 학기 목표를 소개해요.',task:'동아리에서 하고 싶은 일은 사진 찍기예요. 하고 싶은 일과 내 목표를 각각 한 문장씩 영어로 소개하세요.',model:'I want to take photos. My goal is to take photos.'},
    high:{opening:'학교 방송부가 활동 지원자에게 목표를 물어요.',task:'학교 방송부에서 학생들을 인터뷰하고 싶어요. 원하는 일과 목표를 같은 행동으로 연결해 영어 두 문장을 쓰세요.',model:'I want to interview students. My goal is to interview students.'},
    models,choices:choices.map(q=>({...q,options:[...q.options]})),repairs};
  const result=compileWorkshop(source,grade,count);
  const examples=printed.length?printed:[subject,object,complement].map(p=>({en:p.chunks.join(' '),ko:p.meaning}));
  return {name:'to부정사의 명사적 용법 · 주어·목적어·보어',audience:schoolOf(grade),pattern:'to + 동사원형',
    goal:'‘~하는 것’이 문장에서 어떤 일을 하는지 구별하고, 하고 싶은 일과 내 목표를 영어로 말할 수 있어요.',
    explain:'동사 앞에 to를 붙이면 행동을 하나의 일처럼 말할 수 있어요. to '+verb+'는 ‘'+activity+'’라는 한 덩어리예요.',
    rule:[because],usage:source.map,detail:[scene,because],tip:object.rationale,
    examples:examples.map(x=>x.en),translations:examples.map(x=>x.ko),
    pitfalls:repairs.map(r=>({wrong:r.wrong,right:r.right,why:r.reason})),...result};
}
