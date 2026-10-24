import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { speak } from '../../lib/speech';
import type { FullCardItem } from '../../lib/types';

/** 예문 읽기: 한 장에 한 문장(또는 낱말)을 크게. 듣기·뜻 보기·이전/다음. 키보드 ← → Space. */
export default function BoardSentenceReader({ cards, onClose }: { cards: FullCardItem[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [pos, setPos] = useState(0);
  const [showKo, setShowKo] = useState(false);
  const card = cards[pos];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') setPos((p) => Math.min(cards.length - 1, p + 1));
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') setPos((p) => Math.max(0, p - 1));
      else if (e.key === ' ') {
        e.preventDefault();
        setShowKo((v) => !v);
      } else if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cards.length, onClose]);

  useEffect(() => setShowKo(false), [pos]);

  if (!card) return <p className="p-8 text-center text-xl">{t('whiteboard.readerEmpty')}</p>;
  const len = card.word.length;
  const size = len > 70 ? 'clamp(24px,3.6vw,52px)' : len > 40 ? 'clamp(30px,5vw,72px)' : len > 18 ? 'clamp(38px,6.5vw,96px)' : 'clamp(48px,9vw,140px)';
  const btn = 'min-h-14 rounded-2xl border-2 border-outline-variant bg-white px-6 py-3 text-xl font-bold text-deep-navy shadow disabled:opacity-30 focus-visible:outline-4 focus-visible:outline-primary';
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center" data-board-reader>
      <div className="text-lg font-bold text-on-surface-variant">{t('whiteboard.readerPos', { n: pos + 1, total: cards.length })}</div>
      <p lang="en" className="max-w-[92vw] font-extrabold leading-tight text-deep-navy" style={{ fontSize: size }}>
        {card.word}
      </p>
      <p className="min-h-12 max-w-[90vw] text-3xl text-on-surface-variant" aria-live="polite">
        {showKo ? card.meaning || '—' : ''}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" className={btn} disabled={pos === 0} onClick={() => setPos((p) => p - 1)}>
          ◀ {t('whiteboard.readerPrev')}
        </button>
        <button type="button" className={`${btn} bg-primary! text-white!`} onClick={() => speak(card.word)}>
          🔊 {t('whiteboard.readerListen')}
        </button>
        <button type="button" className={btn} aria-pressed={showKo} onClick={() => setShowKo((v) => !v)}>
          {showKo ? t('whiteboard.readerHideKo') : t('whiteboard.readerKo')}
        </button>
        <button type="button" className={btn} disabled={pos >= cards.length - 1} onClick={() => setPos((p) => p + 1)}>
          {t('whiteboard.readerNext')} ▶
        </button>
      </div>
    </div>
  );
}
