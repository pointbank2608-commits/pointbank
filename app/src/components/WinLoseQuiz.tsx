import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { QuizQuestion } from '../lib/types';

interface Props {
  questions: QuizQuestion[];
  startScore: number;
  betOptions: number[];
}

type Team = 'blue' | 'red';
type Phase = 'bet' | 'answer' | 'reveal';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function WinLoseQuiz({ questions, startScore, betOptions }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>(() => shuffle(questions.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [turn, setTurn] = useState<Team>('blue');
  const [scores, setScores] = useState<Record<Team, number>>({ blue: startScore, red: startScore });
  const [phase, setPhase] = useState<Phase>('bet');
  const [bet, setBet] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  // 편집 중인 선생님 화면에서 질문을 추가/삭제하면 미리보기를 처음부터 다시 섞는다.
  // questions 배열은 매 렌더마다 새 참조로 넘어오므로, 내용(아이디 목록)이 실제로 바뀔 때만 반응한다.
  const questionIdsKey = questions.map((q) => q.id).join('|');
  useEffect(() => {
    setOrder(shuffle(questions.map((_, i) => i)));
    setPos(0);
    setTurn('blue');
    setScores({ blue: startScore, red: startScore });
    setPhase('bet');
    setBet(0);
    setSelectedChoice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIdsKey]);

  if (questions.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🎲</div>
        <div className="font-body-md text-body-md">{t('gameWinLoseQuiz.needQuestions')}</div>
      </div>
    );
  }

  const finished = pos >= order.length;

  function restart() {
    setOrder(shuffle(questions.map((_, i) => i)));
    setPos(0);
    setTurn('blue');
    setScores({ blue: startScore, red: startScore });
    setPhase('bet');
    setBet(0);
    setSelectedChoice(null);
  }

  const teamLabel = (team: Team) => (team === 'blue' ? t('gameWinLoseQuiz.teamBlue') : t('gameWinLoseQuiz.teamRed'));

  if (finished) {
    const winner = scores.blue === scores.red ? null : scores.blue > scores.red ? 'blue' : 'red';
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div className="text-5xl mb-3">🏆</div>
        <div className="font-title-md text-title-md text-on-surface mb-2">{t('gameWinLoseQuiz.finishedTitle')}</div>
        <div className="font-display-lg text-[32px] text-deep-navy mb-2 tabular-nums">
          {teamLabel('blue')} {scores.blue} : {scores.red} {teamLabel('red')}
        </div>
        <div className="font-title-md text-title-md text-secondary mb-6">
          {winner ? t('gameWinLoseQuiz.winnerLabel', { team: teamLabel(winner) }) : t('gameWinLoseQuiz.drawLabel')}
        </div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameWinLoseQuiz.restartButton')}
        </button>
      </div>
    );
  }

  const current = questions[order[pos]];
  const currentScore = scores[turn];

  function placeBet(amount: number) {
    if (phase !== 'bet') return;
    setBet(Math.max(0, Math.min(amount, currentScore)));
    setPhase('answer');
  }

  function selectChoice(choiceIndex: number) {
    if (phase !== 'answer') return;
    setSelectedChoice(choiceIndex);
    const correct = choiceIndex === current.correctIndex;
    setScores((prev) => ({ ...prev, [turn]: prev[turn] + (correct ? bet : -bet) }));
    setPhase('reveal');
  }

  function next() {
    setPos((p) => p + 1);
    setPhase('bet');
    setBet(0);
    setSelectedChoice(null);
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
        className={`mb-5 px-6 py-2 rounded-full font-label-md text-label-md ${
          turn === 'blue' ? 'bg-primary text-on-primary' : 'bg-error text-on-error'
        }`}
      >
        {t('gameWinLoseQuiz.turnLabel', { team: teamLabel(turn) })}
      </div>

      {phase === 'bet' ? (
        <>
          <div className="font-body-lg text-body-lg text-on-surface-variant mb-4">{t('gameWinLoseQuiz.betPrompt')}</div>
          <div className="flex flex-wrap justify-center gap-3">
            {betOptions
              .filter((amount) => amount > 0)
              .map((amount) => (
                <button
                  key={amount}
                  type="button"
                  disabled={currentScore < amount}
                  onClick={() => placeBet(amount)}
                  className="px-6 py-3 rounded-full bg-primary hover:bg-primary-container disabled:opacity-40 text-on-primary font-title-md text-title-md shadow-sm transition-colors"
                >
                  {amount}
                </button>
              ))}
            <button
              type="button"
              disabled={currentScore <= 0}
              onClick={() => placeBet(currentScore)}
              className="px-6 py-3 rounded-full bg-warm-yellow hover:brightness-95 disabled:opacity-40 text-tertiary-container font-title-md text-title-md shadow-sm transition-all"
            >
              {t('gameWinLoseQuiz.betAllIn', { score: currentScore })}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="font-caption text-caption text-on-surface-variant mb-3 tabular-nums">
            {t('gameWinLoseQuiz.currentBetLabel', { bet })}
          </div>

          <div className="font-display-lg text-[28px] text-deep-navy mb-5 text-center [word-break:keep-all] max-w-[520px]">
            {current.question}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-[560px] mb-5">
            {current.choices.map((choice, i) => {
              const revealed = phase === 'reveal';
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

          {phase === 'reveal' && (
            <div className="result-pop flex flex-col items-center gap-4">
              <div
                className={`px-6 py-2.5 rounded-full font-title-md text-title-md shadow-sm ${
                  selectedChoice === current.correctIndex
                    ? 'bg-secondary-container/50 text-on-surface'
                    : 'bg-error-container text-on-error-container'
                }`}
              >
                {selectedChoice === current.correctIndex
                  ? t('gameWinLoseQuiz.correctFeedback', { bet })
                  : t('gameWinLoseQuiz.wrongFeedback', { bet })}
              </div>
              <button
                onClick={next}
                className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
              >
                {t('gameWinLoseQuiz.nextButton')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
