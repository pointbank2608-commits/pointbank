import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

export type SpellWordStyle = 'slate' | 'stamps';

interface Props {
  items: GameItem[];
  previewSeconds: number;
  boardStyle?: SpellWordStyle;
}

type Phase = 'preview' | 'input';
type Status = 'playing' | 'correct' | 'wrong';

const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';
const pill =
  'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

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

function isEditorTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  const tag = el?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export default function SpellTheWord({ items, previewSeconds, boardStyle = 'slate' }: Props) {
  const { t } = useTranslation();
  const stamps = boardStyle === 'stamps';
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<Phase>('preview');
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<Status>('playing');
  const [score, setScore] = useState(0);
  const timerRef = useRef<number | null>(null);
  const previewMs = Math.max(500, previewSeconds * 1000);
  const itemKey = items.map((it) => it.id).join(',');
  const currentLabel =
    items.length > 0 && order.length > 0 && pos < order.length ? items[order[pos]].label : '';
  const playRef = useRef({ phase, status, inputValue, target: currentLabel });
  playRef.current = { phase, status, inputValue, target: currentLabel };

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function startPreview() {
    clearTimer();
    setPhase('preview');
    timerRef.current = window.setTimeout(() => setPhase('input'), previewMs);
  }

  function typeChar(ch: string) {
    if (playRef.current.phase !== 'input' || playRef.current.status !== 'playing') return;
    setInputValue((v) => v + ch);
  }

  function typeBackspace() {
    if (playRef.current.phase !== 'input' || playRef.current.status !== 'playing') return;
    setInputValue((v) => v.slice(0, -1));
  }

  function submit() {
    const snap = playRef.current;
    if (snap.phase !== 'input' || snap.status !== 'playing') return;
    const ok = normalize(snap.inputValue) === normalize(snap.target);
    setStatus(ok ? 'correct' : 'wrong');
    if (ok) setScore((s) => s + 1);
  }

  useEffect(() => {
    const nextOrder = shuffle(items.map((_, i) => i));
    setOrder(nextOrder);
    setPos(0);
    setInputValue('');
    setStatus('playing');
    setScore(0);
    if (items.length > 0) startPreview();
    else clearTimer();
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, previewSeconds]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditorTarget(e.target)) return;
      const snap = playRef.current;
      if (snap.phase !== 'input' || snap.status !== 'playing') return;
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        typeBackspace();
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        typeChar(' ');
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        typeChar(e.key);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mx-auto mb-3 flex justify-center">
          <div className="sw-slate pointer-events-none w-[160px] p-2">
            <div className="sw-face min-h-[72px] py-4 text-[18px]">Aa</div>
          </div>
        </div>
        <div className="font-body-md text-body-md">{t('gameSpellWord.needParticipants')}</div>
      </div>
    );
  }

  if (order.length === 0) {
    return null;
  }

  const finished = pos >= order.length;

  function restart() {
    setOrder(shuffle(items.map((_, i) => i)));
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
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameSpellWord.finishedTitle')}</div>
            <div className="font-display-lg text-[32px] tabular-nums text-deep-navy">
              {t('gameSpellWord.scoreLabel', { score, total: order.length })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameSpellWord.restartButton')}
        </button>
      </div>
    );
  }

  const current = items[order[pos]];
  if (!current) return null;

  const target = current.label;
  const revealed = status !== 'playing';
  const mark = status === 'correct' ? 'is-ok' : status === 'wrong' ? 'is-no' : '';
  const empty = inputValue.length === 0;

  const answerField = (
    <div
      data-skin-object="answer-input"
      className={`sw-input ${mark} ${empty && !revealed ? 'is-empty' : ''}`}
      style={{ width: `${Math.max(8, inputValue.length + 2)}ch` }}
    >
      {empty && !revealed ? t('gameSpellWord.answerPlaceholder') : inputValue || '\u00a0'}
    </div>
  );

  const stampLetters = [...target].map((char, i) =>
    char === ' ' ? (
      <span key={`${i}-gap`} className="sw-gap" aria-hidden />
    ) : (
      <span key={`${i}-${char}`} className={`sw-stamp ag-clay-${i % 4}`}>
        {char}
      </span>
    ),
  );

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div className="mb-3 rounded-full bg-secondary px-4 py-1 font-title-md text-[14px] font-bold tabular-nums text-on-secondary">
        {pos + 1} / {order.length}
      </div>

      {phase === 'preview' && (
        <div className="mb-3 font-caption text-caption text-on-surface-variant">{t('gameSpellWord.previewHint')}</div>
      )}

      {stamps ? (
        <div data-skin-stage="prompt" className="sw-tray mb-5">
          {phase === 'preview' ? stampLetters : answerField}
        </div>
      ) : (
        <div data-skin-stage="prompt" className="sw-slate mb-5">
          <div className="sw-face">{phase === 'preview' ? target : answerField}</div>
        </div>
      )}

      {phase === 'input' && !revealed && (
        <div className="hm-kb mb-5" role="group" aria-label={t('gameSpellWord.keyboardLabel')}>
          {KEY_ROWS.map((row) => (
            <div key={row} className="hm-kb-row">
              {[...row].map((letter) => (
                <button
                  key={letter}
                  type="button"
                  aria-label={letter}
                  className="hm-key"
                  onClick={() => typeChar(letter.toLowerCase())}
                >
                  {letter}
                </button>
              ))}
            </div>
          ))}
          <div className="sw-kb-util">
            <button
              type="button"
              aria-label={t('gameSpellWord.backspaceLabel')}
              className="hm-key sw-key-back"
              onClick={typeBackspace}
            >
              {t('gameSpellWord.backspaceLabel')}
            </button>
            <button
              type="button"
              aria-label={t('gameSpellWord.spaceLabel')}
              className="hm-key sw-key-space"
              onClick={() => typeChar(' ')}
            >
              {t('gameSpellWord.spaceLabel')}
            </button>
          </div>
        </div>
      )}

      {!revealed ? (
        phase === 'input' ? (
          <button onClick={submit} className={pill}>
            {t('gameSpellWord.submitButton')}
          </button>
        ) : (
          <div className="h-[48px]" />
        )
      ) : (
        <div className="result-pop flex flex-col items-center gap-3">
          <div
            className={`rounded-full px-5 py-1.5 font-title-md text-[14px] font-bold ${
              status === 'correct' ? 'bg-secondary text-on-secondary' : 'bg-[#f28b73] text-white'
            }`}
          >
            {status === 'correct'
              ? t('gameSpellWord.correctFeedback')
              : t('gameSpellWord.wrongFeedback', { word: target })}
          </div>
          <button onClick={next} className={pill}>
            {t('gameSpellWord.nextButton')}
          </button>
        </div>
      )}
    </div>
  );
}
