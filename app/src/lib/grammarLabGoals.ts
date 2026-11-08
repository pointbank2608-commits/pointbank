import { transformSentence, type FactoryItem } from './sentenceFactory';

type LabTask = FactoryItem | { kind: 'subjectShe'; from: string; to: string };
export const LAB_RULE_VERSION = 'goal-v1';
const agreement: LabTask[] = [
  { kind: 'subjectShe', from: 'They have a bike.', to: 'She has a bike.' },
  { kind: 'subjectShe', from: 'They play chess.', to: 'She plays chess.' },
  { kind: 'subjectShe', from: 'They study English.', to: 'She studies English.' },
  { kind: 'subjectShe', from: 'They watch cartoons.', to: 'She watches cartoons.' },
  { kind: 'subjectShe', from: 'They go to school.', to: 'She goes to school.' },
];
const regular = ['She plays chess.', 'He watches cartoons.', 'We study English.', 'They clean the room.'];
const irregular = ['She has a bike.', 'He writes a letter.', 'They eat lunch.', 'We make a cake.'];
const be = ['I am tired.', 'She is happy.', 'They are ready.', 'We are hungry.'];
const from = (kind: FactoryItem['kind'], sentences: string[]): LabTask[] => sentences.flatMap(s => transformSentence(s).filter(r => r.kind === kind));
const past = from('past', [...regular, ...irregular]);
const future = from('future', [...regular, ...irregular]);
const topics: Partial<Record<string, LabTask[]>> = {
  'third-s': agreement, 'm-general-verb': agreement, 'tense-present': agreement,
  'past-regular': from('past', regular), 'past-irregular': from('past', irregular), 'past-be': from('past', be),
  'm-past': past, 'tense-past': past,
  future, 'm-future': future, 'tense-future': future,
  'i-dont': from('negative', ['I like carrots.', 'I have a cat.', 'I play chess.', 'I watch cartoons.']),
  'be-not': from('negative', be),
  'is-it': from('question', ['It is a cat.', 'It is a pen.', 'It is a rabbit.', 'It is a toy.']),
  'do-you-like': from('question', ['You like milk.', 'You have a pet.', 'You play chess.', 'You watch cartoons.']),
  'does-he': from('question', ['He likes cats.', 'He has a bike.', 'He plays chess.', 'He watches cartoons.']),
  'did-you': from('question', ['You ate lunch.', 'You saw a bird.', 'You played chess.', 'You made a cake.']),
  'm-be-verb': from('subjectHe', ['They are happy.', 'They are hungry.', 'They are ready.', 'They are tired.']),
};

/** Unsupported goals stay unavailable rather than borrowing a different grammar target. */
export const grammarLabTasks = (grammarId: string): readonly LabTask[] => Object.hasOwn(topics, grammarId) ? topics[grammarId] ?? [] : [];
