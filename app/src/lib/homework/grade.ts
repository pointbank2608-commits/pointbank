/**
 * 숙제 채점 — 서버 `hw_grade`·`hw_answer_text`(041)와 같은 규칙. 학생의 실제 점수는 늘 서버가 정하고,
 * 이 파일은 선생님 미리보기(서버에 기록하지 않는 학생 화면)에서만 쓴다.
 */
import type { HwQuestion } from './types';

export const hwNorm = (s: string) =>
  s
    .trim()
    .replace(/[.!?]+$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

export function gradeLocal(q: HwQuestion, response: string): boolean {
  if (q.correct === undefined) return false;
  switch (q.qtype) {
    case 'choice':
      return /^\d+$/.test(response) && Number(response) === Number(q.correct);
    case 'text':
      return String(q.correct)
        .split('/')
        .some((v) => hwNorm(v) !== '' && hwNorm(v) === hwNorm(response));
    case 'order':
      try {
        return JSON.stringify(JSON.parse(response)) === JSON.stringify(q.correct);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

export function answerTextLocal(q: HwQuestion): string {
  if (q.correct === undefined) return '';
  if (q.qtype === 'choice') return q.choices?.[Number(q.correct)] ?? '';
  if (q.qtype === 'text') return String(q.correct).split('/')[0];
  return Array.isArray(q.correct) ? q.correct.join(q.joiner ?? ' ') : '';
}
