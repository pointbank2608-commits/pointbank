import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SoloPlayerApi } from './SoloPlayer';
import type { SoloStep } from '../../lib/soloLessons';
import type { GameItem, MatchPair } from '../../lib/types';
import Anagram from '../Anagram';
import Matchup from '../Matchup';

type GameStep = Extract<SoloStep, { t: 'game' }>;

/**
 * 개별수업 "게임" 단계(2026-10-13) — 선생님이 만든 게임 템플릿을 학생이 혼자 한다.
 * 템플릿은 서버 창구(069 student_game_template)로 읽고, 끝나면 "다음"으로 완료를 알린다(서버 채점 없음 — 스탯에는 넣지 않는다).
 * 지금은 매치업(단어↔뜻 짝)과 애너그램(섞인 글자로 단어 만들기)을 지원한다. 다른 게임은 혼자 모드(완료 알림 + 다시 하기 숨김)를 만든 뒤 같은 자리에 하나씩 붙인다.
 */
export default function SoloGameStep({ step, load, busy, onDone }: { step: GameStep; load: SoloPlayerApi['gameTemplate']; busy: boolean; onDone: () => void }) {
  const { t } = useTranslation();
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [pairs, setPairs] = useState<MatchPair[]>([]);
  const [words, setWords] = useState<GameItem[]>([]);
  /** 틀린 횟수(매치업) 또는 맞힌 개수(애너그램) — 끝났을 때만 값이 있다 */
  const [result, setResult] = useState<{ wrong?: number; score?: number; total?: number } | null>(null);

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
        if (step.gameType === 'anagram') {
          const raw = ((tpl?.items ?? []) as GameItem[]).filter((i) => i && typeof i.label === 'string' && i.label.trim());
          setWords(sameType ? raw : []);
          setState(sameType && raw.length >= 1 ? 'ready' : 'failed');
          return;
        }
        const raw = (tpl?.config as { pairs?: MatchPair[] } | undefined)?.pairs ?? [];
        const ok = sameType && raw.length >= 2;
        setPairs(ok ? raw : []);
        setState(ok ? 'ready' : 'failed');
      })
      .catch(() => alive && setState('failed'));
    return () => {
      alive = false;
    };
  }, [load, step.templateId, step.gameType]);

  const btn = 'min-h-14 rounded-2xl px-5 text-xl font-bold [touch-action:manipulation] disabled:opacity-40';
  if (state === 'loading') return <p className="text-lg text-white/70">{t('common.loading')}</p>;
  if (state === 'failed') {
    return (
      <>
        <p className="text-center text-lg text-white/85">{t('solo.gameFailed')}</p>
        <button type="button" disabled={busy} onClick={onDone} className={`${btn} w-full bg-warm-yellow text-deep-navy`}>
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
        ) : (
          <Matchup pairs={pairs} onComplete={(w) => setResult({ wrong: w })} />
        )}
      </div>
      {result !== null && (
        <>
          <p className="text-center text-xl font-bold text-emerald-200">
            {result.score !== undefined ? t('solo.gameDoneScore', { score: result.score, total: result.total }) : t('solo.gameDone', { count: result.wrong ?? 0 })}
          </p>
          <button type="button" disabled={busy} onClick={onDone} className={`${btn} w-full bg-warm-yellow text-deep-navy`}>
            {t('solo.next')}
          </button>
        </>
      )}
    </>
  );
}
