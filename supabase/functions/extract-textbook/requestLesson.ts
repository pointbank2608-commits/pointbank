import { compileWorkshop, schoolOf, type DrillChoice, type WorkshopSource } from '../_shared/grammarWorkshop.ts';

// A request can be mistaken for an ability question even when every word has been translated.
// Keep the contrast and the response sequence intact when a photo teaches this particular goal.
const actions = [
  {match:/fix my bike/i, verb:'fix', verbKo:'고치다', object:'my bike', objectKo:'내 자전거', sentenceKo:'내 자전거 좀 고쳐 줄래?', place:'자전거 체인이 빠졌어요.', picture:'bike'},
  {match:/close the door/i, verb:'close', verbKo:'닫다', object:'the door', objectKo:'그 문', sentenceKo:'문 좀 닫아 줄래?', place:'복도 소리가 교실로 들어와요.', picture:'door'},
  {match:/carry this box/i, verb:'carry', verbKo:'나르다', object:'this box', objectKo:'이 상자', sentenceKo:'이 상자 좀 날라 줄래?', place:'상자가 무거워 혼자 들기 힘들어요.', picture:'box'},
] as const;
const makeChoice=(prompt:string,options:string[],correct:number,reason:string):DrillChoice=>({prompt,options,correct,reason});
const models = [
  ['Can you open the window?', '창문 좀 열어 줄래?'], ['Can you close the door?', '문 좀 닫아 줄래?'],
  ['Can you carry my bag?', '내 가방 좀 들어 줄래?'], ['Can you help me?', '나 좀 도와줄래?'],
  ["I'm sorry, but I can't.", '미안하지만 도와줄 수 없어.'], ['Sure. I can help.', '물론이지. 내가 도와줄게.'],
  ["I'm busy now.", '나 지금 바빠.'], ['Can you pass the ball?', '공 좀 건네줄래?'],
  ['Can you please wait here?', '여기서 좀 기다려 줄래?'], ['Can you move this chair?', '이 의자 좀 옮겨 줄래?'],
].map(([en,ko])=>({en,ko}));
const choices = [
  makeChoice('지우가 상자를 혼자 들기 힘들어 옆 친구를 봐요. 지금 지우가 원하는 것은?', ['친구의 평소 습관을 알기','지금 함께 들어 주기'],1,'무거운 상자가 바로 앞에 있어요. 지금 도움이 필요한 장면이에요.'),
  makeChoice('친구가 Can you help me? 하고 물었어요. 함께할 시간이 있어요. 어떻게 답할까요?', ['Sure.','Sorry, I can’t.'],0,'함께할 수 있으니 Sure(물론이지)로 부탁을 받아 줘요.'),
  makeChoice('민서는 지금 수업에 들어가야 해서 도울 수 없어요. 알맞은 대답은?', ["Sure. No problem.","I'm sorry, but I can't. I have a class now."],1,'수업에 들어가야 한다는 사정이 두 번째 문장에 담겼어요.'),
  makeChoice('Can you ___ the window? 에서 창문을 열어 달라고 하려면?', ['opens','open','opening'],1,'can이 있는 질문에서 행동을 나타내는 말은 기본 모양인 open이에요.'),
  makeChoice('창문이 닫힌 교실에서 “Can I open the window?”라고 말했어요. 창문을 열 사람은?', ['말하는 나','듣는 친구'],0,'I는 나예요. 내가 열어도 되는지 친구에게 물어요.'),
  makeChoice('친구에게 평소에 걸어서 등교하는지 물어요. 어떤 말이 어울릴까요?', ['Can you help me walk?','Do you walk to school?'],1,'평소에 실제로 하는 일을 묻고 있어요. Do you로 시작해요.'),
  makeChoice('Can you swim? 수영 반을 정하기 전에 코치가 물어요. 무엇이 궁금할까요?', ['수영할 줄 아는지','지금 문을 열어 줄지'],0,'반을 정하려면 학생이 무엇을 할 줄 아는지 알아야 해요.'),
  makeChoice('Can you pass the ball?이라고 부탁받았어요. “물론이지”를 고르면?', ['Of course.','Not now.'],0,'Of course는 도와주겠다는 대답이에요. Not now는 지금은 어렵다는 말이에요.'),
  makeChoice('거절한 뒤 “왜 지금 어려운지” 말하는 부분은?', ["I'm sorry.","I have a class now."],1,'미안함을 표현한 뒤 지금 수업이 있다고 사정을 설명해요.'),
  makeChoice('친구에게 내 가방을 들어 달라고 할 때 행동할 사람은 친구예요. 빈칸에 들어갈 말은? Can ___ carry my bag?', ['I','you'],1,'가방을 드는 쪽이 말을 듣는 친구라서 you예요.'),
];
const repairs = [
  ['Can you opens the door?', 'Can you open the door?', 'can 뒤에서는 opens에서 s를 떼고 open을 써요.'],
  ['Can you to help me?', 'Can you help me?', 'can 뒤에는 to 없이 help가 와요.'],
  ['Can you carrying my bag?', 'Can you carry my bag?', 'carrying을 기본 모양 carry로 바꿔요.'],
  ['Do can you wait here?', 'Can you wait here?', 'Can을 앞으로 보내면 질문이 완성돼요. Do를 또 붙일 필요가 없어요.'],
  ['Can your pass the ball?', 'Can you pass the ball?', '행동할 사람은 너(you)예요. your는 ‘너의’라는 뜻이에요.'],
].map(([wrong,right,reason])=>({wrong,right,reason}));

export function photoRequestLesson(printed: {en:string;ko:string}[], grade:number, count:number) {
  const a=actions.find(item=>printed.some(row=>item.match.test(row.en))) ?? actions[1];
  const request='Can you please '+a.verb+' '+a.object+'?';
  const refusal="I'm sorry, but I can't. I'm busy now.";
  const scene=a.place+' 지우는 민서에게 도움을 청해요. 민서는 곧 수업을 시작해요.';
  const why='Can you는 ‘할 줄 아니?’라면서요. 여기서는 왜 부탁이에요?';
  const because='지우 앞에는 지금 해결할 일이 있어요. 민서의 실력을 시험하려는 게 아니라 손을 빌리고 싶은 거예요. you는 부탁을 듣고 행동할 민서예요. please를 넣으면 “좀 해 줄래?”처럼 부드럽게 들려요.';
  const source:WorkshopSource={
    scene,why,because,misconception:'지우는 민서의 실력만 궁금하고, 민서는 지금 돕겠다고 했어요.',
    map:['지금 도와줄래?: Can you help me? 양손에 짐이 가득한 친구가 묻는다면 손을 빌려 달라는 부탁이에요.',
      '할 줄 아니?: Can you swim? 수영 반을 정하는 코치는 물에 뜨고 앞으로 나아갈 수 있는지 물어요.',
      '내가 해도 돼?: Can I sit here? 앉을 사람은 나(I)예요. 그 자리에 앉아도 되는지 허락을 구해요.',
      '평소에도 하니?: Do you swim on Fridays? 금요일마다 실제로 수영하는 습관이 궁금해요.',
      '부탁을 받으면?: 도울 수 있으면 Sure. No problem.(물론이지. 도와줄게.) 지금 어렵다면 미안하다는 말과 함께 사정을 한마디 덧붙여요.'],
    pair:[{label:'지우 → 민서 · 부탁하는 사람',chunks:['Can','you','please',a.verb,a.object+'?'],
      glosses:['해 줄 수 있을까','너, 민서가','좀, 정중하게',a.verbKo,a.objectKo],meaning:a.sentenceKo,image:'/word-bank-images/'+a.picture+'.webp'},
      {label:'민서 → 지우 · 부탁받은 사람',chunks:["I'm sorry,",'but',"I can't.","I'm busy now."],
      glosses:['미안해','그렇지만','나는 해 줄 수 없어','나 지금 바빠'],meaning:'미안하지만 지금은 못 해. 나 지금 바빠.',image:'/word-bank-images/clock.webp'}],
    clue:makeChoice('두 손에 책을 든 민서가 문 앞에서 “Can you open the door?”라고 해요. 지우가 어떻게 하면 민서가 원하는 일이 이뤄질까요?',
      ['문을 열 줄 안다고 말하고 지나가요.','지금 민서 대신 문을 열어 줘요.'],1,'단서는 두 손에 든 책이에요. 문을 열 수 있냐는 말로 지금 대신 열어 달라고 부탁했어요.'),
    apply:makeChoice('지우가 “Can you carry my bag?” 하고 물어요. 민서는 곧 수업이라 지금 가방을 들어 줄 수 없어요. 민서가 할 말을 골라 보세요.',
      ["Sure. No problem.","I'm sorry, but I can't. I have a class now."],1,'carry my bag은 내 가방을 들어 달라는 말이에요. Sure라고 하면 들어 주겠다는 뜻이에요. 민서는 지금 어렵고 그 이유가 수업이므로 두 번째 답이 어울려요.'),
    reading:makeChoice('Jiu is holding three books. “Can you open the window?” she asks. Minseo says, “Sure.” 다음에 일어날 일은?',
      ['지우가 민서의 실력을 기록한다.','민서가 창문을 열어 준다.','민서가 부탁을 거절한다.'],1,'책을 든 지우의 부탁에 민서가 Sure라고 답했으니 창문을 열어 주겠다는 뜻이에요.'),
    elementary:{opening:'쉬는 시간이에요. '+scene,task:'놀이가 끝났어요. 친구에게 공을 건네 달라고 부탁하세요. 친구는 도울 수 있어요. 두 사람의 말을 영어로 써 보세요.',model:'Can you pass the ball? — Sure!'},
    middle:{opening:'동아리 활동을 준비하는 시간이에요. '+scene,task:'동아리 모임이 끝났어요. 지우가 민서에게 창문을 닫아 달라고 부탁해요. 민서는 지금 바빠서 어렵다고 해요. 지우의 부탁과 민서의 거절, 그 이유를 영어로 써 보세요.',model:"Can you please close the window? — I'm sorry, but I can't. I'm busy now."},
    high:{opening:'발표 준비를 마치고 정리하는 시간이에요. '+scene,task:'발표를 마친 친구에게 의자를 옮겨 달라고 부탁하세요. 친구는 곧 수업이 있어서 지금은 어렵다고 해요. 두 사람의 대화를 영어로 적으세요.',model:"Can you move this chair? — I'm sorry, but I can't. I have a class now."},
    models,choices,repairs,
  };
  const lesson=compileWorkshop(source,grade,count);
  if ('panels' in lesson.steps[3].practice) lesson.steps[3].practice.panels=[];
  lesson.steps[3].practice.why.push(['open과 close는 어떻게 달라요?', 'open은 열다, close는 닫다예요. 무엇을 여는지 뒤에 붙여요. the door는 문, the window는 창문이에요.']);
  lesson.steps[1].practice.why.push(['왜 I can’t 다음에 행동을 다시 말하지 않아도 돼요?', '이미 부탁을 들었기 때문에 둘 다 어떤 행동인지 알아요. 민서가 I can’t라고 하면 “그 일을 지금은 해 줄 수 없어”라는 뜻이에요. I’m busy now는 왜 어려운지 알려 주는 한마디예요.']);
  if ('writingPrompt' in lesson.steps[4].practice) lesson.steps[4].practice.writingPrompt='친구의 부탁을 받았어요. 지금 바쁘다는 이유를 넣어 내 말로 거절해 보세요.';
  lesson.steps[0].practice.why=[['왜 부탁에 please를 붙여요?', 'please는 여기서 “좀”에 가까워요. 상대에게 선택을 주며 정중하게 부탁하는 느낌을 더해요.']];
  lesson.steps[2].practice.why=[['우리말은 행동이 끝에 오는데 영어는 어디에 놓아요?', '먼저 Can you please로 말을 듣는 사람에게 부탁해요. 다음에 '+a.verb+'('+a.verbKo+')로 원하는 행동을 말하고, '+a.object+'('+a.objectKo+')로 그 대상을 붙여요.']];
  const explain='부탁할 때는 누가 행동할지 먼저 생각해요. 상대에게 해 달라면 Can you로 시작해요. 내가 직접 해도 되는지 물으면 Can I로 시작해요.';
  return {...lesson,name:'Can you please …? · 도움을 부탁하고 이유를 들어 거절하기',audience:schoolOf(grade),
    pattern:"Can you please …? / Sure. / I’m sorry, but I can’t.", explain,rule:[because],usage:source.map,detail:[scene,because],
    examples:[request,'Sure. No problem.',refusal],translations:[a.sentenceKo,'물론이지. 도와줄게.','미안하지만 못 해. 나 지금 바빠.'],
    tip:because,pitfalls:repairs.map(r=>({...r,why:r.reason}))};
}
