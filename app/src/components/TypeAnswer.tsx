import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TypeAnswerEntry } from '../lib/types';

interface Props {
  entries: TypeAnswerEntry[];
  mode: 'question' | 'cloze';
}

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

export default function TypeAnswer({ entries, mode }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>(() => shuffle(entries.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong'>('playing');
  const [score, setScore] = useState(0);

  if (entries.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">⌨️</div>
        <div className="font-body-md text-body-md">{t('gameTypeAnswer.needEntries')}</div>
      </div>
    );
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
        <div className="text-5xl mb-3">🏆</div>
        <div className="font-title-md text-title-md text-on-surface mb-2">{t('gameTypeAnswer.finishedTitle')}</div>
        <div className="font-display-lg text-[40px] text-deep-navy mb-6 tabular-nums">
          {t('gameTypeAnswer.scoreLabel', { score, total: order.length })}
        </div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameTypeAnswer.restartButton')}
        </button>
      </div>
    );
  }

  const current = entries[order[pos]];
  const revealed = status !== 'playing';

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
      className={`bg-surface-container-lowest border-b-2 px-2 py-1 font-body-md text-body-md text-on-surface text-center focus:outline-none ${
        revealed
          ? status === 'correct'
            ? 'border-secondary text-secondary'
            : 'border-error text-error'
          : 'border-primary'
      }`}
      style={{ width: `${Math.max(6, inputValue.length + 2)}ch` }}
    />
  );

  const clozeParts = mode === 'cloze' ? current.prompt.split('___') : null;

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="font-caption text-caption text-on-surface-variant mb-4 tabular-nums">
        {pos + 1} / {order.length}
      </div>

      {mode === 'cloze' && clozeParts && clozeParts.length >= 2 ? (
        <div className="font-display-lg text-[26px] text-deep-navy mb-6 text-center [word-break:keep-all] max-w-[560px] leading-relaxed">
          {clozeParts[0]}
          {blankInput}
          {clozeParts.slice(1).join('___')}
        </div>
      ) : (
        <>
          <div className="font-display-lg text-[28px] text-deep-navy mb-6 text-center [word-break:keep-all] max-w-[560px]">
            {current.prompt}
          </div>
          <div className="mb-6">{blankInput}</div>
        </>
      )}

      {!revealed ? (
        <button
          onClick={submit}
          className="px-8 py-2.5 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
        >
          {t('gameTypeAnswer.submitButton')}
        </button>
      ) : (
        <div className="result-pop flex flex-col items-center gap-3">
          <div
            className={`px-6 py-2.5 rounded-full font-title-md text-title-md shadow-sm ${
              status === 'correct'
                ? 'bg-secondary-container/50 text-on-surface'
                : 'bg-error-container text-on-error-container'
            }`}
          >
            {status === 'correct'
              ? t('gameTypeAnswer.correctFeedback')
              : t('gameTypeAnswer.wrongFeedback', { answer: current.answer })}
          </div>
          <button
            onClick={next}
            className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
          >
            {t('gameTypeAnswer.nextButton')}
          </button>
        </div>
      )}
    </div>
  );
}
