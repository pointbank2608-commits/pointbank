import { gameClock } from '../lib/gameClock';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMON_SFX, GAME_SFX, playSfx } from '../lib/gameSfx';
import { speak, speakSequence } from '../lib/speech';
import { useRemoteActions } from '../lib/remote';
import {
  AIRPORT_ARRIVALS,
  AIRPORT_DEPARTURES,
  AIRPORT_PLACES,
  AIRPORT_ROUTE,
  BOARD_QUESTIONS,
  DEFAULT_AIRPORT_WORDS,
  airportArtFor,
  splitLine,
  type AirportPlace,
  type AirportPlaceId,
  type AirportWord,
} from '../lib/airportRoleplay';
import type { GameItem } from '../lib/types';

/**
 * 공항 롤플레이(2026-10-15) — PPT "ESL Airport Role Play Lesson for Beginners"를 한 게임으로 옮겼다.
 * ① 낱말(그림을 눌러 확인) ② 공항에서 가는 순서 ③ 대화 연습(대본 → 빈칸 기억하기) ④ 내 차례(돌림판으로 장소,
 * 미스터리 상자로 역할을 정하고 짝이 대화한다) ⑤ 전광판 읽기. 점수는 없고(PPT 원본에도 없다) 한 단계씩 수업을 이끈다.
 */

interface Props {
  /** 선생님이 고른 낱말("영어 | 뜻") — 비어 있으면 PPT의 낱말 5개 */
  items: GameItem[];
  places: AirportPlaceId[];
  showKo: boolean;
}

type Step = 'words' | 'route' | 'practice' | 'turn' | 'board';
const STEPS: Step[] = ['words', 'route', 'practice', 'turn', 'board'];
const STEP_ICON: Record<Step, string> = { words: '🧳', route: '➡️', practice: '💬', turn: '🎡', board: '🛫' };
const IMG = (n: string) => `/skins/airport/${n}.webp`;
const SLICE_COLORS = ['#60a5fa', '#34d399', '#f87171'];

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const STYLE = `
@keyframes ap-pop { 0%{transform:scale(.4);opacity:0} 60%{transform:scale(1.12);opacity:1} 100%{transform:scale(1);opacity:1} }
@keyframes ap-rise { 0%{transform:translateY(8%);opacity:0} 100%{transform:translateY(0);opacity:1} }
@keyframes ap-wiggle { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-4deg)} 75%{transform:rotate(4deg)} }
@keyframes ap-glow { 0%,100%{box-shadow:0 0 0 0 rgba(250,204,21,.95)} 50%{box-shadow:0 0 0 .8cqw rgba(250,204,21,0)} }
@keyframes ap-flash { 0%{background:rgba(250,204,21,.95)} 100%{background:rgba(250,204,21,.28)} }
.ap-btn { transition: transform .15s, filter .15s; }
.ap-btn:hover:not(:disabled) { transform: translateY(-3%) scale(1.03); filter: brightness(1.04); }
.ap-btn:active:not(:disabled) { transform: scale(.97); }
.ap-btn:disabled { cursor: default; }
@media (prefers-reduced-motion: reduce) { .ap-anim { animation-duration:.01s !important; animation-iteration-count:1 !important; } }
`;

/** "영어 | 뜻" 한 줄을 낱말 카드로 */
function parseWords(items: GameItem[]): AirportWord[] {
  const out: AirportWord[] = [];
  for (const it of items) {
    const [w, ...rest] = it.label.split('|');
    const word = w.trim();
    if (!word) continue;
    out.push({ word, ko: rest.join('|').trim(), art: airportArtFor(word) ?? 'trunk' });
  }
  return out;
}

export default function AirportRoleplay({ items, places, showKo: showKoProp }: Props) {
  const { t } = useTranslation();
  const placeList = useMemo(() => {
    const ids = places.length > 0 ? places : (['checkin', 'security', 'gate'] as AirportPlaceId[]);
    return AIRPORT_PLACES.filter((p) => ids.includes(p.id));
  }, [places]);
  const words = useMemo(() => {
    const own = parseWords(items);
    return own.length > 0 ? own : DEFAULT_AIRPORT_WORDS;
  }, [items]);

  const [step, setStep] = useState<Step>('words');
  const [showKo, setShowKo] = useState(showKoProp);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    const id = gameClock.setTimeout(fn, ms);
    timers.current.push(id);
  };
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((id) => gameClock.clearTimeout(id));
  }, []);

  /* ---------- 1 낱말 ---------- */
  const [wordOpen, setWordOpen] = useState<Set<number>>(new Set());
  const wordKey = words.map((w) => w.word).join('|');
  useEffect(() => setWordOpen(new Set()), [wordKey]);
  function openWord(i: number) {
    setWordOpen((s) => {
      if (s.has(i)) return s;
      const n = new Set(s);
      n.add(i);
      return n;
    });
    playSfx(GAME_SFX.airport.reveal);
    speak(words[i].word.replace(/\s*\/\s*/g, ' or '));
  }

  /* ---------- 2 가는 순서 ---------- */
  const [routeN, setRouteN] = useState(0);
  function revealRoute() {
    if (routeN >= AIRPORT_ROUTE.length) return;
    playSfx(GAME_SFX.airport.reveal);
    speak(AIRPORT_ROUTE[routeN].name);
    setRouteN((n) => n + 1);
  }

  /* ---------- 3 대화 연습 ---------- */
  const [practiceId, setPracticeId] = useState<AirportPlaceId>(placeList[0].id);
  const [hideWords, setHideWords] = useState(false);
  useEffect(() => {
    if (!placeList.some((p) => p.id === practiceId)) setPracticeId(placeList[0].id);
  }, [placeList, practiceId]);
  const practicePlace = placeList.find((p) => p.id === practiceId) ?? placeList[0];

  /* ---------- 4 내 차례 ---------- */
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [turnPlace, setTurnPlace] = useState<AirportPlace | null>(null);
  const [roleOrder, setRoleOrder] = useState<('staff' | 'customer')[]>(() => shuffle(['staff', 'customer']));
  const [boxOpen, setBoxOpen] = useState<[boolean, boolean]>([false, false]);
  const [acting, setActing] = useState(false);
  const [turnHide, setTurnHide] = useState(false);
  const angleRef = useRef(0);

  function spin() {
    if (spinning || placeList.length === 0) return;
    const n = placeList.length;
    const sd = 360 / n;
    const target = Math.floor(Math.random() * n);
    const jitter = (Math.random() - 0.5) * sd * 0.5;
    const want = -((target + 0.5) * sd) + jitter;
    const cur = angleRef.current;
    const delta = ((((want - cur) % 360) + 360) % 360) + 360 * 5;
    const next = cur + delta;
    angleRef.current = next;
    setSpinning(true);
    setTurnPlace(null);
    setActing(false);
    setAngle(next);
    playSfx(GAME_SFX.airport.spin);
    later(() => {
      setSpinning(false);
      setTurnPlace(placeList[target]);
      playSfx(GAME_SFX.airport.stop);
      speak(placeList[target].name);
    }, 4000);
  }

  function openBox(i: 0 | 1) {
    if (boxOpen[i]) return;
    setBoxOpen((b) => (i === 0 ? [true, b[1]] : [b[0], true]));
    playSfx(GAME_SFX.airport.box);
    speak(roleOrder[i] === 'staff' ? (turnPlace?.staff ?? placeList[0].staff) : 'Customer');
  }

  function nextPair() {
    setTurnPlace(null);
    setRoleOrder(shuffle(['staff', 'customer']));
    setBoxOpen([false, false]);
    setActing(false);
    setTurnHide(false);
    playSfx(COMMON_SFX.yourTurn);
  }

  function startActing() {
    setActing(true);
    playSfx(COMMON_SFX.start);
  }

  /* ---------- 5 전광판 ---------- */
  const [asked, setAsked] = useState<number | null>(null);
  const [answered, setAnswered] = useState<Set<number>>(new Set());
  function askQuestion(i: number) {
    setAsked(i);
    speak(BOARD_QUESTIONS[i].q);
  }
  function showAnswer(i: number) {
    setAsked(i);
    setAnswered((s) => new Set(s).add(i));
    playSfx(GAME_SFX.airport.correct);
    speak(BOARD_QUESTIONS[i].answer);
  }

  /* ---------- 선생님 폰 리모컨 ---------- */
  const stepIdx = STEPS.indexOf(step);
  const nextStepAction = stepIdx < STEPS.length - 1 ? [{ id: 'step', label: t('gameAirport.nextStep'), tone: 'neutral' as const, run: () => setStep(STEPS[stepIdx + 1]) }] : [];
  const remote =
    step === 'words'
      ? [
          { id: 'reveal', label: t('gameAirport.revealNext'), tone: 'primary' as const, run: () => openWord([...words.keys()].find((i) => !wordOpen.has(i)) ?? 0) },
          ...nextStepAction,
        ]
      : step === 'route'
        ? [{ id: 'reveal', label: t('gameAirport.revealNext'), tone: 'primary' as const, run: revealRoute }, ...nextStepAction]
        : step === 'practice'
          ? [
              { id: 'listen', label: t('gameAirport.listen'), tone: 'primary' as const, run: () => speakSequence(practicePlace.lines.map((l) => l.text)) },
              { id: 'hide', label: hideWords ? t('gameAirport.modeScript') : t('gameAirport.modeRemember'), tone: 'neutral' as const, run: () => setHideWords((v) => !v) },
              ...nextStepAction,
            ]
          : step === 'turn'
            ? [
                { id: 'spin', label: t('gameAirport.spin'), tone: 'primary' as const, run: spin },
                { id: 'box1', label: t('gameAirport.boxN', { n: 1 }), tone: 'neutral' as const, run: () => openBox(0) },
                { id: 'box2', label: t('gameAirport.boxN', { n: 2 }), tone: 'neutral' as const, run: () => openBox(1) },
                { id: 'act', label: t('gameAirport.startActing'), tone: 'good' as const, run: startActing },
                { id: 'pair', label: t('gameAirport.nextPair'), tone: 'neutral' as const, run: nextPair },
                ...nextStepAction,
              ]
            : BOARD_QUESTIONS.map((_, i) => ({ id: `q${i}`, label: t('gameAirport.answerN', { n: i + 1 }), tone: 'primary' as const, run: () => showAnswer(i) }));
  useRemoteActions(remote);

  const sceneFor: Record<Step, string> = {
    words: 'scene-lobby',
    route: 'scene-lobby',
    practice: practicePlace.scene,
    turn: turnPlace?.scene ?? 'scene-lobby',
    board: 'scene-lobby',
  };

  const pillStyle = { fontSize: 'clamp(11px, 1.9cqw, 26px)' };
  const btnStyle = { fontSize: 'clamp(11px, 1.7cqw, 22px)' };
  const btn = 'ap-btn rounded-full px-[1.8cqw] py-[0.7cqw] font-bold text-white shadow-lg';

  return (
    <div className="space-y-3">
      <style>{STYLE}</style>

      {/* 단계 */}
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 font-label-md text-label-md transition-colors ${
              step === s ? 'bg-primary text-on-primary shadow-sm' : 'border border-outline-variant/50 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span aria-hidden="true">{STEP_ICON[s]}</span>
            <span>
              {i + 1}. {t(`gameAirport.step_${s}`)}
            </span>
          </button>
        ))}
      </div>

      <div
        className="relative w-full overflow-hidden rounded-[24px] shadow-lg"
        style={{ aspectRatio: '16 / 9', containerType: 'size', background: `#bfdbfe url(${IMG(sceneFor[step])}) center / cover no-repeat` }}
      >
        {/* 안내 */}
        <div className="absolute left-0 right-0 top-[2.5%] z-20 text-center">
          <span className="inline-block max-w-[92%] rounded-full bg-white/92 px-[2.4cqw] py-[0.6cqw] font-bold text-slate-800 shadow" style={pillStyle}>
            {t(`gameAirport.hint_${step}`)}
          </span>
        </div>

        {/* ① 낱말 */}
        {step === 'words' && (
          <div className="absolute inset-x-[3%] top-[15%] bottom-[5%] flex flex-wrap content-center items-center justify-center gap-[1.6cqw]">
            {words.map((w, i) => {
              const open = wordOpen.has(i);
              const cardW = words.length <= 5 ? 16 : words.length <= 8 ? 12.5 : 10;
              return (
                <button
                  key={`${w.word}-${i}`}
                  type="button"
                  onClick={() => openWord(i)}
                  className="ap-btn ap-anim flex flex-col items-center rounded-[1.6cqw] border-[0.35cqw] border-white bg-white/90 p-[0.8cqw] shadow-lg"
                  style={{ width: `${cardW}cqw`, height: `${cardW * 1.42}cqw`, animation: open ? undefined : `ap-rise .4s ${i * 0.06}s both` }}
                  aria-label={open ? w.word : t('gameAirport.cardHidden')}
                >
                  <div className="flex w-full items-center justify-center" style={{ height: `${cardW * 0.78}cqw` }}>
                    <img src={IMG(w.art)} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
                  </div>
                  <div className="flex w-full flex-1 flex-col items-center justify-center">
                    {open ? (
                      <>
                        <div className="ap-anim text-center font-black leading-tight text-deep-navy" style={{ fontSize: `clamp(10px, ${Math.max(1.3, cardW * 0.115)}cqw, 24px)`, animation: 'ap-pop .35s both' }}>
                          {w.word}
                        </div>
                        {w.ko && (
                          <div className="text-center font-bold text-indigo-600" style={{ fontSize: `clamp(9px, ${Math.max(1.1, cardW * 0.09)}cqw, 18px)` }}>
                            {w.ko}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center font-black text-slate-400" style={{ fontSize: 'clamp(14px, 2.6cqw, 34px)' }}>
                        ?
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ② 가는 순서 */}
        {step === 'route' && (
          <>
            <div className="absolute inset-x-[3%] top-[18%] bottom-[16%] flex items-center justify-center gap-[1cqw]">
              {AIRPORT_ROUTE.map((r, i) => {
                const open = i < routeN;
                const next = i === routeN;
                return (
                  <div key={r.name} className="flex items-center gap-[1cqw]">
                    <button
                      type="button"
                      disabled={i > routeN}
                      onClick={() => i === routeN && revealRoute()}
                      className="ap-btn ap-anim flex flex-col items-center rounded-[1.6cqw] border-[0.35cqw] border-white p-[0.8cqw] shadow-lg"
                      style={{
                        width: '19cqw',
                        background: open ? 'rgba(255,255,255,.93)' : 'rgba(255,255,255,.55)',
                        animation: next ? 'ap-glow 1.4s ease-in-out infinite' : open ? 'ap-pop .4s both' : undefined,
                      }}
                    >
                      <div className="flex w-full items-center justify-center" style={{ height: '14cqw' }}>
                        {open ? (
                          <img src={IMG(r.art)} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
                        ) : (
                          <span className="font-black text-slate-400" style={{ fontSize: 'clamp(20px, 5cqw, 64px)' }}>
                            ?
                          </span>
                        )}
                      </div>
                      <div className="mt-[0.4cqw] text-center" style={{ minHeight: '5.4cqw' }}>
                        {open && (
                          <>
                            <div className="font-black leading-tight text-deep-navy" style={{ fontSize: 'clamp(11px, 1.7cqw, 24px)' }}>
                              {i + 1}. {r.name}
                            </div>
                            <div className="font-bold text-indigo-600" style={{ fontSize: 'clamp(9px, 1.3cqw, 18px)' }}>
                              {r.ko}
                            </div>
                          </>
                        )}
                      </div>
                    </button>
                    {i < AIRPORT_ROUTE.length - 1 && (
                      <span
                        className="ap-anim font-black text-amber-500"
                        style={{ fontSize: 'clamp(18px, 3.6cqw, 48px)', opacity: i < routeN - 1 ? 1 : 0.25, animation: i === routeN - 2 ? 'ap-pop .4s both' : undefined, textShadow: '0 2px 0 #fff' }}
                      >
                        ▶
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="absolute inset-x-0 bottom-[3%] z-10 flex justify-center gap-[1cqw]">
              <button type="button" onClick={revealRoute} disabled={routeN >= AIRPORT_ROUTE.length} className={`${btn} disabled:opacity-40`} style={{ ...btnStyle, background: '#6366f1' }}>
                {t('gameAirport.revealNext')}
              </button>
              <button type="button" onClick={() => setRouteN(0)} className={btn} style={{ ...btnStyle, background: '#64748b' }}>
                {t('gameAirport.again')}
              </button>
            </div>
          </>
        )}

        {/* ③ 대화 연습 */}
        {step === 'practice' && (
          <>
            <div className="absolute left-0 right-0 top-[10.5%] z-20 flex justify-center gap-[1cqw]">
              {placeList.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPracticeId(p.id)}
                  className="ap-btn flex items-center gap-[0.6cqw] rounded-full px-[1.4cqw] py-[0.4cqw] font-bold shadow-lg"
                  style={{
                    ...btnStyle,
                    background: practiceId === p.id ? p.color : 'rgba(255,255,255,.92)',
                    color: practiceId === p.id ? '#fff' : '#1e293b',
                  }}
                >
                  <img src={IMG(p.art)} alt="" className="h-[2.6cqw] w-auto object-contain" draggable={false} />
                  {p.name}
                </button>
              ))}
            </div>
            <Dialog key={`${practicePlace.id}-${hideWords}`} place={practicePlace} hide={hideWords} showKo={showKo} owners={null} top="18.5%" bottom="11%" />
            <div className="absolute inset-x-0 bottom-[2.5%] z-20 flex justify-center gap-[0.8cqw]">
              <button type="button" onClick={() => speakSequence(practicePlace.lines.map((l) => l.text))} className={btn} style={{ ...btnStyle, background: '#6366f1' }}>
                🔊 {t('gameAirport.listen')}
              </button>
              <button type="button" onClick={() => setHideWords((v) => !v)} className={btn} style={{ ...btnStyle, background: hideWords ? '#f59e0b' : '#0ea5a4' }}>
                {hideWords ? t('gameAirport.modeScript') : t('gameAirport.modeRemember')}
              </button>
              <button type="button" onClick={() => setShowKo((v) => !v)} className={btn} style={{ ...btnStyle, background: showKo ? '#8b5cf6' : '#64748b' }}>
                {t('gameAirport.koToggle')}
              </button>
            </div>
          </>
        )}

        {/* ④ 내 차례 */}
        {step === 'turn' && (
          <>
            {!acting && (
              <>
                {/* 돌림판 */}
                <div className="absolute z-10" style={{ left: '4%', top: '14%', width: '40%', aspectRatio: '1 / 1' }}>
                  <div
                    className="absolute inset-0"
                    style={{ transform: `rotate(${angle}deg)`, transition: spinning ? 'transform 3.9s cubic-bezier(.12,.62,.12,1)' : undefined }}
                  >
                    <WheelSvg places={placeList} />
                  </div>
                  <svg viewBox="0 0 40 40" className="pointer-events-none absolute left-1/2 top-[-3%] h-[14%] w-[14%] -translate-x-1/2 drop-shadow">
                    <path d="M20 38 L6 6 Q20 -2 34 6 Z" fill="#facc15" stroke="#b45309" strokeWidth="2.5" strokeLinejoin="round" />
                  </svg>
                  <button
                    type="button"
                    onClick={spin}
                    disabled={spinning}
                    className="ap-btn absolute left-1/2 top-1/2 flex h-[24%] w-[24%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[0.4cqw] border-white bg-red-500 font-black text-white shadow-xl disabled:opacity-80"
                    style={{ fontSize: 'clamp(11px, 1.9cqw, 26px)' }}
                  >
                    {t('gameAirport.spinShort')}
                  </button>
                </div>

                {/* 장소 결과 */}
                {turnPlace && (
                  <div className="ap-anim absolute z-10 text-center" style={{ left: '4%', width: '40%', bottom: '4%', animation: 'ap-pop .45s both' }}>
                    <span className="inline-block rounded-full px-[2.2cqw] py-[0.6cqw] font-black text-white shadow-xl" style={{ background: turnPlace.color, fontSize: 'clamp(13px, 2.4cqw, 34px)' }}>
                      {turnPlace.name}
                    </span>
                  </div>
                )}

                {/* 미스터리 상자 */}
                <div className="absolute z-10 flex items-end justify-center gap-[3cqw]" style={{ right: '3%', width: '48%', top: '15%', bottom: '14%' }}>
                  {([0, 1] as const).map((i) => {
                    const open = boxOpen[i];
                    const role = roleOrder[i];
                    const staffName = turnPlace?.staff ?? placeList[0].staff;
                    return (
                      <div key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
                        {open ? (
                          <div className="ap-anim flex flex-col items-center" style={{ animation: 'ap-pop .45s both' }}>
                            <img
                              src={IMG(role === 'staff' ? (turnPlace?.staffArt ?? placeList[0].staffArt) : 'traveler')}
                              alt=""
                              className="object-contain drop-shadow-lg"
                              style={{ height: '24cqw' }}
                              draggable={false}
                            />
                            <span
                              className="mt-[0.6cqw] rounded-full px-[1.6cqw] py-[0.4cqw] text-center font-black text-white shadow-lg"
                              style={{ background: role === 'staff' ? '#ea580c' : '#0284c7', fontSize: 'clamp(11px, 1.9cqw, 26px)' }}
                            >
                              {role === 'staff' ? staffName : 'Customer'}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openBox(i)}
                            className="ap-btn ap-anim flex flex-col items-center"
                            style={{ animation: 'ap-wiggle 1.6s ease-in-out infinite' }}
                            aria-label={t('gameAirport.boxN', { n: i + 1 })}
                          >
                            <img src={IMG('trunk')} alt="" className="object-contain drop-shadow-xl" style={{ width: '18cqw' }} draggable={false} />
                            <span className="mt-[0.4cqw] rounded-full bg-white/92 px-[1.4cqw] py-[0.3cqw] font-black text-slate-700 shadow" style={{ fontSize: 'clamp(10px, 1.5cqw, 20px)' }}>
                              {t('gameAirport.boxN', { n: i + 1 })}
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="absolute bottom-[2.5%] z-20 flex justify-center gap-[0.8cqw]" style={{ left: '46%', right: '3%' }}>
                  {turnPlace && boxOpen[0] && boxOpen[1] && (
                    <button type="button" onClick={startActing} className={btn} style={{ ...btnStyle, background: '#16a34a' }}>
                      🎬 {t('gameAirport.startActing')}
                    </button>
                  )}
                  <button type="button" onClick={nextPair} className={btn} style={{ ...btnStyle, background: '#64748b' }}>
                    {t('gameAirport.nextPair')}
                  </button>
                </div>
              </>
            )}

            {acting && turnPlace && (
              <>
                <Dialog
                  key={`${turnPlace.id}-${turnHide}`}
                  place={turnPlace}
                  hide={turnHide}
                  showKo={showKo}
                  owners={{ staff: roleOrder.indexOf('staff') + 1, customer: roleOrder.indexOf('customer') + 1 }}
                  top="10.5%"
                  bottom="11%"
                />
                <div className="absolute inset-x-0 bottom-[2.5%] z-20 flex justify-center gap-[0.8cqw]">
                  <button type="button" onClick={() => speakSequence(turnPlace.lines.map((l) => l.text))} className={btn} style={{ ...btnStyle, background: '#6366f1' }}>
                    🔊 {t('gameAirport.listen')}
                  </button>
                  <button type="button" onClick={() => setTurnHide((v) => !v)} className={btn} style={{ ...btnStyle, background: turnHide ? '#f59e0b' : '#0ea5a4' }}>
                    {turnHide ? t('gameAirport.modeScript') : t('gameAirport.modeRemember')}
                  </button>
                  <button type="button" onClick={() => setShowKo((v) => !v)} className={btn} style={{ ...btnStyle, background: showKo ? '#8b5cf6' : '#64748b' }}>
                    {t('gameAirport.koToggle')}
                  </button>
                  <button type="button" onClick={nextPair} className={btn} style={{ ...btnStyle, background: '#16a34a' }}>
                    {t('gameAirport.nextPair')}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ⑤ 전광판 */}
        {step === 'board' && (
          <>
            <div className="absolute z-10 flex flex-col gap-[1cqw]" style={{ left: '2.5%', top: '12%', bottom: '4%', width: '33%' }}>
              {BOARD_QUESTIONS.map((q, i) => {
                const done = answered.has(i);
                const on = asked === i;
                return (
                  <div
                    key={q.q}
                    className="flex flex-1 flex-col justify-center rounded-[1.2cqw] border-[0.3cqw] bg-white/93 px-[1.2cqw] py-[0.5cqw] shadow-lg"
                    style={{ borderColor: on ? '#facc15' : '#fff' }}
                  >
                    <button type="button" onClick={() => askQuestion(i)} className="text-left font-bold leading-tight text-deep-navy" style={{ fontSize: 'clamp(10px, 1.45cqw, 20px)' }}>
                      {i + 1}. {q.q}
                    </button>
                    {showKo && (
                      <div className="text-slate-500" style={{ fontSize: 'clamp(9px, 1.1cqw, 15px)' }}>
                        {q.ko}
                      </div>
                    )}
                    <div className="mt-[0.3cqw] flex items-center gap-[0.8cqw]">
                      {done ? (
                        <span className="ap-anim rounded-full bg-emerald-500 px-[1.2cqw] py-[0.2cqw] font-black text-white" style={{ fontSize: 'clamp(11px, 1.7cqw, 24px)', animation: 'ap-pop .35s both' }}>
                          {q.answer}
                        </span>
                      ) : (
                        <button type="button" onClick={() => showAnswer(i)} className="ap-btn rounded-full bg-indigo-500 px-[1.2cqw] py-[0.2cqw] font-bold text-white" style={{ fontSize: 'clamp(9px, 1.2cqw, 16px)' }}>
                          {t('gameAirport.showAnswer')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="absolute z-10 grid grid-cols-2 gap-[1cqw]" style={{ right: '2%', top: '12%', width: '60%', bottom: '4%' }}>
              <BoardTable title="Arrivals" rows={AIRPORT_ARRIVALS} mark={asked !== null && BOARD_QUESTIONS[asked].board === 'arrivals' ? BOARD_QUESTIONS[asked].row : -1} />
              <BoardTable title="Departures" rows={AIRPORT_DEPARTURES} mark={asked !== null && BOARD_QUESTIONS[asked].board === 'departures' ? BOARD_QUESTIONS[asked].row : -1} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- 돌림판 ---------------- */
function WheelSvg({ places }: { places: AirportPlace[] }) {
  const n = places.length;
  const sd = 360 / n;
  const R = 96;
  const pt = (deg: number, r = R) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [100 + r * Math.cos(a), 100 + r * Math.sin(a)] as const;
  };
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full drop-shadow-xl">
      <circle cx="100" cy="100" r="99" fill="#fff" />
      {places.map((p, i) => {
        const a0 = i * sd;
        const a1 = (i + 1) * sd;
        const [x0, y0] = pt(a0);
        const [x1, y1] = pt(a1);
        const large = sd > 180 ? 1 : 0;
        const d = n === 1 ? `M100 100 m-${R} 0 a${R} ${R} 0 1 0 ${R * 2} 0 a${R} ${R} 0 1 0 -${R * 2} 0` : `M100 100 L${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
        const center = a0 + sd / 2;
        return (
          <g key={p.id}>
            <path d={d} fill={SLICE_COLORS[i % SLICE_COLORS.length]} stroke="#fff" strokeWidth="2.5" />
            <g transform={`rotate(${center} 100 100)`}>
              <image href={IMG(p.art)} x="74" y="12" width="52" height="46" preserveAspectRatio="xMidYMid meet" />
              <text x="100" y="72" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" stroke="rgba(0,0,0,.35)" strokeWidth="0.6" paintOrder="stroke">
                {p.name}
              </text>
            </g>
          </g>
        );
      })}
      <circle cx="100" cy="100" r="98" fill="none" stroke="#fde68a" strokeWidth="4" />
    </svg>
  );
}

/* ---------------- 전광판 ---------------- */
function BoardTable({ title, rows, mark }: { title: string; rows: [string, string][]; mark: number }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.1cqw] border-[0.35cqw] border-slate-900 bg-slate-800 shadow-xl">
      <div className="bg-yellow-300 py-[0.4cqw] text-center font-black text-slate-900" style={{ fontSize: 'clamp(12px, 2cqw, 28px)' }}>
        {title}
      </div>
      <div className="flex flex-1 flex-col justify-evenly px-[0.5cqw] py-[0.3cqw]">
        {rows.map(([time, city], i) => (
          <div
            key={`${time}-${city}`}
            className="ap-anim flex items-center gap-[0.8cqw] rounded-[0.3cqw] px-[0.6cqw] font-bold text-white"
            style={{
              fontSize: 'clamp(9px, 1.35cqw, 19px)',
              background: mark === i ? undefined : 'rgba(255,255,255,.07)',
              animation: mark === i ? 'ap-flash 1s ease-in-out infinite alternate' : undefined,
              color: mark === i ? '#111827' : '#fff',
            }}
          >
            <span className="tabular-nums" style={{ width: '4.2cqw' }}>
              {time}
            </span>
            <span className="truncate uppercase tracking-wide">{city}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 대본 ---------------- */
interface DialogProps {
  place: AirportPlace;
  hide: boolean;
  showKo: boolean;
  /** 내 차례 단계에서만 — 어느 상자(1·2번 학생)가 어느 역할인지 */
  owners: { staff: number; customer: number } | null;
  top: string;
  bottom: string;
}

function Dialog({ place, hide, showKo, owners, top, bottom }: DialogProps) {
  const { t } = useTranslation();
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState<number | null>(null);
  const hasBlanks = place.lines.some((l) => l.blank && l.blank.length > 0);

  function reveal(key: string) {
    setShown((s) => new Set(s).add(key));
    playSfx(GAME_SFX.airport.reveal);
  }

  return (
    <>
      {/* 캐릭터 */}
      <div className="absolute z-10 flex flex-col items-center" style={{ left: '1.5%', width: '14%', top, bottom }}>
        <img src={IMG(place.staffArt)} alt="" className="mt-auto max-h-[78%] object-contain drop-shadow-lg" draggable={false} />
        <span className="mt-[0.4cqw] rounded-full bg-orange-500 px-[1cqw] py-[0.2cqw] text-center font-black text-white shadow" style={{ fontSize: 'clamp(9px, 1.25cqw, 17px)' }}>
          {place.staff}
          {owners ? ` · ${t('gameAirport.studentN', { n: owners.staff })}` : ''}
        </span>
      </div>
      <div className="absolute z-10 flex flex-col items-center" style={{ right: '1.5%', width: '14%', top, bottom }}>
        <img src={IMG('traveler')} alt="" className="mt-auto max-h-[78%] object-contain drop-shadow-lg" draggable={false} />
        <span className="mt-[0.4cqw] rounded-full bg-sky-600 px-[1cqw] py-[0.2cqw] text-center font-black text-white shadow" style={{ fontSize: 'clamp(9px, 1.25cqw, 17px)' }}>
          Customer{owners ? ` · ${t('gameAirport.studentN', { n: owners.customer })}` : ''}
        </span>
      </div>

      {/* 대화 */}
      <div
        className="absolute z-10 flex flex-col justify-evenly gap-[0.5cqw] overflow-y-auto rounded-[1.6cqw] bg-white/78 px-[1.4cqw] py-[0.8cqw] shadow-xl"
        style={{ left: '16.5%', right: '16.5%', top, bottom }}
      >
        {place.lines.map((line, li) => {
          const isStaff = line.who === 'staff';
          const segs = splitLine(line, hide);
          return (
            <div key={li} className={`flex ${isStaff ? 'justify-start' : 'justify-end'}`}>
              <div
                className="ap-anim max-w-[88%] rounded-[1.2cqw] border-[0.2cqw] px-[1.1cqw] py-[0.25cqw]"
                style={{
                  background: isStaff ? '#ffedd5' : '#e0f2fe',
                  borderColor: isStaff ? '#fb923c' : '#38bdf8',
                  animation: playing === li ? 'ap-glow 1s ease-in-out' : undefined,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(li);
                    speak(line.text);
                    gameClock.setTimeout(() => setPlaying((p) => (p === li ? null : p)), 900);
                  }}
                  className="block text-left"
                >
                  <span className="block font-bold leading-snug text-slate-800" style={{ fontSize: 'clamp(9px, 1.45cqw, 20px)' }}>
                    <span className="mr-[0.5cqw] font-black" style={{ fontSize: '0.78em', color: isStaff ? '#c2410c' : '#0369a1' }}>
                      {line.speaker}:
                    </span>
                    {segs.map((s, si) => {
                      if (!s.hidden) return <span key={si}>{s.text}</span>;
                      const key = `${li}:${si}`;
                      if (shown.has(key)) return <span key={si} className="rounded bg-yellow-200 px-[0.2cqw] text-emerald-700">{s.text}</span>;
                      return (
                        <span
                          key={si}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            reveal(key);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              reveal(key);
                            }
                          }}
                          className="mx-[0.2cqw] inline-block cursor-pointer rounded border-b-[0.25cqw] border-slate-700 bg-white/70 align-bottom text-transparent"
                          style={{ minWidth: `${Math.max(4, s.text.length * 0.75)}cqw` }}
                          title={t('gameAirport.clickToReveal')}
                        >
                          {s.text.replace(/./g, '·')}
                        </span>
                      );
                    })}
                  </span>
                  {showKo && (
                    <span className="block text-slate-500" style={{ fontSize: 'clamp(8px, 1.05cqw, 14px)' }}>
                      {line.ko}
                    </span>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {hide && hasBlanks && shown.size < place.lines.reduce((a, l) => a + (l.blank?.length ?? 0), 0) && (
        <button
          type="button"
          onClick={() => {
            const all = new Set<string>();
            place.lines.forEach((l, li) => splitLine(l, true).forEach((s, si) => s.hidden && all.add(`${li}:${si}`)));
            setShown(all);
            playSfx(GAME_SFX.airport.reveal);
          }}
          className="ap-btn absolute right-[2%] z-20 rounded-full bg-emerald-500 px-[1.2cqw] py-[0.4cqw] font-bold text-white shadow-lg"
          style={{ top: `calc(${top} - 3cqw)`, fontSize: 'clamp(10px, 1.3cqw, 18px)' }}
        >
          {t('gameAirport.revealAll')}
        </button>
      )}
    </>
  );
}
