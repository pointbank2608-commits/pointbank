import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HwItem } from '../../lib/homework/types';
import type { AnswerResult } from './runnerTypes';

/**
 * 개인용 매치업(2026-10-05) — 낱말을 누르고 뜻을 누르면 짝. 5개씩 한 판.
 * 짝 하나 = 문제 하나(서버 채점). 처음 고른 답이 점수, 틀리면 다시 고를 수 있고 그건 "다시 풀기"로 따로 남는다.
 * 운이 아니라 뜻을 알아야 맞히는 판이라 스탯에 들어간다.
 */
export default function MatchupGame({
  item,
  answered,
  onSubmit,
  onDone,
  faceDown = false,
}: {
  item: HwItem;
  /** 이미 낸 답(이어 풀기) — 문제 번호 → 결과 */
  answered: Map<number, AnswerResult>;
  onSubmit: (qIndex: number, response: string) => Promise<AnswerResult>;
  onDone: () => void;
  faceDown?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const en=i18n.language.startsWith('en');
  const qs = item.content.questions;
  const rounds = useMemo(() => {
    const m = new Map<string, number[]>();
    qs.forEach((q, i) => m.set(q.round ?? '0', [...(m.get(q.round ?? '0') ?? []), i]));
    return [...m.values()];
  }, [qs]);
  // 짝을 맞춘 문제 → 그 뜻(이어 풀기면 서버가 준 정답 글)
  const [matched, setMatched] = useState<Map<number, string>>(() => {
    const m = new Map<number, string>();
    for (const [i, a] of answered) if (faceDown ? a.correct===true : a.correct!==false) m.set(i, a.answer ?? '');
    return m;
  });
  const [round, setRound] = useState(() => Math.max(0, rounds.findIndex((r) => r.some((i) => !matched.has(i)))));
  const [picked, setPicked] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealedMeaning,setRevealedMeaning] = useState<number|null>(null);
  const [awaitingGrade,setAwaitingGrade]=useState(false);
  const resetTimer=useRef<number|undefined>(undefined);
  useEffect(()=>()=>window.clearTimeout(resetTimer.current),[]);

  const current = rounds[round] ?? [];
  const meanings = qs[current[0]]?.choices ?? [];
  const usedMeanings = new Set(current.filter((i) => matched.has(i)).map((i) => matched.get(i)));

  async function choose(mIndex: number) {
    if (picked === null || busy) return;
    const qi = picked;
    setBusy(true);
    setAwaitingGrade(false);
    if (faceDown) setRevealedMeaning(mIndex);
    const res = await onSubmit(qi, String(mIndex));
    if (faceDown && res.correct===null) {
      setAwaitingGrade(true);setPicked(null);setRevealedMeaning(null);setBusy(false);return;
    }
    if (res.correct === false) {
      setShake(qi);
      if (faceDown) {
        resetTimer.current=window.setTimeout(()=>{
          setShake(null);setPicked(null);setRevealedMeaning(null);setBusy(false);
        },700);
      } else {
        setBusy(false);
        resetTimer.current=window.setTimeout(() => setShake(null), 450);
      }
      return;
    }
    setBusy(false);
    setRevealedMeaning(null);
    const next = new Map(matched).set(qi, meanings[mIndex]);
    setMatched(next);
    setPicked(null);
    if (current.every((i) => next.has(i))) {
      if (round + 1 < rounds.length) resetTimer.current=window.setTimeout(() => setRound((r) => r + 1), 450);
      else resetTimer.current=window.setTimeout(onDone, 450);
    }
  }

  const btn = 'min-h-14 w-full rounded-2xl px-3 py-2 text-lg font-bold shadow-lg';
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="text-center text-base text-[#5b6580]">{faceDown
        ? (en?'Turn over a word card, then find its meaning.':'왼쪽 단어 카드를 뒤집고 오른쪽에서 뜻이 맞는 카드를 찾아요.')
        : t('studentHw.guide_match')}</div>
      {rounds.length > 1 && <div className="text-center text-sm text-[#5b6580]">{t('studentHw.roundN', { n: round + 1, total: rounds.length })}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          {current.map((i) => {
            const done = matched.has(i);
            return (
              <button
                key={i}
                type="button"
                disabled={done || busy}
                onClick={() => setPicked(i)}
                aria-pressed={picked === i}
                aria-label={faceDown && !done && picked!==i ? (en?'Word card ':'단어 카드 ')+(current.indexOf(i)+1) : undefined}
                className={`${btn} ${done ? 'bg-emerald-600 text-white' : picked === i ? 'bg-warm-yellow text-deep-navy ring-4 ring-white' : 'bg-white text-deep-navy'} ${shake === i ? 'hw-shake' : ''}`}
              >
                {faceDown && !done && picked!==i ? '★' : qs[i].prompt}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          {meanings.map((m, mi) => {
            const used = usedMeanings.has(m);
            return (
              <button
                key={mi}
                type="button"
                disabled={used || picked === null || busy}
                aria-label={faceDown && !used && revealedMeaning!==mi ? (en?'Meaning card ':'뜻 카드 ')+(mi+1) : undefined}
                onClick={() => void choose(mi)}
                className={`${btn} ${used ? 'bg-emerald-600 text-white' : 'bg-[#2f6fdb] text-white'} disabled:cursor-default ${!used && picked === null ? 'opacity-70' : ''}`}
              >
                {faceDown && !used && revealedMeaning!==mi ? '★' : m}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-center text-sm text-[#5b6580]">{picked === null ? t('studentHw.matchPickWord') : t('studentHw.matchPickMeaning')}</p>
      {awaitingGrade && <p role="status">{en?'Reconnect and choose this pair again.':'인터넷에 연결한 뒤 이 짝을 다시 골라 주세요.'}</p>}
      {faceDown && matched.size===qs.length && <button type="button" onClick={onDone}
        className="mx-auto min-h-11 rounded-full border px-5 font-bold">{t('studentHw.next')}</button>}
      <style>{'.hw-shake{animation:hw-shake .4s}@keyframes hw-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}@media (prefers-reduced-motion:reduce){.hw-shake{animation:none}}'}</style>
    </div>
  );
}
