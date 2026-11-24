import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeContestRounds, roundTypeOf } from '../lib/liveQuiz';
import { estimateContestDuration } from '../lib/contestDuration';
import type { ContestRoundSetting, ContestRoundType, LiveQuestion } from '../lib/types';

const field = 'mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-white px-3 py-2';
const button = 'min-h-11 rounded-xl border border-outline-variant px-3 font-bold text-deep-navy focus-visible:outline-4 focus-visible:outline-primary disabled:opacity-40';

export default function QuizShowRoundSettings({ value, questions, onChange }: {
  value: ContestRoundSetting[] | undefined;
  questions: LiveQuestion[];
  onChange: (rounds: ContestRoundSetting[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const text = (ko: string, en: string) => i18n.language.startsWith('en') ? en : ko;
  const id = useId();
  const [expanded, setExpanded] = useState<Partial<Record<ContestRoundType, boolean>>>({});
  const rounds = normalizeContestRounds(value);
  const duration = (seconds: number) => {
    const minutes = Math.ceil(seconds / 60);
    return text(`약 ${minutes}분`, `About ${minutes} min`);
  };
  const total = estimateContestDuration(questions);
  const patch = (index: number, changes: Partial<ContestRoundSetting>) =>
    onChange(rounds.map((round, i) => i === index ? { ...round, ...changes } : round));

  return <fieldset className="space-y-3 rounded-xl bg-surface-container-low p-3">
    <legend className="font-bold">{text('라운드 설정', 'Round settings')}</legend>
    <div className="rounded-xl border border-primary/20 bg-white p-3" role="status" data-contest-duration>
      <p className="font-bold text-deep-navy">{text('예상 진행시간', 'Estimated duration')} · {duration(total.seconds)}</p>
      <p className="mt-1 text-sm">{text(`출제 가능 ${total.count}문제 · 학생 입장 시간 제외`, `${total.count} playable questions · joining time excluded`)}</p>
      <p className="mt-2 text-xs text-on-surface-variant">{text('문제별 제한 시간 + 정답 확인 10초, 라운드 전환 10초를 포함해요. 부저는 답변·판정 30초로 계산하며, 실제 시간은 응답 속도와 수업 진행에 따라 달라져요.', 'Includes each answer timer + 10s for checking, and 10s per round transition. Buzzer answering/judging allows 30s. Actual time varies with responses and teaching pace.')}</p>
    </div>
    {rounds.map((round, i) => {
      const name = t(`liveQuiz.roundName_${round.type}`);
      const open = !!expanded[round.type];
      const detailsId = `${id}-${round.type}`;
      const estimate = estimateContestDuration(questions.filter(q => roundTypeOf(q) === round.type));
      return <div key={round.type} className="rounded-xl bg-white p-3" data-quiz-round={round.type}>
        <div className="flex items-center justify-between gap-2">
          <label className="flex min-h-11 min-w-0 items-center gap-2 font-bold">
            <input type="checkbox" checked={round.on} onChange={e => patch(i, { on: e.target.checked })}/>
            {name}
          </label>
          <button type="button" className={`${button} shrink-0 text-sm`} aria-expanded={open} aria-controls={detailsId}
            aria-label={`${name} ${text(open ? '접기' : '펼치기', open ? 'Collapse' : 'Expand')}`}
            onClick={() => setExpanded(old => ({ ...old, [round.type]: !open }))}>
            {text(open ? '접기' : '펼치기', open ? 'Collapse' : 'Expand')}
            <span aria-hidden="true" className="ml-1">{open ? '▴' : '▾'}</span>
          </button>
        </div>
        {estimate.count > 0 && <p className="mt-1 text-xs text-on-surface-variant">{text(`${estimate.count}문제`, `${estimate.count} questions`)} · {duration(estimate.seconds)}</p>}
        <div id={detailsId} hidden={!open} className="mt-3 space-y-3 border-t border-outline-variant pt-3">
          <label className="block text-sm">{text('문제 수 (−1은 전체)', 'Questions (−1 = all)')}
            <input className={field} type="number" min={-1} value={round.count} onChange={e => patch(i, { count: e.target.valueAsNumber })}/>
          </label>
          <label className="block text-sm">{text('제한 시간(초)', 'Time limit (sec)')}
            <input className={`${field} disabled:opacity-40`} type="number" min={5} max={120} disabled={round.type === 'buzzer'} value={round.seconds ?? (round.type === 'ox' ? 15 : round.type === 'text' || round.type === 'scramble' ? 30 : round.type === 'blank' ? 25 : 20)} onChange={e => patch(i, { seconds: e.target.valueAsNumber })}/>
          </label>
          {round.type === 'buzzer' && <p className="text-xs text-on-surface-variant">{text('부저는 시간 제한 없이 선생님이 판정해요. 예상시간은 문제당 답변·판정 30초로 계산해요.', 'Buzzer rounds are untimed and judged by the teacher. The estimate allows 30s for answering/judging each question.')}</p>}
          <label className="block text-sm">{text('점수', 'Points')}
            <input className={field} type="number" min={0} value={round.points ?? (round.type === 'text' || round.type === 'scramble' ? 1500 : 1000)} onChange={e => patch(i, { points: e.target.valueAsNumber })}/>
          </label>
          <div className="flex gap-2">{[-1, 1].map(delta => <button key={delta} type="button" className={button}
            disabled={i + delta < 0 || i + delta >= rounds.length} onClick={() => {
              const next = [...rounds];
              [next[i], next[i + delta]] = [next[i + delta], next[i]];
              onChange(next);
            }}>{delta === -1 ? text('위로', 'Up') : text('아래로', 'Down')}</button>)}</div>
        </div>
      </div>;
    })}
  </fieldset>;
}
