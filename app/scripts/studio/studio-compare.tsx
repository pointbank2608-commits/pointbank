/**
 * 학습 스튜디오 화면 비교 하네스(로컬 전용, 합성 데이터). 서버를 부르지 않는다.
 * 열기: /scripts/studio/studio-compare.html?v=word | grammar-short | grammar-long | grammar-explain | grammar-wait | grammar-done
 */
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '../../src/tailwind.css';
import i18n from '../../src/i18n';
import HomeworkRunner from '../../src/components/homework/HomeworkRunner';
import StudentGrammarPage from '../../src/pages/StudentGrammarPage';
import type { HwItem, HwQuestion } from '../../src/lib/homework/types';
import type { AnswerResult, RunnerApi } from '../../src/components/homework/runnerTypes';

void i18n.changeLanguage('ko');
const v = new URLSearchParams(location.search).get('v') ?? 'word';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const base = { skill: 'vocab.meaning', gen: 'demo-v1' };

// ---------- 단어 숙제 ----------
const correctIdx: Record<string, number> = { q1: 1, q2: 0, q3: 2 };
const questions: HwQuestion[] = [
  { id: 'q1', qtype: 'choice', style: 'meaning', prompt: 'cat', sub: '뜻을 골라요', choices: ['말', '고양이', '소', '닭'], word: 'cat', ...base },
  { id: 'q2', qtype: 'choice', style: 'meaning', prompt: 'dog', sub: '뜻을 골라요', choices: ['개', '고양이', '새', '물고기'], word: 'dog', ...base },
  { id: 'q3', qtype: 'choice', style: 'whack', prompt: 'bird', choices: ['개', '말', '새', '닭'], word: 'bird', ...base },
];
const items: HwItem[] = [{ id: 'item1', kind: 'quiz', title: '단어 숙제', config: {}, content: { questions } }];
const wordApi: RunnerApi = {
  async submit(_item, q, response): Promise<AnswerResult> {
    await wait(250);
    const q0 = questions[q];
    const ok = Number(response) === correctIdx[q0.id];
    return { correct: ok, answer: (q0.choices ?? [])[correctIdx[q0.id]] };
  },
  async progress() { await wait(50); },
  async finish() { await wait(100); return { score: 2, total: 3 }; },
};

// ---------- 문법(서버 응답을 흉내 낸다. 채점 규칙은 서버 몫이라 여기서는 정해진 정답 id만 쓴다) ----------
const shortOptions = [{ id: 'a', text: 'go' }, { id: 'b', text: 'went' }, { id: 'c', text: 'goes' }, { id: 'd', text: 'going' }];
const longOptions = [
  { id: 'a', text: 'went — 지난 일을 묻는 문장이라서 동사도 과거형으로 바꿔서 써요.' },
  { id: 'b', text: 'go — Did가 과거를 알려 줘서 동사는 원형이에요.' },
  { id: 'c', text: 'go — 질문 문장에서는 동사를 언제나 원형으로 써요.' },
  { id: 'd', text: 'goes — you는 한 명이라서 동사에 s를 붙여서 써요.' },
];
const example = (sentence: string, translation: string) => ({
  sentence, translation, why: 'Did가 있으면 과거 신호는 Did가 맡아요.',
  chunks: [{ text: 'Did', role: '과거 신호 칸 + 질문', term: '조동사' }, { text: 'you', role: '하는 사람', term: '주어' }, { text: 'go', role: '동작 이름 칸', term: '동사원형' }],
});
const short = v === 'grammar-short';
const reasoning = { phase: 'reasoning', item: { id: 'r1', sentence: 'Did you ___ to school yesterday?', prompt: '빈칸에 알맞은 모양을 고르세요. (go = 가다)', options: short ? shortOptions : longOptions } };
const correctId = short ? 'a' : 'b';
let revision = 1;
const dueAt = new Date(Date.now() + 24 * 3600_000).toISOString();
let grammarState: unknown = v === 'grammar-explain'
  ? { kind: 'step', position: 0, step: { phase: 'explain', objective: 'Did 질문에서 뒤 동사가 왜 원형인지 말할 수 있다.', rule: '과거 신호는 한 칸에 하나만 들어가요.', boundary: 'Did가 없는 평서문에서는 동사가 과거를 알려 줘요.', examples: [example('You went home.', '너는 집에 갔어.'), example('Did you go home?', '너는 집에 갔니?')] } }
  : v === 'grammar-wait' ? { kind: 'waiting', dueAt }
  : v === 'grammar-done' ? { kind: 'finished', finishedAt: new Date().toISOString() }
  : { kind: 'step', position: 1, step: reasoning };
function grammarRpc(name: string, body: Record<string, unknown>): unknown {
  const wrap = (state: unknown) => ({ assignmentId: 'demo', runId: 'run-demo', revision, state });
  if (name === 'grammar_open') return wrap(grammarState);
  if (name === 'grammar_act') {
    revision += 1;
    if (body.p_action === 'answer') {
      const ok = body.p_option_id === correctId;
      grammarState = { kind: 'feedback', position: 1, feedback: { correct: ok, explanation: ok
        ? '잘 골랐어요. Did가 과거를 알려 주니까 동사는 동작 이름 go만 남아요.'
        : '지난 일이라는 판단은 맞아요. 하지만 그 신호는 이미 Did가 맡고 있어요. went를 쓰면 과거가 두 번 나와요. 평서문에서는 "You went to school yesterday."처럼 동사 모양이 과거를 알려 주지만, 질문에서는 Did가 그 일을 대신 맡아요. 그래서 Did 뒤의 동사는 언제나 동작 이름 그대로인 원형이에요. 다음 문장에서도 Did가 보이면 먼저 "과거 신호는 어디에 있지?" 하고 물어보고, 동사에는 -ed나 불규칙 과거형을 붙이지 않는지 확인해 보세요.' } };
    } else if (grammarState && (grammarState as { kind: string }).kind === 'feedback') grammarState = { kind: 'waiting', dueAt };
    else grammarState = { kind: 'step', position: 1, step: reasoning };
    return wrap(grammarState);
  }
  return { accepted: 1, schema_version: 'delivery-v1' };
}
if (v.startsWith('grammar')) {
  localStorage.setItem('classbank.studentToken', 'demo-token');
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = String(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const m = url.match(/\/rest\/v1\/rpc\/([a-z_]+)/);
    if (!m) return realFetch(input, init);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    await wait(150);
    return new Response(JSON.stringify(grammarRpc(m[1], body)), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}

createRoot(document.getElementById('root')!).render(v.startsWith('grammar')
  ? <MemoryRouter initialEntries={['/s/grammar/demo']}><Routes><Route path="/s/grammar/:assignmentId" element={<StudentGrammarPage />} /><Route path="*" element={<p>학생 홈(데모)</p>} /></Routes></MemoryRouter>
  : <div className="flex min-h-[100dvh] flex-col bg-[#16213e] text-white"><HomeworkRunner title="단어 숙제" studentName="QA student A" items={items} initialAnswers={new Map()} finishedItems={new Set()} shadowLinesDone={new Map()} alreadyFinished={false} api={wordApi} saveState="saved" startImmediately onHome={() => undefined} /></div>);
