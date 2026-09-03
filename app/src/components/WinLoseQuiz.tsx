import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { QuizQuestion, UndoHandle } from '../lib/types';

export type WinLoseQuizStyle = 'wood' | 'clay';

interface Props {
  questions: QuizQuestion[];
  startScore: number;
  betOptions: number[];
  boardStyle?: WinLoseQuizStyle;
}

type Team = 'blue' | 'red';
type Phase = 'bet' | 'answer' | 'reveal';

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

export function WinLoseQuizEmptyMotif() {
  return (
    <div className="wlq-stage pointer-events-none mx-auto w-[196px] p-3">
      <div className="flex items-center justify-center gap-2">
        <span className="wlq-score is-blue is-turn">
          <span className="wlq-score-name">A</span>
          <span className="wlq-score-num">100</span>
        </span>
        <span className="wlq-chip">10</span>
        <span className="wlq-score is-red">
          <span className="wlq-score-name">B</span>
          <span className="wlq-score-num">90</span>
        </span>
      </div>
    </div>
  );
}

interface Snapshot {
  scores: Record<Team, number>;
  phase: Phase;
  bet: number;
  selectedChoice: number | null;
}

const WinLoseQuiz = forwardRef<UndoHandle, Props>(function WinLoseQuiz(
  { questions, startScore, betOptions, boardStyle = 'wood' },
  ref,
) {
  const { t } = useTranslation();
  const clay = boardStyle === 'clay';
  const [order, setOrder] = useState<number[]>(() => shuffle(questions.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [turn, setTurn] = useState<Team>('blue');
  const [scores, setScores] = useState<Record<Team, number>>({ blue: startScore, red: startScore });
  const [phase, setPhase] = useState<Phase>('bet');
  const [bet, setBet] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [prevSnapshot, setPrevSnapshot] = useState<Snapshot | null>(null);

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
    setPrevSnapshot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIdsKey]);

  useImperativeHandle(ref, () => ({
    undo() {
      if (!prevSnapshot) return;
      setScores(prevSnapshot.scores);
      setPhase(prevSnapshot.phase);
      setBet(prevSnapshot.bet);
      setSelectedChoice(prevSnapshot.selectedChoice);
      setPrevSnapshot(null);
    },
  }));

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mb-3">
          <WinLoseQuizEmptyMotif />
        </div>
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
    setPrevSnapshot(null);
  }

  const teamLabel = (team: Team) => (team === 'blue' ? t('gameWinLoseQuiz.teamBlue') : t('gameWinLoseQuiz.teamRed'));

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
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameWinLoseQuiz.finishedTitle')}</div>
            <div className="mb-2 font-title-md text-[22px] font-bold tabular-nums text-deep-navy">
              {teamLabel('blue')} {scores.blue} : {scores.red} {teamLabel('red')}
            </div>
            <div className="font-title-md text-title-md text-deep-navy">
              {winner ? t('gameWinLoseQuiz.winnerLabel', { team: teamLabel(winner) }) : t('gameWinLoseQuiz.drawLabel')}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameWinLoseQuiz.restartButton')}
        </button>
      </div>
    );
  }

  const current = questions[order[pos]];
  // 편집 화면에서 질문을 지운 직후 한 프레임 동안은 order 가 아직 옛 길이 기준이라
  // 범위를 벗어날 수 있다 — 위 useEffect 가 재동기화하기 전까지 이 프레임만 건너뛴다.
  if (!current) return null;
  const currentScore = scores[turn];

  function placeBet(amount: number) {
    if (phase !== 'bet') return;
    setPrevSnapshot({ scores, phase, bet, selectedChoice });
    setBet(Math.max(0, Math.min(amount, currentScore)));
    setPhase('answer');
  }

  function selectChoice(choiceIndex: number) {
    if (phase !== 'answer') return;
    setPrevSnapshot({ scores, phase, bet, selectedChoice });
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
    setPrevSnapshot(null);
  }

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div className={`wlq-stage w-full max-w-[720px] ${clay ? 'wlq-clay' : ''}`}>
        <div className="mb-4 flex justify-center gap-3">
          <div className={`wlq-score is-blue ${turn === 'blue' ? 'is-turn' : ''}`}>
            <span className="wlq-score-name">{teamLabel('blue')}</span>
            <span className="wlq-score-num">{scores.blue}</span>
          </div>
          <div className={`wlq-score is-red ${turn === 'red' ? 'is-turn' : ''}`}>
            <span className="wlq-score-name">{teamLabel('red')}</span>
            <span className="wlq-score-num">{scores.red}</span>
          </div>
        </div>

        <div className={`wlq-turn ${turn === 'blue' ? 'is-blue' : 'is-red'}`}>
          {t('gameWinLoseQuiz.turnLabel', { team: teamLabel(turn) })}
        </div>

        {phase === 'bet' ? (
          <>
            <div className="wlq-prompt">{t('gameWinLoseQuiz.betPrompt')}</div>
            <div className="flex flex-wrap justify-center gap-3">
              {betOptions
                .filter((amount) => amount > 0)
                .map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    disabled={currentScore < amount}
                    onClick={() => placeBet(amount)}
                    className="wlq-chip-btn"
                  >
                    {amount}
                  </button>
                ))}
              <button
                type="button"
                disabled={currentScore <= 0}
                onClick={() => placeBet(currentScore)}
                className="wlq-chip-btn is-allin"
              >
                {t('gameWinLoseQuiz.betAllIn', { score: currentScore })}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="wlq-bet-pill">
              {t('gameWinLoseQuiz.currentBetLabel', { bet })}
            </div>

            <div className="wlq-prompt">{current.question}</div>

            <div className="mt-1 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
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
                    className={`wlq-choice ${clay ? `wlq-clay-${i % 4}` : ''} ${
                      revealed && isCorrect ? 'is-ok' : revealed && isSelected ? 'is-no' : ''
                    }`}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {phase === 'reveal' && (
        <div className="mt-5 flex flex-col items-center gap-4">
          <div className={`wlq-result ${selectedChoice === current.correctIndex ? 'is-ok' : 'is-no'}`}>
            {selectedChoice === current.correctIndex
              ? t('gameWinLoseQuiz.correctFeedback', { bet })
              : t('gameWinLoseQuiz.wrongFeedback', { bet })}
          </div>
          <button type="button" onClick={next} className={pill}>
            {t('gameWinLoseQuiz.nextButton')}
          </button>
        </div>
      )}
    </div>
  );
});

export default WinLoseQuiz;
