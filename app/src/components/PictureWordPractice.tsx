import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMON_SFX, playSfx } from '../lib/gameSfx';
import { pictureQuizDeck } from '../lib/pictureWordQuestions';
import type { GameTemplateConfig } from '../lib/types';

export default function PictureWordPractice({ config, restart }: { config: GameTemplateConfig; restart: () => void }) {
  const { t } = useTranslation();
  const questions = useMemo(() => pictureQuizDeck(config, []), [config]);
  const [index, setIndex] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [answered, setAnswered] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const question = questions[index];

  return <section className="mx-auto grid w-full max-w-3xl gap-4 rounded-3xl bg-white p-5 text-center text-deep-navy shadow-lg sm:p-8" data-picture-practice>
    <h2 className="text-xl font-extrabold">{t('picturePractice.title')}</h2>
    {!question ? <>
      <p role="status" className="text-lg font-bold">{questions.length ? t('picturePractice.results', { count: firstTry, total: questions.length - skipped }) : t('gameWordHoops.pictureNeedsList')}</p>
      {skipped > 0 && <p>{t('picturePractice.skipped', { count: skipped })}</p>}
      {questions.length > 0 && <button className="mx-auto min-h-12 rounded-xl bg-primary px-6 font-bold text-white" onClick={restart}>{t('gamePlay.restart')}</button>}
    </> : <>
      <p className="text-sm font-semibold tabular-nums">{index + 1} / {questions.length}</p>
      {imageFailed
        ? <p role="status" className="rounded-xl bg-surface-container-low p-4">{t('picturePractice.imageMissing')}</p>
        : <img key={question.id} data-picture-word src={question.imageUrl} alt={t('gameWordHoops.askWord')} onError={() => setImageFailed(true)} draggable={false} className="mx-auto h-[min(30vh,240px)] w-full rounded-xl object-contain" />}
      {!imageFailed && <div className="grid gap-2 sm:grid-cols-2">
        {question.choices.map((word, choice) => <button key={word} type="button" disabled={answered || wrong.includes(choice)}
          className={`min-h-12 break-words rounded-xl border-2 px-4 py-2 text-lg font-bold focus-visible:outline-4 focus-visible:outline-primary ${answered && choice === question.correctIndex ? 'border-green-600 bg-green-100' : wrong.includes(choice) ? 'border-red-300 bg-red-50 line-through' : 'border-sky-200 bg-sky-50 enabled:hover:border-primary'}`}
          onClick={() => {
            if (choice !== question.correctIndex) { setWrong(previous => [...previous, choice]); playSfx(COMMON_SFX.tryAgain); return; }
            if (!wrong.length) setFirstTry(value => value + 1);
            setAnswered(true);
            playSfx(COMMON_SFX.praise);
          }}>{word}</button>)}
      </div>}
      <p role="status" className="min-h-6 text-sm font-bold">{answered ? t('picturePractice.correct') : wrong.length ? t('picturePractice.retry') : ''}</p>
      {(answered || imageFailed) && <button className="mx-auto min-h-12 rounded-xl bg-primary px-6 font-bold text-white" onClick={() => {
        if (imageFailed) setSkipped(value => value + 1);
        setIndex(value => value + 1); setWrong([]); setAnswered(false); setImageFailed(false);
      }}>{t(index + 1 === questions.length ? 'picturePractice.showResults' : 'picturePractice.next')}</button>}
    </>}
  </section>;
}
