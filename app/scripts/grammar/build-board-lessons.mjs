// Refresh the classroom boards from the catalog and the corresponding authored workbook.
import fs from 'node:fs';
const data = new URL('../../src/data/', import.meta.url);
const catalogFile = new URL('grammarPoints.json', data);
const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
const introductions = JSON.parse(fs.readFileSync(new URL('board-first-examples.json', import.meta.url), 'utf8'));
const bankDir = new URL('grammarSheets/bank/', data);
const bank = new Map(fs.readdirSync(bankDir).sort().flatMap(file =>
  JSON.parse(fs.readFileSync(new URL(file, bankDir), 'utf8')).map(sheet => [sheet.id, sheet])));

// Offer one concrete explanation when a workbook uses a technical Korean term.
const terms = [
  ['과거분사', 'write(쓰다)가 written이 되듯이, 같은 행동을 다른 꼴로 적을 수 있어요. written처럼 완료나 수동 표현에 쓰는 꼴을 과거분사라고 해요.'],
  ['동사원형', '동사원형은 사전에서 처음 찾는 꼴이에요. 예를 들어 plays의 기본 꼴은 play예요.'],
  ['3인칭 단수', '말하는 나와 듣는 너 말고, 다른 한 사람이나 사물 하나를 떠올려요. 예를 들어 내 친구 한 명이에요.'],
  ['목적어', '“나는 사과를 먹어”에서 무엇을 먹나요? 사과를 먹어요. 이렇게 행동의 대상을 나타내는 말이 목적어예요.'],
  ['보어', '“미나는 학생이야”에서 학생이라는 말이 미나를 설명해요. 이렇게 누구인지, 어떤 상태인지 채워 주는 말이 보어예요.'],
  ['동명사', 'swim은 수영하다예요. Swimming is fun.에서는 swimming이 “수영하기”라는 활동의 이름처럼 쓰여요.'],
  ['주어', '“아기가 자요”에서 누구 이야기인가요? 아기예요. 이렇게 문장에서 누구 또는 무엇을 두고 말하는지 나타내는 말이 주어예요.'],
  ['형용사', '“작은 가방”에서 작은은 가방의 모습을 알려 줘요. small처럼 어떤지 알려 주는 말을 형용사라고 해요.'],
  ['명사', '가방이나 친구처럼 물건, 사람, 장소, 생각 등에 붙이는 이름을 명사라고 해요.'],
  ['동사', 'run은 달리다, be는 어떤 상태에 있다예요. 행동이나 상태를 말해 주는 낱말을 동사라고 해요.'],
];

function stepsFor(point, sheet) {
  const [first, second] = point.examples;
  const [firstKo, secondKo] = point.translations;
  const focus = example => [...example.matchAll(/\*\*([^*]+)\*\*/g)].map(match => match[1]).join(' · ');
  const wordHint = example => focus(example) ? '표시된 표현 ' + focus(example) + '을 먼저 읽고 앞뒤 말을 연결해 보세요.' : point.explain;
  const intro = introductions[point.id];
  if (!intro) throw new Error('Missing first-example guide: ' + point.id);
  const model = sheet.review[0];
  const contrast = sheet.correct[0];
  const termHelp = terms.find(([term]) => new RegExp('(?:^|[^가-힣])' + term).test(contrast.why))?.[1];
  const choice = sheet.choose[0];
  const review = sheet.b?.review.at(-1) ?? sheet.review.at(-1);
  const support = point.stage === 'elementary' ? '말하기 어려우면 가리키거나 우리말로 먼저 답해 보세요.'
    : point.stage === 'high' ? '상대에게 전달하려는 뜻을 우리말로 정한 뒤, 근거가 되는 표현을 짚어 보세요.'
    : '어려운 낱말 하나를 먼저 짚고, 아는 말부터 우리말로 이어 보세요.';
  const stage = (prompt, hint, answer, followUp) => ({ prompt, hint, answer, followUp });
  return [
    stage(first + '\n' + intro.meaning + '\n' + intro.question, firstKo + '\n' + support, firstKo + '\n' + intro.meaning, '영어를 다시 들으며 방금 답을 알려 준 말을 짚어 보세요.'),
    stage(model.model + '\n' + model.ko + '\n뜻을 생각하며 선생님과 한 번 읽어요. 이제 영어를 가리고 같은 뜻을 말해 볼까요?', model.cond + '\n앞에서 본 예도 떠올려 보세요. ' + first, model.model + '\n' + model.ko + '\n' + model.cond, sheet.say[0].task + '\n' + sheet.say[0].frame),
    stage('처음 쓴 말　' + contrast.w + '\n고쳐 쓴 말　' + contrast.r + '\n고친 문장을 따라 읽고, 달라진 곳 한 군데를 짚어 보세요.', contrast.why + (termHelp ? '\n' + termHelp : ''), contrast.r + '\n' + contrast.why, '이번에는 직접 고쳐 보세요. ' + sheet.correct[1].w),
    stage(first + '\n' + intro.meaning + '\n이번에는 이 말이에요. ' + second + '\n우리말로 어떤 뜻일까요?', secondKo + '\n' + wordHint(second), second + '\n' + secondKo + '\n' + point.explain, point.examples[2] + '\n' + point.translations[2] + '\n짝이 뜻을 읽으면 영어에서 그 뜻을 찾으세요.'),
    stage(choice.p + '\n' + choice.c.join('   /   '), (point.tip || point.explain) + '\n첫 단서로 쓸 예를 읽어 보세요. ' + first + ' ' + firstKo, choice.c[choice.a] + '\n' + choice.why, sheet.choose[1].p + '  (' + sheet.choose[1].c.join(' / ') + ')'),
    stage(review.ko + '\n이 뜻을 영어로 전해 보세요.', review.cond, review.model + '\n' + review.ko, sheet.mission.scene + '\n' + sheet.say[0].task + '\n다음 수업에서는 보기를 가리고 내 상황에 맞는 말로 다시 들려주세요.'),
  ];
}
// Tailor the worked comparisons for topics that recur across school bands.
const spotlight = {
  'i-can': {
    goal: '할 수 있는 일을 묻고 답하기',
    stages: [
      ['짝이 두 팔로 물을 가르는 시늉을 해요. swim은 수영하다예요.\n**I can swim.** 나는 수영할 수 있어.\n이 친구가 잘한다고 말한 건 수영일까요, 달리기일까요?', '수영하는 동작을 해 볼까요? 영어로 swim이에요.', 'I can swim. 나는 수영할 수 있어요.', '친구가 보여 준 다른 동작도 말해 볼까요?'],
      ['I → I can → I can swim. 세 덩어리를 이어 읽어 보세요. 어느 말이 ‘할 수 있어’라는 뜻을 더하나요?', 'I는 나, swim은 수영하다예요. 가운데 말을 잠깐 가려 보세요.', 'can을 넣어 내가 수영할 수 있다고 말해요. can 뒤에는 swim처럼 동사의 기본 모습을 써요.', '춤을 출 수 있다면 swim을 무엇으로 바꿀까요? dance를 넣어 읽어 보세요.'],
      ['I can dance. / Can you dance? 누구의 재능을 말하거나 묻고 있나요?', 'I는 나, you는 상대예요. 두 번째 문장의 첫 낱말을 짚어 보세요.', '첫 문장은 내 재능이에요. 두 번째는 can을 앞으로 옮겨 친구에게 물어요.', 'sing은 노래하다예요. 친구에게 노래할 수 있는지 물어보세요.'],
      ['나는 수영할 수 있다고 말한 뒤, 친구에게도 같은 질문을 해 보세요.', '첫 문장은 I can, 질문은 Can you로 시작해요.', 'I can swim. Can you swim? 나도 할 수 있다면 Yes, I can.이라고 답해요.', '어려우면 No, I can’t.라고 답하고, 잘하는 동작을 대신 보여 주세요.'],
      ['She can (dance / dances). 어느 말을 골라야 할까요?', '주어가 She여도 can 바로 뒤에 오는 동사의 모습에 주목하세요.', 'She can dance. can 뒤에는 기본형 dance가 와요.', 'He can (sing / sings).에서도 같은 방법으로 찾아보세요.'],
      ['새 동아리에서 짝과 서로 할 수 있는 일을 알아보세요. 들은 답을 바탕으로 같이 할 활동을 골라요.', '먼저 I can ____. 그다음 Can you ____? 짝은 자신의 답을 골라요.', '예를 들어 I can draw. Can you draw? / Yes, I can.이라고 대화하고 함께 그림을 그릴 수 있어요.', '다음 시간에는 친구의 재능 하나를 기억해서 She can 또는 He can으로 소개해 보세요.'],
    ],
  },
  'm-modals': {
    goal: 'can으로 부탁하고 답하기 · 허락·의무·조언 구별하기',
    stages: [
      ['에어컨이 켜진 교실이에요. 문 가까이에 있는 친구에게 말해요.\n**Can you please close the door?** 문 좀 닫아 줄래?\nclose는 ‘닫다’, the door는 ‘그 문’이에요. 이 말을 들은 친구는 문을 열까요, 닫을까요?', '먼저 친구가 서 있는 곳을 떠올려요. 말하는 사람이 친구에게 해 달라는 행동은 close예요. 손짓으로 보여 줘도 좋아요.', '친구가 문을 닫아요. Can you …?는 여기서 ‘네가 …해 줄래?’예요. 내가 지금 도움이 필요해서 상대에게 부탁하는 말이에요.', '친구가 창문 옆에 서 있어요. ‘창문 좀 닫아 줄래?’라고 할 때 바꿀 말은 close일까요, the door일까요? 창문은 the window예요.'],
      ['**Can you** (네가 해 줄래?) / **please** (좀) / **close the door** (문을 닫다).\n세 덩어리를 이어 읽어 보세요. 이번엔 문을 열어 달라고 해 볼까요? ‘열다’는 open이에요.', '누구에게 부탁하는지와 어떤 문인지는 그대로예요. 행동을 나타내는 close 한 단어만 바꿔요.', 'Can you please open the door? 문 좀 열어 줄래? please를 넣으면 부탁이 한결 부드러워요. can과 함께 쓸 때 행동은 open처럼 사전에서 찾는 기본형으로 말해요.', 'open your book은 ‘네 책을 펴다’예요. 방금 문장에서 행동 덩어리를 바꿔 짝에게 부탁해 보세요.'],
      ['같은 교실, 같은 창문이에요.\nA. **Can you** open the window? 창문 좀 열어 줄래?\nB. **May I** open the window? 제가 창문을 열어도 될까요?\nA와 B에서 창문을 여는 사람을 각각 가리켜 보세요.', 'you는 내 말을 듣는 사람, I는 말을 하는 나예요. open the window(창문을 열다)는 두 문장에서 같아요.', 'A에서는 상대가 열어요. 상대에게 행동을 부탁했어요. B에서는 내가 열어요. 행동하기 전에 허락을 구했어요. 허락을 물을 때 Can I …?라고 해도 돼요.', '양손에 짐이 있어서 짝이 창문을 열어 주면 좋겠어요. A와 B 중 하나를 골라 짝에게 말해 보세요.'],
      ['**Can you help me carry this bag?** 이 가방 옮기는 것 좀 도와줄래?\n손이 비어 있는 친구는 **Sure. No problem.**(물론이지. 도와줄게.)라고 답해요.\n이번에는 네 양손에도 짐이 있어요. 어떤 대답이 어울릴까요?', 'I’m sorry는 ‘미안해’, I can’t는 ‘지금은 못 해’예요. but(하지만)으로 이어 보세요. 양손이 다 찼다는 말은 My hands are full.이에요.', 'I’m sorry, but I can’t. My hands are full. 미안하지만 지금은 못 도와줘. 양손에 짐이 있어. 첫 문장으로 부탁을 거절하고 다음 문장으로 친구가 이해할 수 있게 사정을 설명했어요.', '이번엔 곧 수업이라서 어려워요. I have class now.(지금 수업이 있어.)를 이유로 써서 다시 답해 보세요.'],
      ['실험실 문에 ‘보안경을 꼭 쓰세요’라는 안전 규칙이 있어요. wear safety glasses는 ‘보안경을 쓰다’예요.\nYou should wear safety glasses.라고 썼어요. ‘꼭 지켜야 한다’는 뜻이 드러나도록 한 단어를 고쳐 보세요.', 'should는 ‘그러면 좋겠다’는 조언이에요. must는 ‘반드시 해야 한다’예요. 규칙을 지키지 않아도 되는지 생각해 보세요.', 'You must wear safety glasses. 보안경을 반드시 써야 해요. 표지판은 누구나 지켜야 할 규칙이어서 must가 맞아요. 두 표현 모두 뒤에 wear를 그대로 써요.', '피곤한 친구에게 ‘좀 쉬는 게 좋겠어’라고 조언해요. You (must / should) take a break.에서 골라 보세요. take a break는 ‘잠깐 쉬다’예요.'],
      ['학교 축제 준비 중이에요. 네가 상자를 들고 있고 짝은 포스터를 붙이고 있어요. 상자를 옮겨 달라고 부탁해 보세요. 짝은 자기 상황을 정해 돕거나, 거절하고 이유를 말해요. 그런 다음 역할을 바꿔요.', '상자 옮기기는 carry this box예요. 부탁은 Can you please …?로 시작해요. 거절한 뒤에는 I’m busy now.(지금 바빠.)처럼 이유를 한 문장 덧붙여요.', 'Can you please carry this box? 이 상자 좀 옮겨 줄래? / Sure. No problem. 물론이지. 또는 I’m sorry, but I can’t. I’m busy now. 미안하지만 못 도와줘. 지금 바빠. 부탁을 들은 사람이 실제로 도울 수 있는지에 따라 두 답 모두 가능해요.', '다음 시간에는 칠판을 가리고 연필을 빌리는 대화를 해 보세요. lend me a pencil은 ‘내게 연필을 빌려주다’예요. 짝은 연필이 한 자루일 때와 두 자루일 때의 답을 다르게 해 보세요.'],
    ],
  },
  'h-noun-clause': {
    goal: '확인된 소식과 아직 모르는 일을 구별해 전하기',
    stages: [
      ['경기 전광판을 보고 기사를 써요. Our team won.은 ‘우리 팀이 이겼다’예요.\n**I know that our team won.** 나는 우리 팀이 이겼다는 걸 알아.\n이긴 것이 확인된 소식일까요, 아직 답을 기다리는 질문일까요?', 'I know는 ‘나는 알아’예요. 그 뒤에 무엇을 아는지 소식 전체를 붙였어요.', '확인된 소식이에요. that 뒤를 끝까지 읽으면 ‘무엇을 아는지’가 나와요. 아직 확인할 일이라면 ‘알아’ 대신 ‘궁금해’로 시작할 수 있어요.', '친구에게 확인하고 싶은 소식 한 가지를 떠올려 보세요.'],
      ['Our team won. → I know **that our team won**. 처음 문장에서 누가 무엇을 했나요? 두 번째에서는 무엇을 안다는 말인가요?', 'our team은 우리 팀, won은 이겼다는 뜻이에요. know 뒤의 말을 끝까지 읽어 보세요.', '“우리 팀이 이겼다”라는 문장 전체가 아는 내용이에요. that이 이 내용을 know에 이어 줘요. 주어와 동사가 있는 덩어리를 절이라고 해요.', 'know를 heard로 바꾸어 보세요. 같은 소식을 이번에는 어떻게 알게 되었나요?'],
      ['I know **that** the captain is coming. / I wonder **whether** the captain is coming. 두 기자 중 누구에게 참석이 확인됐나요?', 'wonder는 궁금해하다예요. 두 문장에서 사람과 행동은 같아요. 전달하는 사람의 입장이 담긴 말을 찾아보세요.', '첫 기자는 온다는 것을 알아요. 두 번째 기자에게는 올 가능성과 안 올 가능성이 모두 열려 있어요. whether는 “~인지 (아닌지)”예요.', '짝에게 “회의가 오늘인지 궁금하다”라고 전해 보세요. the meeting is today를 활용하세요.'],
      ['I heard the news **that our team won**. / I shared the news **that you sent**. 두 문장에서 news 다음 말이 하는 일을 찾아보세요.', 'our team won은 이것만으로 뜻이 완성돼요. you sent는 “네가 무엇을 보냈지?”라는 자리가 남아요.', '첫 문장은 뉴스의 내용이 “우리 팀이 이겼다”예요. 이렇게 명사의 내용을 풀 때 동격이라고 해요. 둘째는 네가 보낸 뉴스를 가려내요. sent의 목적어 자리가 news와 연결돼요.', 'the fact that our team won을 읽고, fact의 내용을 한 문장으로 말해 보세요.'],
      ['“경기가 열릴지 궁금하다”라는 뜻을 고르세요. I wonder (that / whether) the game will take place. 고른 근거도 말해 보세요.', 'take place는 열리다예요. 경기가 열릴 것으로 확정됐나요?', 'I wonder whether the game will take place. 아직 두 가능성이 있어서 whether를 써요. 여기서는 if도 가능해요.', 'Whether the game will take place is unclear.에서 무엇이 불분명한지 처음부터 어디까지인지 짚어 보세요.'],
      ['동아리 공지에서 확인한 사실 하나와 추가로 확인할 질문 하나를 짝에게 전하세요. 짝은 어느 쪽이 확정된 정보인지 말해요.', '첫 문장은 I heard that …, 두 번째는 I wonder whether …로 시작할 수 있어요. meet와 tomorrow를 써도 좋아요.', 'I heard that we meet tomorrow. / I wonder whether Mina can come. 만나는 날은 들은 소식이고, 미나의 참석 여부는 열려 있어요.', '다음 수업에서 틀을 가리고 시간표에 관해 두 문장을 말해 보세요. 짝이 어떤 문장에 대답하면 될까요?'],
    ],
  },
  'm-to-inf-noun': {
    goal: '주어·목적어·보어 구별하기',
    stages: [
      ['글쓰기 동아리에서 하고 싶은 일을 묻네요. write는 ‘쓰다’, a book은 ‘책 한 권’이에요.\n**I want to write a book.** 나는 책 한 권을 쓰고 싶어.\n이 학생은 책을 갖고 싶은 걸까요, 직접 쓰고 싶은 걸까요?', '‘책’만 말하면 읽는지 쓰는지 알 수 있을까요? 행동까지 말해 보세요.', '책을 쓰고 싶어요. / 제 목표는 책 한 권을 쓰는 거예요. 두 답은 같은 행동을 이야기해요.', '두 답에서 ‘책을 쓰는 것’이 하는 일이 같은지 생각해 보세요.'],
      ['write → write a book → I want **to write a book**. 처음부터 어떤 뜻이 하나씩 붙나요?', 'write는 쓰다, a book은 책 한 권이에요. want는 원한다는 뜻이에요.', 'I want 뒤에 원하는 행동을 붙일 때 to write를 써요. write처럼 사전에 나오는 기본 모습을 동사원형이라고 해요.', '책 대신 노래 한 곡을 쓰고 싶다면? a song을 넣어 문장 전체를 말해 보세요.'],
      ['Kate wanted **to write a book**. / My dream is **to write a book**. 같은 부분을 찾아 두 문장에 각각 질문을 만들어 보세요.', '첫 문장에는 ‘무엇을 하고 싶었어?’, 두 번째에는 ‘꿈이 뭐야?’라고 물어보세요.', '첫 문장에서는 wanted가 가리키는 내용을 받는 목적어예요. 두 번째에서는 My dream이 무엇인지 풀어 주는 보어예요.', '‘둘 다 맨 뒤에 있어요’라는 설명으로 역할까지 구별할 수 있을까요? 앞에 오는 말을 근거로 설명해 보세요.'],
      ['**To watch dramas** is fun. ‘무엇이 재미있대?’라고 물으면 어느 부분까지 읽어야 할까요? 이어 To help others brings happiness.에서도 찾아보세요.', 'watch dramas는 드라마를 보다, help others는 다른 사람들을 돕다예요.', 'To watch dramas 전체가 재미있는 일이에요. 다음 문장에서는 To help others 전체가 행복을 가져오는 일이에요. 두 덩어리가 각각 주어예요.', 'dramas만 짚으면 빠지는 뜻이 무엇인지 말해 보세요.'],
      ['My plan is to make a video. 계획의 내용을 알려 주는 말에 밑줄을 긋고 그 역할을 말해 보세요.', '‘영상 한 편’과 ‘영상을 만드는 것’ 중 무엇이 계획인지 생각해 보세요.', 'to make a video 전체가 보어예요. My plan = to make a video로 이어져요.', 'I hope to make a video.에서는 무엇을 바라는지 알려 줘요. 같은 덩어리가 이번에는 어떤 역할일까요?'],
      ['학교 축제에서 하고 싶은 일과 자신의 목표를 각각 한 문장으로 소개하세요. 짝은 두 문장에서 행동을 나타내는 부분을 찾아요.', '말이 떠오르지 않으면 take photos나 interview a singer를 골라 보세요. I want … / My goal is …로 시작해요.', 'I want to take photos.에서는 원하는 일이 목적어예요. My goal is to interview a singer.에서는 목표의 내용이 보어예요. 다른 활동도 괜찮아요.', '다음 시간에 To learn a new song takes time.을 읽고 ‘시간이 걸리는 일’을 찾아보세요. 주말에 하고 싶은 일도 다른 예로 말해 보세요.'],
    ],
  },
};
for (const point of catalog) {
  const sheet = bank.get(point.id);
  if (!sheet) throw new Error('Missing workbook: ' + point.id);
  point.goal = sheet.say[0].task.replace(/[.!?]$/, '');
  const lesson = spotlight[point.id];
  if (lesson) {
    point.goal = lesson.goal;
    point.steps = lesson.stages.map(([prompt, hint, answer, followUp]) => ({ prompt, hint, answer, followUp }));
  } else point.steps = stepsFor(point, sheet);
}
fs.writeFileSync(catalogFile, JSON.stringify(catalog, null, 2) + '\n');
