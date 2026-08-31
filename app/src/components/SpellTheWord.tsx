import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
  previewSeconds: number;
}

type Phase = 'preview' | 'input';
type Status = 'playing' | 'correct' | 'wrong';

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

export default function SpellTheWord({ items, previewSeconds }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<Phase>('preview');
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<Status>('playing');
  const [score, setScore] = useState(0);
  const timerRef = useRef<number | null>(null);
  const previewMs = Math.max(500, previewSeconds * 1000);

  function startPreview() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setPhase('preview');
    timerRef.current = window.setTimeout(() => setPhase('input'), previewMs);
  }

  useEffect(() => {
    if (items.length > 0) startPreview();
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">✏️</div>
        <div className="font-body-md text-body-md">{t('gameSpellWord.needParticipants')}</div>
      </div>
    );
  }

  const finished = pos >= order.length;

  function restart() {
    const nextOrder = shuffle(items.map((_, i) => i));
    setOrder(nextOrder);
    setPos(0);
    setScore(0);
    setInputValue('');
    setStatus('playing');
    startPreview();
  }

  function next() {
    const nextPos = pos + 1;
    setPos(nextPos);
    setInputValue('');
    setStatus('playing');
    if (nextPos < order.length) startPreview();
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div className="text-5xl mb-3">🏆</div>
        <div className="font-title-md text-title-md text-on-surface mb-2">{t('gameSpellWord.finishedTitle')}</div>
        <div className="font-display-lg text-[40px] text-deep-navy mb-6 tabular-nums">
          {t('gameSpellWord.scoreLabel', { score, total: order.length })}
        </div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameSpellWord.restartButton')}
        </button>
      </div>
    );
  }

  const target = items[order[pos]].label;
  const revealed = status !== 'playing';

  function submit() {
    if (phase !== 'input' || revealed) return;
    const ok = normalize(inputValue) === normalize(target);
    setStatus(ok ? 'correct' : 'wrong');
    if (ok) setScore((s) => s + 1);
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="font-caption text-caption text-on-surface-variant mb-4 tabular-nums">
        {pos + 1} / {order.length}
      </div>

      {phase === 'preview' ? (
        <>
          <div className="font-caption text-caption text-on-surface-variant mb-3">{t('gameSpellWord.previewHint')}</div>
          <div className="font-display-lg text-[36px] text-deep-navy mb-8 text-center [word-break:keep-all] max-w-[560px]">
            {target}
          </div>
        </>
      ) : (
        <>
          <div className="text-5xl mb-6">✏️</div>
          <input
            type="text"
            value={inputValue}
            disabled={revealed}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder={t('gameSpellWord.answerPlaceholder')}
            className={`w-full max-w-[320px] text-center bg-surface-container-lowest border-b-2 px-3 py-2.5 font-display-lg text-[22px] text-on-surface focus:outline-none mb-6 ${
              revealed ? (status === 'correct' ? 'border-secondary text-secondary' : 'border-error text-error') : 'border-primary'
            }`}
          />

          {!revealed ? (
            <button
              onClick={submit}
              className="px-8 py-2.5 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
            >
              {t('gameSpellWord.submitButton')}
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
                {status === 'correct' ? t('gameSpellWord.correctFeedback') : t('gameSpellWord.wrongFeedback', { word: target })}
              </div>
              <button
                onClick={next}
                className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
              >
                {t('gameSpellWord.nextButton')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
