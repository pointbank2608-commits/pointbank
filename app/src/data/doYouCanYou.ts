import type { GrammarPoint, GrammarTeachingStep } from '../lib/grammar';
import type { SceneLine } from '../../../supabase/functions/_shared/grammarWorkshop';

interface PracticeBase {
  lessonGrade?:number;
  lessonTopic?:string;
  image?: string;
  imageDescription?: string;
  panels?: SceneLine[];
  map?: {label:string; text:string; panelIndex?:number}[];
  assembly?: string[];
  title: string;
  why: [question: string, explanation: string][];
}

export type GuidedPractice = PracticeBase & ({
  question: string;
  choices: [label: string, feedback: string][];
  correct: number;
  writingPrompt?: string;
  independentPrompts?: undefined;
} | {
  independentPrompts: string[];
});

const steps: (GrammarTeachingStep & { practice: GuidedPractice })[] = [
  {
    prompt: '지우는 작년에 수영을 배웠어요. 혼자 물에 뜨고 앞으로 갈 수 있어요. 요즘은 수영장에 가지 않고 토요일마다 농구를 해요.\n민서는 토요일마다 수영 수업에 가요. 선생님이 잡아 주면 물속에서 앞으로 가요. 아직 손을 놓으면 혼자 나아가기 어려워요.\nswim은 ‘수영하다’, you는 말을 듣고 있는 ‘너’예요.',
    practice: {
      title: '안 하는 걸까, 못 하는 걸까?',
      why: [
        ['왜 수영을 안 해도 할 줄 안다고 해요?', '자전거를 배운 뒤 오늘 타지 않아도 타는 방법은 기억하지요. ‘안 해’는 생활 이야기이고 ‘할 줄 알아’는 배운 능력 이야기예요.'],
        ['왜 민서는 혼자 못 하는데 수영한다고 해요?', '자전거를 배울 때 누가 뒤를 잡아 줬어도 “오늘 자전거를 탔어”라고 할 수 있지요. 민서는 매주 물속에서 직접 연습해요. 혼자 할 수 있게 되기 전에도 연습은 할 수 있어요.'],
      ],
      question: '수영장에 더 자주 가는 사람과, 지금 혼자 수영할 수 있는 사람을 차례로 골라 보세요.',
      choices: [['지우, 민서', '지우는 수영을 배웠지만 요즘은 농구를 해요. 매주 가는 사람은 민서예요. 두 번째로는 누가 도움 없이 나아가는지 찾아보세요.'], ['민서, 지우', '맞아요. 민서가 더 자주 연습하고, 지우는 요즘 쉬어도 혼자 수영할 수 있어요.']], correct: 1,
    },
    hint: '지우가 배운 것과 요즘 토요일에 하는 일을 따로 찾아보세요.',
    answer: '민서는 매주 수영해요. 지우는 혼자 수영할 줄 알아요. 두 질문에 꼭 같은 친구의 이름이 나올 이유는 없어요.',
    followUp: '할 줄 알지만 요즘은 잘 하지 않는 일을 우리말로 하나 떠올려 보세요.',
  },
  {
    prompt: '학교 신문에서 친구들이 매주 하는 운동을 조사해요. Do you swim every week? 매주 수영하니? every week는 ‘매주’예요.\n지우는 No, I don’t. (아니, 안 해.) 요즘 토요일에는 농구를 하거든요.\n그럼 토요일마다 물속에서 연습하는 민서는 어떻게 답할까요?',
    practice: {
      title: 'Do you swim? 평소 생활을 물어요',
      why: [
        ['왜 Do를 ‘평소에’라고 따로 읽지 않아요?', 'You swim.은 “너는 수영해”라고 알려주는 말이에요. Do를 앞에 붙인 Do you swim?은 상대에게 사실인지 묻는 말이에요. 여기서는 운동 습관을 이야기하니까 “평소에 수영해?”로 이해해요. Do you like music?은 “너 음악 좋아해?”예요. 무엇이 궁금한지는 뒤의 말도 함께 들어야 알아요.'],
        ['왜 대답에는 you 대신 I가 나와요?', '내가 친구에게 물을 때는 친구를 you(너)라고 불러요. 친구가 자기 이야기를 할 때는 I(나)라고 해요. I don’t swim.에서 서로 아는 swim을 덜어 내면 짧은 대답 No, I don’t.가 돼요.'],
      ],
      question: '민서는 매주 토요일 수영을 해요. Do you swim?에 민서는 뭐라고 답할까요?',
      choices: [['Yes, I do.', '맞아요. 토요일마다 하는 일이니까 “응, 수영해”라고 답해요.'], ['No, I don’t.', '이 말은 “아니, 평소에 안 해”예요. 매일 해야만 Yes라고 하는 건 아니에요.']], correct: 0,
    },
    hint: '일주일에 한 번이라도 반복해서 하는 일인지 살펴보세요.',
    answer: 'Yes, I do. 민서는 평소에 수영을 해요. 얼마나 잘하는지는 아직 알 수 없어요.',
    followUp: '친구에게 Do you swim?이라고 물었더니 “응, 매주 금요일에 해”라고 해요. 무엇을 알아냈나요?',
  },
  {
    prompt: '이번에는 수영 선생님이 누구에게 손을 내밀어 주면 좋을지 알고 싶어요. Can you swim on your own? 혼자 수영할 수 있니? on your own은 ‘누가 도와주지 않아도 혼자서’라는 뜻이에요.\n지우는 Yes, I can. (응, 할 수 있어.) 민서는 No, I can’t. (아니, 아직 혼자서는 못 해.) 둘 다 아까와 대답이 바뀌었어요.',
    practice: {
      title: 'Can you swim? 할 줄 아는지 물어요',
      why: [
        ['왜 Do you can swim?이라고 하지 않아요?', 'You can swim.(너는 수영할 수 있어.)에서 can을 맨 앞으로 옮겨 보세요. Can you swim?이 되지요. 이미 “할 수 있니?”라는 질문이 완성되어 Do를 더 붙일 자리가 필요 없어요.'],
        ['왜 Yes, I can.만 듣고 매주 수영한다고 할 수 없어요?', '친구는 “할 줄 알아”라는 한 가지 정보만 줬어요. 어제 했는지, 자주 하는지까지 말한 적은 없어요. 평소에도 하는지 궁금하면 Do you swim?이라고 한 번 더 물을 수 있어요.'],
      ],
      question: '수영 시험을 앞둔 짝에게 수영하는 법을 아는지 묻고 싶어요. 어느 질문이 맞을까요?',
      choices: [['Do you swim?', '자연스러운 질문이에요. 다만 짝은 요즘 수영장에 다니는지 묻는 것으로 들을 수 있어요. 여기서는 할 줄 아는지가 궁금해요.'], ['Can you swim?', '맞아요. can을 써서 수영할 능력이 있는지 물었어요.']], correct: 1,
    },
    hint: '‘평소에 하니?’와 ‘할 줄 아니?’ 중 궁금한 뜻부터 고르세요.',
    answer: 'Can you swim? 지우처럼 요즘 안 해도 할 줄 알면 Yes, I can.이라고 답할 수 있어요.',
    followUp: '누군가 No, I can’t.라고 답했어요. “요즘 안 해”와 “할 줄 몰라” 중 어느 뜻일까요?',
  },
  {
    prompt: '수영 수업이 끝났어요. 민서는 양손에 수건을 들고 있고 지우는 열린 탈의실 문 옆에 있어요. 민서가 지우에게 말해요.\nCan you please close the door? 문 좀 닫아 줄래?\nclose는 ‘닫다’, the door는 ‘그 문’이에요. 친구가 실제로 문을 닫아 주면 내가 바란 일이 이루어져요.',
    practice: {
      title: '같은 Can you가 부탁이 되는 순간',
      why: [
        ['왜 여기서는 문 닫을 줄 아느냐는 뜻이 아니에요?', '친구가 문 닫는 법을 안다는 건 둘 다 알고 있어요. 지금 필요한 건 열린 문을 닫는 행동이에요. 두 손에 짐을 든 사람이 “문 열어 줄 수 있어?”라고 하면 열어 주길 바라는 것과 같아요.'],
        ['왜 please를 넣어요? 빼도 부탁이에요?', 'please는 부탁을 좀 더 공손하게 건네는 말이에요. Can you close the door?도 이 장면에서는 부탁이에요. please가 없어도 열린 문, 친구의 위치, 말투가 뜻을 알려 줘요.'],
      ],
      question: '문 옆에 있는 친구가 부탁을 들어주려면 어떻게 하면 될까요?',
      choices: [['Sure.라고 말하고 문을 닫아요.', '맞아요. Sure.는 “그럼”이에요. 원하던 행동까지 해 주었어요.'], ['문 닫는 방법을 설명해요.', '방법을 가르쳐 달라는 말로 들었군요. 여기서는 이미 방법을 아는 친구에게 지금 문을 닫아 달라고 했어요.']], correct: 0,
    },
    hint: '지금 상대가 알려 주기를 바라나요, 움직여 주기를 바라나요?',
    answer: 'Sure.(그럼.)라고 하며 닫아 줘요. 어려우면 I’m sorry, but I can’t. My hands are full.(미안하지만 못 해. 두 손에 짐이 있어.)이라고 이유를 말할 수도 있어요.',
    followUp: '손에 짐을 든 친구가 문 앞에서 Can you open the door?라고 해요. open은 ‘열다’예요. 무엇을 해 달라는 걸까요?',
  },
  {
    prompt: '지우와 민서가 축제 준비를 해요. 민서는 피아노를 칠 줄 알지만 요즘은 쉬고 있어요. play the piano는 ‘피아노를 치다’예요.\n이번 질문에는 ‘매주’나 ‘혼자서’라는 말이 없어요. 지우가 무슨 정보를 얻고 싶은지 생각해 보세요.',
    practice: {
      title: '같은 친구에게 두 가지로 물어보기',
      why: [
        ['왜 두 질문 다 우리말로 “너 피아노 쳐?”처럼 들려요?', '우리말로도 연습 시간을 물을 때와 반주자를 구할 때의 뜻이 달라요. 영어에서는 Do you …?로 평소 하는 일을, Can you …?로 할 줄 아는 일을 따로 물어볼 수 있어요.'],
        ['왜 No, I don’t.라고 해도 반주를 부탁할 수 있어요?', '“요즘 평소에 치지는 않아”라는 답이에요. 실력이 없다는 답은 아니니까, 칠 줄 아는지 물은 뒤 부탁할 수 있어요.'],
      ],
      question: '동아리에서 반주할 줄 아는 사람을 찾아요. 어떤 질문으로 시작할까요?',
      choices: [['Do you play the piano?', '평소에 치는 친구를 찾을 때 어울려요. 요즘 쉬고 있는 친구도 반주할 줄 알 수 있어요.'], ['Can you play the piano?', '맞아요. 반주에 필요한 능력이 있는지 먼저 물을 수 있어요.']], correct: 1,
    },
    hint: '친구의 연습 습관이 필요한지, 연주할 수 있는지가 필요한지 생각해요.',
    answer: 'Can you play the piano? — Yes, I can. 칠 줄 알아요. 평소에도 치는지 따로 물으면 이 친구의 답은 No, I don’t.예요.',
    followUp: '민서가 자기소개를 해요. I play the piano and sing. “나는 피아노를 치고 노래해.” sing은 ‘노래하다’예요. 너라면 어떤 취미를 소개하고 싶어요?',
  },
  {
    prompt: '학교 방송반에서 점심 방송을 준비해요. 새로 만난 친구에게 아래 세 상황에서 건넬 영어 질문을 한 문장씩 써 보세요. 다 쓰면 예시와 비교할 수 있어요.',
    practice: {
      title: '처음 만난 방송반 친구에게 직접 묻기',
      independentPrompts: [
        '① 친구의 일상을 소개하는 인터뷰예요. 집에서 평소 노래하는지 궁금해요.',
        '② 오늘 가수가 목이 아파요. 친구에게 지금 한 곡 불러 달라고 부탁해요.',
        '③ 다음 달 무대를 준비해요. 친구가 노래할 줄 아는지 알아보세요.',
      ],
      why: [
        ['왜 내 질문을 먼저 써요?', '정해진 답을 떠올리려 애쓰기보다 그 친구에게 실제로 하고 싶은 말을 적어 보세요. 다 쓴 뒤에는 내 문장과 예시가 상대에게 같은 뜻으로 들릴지 살펴볼 수 있어요.'],
        ['왜 두 질문이 비슷해도 친구의 반응은 달라요?', '②에서는 친구가 마이크를 잡고 노래하면 부탁이 이루어져요. ③에서는 “응, 할 줄 알아”라는 대답만 들어도 필요한 정보를 얻었어요.'],
      ],
    },
    hint: '세 상황에서 친구에게 하고 싶은 질문을 직접 적어 보세요.',
    answer: '① Do you sing at home? 집에서 평소 노래하니? 평소 어떻게 지내는지 물었어요.\n② Can you sing a song for us now? 지금 우리를 위해 한 곡 불러 줄래? Can you sing for us?도 이 상황에 어울려요.\n③ Can you sing? 노래할 줄 아니? 무대에 설 수 있는지 알아보려는 질문이에요.',
    followUp: '네 문장을 한 줄씩 다시 읽어 보세요. 첫째 답에서 친구의 일상을 알 수 있나요? 둘째 질문을 들으면 친구가 지금 무엇을 해 주면 될까요? 셋째에는 할 줄 아는지만 대답해도 될까요?',
  },
];

export const doYouCanYou: GrammarPoint = {
  id: 'do-you-can-you', stage: 'middle', level: 5, grade: '중1', band: 'entry',
  name: 'Do you와 Can you의 차이', goal: '습관·능력·부탁에 맞게 질문해요',
  pattern: '**Do you** swim? / **Can you** swim?',
  explain: '같은 행동을 두고도 평소에 하는지, 할 줄 아는지, 지금 해 줄 수 있는지를 물을 수 있어요.',
  examples: ['**Do you** swim?', '**Can you** swim?', '**Can you please** close the door?'],
  translations: ['너 평소에 수영해?', '너 수영할 줄 알아?', '문 좀 닫아 줄래?'],
  slots: null, steps,
};
