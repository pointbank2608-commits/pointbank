import { useTranslation } from 'react-i18next';
import { activityCountLabel, activityGroups } from '../../lib/homework/activityGroups';
import type { HwQuestion, HwStudentState } from '../../lib/homework/types';

function submittedText(question: HwQuestion, response: string | null): string {
  if (!response) return '';
  if (question.qtype === 'choice' && /^\d+$/.test(response)) return question.choices?.[Number(response)] ?? response;
  if (question.qtype === 'order') {
    try {
      const words: unknown = JSON.parse(response);
      if (Array.isArray(words) && words.every(word => typeof word === 'string')) return words.join(question.joiner ?? ' ');
    } catch { /* Older submissions may already contain display text. */ }
  }
  return response;
}

export default function CompletedHomework({ state, onHome }: { state: HwStudentState; onHome: () => void }) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const attempts = new Map(state.item_attempts.map(row => [row.item_id, row]));
  const answers = new Map(state.answers.map(row => [row.item_id + ':' + row.q_index, row]));
  return <main className="mx-auto w-full max-w-2xl space-y-4 p-5">
    <header>
      <p className="font-bold text-[#3b5bdb]">{en ? 'Completed homework' : '완료한 숙제'}</p>
      <h1 className="break-words text-2xl font-bold">{state.title}</h1>
    </header>
    {activityGroups(state.items).map(group => <details key={group.key} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#eadfc5]">
      <summary className="min-h-11 cursor-pointer content-center break-words font-bold">{group.title} · {activityCountLabel(state.items[group.indices[0]], group.count, en)}
        {group.materialName && <small className="ml-2 font-normal">{group.materialName}</small>}
      </summary>
      <ul className="space-y-2">
        {group.indices.flatMap(index => {
          const item = state.items[index];
          const attempt = attempts.get(item.id);
          const block = item.config.block;
          if (item.content.questions.length) return item.content.questions.map((q, qi) => {
            const result = answers.get(item.id + ':' + qi);
            return <li key={item.id + ':' + qi} className="border-t py-2">
              <strong>{q.prompt || q.speak || q.word || qi + 1}</strong>
              {result && <p>{result.correct ? '✓ Correct' : 'Incorrect'} · {submittedText(q, result.response)}</p>}
              {result && !result.correct && result.answer && <p>{en ? 'Answer' : '정답'} · {result.answer}</p>}
            </li>;
          });
          return [<li key={item.id} className="border-t py-2">
            <strong className="whitespace-pre-line break-words">{block?.text || item.title}</strong>
            {attempt?.finished && <p>{attempt.meta?.recording ? (en ? 'Recording submitted' : '녹음 제출 완료') : (en ? 'Completed' : '수행 완료')}</p>}
            {attempt?.meta?.recording && attempt.meta.recordingCheck && <p>{en ? 'Speech check' : '자동 인식'} · {attempt.meta.recordingCheck === 'matched' ? 'Correct' : 'Incorrect'}</p>}
            {attempt?.meta?.response && <p>{attempt.meta.response}</p>}
            {!!attempt?.meta?.listens && <p>{en ? 'Listens' : '듣기'} · {attempt.meta.listens}</p>}
          </li>];
        })}
      </ul>
    </details>)}
    <button type="button" onClick={onHome} className="min-h-12 rounded-full bg-[#3b5bdb] px-6 font-bold text-white">{en ? 'Student home' : '학생 홈'}</button>
  </main>;
}
