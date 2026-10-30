import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { speak } from '../../lib/speech';

/** 플립 카드: 낱말을 보고 카드를 눌러 뒤집어 뜻·예문을 확인한다. 모든 카드를 한 번씩 뒤집어야 끝낼 수 있다(정답·채점 없음) */
export default function FlipDeck({ text, busy, onDone }: { text: string; busy: boolean; onDone: () => void }) {
  const { t } = useTranslation();
  const cards = text
    .split('\n')
    .map((l) => l.split('|').map((p) => p.trim()))
    .filter((p) => p[0]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [seen, setSeen] = useState<Set<number>>(new Set());
  if (cards.length === 0) return null;
  const [word, meaning, example] = cards[i];
  const flip = () => {
    setFlipped((f) => !f);
    setSeen((s) => new Set(s).add(i));
  };
  const go = (n: number) => {
    setI(n);
    setFlipped(false);
  };
  const all = seen.size >= cards.length;
  const btn = 'min-h-12 rounded-full px-6 text-lg font-bold disabled:opacity-40 active:scale-95';
  return (
    <div className="flex flex-1 flex-col items-center gap-4 p-4">
      <div className="text-base text-white/75">{t('studentHw.flipGuide')} · {i + 1} / {cards.length}</div>
      <button
        type="button"
        onClick={flip}
        aria-label={flipped ? t('studentHw.flipBack') : t('studentHw.flipFront')}
        className={`flex min-h-56 w-full max-w-md flex-col items-center justify-center gap-3 rounded-3xl p-6 text-center shadow-xl transition active:scale-[0.98] ${flipped ? 'bg-warm-yellow text-deep-navy' : 'bg-white text-deep-navy'}`}
      >
        {!flipped ? (
          <>
            <span className="text-5xl font-extrabold">{word}</span>
            <span className="text-sm text-on-surface-variant">{t('studentHw.flipTap')}</span>
          </>
        ) : (
          <>
            <span className="text-3xl font-extrabold">{meaning}</span>
            {example && <span className="text-lg">{example}</span>}
          </>
        )}
      </button>
      <button type="button" onClick={() => speak(example && flipped ? example : word)} className={`${btn} bg-white/15 text-white`}>
        {t('studentHw.listen')}
      </button>
      <div className="mt-auto flex w-full max-w-md items-center justify-between gap-2">
        <button type="button" disabled={i === 0} onClick={() => go(i - 1)} className={`${btn} border border-white/30 text-white`}>
          {t('studentHw.back')}
        </button>
        {i < cards.length - 1 ? (
          <button type="button" onClick={() => go(i + 1)} className={`${btn} bg-warm-yellow text-deep-navy`}>
            {t('studentHw.nextStep')}
          </button>
        ) : (
          <button type="button" disabled={!all || busy} onClick={onDone} className={`${btn} bg-warm-yellow text-deep-navy`}>
            {all ? t('studentHw.flipDone') : t('studentHw.flipAll')}
          </button>
        )}
      </div>
    </div>
  );
}
