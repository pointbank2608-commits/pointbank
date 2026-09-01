import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { QuizQuestion } from '../lib/types';

interface Props {
  questions: QuizQuestion[];
  bonusEvery: number;
  lifelines: number;
}

type Team = 'blue' | 'red';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function GameShowQuiz({ questions, bonusEvery, lifelines }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>(() => shuffle(questions.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [turn, setTurn] = useState<Team>('blue');
  const [scores, setScores] = useState<Record<Team, number>>({ blue: 0, red: 0 });
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [removedChoices, setRemovedChoices] = useState<Set<number>>(new Set());
  const [lifelinesLeft, setLifelinesLeft] = useState<Record<Team, number>>({ blue: lifelines, red: lifelines });

  // 편집 중인 선생님 화면에서 질문을 추가/삭제하면 미리보기를 처음부터 다시 섞는다.
  // questions 배열은 매 렌더마다 새 참조로 넘어오므로, 내용(아이디 목록)이 실제로 바뀔 때만 반응한다.
  const questionIdsKey = questions.map((q) => q.id).join('|');
  useEffect(() => {
    setOrder(shuffle(questions.map((_, i) => i)));
    setPos(0);
    setTurn('blue');
    setScores({ blue: 0, red: 0 });
    setSelectedChoice(null);
    setRemovedChoices(new Set());
    setLifelinesLeft({ blue: lifelines, red: lifelines });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIdsKey]);

  if (questions.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🎪</div>
        <div className="font-body-md text-body-md">{t('gameGameShowQuiz.needQuestions')}</div>
      </div>
    );
  }

  const finished = pos >= order.length;

  function restart() {
    setOrder(shuffle(questions.map((_, i) => i)));
    setPos(0);
    setTurn('blue');
    setScores({ blue: 0, red: 0 });
    setSelectedChoice(null);
    setRemovedChoices(new Set());
    setLifelinesLeft({ blue: lifelines, red: lifelines });
  }

  const teamLabel = (team: Team) => (team === 'blue' ? t('gameGameShowQuiz.teamBlue') : t('gameGameShowQuiz.teamRed'));

  if (finished) {
    const winner = scores.blue === scores.red ? null : scores.blue > scores.red ? 'blue' : 'red';
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div className="text-5xl mb-3">🏆</div>
        <div className="font-title-md text-title-md text-on-surface mb-2">{t('gameGameShowQuiz.finishedTitle')}</div>
        <div className="font-display-lg text-[32px] text-deep-navy mb-2 tabular-nums">
          {teamLabel('blue')} {scores.blue} : {scores.red} {teamLabel('red')}
        </div>
        <div className="font-title-md text-title-md text-secondary mb-6">
          {winner ? t('gameGameShowQuiz.winnerLabel', { team: teamLabel(winner) }) : t('gameGameShowQuiz.drawLabel')}
        </div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameGameShowQuiz.restartButton')}
        </button>
      </div>
    );
  }

  const current = questions[order[pos]];
  const isBonus = (pos + 1) % bonusEvery === 0;
  const points = isBonus ? 2 : 1;
  const revealed = selectedChoice !== null;

  function useFiftyFifty() {
    if (revealed || lifelinesLeft[turn] <= 0) return;
    const wrongIndices = current.choices
      .map((_, i) => i)
      .filter((i) => i !== current.correctIndex && !removedChoices.has(i));
    const toRemove = shuffle(wrongIndices).slice(0, 2);
    setRemovedChoices((prev) => new Set([...prev, ...toRemove]));
    setLifelinesLeft((prev) => ({ ...prev, [turn]: prev[turn] - 1 }));
  }

  function selectChoice(choiceIndex: number) {
    if (revealed || removedChoices.has(choiceIndex)) return;
    setSelectedChoice(choiceIndex);
    if (choiceIndex === current.correctIndex) {
      setScores((prev) => ({ ...prev, [turn]: prev[turn] + points }));
    }
  }

  function next() {
    setPos((p) => p + 1);
    setSelectedChoice(null);
    setRemovedChoices(new Set());
    setTurn((prev) => (prev === 'blue' ? 'red' : 'blue'));
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="flex gap-3 mb-4">
        <div className={`px-5 py-2.5 rounded-xl text-center ${turn === 'blue' ? 'bg-primary/15 border-2 border-primary' : 'bg-primary/10 border border-primary/30'}`}>
          <div className="font-caption text-caption text-primary">{teamLabel('blue')}</div>
          <div className="font-title-md text-title-md text-primary tabular-nums">{scores.blue}</div>
        </div>
        <div className={`px-5 py-2.5 rounded-xl text-center ${turn === 'red' ? 'bg-error/15 border-2 border-error' : 'bg-error/10 border border-error/30'}`}>
          <div className="font-caption text-caption text-error">{teamLabel('red')}</div>
          <div className="font-title-md text-title-md text-error tabular-nums">{scores.red}</div>
        </div>
      </div>

      <div
        className={`mb-3 px-6 py-2 rounded-full font-label-md text-label-md ${
          turn === 'blue' ? 'bg-primary text-on-primary' : 'bg-error text-on-error'
        }`}
      >
        {t('gameGameShowQuiz.turnLabel', { team: teamLabel(turn) })}
      </div>

      {isBonus && (
        <div className="mb-3 px-4 py-1.5 rounded-full bg-warm-yellow text-tertiary-container font-label-md text-label-md font-bold">
          {t('gameGameShowQuiz.bonusBadge')}
        </div>
      )}

      <div className="font-display-lg text-[28px] text-deep-navy mb-5 text-center [word-break:keep-all] max-w-[520px]">
        {current.question}
      </div>

      <button
        type="button"
        onClick={useFiftyFifty}
        disabled={revealed || lifelinesLeft[turn] <= 0}
        className="mb-4 px-5 py-2 rounded-full border-2 border-secondary text-secondary font-label-md text-label-md disabled:opacity-40 hover:bg-secondary-container/40 transition-colors"
      >
        {t('gameGameShowQuiz.fiftyFiftyButton', { count: lifelinesLeft[turn] })}
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-[560px] mb-5">
        {current.choices.map((choice, i) => {
          if (removedChoices.has(i)) return null;
          const isCorrect = i === current.correctIndex;
          const isSelected = i === selectedChoice;
          return (
            <button
              key={i}
              type="button"
              disabled={revealed}
              onClick={() => selectChoice(i)}
              className={`px-5 py-3.5 rounded-xl font-label-md text-label-md text-left transition-all border-2 ${
                revealed && isCorrect
                  ? 'bg-secondary-container/40 border-secondary text-on-surface'
                  : revealed && isSelected
                    ? 'bg-error-container border-error text-on-error-container'
                    : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface hover:bg-surface-container-low'
              }`}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className="result-pop flex flex-col items-center gap-4">
          <div
            className={`px-6 py-2.5 rounded-full font-title-md text-title-md shadow-sm ${
              selectedChoice === current.correctIndex
                ? 'bg-secondary-container/50 text-on-surface'
                : 'bg-error-container text-on-error-container'
            }`}
          >
            {selectedChoice === current.correctIndex
              ? t('gameGameShowQuiz.correctFeedback', { points })
              : t('gameGameShowQuiz.wrongFeedback')}
          </div>
          <button
            onClick={next}
            className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
          >
            {t('gameGameShowQuiz.nextButton')}
          </button>
        </div>
      )}
    </div>
  );
}
