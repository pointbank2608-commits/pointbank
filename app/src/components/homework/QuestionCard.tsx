import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { speak } from '../../lib/speech';
import type { HwQuestion } from '../../lib/homework/types';
import { TextAnswer } from '../../pages/LiveJoinPage';

/** 게임 모양 문제의 머리 그림 */
const SKIN_ICON: Record<string, string> = { monster: '👾', claw: '🧸', maze: '🧭', plane: '✈️', group: '🗂️', cross: '🧩', detective: '🔍', train: '🚂', rocket: '🚀', tower: '🏰', bridge: '🌉', splash: '🌊', whack: '🐹', fish: '🐟', balloon: '🎈', hangman: '🔤' };
/** 교실 게임과 같은 장면 그림(배경)과 보기에 붙는 캐릭터. 그림이 없는 모양은 예전 이모지 머리 그림을 쓴다 */
const STAGE: Record<string, { bg: string; veil: string; sprite?: string }> = {
  fish: { bg: '/skins/adventure/fishing.webp', veil: 'bg-[#06304a]/25', sprite: '/skins/adventure/goldfish.webp' },
  balloon: { bg: '/skins/adventure/balloon.webp', veil: 'bg-[#0b2a4a]/30' },
  whack: { bg: '/skins/bg/whackamole.webp', veil: 'bg-[#2b1a0a]/30', sprite: '/skins/wm-mole.png' },
  claw: { bg: '/skins/adventure/arcade.webp', veil: 'bg-[#3a1246]/35' },
  maze: { bg: '/skins/bg/mazechase.webp', veil: 'bg-[#071a24]/40' },
  plane: { bg: '/skins/bg/airplane.webp', veil: 'bg-[#06223d]/30' },
  group: { bg: '/skins/bg/groupsort.webp', veil: 'bg-[#101a3a]/40' },
  hangman: { bg: '/skins/bg/hangman.webp', veil: 'bg-[#101a3a]/40' },
  train: { bg: '/skins/adventure/train.webp', veil: 'bg-[#101a3a]/35' },
  rocket: { bg: '/skins/adventure/rocket.webp', veil: 'bg-[#0a1230]/35' },
  detective: { bg: '/skins/adventure/detective.webp', veil: 'bg-[#101a3a]/40' },
  cross: { bg: '/skins/bg/crossword.webp', veil: 'bg-[#101a3a]/40' },
};
const CHOICE_COLORS =['#e5484d', '#2f6fdb', '#d99a00', '#2e9e5b', '#8e4ec6', '#12a594'];

/**
 * 숙제 문제 한 개(학생 화면·선생님 미리보기 공용) — 보기 고르기 · 철자 입력 · 낱말/글자 순서(탭으로 놓기).
 * 답을 정하면 onAnswer(응답 글)를 부른다. 채점은 하지 않는다(서버 또는 미리보기가 한다).
 */
export default function QuestionCard({ q, onAnswer, disabled, eliminated }: { q: HwQuestion; onAnswer: (response: string) => void; disabled: boolean; /** 도움말로 지운 보기 번호(단어암기숙제) */ eliminated?: number[] }) {
  const { t } = useTranslation();
  const listen = q.style === 'listen' || q.style === 'whack' || q.style === 'dictation' || q.style === 'plane';

  useEffect(() => {
    if (listen && q.speak) speak(q.speak);
  }, [q.id, listen, q.speak]);

  const memo = q.style === 'flash' || q.style === 'fade' || q.style === 'sfade';
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

  const stage = q.style ? STAGE[q.style] : undefined;
  return (
    <div className="relative isolate flex flex-1 flex-col bg-cover bg-center" style={stage ? { backgroundImage: `url(${stage.bg})` } : undefined}>
      {stage && <div className={`pointer-events-none absolute inset-0 -z-10 ${stage.veil}`} aria-hidden="true" />}
      <div className="flex flex-col items-center gap-3 px-5 py-4 text-center">
        {q.style && !stage && SKIN_ICON[q.style] && <div className="text-4xl" aria-hidden="true">{SKIN_ICON[q.style]}</div>}
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
      {q.style === 'sfade' && <SentenceFadeThenType key={q.id} q={q} onAnswer={onAnswer} disabled={disabled} />}
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
  if (q.style === 'whack') return <MoleBoard choices={choices} onAnswer={onAnswer} disabled={disabled} eliminated={eliminated} />;
  if (q.style === 'fish') return <FishPond choices={choices} onAnswer={onAnswer} disabled={disabled} eliminated={eliminated} />;
  if (q.style === 'balloon' || q.style === 'monster' || q.style === 'claw' || q.style === 'maze' || q.style === 'plane' || q.style === 'group') {
    const look = {
      whack: { icon: '🐹', wrap: 'grid-cols-2', btn: 'rounded-t-[3rem] rounded-b-2xl bg-[#6b4a2b] pt-4' },
      fish: { icon: '🐟', wrap: 'grid-cols-1 sm:grid-cols-2', btn: 'rounded-full bg-[#2f6fdb]' },
      balloon: { icon: '🎈', wrap: 'grid-cols-2', btn: 'rounded-[3rem] bg-[#e5484d]' },
      monster: { icon: '🍖', wrap: 'grid-cols-1', btn: 'rounded-2xl bg-[#6d3fb2]' },
      claw: { icon: '🧸', wrap: 'grid-cols-2', btn: 'rounded-[2rem] bg-[#d97706]' },
      maze: { icon: '🧭', wrap: 'grid-cols-1', btn: 'rounded-xl bg-[#0f766e]' },
      plane: { icon: '☁️', wrap: 'grid-cols-2', btn: 'rounded-full bg-[#0369a1]' },
      group: { icon: '🗂️', wrap: 'grid-cols-1', btn: 'rounded-xl bg-[#4f46e5]' },
    }[q.style];
    const sprite = STAGE[q.style]?.sprite;
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
            {sprite ? (
              <img src={sprite} alt="" className="h-14 w-14 object-contain drop-shadow" />
            ) : (
              <span className="text-4xl" aria-hidden="true">{look.icon}</span>
            )}
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

const FISH_CSS = `
@keyframes hwfish-swim { 0%,100% { left: 0 } 50% { left: calc(100% - 9.5rem) } }
@keyframes hwfish-face { 0%,49.9% { transform: scaleX(-1) } 50%,100% { transform: scaleX(1) } }
@keyframes hwfish-bob { 0%,100% { transform: translateY(-5px) } 50% { transform: translateY(6px) } }
@keyframes hwfish-caught { 0% { transform: scale(1) } 40% { transform: scale(1.35) rotate(-8deg) } 100% { transform: scale(1.1) translateY(-4rem); opacity: 0 } }
@media (prefers-reduced-motion: reduce) { .hwfish, .hwfish * { animation: none !important } }
`;

/** 물고기 연못: 낱말이 적힌 물고기가 물속을 헤엄치고, 알맞은 뜻의 물고기를 눌러 낚는다. 채점은 처음 누른 물고기(보기 번호) 그대로 */
function FishPond({ choices, onAnswer, disabled, eliminated = [] }: { choices: string[]; onAnswer: (r: string) => void; disabled: boolean; eliminated?: number[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const n = Math.max(choices.length, 1);
  const lane = 6.5; // rem
  return (
    <div className="relative mx-3 mb-3 flex-1 overflow-hidden rounded-3xl" style={{ minHeight: `${n * lane + 10}rem` }}>
      <style>{FISH_CSS}</style>
      {choices.map((c, i) => {
        const gone = eliminated.includes(i);
        const caught = picked === i;
        return (
          <button
            key={i}
            type="button"
            data-choice={i}
            disabled={disabled || gone || picked !== null}
            onClick={() => {
              setPicked(i);
              onAnswer(String(i));
            }}
            className="hwfish absolute flex w-[9.5rem] flex-col items-center active:scale-95 disabled:cursor-default"
            style={{
              top: `${9 + i * lane}rem`,
              left: 0,
              opacity: gone ? 0.25 : picked !== null && !caught ? 0.5 : 1,
              animation: `hwfish-swim ${10 + ((i * 3) % 5)}s ease-in-out ${-i * 2.6}s infinite`,
              animationPlayState: picked !== null ? 'paused' : 'running',
            }}
          >
            <span className="block" style={{ animation: caught ? 'hwfish-caught .7s ease-out forwards' : `hwfish-bob ${1.6 + (i % 3) * 0.4}s ease-in-out infinite` }}>
              <span className="block" style={{ animation: `hwfish-face ${10 + ((i * 3) % 5)}s step-end ${-i * 2.6}s infinite`, animationPlayState: picked !== null ? 'paused' : 'running' }}>
                <img src="/skins/adventure/goldfish.webp" alt="" draggable={false} className="h-20 w-24 object-contain drop-shadow-lg" style={{ filter: `hue-rotate(${i * 55}deg)` }} />
              </span>
              <span className="-mt-1 block max-w-full rounded-full bg-white/95 px-3 py-1 text-base font-bold text-deep-navy shadow">{c}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const MOLE_CSS = `
@keyframes hwmole-up { 0%,8% { transform: translateY(108%) } 20%,62% { transform: translateY(0) } 74%,100% { transform: translateY(108%) } }
@keyframes hwmole-hit { 0% { transform: translateY(0) scale(1) } 30% { transform: translateY(6%) scale(1.12,.88) } 100% { transform: translateY(108%) } }
@media (prefers-reduced-motion: reduce) { .hwmole { animation: none !important } }
`;

/** 두더지 밭: 두더지가 구멍에서 나왔다 들어갔다 하고, 낱말 팻말을 든 두더지 중 알맞은 뜻을 눌러 잡는다. 채점은 처음 누른 두더지(보기 번호) 그대로 */
function MoleBoard({ choices, onAnswer, disabled, eliminated = [] }: { choices: string[]; onAnswer: (r: string) => void; disabled: boolean; eliminated?: number[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const n = Math.max(choices.length, 1);
  const period = 4.6;
  return (
    <div className="grid flex-1 grid-cols-2 content-end gap-x-4 gap-y-2 px-4 pb-6 pt-[34vh]">
      <style>{MOLE_CSS}</style>
      {choices.map((c, i) => {
        const gone = eliminated.includes(i);
        const hit = picked === i;
        return (
          <div key={i} className="relative h-48">
            <div className="absolute inset-x-0 top-0 bottom-7 overflow-hidden">
              <button
                type="button"
                data-choice={i}
                disabled={disabled || gone || picked !== null}
                onClick={() => {
                  setPicked(i);
                  onAnswer(String(i));
                }}
                className="hwmole absolute inset-x-0 bottom-0 mx-auto flex w-32 flex-col items-center active:scale-95 disabled:cursor-default"
                style={{
                  opacity: gone ? 0.25 : picked !== null && !hit ? 0.6 : 1,
                  animation: hit ? 'hwmole-hit .7s ease-in forwards' : `hwmole-up ${period}s ease-in-out ${-(i * period) / n}s infinite`,
                  animationPlayState: picked !== null && !hit ? 'paused' : 'running',
                }}
              >
                <span className="relative z-10 -mb-3 block max-w-full rounded-lg bg-[#f3d9a4] px-3 py-1 text-base font-bold text-[#4a2d12] shadow ring-2 ring-[#8b5a2b]">{c}</span>
                <img src={hit ? '/skins/wm-mole-hurt.png' : '/skins/wm-mole.png'} alt="" draggable={false} className="h-24 w-24 object-contain drop-shadow-lg" />
              </button>
            </div>
            <div className="pointer-events-none absolute inset-x-1 bottom-0 h-12 rounded-[50%] bg-[#6b4a2b] shadow-[inset_0_8px_0_#4a2f17]" aria-hidden="true" />
          </div>
        );
      })}
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
        {t('studentHw.hangmanLives', { n: Math.max(MAX - wrong, 0) })}{' '}
        {Array.from({ length: MAX }, (_, i) => (
          <img key={i} src={i < MAX - wrong ? '/skins/hangman-heart.png' : '/skins/hangman-heart-empty.png'} alt="" className="mx-0.5 inline-block h-7 w-7 align-middle" />
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2 font-mono text-4xl font-bold tracking-widest" aria-label={t('studentHw.hangmanWord')}>
        {[...word].map((ch, i) => (
          <span key={i} className="min-w-8 border-b-4 border-white/60 text-center">
            {shown(ch) || dead ? ch : ' '}
          </span>
        ))}
      </div>
      <div className="flex w-full max-w-md flex-col gap-1.5">
        {['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((row) => (
          <div key={row} className={`flex justify-center gap-1 ${row.length === 9 ? 'px-[5%]' : row.length === 7 ? 'px-[15%]' : ''}`}>
            {row.split('').map((l) => (
              <button
                key={l}
                type="button"
                disabled={disabled || solved || dead || picked.includes(l)}
                onClick={() => setPicked((p) => [...p, l])}
                className={`h-12 min-w-0 flex-1 rounded-lg text-lg font-bold uppercase shadow active:scale-95 ${picked.includes(l) ? (word.toLowerCase().includes(l) ? 'bg-emerald-300 text-deep-navy' : 'bg-white/20 text-white/50 line-through') : 'bg-white text-deep-navy'}`}
              >
                {l}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 문장 지우며 읽기: 읽을 때마다 끝 낱말부터 가려지고, 마지막엔 문장 전체를 직접 쓴다 */
function SentenceFadeThenType({ q, onAnswer, disabled }: { q: HwQuestion; onAnswer: (r: string) => void; disabled: boolean }) {
  const { t } = useTranslation();
  const rounds = 3;
  const [round, setRound] = useState(0);
  const words = q.prompt.split(/\s+/).filter(Boolean);
  const hide = Math.ceil((words.length * round) / rounds);
  const typing = round >= rounds;
  return (
    <div className="flex flex-1 flex-col items-center gap-4 px-5 pb-4">
      {q.sub && <div className="text-lg text-white/75">{q.sub}</div>}
      {!typing ? (
        <>
          <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-3xl font-bold leading-snug" aria-live="polite">
            {words.map((w, i) => (
              <span key={i} className={i >= words.length - hide ? 'border-b-4 border-white/60 text-transparent' : ''}>
                {w}
              </span>
            ))}
          </div>
          <div className="text-base text-white/70">{t('studentHw.fadeRound', { n: round + 1, total: rounds })}</div>
          <div className="flex gap-3">
            {q.speak && (
              <button type="button" onClick={() => speak(q.speak!)} className="min-h-12 rounded-full bg-white/15 px-5 text-base font-bold text-white">{t('studentHw.listen')}</button>
            )}
            <button type="button" onClick={() => setRound((r) => r + 1)} className="min-h-12 rounded-full bg-warm-yellow px-8 text-lg font-bold text-deep-navy active:scale-95">{t('studentHw.sfadeRead')}</button>
          </div>
        </>
      ) : (
        <>
          <div className="text-2xl font-bold">{t('studentHw.sfadeWrite')}</div>
          <div className="w-full"><TextInput onAnswer={onAnswer} disabled={disabled} /></div>
        </>
      )}
    </div>
  );
}
