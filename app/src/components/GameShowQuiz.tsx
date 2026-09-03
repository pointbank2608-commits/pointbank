import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { QuizQuestion, UndoHandle } from '../lib/types';

export type GameShowQuizStyle = 'wood' | 'clay';

interface Props {
  questions: QuizQuestion[];
  bonusEvery: number;
  lifelines: number;
  boardStyle?: GameShowQuizStyle;
}

type Team = 'blue' | 'red';

const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';
const pill =
  'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function GameShowQuizEmptyMotif() {
  return (
    <div className="gsq-stage pointer-events-none mx-auto w-[168px] p-3">
      <div className="flex justify-center gap-2">
        <span className="gsq-score is-blue is-turn">
          <span className="gsq-score-name">A</span>
          <span className="gsq-score-num">3</span>
        </span>
        <span className="gsq-score is-red">
          <span className="gsq-score-name">B</span>
          <span className="gsq-score-num">2</span>
        </span>
      </div>
    </div>
  );
}

const GameShowQuiz = forwardRef<UndoHandle, Props>(function GameShowQuiz(
  { questions, bonusEvery, lifelines, boardStyle = 'wood' },
  ref,
) {
  const { t } = useTranslation();
  const clay = boardStyle === 'clay';
  const [order, setOrder] = useState<number[]>(() => shuffle(questions.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [turn, setTurn] = useState<Team>('blue');
  const [scores, setScores] = useState<Record<Team, number>>({ blue: 0, red: 0 });
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [removedChoices, setRemovedChoices] = useState<Set<number>>(new Set());
  const [lifelinesLeft, setLifelinesLeft] = useState<Record<Team, number>>({ blue: lifelines, red: lifelines });
  const [prevScores, setPrevScores] = useState<Record<Team, number> | null>(null);

  const questionIdsKey = questions.map((q) => q.id).join('|');
  useEffect(() => {
    setOrder(shuffle(questions.map((_, i) => i)));
    setPos(0);
    setTurn('blue');
    setScores({ blue: 0, red: 0 });
    setSelectedChoice(null);
    setRemovedChoices(new Set());
    setLifelinesLeft({ blue: lifelines, red: lifelines });
    setPrevScores(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIdsKey]);

  useImperativeHandle(ref, () => ({
    undo() {
      if (!prevScores) return;
      setScores(prevScores);
      setSelectedChoice(null);
      setPrevScores(null);
    },
  }));

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mb-3">
          <GameShowQuizEmptyMotif />
        </div>
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
    setPrevScores(null);
  }

  const teamLabel = (team: Team) => (team === 'blue' ? t('gameGameShowQuiz.teamBlue') : t('gameGameShowQuiz.teamRed'));

  if (finished) {
    const winner = scores.blue === scores.red ? null : scores.blue > scores.red ? 'blue' : 'red';
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div
          className="mb-6 w-[min(360px,92%)] px-2 py-2 text-center"
          style={{
            borderRadius: 22,
            background: 'linear-gradient(180deg, #f8e4b8 0%, #e8c48a 42%, #c9964e 100%)',
            boxShadow: woodShadow,
          }}
        >
          <div
            className="px-4 py-5"
            style={{
              borderRadius: 16,
              background: 'linear-gradient(180deg, #fffef9 0%, #fff4e0 100%)',
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -3px 4px rgba(166,112,48,0.16)',
            }}
          >
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameGameShowQuiz.finishedTitle')}</div>
            <div className="mb-2 font-title-md text-[22px] font-bold tabular-nums text-deep-navy">
              {teamLabel('blue')} {scores.blue} : {scores.red} {teamLabel('red')}
            </div>
            <div className="font-title-md text-title-md text-deep-navy">
              {winner ? t('gameGameShowQuiz.winnerLabel', { team: teamLabel(winner) }) : t('gameGameShowQuiz.drawLabel')}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameGameShowQuiz.restartButton')}
        </button>
      </div>
    );
  }

  const current = questions[order[pos]];
  if (!current) return null;
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
    setPrevScores(scores);
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
    setPrevScores(null);
  }

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div className={`gsq-stage w-full max-w-[720px] ${clay ? 'gsq-clay' : ''}`}>
        <div className="mb-4 flex justify-center gap-3">
          <div className={`gsq-score is-blue ${turn === 'blue' ? 'is-turn' : ''}`}>
            <span className="gsq-score-name">{teamLabel('blue')}</span>
            <span className="gsq-score-num">{scores.blue}</span>
          </div>
          <div className={`gsq-score is-red ${turn === 'red' ? 'is-turn' : ''}`}>
            <span className="gsq-score-name">{teamLabel('red')}</span>
            <span className="gsq-score-num">{scores.red}</span>
          </div>
        </div>

        <div className={`gsq-turn ${turn === 'blue' ? 'is-blue' : 'is-red'}`}>
          {t('gameGameShowQuiz.turnLabel', { team: teamLabel(turn) })}
        </div>

        {isBonus && <div className="gsq-bonus">{t('gameGameShowQuiz.bonusBadge')}</div>}

        <div className="gsq-prompt">{current.question}</div>

        <button
          type="button"
          onClick={useFiftyFifty}
          disabled={revealed || lifelinesLeft[turn] <= 0}
          className="gsq-life"
        >
          {t('gameGameShowQuiz.fiftyFiftyButton', { count: lifelinesLeft[turn] })}
        </button>

        <div className="mt-4 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
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
                className={`gsq-choice ${clay ? `gsq-clay-${i % 4}` : ''} ${
                  revealed && isCorrect ? 'is-ok' : revealed && isSelected ? 'is-no' : ''
                }`}
              >
                {choice}
              </button>
            );
          })}
        </div>
      </div>

      {revealed && (
        <div className="mt-5 flex flex-col items-center gap-4">
          <div className={`gsq-result ${selectedChoice === current.correctIndex ? 'is-ok' : 'is-no'}`}>
            {selectedChoice === current.correctIndex
              ? t('gameGameShowQuiz.correctFeedback', { points })
              : t('gameGameShowQuiz.wrongFeedback')}
          </div>
          <button type="button" onClick={next} className={pill}>
            {t('gameGameShowQuiz.nextButton')}
          </button>
        </div>
      )}
    </div>
  );
});

export default GameShowQuiz;
