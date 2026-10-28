/**
 * 문장 은행(2026-10-16) — 같은 상황이라도 레벨(유치·초등·중등·고등)마다 쓰는 문장이 다르도록 만든 공용 문장 모음.
 * 상황 12개 × 레벨 4개 × 8문장. 게임의 "문장 은행에서 담기"(SentenceBankPicker)가 읽는다.
 * **전부 Claude 초안(선생님 검수 전)** — 화면에 "초안"으로 표시한다. 문장은 `영어 | 우리말` 한 줄이다.
 * 레벨 기준: kinder = 유치~초1(낱말·아주 짧은 문장) / elem = 초등 2~6(교육부 800 안팎) / middle = 중등 / high = 고등(수능 어휘).
 */
import { PURPOSE_BANK } from './sentencePurposes';

export type BankLevel = 'kinder' | 'elem' | 'middle' | 'high';
export const BANK_LEVELS: BankLevel[] = ['kinder', 'elem', 'middle', 'high'];

export interface BankSituation {
  id: string;
  ko: string;
  en: string;
  theme: string;
  lines: Record<BankLevel, string[]>;
}

export const SENTENCE_BANK: BankSituation[] = [
  {
    id: 'intro',
    ko: '자기소개',
    en: 'Introducing myself',
    theme: 'people',
    lines: {
      kinder: [
        'Hello! | 안녕!',
        'I am Mina. | 나는 미나야.',
        'I am six. | 나는 여섯 살이야.',
        'I like dogs. | 나는 강아지를 좋아해.',
        'This is me. | 이게 나야.',
        'Nice to meet you. | 만나서 반가워.',
        'Me too! | 나도!',
        'Good bye! | 안녕, 잘 가!',
      ],
      elem: [
        'My name is Jiho. | 내 이름은 지호예요.',
        'I am ten years old. | 나는 열 살이에요.',
        'I live in Seoul. | 나는 서울에 살아요.',
        'I like playing soccer. | 나는 축구하는 것을 좋아해요.',
        'What is your name? | 이름이 뭐예요?',
        'Where are you from? | 어디에서 왔어요?',
        'I have two brothers. | 나는 남동생이 두 명 있어요.',
        'Nice to meet you, too. | 저도 만나서 반가워요.',
      ],
      middle: [
        'Let me introduce myself. | 제 소개를 할게요.',
        'I am interested in science and music. | 나는 과학과 음악에 관심이 있어요.',
        'My hobby is taking photos of animals. | 내 취미는 동물 사진을 찍는 거예요.',
        'I want to be a doctor when I grow up. | 나는 커서 의사가 되고 싶어요.',
        'People say that I am very shy. | 사람들은 내가 아주 수줍다고 말해요.',
        'I moved to this town last year. | 나는 작년에 이 마을로 이사 왔어요.',
        'I am good at drawing, but bad at sports. | 나는 그림은 잘 그리지만 운동은 못해요.',
        'I hope we can become good friends. | 우리가 좋은 친구가 되면 좋겠어요.',
      ],
      high: [
        'I would like to take this opportunity to introduce myself. | 이 기회에 제 소개를 하고 싶습니다.',
        'I am passionate about environmental issues. | 저는 환경 문제에 열정이 있습니다.',
        'Having lived abroad, I have a broad view of the world. | 해외에서 살아 본 덕분에 저는 세상을 넓게 봅니다.',
        'What motivates me most is helping others learn. | 저를 가장 움직이게 하는 것은 다른 사람의 배움을 돕는 일입니다.',
        'I consider myself a curious and responsible person. | 저는 스스로를 호기심 많고 책임감 있는 사람이라고 생각합니다.',
        'My goal is to become a researcher in robotics. | 제 목표는 로봇공학 연구자가 되는 것입니다.',
        'I have been volunteering at a children’s library for two years. | 저는 2년째 어린이 도서관에서 봉사하고 있습니다.',
        'I look forward to learning from all of you. | 여러분 모두에게 배우기를 기대합니다.',
      ],
    },
  },
  {
    id: 'food',
    ko: '음식 주문',
    en: 'Ordering food',
    theme: 'food',
    lines: {
      kinder: [
        'I want pizza. | 피자 주세요.',
        'Water, please. | 물 주세요.',
        'I am hungry. | 배고파요.',
        'It is yummy! | 맛있어요!',
        'More, please. | 더 주세요.',
        'Thank you. | 고맙습니다.',
        'No, thank you. | 아니요, 괜찮아요.',
        'I like apples. | 나는 사과를 좋아해요.',
      ],
      elem: [
        'Can I have a hamburger, please? | 햄버거 하나 주시겠어요?',
        'What would you like to drink? | 마실 것은 뭘로 드릴까요?',
        'I would like some orange juice. | 오렌지 주스를 주세요.',
        'How much is it? | 얼마예요?',
        'Is this for here or to go? | 여기서 드실 건가요, 가져가실 건가요?',
        'Can I get a large fries? | 큰 감자튀김 하나 주세요.',
        'Here is your order. | 주문하신 음식 나왔어요.',
        'The soup is very hot. | 수프가 아주 뜨거워요.',
      ],
      middle: [
        'I would like the chicken salad without onions. | 양파 빼고 치킨 샐러드로 주세요.',
        'Could we have a table for four, please? | 네 명 자리 있을까요?',
        'What do you recommend? | 뭘 추천하세요?',
        'I am allergic to peanuts, so please check the sauce. | 저는 땅콩 알레르기가 있어서 소스를 확인해 주세요.',
        'Can I pay by card? | 카드로 계산해도 되나요?',
        'The steak is a little overcooked. | 스테이크가 약간 너무 익었어요.',
        'We are ready to order now. | 이제 주문할게요.',
        'Could you bring us some more water? | 물을 좀 더 갖다 주시겠어요?',
      ],
      high: [
        'Could you recommend something that isn’t too spicy? | 너무 맵지 않은 메뉴를 추천해 주시겠어요?',
        'I’ll have the grilled salmon, and could I substitute the fries for a salad? | 구운 연어로 할게요. 감자튀김 대신 샐러드로 바꿔 주실 수 있나요?',
        'Would you mind splitting the bill between us? | 계산을 나눠서 해 주시겠어요?',
        'Is service included, or should we leave a tip? | 봉사료가 포함인가요, 아니면 팁을 남겨야 하나요?',
        'I’m afraid this isn’t what I ordered. | 죄송하지만 이건 제가 주문한 것이 아닌데요.',
        'The restaurant is known for its locally sourced ingredients. | 그 식당은 지역 재료로 유명해요.',
        'We’d like to reserve a table for six at seven o’clock. | 7시에 여섯 명 자리를 예약하고 싶습니다.',
        'Everything was delicious, and the service was outstanding. | 모두 맛있었고 서비스도 훌륭했어요.',
      ],
    },
  },
  {
    id: 'shopping',
    ko: '물건 사기',
    en: 'Shopping',
    theme: 'shopping',
    lines: {
      kinder: [
        'I want this. | 이거 주세요.',
        'How much? | 얼마예요?',
        'It is red. | 빨간색이에요.',
        'It is big. | 커요.',
        'It is small. | 작아요.',
        'I like it. | 마음에 들어요.',
        'Here you are. | 여기 있어요.',
        'Thank you! | 고맙습니다!',
      ],
      elem: [
        'How much is this T-shirt? | 이 티셔츠는 얼마예요?',
        'Do you have this in blue? | 이거 파란색 있어요?',
        'Can I try it on? | 입어 봐도 돼요?',
        'It is too big for me. | 저한테 너무 커요.',
        'I will take it. | 이걸로 할게요.',
        'It is on sale today. | 오늘 세일이에요.',
        'I need a new pair of shoes. | 새 신발이 필요해요.',
        'Here is your change. | 거스름돈 여기 있어요.',
      ],
      middle: [
        'I am looking for a jacket that goes with these jeans. | 이 청바지에 어울리는 재킷을 찾고 있어요.',
        'Do you have a smaller size in stock? | 더 작은 사이즈 재고가 있나요?',
        'This one is cheaper, but the quality is not as good. | 이게 더 싸지만 품질은 그만 못해요.',
        'Can I exchange it if it doesn’t fit? | 맞지 않으면 교환할 수 있나요?',
        'I am just looking around, thank you. | 그냥 둘러보는 중이에요, 고맙습니다.',
        'Could you give me a discount? | 좀 깎아 주실 수 있나요?',
        'I bought this online, but it was damaged. | 인터넷으로 샀는데 망가져 있었어요.',
        'I will pay in cash. | 현금으로 낼게요.',
      ],
      high: [
        'I’m torn between these two models, so could you tell me the difference? | 두 모델 사이에서 고민 중인데 차이점을 알려 주시겠어요?',
        'Is this item still covered by the warranty? | 이 제품은 아직 보증 기간인가요?',
        'I’d like a refund, since the product doesn’t match the description. | 제품이 설명과 달라서 환불을 받고 싶습니다.',
        'The price seems reasonable considering its durability. | 내구성을 생각하면 가격이 적당해 보여요.',
        'Not only is it affordable, but it is also environmentally friendly. | 가격이 알맞을 뿐만 아니라 친환경이기도 해요.',
        'Could you check whether you have it in another branch? | 다른 지점에 재고가 있는지 확인해 주시겠어요?',
        'I tend to compare prices before making a purchase. | 저는 구매하기 전에 가격을 비교하는 편이에요.',
        'Please keep the receipt in case you need to return it. | 반품하실 수 있으니 영수증을 보관해 주세요.',
      ],
    },
  },
  {
    id: 'direction',
    ko: '길 묻기',
    en: 'Asking directions',
    theme: 'town',
    lines: {
      kinder: [
        'Go straight. | 곧장 가요.',
        'Turn left. | 왼쪽으로 돌아요.',
        'Turn right. | 오른쪽으로 돌아요.',
        'Stop here. | 여기서 멈춰요.',
        'It is there. | 저기 있어요.',
        'It is near. | 가까워요.',
        'Where is the park? | 공원이 어디예요?',
        'Thank you! | 고맙습니다!',
      ],
      elem: [
        'Excuse me, where is the library? | 실례합니다, 도서관이 어디예요?',
        'Go straight and turn left. | 곧장 가서 왼쪽으로 도세요.',
        'It is next to the bank. | 은행 옆에 있어요.',
        'It is across from the school. | 학교 맞은편에 있어요.',
        'How can I get to the station? | 역에 어떻게 가나요?',
        'It takes five minutes on foot. | 걸어서 5분 걸려요.',
        'Take bus number 7. | 7번 버스를 타세요.',
        'You can’t miss it. | 금방 찾을 수 있을 거예요.',
      ],
      middle: [
        'Could you tell me how to get to the city hall? | 시청에 어떻게 가는지 알려 주시겠어요?',
        'Go down this street and turn right at the second corner. | 이 길을 따라가서 두 번째 모퉁이에서 오른쪽으로 도세요.',
        'You will see a large supermarket on your left. | 왼쪽에 큰 슈퍼마켓이 보일 거예요.',
        'Is there a pharmacy around here? | 이 근처에 약국이 있나요?',
        'It is about a ten-minute walk from here. | 여기서 걸어서 10분쯤 걸려요.',
        'I think I am lost. Could you help me? | 길을 잃은 것 같아요. 도와주시겠어요?',
        'Take the subway and get off at the third stop. | 지하철을 타고 세 번째 역에서 내리세요.',
        'You had better take a taxi because it is far. | 멀어서 택시를 타는 게 좋아요.',
      ],
      high: [
        'I’m trying to find the museum, but my phone’s map isn’t working. | 박물관을 찾고 있는데 휴대폰 지도가 작동하지 않아요.',
        'Keep walking until you reach the intersection, then head north. | 교차로가 나올 때까지 걸어가서 북쪽으로 가세요.',
        'The entrance is tucked away behind the old post office. | 입구는 오래된 우체국 뒤에 숨어 있어요.',
        'If you cross the bridge, you will have gone too far. | 다리를 건너면 너무 멀리 간 거예요.',
        'Is it within walking distance, or should I take public transportation? | 걸어갈 수 있는 거리인가요, 아니면 대중교통을 타야 하나요?',
        'The shortcut through the park will save you about fifteen minutes. | 공원을 가로지르는 지름길로 가면 15분쯤 아낄 수 있어요.',
        'Would you mind showing me the route on the map? | 지도에서 경로를 보여 주시겠어요?',
        'Thanks to your directions, I arrived on time. | 알려 주신 덕분에 제시간에 도착했어요.',
      ],
    },
  },
  {
    id: 'doctor',
    ko: '병원',
    en: 'At the doctor',
    theme: 'health',
    lines: {
      kinder: [
        'I am sick. | 나 아파요.',
        'My head hurts. | 머리가 아파요.',
        'My tooth hurts. | 이가 아파요.',
        'I have a cough. | 기침이 나요.',
        'I am tired. | 피곤해요.',
        'Take medicine. | 약을 먹어요.',
        'Get some rest. | 푹 쉬어요.',
        'Feel better! | 얼른 나아요!',
      ],
      elem: [
        'What is the problem? | 어디가 안 좋으세요?',
        'I have a stomachache. | 배가 아파요.',
        'I have a fever and a sore throat. | 열이 나고 목이 아파요.',
        'Open your mouth, please. | 입을 벌려 주세요.',
        'You should take this medicine. | 이 약을 드셔야 해요.',
        'Drink a lot of water. | 물을 많이 마셔요.',
        'You need to stay in bed. | 침대에서 쉬어야 해요.',
        'How long have you been sick? | 얼마나 아팠어요?',
      ],
      middle: [
        'I have had a headache since yesterday. | 어제부터 머리가 아파요.',
        'The doctor told me to get plenty of sleep. | 의사 선생님이 충분히 자라고 하셨어요.',
        'Does it hurt when I press here? | 여기를 누르면 아픈가요?',
        'I think I caught a cold from my brother. | 동생한테서 감기가 옮은 것 같아요.',
        'You should avoid cold food for a few days. | 며칠 동안은 찬 음식을 피하세요.',
        'Take this medicine three times a day after meals. | 이 약을 식후에 하루 세 번 드세요.',
        'I twisted my ankle while playing basketball. | 농구하다가 발목을 삐었어요.',
        'If you do not feel better, come back next week. | 나아지지 않으면 다음 주에 다시 오세요.',
      ],
      high: [
        'I’ve been suffering from insomnia, which has affected my concentration. | 불면증 때문에 집중력에 영향을 받고 있어요.',
        'The symptoms should subside within a few days if you take enough rest. | 충분히 쉬면 증상은 며칠 안에 가라앉을 거예요.',
        'I’m allergic to penicillin, so please prescribe something else. | 저는 페니실린 알레르기가 있으니 다른 약을 처방해 주세요.',
        'Regular exercise can reduce the risk of heart disease. | 규칙적인 운동은 심장병 위험을 줄일 수 있어요.',
        'You’d better get a thorough checkup as soon as possible. | 가능한 한 빨리 정밀 검진을 받는 게 좋아요.',
        'Stress is often a major cause of stomach problems. | 스트레스는 위장 문제의 주된 원인인 경우가 많아요.',
        'The side effects include drowsiness and dizziness. | 부작용으로 졸림과 어지러움이 있어요.',
        'Prevention is better than cure. | 예방이 치료보다 낫습니다.',
      ],
    },
  },
  {
    id: 'weather',
    ko: '날씨',
    en: 'Weather',
    theme: 'nature',
    lines: {
      kinder: [
        'It is sunny. | 맑아요.',
        'It is rainy. | 비가 와요.',
        'It is cloudy. | 흐려요.',
        'It is windy. | 바람이 불어요.',
        'It is hot. | 더워요.',
        'It is cold. | 추워요.',
        'I see a rainbow. | 무지개가 보여요.',
        'It is snowing! | 눈이 와요!',
      ],
      elem: [
        'How is the weather today? | 오늘 날씨가 어때요?',
        'It is going to rain this afternoon. | 오늘 오후에 비가 올 거예요.',
        'Take an umbrella with you. | 우산을 가지고 가세요.',
        'It was very hot yesterday. | 어제는 아주 더웠어요.',
        'I like snowy days. | 나는 눈 오는 날이 좋아요.',
        'The wind is strong today. | 오늘은 바람이 세요.',
        'It is warm and sunny in spring. | 봄에는 따뜻하고 맑아요.',
        'We can’t play outside because of the rain. | 비 때문에 밖에서 놀 수 없어요.',
      ],
      middle: [
        'According to the forecast, it will be cloudy tomorrow. | 일기예보에 따르면 내일은 흐릴 거예요.',
        'It has been raining for three days. | 사흘째 비가 오고 있어요.',
        'The temperature dropped suddenly last night. | 어젯밤에 기온이 갑자기 떨어졌어요.',
        'I hope it will clear up before the picnic. | 소풍 전에 날씨가 개면 좋겠어요.',
        'The typhoon is expected to hit the south coast. | 태풍이 남해안에 상륙할 것으로 예상돼요.',
        'It is so humid that I can hardly sleep. | 너무 습해서 잠을 잘 수가 없어요.',
        'Summers in Korea are hot and humid. | 한국의 여름은 덥고 습해요.',
        'Don’t forget to wear a coat because it is freezing. | 몹시 추우니 외투를 입는 걸 잊지 마세요.',
      ],
      high: [
        'Global warming is causing extreme weather around the world. | 지구 온난화가 전 세계에 이상 기후를 일으키고 있어요.',
        'The heavy rainfall led to flooding in several areas. | 폭우로 여러 지역이 침수되었어요.',
        'Had it not been for the storm, we would have arrived earlier. | 폭풍이 아니었다면 더 일찍 도착했을 거예요.',
        'Meteorologists predict that the cold wave will last until the weekend. | 기상학자들은 한파가 주말까지 이어질 것으로 예측해요.',
        'Fine dust levels are so high that outdoor activities are restricted. | 미세먼지 농도가 높아 야외 활동이 제한돼요.',
        'The sudden change in climate has affected local agriculture. | 갑작스러운 기후 변화가 지역 농업에 영향을 주었어요.',
        'Weather conditions permitting, the match will be held outdoors. | 날씨가 허락하면 경기는 야외에서 열려요.',
        'It is essential to prepare for natural disasters. | 자연재해에 대비하는 것은 필수적이에요.',
      ],
    },
  },
  {
    id: 'school',
    ko: '학교생활',
    en: 'School life',
    theme: 'school',
    lines: {
      kinder: [
        'Sit down. | 앉으세요.',
        'Stand up. | 일어나세요.',
        'Open your book. | 책을 펴요.',
        'Listen, please. | 잘 들어요.',
        'I have a pencil. | 연필이 있어요.',
        'Teacher, help me! | 선생님, 도와주세요!',
        'Line up. | 줄을 서요.',
        'Let’s play! | 놀자!',
      ],
      elem: [
        'What subject do you like? | 무슨 과목을 좋아해요?',
        'I have an English class at ten. | 10시에 영어 수업이 있어요.',
        'Please open your textbook to page ten. | 교과서 10쪽을 펴세요.',
        'I forgot my homework. | 숙제를 깜빡했어요.',
        'The bell is ringing. | 종이 울리고 있어요.',
        'We have lunch at twelve. | 우리는 12시에 점심을 먹어요.',
        'May I go to the bathroom? | 화장실에 가도 될까요?',
        'Who is absent today? | 오늘 누가 결석했어요?',
      ],
      middle: [
        'We have to hand in the report by Friday. | 금요일까지 보고서를 제출해야 해요.',
        'I am preparing for the midterm exam next week. | 다음 주 중간고사를 준비하고 있어요.',
        'Our class is going on a field trip tomorrow. | 우리 반은 내일 현장학습을 가요.',
        'Could you explain this problem again? | 이 문제를 다시 설명해 주시겠어요?',
        'I joined the school band last month. | 나는 지난달에 학교 밴드에 가입했어요.',
        'My favorite teacher always encourages us to ask questions. | 내가 좋아하는 선생님은 늘 질문하라고 격려해 주세요.',
        'The school festival will be held in October. | 학교 축제는 10월에 열려요.',
        'I stayed up late to finish my project. | 과제를 끝내려고 늦게까지 깨어 있었어요.',
      ],
      high: [
        'Balancing schoolwork and extracurricular activities is quite challenging. | 학업과 교내 활동을 병행하는 것은 꽤 어려워요.',
        'I’m planning to major in economics, so I’m taking advanced math courses. | 경제학을 전공할 계획이라 고급 수학 과목을 듣고 있어요.',
        'The deadline for the college application is approaching. | 대학 원서 마감일이 다가오고 있어요.',
        'Peer feedback helped me improve my presentation skills. | 친구들의 피드백이 발표 실력을 키우는 데 도움이 됐어요.',
        'Critical thinking is more important than memorizing facts. | 비판적 사고가 사실을 외우는 것보다 중요해요.',
        'Students are encouraged to take part in community service. | 학생들은 봉사 활동에 참여하도록 권장돼요.',
        'It took me a while to adapt to the new curriculum. | 새 교육과정에 적응하는 데 시간이 좀 걸렸어요.',
        'Not until the final exam did I realize the value of steady study. | 기말고사가 되어서야 꾸준한 공부의 가치를 깨달았어요.',
      ],
    },
  },
  {
    id: 'family',
    ko: '가족',
    en: 'Family',
    theme: 'people',
    lines: {
      kinder: [
        'This is my mom. | 이분은 우리 엄마예요.',
        'This is my dad. | 이분은 우리 아빠예요.',
        'I love you. | 사랑해요.',
        'I have a sister. | 나는 언니(누나)가 있어요.',
        'My baby brother is cute. | 내 남동생은 귀여워요.',
        'Grandma is kind. | 할머니는 친절해요.',
        'We eat together. | 우리는 같이 먹어요.',
        'We are a family. | 우리는 가족이에요.',
      ],
      elem: [
        'There are four people in my family. | 우리 가족은 네 명이에요.',
        'My father works at a bank. | 아버지는 은행에서 일하세요.',
        'My mother cooks very well. | 어머니는 요리를 아주 잘하세요.',
        'I have an older sister and a younger brother. | 나는 언니(누나)와 남동생이 있어요.',
        'My grandparents live in Busan. | 조부모님은 부산에 사세요.',
        'We go camping every summer. | 우리는 여름마다 캠핑을 가요.',
        'I help my mom with the dishes. | 나는 엄마가 설거지하시는 것을 도와요.',
        'My uncle is a police officer. | 삼촌은 경찰관이에요.',
      ],
      middle: [
        'My family is very close, and we have dinner together every night. | 우리 가족은 아주 가까워서 매일 저녁을 함께 먹어요.',
        'My older brother is studying to become an engineer. | 형(오빠)은 엔지니어가 되려고 공부하고 있어요.',
        'I take after my mother in many ways. | 나는 여러 면에서 어머니를 닮았어요.',
        'We argued about the TV, but we made up soon. | 텔레비전 때문에 다퉜지만 곧 화해했어요.',
        'My parents always support me no matter what. | 부모님은 무슨 일이 있어도 늘 나를 응원해 주세요.',
        'I was born in a small family of three. | 나는 세 식구의 작은 가정에서 태어났어요.',
        'Our family gets together on holidays. | 우리 가족은 명절에 모여요.',
        'I am responsible for taking care of our dog. | 나는 우리 강아지를 돌보는 책임이 있어요.',
      ],
      high: [
        'Growing up in a multicultural family taught me to respect differences. | 다문화 가정에서 자라며 차이를 존중하는 법을 배웠어요.',
        'My parents have always emphasized the importance of honesty. | 부모님은 늘 정직의 중요성을 강조하셨어요.',
        'The generation gap sometimes makes it hard to communicate. | 세대 차이로 대화가 어려울 때가 있어요.',
        'Despite their busy schedules, they make time for the family. | 바쁜 일정에도 불구하고 그들은 가족을 위해 시간을 내요.',
        'I owe everything I have achieved to my parents’ sacrifice. | 제가 이룬 모든 것은 부모님의 희생 덕분이에요.',
        'Taking care of aging grandparents is a shared responsibility. | 연로한 조부모님을 돌보는 것은 모두의 책임이에요.',
        'Nuclear families have become more common in modern society. | 현대 사회에서는 핵가족이 더 흔해졌어요.',
        'What matters most is that we stay connected as a family. | 가장 중요한 것은 가족으로서 계속 연결되어 있는 거예요.',
      ],
    },
  },
  {
    id: 'hobby',
    ko: '취미',
    en: 'Hobbies',
    theme: 'leisure',
    lines: {
      kinder: [
        'I like to draw. | 나는 그림 그리기를 좋아해요.',
        'I can sing. | 나는 노래할 수 있어요.',
        'I can dance. | 나는 춤출 수 있어요.',
        'I play ball. | 나는 공놀이를 해요.',
        'I read books. | 나는 책을 읽어요.',
        'I ride a bike. | 나는 자전거를 타요.',
        'It is fun! | 재미있어요!',
        'Let’s play together! | 같이 놀자!',
      ],
      elem: [
        'What do you do in your free time? | 쉬는 시간에 뭘 해요?',
        'My hobby is playing the piano. | 내 취미는 피아노 치기예요.',
        'I enjoy swimming in the summer. | 나는 여름에 수영하는 것을 즐겨요.',
        'I am good at taking pictures. | 나는 사진을 잘 찍어요.',
        'She likes collecting stamps. | 그녀는 우표 모으기를 좋아해요.',
        'We play badminton every weekend. | 우리는 주말마다 배드민턴을 쳐요.',
        'Can you play the guitar? | 기타 칠 줄 알아요?',
        'I watch cartoons after school. | 나는 방과 후에 만화를 봐요.',
      ],
      middle: [
        'I have been learning to play the violin for two years. | 나는 2년째 바이올린을 배우고 있어요.',
        'Reading mystery novels helps me relax after school. | 추리소설을 읽으면 방과 후에 긴장이 풀려요.',
        'I am planning to join a cooking club this semester. | 이번 학기에 요리 동아리에 가입할 계획이에요.',
        'My friend taught me how to make a short video. | 친구가 짧은 영상 만드는 법을 알려 줬어요.',
        'Hiking is not only good for health but also fun. | 등산은 건강에 좋을 뿐만 아니라 재미있어요.',
        'I spend too much time playing computer games. | 나는 컴퓨터 게임에 시간을 너무 많이 써요.',
        'If I have free time, I usually go to the movies. | 시간이 나면 보통 영화를 보러 가요.',
        'What sport are you most interested in? | 어떤 운동에 가장 관심이 있어요?',
      ],
      high: [
        'Pursuing a hobby is an effective way to relieve stress. | 취미 생활은 스트레스를 푸는 효과적인 방법이에요.',
        'I took up photography because I wanted to capture ordinary moments. | 평범한 순간을 담고 싶어서 사진을 시작했어요.',
        'Some people turn their hobbies into professional careers. | 어떤 사람들은 취미를 직업으로 삼아요.',
        'Having something to be passionate about gives my life direction. | 열정을 쏟을 무언가가 있다는 것이 내 삶에 방향을 줘요.',
        'Online communities allow enthusiasts to share their experiences. | 온라인 커뮤니티 덕분에 애호가들이 경험을 나눌 수 있어요.',
        'It took months of practice before I could play the piece flawlessly. | 그 곡을 완벽하게 연주하기까지 몇 달의 연습이 필요했어요.',
        'Rather than watching TV, I prefer to spend my evenings painting. | 텔레비전을 보기보다 저녁 시간에 그림 그리는 것을 선호해요.',
        'Engaging in creative activities can enhance mental well-being. | 창의적인 활동은 정신 건강을 높일 수 있어요.',
      ],
    },
  },
  {
    id: 'travel',
    ko: '여행·공항',
    en: 'Travel and airport',
    theme: 'travel',
    lines: {
      kinder: [
        'Let’s go! | 가자!',
        'I see a plane. | 비행기가 보여요.',
        'This is my bag. | 이건 내 가방이에요.',
        'Here is my ticket. | 여기 내 표가 있어요.',
        'I am happy. | 나는 기뻐요.',
        'Wait here. | 여기서 기다려요.',
        'Look at the sea! | 바다를 봐요!',
        'Good bye, plane! | 안녕, 비행기!',
      ],
      elem: [
        'May I see your passport, please? | 여권을 보여 주시겠어요?',
        'Where is gate number twelve? | 12번 탑승구가 어디예요?',
        'My flight leaves at nine o’clock. | 내 비행기는 9시에 떠나요.',
        'I would like a window seat. | 창가 자리로 주세요.',
        'We are going to Jeju Island this summer. | 우리는 이번 여름에 제주도에 가요.',
        'Please fasten your seat belt. | 안전벨트를 매 주세요.',
        'How long is the flight? | 비행시간이 얼마나 돼요?',
        'I packed my clothes in a suitcase. | 옷을 여행 가방에 쌌어요.',
      ],
      middle: [
        'I have to check in two hours before the flight. | 비행 두 시간 전에 탑승 수속을 해야 해요.',
        'Please take off your belt and put it in the tray. | 벨트를 풀어서 트레이에 올려 주세요.',
        'Our flight has been delayed because of the fog. | 안개 때문에 비행기가 지연되었어요.',
        'I forgot to exchange some money into dollars. | 달러로 환전하는 것을 깜빡했어요.',
        'We stayed at a small hotel near the beach. | 우리는 해변 근처의 작은 호텔에 묵었어요.',
        'It was my first time traveling abroad by myself. | 혼자 해외여행을 간 건 처음이었어요.',
        'Could you recommend some places to visit in Paris? | 파리에서 가 볼 만한 곳을 추천해 주시겠어요?',
        'Don’t forget to bring your charger and a map. | 충전기와 지도를 챙기는 것을 잊지 마세요.',
      ],
      high: [
        'Travelling broadens your horizons and deepens your understanding of other cultures. | 여행은 시야를 넓히고 다른 문화에 대한 이해를 깊게 해요.',
        'I’d like to confirm my reservation for the connecting flight to Singapore. | 싱가포르행 연결 항공편 예약을 확인하고 싶어요.',
        'Passengers are requested to proceed to the boarding gate immediately. | 승객 여러분은 즉시 탑승구로 이동해 주시기 바랍니다.',
        'Since the luggage was lost, I filed a complaint with the airline. | 짐을 분실해서 항공사에 항의서를 제출했어요.',
        'Sustainable tourism aims to minimize the impact on local communities. | 지속 가능한 관광은 지역 사회에 미치는 영향을 최소화하는 것을 목표로 해요.',
        'We got around the city by relying on public transportation. | 우리는 대중교통에 의존해 도시를 돌아다녔어요.',
        'I’d rather travel off the beaten path than visit crowded attractions. | 붐비는 관광지보다 외진 곳을 여행하고 싶어요.',
        'The trip turned out to be far more rewarding than I had expected. | 여행은 기대했던 것보다 훨씬 보람 있었어요.',
      ],
    },
  },
  {
    id: 'daily',
    ko: '하루 일과·시간',
    en: 'Daily routine and time',
    theme: 'daily',
    lines: {
      kinder: [
        'Good morning! | 좋은 아침!',
        'I wake up. | 나는 일어나요.',
        'I eat breakfast. | 나는 아침을 먹어요.',
        'I brush my teeth. | 나는 이를 닦아요.',
        'I go to school. | 나는 학교에 가요.',
        'I take a bath. | 나는 목욕을 해요.',
        'I go to bed. | 나는 잠자리에 들어요.',
        'Good night! | 잘 자요!',
      ],
      elem: [
        'I get up at seven o’clock. | 나는 7시에 일어나요.',
        'What time do you go to school? | 몇 시에 학교에 가요?',
        'I do my homework after dinner. | 나는 저녁 먹고 숙제를 해요.',
        'It is half past three. | 3시 반이에요.',
        'I watch TV for an hour. | 나는 한 시간 동안 텔레비전을 봐요.',
        'I always wash my hands before meals. | 나는 식사 전에 항상 손을 씻어요.',
        'We have English class on Mondays. | 우리는 월요일마다 영어 수업이 있어요.',
        'I go to bed at nine thirty. | 나는 9시 30분에 자요.',
      ],
      middle: [
        'I usually get up early to catch the school bus. | 나는 보통 스쿨버스를 타려고 일찍 일어나요.',
        'After school, I go to the academy and study until eight. | 방과 후에 학원에 가서 8시까지 공부해요.',
        'I try to exercise for thirty minutes every day. | 나는 매일 30분씩 운동하려고 해요.',
        'I was doing my homework when you called me. | 네가 전화했을 때 나는 숙제를 하고 있었어요.',
        'It takes me about twenty minutes to get to school. | 학교까지 가는 데 20분쯤 걸려요.',
        'I am always short of time in the morning. | 아침에는 늘 시간이 부족해요.',
        'On weekends, I sleep late and help with the housework. | 주말에는 늦잠을 자고 집안일을 도와요.',
        'I need to manage my time more wisely. | 시간을 더 현명하게 관리해야 해요.',
      ],
      high: [
        'Establishing a regular routine is essential for maintaining productivity. | 규칙적인 생활 습관을 세우는 것은 생산성을 유지하는 데 필수예요.',
        'I make it a rule to review what I have learned before going to bed. | 나는 자기 전에 배운 것을 복습하는 것을 규칙으로 삼아요.',
        'Procrastination is the biggest obstacle to managing time effectively. | 미루는 습관은 시간을 효율적으로 관리하는 데 가장 큰 장애물이에요.',
        'By the time I got home, it was already past midnight. | 집에 도착했을 때는 이미 자정이 넘었어요.',
        'Sleeping less than six hours can impair your concentration. | 6시간 미만으로 자면 집중력이 떨어질 수 있어요.',
        'I prioritize my tasks according to their urgency. | 나는 급한 정도에 따라 일의 우선순위를 정해요.',
        'Balancing study and rest is the key to long-term success. | 공부와 휴식의 균형이 장기적인 성공의 열쇠예요.',
        'I plan to wake up an hour earlier in order to read the news. | 뉴스를 읽으려고 한 시간 일찍 일어날 계획이에요.',
      ],
    },
  },
  {
    id: 'feeling',
    ko: '기분·감정',
    en: 'Feelings',
    theme: 'feelings',
    lines: {
      kinder: [
        'I am happy. | 나는 행복해요.',
        'I am sad. | 나는 슬퍼요.',
        'I am angry. | 나는 화가 나요.',
        'I am scared. | 나는 무서워요.',
        'I am sleepy. | 나는 졸려요.',
        'I am excited! | 나는 신나요!',
        'Are you okay? | 괜찮아요?',
        'Don’t cry. | 울지 마요.',
      ],
      elem: [
        'How do you feel today? | 오늘 기분이 어때요?',
        'I feel great because it is my birthday. | 내 생일이라서 기분이 아주 좋아요.',
        'She looks worried about the test. | 그녀는 시험을 걱정하는 것 같아요.',
        'I was nervous before the speech. | 발표 전에 긴장했어요.',
        'Why are you so angry? | 왜 그렇게 화가 났어요?',
        'He is proud of his drawing. | 그는 자기 그림을 자랑스러워해요.',
        'I feel lonely without my friends. | 친구들이 없으니 외로워요.',
        'Cheer up! Everything will be fine. | 힘내요! 다 잘될 거예요.',
      ],
      middle: [
        'I was so embarrassed that my face turned red. | 너무 창피해서 얼굴이 빨개졌어요.',
        'He seems disappointed because he lost the game. | 그는 경기에서 져서 실망한 것 같아요.',
        'I felt relieved when I heard the good news. | 좋은 소식을 듣고 안도했어요.',
        'It makes me upset when people ignore me. | 사람들이 나를 무시하면 속상해요.',
        'Talking to a friend helps me feel better. | 친구와 이야기하면 기분이 나아져요.',
        'I am looking forward to the school trip. | 수학여행이 기대돼요.',
        'You don’t have to be afraid of making mistakes. | 실수를 두려워할 필요 없어요.',
        'I was touched by her kind letter. | 그녀의 다정한 편지에 감동받았어요.',
      ],
      high: [
        'Expressing your emotions honestly is vital for healthy relationships. | 감정을 솔직하게 표현하는 것은 건강한 관계에 필수적이에요.',
        'I was overwhelmed with anxiety just before the entrance exam. | 입학시험 직전에는 불안감에 압도됐어요.',
        'What frustrates me is that my efforts go unnoticed. | 내 노력이 알아주는 사람이 없다는 점이 나를 답답하게 해요.',
        'She tried to conceal her disappointment behind a smile. | 그녀는 미소 뒤에 실망감을 감추려 했어요.',
        'Gratitude can transform the way we perceive difficulties. | 감사하는 마음은 어려움을 보는 방식을 바꿀 수 있어요.',
        'Rather than suppressing stress, it is better to deal with it constructively. | 스트레스를 억누르기보다 건설적으로 다루는 편이 나아요.',
        'I could hardly contain my excitement when I got the results. | 결과를 받았을 때 설렘을 거의 감출 수 없었어요.',
        'Empathy is the ability to understand what others are going through. | 공감은 다른 사람이 겪는 일을 이해하는 능력이에요.',
      ],
    },
  },
];

export interface BankSentence {
  en: string;
  ko: string;
  level: BankLevel;
  situation: string;
}

/** 상황·레벨에 맞는 문장 목록 */
export function bankSentences(situationId: string | null, level: BankLevel | null): BankSentence[] {
  const out: BankSentence[] = [];
  // 'p:' 로 시작하는 id 는 말하기 목적별 모음(sentencePurposes.ts)
  const bank = situationId?.startsWith('p:') ? PURPOSE_BANK : SENTENCE_BANK;
  for (const s of bank) {
    if (situationId && s.id !== situationId) continue;
    for (const lv of BANK_LEVELS) {
      if (level && lv !== level) continue;
      for (const raw of s.lines[lv]) {
        const cut = raw.indexOf(' | ');
        out.push({ en: cut >= 0 ? raw.slice(0, cut) : raw, ko: cut >= 0 ? raw.slice(cut + 3) : '', level: lv, situation: s.id });
      }
    }
  }
  return out;
}

/** 문장 패턴: 처음 두 낱말("I like", "Can you", "What is"). 같은 패턴을 반복 연습하려고 모아 볼 때 쓴다. */
export function sentencePattern(en: string): string {
  const words = en.replace(/[.?!,]/g, '').trim().split(/\s+/).slice(0, 2);
  if (words.length < 2) return '';
  return words.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w.toLowerCase().replace(/^i$/, 'I'))).join(' ');
}

/** 상황 은행 + 목적 모음 전체의 문장(레벨 하나) — 패턴으로 모아 볼 때 쓴다 */
export function allBankSentences(level: BankLevel): BankSentence[] {
  const out: BankSentence[] = [];
  for (const bank of [SENTENCE_BANK, PURPOSE_BANK]) {
    for (const s of bank) {
      for (const raw of s.lines[level]) {
        const cut = raw.indexOf(' | ');
        out.push({ en: cut >= 0 ? raw.slice(0, cut) : raw, ko: cut >= 0 ? raw.slice(cut + 3) : '', level, situation: s.id });
      }
    }
  }
  return out;
}

/** 레벨 안에서 3문장 이상 나오는 패턴(많은 순) */
export function commonPatterns(level: BankLevel, limit = 24): [string, number][] {
  const count = new Map<string, number>();
  for (const s of allBankSentences(level)) {
    const p = sentencePattern(s.en);
    if (p) count.set(p, (count.get(p) ?? 0) + 1);
  }
  return [...count.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, limit);
}
