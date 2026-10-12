import { newCanvasSlide, newTextElement, themeTextDefaults } from '../components/CanvasSlideEditor';
import { grammarPoint } from './grammar';
import type { LessonLevel } from './lessonLevel';
import type { RecipeContext } from './lessonRecipes';
import type { FullCardItem, LessonSlide } from './types';
import { buildVideoLessonParts } from './videoLesson';
import { loadWordBank } from './wordBankCache';

/**
 * 팝송 수업 컬렉션(2026-10-12, 사용자 제안 "노래를 미리 골라 수업을 만들어 둔다").
 * **가사는 담지 않는다** — 곡마다 우리가 쓴 소개·핵심 단어·문법·예문·활동만 있고, 가사는 공식 영상과 정식 가사 제공처
 * (검색 링크)로 안내한다. 선생님이 가사를 붙여 넣으면 그 수업 안에서만 빈칸 듣기·문장 배열이 더해진다(저장·공유 안 함).
 * 곡 선정 기준: 가사가 깨끗하고 발음이 명확하고, 문법·주제로 수업을 만들기 쉬운 곡(British Council 노래 수업 가이드).
 * 모든 곡은 `draft: true` — 선생님(또는 가사 확인) 검수 전 초안이다. 영상 링크는 공식 채널만(oEmbed로 확인했다).
 */
export interface SongWord {
  word: string;
  meaning: string;
  pos: string;
  /** 우리가 쓴 예문(가사가 아니다) */
  example: string;
  exampleKo: string;
}

export interface SongTags {
  /** 가사가 깨끗한가(욕설·선정적 표현 없음) */
  lyrics: boolean;
  /** 공식 영상이 학생과 보기에 적합한가 */
  video: boolean;
  /** 초등부에서 쓸 수 있는가 */
  elementary: boolean;
  /** 미리 알려야 할 점 */
  caution?: string;
}

export interface SongLesson {
  id: string;
  title: string;
  artist: string;
  levels: LessonLevel[];
  levelNote: string;
  themes: string[];
  /** 우리가 쓴 노래 소개 */
  intro: string;
  /** 공식 영상(유튜브 id) — 없으면 선생님이 직접 연결 */
  videoId: string | null;
  videoNote?: string;
  /** 정식 가사 제공처 검색에 쓸 말 */
  lyricsQuery: string;
  grammarIds: string[];
  points: string[];
  words: SongWord[];
  warmup: { en: string; ko: string }[];
  comprehension: { q: string; a: string; qKo: string; aKo: string }[];
  /** 문장 배열하기·말하기에 쓸 우리가 쓴 문장(3~8낱말) */
  sentences: string[];
  activity: { title: string; frame: string; prompt: string };
  tags: SongTags;
  draft: true;
}

export const SONG_LESSONS: SongLesson[] = [
  {
    id: 'count-on-me',
    title: 'Count on Me',
    artist: 'Bruno Mars',
    levels: ['elementary', 'middle'],
    levelNote: '초등 고학년 ~ 중1',
    themes: ['우정', '도움'],
    intro: '힘들 때 곁에서 도와주겠다고 약속하는 우정 노래예요. "~하면 ~할게"라는 조건과 약속(if + 현재형, will)을 자연스럽게 반복해 말해 볼 수 있어요.',
    videoId: '6k8cpUkKK4c',
    videoNote: '공식 가사 영상(Lyric Video)이라 화면에 가사가 같이 나와요.',
    lyricsQuery: 'Bruno Mars Count on Me',
    grammarIds: ['m-if-conditional', 'future', 'i-can'],
    points: ['if + 현재형, will ~', 'can', 'count on / be there for', '구동사'],
    words: [
      { word: 'count on', meaning: '~에게 의지하다, ~를 믿다', pos: '숙어', example: 'You can count on me.', exampleKo: '나를 믿어도 돼.' },
      { word: 'be there for', meaning: '~의 곁에 있어 주다', pos: '숙어', example: 'I will be there for you.', exampleKo: '내가 네 곁에 있어 줄게.' },
      { word: 'in need', meaning: '어려움에 처한', pos: '형용사구', example: 'We help friends in need.', exampleKo: '우리는 어려운 친구를 도와요.' },
      { word: 'guide', meaning: '안내하다, 이끌다', pos: '동사', example: 'A light can guide the ship.', exampleKo: '불빛이 배를 이끌어 줄 수 있어요.' },
      { word: 'lost', meaning: '길을 잃은', pos: '형용사', example: 'I was lost in the park.', exampleKo: '나는 공원에서 길을 잃었어요.' },
      { word: 'sail', meaning: '항해하다', pos: '동사', example: 'We sail across the sea.', exampleKo: '우리는 바다를 가로질러 항해해요.' },
    ],
    warmup: [
      { en: 'What do good friends do for each other?', ko: '좋은 친구는 서로에게 무엇을 해 줄까요?' },
      { en: 'When did a friend help you?', ko: '친구가 나를 도와준 적이 언제였나요?' },
    ],
    comprehension: [
      { q: 'What is the song mostly about?', a: 'Helping and supporting a friend.', qKo: '이 노래는 무엇에 관한 노래일까요?', aKo: '친구를 돕고 곁에 있어 주는 것' },
      { q: 'What does the singer promise?', a: 'To be there when the friend needs help.', qKo: '노래하는 사람은 무엇을 약속하나요?', aKo: '친구가 도움이 필요할 때 곁에 있겠다는 것' },
    ],
    sentences: ['I will help you if you need me.', 'If you call me, I will come.', 'A good friend is always there for you.', 'You can count on your friends.'],
    activity: {
      title: '친구를 도울 수 있는 상황 쓰기',
      frame: 'If you ___, I will ___.',
      prompt: '친구가 힘들어하는 상황을 하나 정하고, 내가 해 줄 수 있는 일을 If 문장으로 3개 써 보세요.',
    },
    tags: { lyrics: true, video: true, elementary: true },
    draft: true,
  },
  {
    id: 'try-everything',
    title: 'Try Everything',
    artist: 'Shakira',
    levels: ['elementary', 'middle'],
    levelNote: '초6 ~ 중2',
    themes: ['도전', '실패를 이겨내기'],
    intro: '실패해도 다시 시도하자고 응원하는 노래예요. 지난 실수(과거)와 앞으로의 다짐(will)을 번갈아 말하고, 반대되는 상황을 이어 주는 even though를 배우기 좋아요.',
    videoId: 'c6rP-YP4c5I',
    lyricsQuery: 'Shakira Try Everything',
    grammarIds: ['m-because-although', 'future', 'past-regular'],
    points: ['even though ~', 'will (다짐)', '과거와 현재', 'give up / give in'],
    words: [
      { word: 'give up', meaning: '포기하다', pos: '숙어', example: 'Never give up on your dream.', exampleKo: '꿈을 절대 포기하지 마.' },
      { word: 'give in', meaning: '굴복하다, 항복하다', pos: '숙어', example: 'I will not give in to fear.', exampleKo: '나는 두려움에 굴복하지 않을 거야.' },
      { word: 'mistake', meaning: '실수', pos: '명사', example: 'Everyone makes mistakes.', exampleKo: '누구나 실수를 해요.' },
      { word: 'fall', meaning: '넘어지다, 실패하다', pos: '동사', example: 'I fell, but I got up.', exampleKo: '넘어졌지만 다시 일어났어요.' },
      { word: 'reach', meaning: '~에 닿다, 도달하다', pos: '동사', example: 'We reached the top of the hill.', exampleKo: '우리는 언덕 꼭대기에 닿았어요.' },
      { word: 'even though', meaning: '비록 ~이지만', pos: '접속사', example: 'Even though it was hard, I tried.', exampleKo: '어려웠지만 나는 해 봤어요.' },
    ],
    warmup: [
      { en: 'What was hard for you, but you tried again?', ko: '어려웠지만 다시 해 본 일이 있나요?' },
      { en: 'Why is it good to make mistakes?', ko: '실수를 하면 왜 좋을까요?' },
    ],
    comprehension: [
      { q: 'What is the message of the song?', a: "Don't be afraid to fail. Keep trying.", qKo: '이 노래의 메시지는 무엇일까요?', aKo: '실패를 두려워하지 말고 계속 도전하자' },
      { q: 'What does the singer say about mistakes?', a: 'We can learn from them.', qKo: '실수에 대해 어떻게 말하나요?', aKo: '실수에서 배울 수 있다' },
    ],
    sentences: ['I will try again tomorrow.', 'Even though I fell, I got up.', 'Never give up on your dream.', 'We can learn from our mistakes.'],
    activity: {
      title: '실패했던 경험과 다시 도전한 일 쓰기',
      frame: 'Even though I ___, I ___.',
      prompt: '어렵거나 실패했던 일을 하나 정하고, 어떻게 다시 도전했는지 Even though 문장으로 써 보세요.',
    },
    tags: { lyrics: true, video: true, elementary: true },
    draft: true,
  },
  {
    id: 'what-a-wonderful-world',
    title: 'What a Wonderful World',
    artist: 'Louis Armstrong',
    levels: ['elementary'],
    levelNote: '초등 고학년',
    themes: ['자연', '감사'],
    intro: '주변의 아름다운 것들을 하나씩 보며 세상에 감사하는 천천히 부르는 노래예요. 색깔·자연 낱말과 "I see ~ / I hear ~"를 쓰기 좋아요.',
    videoId: 'rBrd_3VMC3c',
    lyricsQuery: 'Louis Armstrong What a Wonderful World',
    grammarIds: ['adj-noun', 'm-perception', 'm-exclamation'],
    points: ['I see ~ / I hear ~', '색깔·자연 형용사', 'What a ~! 감탄문', '현재시제'],
    words: [
      { word: 'rainbow', meaning: '무지개', pos: '명사', example: 'I see a rainbow after the rain.', exampleKo: '비가 온 뒤에 무지개가 보여요.' },
      { word: 'cloud', meaning: '구름', pos: '명사', example: 'The clouds are white and soft.', exampleKo: '구름이 하얗고 부드러워요.' },
      { word: 'bloom', meaning: '꽃이 피다', pos: '동사', example: 'Flowers bloom in spring.', exampleKo: '봄에는 꽃이 피어요.' },
      { word: 'bright', meaning: '밝은, 환한', pos: '형용사', example: 'The sun is bright today.', exampleKo: '오늘은 해가 밝아요.' },
      { word: 'grow', meaning: '자라다', pos: '동사', example: 'Trees grow slowly.', exampleKo: '나무는 천천히 자라요.' },
      { word: 'sky', meaning: '하늘', pos: '명사', example: 'The sky is blue.', exampleKo: '하늘은 파래요.' },
    ],
    warmup: [
      { en: 'What beautiful things can you see outside?', ko: '밖에서 어떤 아름다운 것들이 보이나요?' },
      { en: 'What sounds do you like to hear?', ko: '어떤 소리를 듣는 걸 좋아하나요?' },
    ],
    comprehension: [
      { q: 'How does the singer feel about the world?', a: 'He thinks it is wonderful.', qKo: '노래하는 사람은 세상을 어떻게 느끼나요?', aKo: '멋지다고 생각한다' },
      { q: 'Does the singer see only big things?', a: 'No. He also sees small, everyday things.', qKo: '큰 것만 보나요?', aKo: '아니요, 작고 일상적인 것도 본다' },
    ],
    sentences: ['I see green trees and red roses.', 'The sky is blue and white.', 'I hear a baby laugh.', 'What a beautiful day!'],
    activity: {
      title: '내가 보는 아름다운 것 쓰기',
      frame: 'I see ___ and ___. I hear ___.',
      prompt: '오늘 학교 가는 길에서 보고 들은 것을 I see / I hear 문장으로 써 보세요.',
    },
    tags: { lyrics: true, video: true, elementary: true },
    draft: true,
  },
  {
    id: 'as-long-as-you-love-me',
    title: 'As Long As You Love Me',
    artist: 'Backstreet Boys',
    levels: ['middle', 'high'],
    levelNote: '중1 ~ 중3',
    themes: ['사랑', '있는 그대로의 수용'],
    intro: '상대의 과거나 배경이 아니라 지금의 진심이 중요하다고 말하는 노래예요. 조건을 거는 as long as와, 의문사가 문장 중간에 들어가는 간접의문문(who you are, where you are from, what you did)을 반복해서 익히기에 좋아요.',
    videoId: '0Gl2QnHNpkA',
    videoNote: '1990년대 뮤직비디오라 연애 장면이 나와요. 초등부는 음원이나 가사 영상으로 쓰는 편이 좋아요.',
    lyricsQuery: 'Backstreet Boys As Long As You Love Me',
    grammarIds: ['as-long-as', 'm-indirect-question', 'm-present-perfect', 'm-because-although'],
    points: ['as long as ~', 'who / where / what + 주어 + 동사', 'although', 'has been (현재완료)', 'on the run · meant to be'],
    words: [
      { word: 'care', meaning: '신경 쓰다, 상관하다', pos: '동사', example: "I don't care what you wear.", exampleKo: '네가 뭘 입든 난 상관없어.' },
      { word: 'matter', meaning: '중요하다', pos: '동사', example: 'It does not matter who wins.', exampleKo: '누가 이기든 중요하지 않아.' },
      { word: 'glance', meaning: '흘끗 봄', pos: '명사', example: 'I knew the answer at a glance.', exampleKo: '나는 한눈에 답을 알았어.' },
      { word: 'mystery', meaning: '수수께끼, 미스터리', pos: '명사', example: 'The empty box is a mystery.', exampleKo: '빈 상자는 수수께끼야.' },
      { word: 'hide', meaning: '숨기다', pos: '동사', example: 'He tried to hide his smile.', exampleKo: '그는 웃음을 숨기려고 했어.' },
      { word: 'on the run', meaning: '도망 중인, 쫓기는', pos: '숙어', example: 'The fox is on the run.', exampleKo: '여우가 도망치는 중이야.' },
      { word: 'meant to be', meaning: '운명인, 그렇게 될 운명인', pos: '숙어', example: 'We were meant to be friends.', exampleKo: '우리는 친구가 될 운명이었어.' },
      { word: 'a friend of mine', meaning: '내 친구 중 한 명', pos: '표현', example: 'Jim is a friend of mine.', exampleKo: '짐은 내 친구 중 한 명이야.' },
    ],
    warmup: [
      { en: 'Is a friend’s past important to you? Why or why not?', ko: '친구의 과거가 중요한가요? 왜 그런가요?' },
      { en: 'What matters more: who you were or who you are now?', ko: '과거의 나와 지금의 나 중 무엇이 더 중요할까요?' },
    ],
    comprehension: [
      { q: 'What is the main theme of the song?', a: 'Accepting someone as they are.', qKo: '이 노래의 핵심 주제는 무엇일까요?', aKo: '상대를 있는 그대로 받아들이는 것' },
      { q: 'What is the condition in the song?', a: 'The other person loves the singer.', qKo: '노래에서 걸고 있는 조건은 무엇인가요?', aKo: '상대가 나를 사랑해 주는 것' },
    ],
    sentences: ["I don't care what you wear.", 'Tell me where you live.', 'Stay as long as you are quiet.', 'I know who broke the window.'],
    activity: {
      title: '질문과 명사절 문장 바꾸기',
      frame: 'I don’t care ___ ___ ___. / Tell me ___ ___ ___.',
      prompt: 'Who are you? → I don’t care who you are. 처럼 질문 3개를 간접의문문 문장으로 바꿔 써 보세요.',
    },
    tags: {
      lyrics: true,
      video: false,
      elementary: false,
      caution: '가사 가운데 선정적으로 읽힐 수 있는 낱말이 있다는 의견이 있어요. 수업 전에 가사를 직접 확인하고, 해당 부분을 제외한 구간을 쓰세요.',
    },
    draft: true,
  },
  {
    id: 'one-call-away',
    title: 'One Call Away',
    artist: 'Charlie Puth',
    levels: ['middle'],
    levelNote: '중1 ~ 중2',
    themes: ['도움', '응원'],
    intro: '"전화 한 통이면 달려갈게"라고 말하는 응원 노래예요. will·can·명령문으로 약속과 위로의 말을 만들어 보기 좋아요.',
    videoId: 'BxuY9FET9Y4',
    lyricsQuery: 'Charlie Puth One Call Away',
    grammarIds: ['future', 'i-can', 'imperative'],
    points: ['will (약속)', 'can', '명령문 / 부정 명령문', '거리 표현 (away)'],
    words: [
      { word: 'one call away', meaning: '전화 한 통이면 닿는', pos: '표현', example: 'My best friend is one call away.', exampleKo: '내 단짝 친구는 전화 한 통이면 와.' },
      { word: 'save the day', meaning: '위기를 해결하다', pos: '숙어', example: 'Her idea saved the day.', exampleKo: '그녀의 아이디어가 위기를 해결했어.' },
      { word: 'be scared', meaning: '무서워하다', pos: '동사구', example: "Don't be scared of the dark.", exampleKo: '어둠을 무서워하지 마.' },
      { word: 'set free', meaning: '풀어 주다, 자유롭게 하다', pos: '동사구', example: 'We set the bird free.', exampleKo: '우리는 새를 풀어 주었어.' },
      { word: 'have faith', meaning: '믿음을 갖다', pos: '동사구', example: 'Please have faith in yourself.', exampleKo: '네 자신을 믿어 봐.' },
      { word: 'for a while', meaning: '잠시 동안', pos: '숙어', example: 'Let’s rest for a while.', exampleKo: '잠시 쉬자.' },
    ],
    warmup: [
      { en: 'Who do you call when you feel sad?', ko: '슬플 때 누구에게 전화하나요?' },
      { en: 'What can you say to cheer up a friend?', ko: '친구를 응원하려면 어떤 말을 할 수 있을까요?' },
    ],
    comprehension: [
      { q: 'What does the singer offer?', a: 'Help whenever you call.', qKo: '노래하는 사람은 무엇을 해 주겠다고 하나요?', aKo: '전화하면 언제든 도와주겠다는 것' },
      { q: 'How do you think the listener feels?', a: 'Safe and supported.', qKo: '듣는 사람은 어떤 기분일까요?', aKo: '안심되고 힘이 난다' },
    ],
    sentences: ['My best friend is one call away.', "Don't be scared of mistakes.", 'Call me if you need help.', 'I will be there in a minute.'],
    activity: {
      title: '위로 메시지 작성하기',
      frame: "Don't ___. I will ___. You can ___.",
      prompt: '힘들어하는 친구에게 보낼 응원 메시지를 명령문·will·can을 모두 써서 써 보세요.',
    },
    tags: { lyrics: true, video: true, elementary: false },
    draft: true,
  },
  {
    id: 'roar',
    title: 'Roar',
    artist: 'Katy Perry',
    levels: ['middle', 'high'],
    levelNote: '중1 ~ 중3',
    themes: ['자신감', '성장'],
    intro: '움츠러들던 내가 목소리를 내고 당당해지는 성장 노래예요. "예전엔 ~했지만 지금은 ~해"로 과거의 나와 현재의 나를 비교하는 used to를 배우기 좋아요.',
    videoId: 'CevxZvSJLk8',
    videoNote: '저학년은 공식 뮤직비디오보다 음원이나 가사 영상을 쓰는 편이 안전해요.',
    lyricsQuery: 'Katy Perry Roar',
    grammarIds: ['used-to', 'm-past', 'future'],
    points: ['used to + 동사원형', '과거와 현재 비교', 'gonna (구어체)', '관용 표현'],
    words: [
      { word: 'roar', meaning: '으르렁거리다, 포효하다', pos: '동사', example: 'The lion began to roar.', exampleKo: '사자가 으르렁거리기 시작했어.' },
      { word: 'champion', meaning: '챔피언, 우승자', pos: '명사', example: 'She is the swimming champion.', exampleKo: '그녀는 수영 챔피언이야.' },
      { word: 'fighter', meaning: '싸우는 사람, 투사', pos: '명사', example: 'He is a fighter, not a quitter.', exampleKo: '그는 포기하지 않는 사람이야.' },
      { word: 'used to', meaning: '~하곤 했다, 예전에는 ~였다', pos: '조동사구', example: 'I used to be shy.', exampleKo: '나는 예전에 수줍음이 많았어.' },
      { word: 'hold one’s breath', meaning: '숨을 참다', pos: '숙어', example: 'Hold your breath and dive.', exampleKo: '숨을 참고 잠수해 봐.' },
      { word: 'rock the boat', meaning: '분란을 일으키다', pos: '숙어', example: "Don't rock the boat before the test.", exampleKo: '시험 전에 분란을 일으키지 마.' },
    ],
    warmup: [
      { en: 'What did you use to be afraid of?', ko: '예전에 무서워하던 것이 있나요?' },
      { en: 'When do you feel strong and confident?', ko: '언제 당당하고 자신 있다고 느끼나요?' },
    ],
    comprehension: [
      { q: 'How did the singer feel in the past?', a: 'Quiet and afraid to speak.', qKo: '예전에는 어떤 마음이었나요?', aKo: '조용하고 말하기를 두려워했다' },
      { q: 'How does the singer feel now?', a: 'Strong and confident.', qKo: '지금은 어떤가요?', aKo: '강하고 자신감이 있다' },
    ],
    sentences: ['I used to be shy.', 'Now I speak in front of people.', 'She used to hold her breath.', 'You are a champion now.'],
    activity: {
      title: '과거의 나와 현재의 나 비교하기',
      frame: 'I used to ___, but now I ___.',
      prompt: '예전과 달라진 점 3가지를 used to 문장으로 써서 발표해 보세요.',
    },
    tags: {
      lyrics: true,
      video: false,
      elementary: false,
      caution: '공식 뮤직비디오의 장면이 저학년에는 맞지 않을 수 있어요. 음원이나 가사 영상을 권해요.',
    },
    draft: true,
  },
  {
    id: 'a-million-dreams',
    title: 'A Million Dreams',
    artist: 'The Greatest Showman',
    levels: ['middle', 'high'],
    levelNote: '중1 ~ 중3',
    themes: ['꿈', '상상'],
    intro: '아이의 눈으로 꿈꾸는 세상을 그려 보는 노래예요. "만약 ~라면(what if), ~할 수 있을 텐데(could)"로 상상을 표현하고, 내가 만들고 싶은 세상을 관계절로 설명해 보기 좋아요.',
    videoId: null,
    videoNote: '이 곡의 영화사는 디즈니 계열이라 영상 라이브러리 원칙에 따라 영상을 연결해 두지 않았어요. 공식 음원·영상은 선생님이 직접 연결해 주세요.',
    lyricsQuery: 'The Greatest Showman A Million Dreams',
    grammarIds: ['m-modals', 'm-subjunctive', 'm-relative-object'],
    points: ['could', 'what if ~', '관계절 (the world we make)', '상상의 표현'],
    words: [
      { word: 'imagination', meaning: '상상력', pos: '명사', example: 'Use your imagination.', exampleKo: '상상력을 써 봐.' },
      { word: 'dream', meaning: '꿈, 꿈꾸다', pos: '명사/동사', example: 'I dream of a big garden.', exampleKo: '나는 큰 정원을 꿈꿔요.' },
      { word: 'vision', meaning: '미래의 모습, 비전', pos: '명사', example: 'She has a vision for the future.', exampleKo: '그녀는 미래에 대한 비전이 있어요.' },
      { word: 'what if', meaning: '~라면 어떨까', pos: '표현', example: 'What if we had a school on the moon?', exampleKo: '달에 학교가 있다면 어떨까?' },
      { word: 'fill', meaning: '채우다', pos: '동사', example: 'Bright colors fill my room.', exampleKo: '밝은 색이 내 방을 채워요.' },
      { word: 'could', meaning: '~할 수 있을 텐데', pos: '조동사', example: 'We could build a new world.', exampleKo: '우리는 새 세상을 만들 수 있을 거야.' },
    ],
    warmup: [
      { en: 'What does your dream world look like?', ko: '내가 꿈꾸는 세상은 어떤 모습인가요?' },
      { en: 'What would you build if you could?', ko: '할 수 있다면 무엇을 만들고 싶나요?' },
    ],
    comprehension: [
      { q: 'What is the song about?', a: 'Dreaming and imagining a better world.', qKo: '이 노래는 무엇에 관한 노래일까요?', aKo: '더 나은 세상을 꿈꾸고 상상하는 것' },
      { q: 'Why is imagination important?', a: 'It helps us create new things.', qKo: '상상력이 왜 중요할까요?', aKo: '새로운 것을 만들게 해 준다' },
    ],
    sentences: ['What if our school was on a cloud?', 'We could build a world of colors.', 'I want a world where everyone smiles.', 'Imagination can change the future.'],
    activity: {
      title: '미래의 학교나 세상 설계하기',
      frame: 'What if our ___ ___? It could ___.',
      prompt: '내가 만들고 싶은 미래의 학교(또는 세상)를 What if와 could로 설명해 보세요.',
    },
    tags: { lyrics: true, video: false, elementary: false },
    draft: true,
  },
  {
    id: 'on-top-of-the-world',
    title: 'On Top of the World',
    artist: 'Imagine Dragons',
    levels: ['middle', 'high'],
    levelNote: '중2 ~ 고1',
    themes: ['성취', '노력'],
    intro: '오랫동안 기다리고 애써 온 끝에 이룬 기쁨을 노래해요. 지금까지 이어진 노력을 말하는 현재완료와 현재완료진행을 배우기 좋아요.',
    videoId: 'w5tWYmIOWGk',
    lyricsQuery: 'Imagine Dragons On Top Of The World',
    grammarIds: ['m-present-perfect', 'tense-present-perfect-progressive'],
    points: ['현재완료 (have + p.p.)', '현재완료진행 (have been -ing)', 'on top of the world', '관용 표현'],
    words: [
      { word: 'on top of the world', meaning: '세상을 다 가진 듯 행복한', pos: '숙어', example: 'I felt on top of the world after the win.', exampleKo: '이기고 나서 세상을 다 가진 기분이었어.' },
      { word: 'climb', meaning: '오르다', pos: '동사', example: 'We climbed the mountain together.', exampleKo: '우리는 함께 산에 올랐어.' },
      { word: 'moment', meaning: '순간', pos: '명사', example: 'This is a special moment.', exampleKo: '지금은 특별한 순간이야.' },
      { word: 'wait for', meaning: '~을 기다리다', pos: '동사구', example: 'I have waited for this day.', exampleKo: '나는 이날을 기다려 왔어.' },
      { word: 'all my life', meaning: '평생, 내내', pos: '표현', example: 'I have loved music all my life.', exampleKo: '나는 평생 음악을 사랑해 왔어.' },
      { word: 'take the long way', meaning: '돌아서 가다', pos: '숙어', example: 'He took the long way home.', exampleKo: '그는 집에 돌아서 갔어.' },
    ],
    warmup: [
      { en: 'What have you worked hard for?', ko: '열심히 노력해서 이룬 일이 있나요?' },
      { en: 'How did you feel when you reached your goal?', ko: '목표를 이뤘을 때 기분이 어땠나요?' },
    ],
    comprehension: [
      { q: 'How does the singer feel?', a: 'Happy and proud.', qKo: '노래하는 사람은 어떤 기분일까요?', aKo: '행복하고 자랑스럽다' },
      { q: 'What took a long time?', a: 'Reaching his goal.', qKo: '오래 걸린 것은 무엇일까요?', aKo: '목표에 닿는 것' },
    ],
    sentences: ['I have waited for this day.', 'She has been practicing for a year.', 'We have climbed the mountain.', 'He has never felt so happy.'],
    activity: {
      title: '최근 성취 경험 발표하기',
      frame: 'I have ___ for ___. Now I feel ___.',
      prompt: '최근에 노력해서 이룬 일을 현재완료 문장 3개로 써서 발표해 보세요.',
    },
    tags: { lyrics: true, video: true, elementary: false },
    draft: true,
  },
];

/** 이 곡을 정식 가사 제공처에서 찾는 검색 주소(검색 페이지로만 안내 — 가사를 앱에 담지 않는다) */
export const lyricsSearchUrl = (song: SongLesson): string => `https://genius.com/search?q=${encodeURIComponent(song.lyricsQuery)}`;
export const songVideoUrl = (song: SongLesson): string | null => (song.videoId ? `https://www.youtube.com/watch?v=${song.videoId}` : null);

export function songWordCards(song: SongLesson): FullCardItem[] {
  return song.words.map((w) => ({
    id: crypto.randomUUID(),
    word: w.word,
    meaning: w.meaning,
    imageUrl: null,
    category: null,
    example: w.example,
    exampleKo: w.exampleKo,
    partOfSpeech: w.pos,
  }));
}

const uid = () => crypto.randomUUID();
const game = (gameType: Extract<LessonSlide, { kind: 'game' }>['gameType'], templateId?: string): LessonSlide =>
  templateId ? { id: uid(), kind: 'game', gameType, templateId } : { id: uid(), kind: 'game', gameType };

/** 칠판 글자 크기(cqh = 무대 높이 %)를 칸 크기에 맞춰 가장 크게 — 글이 길면 줄어들어 겹치지 않는다 */
function fitFont(text: string, wBox: number, hBox: number, maxFs: number, minFs = 4): number {
  const wCqh = wBox * (16 / 9); // 가로 칸 폭을 cqh 로
  for (let fs = maxFs; fs > minFs; fs -= 0.5) {
    let lines = 0;
    for (const para of text.split(String.fromCharCode(10))) {
      let em = 0;
      for (const ch of para) em += /[ㄱ-힣]/.test(ch) ? 1 : ch === ' ' ? 0.35 : 0.62;
      lines += Math.max(1, Math.ceil((em * fs) / wCqh));
    }
    if (lines * fs * 1.4 <= hBox) return fs;
  }
  return minFs;
}

function textBox(text: string, x: number, y: number, w: number, h: number, maxFs: number, opts: { title?: boolean; bold?: boolean; color?: string } = {}) {
  const base = themeTextDefaults('green', opts.title ? 'title' : 'body');
  return {
    ...newTextElement({ x, y, w, h, ...base, bold: opts.bold ?? base.bold, fontSize: fitFont(text, w, h, maxFs), ...(opts.color ? { color: opts.color } : {}) }),
    text,
  };
}

function textSlide(title: string, body: string, subtitle?: string): LessonSlide {
  const slide = newCanvasSlide('green');
  slide.elements = [
    textBox(title, 6, 6, 88, 22, 15, { title: true }),
    textBox(body, 8, 32, 84, subtitle ? 44 : 60, 9, { bold: false }),
    ...(subtitle ? [textBox(subtitle, 8, 80, 84, 14, 6, { bold: false })] : []),
  ];
  return slide;
}

/** 곡 첫 화면: 제목 / 가수 / 대상·주제 / 배울 문법을 줄마다 따로 놓아 겹치지 않게 */
function songTitleSlide(song: SongLesson): LessonSlide {
  const slide = newCanvasSlide('green');
  slide.elements = [
    textBox(`♪ ${song.title}`, 6, 8, 88, 28, 14, { title: true }),
    textBox(song.artist, 8, 40, 84, 10, 8, { bold: false }),
    textBox(`${song.levelNote} · ${song.themes.join(' · ')}`, 8, 54, 84, 12, 7, { bold: false }),
    textBox(song.points.join('   ·   '), 8, 74, 84, 18, 6.5, { bold: false, color: '#fde68a' }),
  ];
  return slide;
}

export interface SongBuildContext {
  keepWordList?: boolean;
  makeWordList?: RecipeContext['makeWordList'];
  makeUnscrambleFromSentences?: RecipeContext['makeUnscrambleFromSentences'];
  makeGameFromWords?: RecipeContext['makeGameFromWords'];
}

/**
 * 노래 한 곡으로 수업 만들기. 순서: 제목 → 듣기 전 질문 → 첫 듣기 → 내용 확인 → (가사를 붙여 넣었으면 읽기·빈칸 듣기)
 * → 핵심 단어 → 단어 짝 게임 → 문법 → 문장 배열하기 → 내 이야기 만들기 → 퀴즈.
 * 가사(`lyrics`)는 선생님이 붙여 넣은 때만 쓰고, 그 수업 안의 읽기·빈칸 슬라이드로만 들어간다(공유 링크에서는 빠진다).
 */
export async function buildSongLesson(song: SongLesson, ctx: SongBuildContext, lyrics?: string): Promise<LessonSlide[]> {
  const videoUrl = songVideoUrl(song);
  const words = songWordCards(song);
  let hasWords = false;
  if (!ctx.keepWordList && ctx.makeWordList) hasWords = await ctx.makeWordList(words, `${song.title} · ${song.artist}`);

  const slides: LessonSlide[] = [];
  slides.push(songTitleSlide(song));
  slides.push(
    textSlide(
      'Before we listen',
      song.warmup.map((w) => `${w.en}\n   ${w.ko}`).join('\n\n'),
    ),
  );
  if (videoUrl) slides.push({ id: uid(), kind: 'video', videoUrl });
  slides.push({
    id: uid(),
    kind: 'qna',
    title: song.title,
    questions: song.comprehension.map((c) => ({ q: c.q, a: c.a, qKo: c.qKo, aKo: c.aKo })),
    videoUrl,
    boardTheme: 'green',
  });

  const lyricSource = lyrics?.trim() ?? '';
  let lyricSentences: string[] = [];
  if (lyricSource) {
    const parts = buildVideoLessonParts(lyricSource, await loadWordBank());
    slides.push({ id: uid(), kind: 'reading', mode: 'lines', title: song.title, source: lyricSource, videoUrl, boardTheme: 'green' });
    if (parts.clozeSource.trim()) slides.push({ id: uid(), kind: 'reading', mode: 'cloze', title: song.title, source: parts.clozeSource, videoUrl, boardTheme: 'green' });
    lyricSentences = parts.unscramble;
  }

  slides.push({ id: uid(), kind: 'wordshow', boardTheme: 'green', words, videoUrl });
  if (hasWords || ctx.keepWordList) slides.push(game('matchup'));

  for (const gid of song.grammarIds) {
    if (grammarPoint(gid)) slides.push({ id: uid(), kind: 'grammar', grammarId: gid, useWordList: false, boardTheme: 'green' });
  }

  const sentences = [...song.sentences, ...lyricSentences].slice(0, 10);
  if (sentences.length >= 3 && ctx.makeUnscrambleFromSentences) {
    const tplId = await ctx.makeUnscrambleFromSentences(sentences, song.title);
    if (tplId) slides.push(game('unscramble', tplId));
  }

  slides.push(textSlide('My turn', `${song.activity.title}\n\n${song.activity.frame}\n\n${song.activity.prompt}`));

  const quizTpl = !ctx.keepWordList && ctx.makeGameFromWords ? await ctx.makeGameFromWords('quiz', words, song.title) : null;
  if (quizTpl) slides.push(game('quiz', quizTpl));
  else if (hasWords || ctx.keepWordList) slides.push(game('quiz'));
  return slides;
}
