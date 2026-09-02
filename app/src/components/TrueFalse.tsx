import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrueFalseStatement } from '../lib/types';

interface Props {
  statements: TrueFalseStatement[];
}

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

export default function TrueFalse({ statements }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>(() => shuffle(statements.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [selected, setSelected] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const statementKey = statements.map((s) => s.id).join(',');

  useEffect(() => {
    setOrder(shuffle(statements.map((_, i) => i)));
    setPos(0);
    setSelected(null);
    setScore(0);
  }, [statementKey]);

  if (statements.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <span className="tf-mark tf-mark-o mx-auto mb-3" />
        <div className="font-body-md text-body-md">{t('gameTrueFalse.needStatements')}</div>
      </div>
    );
  }

  if (order.length === 0) {
    return null;
  }

  const finished = pos >= order.length;

  function restart() {
    setOrder(shuffle(statements.map((_, i) => i)));
    setPos(0);
    setSelected(null);
    setScore(0);
  }

  function selectAnswer(answer: boolean) {
    if (selected !== null || finished) return;
    const current = statements[order[pos]];
    if (!current) return;
    setSelected(answer);
    if (answer === current.isTrue) setScore((s) => s + 1);
  }

  function next() {
    setPos((p) => p + 1);
    setSelected(null);
  }

  if (finished) {
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
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameTrueFalse.finishedTitle')}</div>
            <div className="font-display-lg text-[40px] tabular-nums text-deep-navy">
              {t('gameTrueFalse.scoreLabel', { score, total: order.length })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameTrueFalse.restartButton')}
        </button>
      </div>
    );
  }

  const current = statements[order[pos]];
  // 편집 화면에서 문장을 지운 직후 한 프레임 동안은 order 가 아직 옛 길이 기준이라
  // 범위를 벗어날 수 있다 — 위 useEffect 가 재동기화하기 전까지 이 프레임만 건너뛴다.
  if (!current) return null;
  const revealed = selected !== null;
  const gotItRight = selected === current.isTrue;

  function tokenState(value: boolean) {
    if (!revealed) return '';
    const isCorrect = value === current.isTrue;
    const isPicked = value === selected;
    if (isCorrect) return 'is-ok';
    if (isPicked) return 'is-no';
    return 'is-dim';
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="mb-4 rounded-full bg-secondary px-4 py-1 font-title-md text-[14px] font-bold tabular-nums text-on-secondary">
        {pos + 1} / {order.length}
      </div>

      <div
        data-skin-stage="board"
        className="mb-6 w-full max-w-[520px] px-2 py-2"
        style={{
          borderRadius: 22,
          background: 'linear-gradient(180deg, #f8e4b8 0%, #e8c48a 42%, #c9964e 100%)',
          boxShadow: woodShadow,
        }}
      >
        <div
          className="flex min-h-[96px] items-center justify-center px-4 py-4"
          style={{
            borderRadius: 16,
            background: 'linear-gradient(180deg, #fffef9 0%, #fff4e0 100%)',
            boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -3px 4px rgba(166,112,48,0.16)',
          }}
        >
          <div className="text-center font-bold leading-snug text-deep-navy [word-break:keep-all] text-[clamp(20px,3.6vw,30px)]">
            {current.text}
          </div>
        </div>
      </div>

      <div className="mb-5 grid w-full max-w-[480px] grid-cols-2 gap-4 sm:gap-8">
        <button
          type="button"
          disabled={revealed}
          onClick={() => selectAnswer(true)}
          data-skin-object="choice"
          className={`tf-token ${tokenState(true)}`}
        >
          <span className="tf-mark tf-mark-o" />
          <span className="tf-chip">{t('gameTrueFalse.trueLabel')}</span>
        </button>
        <button
          type="button"
          disabled={revealed}
          onClick={() => selectAnswer(false)}
          data-skin-object="choice"
          className={`tf-token ${tokenState(false)}`}
        >
          <span className="tf-mark tf-mark-x" />
          <span className="tf-chip">{t('gameTrueFalse.falseLabel')}</span>
        </button>
      </div>

      {revealed && (
        <div className="result-pop flex flex-col items-center gap-4">
          <div
            className="rounded-full px-6 py-2.5 font-title-md text-title-md font-bold text-white shadow-sm"
            style={{ backgroundColor: gotItRight ? '#3dbea8' : '#f28b73', boxShadow: woodShadow }}
          >
            {gotItRight ? t('gameTrueFalse.correctFeedback') : t('gameTrueFalse.wrongFeedback')}
          </div>
          {!gotItRight && current.explanation?.trim() ? (
            <div className="tf-why w-full max-w-[480px] px-2 py-2">
              <div className="tf-why-inner">
                <div className="mb-1 font-caption text-caption font-bold text-on-surface-variant">
                  {t('gameTrueFalse.explanationTitle')}
                </div>
                <div className="text-center font-body-md text-body-md leading-snug text-deep-navy [word-break:keep-all]">
                  {current.explanation.trim()}
                </div>
              </div>
            </div>
          ) : null}
          <button onClick={next} className={pill}>
            {t('gameTrueFalse.nextButton')}
          </button>
        </div>
      )}
    </div>
  );
}
