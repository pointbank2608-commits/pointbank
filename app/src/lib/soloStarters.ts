import type { SoloQuestionStep, SoloStep, SoloTestItem, TestArea } from './soloLessons';

type Category = 'preschoolPhonics' | 'elementaryPhonics' | 'elementaryGrammar' | 'middleGrammar' | 'elementaryVocab' | 'middleVocab';

export interface SoloStarter {
  category: Category;
  name: string;
  goal: string;
  minutes: number;
  steps: SoloStep[];
}

export const SOLO_STARTER_LABELS: Record<Category, [string, string]> = {
  preschoolPhonics: ['유치 · 파닉스', 'Preschool · Phonics'],
  elementaryPhonics: ['초등 저학년 · 파닉스', 'Early elementary · Phonics'],
  elementaryGrammar: ['초등 · 문법', 'Elementary · Grammar'],
  middleGrammar: ['중등 · 문법', 'Middle school · Grammar'],
  elementaryVocab: ['초등 · 어휘', 'Elementary · Vocabulary'],
  middleVocab: ['중등 · 어휘', 'Middle school · Vocabulary'],
};

function lesson(
  category: Category,
  name: string,
  goal: string,
  minutes: number,
  teaching: SoloStep[],
  practice: SoloQuestionStep[],
  check: SoloTestItem[],
): SoloStarter {
  return {
    category, name, goal, minutes,
    steps: [
      { t: 'intro', title: name, text: goal },
      ...teaching,
      ...practice,
      {
        t: 'test', title: '혼자 풀어 보는 마지막 확인', scope: 'lesson', timed: false,
        verifiedListening: check.some((item) => item.t === 'listenPick' || item.t === 'dictation'),
        items: check,
      },
    ],
  };
}

function meet(word: string, meaning: string, example: string | null = null): SoloStep {
  return { t: 'meet', word, meaning, example, imageUrl: null };
}

function rule(title: string, pattern: string, explain: string, lines: string[], tip: string): Extract<SoloStep, { t: 'rule' }> {
  return { t: 'rule', title, pattern, explain, lines, tip };
}

function hear(word: string, options: string[], answer: number, prompt: string): SoloQuestionStep {
  return { t: 'listenPick', word, options, answer, prompt, images: options.map(() => null) };
}

function blank(sentence: string, options: string[], answer: number, tip?: string): SoloQuestionStep {
  return { t: 'fillBlank', sentence, meaning: '', options, answer, tip };
}

function correct(options: string[], answer: number, why: string): SoloQuestionStep {
  return { t: 'pickCorrect', options, answer, why, tip: why };
}

function spell(word: string, meaning: string, letters: string[]): SoloQuestionStep {
  return { t: 'spell', word, meaning, imageUrl: null, letters, practiceGame: 'train' };
}

function train(sentence: string, words: string[], prompt: string): SoloQuestionStep {
  return { t: 'unscramble', sentence, words, prompt, practiceGame: 'train' };
}

function check(area: TestArea, question: SoloQuestionStep): SoloTestItem {
  return { ...question, area, sec: 25 };
}

const FIRST_SOUND = '낱말의 첫소리를 듣고 맞는 글자를 골라요.';
const HEAR_WORD = '소리를 듣고 들린 낱말을 골라요.';
const BE_TIP = '한 사람이나 물건에는 is, 여러 사람이나 물건에는 are를 써요. I에는 am을 써요.';
const DID_TIP = 'Did가 과거를 나타내므로 뒤의 동사는 기본형을 써요.';
const LEND_TIP = '받아서 쓰면 borrow, 남에게 주면 lend를 써요.';

function firstSoundModel(letters: string[]): SoloStep {
  return {
    t: 'rule',
    title: '첫소리 들어 보기',
    pattern: letters.join(' · '),
    explain: '버튼을 눌러 글자마다 나는 소리를 들어요.',
    lines: [],
    tip: '낱말을 들을 때 맨 앞 소리에 귀를 기울여요.',
    phonemes: letters.map((letter) => ({ ruleId: `letter-${letter}`, letter })),
  };
}

type ListeningWord = [word: string, options: string[]];

function shortVowelLesson({ vowel, examples, listening, spelling, transfer, dictation }: {
  vowel: 'e' | 'i' | 'o' | 'u';
  examples: [word: string, meaning: string][];
  listening: ListeningWord[];
  spelling: [word: string, meaning: string, tiles: string][];
  transfer: ListeningWord[];
  dictation: string;
}): SoloStarter {
  const words = examples.map(([word]) => word);
  const [first] = words;
  const segments = [...first].join(' – ');
  return lesson(
    'elementaryPhonics',
    `짧은 ${vowel} 소리로 낱말 읽기`,
    `${first}처럼 가운데 ${vowel} 소리가 나는 낱말을 읽고 철자를 맞춰요.`,
    9,
    [
      {
        ...rule('세 소리를 이어 읽어요', `${segments} → ${first}`,
          `가운데 ${vowel} 소리를 들은 뒤, 앞뒤 글자의 소리를 붙여 낱말을 읽어요.`, words,
          '낱말을 먼저 읽어 보고, 버튼을 눌러 소리를 확인해요.'),
        phonemes: [{ ruleId: `short-${vowel}`, letter: vowel }],
      },
      ...examples.map(([word, meaning]) => meet(word, `${meaning} · ${[...word].join(' – ')}`)),
    ],
    [
      ...listening.map(([word, options]): SoloQuestionStep => ({
        ...hear(word, options, options.indexOf(word), HEAR_WORD),
        practiceGame: 'balloon',
      })),
      ...spelling.map(([word, meaning, tiles]) => spell(word, meaning, [...tiles])),
    ],
    [
      ...transfer.map(([word, options]) => check('listening', hear(word, options, options.indexOf(word), HEAR_WORD))),
      check('spelling', { t: 'dictation', word: dictation, length: dictation.length }),
    ],
  );
}

export const SOLO_STARTERS: SoloStarter[] = [
  lesson('preschoolPhonics', '첫소리 탐정 m · s · t', '낱말을 듣고 맨 처음 소리를 m, s, t 글자와 연결해요.', 7,
    [
      firstSoundModel(['m', 's', 't']),
      meet('moon', '🌙 달 · 첫 글자 m'),
      meet('sun', '☀️ 해 · 첫 글자 s'),
      meet('top', '🌀 팽이 · 첫 글자 t'),
    ],
    [
      { ...hear('milk', ['s', 'm', 't'], 1, FIRST_SOUND), practiceGame: 'balloon', tip: 'moon의 첫소리와 같아요.' },
      { ...hear('sock', ['t', 'm', 's'], 2, FIRST_SOUND), practiceGame: 'balloon', tip: 'sun의 첫소리와 같아요.' },
      { ...hear('tap', ['t', 's', 'm'], 0, FIRST_SOUND), practiceGame: 'whack', tip: 'top의 첫소리와 같아요.' },
      { ...hear('mouse', ['s', 't', 'm'], 2, FIRST_SOUND), practiceGame: 'whack', tip: 'moon의 첫소리와 같아요.' },
    ],
    [
      check('listening', hear('map', ['t', 'm', 's'], 1, FIRST_SOUND)),
      check('listening', hear('seal', ['s', 'm', 't'], 0, FIRST_SOUND)),
      check('listening', hear('tub', ['s', 'm', 't'], 2, FIRST_SOUND)),
    ],
  ),
  lesson('preschoolPhonics', '첫소리 탐정 b · p · d', '낱말을 듣고 맨 처음 소리를 b, p, d 글자와 연결해요.', 7,
    [
      firstSoundModel(['b', 'p', 'd']),
      meet('ball', '⚽ 공 · 첫 글자 b'),
      meet('pig', '🐷 돼지 · 첫 글자 p'),
      meet('dog', '🐶 개 · 첫 글자 d'),
    ],
    [
      { ...hear('book', ['p', 'b', 'd'], 1, FIRST_SOUND), practiceGame: 'balloon', tip: 'ball의 첫소리와 같아요.' },
      { ...hear('pen', ['d', 'b', 'p'], 2, FIRST_SOUND), practiceGame: 'balloon', tip: 'pig의 첫소리와 같아요.' },
      { ...hear('duck', ['d', 'p', 'b'], 0, FIRST_SOUND), practiceGame: 'whack', tip: 'dog의 첫소리와 같아요.' },
      { ...hear('bat', ['p', 'd', 'b'], 2, FIRST_SOUND), practiceGame: 'whack', tip: 'ball의 첫소리와 같아요.' },
    ],
    [
      check('listening', hear('bell', ['d', 'b', 'p'], 1, FIRST_SOUND)),
      check('listening', hear('pan', ['p', 'b', 'd'], 0, FIRST_SOUND)),
      check('listening', hear('desk', ['b', 'p', 'd'], 2, FIRST_SOUND)),
    ],
  ),
  lesson('elementaryPhonics', '짧은 a 소리로 낱말 읽기', 'map, cat처럼 가운데 a 소리가 나는 낱말을 읽고 글자를 순서대로 놓아요.', 9,
    [
      { ...rule('세 소리를 이어 읽어요', 'm – a – p → map',
        '앞 글자, 가운데 a, 끝 글자의 소리를 끊지 말고 이어서 읽어요.', ['map', 'cat', 'bag'],
        '글자 이름 대신 낱말 안에서 나는 소리를 이어 봐요.'), phonemes: [{ ruleId: 'short-a', letter: 'a' }] },
      meet('map', '지도 · m – a – p'),
      meet('cat', '고양이 · c – a – t'),
      meet('bag', '가방 · b – a – g'),
    ],
    [
      { ...hear('map', ['mat', 'man', 'map'], 2, HEAR_WORD), practiceGame: 'balloon' },
      { ...hear('bag', ['bag', 'big', 'bug'], 0, HEAR_WORD), practiceGame: 'balloon' },
      spell('cat', '고양이', ['t', 'c', 'a']),
      spell('map', '지도', ['p', 'a', 'm']),
    ],
    [
      check('listening', hear('cap', ['can', 'cap', 'cat'], 1, HEAR_WORD)),
      check('listening', hear('pan', ['pen', 'pin', 'pan'], 2, HEAR_WORD)),
      check('spelling', { t: 'dictation', word: 'van', length: 3 }),
    ],
  ),
  shortVowelLesson({
    vowel: 'e',
    examples: [['bed', '침대'], ['pen', '펜'], ['red', '빨간색']],
    listening: [['bed', ['bad', 'bed', 'bid']], ['pen', ['pen', 'pan', 'pin']]],
    spelling: [['red', '빨간색', 'dre'], ['bed', '침대', 'edb']],
    transfer: [['met', ['mat', 'mitt', 'met']], ['pet', ['pat', 'pet', 'pit']]],
    dictation: 'net',
  }),
  shortVowelLesson({
    vowel: 'i',
    examples: [['pig', '돼지'], ['fin', '지느러미'], ['sit', '앉다']],
    listening: [['pig', ['pig', 'pug', 'peg']], ['sit', ['set', 'sat', 'sit']]],
    spelling: [['fin', '지느러미', 'nfi'], ['sit', '앉다', 'its']],
    transfer: [['bit', ['bet', 'bit', 'bat']], ['lip', ['lip', 'lap', 'lop']]],
    dictation: 'pin',
  }),
  shortVowelLesson({
    vowel: 'o',
    examples: [['hot', '뜨거운'], ['pot', '냄비'], ['dog', '개']],
    listening: [['hot', ['hat', 'hit', 'hot']], ['pot', ['pat', 'pot', 'pet']]],
    spelling: [['hot', '뜨거운', 'toh'], ['pot', '냄비', 'tpo']],
    transfer: [['cot', ['cot', 'cat', 'cut']], ['log', ['leg', 'lug', 'log']]],
    dictation: 'mop',
  }),
  shortVowelLesson({
    vowel: 'u',
    examples: [['cup', '컵'], ['bug', '벌레'], ['sun', '해']],
    listening: [['cup', ['cap', 'cup', 'cop']], ['bug', ['bug', 'bag', 'big']]],
    spelling: [['sun', '해', 'nsu'], ['cup', '컵', 'puc']],
    transfer: [['hut', ['hat', 'hit', 'hut']], ['rub', ['rob', 'rub', 'rib']]],
    dictation: 'mud',
  }),
  lesson('elementaryGrammar', '주어에 맞는 am · is · are', '문장의 주어를 보고 am, is, are를 골라 문장을 만들어요.', 9,
    [rule('주어를 먼저 봐요', 'I am · She is · They are', BE_TIP,
      ['I am happy.', 'She is happy.', 'They are happy.'], 'you에는 한 명에게 말할 때도 are를 써요.')],
    [
      { ...correct(['I is ready.', 'I am ready.', 'I are ready.'], 1, BE_TIP), practiceGame: 'balloon' },
      { ...correct(['You are kind.', 'You is kind.', 'You am kind.'], 0, 'you에는 are를 써요.'), practiceGame: 'balloon' },
      train('The dog is small.', ['small.', 'dog', 'The', 'is'], '그 개는 작아요.'),
      train('We are friends.', ['friends.', 'We', 'are'], '우리는 친구예요.'),
    ],
    [
      check('sentence', correct(['My shoes is wet.', 'My shoes am wet.', 'My shoes are wet.'], 2, BE_TIP)),
      check('sentence', correct(['Mina are at home.', 'Mina is at home.', 'Mina am at home.'], 1, BE_TIP)),
      check('sentence', { t: 'unscramble', sentence: 'I am hungry.', words: ['hungry.', 'I', 'am'] }),
    ],
  ),
  lesson('middleGrammar', 'Did로 과거 질문 만들기', '과거 질문에서 Did 뒤에 주어와 동사 기본형을 놓아요.', 10,
    [rule('과거는 Did가 맡아요', 'Did + 주어 + 동사 기본형?', DID_TIP,
      ['You saw the sign.', 'Did you see the sign?'], 'went는 go, took은 take로 돌아가요.')],
    [
      { ...correct(['Did she go?', 'Did she went?', 'Did she goes?'], 0, DID_TIP), practiceGame: 'whack' },
      { ...correct(['Did it broke?', 'Did it breaks?', 'Did it break?'], 2, DID_TIP), practiceGame: 'whack' },
      train('Did you find your phone?', ['find', 'phone?', 'Did', 'your', 'you'], '너는 휴대전화를 찾았니?'),
      train('Did he go home?', ['he', 'home?', 'go', 'Did'], '그는 집에 갔니?'),
    ],
    [
      check('sentence', correct(['Did they ate lunch?', 'Did they eat lunch?', 'Did they eats lunch?'], 1, DID_TIP)),
      check('sentence', correct(['Did Sora reads the book?', 'Did Sora read the book?'], 1, DID_TIP)),
      check('sentence', { t: 'unscramble', sentence: 'Did she win the race?', words: ['race?', 'win', 'she', 'Did', 'the'] }),
    ],
  ),
  lesson('elementaryVocab', '교실에서 찾는 ruler · pencil · eraser', '교실 물건의 이름을 듣고 알아보며 새 문장에서도 알맞은 낱말을 골라요.', 9,
    [
      meet('ruler', '자', 'Draw a line with a ruler.'),
      meet('pencil', '연필', 'Write with a pencil.'),
      meet('eraser', '지우개', 'Use an eraser to fix a mistake.'),
    ],
    [
      { t: 'pickWord', meaning: '자', imageUrl: null, options: ['pencil', 'ruler', 'eraser'], answer: 1, practiceGame: 'balloon' },
      { t: 'pickWord', meaning: '연필', imageUrl: null, options: ['pencil', 'eraser', 'ruler'], answer: 0, practiceGame: 'balloon' },
      { ...hear('eraser', ['ruler', 'pencil', 'eraser'], 2, HEAR_WORD), practiceGame: 'whack' },
      { ...hear('pencil', ['eraser', 'pencil', 'ruler'], 1, HEAR_WORD), practiceGame: 'whack' },
    ],
    [
      check('sentence', blank('I use an ___ to rub out the word.', ['ruler', 'eraser', 'pencil'], 1)),
      check('sentence', blank('My ___ has numbers on it. I use it to measure my desk.', ['ruler', 'pencil', 'eraser'], 0)),
      check('sentence', blank('My ___ broke, so I sharpened it.', ['eraser', 'ruler', 'pencil'], 2)),
    ],
  ),
  lesson('middleVocab', '빌리는 방향으로 구분하는 borrow · lend', '누가 물건을 받아 쓰고 누가 주는지 보고 borrow와 lend를 골라요.', 10,
    [rule('물건이 어느 쪽으로 가나요?', 'borrow from · lend to', LEND_TIP,
      ['I borrow a pen from Min.', 'Min lends a pen to me.'], '두 문장 모두 펜은 Min에게서 나에게로 와요.')],
    [
      { ...blank('Can I ___ a bike from you?', ['lend', 'borrow'], 1, LEND_TIP), practiceGame: 'balloon' },
      { ...blank('Can you ___ your jacket to me?', ['lend', 'borrow'], 0, LEND_TIP), practiceGame: 'balloon' },
      spell('borrow', '빌리다 · 내가 받아서 쓴다', ['r', 'w', 'o', 'b', 'o', 'r']),
      spell('lend', '빌려주다 · 내가 상대에게 준다', ['n', 'd', 'l', 'e']),
    ],
    [
      check('sentence', blank('I forgot my calculator. Can I ___ one from the teacher?', ['lend', 'borrow'], 1)),
      check('sentence', blank('Jin has no umbrella. I can ___ mine to him.', ['lend', 'borrow'], 0)),
      check('sentence', blank('The library will ___ this book to you for two weeks.', ['borrow', 'lend'], 1)),
    ],
  ),
];
