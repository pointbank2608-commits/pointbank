import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SoloReviewGameType, SoloStep } from '../../lib/soloLessons';
import Anagram from '../Anagram';
import Hangman from '../Hangman';
import Quiz from '../Quiz';
import SentenceSplash from '../SentenceSplash';
import TrueFalse from '../TrueFalse';
import TypeAnswer from '../TypeAnswer';
import WordSearch from '../WordSearch';
import GameShowQuiz from '../GameShowQuiz';
import TugOfWar from '../TugOfWar';
import WordHoops from '../WordHoops';
import CatchSentence from '../CatchSentence';
import AdventureGame from '../adventure/AdventureGame';
import type { SensorAction } from '../../lib/learningSensors/core';

type ReviewStep = Extract<SoloStep, { t: 'game'; gameType: SoloReviewGameType }>;

export default function SoloReviewGame({ step, busy, onDone, onSignal }: { step: ReviewStep; busy: boolean; onDone: () => void; onSignal: (action: SensorAction) => void }) {
  const { t } = useTranslation();
  const [complete, setComplete] = useState(false);
  const { items, config } = step.review;
  const finish = () => setComplete(true);
  const next = () => { if (!busy) onDone(); };
  const submit = () => onSignal('submitted');
  const hint = () => onSignal('hint');
  const activity = (() => {
    switch (step.gameType) {
      case 'anagram': return items.length > 0 && <Anagram items={items} onComplete={finish} />;
      case 'hangman': return items.length > 0 && <Hangman items={items} maxAttempts={6} onComplete={finish} />;
      case 'wordsearch': return items.length > 0 && <WordSearch items={items} onComplete={finish} />;
      case 'quiz': return !!config.questions?.length && <Quiz questions={config.questions} onContinue={next} />;
      case 'gameshowquiz': return !!config.questions?.length &&
        <GameShowQuiz questions={config.questions} bonusEvery={0} lifelines={1} onContinue={next} onHint={hint} onSubmit={submit} />;
      case 'tugofwar': return !!config.questions?.length &&
        <TugOfWar questions={config.questions} pull={config.questions.length} freeze={0} seconds={0} onContinue={next} onSubmit={submit} />;
      case 'wordhoops': return !!config.pairs?.length &&
        <WordHoops pairs={config.pairs} teams={1} shots={config.pairs.length} mode="meaning" rule="race" seconds={0} onContinue={next} onSubmit={submit} />;
      case 'catchsentence': return items.length > 0 && <CatchSentence items={items} teams={1} level={2} seconds={5}
        onContinue={next} onHint={hint} onSubmit={submit} onReveal={() => onSignal('revealed')} />;
      case 'truefalse': return !!config.statements?.length && <TrueFalse statements={config.statements} onContinue={next} />;
      case 'typeanswer': return !!config.typeAnswerEntries?.length && <TypeAnswer entries={config.typeAnswerEntries} mode="question" onContinue={next} />;
      case 'sentencesplash': return items.length > 0 && <SentenceSplash items={items} seconds={config.splashSeconds} onExit={next} />;
      case 'balloonpop':
      case 'wordfishing':
      case 'wordtrain':
      case 'grammardetective':
        return !!config.adventure && <AdventureGame type={step.gameType} config={config.adventure} onContinue={next} />;
    }
  })();
  return <>
    <h2 className="text-center text-2xl font-bold">{step.title}</h2>
    {activity ? <div className="w-full min-w-0 rounded-3xl bg-white p-2 text-deep-navy">{activity}</div>
      : <p role="alert">{t('solo.gameFailed')}</p>}
    {(complete || !activity) && <button type="button" disabled={busy} onClick={next}
      className="min-h-14 w-full rounded-2xl bg-[#3b5bdb] px-5 text-xl font-bold text-white disabled:opacity-40">
      {t(activity ? 'solo.next' : 'solo.gameSkip')}
    </button>}
  </>;
}
