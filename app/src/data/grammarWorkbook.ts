export interface GrammarExercise {
  prompt: string;
  answer: string;
  explanation: string;
  choices?: string[];
  hint?: string;
}
export interface GrammarMission {
  kind: 'robot-detective';
  title: string;
  characters: { name: string; sentences: string[] }[];
  clues: GrammarExercise[];
  owner: string;
  solution: string;
}
export interface GrammarWorkbookTopic {
  id: string;
  title: string;
  rule: string;
  choose: GrammarExercise[];
  fill: GrammarExercise[];
  correct: GrammarExercise[];
  mission: GrammarMission;
}

const thirdPerson: GrammarWorkbookTopic = {
  id: 'third-s', title: '3인칭 단수 현재형 · -s / -es / has',
  rule: 'I / You / We / They → 동사원형 · He / She / It / 한 사람이나 사물 → -s / -es · have → has',
  choose: [
    { prompt: 'I ____ soccer.', choices: ['likes', 'like'], answer: 'like', explanation: 'I 뒤에는 동사원형 like를 씁니다.' },
    { prompt: 'She ____ cartoons.', choices: ['watch', 'watches'], answer: 'watches', explanation: 'She는 3인칭 단수이고 watch에는 -es를 붙입니다.' },
    { prompt: 'They ____ to the park.', choices: ['go', 'goes'], answer: 'go', explanation: 'They 뒤에는 동사원형 go를 씁니다.' },
    { prompt: 'Tom ____ a red bag.', choices: ['has', 'have'], answer: 'has', explanation: 'Tom은 한 사람입니다. have가 has로 바뀝니다.' },
    { prompt: 'We ____ tennis.', choices: ['plays', 'play'], answer: 'play', explanation: 'We 뒤에는 동사원형 play를 씁니다.' },
  ],
  fill: [
    { prompt: 'He ____ soccer.', hint: 'like', answer: 'likes', explanation: 'He + likes: like에 -s를 붙입니다.' },
    { prompt: 'You ____ cartoons.', hint: 'watch', answer: 'watch', explanation: 'You 뒤에는 동사원형 watch를 씁니다.' },
    { prompt: 'My sister ____ to school.', hint: 'go', answer: 'goes', explanation: 'My sister는 한 사람입니다. go에 -es를 붙입니다.' },
    { prompt: 'It ____ four legs.', hint: 'have', answer: 'has', explanation: 'It은 3인칭 단수입니다. have가 has로 바뀝니다.' },
    { prompt: 'They ____ blue bags.', hint: 'have', answer: 'have', explanation: 'They 뒤에는 동사원형 have를 씁니다.' },
  ],
  correct: [
    { prompt: 'She like apples.', answer: 'She likes apples.', explanation: 'She 뒤의 like를 likes로 바꿉니다.' },
    { prompt: 'We goes to the park.', answer: 'We go to the park.', explanation: 'We 뒤의 goes를 go로 바꿉니다.' },
    { prompt: 'The robot have a red bag.', answer: 'The robot has a red bag.', explanation: 'The robot은 한 대이므로 have를 has로 바꿉니다.' },
  ],
  mission: {
    kind: 'robot-detective',
    title: '로봇 탐정: 소포의 주인을 찾아라',
    characters: [
      { name: 'BIBI', sentences: ['I like soccer.', 'I watch music videos.', 'I go to the park.', 'I have a blue bag.'] },
      { name: 'MOMO', sentences: ['I like tennis.', 'I watch cartoons.', 'I go to the zoo.', 'I have a red bag.'] },
      { name: 'TOBI', sentences: ['I like soccer.', 'I watch cartoons.', 'I go to the park.', 'I have a red bag.'] },
      { name: 'KIKI', sentences: ['I like soccer.', 'I watch cartoons.', 'I go to the zoo.', 'I have a blue bag.'] },
    ],
    clues: [
      { prompt: 'I like soccer.', answer: 'He likes soccer.', explanation: 'like → likes' },
      { prompt: 'I watch cartoons.', answer: 'He watches cartoons.', explanation: 'watch → watches' },
      { prompt: 'I go to the park.', answer: 'He goes to the park.', explanation: 'go → goes' },
      { prompt: 'I have a red bag.', answer: 'He has a red bag.', explanation: 'have → has' },
    ],
    owner: 'TOBI',
    solution: 'BIBI는 음악 영상을 보고 파란 가방을 갖고 있습니다. MOMO는 테니스를 좋아하고 동물원에 갑니다. KIKI는 동물원에 가고 파란 가방을 갖고 있습니다. 네 단서가 모두 맞는 로봇은 TOBI입니다.',
  },
};

/** Only reviewed topics are registered. Other grammar IDs remain explicitly unavailable. */
export const GRAMMAR_WORKBOOK_TOPICS: Record<string, GrammarWorkbookTopic> = { 'third-s': thirdPerson };
