import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { speak } from '../../lib/speech';
import type { HwQuestion } from '../../lib/homework/types';
import { TextAnswer } from '../../pages/LiveJoinPage';

const CHOICE_COLORS = ['#e5484d', '#2f6fdb', '#d99a00', '#2e9e5b', '#8e4ec6', '#12a594'];

/**
 * 숙제 문제 한 개(학생 화면·선생님 미리보기 공용) — 보기 고르기 · 철자 입력 · 낱말/글자 순서(탭으로 놓기).
 * 답을 정하면 onAnswer(응답 글)를 부른다. 채점은 하지 않는다(서버 또는 미리보기가 한다).
 */
export default function QuestionCard({ q, onAnswer, disabled, eliminated }: { q: HwQuestion; onAnswer: (response: string) => void; disabled: boolean; /** 도움말로 지운 보기 번호(단어암기숙제) */ eliminated?: number[] }) {
  const { t } = useTranslation();
  const listen = q.style === 'listen' || q.style === 'whack';

  useEffect(() => {
    if (listen && q.speak) speak(q.speak);
  }, [q.id, listen, q.speak]);

  const memo = q.style === 'flash' || q.style === 'fade';
  const guide = t(`studentHw.guide_${q.style ?? (q.qtype === 'text' ? 'spell' : q.qtype === 'order' ? 'letters' : 'any')}`);
  const speakBtn = (big: boolean) =>
    q.speak ? (
      <button
        type="button"
        onClick={() => speak(q.speak!)}
        aria-label={t('studentHw.listenAgain')}
        className={`flex items-center justify-center gap-2 rounded-full bg-warm-yellow font-bold text-deep-navy shadow-lg active:scale-95 ${big ? 'h-24 w-24' : 'min-h-11 px-4 text-base'}`}
      >
        <span className="material-symbols-outlined" style={{ fontSize: big ? 52 : 22 }}>
          volume_up
        </span>
        {!big && t('studentHw.listen')}
      </button>
    ) : null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col items-center gap-3 px-5 py-4 text-center">
        <div className="text-base text-white/75">{guide}</div>
        {q.imageUrl && <img src={q.imageUrl} alt="" className="h-36 w-36 rounded-2xl bg-white object-contain p-2 sm:h-44 sm:w-44" />}
        {memo ? null : listen ? (
          speakBtn(true)
        ) : (
          <>
            {q.prompt && (
              <div className={`font-bold leading-snug ${q.prompt.length > 50 ? 'text-xl' : q.prompt.length > 20 ? 'text-2xl' : 'text-3xl'}`}>{q.prompt}</div>
            )}
            {q.sub && <div className="text-base text-white/70">({q.sub})</div>}
            {q.style !== 'meaning' && q.speak && q.qtype === 'text' && speakBtn(false)}
            {q.style === 'meaning' && speakBtn(false)}
          </>
        )}
      </div>

      {q.qtype === 'choice' && <ChoiceList q={q} onAnswer={onAnswer} disabled={disabled} eliminated={eliminated} />}
      {q.style === 'flash' && <FlashThenType key={q.id} q={q} onAnswer={onAnswer} disabled={disabled} />}
      {q.style === 'fade' && <FadeThenType key={q.id} q={q} onAnswer={onAnswer} disabled={disabled} />}
      {q.style === 'hangman' && <HangmanInput key={q.id} q={q} onAnswer={onAnswer} disabled={disabled} />}
      {q.qtype === 'text' && !memo && q.style !== 'hangman' && <TextInput key={q.id} onAnswer={onAnswer} disabled={disabled} />}
      {q.qtype === 'order' && <OrderBuilder key={q.id} q={q} onAnswer={onAnswer} disabled={disabled} />}
    </div>
  );
}

function ChoiceList({ q, onAnswer, disabled, eliminated = [] }: { q: HwQuestion; onAnswer: (r: string) => void; disabled: boolean; eliminated?: number[] }) {
  const choices = q.choices ?? [];
  const ox = choices.length === 2 && choices[0] === 'O' && choices[1] === 'X';
  if (q.style === 'whack' || q.style === 'fish' || q.style === 'balloon') {
    const look = {
      whack: { icon: '🐹', wrap: 'grid-cols-2', btn: 'rounded-t-[3rem] rounded-b-2xl bg-[#6b4a2b] pt-4' },
      fish: { icon: '🐟', wrap: 'grid-cols-1 sm:grid-cols-2', btn: 'rounded-full bg-[#2f6fdb]' },
      balloon: { icon: '🎈', wrap: 'grid-cols-2', btn: 'rounded-[3rem] bg-[#e5484d]' },
    }[q.style];
    return (
      <div className={`grid flex-1 content-start gap-4 p-4 ${look.wrap}`}>
        {choices.map((c, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled || eliminated.includes(i)}
            data-choice={i}
            onClick={() => onAnswer(String(i))}
            className={`flex min-h-28 flex-col items-center justify-center gap-1 px-3 py-3 text-center text-xl font-bold text-white shadow-lg active:scale-95 disabled:opacity-60 ${look.btn} ${eliminated.includes(i) ? 'line-through opacity-40!' : ''}`}
          >
            <span className="text-4xl" aria-hidden="true">{look.icon}</span>
            {c}
          </button>
        ))}
      </div>
    );
  }
  if (ox) {
    return (
      <div className="grid flex-1 grid-cols-2 gap-3 p-4">
        {choices.map((c, i) => (
          <button key={c} type="button" disabled={disabled} onClick={() => onAnswer(String(i))} className="min-h-28 rounded-3xl text-7xl font-bold text-white shadow-lg disabled:opacity-60" style={{ background: i === 0 ? '#2f6fdb' : '#e5484d' }}>
            {c}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="grid content-start gap-3 p-4">
      {choices.map((c, i) => (
        <button
          key={i}
          type="button"
          disabled={disabled || eliminated.includes(i)}
          data-choice={i}
          onClick={() => onAnswer(String(i))}
          className={`flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-bold text-white shadow-lg active:scale-[0.98] disabled:opacity-60 ${eliminated.includes(i) ? 'line-through opacity-40!' : ''}`}
          style={{ background: CHOICE_COLORS[i % CHOICE_COLORS.length] }}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/25 text-base">{i + 1}</span>
          {c}
        </button>
      ))}
    </div>
  );
}

function TextInput({ onAnswer, disabled }: { onAnswer: (r: string) => void; disabled: boolean }) {
  const [text, setText] = useState('');
  return <TextAnswer text={text} setText={setText} disabled={disabled} onSubmit={() => text.trim() && !disabled && onAnswer(text.trim())} />;
}

/** 조각을 눌러 차례로 놓고, 놓은 조각을 누르면 되돌린다(끌기 없이도 풀 수 있게) */
function OrderBuilder({ q, onAnswer, disabled }: { q: HwQuestion; onAnswer: (r: string) => void; disabled: boolean }) {
  const { t } = useTranslation();
  const tokens = q.tokens ?? [];
  const [placed, setPlaced] = useState<number[]>([]);
  const letters = q.joiner === '';
  const done = placed.length === tokens.length && tokens.length > 0;
  const tile = `min-h-12 rounded-xl px-3 font-bold shadow-[0_3px_0_#9aa3b5] active:translate-y-0.5 active:shadow-none ${letters ? 'min-w-12 text-2xl' : 'text-lg'}`;
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex min-h-16 flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/30 p-3" aria-live="polite">
        {placed.length === 0 && <span className="text-base text-white/50">{t('studentHw.orderHint')}</span>}
        {placed.map((ti, k) => (
          <button key={k} type="button" disabled={disabled} onClick={() => setPlaced((p) => p.filter((_, j) => j !== k))} className={`${tile} bg-warm-yellow text-deep-navy`}>
            {tokens[ti]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {tokens.map((tok, i) =>
          placed.includes(i) ? (
            <span key={i} className={`${tile} invisible`}>
              {tok}
            </span>
          ) : (
            <button key={i} type="button" disabled={disabled} data-tile={i} onClick={() => setPlaced((p) => [...p, i])} className={`${tile} bg-white text-deep-navy`}>
              {tok}
            </button>
          ),
        )}
      </div>
      <div className="flex gap-3">
        <button type="button" disabled={disabled || placed.length === 0} onClick={() => setPlaced([])} className="min-h-12 flex-1 rounded-full bg-white/15 text-base font-bold text-white disabled:opacity-40">
          {t('studentHw.clearOrder')}
        </button>
        <button
          type="button"
          disabled={disabled || !done}
          data-order-submit
          onClick={() => onAnswer(JSON.stringify(placed.map((i) => tokens[i])))}
          className="min-h-12 flex-[2] rounded-full bg-warm-yellow text-lg font-bold text-deep-navy disabled:opacity-40"
        >
          {t('studentHw.check')}
        </button>
      </div>
    </div>
  );
}

/** 섬광 카드: 낱말(과 뜻·그림)을 잠깐 보여 주고 가린 뒤 떠올려 쓴다 */
function FlashThenType({ q, onAnswer, disabled }: { q: HwQuestion; onAnswer: (r: string) => void; disabled: boolean }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<'ready' | 'show' | 'hide'>('ready');
  useEffect(() => {
    if (phase !== 'show') return;
    const id = window.setTimeout(() => setPhase('hide'), q.flashMs ?? 1500);
    return () => window.clearTimeout(id);
  }, [phase, q.flashMs]);
  return (
    <div className="flex flex-1 flex-col items-center gap-4 px-5 pb-4">
      {phase === 'ready' && (
        <button type="button" onClick={() => { setPhase('show'); if (q.speak) speak(q.speak); }} className="mt-6 min-h-16 rounded-full bg-warm-yellow px-10 text-2xl font-bold text-deep-navy shadow-lg active:scale-95">
          {t('studentHw.flashStart')}
        </button>
      )}
      {phase === 'show' && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-3xl bg-white/10 px-8 py-6">
          {q.imageUrl && <img src={q.imageUrl} alt="" className="h-32 w-32 rounded-2xl bg-white object-contain p-2" />}
          <div className="text-5xl font-bold">{q.prompt}</div>
          {q.sub && <div className="text-lg text-white/75">{q.sub}</div>}
        </div>
      )}
      {phase === 'hide' && (
        <>
          <div className="mt-2 text-2xl font-bold">{t('studentHw.flashRecall')}</div>
          {q.sub && <div className="text-base text-white/70">({q.sub})</div>}
          <div className="w-full"><TextInput onAnswer={onAnswer} disabled={disabled} /></div>
        </>
      )}
    </div>
  );
}

/** 낱말에서 round 번째 가림(0 = 모두 보임). 같은 낱말은 늘 같은 글자가 지워지게 글자 위치로 정한다 */
export function fadeMask(word: string, round: number, rounds: number): string {
  const idx = [...word].map((ch, i) => (/[a-z]/i.test(ch) ? i : -1)).filter((i) => i >= 0);
  const order = [...idx].sort((a, b) => ((a * 7 + 3) % 11) - ((b * 7 + 3) % 11));
  const hide = new Set(order.slice(0, Math.round((idx.length * round) / rounds)));
  return [...word].map((ch, i) => (hide.has(i) ? '_' : ch)).join('');
}

/** 점점 가리기: 읽을 때마다 글자가 지워지고 마지막엔 모두 가려져 직접 쓴다 */
function FadeThenType({ q, onAnswer, disabled }: { q: HwQuestion; onAnswer: (r: string) => void; disabled: boolean }) {
  const { t } = useTranslation();
  const rounds = 3;
  const [round, setRound] = useState(0);
  const word = q.prompt;
  const typing = round >= rounds;
  return (
    <div className="flex flex-1 flex-col items-center gap-4 px-5 pb-4">
      {q.imageUrl && <img src={q.imageUrl} alt="" className="h-28 w-28 rounded-2xl bg-white object-contain p-2" />}
      {q.sub && <div className="text-lg text-white/75">{q.sub}</div>}
      {!typing ? (
        <>
          <div className="font-mono text-5xl font-bold tracking-widest" aria-live="polite">{fadeMask(word, round, rounds)}</div>
          <div className="text-base text-white/70">{t('studentHw.fadeRound', { n: round + 1, total: rounds })}</div>
          <div className="flex gap-3">
            {q.speak && (
              <button type="button" onClick={() => speak(q.speak!)} className="min-h-12 rounded-full bg-white/15 px-5 text-base font-bold text-white">{t('studentHw.listen')}</button>
            )}
            <button type="button" onClick={() => setRound((r) => r + 1)} className="min-h-12 rounded-full bg-warm-yellow px-8 text-lg font-bold text-deep-navy active:scale-95">{t('studentHw.fadeRead')}</button>
          </div>
        </>
      ) : (
        <>
          <div className="text-2xl font-bold">{t('studentHw.fadeWrite')}</div>
          <div className="w-full"><TextInput onAnswer={onAnswer} disabled={disabled} /></div>
        </>
      )}
    </div>
  );
}

/** 행맨: 글자를 하나씩 골라 낱말을 맞힌다(목숨 6개). 끝나면 낱말 전체를 한 번 내고, 서버가 처음 답을 채점한다 */
function HangmanInput({ q, onAnswer, disabled }: { q: HwQuestion; onAnswer: (r: string) => void; disabled: boolean }) {
  const { t } = useTranslation();
  const word = q.speak ?? '';
  const MAX = 6;
  const [picked, setPicked] = useState<string[]>([]);
  const isLetter = (ch: string) => /[a-z]/i.test(ch);
  const shown = (ch: string) => !isLetter(ch) || picked.includes(ch.toLowerCase());
  const wrong = picked.filter((l) => !word.toLowerCase().includes(l)).length;
  const solved = word.length > 0 && [...word].every(shown);
  const dead = wrong >= MAX;
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || disabled || !word) return;
    if (solved) {
      sent.current = true;
      onAnswer(word);
    } else if (dead) {
      sent.current = true;
      onAnswer('-');
    }
  }, [solved, dead, disabled, word, onAnswer]);
  return (
    <div className="flex flex-col items-center gap-4 px-4 pb-4">
      <div className="text-lg text-white/80" aria-live="polite">
        {t('studentHw.hangmanLives', { n: Math.max(MAX - wrong, 0) })} {'❤'.repeat(Math.max(MAX - wrong, 0))}
      </div>
      <div className="flex flex-wrap justify-center gap-2 font-mono text-4xl font-bold tracking-widest" aria-label={t('studentHw.hangmanWord')}>
        {[...word].map((ch, i) => (
          <span key={i} className="min-w-8 border-b-4 border-white/60 text-center">
            {shown(ch) || dead ? ch : ' '}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {'abcdefghijklmnopqrstuvwxyz'.split('').map((l) => (
          <button
            key={l}
            type="button"
            disabled={disabled || solved || dead || picked.includes(l)}
            onClick={() => setPicked((p) => [...p, l])}
            className={`h-11 w-11 rounded-xl text-lg font-bold uppercase shadow active:scale-95 ${picked.includes(l) ? (word.toLowerCase().includes(l) ? 'bg-emerald-300 text-deep-navy' : 'bg-white/20 text-white/50 line-through') : 'bg-white text-deep-navy'}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
