import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * 랜딩 "직접 눌러보세요" 체험(2026-10-17) — 로그인·서버·실제 학원 데이터 없이 이 화면 안에서만 도는 작은 게임 셋(돌림판·매치업·퀴즈).
 * 같은 예시 단어(apple·banana·cat·dog)를 쓰고, 결과는 저장하지 않으며, 소리는 자동으로 재생하지 않는다.
 * 실제 게임 컴포넌트는 로그인과 반·학원 정보가 묶여 있어 일부러 쓰지 않고 이 체험만 따로 만들었다(같은 방식의 간단한 버전).
 */
type Tab = 'wheel' | 'matchup' | 'quiz';
const TABS: Tab[] = ['wheel', 'matchup', 'quiz'];

interface Word {
  w: string;
  color: string;
}
const WORDS: Word[] = [
  { w: 'apple', color: '#ffc9ce' },
  { w: 'banana', color: '#ffe98a' },
  { w: 'cat', color: '#bcd9ff' },
  { w: 'dog', color: '#c8eec1' },
];
const IMG = (w: string) => `/landing2/w-${w}.webp`;

function shuffled<T>(a: T[], avoidSame = false): T[] {
  const orig = [...a];
  let r = [...a];
  for (let tries = 0; tries < 8; tries++) {
    r = [...a];
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    if (!avoidSame || r.some((x, i) => x !== orig[i])) break;
  }
  return r;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/* ───────────── 돌림판 ───────────── */
// 시계 방향, 위쪽 0도 기준: 0~90 banana · 90~180 dog · 180~270 cat · 270~360 apple (시안과 같은 배치)
const WHEEL_ORDER = ['banana', 'dog', 'cat', 'apple'];

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function Wheel() {
  const { t } = useTranslation();
  const reduced = usePrefersReducedMotion();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const spin = () => {
    if (spinning) return;
    const idx = Math.floor(Math.random() * 4);
    const jitter = (Math.random() - 0.5) * 50;
    const landing = (360 - (idx * 90 + 45 + jitter) + 360) % 360;
    const turns = 4 + Math.floor(Math.random() * 2);
    const current = rotation % 360;
    const next = rotation + (360 - current) + turns * 360 + landing;
    setResult(null);
    setSpinning(true);
    setRotation(next);
    const ms = reduced ? 0 : 3400;
    timer.current = window.setTimeout(() => {
      setSpinning(false);
      setResult(WHEEL_ORDER[idx]);
    }, ms + 50);
  };
  const reset = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setSpinning(false);
    setResult(null);
    setRotation(0);
  };

  const segs = WHEEL_ORDER.map((w, i) => {
    const word = WORDS.find((x) => x.w === w) as Word;
    const [x0, y0] = polar(200, 200, 190, i * 90);
    const [x1, y1] = polar(200, 200, 190, (i + 1) * 90);
    const [ix, iy] = polar(200, 200, 105, i * 90 + 45);
    return { word, path: `M200 200 L${x0} ${y0} A190 190 0 0 1 ${x1} ${y1} Z`, ix, iy };
  });

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative w-full max-w-[400px]">
        <svg viewBox="-8 -22 416 424" className="h-auto w-full" role="img" aria-label={t('landing2.demo.wheelAlt')}>
          <circle cx="200" cy="200" r="198" fill="#fff" />
          <g
            style={{
              transformOrigin: '200px 200px',
              transform: `rotate(${rotation}deg)`,
              transition: reduced ? 'none' : 'transform 3.4s cubic-bezier(0.12, 0.7, 0.14, 1)',
            }}
          >
            {segs.map((s) => (
              <g key={s.word.w}>
                <path d={s.path} fill={s.word.color} stroke="#fff" strokeWidth="4" />
                <image href={IMG(s.word.w)} x={s.ix - 42} y={s.iy - 58} width="84" height="84" />
                <text x={s.ix} y={s.iy + 48} textAnchor="middle" fontSize="26" fontWeight="800" fill="#0b1f4d" fontFamily="'Noto Sans KR', sans-serif">
                  {s.word.w}
                </text>
              </g>
            ))}
          </g>
          <circle cx="200" cy="200" r="30" fill="#1d63f0" />
          <circle cx="200" cy="200" r="11" fill="#fff" />
          <path d="M178 -12 L222 -12 L200 30 Z" fill="#1d63f0" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={spin}
          disabled={spinning}
          className="min-h-14 min-w-[10rem] rounded-full bg-[var(--lp-blue)] px-8 text-[20px] font-extrabold text-white shadow-[0_14px_30px_-12px_rgba(29,99,240,.7)] transition hover:bg-[var(--lp-blue-dark)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-navy)] disabled:opacity-60"
        >
          {spinning ? t('landing2.demo.spinning') : t('landing2.demo.spin')}
        </button>
        {(result || rotation !== 0) && !spinning && (
          <button type="button" onClick={reset} className="min-h-14 rounded-full border-2 border-[var(--lp-blue)] bg-white px-6 text-[18px] font-bold text-[var(--lp-blue)] transition hover:bg-[var(--lp-sky)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-navy)]">
            {t('landing2.demo.again')}
          </button>
        )}
      </div>
      <p aria-live="polite" className="min-h-[2.2rem] text-center text-[20px] font-extrabold text-[var(--lp-navy)]">
        {result ? (
          <span className="inline-flex items-center gap-2">
            <img src={IMG(result)} alt="" className="h-9 w-9 object-contain" />
            {t('landing2.demo.result')}: <span className="text-[var(--lp-blue)]">{result}</span>
          </span>
        ) : (
          <span className="text-[17px] font-medium text-[var(--lp-muted)]">{spinning ? '' : t('landing2.demo.wheelHint')}</span>
        )}
      </p>
    </div>
  );
}

/* ───────────── 매치업 ───────────── */
function Matchup() {
  const { t } = useTranslation();
  const [words, setWords] = useState<string[]>(() => shuffled(WORDS.map((x) => x.w), true));
  const [pickedImg, setPickedImg] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [msg, setMsg] = useState<'idle' | 'wrong' | 'done'>('idle');
  const [shake, setShake] = useState<string | null>(null);

  const reset = () => {
    setWords(shuffled(WORDS.map((x) => x.w), true));
    setPickedImg(null);
    setMatched([]);
    setMsg('idle');
    setShake(null);
  };
  const pickWord = (w: string) => {
    if (!pickedImg || matched.includes(w)) return;
    if (pickedImg === w) {
      const next = [...matched, w];
      setMatched(next);
      setPickedImg(null);
      setMsg(next.length === WORDS.length ? 'done' : 'idle');
    } else {
      setMsg('wrong');
      setShake(w);
      window.setTimeout(() => setShake(null), 400);
    }
  };

  const tile = 'flex min-h-[64px] items-center justify-center gap-3 rounded-2xl border-2 bg-white px-3 text-[20px] font-extrabold text-[var(--lp-navy)] transition focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-navy)]';
  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col items-center gap-4">
      <p className="text-center text-[17px] font-medium text-[var(--lp-muted)]">{t('landing2.demo.matchHint')}</p>
      <div className="grid w-full grid-cols-2 gap-x-8 gap-y-3">
        <div className="flex flex-col gap-3">
          {WORDS.map((x) => {
            const done = matched.includes(x.w);
            const on = pickedImg === x.w;
            return (
              <button
                key={x.w}
                type="button"
                disabled={done}
                aria-pressed={on}
                aria-label={t('landing2.demo.pictureOf', { word: x.w })}
                onClick={() => {
                  setPickedImg(x.w);
                  setMsg('idle');
                }}
                className={`${tile} ${done ? 'border-emerald-400 bg-emerald-50 opacity-70' : on ? 'border-[var(--lp-blue)] bg-[var(--lp-sky)] ring-4 ring-[var(--lp-blue)]/20' : 'border-[var(--lp-sky2)] hover:border-[var(--lp-blue)]'}`}
              >
                <img src={IMG(x.w)} alt="" className="h-12 w-12 object-contain" />
                {done && <span aria-hidden className="text-emerald-600">✓</span>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-3">
          {words.map((w) => {
            const done = matched.includes(w);
            return (
              <button
                key={w}
                type="button"
                disabled={done}
                onClick={() => pickWord(w)}
                className={`${tile} ${done ? 'border-emerald-400 bg-emerald-50 opacity-70' : 'border-[var(--lp-sky2)] hover:border-[var(--lp-blue)]'} ${shake === w ? 'lp-shake' : ''}`}
              >
                {w}
                {done && <span aria-hidden className="text-emerald-600">✓</span>}
              </button>
            );
          })}
        </div>
      </div>
      <p aria-live="polite" className="min-h-[2rem] text-center text-[18px] font-extrabold">
        {msg === 'wrong' && <span className="text-amber-600">{t('landing2.demo.matchWrong')}</span>}
        {msg === 'done' && <span className="text-emerald-600">{t('landing2.demo.matchDone')}</span>}
        {msg === 'idle' && matched.length > 0 && matched.length < WORDS.length && (
          <span className="text-[var(--lp-blue)]">{t('landing2.demo.matchProgress', { n: matched.length, total: WORDS.length })}</span>
        )}
      </p>
      {(matched.length > 0 || pickedImg) && (
        <button type="button" onClick={reset} className="min-h-12 rounded-full border-2 border-[var(--lp-blue)] bg-white px-6 text-[17px] font-bold text-[var(--lp-blue)] transition hover:bg-[var(--lp-sky)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-navy)]">
          {t('landing2.demo.again')}
        </button>
      )}
    </div>
  );
}

/* ───────────── 퀴즈 ───────────── */
function Quiz() {
  const { t } = useTranslation();
  const [order, setOrder] = useState<string[]>(() => shuffled(WORDS.map((x) => x.w)));
  const [options, setOptions] = useState<string[]>(() => shuffled(WORDS.map((x) => x.w)));
  const [qi, setQi] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const finished = qi >= order.length;
  const answer = order[qi] ?? '';

  const choose = (w: string) => {
    if (chosen) return;
    setChosen(w);
    if (w === answer) setScore((s) => s + 1);
  };
  const next = () => {
    setChosen(null);
    setOptions(shuffled(WORDS.map((x) => x.w)));
    setQi((i) => i + 1);
  };
  const reset = () => {
    setOrder(shuffled(WORDS.map((x) => x.w)));
    setOptions(shuffled(WORDS.map((x) => x.w)));
    setQi(0);
    setChosen(null);
    setScore(0);
  };

  const btnBase = 'min-h-[60px] rounded-2xl border-2 px-4 text-[20px] font-extrabold transition focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-navy)]';
  if (finished) {
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center" aria-live="polite">
        <div className="text-[56px]" aria-hidden>🎉</div>
        <p className="text-[26px] font-black text-[var(--lp-navy)]">{t('landing2.demo.quizDone', { score, total: order.length })}</p>
        <button type="button" onClick={reset} className="min-h-14 rounded-full bg-[var(--lp-blue)] px-8 text-[19px] font-extrabold text-white transition hover:bg-[var(--lp-blue-dark)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-navy)]">
          {t('landing2.demo.again')}
        </button>
      </div>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between text-[16px] font-bold text-[var(--lp-muted)]">
        <span>{t('landing2.demo.quizQ', { n: qi + 1, total: order.length })}</span>
        <span>{t('landing2.demo.quizScore', { score })}</span>
      </div>
      <p className="text-[19px] font-extrabold text-[var(--lp-navy)]">{t('landing2.demo.quizAsk')}</p>
      <div className="flex h-[170px] w-[250px] items-center justify-center rounded-3xl bg-white shadow-[0_12px_30px_-16px_rgba(25,60,140,.4)]">
        <img src={IMG(answer)} alt="" className="h-32 w-32 object-contain" />
      </div>
      <div className="grid w-full grid-cols-2 gap-3">
        {options.map((w) => {
          const isRight = chosen && w === answer;
          const isWrong = chosen === w && w !== answer;
          return (
            <button
              key={w}
              type="button"
              disabled={!!chosen}
              onClick={() => choose(w)}
              className={`${btnBase} ${isRight ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : isWrong ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-[var(--lp-sky2)] bg-white text-[var(--lp-navy)] hover:border-[var(--lp-blue)]'}`}
            >
              {w}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="min-h-[1.8rem] text-center text-[18px] font-extrabold">
        {chosen && (chosen === answer ? <span className="text-emerald-600">{t('landing2.demo.quizRight')}</span> : <span className="text-rose-600">{t('landing2.demo.quizWrong', { answer })}</span>)}
      </p>
      {chosen && (
        <button type="button" onClick={next} className="min-h-12 rounded-full bg-[var(--lp-blue)] px-7 text-[18px] font-extrabold text-white transition hover:bg-[var(--lp-blue-dark)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-navy)]">
          {qi + 1 >= order.length ? t('landing2.demo.quizSeeResult') : t('landing2.demo.next')}
        </button>
      )}
    </div>
  );
}

/* ───────────── 체험 영역 ───────────── */
export default function LandingDemo() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('wheel');
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const stage = useMemo(() => {
    if (tab === 'wheel') return <Wheel />;
    if (tab === 'matchup') return <Matchup />;
    return <Quiz />;
  }, [tab]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[n]);
    refs.current[TABS[n]]?.focus();
  };

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <div role="tablist" aria-label={t('landing2.demo.tabsLabel')} className="mx-auto mb-6 grid max-w-[760px] grid-cols-3 gap-3 sm:gap-4">
        {TABS.map((k, i) => (
          <button
            key={k}
            ref={(el) => {
              refs.current[k] = el;
            }}
            id={`lp-tab-${k}`}
            role="tab"
            type="button"
            aria-selected={tab === k}
            aria-controls="lp-demo-panel"
            tabIndex={tab === k ? 0 : -1}
            onClick={() => setTab(k)}
            onKeyDown={(e) => onKey(e, i)}
            className={`min-h-[60px] rounded-2xl border-2 px-2 text-[19px] font-extrabold transition focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-navy)] sm:text-[21px] ${
              tab === k ? 'border-[var(--lp-blue)] bg-[var(--lp-blue)] text-white shadow-[0_12px_26px_-12px_rgba(29,99,240,.7)]' : 'border-[var(--lp-sky2)] bg-white text-[var(--lp-navy)] hover:border-[var(--lp-blue)]'
            }`}
          >
            {t(`landing2.demo.tab_${k}`)}
          </button>
        ))}
      </div>

      <div className="relative rounded-[36px] bg-[#e6f0ff] p-5 sm:p-8 md:p-10">
        <div className="grid items-center gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div id="lp-demo-panel" role="tabpanel" aria-labelledby={`lp-tab-${tab}`} className="min-h-[470px] rounded-[28px] bg-[#f4f8ff] p-4 sm:p-6">
            {stage}
          </div>
          <div className="relative">
            <div className="rounded-[28px] bg-white p-5 shadow-[0_18px_40px_-24px_rgba(25,60,140,.45)]">
              <div className="mb-3 text-[22px] font-black text-[var(--lp-navy)]">{t('landing2.demo.listTitle')}</div>
              <ul className="space-y-2.5">
                {WORDS.map((x) => (
                  <li key={x.w} className="flex items-center gap-4 rounded-2xl bg-[#f3f6fc] px-4 py-2.5 text-[20px] font-extrabold text-[var(--lp-navy)]">
                    <img src={IMG(x.w)} alt="" loading="lazy" className="h-11 w-11 object-contain" />
                    {x.w}
                  </li>
                ))}
              </ul>
            </div>
            <img src="/landing2/m-walk.webp" alt="" loading="lazy" className="pointer-events-none absolute -bottom-5 -right-3 hidden w-[130px] drop-shadow-lg sm:block lg:-right-8" />
          </div>
        </div>
        <p className="mt-6 text-center text-[16px] font-medium text-[var(--lp-muted)]">{t('landing2.demo.note')}</p>
      </div>
    </div>
  );
}
