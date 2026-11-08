import { useTranslation } from 'react-i18next';
import type { FullCardItem } from '../../../lib/types';
import type { BlockResult } from '../../../lib/homework/blockApi';
import { CHECK_TYPES, type CheckType } from '../../../lib/homework/guided';

const nextSteps: Record<Exclude<CheckType, 'speak'>, readonly [string, string]> = {
  choice: ['뜻과 영어 단어를 다시 연결하고, 다음 날 보기 없이 뜻을 떠올리게 해 보세요.', 'Reconnect the word and its meaning, then ask for the meaning without options the next day.'],
  listen: ['뜻을 확인한 뒤 단어를 다시 듣고, 다음 날 새 순서로 듣고 고르게 해 보세요.', 'Review the meanings and sounds, then change the order for a listening check the next day.'],
  lettersMissing: ['빠뜨린 철자 부분을 짚어 주고, 다음 날 뜻만 보고 단어 전체를 써 보게 하세요.', 'Review the missing letters, then ask for the full word from its meaning the next day.'],
  lettersOrder: ['헷갈린 철자 순서를 다시 짚어 주고, 다음 날 글자 보기 없이 써 보게 하세요.', 'Review the letter sequence, then ask the student to spell without letter tiles the next day.'],
  spelling: ['틀린 단어를 보고 한 번 써 본 뒤 가리고 써 보게 하세요. 다음 날 뜻만 주고 다시 확인해 보세요.', 'Model and practise the missed words, then check spelling from the meaning alone the next day.'],
  sentenceOrder: ['문장 덩어리의 역할과 순서를 짚은 뒤 다음 날 비슷한 새 문장을 배열하게 해 보세요.', 'Review the role and order of the chunks, then use a new sentence with the same structure the next day.'],
  sentenceBlank: ['문장에서 단서가 된 말을 함께 찾아보고, 다음 날 다른 예문에서 확인해 보세요.', 'Identify the clues in the sentence together, then check with a different example the next day.'],
};

export default function GuidedHomeworkFeedback({ rows, done, onPrepare }: {
  rows: BlockResult[];
  done: boolean;
  onPrepare: (cards: FullCardItem[], type: CheckType) => void;
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('en') ? 1 : 0;
  const l = (ko: string, en: string) => lang ? en : ko;
  if (!rows.some(row => row.guided_practice || row.check_type)) return null;
  const checks = new Map<Exclude<CheckType, 'speak'>, { answered: number; correct: number; total: number; cards: Map<string, FullCardItem> }>();
  let speaking = 0;
  let recordings = 0;
  let pending = 0;
  for (const row of rows) {
    const type = row.check_type as CheckType | undefined;
    if (!type || !Object.hasOwn(CHECK_TYPES, type)) continue;
    if (type === 'speak') {
      speaking++;
      if (row.meta.recording) recordings++;
      if (row.meta.review === 'pending') pending++;
      continue;
    }
    const check = checks.get(type) ?? { answered: 0, correct: 0, total: 0, cards: new Map() };
    check.answered += row.answered;
    check.correct += row.first_correct;
    check.total += row.total;
    for (const card of row.check_misses ?? []) {
      if (check.cards.size >= 5) break;
      const id = JSON.stringify([card.word, card.meaning]);
      if (card.word && !check.cards.has(id)) check.cards.set(id, { ...card, id, imageUrl: card.imageUrl ?? null });
    }
    checks.set(type, check);
  }
  const measured = [...checks].filter(([, check]) => check.answered > 0);
  const focus = measured.filter(([, check]) => check.correct < check.answered)
    .sort(([, a], [, b]) => a.correct / a.answered - b.correct / b.answered)[0];
  const strengths = measured.filter(([, check]) => check.answered >= 2 && check.answered === check.total && check.correct === check.answered);
  return <section className="space-y-2 rounded-xl bg-surface-container-low p-3 text-sm" aria-label={l('마무리 확인 피드백','Final check feedback')}>
    <h4 className="font-bold">{l('마무리 확인 피드백','Final check feedback')}</h4>
    {checks.size === 0 && !speaking
      ? <p>{done ? l('연습 완료 · 마무리 확인 미실시','Practice complete · No final check') : l('연습 중 · 마무리 확인 미실시','Practice in progress · No final check')}</p>
      : <>
        <ul className="space-y-1">
          {[...checks].map(([type, check]) => <li key={type}>{CHECK_TYPES[type][lang]} · {check.answered
            ? l('첫 답 정답 '+check.correct+'/'+check.answered+' · 출제 '+check.total+'문제',check.correct+'/'+check.answered+' correct on first answer · '+check.total+' assigned')
            : l('미응답','Not answered')}</li>)}
          {speaking > 0 && <li>{l('말하기 녹음 '+recordings+'/'+speaking+'개 · 교사 확인 대기 '+pending+'개',recordings+'/'+speaking+' recordings · '+pending+' awaiting teacher review')}</li>}
        </ul>
        {strengths.length > 0 && <p><b>{l('잘한 부분','What went well')}</b> · {strengths.map(([type]) => CHECK_TYPES[type][lang]).join(' / ')}{l('에서 출제된 문제를 첫 답에 모두 맞혔어요.',' — all assigned questions correct on first answer.')}</p>}
        {focus && <>
          <p><b>{l('보충할 부분','What to practise')}</b> · {CHECK_TYPES[focus[0]][lang]} ({l('첫 답 오답 '+(focus[1].answered-focus[1].correct)+'문제', (focus[1].answered-focus[1].correct)+' missed on first answer')})</p>
          <p><b>{l('다음 숙제 제안','Suggested follow-up')}</b> · {nextSteps[focus[0]][lang]}</p>
        </>}
        {focus && focus[1].cards.size > 0 && <details>
          <summary className="cursor-pointer font-semibold text-primary">{l('추천 자료 미리보기','Preview suggested material')}</summary>
          <p className="break-words">{[...focus[1].cards.values()].map(card => card.word).join(' · ')}</p>
          <button type="button" className="mt-1 min-h-10 rounded-lg border px-3" onClick={() => onPrepare([...focus[1].cards.values()], focus[0])}>{l('이 자료로 숙제 구성하기','Set up homework with this material')}</button>
        </details>}
        {!focus && measured.length > 0 && <p>{l('다음 날 새 문항으로 다시 확인해 보세요.','Check again the next day with different questions.')}</p>}
        <p className="text-on-surface-variant">{l('이번에 출제한 문항의 결과예요. 다음 날 기억과 녹음의 발음은 별도 확인이 필요해요.','These results cover the questions assigned here. Check next-day recall and pronunciation separately.')}</p>
      </>}
  </section>;
}