export type VideoQuestion = {
  id: string; at: number; replayStart?: number;
} & (
  | { kind: 'spoken'; prompt: string; modelAnswer?: string }
  | { kind: 'choice'; prompt: string; choices: string[]; answerIndex: number }
  | { kind: 'cloze'; sentence: string; hiddenWordIndices: number[] }
  | { kind: 'scramble'; sentence: string }
);
export const questionKinds = { spoken: '말로 답하기 · What do you see?', choice: '보기 고르기 · cat / dog', cloze: '듣고 빈칸 채우기 · I ___ it.', scramble: '문장 순서 맞추기 · like / I / it.' };
export const sentenceWords = (sentence: string) => sentence.trim().split(/\s+/).filter(Boolean);
export function questionError(q: VideoQuestion, start = 0, end = Infinity): string {
  if (!Number.isFinite(q.at) || q.at < start || q.at > end) return '질문 시점을 영상 구간 안으로 입력해 주세요.';
  if (q.replayStart !== undefined && (!Number.isFinite(q.replayStart) || q.replayStart < start || q.replayStart >= q.at)) return '다시 볼 시작점은 영상 구간 안에 있고 질문 시점보다 앞이어야 해요.';
  if ((q.kind === 'spoken' || q.kind === 'choice') && !q.prompt.trim()) return '질문을 입력해 주세요.';
  if (q.kind === 'choice' && (q.choices.length < 2 || q.choices.some(c => !c.trim()) || !Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex >= q.choices.length)) return '보기를 두 개 이상 입력하고 정답 하나를 골라 주세요.';
  if ((q.kind === 'cloze' || q.kind === 'scramble') && sentenceWords(q.sentence).length < 2) return '완성 문장을 두 단어 이상 입력해 주세요.';
  if (q.kind === 'cloze' && (!q.hiddenWordIndices.length || q.hiddenWordIndices.some(i => !Number.isInteger(i) || i < 0 || i >= sentenceWords(q.sentence).length))) return '가릴 단어를 골라 주세요.';
  return '';
}
export const sortedQuestions = (questions: VideoQuestion[]) => [...questions].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
export function nextVideoQuestion(questions: VideoQuestion[], served: Set<string>, time: number): VideoQuestion | undefined {
  return sortedQuestions(questions).find(q => !served.has(q.id) && q.at <= time + .03);
}
export function shuffledWordIndices(sentence: string): number[] {
  const indices = sentenceWords(sentence).map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [indices[i], indices[j]] = [indices[j], indices[i]]; }
  if (indices.every((v, i) => v === i)) indices.push(indices.shift()!);
  return indices;
}
export function formatQuestionTime(seconds: number): string {
  const value = Math.max(0, seconds);
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${(value % 60).toFixed(2).padStart(5, '0')}`;
}
export function parseQuestionTime(value: string): number {
  if (!/^\d+(?::[0-5]?\d(?:\.\d+)?)?$/.test(value.trim())) return NaN;
  const parts = value.trim().split(':').map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
}
