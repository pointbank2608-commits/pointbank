// Refresh the classroom boards from the catalog and the corresponding authored workbook.
import fs from 'node:fs';
const data = new URL('../../src/data/', import.meta.url);
const catalogFile = new URL('grammarPoints.json', data);
const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
const bankDir = new URL('grammarSheets/bank/', data);
const bank = new Map(fs.readdirSync(bankDir).sort().flatMap(file =>
  JSON.parse(fs.readFileSync(new URL(file, bankDir), 'utf8')).map(sheet => [sheet.id, sheet])));

function stepsFor(point, sheet) {
  const [first, second] = point.examples;
  const [firstKo, secondKo] = point.translations;
  const focus = example => [...example.matchAll(/\*\*([^*]+)\*\*/g)].map(match => match[1]).join(' · ');
  const wordHint = example => focus(example) ? '표시된 표현 ' + focus(example) + '을 먼저 읽고 앞뒤 말을 연결해 보세요.' : point.explain;
  const chunks = first.split(/\*\*([^*]+)\*\*/).map(part => part.trim()).filter(Boolean).join(' / ');
  const choice = sheet.choose[0];
  const review = sheet.b?.review.at(-1) ?? sheet.review.at(-1);
  const support = point.stage === 'elementary' ? '말하기 어려우면 가리키거나 우리말로 먼저 답해 보세요.'
    : point.stage === 'high' ? '상대에게 전달하려는 뜻을 우리말로 정한 뒤, 근거가 되는 표현을 짚어 보세요.'
    : '어려운 낱말 하나를 먼저 짚고, 아는 말부터 우리말로 이어 보세요.';
  const stage = (prompt, hint, answer, followUp) => ({ prompt, hint, answer, followUp });
  return [
    stage(sheet.mission.scene + '\n이 장면에서 누구에게 어떤 말을 하면 좋을까요?', support + '\n' + sheet.mission.steps[0], point.usage.join('\n') + '\n' + first + '  ' + firstKo, '같은 표현이 필요한 상황을 하나 더 떠올려 보세요.'),
    stage(first + '\n짧게 끊어 읽어 보세요. 어떤 뜻이 하나씩 붙나요?', chunks + '\n' + wordHint(first), firstKo + '\n' + point.explain + '\n' + point.detail[0], sheet.say[0].task + '\n' + sheet.say[0].frame),
    stage(point.examples.join('\n') + '\n' + sheet.discover.q, point.rule?.[0] || point.detail[0], sheet.discover.a, '방금 찾은 규칙이 보이는 예문을 골라 그 부분을 읽어 보세요.'),
    stage(second + '\n이 문장이 무슨 뜻인지 말하고, 그 뜻을 알아낸 부분을 짚어 보세요.', wordHint(second), secondKo + '\n' + (focus(second) ? '이 문장에서 짚을 표현은 ' + focus(second) + '예요. ' : '') + point.explain, point.examples[2] + '\n이번에는 강조된 부분을 덮고 같은 방법으로 뜻을 설명해 보세요.'),
    stage(choice.p + '\n' + choice.c.join('   /   '), '빈칸 앞뒤를 읽고 각 보기를 넣어 보세요. ' + (point.tip || point.explain), choice.c[choice.a] + '\n' + choice.why, sheet.choose[1].p + '  (' + sheet.choose[1].c.join(' / ') + ')\n고른 표현으로 문장 전체를 읽어 보세요.'),
    stage(review.ko + '\n이 뜻을 영어로 전한 뒤, 자신의 상황에 맞게 바꾸어 보세요.', review.cond, review.model, sheet.mission.title + '\n' + sheet.mission.steps.join('\n') + '\n다음 수업에서 예문을 덮고 오늘과 다른 예를 들어 보세요.'),
  ];
}
// Tailor the worked comparisons for topics that recur across school bands.
const spotlight = {
  'i-can': {
    goal: '할 수 있는 일을 묻고 답하기',
    stages: [
      ['학급 장기 자랑에 참가해요. 친구에게 보여 줄 수 있는 동작 하나를 해 보세요. 친구는 무엇인지 맞혀 보세요.', '수영하는 동작을 해 볼까요? 영어로 swim이에요.', 'I can swim. 나는 수영할 수 있어요.', '친구가 보여 준 다른 동작도 말해 볼까요?'],
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
      ['두 손에 상자를 들고 닫힌 문 앞에 섰어요. 친구에게 어떤 행동을 부탁할까요? 친구가 도와줄 수 있는 경우와 지금 어려운 경우를 떠올려 보세요.', 'open the door는 문을 열다예요. 친구가 해 주었으면 하는 일을 우리말로 먼저 말해 보세요.', '문 좀 열어 줄래? 도와줄 수 있으면 “물론이지”, 어렵다면 “미안해, 나도 짐을 들고 있어”라고 답할 수 있어요.', '문을 열어 주겠다는 친구에게 어떤 말을 덧붙이면 좋을까요?'],
      ['open → open the door → Can you please open the door? 맨 앞의 두 단어와 please가 보태는 뜻을 찾아보세요.', 'you는 듣는 사람이에요. 문을 열 사람은 누구인가요? please는 부탁을 부드럽게 해요.', 'Can you …?로 상대에게 행동을 부탁할 수 있어요. can 뒤의 행동은 opens가 아니라 open처럼 기본 모습으로 써요. please는 생략해도 돼요.', '문 대신 상자를 옮겨 달라고 해 보세요. carry this box를 넣으면 돼요.'],
      ['Can you open the window? / May I open the window? 창문을 열 사람은 각각 누구인가요? 부탁하는 사람과 행동하는 사람을 짚어 보세요.', 'you와 I에 손가락을 대고 각각 누구를 가리키는지 말해 보세요.', '첫 문장은 상대에게 창문을 열어 달라는 부탁이에요. 둘째는 내가 창문을 열어도 되는지 허락을 구해요. Can I …?로도 허락을 물을 수 있어요.', 'Can you swim?은 수영장에서 처음 만난 친구에게 어떤 능력이 있는지 묻는 말일 수도 있어요. 어떤 대답을 할까요?'],
      ['**Can you help me carry this bag?**\n가방을 들어 달라는 부탁을 받았어요. 지금 손이 비어 있다면 어떻게 답할까요? 곧 수업에 들어가야 한다면요?', '도와줄 수 있으면 “Sure.”로 시작해요. 어려우면 “I’m sorry, but …” 뒤에 사정을 말해 보세요.', '도와줄 때　**Sure. No problem.**\n거절할 때　**I’m sorry, but I can’t. I have class now.**\n두 번째 대답에서는 지금 도울 수 없는 이유까지 알려 줬어요.', '이번에는 자전거를 고쳐 달라고 부탁해 보세요. fix my bike를 써서 질문하고, 짝과 역할을 바꿔 보세요.'],
      ['실험실 규정에 보안경 착용이 필수예요. You (must / should) wear safety glasses. 어느 쪽이 규정의 뜻을 더 잘 전하나요?', 'must는 꼭 지켜야 할 일, should는 그렇게 하면 좋겠다는 조언에 써요.', 'You must wear safety glasses. 여기서는 반드시 지켜야 하는 규정이에요. 두 조동사 모두 뒤에 기본형 wear가 와요.', '지친 친구에게 쉬라고 조언할 때는 You (must / should) take a break.에서 어느 쪽이 더 어울릴까요?'],
      ['교실에서 도움이 필요한 장면을 하나 정해 짝에게 부탁하세요. 짝은 수락하거나 거절하고, 거절하면 이유도 전하세요.', '상황은 무거운 가방, 교실 문, 자전거 중에서 골라도 돼요. Can you please …?로 시작해 보세요.', 'Can you please carry this bag? / I’m sorry, but I can’t. My hands are full. 무엇을 해 달라는지와 도울 수 없는 이유가 이어지면 다른 답도 좋아요.', '다음 시간에는 표현을 가리고 “내가 해도 돼?”와 “네가 해 줄래?”를 각각 한 문장으로 말해 보세요.'],
    ],
  },
  'h-noun-clause': {
    goal: '확인된 소식과 아직 모르는 일을 구별해 전하기',
    stages: [
      ['축제 기사를 쓰고 있어요. 경기 결과는 확인했고, 주장이 인터뷰에 올지는 아직 몰라요. 두 내용을 우리말 한 문장씩으로 구분해 보세요.', '“알고 있다”와 “궁금하다”를 한 번씩 써 보세요.', '우리 팀이 이긴 것을 안다. / 주장이 올지 궁금하다. 어떤 내용을 전달하는지에 따라 영어에서도 다른 말을 골라요.', '친구에게 확인하고 싶은 소식 한 가지를 떠올려 보세요.'],
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
      ['동아리 지원서에 ‘하고 싶은 일’과 ‘이번 학기 목표’를 적어요. 둘 다 책을 쓰는 일이라면 우리말로 어떻게 답할까요?', '‘책’만 말하면 읽는지 쓰는지 알 수 있을까요? 행동까지 말해 보세요.', '책을 쓰고 싶어요. / 제 목표는 책 한 권을 쓰는 거예요. 두 답은 같은 행동을 이야기해요.', '두 답에서 ‘책을 쓰는 것’이 하는 일이 같은지 생각해 보세요.'],
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
  point.steps = stepsFor(point, sheet);
  const lesson = spotlight[point.id];
  if (lesson) {
    point.goal = lesson.goal;
    point.steps = lesson.stages.map(([prompt, hint, answer, followUp]) => ({ prompt, hint, answer, followUp }));
  }
}
fs.writeFileSync(catalogFile, JSON.stringify(catalog, null, 2) + '\n');
