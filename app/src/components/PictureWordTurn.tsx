import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { pauseGameClock } from '../lib/gameClock';
import { pictureQuizDeck } from '../lib/pictureWordQuestions';
import type { GameTemplateConfig, QuizQuestion } from '../lib/types';
import AccessibleDialog from './AccessibleDialog';

type Turn = (action: () => void, word?: string) => void;
const runImmediately: Turn = action => action();
const PictureTurnContext = createContext<Turn>(runImmediately);
const PictureDeckContext = createContext<QuizQuestion[]>([]);

export function usePictureWordDeck() {
  return useContext(PictureDeckContext);
}

export function usePictureWordTurn() {
  return useContext(PictureTurnContext);
}

export function PictureWordTurnProvider({ config, children }: { config?: GameTemplateConfig; children: ReactNode }) {
  const { t } = useTranslation();
  const owner = useId();
  const deck = useMemo(() => pictureQuizDeck(config, []), [config]);
  const position = useRef(0);
  const pending = useRef<(() => void) | null>(null);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => () => pauseGameClock(owner, false), [owner]);

  const ask = useCallback<Turn>((action, word) => {
    if (!deck.length) { action(); return; }
    if (pending.current) return;
    const matching = word && deck.find(row => row.choices[row.correctIndex].toLowerCase() === word.trim().toLowerCase());
    const next = matching || deck[position.current++ % deck.length];
    pending.current = action;
    setQuestion(next);
    setWrong([]);
    setImageFailed(false);
    pauseGameClock(owner, true);
  }, [deck, owner]);

  function close(continueTurn = false) {
    const action = pending.current;
    pending.current = null;
    setQuestion(null);
    pauseGameClock(owner, false);
    if (continueTurn) action?.();
  }

  return <PictureDeckContext.Provider value={deck}><PictureTurnContext.Provider value={deck.length ? ask : runImmediately}>
    {children}
    {question && <AccessibleDialog label={t('picturePractice.title')} onClose={() => close()}>
      <section className="grid gap-4 p-5 text-center text-deep-navy sm:p-7" data-picture-turn>
        <h2 className="text-lg font-extrabold">{t('picturePractice.title')}</h2>
        {imageFailed
          ? <p role="status">{t('picturePractice.turnImageMissing')}</p>
          : <>
              <img data-picture-word src={question.imageUrl} alt={t('gameWordHoops.askWord')} onError={() => setImageFailed(true)} className="mx-auto h-[min(29vh,230px)] w-full object-contain" />
              <div className="grid grid-cols-2 gap-2">
                {question.choices.map((choice, index) => <button key={choice} type="button" disabled={wrong.includes(choice)}
                  className="min-h-12 break-words rounded-xl border-2 border-sky-200 bg-sky-50 px-3 py-2 text-base font-bold enabled:hover:border-primary disabled:line-through"
                  onClick={() => {
                    if (index === question.correctIndex) close(true);
                    else setWrong(previous => [...previous, choice]);
                  }}>{choice}</button>)}
              </div>
              {wrong.length > 0 && <p role="status">{t('picturePractice.retry')}</p>}
            </>}
        <button type="button" className="justify-self-center rounded-xl border px-4 py-2" onClick={() => close()}>{t('common.close')}</button>
      </section>
    </AccessibleDialog>}
  </PictureTurnContext.Provider></PictureDeckContext.Provider>;
}
