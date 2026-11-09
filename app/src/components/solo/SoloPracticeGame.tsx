import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HwQuestion } from '../../lib/homework/types';
import type { SoloPublicQuestion } from '../../lib/soloLessons';
import { speakVerified } from '../../lib/speech';
import QuestionCard from '../homework/QuestionCard';

export default function SoloPracticeGame({ step, disabled, wrong, retryAfterError, onPick, onOrder, onAudio }: {
  step: SoloPublicQuestion;
  disabled: boolean;
  wrong: number[];
  retryAfterError: boolean;
  onPick: (index: number) => void;
  onOrder: (value: string) => void;
  onAudio: () => void;
}) {
  const { t } = useTranslation();
  const [audio, setAudio] = useState<'ready' | 'playing' | 'played' | 'failed'>('ready');
  const style = step.practiceGame;
  const listening = step.t === 'listenPick';
  const audioWord = listening ? step.word : null;
  const order = step.t === 'spell' || step.t === 'unscramble';
  const joiner = step.t === 'spell' ? '' : ' ';
  const q: HwQuestion = {
    id: 'solo-practice',
    qtype: order ? 'order' : 'choice',
    style,
    skill: '',
    word: '',
    gen: step.t === 'spell' ? 'vocab-spelling-train-v1' : order ? 'solo-sentence-train-v1' : 'solo-practice-v1',
    prompt: step.t === 'pickWord' || step.t === 'spell' ? step.meaning
      : step.t === 'fillBlank' ? step.sentence
      : step.t === 'unscramble' ? step.prompt ?? '' : '',
    choices: 'options' in step ? step.options : undefined,
    tokens: step.t === 'spell' ? step.letters : step.t === 'unscramble' ? step.words : undefined,
    imageUrl: 'imageUrl' in step ? step.imageUrl : null,
    joiner,
  };

  async function play() {
    if (!audioWord || audio === 'playing') return;
    setAudio('playing');
    if (await speakVerified(audioWord)) {
      onAudio();
      setAudio('played');
    } else {
      setAudio('failed');
    }
  }

  return (
    <div className="w-full space-y-3">
      {listening && step.prompt && <p className="text-center text-xl font-bold">{step.prompt}</p>}
      {step.t === 'pickCorrect' && <p className="text-center text-xl font-bold">{t('solo.correctQ')}</p>}
      {listening && (
        <div className="flex flex-col items-center gap-2">
          <button type="button" disabled={audio === 'playing'} onClick={() => void play()}
            className="min-h-12 rounded-full bg-[#3b5bdb] px-5 font-bold text-white disabled:opacity-60">
            {t(audio === 'ready' ? 'studentHw.listen' : 'solo.listenAgain')}
          </button>
          {audio === 'failed' && <p role="status">{t('solo.audioPlaybackFailed')}</p>}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl">
        <QuestionCard key={style === 'whack' ? `${wrong.length}-${retryAfterError}` : undefined}
          q={q} disabled={disabled || (listening && audio !== 'played')} eliminated={wrong}
          compact
          guideText={style === 'whack' ? t('solo.whackPractice') : listening ? t('solo.balloonPractice') : undefined}
          onAnswer={(response) => {
            if (order) onOrder((JSON.parse(response) as string[]).join(joiner));
            else onPick(Number(response));
          }} />
      </div>
    </div>
  );
}
