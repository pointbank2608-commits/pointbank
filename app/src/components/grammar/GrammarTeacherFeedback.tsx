import type { GrammarOutcome } from '../../lib/grammarServer';

function feedbackFor(row: GrammarOutcome) {
  const evidence = row.evidence;
  if (!evidence) {
    return {
      strength: row.review === 'correct' ? '복습의 새 문장 한 개를 맞혔어요.' : '짧은 확인으로 학습한 목표예요.',
      focus: '여러 문장과 문제 유형에서의 수행은 추가 확인이 필요해요.',
      next: '같은 규칙을 쓰는 새 문장으로 고르기와 직접 쓰기를 한 번씩 확인해 보세요.',
    };
  }

  const { diagnosed, diagnosed_ok, practiced, practiced_ok, transferred, transferred_ok, reviewed, reviewed_ok } = evidence;
  const format = row.independentEvidence;
  const strongerChoice = format && format.choiceAnswered >= 2 && format.writtenAnswered >= 2
    && format.choiceCorrect === format.choiceAnswered && format.writtenCorrect < format.writtenAnswered;
  const completedReview = row.review === 'correct' || row.review === 'wrong';
  const strength = row.review === 'correct'
    ? '다음 날에도 새 문장 ' + reviewed + '개를 모두 혼자 풀었어요.'
    : strongerChoice
      ? '새 문장의 고르기 문제 ' + format.choiceAnswered + '개를 모두 맞혔어요.'
      : transferred === 4 && transferred_ok === 4
        ? '첫날 새 문장 4개에 배운 규칙을 혼자 적용했어요.'
        : diagnosed >= 2 && practiced >= 3 && diagnosed_ok * practiced < practiced_ok * diagnosed
          ? '첫 확인 ' + diagnosed_ok + '/' + diagnosed + '에서 연습 ' + practiced_ok + '/' + practiced + '로 정답 비율이 높아졌어요.'
          : '이 목표에서 잘 적용하는 부분을 판단할 근거가 아직 적어요.';

  if (row.review === 'correct') return {
    strength,
    focus: transferred === 4 && transferred_ok < 4 ? '첫날 어려웠던 부분을 복습 때 다시 적용했어요.' : '이번 문항에서는 보충이 필요한 패턴이 드러나지 않았어요.',
    next: '같은 유형을 반복하는 분량은 줄이고, 이전에 배운 규칙과 섞어서 어떤 규칙을 쓸지 고르거나 짧게 영작하게 해 보세요.',
  };
  if (strongerChoice) return {
    strength,
    focus: '직접 쓰기는 ' + format.writtenCorrect + '/' + format.writtenAnswered + '였어요. 보기를 읽고 고를 때보다 직접 떠올리는 연습이 필요해 보여요.',
    next: '같은 규칙의 예문을 함께 보고, 새 문장 2개는 보기 없이 빈칸을 채우게 해 보세요. 다음 날 또 다른 문장으로 확인해 보세요.',
  };
  if (completedReview && reviewed_ok < reviewed) return {
    strength,
    focus: '다음 날 새 문장 ' + reviewed + '개 중 ' + (reviewed - reviewed_ok) + '개에서 다시 확인할 부분이 보여요.',
    next: '복습에서 틀린 문장의 규칙을 짧게 설명하고, 상황이 다른 문장 2~3개를 다음 숙제에 넣어 보세요.',
  };
  if (transferred === 4 && transferred_ok < 4) return {
    strength,
    focus: '연습 뒤에도 새 문장 4개 중 ' + (4 - transferred_ok) + '개에서 적용이 어려웠어요.',
    next: '틀린 문장과 맞는 문장을 나란히 보여 주고, 학생이 달라진 부분을 설명한 뒤 비슷한 새 문장 2~3개를 혼자 풀게 해 보세요.',
  };
  return {
    strength,
    focus: '지금까지의 답만으로 다음 날에도 기억하는지 판단하기 어려워요.',
    next: reviewed ? '남은 복습 문항까지 푼 뒤, 결과를 보고 보충할지 결정해 보세요.'
      : transferred === 4 ? '이미 배정된 다음 날 복습을 먼저 확인해 보세요.'
        : '첫날 학습과 혼자 푸는 문항을 마친 뒤 다음 숙제를 정해 보세요.',
  };
}

export default function GrammarTeacherFeedback({ row }: { row: GrammarOutcome }) {
  if (row.review === 'excluded') return <span className="text-on-surface-variant">대상 제외</span>;
  if (!row.evidence && row.reasoning === null && row.practice === null && row.transfer === null && row.review !== 'correct' && row.review !== 'wrong') {
    return <span className="text-on-surface-variant">아직 풀이 기록이 없어요.</span>;
  }
  if (row.evidence && !row.evidence.diagnosed && !row.evidence.practiced && !row.evidence.transferred && !row.evidence.reviewed) {
    return <span className="text-on-surface-variant">아직 풀이 기록이 없어요.</span>;
  }
  const { strength, focus, next } = feedbackFor(row);
  const examples = row.reviewExamples ?? [];
  return <div className="min-w-60 max-w-md space-y-1.5">
    <p><strong className="mr-1">확인된 강점</strong>{strength}</p>
    <p><strong className="mr-1">보충할 부분</strong>{focus}</p>
    <p><strong className="mr-1">다음 숙제 제안</strong>{next}</p>
    {examples.length > 0 && <details>
      <summary className="cursor-pointer font-semibold text-primary">다시 볼 문항 {examples.length}개</summary>
      <ul className="mt-1 space-y-2">
        {examples.map((example, index) => <li key={index} className="rounded-lg bg-surface-container-low p-2">
          <p className="text-xs">{example.phase === 'delayed' ? '다음 날' : '직후'} · {example.written ? '직접 쓰기' : '고르기'}</p>
          <p className="break-words font-semibold" lang="en">{example.sentence}</p>
          {example.explanation && <p>{example.explanation}</p>}
        </li>)}
      </ul>
    </details>}
  </div>;
}
