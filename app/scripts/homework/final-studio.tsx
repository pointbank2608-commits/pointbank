import { createRoot } from 'react-dom/client';
import i18n from '../../src/i18n';
import '../../src/tailwind.css';
import HomeworkRunner from '../../src/components/homework/HomeworkRunner';
import HomeworkPreview from '../../src/components/homework/teacher/HomeworkPreview';
import { buildGuidedPractice, CHECK_TYPES, type CheckType } from '../../src/lib/homework/guided';
import { answerTextLocal, gradeLocal } from '../../src/lib/homework/grade';
import type { RunnerApi } from '../../src/components/homework/runnerTypes';

const params = new URLSearchParams(location.search);
const type = (params.get('type') || 'choice') as CheckType;
const words = [['apple', '사과', 'I eat an apple.'], ['banana', '바나나', 'I eat a banana.'], ['carrot', '당근', 'I see a carrot.'], ['pencil', '연필', 'I have a pencil.']];
const contents = words.map(([word, meaning, example], i) => ({ kind: 'word' as const, id: `w${i}`, origins: ['synthetic'], card: { id: `w${i}`, word, meaning, example, imageUrl: null } }));
const sentence = { kind: 'sentence' as const, id: 'sentence', origins: ['synthetic'], card: { id: 'sentence', word: 'They have a bike.', meaning: '그들은 자전거가 있어요.', imageUrl: null } };
const plan = buildGuidedPractice([...contents, sentence], [], ['review', 'memory', 'speaking'], false, { types: [type], count: 1 });
const item = params.has('preview') ? plan.examples[type] : plan.items.find(x => x.config.block?.method === `guided-final:${type}`);
if (!item) throw new Error('Missing generated item: ' + type);
const withId = { ...item, id: 'synthetic-item' };
const api: RunnerApi = {
  submit: async (_, index, response) => ({ correct: gradeLocal(item.content.questions[index], response), answer: answerTextLocal(item.content.questions[index]) }),
  progress: async () => undefined,
  finish: async () => ({ score: 1, total: item.content.questions.length }),
  uploadRecording: async () => 'synthetic.ogg',
};
void i18n.changeLanguage('ko');
createRoot(document.getElementById('root')!).render(params.has('preview') ? <HomeworkPreview title={CHECK_TYPES[type][0]} items={[item]} startImmediately /> :
  <HomeworkRunner title={item.title} items={[withId]} initialAnswers={new Map()} finishedItems={new Set()} shadowLinesDone={new Map()} alreadyFinished={false} api={api} saveState="saved" startImmediately />);
