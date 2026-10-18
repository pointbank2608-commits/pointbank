import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SoloPlayerApi } from './SoloPlayer';
import type { SoloStep } from '../../lib/soloLessons';
import type { GameItem, MatchPair } from '../../lib/types';
import Anagram from '../Anagram';
import Hangman from '../Hangman';
import Matchup from '../Matchup';
import WhackAMole from '../WhackAMole';
import WordSearch from '../WordSearch';
import GameLearningCheck from './GameLearningCheck';
import type { GameCheckSummary } from '../../lib/gameLearning';

type GameStep = Extract<SoloStep, { t: 'game' }>;

/**
 * 개별수업 "게임" 단계(2026-10-13) — 선생님이 만든 게임 템플릿을 학생이 혼자 한다.
 * 게임 점수는 스탯에 넣지 않고, 게임 뒤 서버 채점 확인 문제(088a)로 학습 수행을 기록한다.
 * 지원: 매치업(단어↔뜻 짝)·애너그램(섞인 글자로 단어 만들기)·두더지잡기·워드서치·행맨. 다른 게임은 혼자 모드(완료 알림 + 다시 하기 숨김)를 만든 뒤 같은 자리에 하나씩 붙인다.
 */
export default function SoloGameStep({ step, load, busy, onDone, api, stepIndex, preview }: { step: GameStep; load: SoloPlayerApi['gameTemplate']; busy: boolean; onDone: (summary?:GameCheckSummary) => void; api: SoloPlayerApi; stepIndex: number; preview?: boolean }) {
  const { t } = useTranslation();
  const checkOpen=api.gameCheckOpen;
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [checking, setChecking] = useState(false);
  const [pairs, setPairs] = useState<MatchPair[]>([]);
  const [words, setWords] = useState<GameItem[]>([]);
  const [cfg, setCfg] = useState<{ maxAttempts: number; whackMode: 'wordToMeaning' | 'meaningToWord'; whackSeconds: number; searchStyle: 'board' | 'tiles' }>({
    maxAttempts: 6,
    whackMode: 'wordToMeaning',
    whackSeconds: 0,
    searchStyle: 'board',
  });
  /** 틀린 횟수(매치업) 또는 맞힌 개수(애너그램) — 끝났을 때만 값이 있다 */
  const [result, setResult] = useState<{ wrong?: number; score?: number; total?: number; hits?: number; misses?: number; text?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    setState('loading');
    setResult(null);
    if (!load || !step.templateId) {
      setState('failed');
      return;
    }
    load(step.templateId)
      .then((tpl) => {
        if (!alive) return;
        const sameType = !!tpl && tpl.game_type === step.gameType;
        const conf = (tpl?.config ?? {}) as { pairs?: MatchPair[]; maxAttempts?: number; whackMode?: string; whackSeconds?: number; wordSearchStyle?: string };
        if (step.gameType === 'anagram' || step.gameType === 'hangman' || step.gameType === 'wordsearch') {
          const raw = ((tpl?.items ?? []) as GameItem[]).filter((i) => i && typeof i.label === 'string' && i.label.trim());
          const need = step.gameType === 'wordsearch' ? 2 : 1;
          setWords(sameType ? raw : []);
          setCfg((c) => ({
            ...c,
            maxAttempts: typeof conf.maxAttempts === 'number' && conf.maxAttempts > 0 ? conf.maxAttempts : 6,
            searchStyle: conf.wordSearchStyle === 'tiles' ? 'tiles' : 'board',
          }));
          setState(sameType && raw.length >= need ? 'ready' : 'failed');
          return;
        }
        const raw = (conf.pairs ?? []).filter((p) => p && p.left?.trim() && p.right?.trim());
        if (step.gameType === 'whackamole') {
          setCfg((c) => ({
            ...c,
            whackMode: conf.whackMode === 'meaningToWord' ? 'meaningToWord' : 'wordToMeaning',
            whackSeconds: typeof conf.whackSeconds === 'number' && conf.whackSeconds > 0 ? conf.whackSeconds : 0,
          }));
        }
        const ok = sameType && raw.length >= 2;
        setPairs(ok ? raw : []);
        setState(ok ? 'ready' : 'failed');
      })
      .catch(() => alive && setState('failed'));
    // 게임 시작 시 확인 문제를 고정한다. 준비 실패는 게임을 막지 않고 확인 화면에서 재시도한다.
    if(step.measure !== false)void checkOpen?.(stepIndex).catch(()=>undefined);
    return () => {
      alive = false;
    };
  }, [load, step.templateId, step.gameType,step.measure,checkOpen,stepIndex]);

  const btn = 'min-h-14 rounded-2xl px-5 text-xl font-bold [touch-action:manipulation] disabled:opacity-40';
  if (checking) return <GameLearningCheck api={api} step={stepIndex} onDone={onDone} preview={preview} />;
  if (state === 'loading') return <p className="text-lg text-white/70">{t('common.loading')}</p>;
  if (state === 'failed') {
    return (
      <>
        <p className="text-center text-lg text-white/85">{t('solo.gameFailed')}</p>
        <button type="button" disabled={busy} onClick={()=>onDone()} className={`${btn} w-full bg-warm-yellow text-deep-navy`}>
          {t('solo.gameSkip')}
        </button>
      </>
    );
  }
  return (
    <>
      {step.title && <h2 className="text-center text-2xl font-bold">{step.title}</h2>}
      <div className="w-full rounded-3xl bg-white p-2 text-deep-navy">
        {step.gameType === 'anagram' ? (
          <Anagram items={words} onComplete={(score, total) => setResult({ score, total })} />
        ) : step.gameType === 'hangman' ? (
          <Hangman items={words} maxAttempts={cfg.maxAttempts} onComplete={(score, total) => setResult({ score, total })} />
        ) : step.gameType === 'wordsearch' ? (
          <WordSearch items={words} boardStyle={cfg.searchStyle} onComplete={() => setResult({ text: t('solo.gameDoneSearch') })} />
        ) : step.gameType === 'whackamole' ? (
          <WhackAMole pairs={pairs} mode={cfg.whackMode} timeLimit={cfg.whackSeconds} onComplete={(hits, misses) => setResult({ hits, misses })} />
        ) : (
          <Matchup pairs={pairs} onComplete={(w) => setResult({ wrong: w })} />
        )}
      </div>
      {result !== null && (
        <>
          <p className="text-center text-xl font-bold text-emerald-200">
            {result.text
              ? result.text
              : result.hits !== undefined
                ? t('solo.gameDoneWhack', { hits: result.hits, misses: result.misses ?? 0 })
                : result.score !== undefined
                  ? t(step.gameType === 'hangman' ? 'solo.gameDoneHangman' : 'solo.gameDoneScore', { score: result.score, total: result.total })
                  : t('solo.gameDone', { count: result.wrong ?? 0 })}
          </p>
          <button type="button" disabled={busy} onClick={() => step.measure === false ? onDone() : setChecking(true)} className={`${btn} w-full bg-warm-yellow text-deep-navy`}>
            {step.measure === false ? t('solo.next') : t('solo.gameCheckStart', {defaultValue:'혼자 확인하고 마치기'})}
          </button>
        </>
      )}
    </>
  );
}
