import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TypeAnswerEntry } from '../lib/types';

export type TypeAnswerStyle = 'notebook' | 'bubble';

interface Props {
  entries: TypeAnswerEntry[];
  mode: 'question' | 'cloze';
  boardStyle?: TypeAnswerStyle;
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

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export default function TypeAnswer({ entries, mode, boardStyle = 'notebook' }: Props) {
  const { t } = useTranslation();
  const bubble = boardStyle === 'bubble';
  const [order, setOrder] = useState<number[]>(() => shuffle(entries.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong'>('playing');
  const [score, setScore] = useState(0);
  const entryKey = `${mode}:${entries.map((e) => e.id).join(',')}`;

  useEffect(() => {
    const nextOrder = shuffle(entries.map((_, i) => i));
    setOrder(nextOrder);
    setPos(0);
    setInputValue('');
    setStatus('playing');
    setScore(0);
  }, [entryKey]);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mx-auto mb-3 flex justify-center">
          <div className="ta-book pointer-events-none w-[160px] p-2">
            <div className="ta-page min-h-[72px] py-4 text-[18px]">?</div>
          </div>
        </div>
        <div className="font-body-md text-body-md">{t('gameTypeAnswer.needEntries')}</div>
      </div>
    );
  }

  if (order.length === 0) {
    return null;
  }

  const finished = pos >= order.length;

  function restart() {
    setOrder(shuffle(entries.map((_, i) => i)));
    setPos(0);
    setInputValue('');
    setStatus('playing');
    setScore(0);
  }

  function next() {
    setPos((p) => p + 1);
    setInputValue('');
    setStatus('playing');
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
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameTypeAnswer.finishedTitle')}</div>
            <div className="font-display-lg text-[32px] tabular-nums text-deep-navy">
              {t('gameTypeAnswer.scoreLabel', { score, total: order.length })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameTypeAnswer.restartButton')}
        </button>
      </div>
    );
  }

  const current = entries[order[pos]];
  const revealed = status !== 'playing';
  const mark = status === 'correct' ? 'is-ok' : status === 'wrong' ? 'is-no' : '';
  const tone = pos % 4;

  function submit() {
    if (revealed) return;
    const ok = normalize(inputValue) === normalize(current.answer);
    setStatus(ok ? 'correct' : 'wrong');
    if (ok) setScore((s) => s + 1);
  }

  const blankInput = (
    <input
      type="text"
      value={inputValue}
      disabled={revealed}
      onChange={(e) => setInputValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submit();
      }}
      placeholder={t('gameTypeAnswer.answerPlaceholder')}
      data-skin-object="answer-input"
      className={`ta-input ${mark}`}
      style={{ width: `${Math.max(8, inputValue.length + 2)}ch` }}
    />
  );

  const clozeParts = mode === 'cloze' ? current.prompt.split('___') : null;
  const useCloze = Boolean(clozeParts && clozeParts.length >= 2);

  const promptBody = useCloze ? (
    <>
      {clozeParts![0]}
      {blankInput}
      {clozeParts!.slice(1).join('___')}
    </>
  ) : (
    current.prompt
  );

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2 w-full">
      <div className="mb-4 rounded-full bg-secondary px-4 py-1 font-title-md text-[14px] font-bold tabular-nums text-on-secondary">
        {pos + 1} / {order.length}
      </div>

      {bubble ? (
        <div data-skin-stage="prompt" className="ta-bubble-wrap mb-2">
          <div className={`ta-bubble ta-clay-${tone}`}>
            {promptBody}
          </div>
          <span className={`ta-bubble-tail ta-clay-${tone}`} aria-hidden />
        </div>
      ) : (
        <div data-skin-stage="prompt" className="ta-book mb-4">
          <div className="ta-page">{promptBody}</div>
        </div>
      )}

      {!useCloze && (
        <div data-skin-stage="answer-well" className="ta-tray mb-5">
          {blankInput}
        </div>
      )}
      {useCloze && bubble && <div className="mb-4" />}

      {!revealed ? (
        <button onClick={submit} className={pill}>
          {t('gameTypeAnswer.submitButton')}
        </button>
      ) : (
        <div className="result-pop flex flex-col items-center gap-3">
          <div
            className={`rounded-full px-5 py-1.5 font-title-md text-[14px] font-bold ${
              status === 'correct' ? 'bg-secondary text-on-secondary' : 'bg-[#f28b73] text-white'
            }`}
          >
            {status === 'correct'
              ? t('gameTypeAnswer.correctFeedback')
              : t('gameTypeAnswer.wrongFeedback', { answer: current.answer })}
          </div>
          <button onClick={next} className={pill}>
            {t('gameTypeAnswer.nextButton')}
          </button>
        </div>
      )}
    </div>
  );
}
