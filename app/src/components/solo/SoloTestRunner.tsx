import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playSfx } from '../../lib/gameSfx';
import { speakAsync } from '../../lib/speech';
import type { SoloPublicStep, SoloPublicTestItem, TestArea } from '../../lib/soloLessons';
import { TEST_AREAS, testSeconds, type TestResult } from '../../lib/soloTest';

type TestStep = Extract<SoloPublicStep, { t: 'test' }>;

const btn = 'min-h-14 rounded-2xl px-5 text-xl font-bold [touch-action:manipulation] disabled:opacity-40';
const CHOICE = ['pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect', 'sayPick', 'pickPos'];
const LISTEN = ['listenPick', 'dictation'];

/**
 * 시험 블록 화면 — 수업 단계와 규칙이 다르다:
 *  - 문제마다 제한 시간(끄면 없음). 시간이 다 되면 고른 답(없으면 빈 답)으로 다음 문제로 간다.
 *  - 듣기 문제는 한 번만 들려주고, 소리가 나오는 동안은 시계가 멈춘다.
 *  - 틀려도 정답을 바로 보여 주지 않고, 다 푼 뒤 한 번에 채점(서버)해서 영역별 점수와 정답을 보여 준다.
 *  - "모르겠어요"는 없다(빈 답은 오답).
 */
export default function SoloTestRunner({
  step,
  onSubmit,
  onDone,
}: {
  step: TestStep;
  /** 답안 내기 → 채점 결과(이미 낸 시험이면 처음 결과) */
  onSubmit: (answers: (string | null)[]) => Promise<TestResult>;
  /** 결과를 보고 다음으로 */
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const items = step.items;
  const [phase, setPhase] = useState<'start' | 'run' | 'sending' | 'result'>('start');
  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>(() => items.map(() => null));
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const minutes = Math.max(1, Math.round(testSeconds(items) / 60));

  async function send() {
    setPhase('sending');
    setError(false);
    try {
      const r = await onSubmit(answersRef.current);
      setResult(r);
      setPhase('result');
      playSfx(r.total > 0 && r.score / r.total >= 0.6 ? 5037 : 4015);
    } catch {
      setError(true);
      setPhase('run');
    }
  }

  function setAnswer(v: string | null) {
    setAnswers((cur) => cur.map((x, i) => (i === pos ? v : x)));
  }

  function nextItem() {
    if (pos + 1 >= items.length) void send();
    else setPos(pos + 1);
  }

  if (phase === 'start') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <div className="text-6xl">📝</div>
        <h1 className="text-3xl font-bold">{step.title || t('soloTest.defaultTitle')}</h1>
        <p className="text-xl text-white/85">{t('soloTest.startInfo', { count: items.length, minutes })}</p>
        <ul className="w-full max-w-sm list-disc space-y-1.5 rounded-2xl bg-white/10 py-3 pl-8 pr-4 text-left text-lg text-white/85">
          {step.timed && <li>{t('soloTest.ruleTimed')}</li>}
          {items.some((it) => LISTEN.includes(it.t)) && <li>{t('soloTest.ruleListen')}</li>}
          <li>{t('soloTest.ruleEnd')}</li>
        </ul>
        <button type="button" onClick={() => setPhase('run')} className={`${btn} bg-warm-yellow px-10 text-deep-navy`}>
          {t('soloTest.start')}
        </button>
      </div>
    );
  }

  if (phase === 'result' && result) {
    return <TestResultView items={items} answers={answers} result={result} onDone={onDone} />;
  }

  const item = items[pos];
  if (!item) return null;
  return (
    <TestItemView
      key={pos}
      item={item}
      index={pos}
      count={items.length}
      timed={step.timed}
      value={answers[pos]}
      sending={phase === 'sending'}
      error={error}
      onChange={setAnswer}
      onNext={nextItem}
    />
  );
}

/* ---------------- 문제 하나 ---------------- */

function TestItemView({
  item,
  index,
  count,
  timed,
  value,
  sending,
  error,
  onChange,
  onNext,
}: {
  item: SoloPublicTestItem;
  index: number;
  count: number;
  timed: boolean;
  value: string | null;
  sending: boolean;
  error: boolean;
  onChange: (v: string | null) => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const isListen = LISTEN.includes(item.t);
  const [left, setLeft] = useState(item.sec);
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false);
  const [typed, setTyped] = useState<number[]>([]);
  const [text, setText] = useState('');
  const nextRef = useRef(onNext);
  nextRef.current = onNext;
  const commitRef = useRef<() => void>(() => undefined);

  // 철자·문장 배열·쓰기는 지금 만든 답을 시간이 다 됐을 때도 내도록 기억한다
  commitRef.current = () => {
    if (item.t === 'spell') onChange(typed.length ? typed.map((n) => item.letters[n]).join('') : null);
    else if (item.t === 'unscramble') onChange(typed.length ? typed.map((n) => item.words[n]).join(' ') : null);
    else if (item.t === 'typeWord' || item.t === 'dictation') onChange(text.trim() || null);
  };

  async function play() {
    if (playing || played || !('word' in item)) return;
    setPlaying(true);
    await speakAsync(item.word);
    setPlaying(false);
    setPlayed(true);
  }

  // 듣기 문제는 처음에 저절로 한 번 들려준다
  useEffect(() => {
    if (isListen) void play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 제한 시간 — 듣는 동안은 멈춘다
  useEffect(() => {
    if (!timed || playing || sending) return;
    if (left <= 0) {
      commitRef.current();
      // 답을 상태에 넣은 다음 넘어간다
      const id = window.setTimeout(() => nextRef.current(), 0);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [timed, playing, sending, left]);

  function confirm() {
    commitRef.current();
    window.setTimeout(() => nextRef.current(), 0);
  }

  const ready = CHOICE.includes(item.t)
    ? value !== null
    : item.t === 'spell'
      ? typed.length === item.letters.length
      : item.t === 'unscramble'
        ? typed.length === item.words.length
        : text.trim().length > 0;
  const pct = timed ? Math.max(0, Math.min(100, (left / item.sec) * 100)) : 100;

  return (
    <div className="flex w-full flex-1 flex-col items-center gap-4">
      <div className="flex w-full items-center gap-3">
        <span className="rounded-full bg-white/10 px-3 py-1 text-base font-bold text-white/80">{t(`soloTest.area_${item.area}`)}</span>
        <span className="text-base tabular-nums text-white/70">
          {index + 1} / {count}
        </span>
        {timed && (
          <span className={`ml-auto flex items-center gap-1 text-lg font-bold tabular-nums ${left <= 5 ? 'text-warm-yellow' : 'text-white/85'}`}>
            <span className="material-symbols-outlined text-[20px]">{playing ? 'pause_circle' : 'timer'}</span>
            {t('soloTest.secondsLeft', { n: Math.max(0, left) })}
          </span>
        )}
      </div>
      {timed && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
          <div className={`h-full rounded-full transition-all duration-1000 ease-linear ${left <= 5 ? 'bg-warm-yellow' : 'bg-emerald-300'}`} style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* 문제 */}
      {item.t === 'pickWord' && (
        <>
          <p className="text-xl font-bold">{t('solo.pickWordQ')}</p>
          {item.imageUrl ? <img src={item.imageUrl} alt="" className="max-h-52 w-full max-w-sm rounded-3xl bg-white object-contain p-2" /> : <p className="text-3xl font-bold">{item.meaning}</p>}
        </>
      )}
      {item.t === 'pickMeaning' && (
        <>
          <p className="text-xl font-bold">{t('solo.pickMeaningQ')}</p>
          <p className="text-5xl font-bold">{item.word}</p>
        </>
      )}
      {item.t === 'pickPos' && (
        <>
          <p className="text-xl font-bold">{item.sentence ? t('solo.pickPosSentenceQ') : t('solo.pickPosQ')}</p>
          <p className="rounded-2xl bg-white/10 px-5 py-4 text-center text-3xl font-bold">{item.sentence ?? item.word}</p>
          {item.sentence && <p className="text-lg text-warm-yellow">{item.word}</p>}
        </>
      )}
      {isListen && (
        <>
          <p className="text-xl font-bold">{item.t === 'listenPick' ? t('solo.listenQ') : t('solo.dictationQ')}</p>
          <button type="button" disabled={playing || played} onClick={() => void play()} className="flex items-center gap-2 rounded-full bg-warm-yellow px-6 py-3 text-xl font-bold text-deep-navy disabled:opacity-60">
            <span className="material-symbols-outlined">{playing ? 'graphic_eq' : 'volume_up'}</span>
            {playing ? t('soloTest.listening') : played ? t('soloTest.playedOnce') : t('soloTest.listenOnce')}
          </button>
        </>
      )}
      {item.t === 'typeWord' && (
        <>
          <p className="text-xl font-bold">{t('solo.typeQ')}</p>
          {item.imageUrl && <img src={item.imageUrl} alt="" className="max-h-44 w-full max-w-xs rounded-3xl bg-white object-contain p-2" />}
          <p className="text-3xl font-bold">{item.meaning}</p>
        </>
      )}
      {item.t === 'spell' && (
        <>
          <p className="text-xl font-bold">{t('solo.spellQ')}</p>
          {item.imageUrl && <img src={item.imageUrl} alt="" className="max-h-44 w-full max-w-xs rounded-3xl bg-white object-contain p-2" />}
          <p className="text-2xl text-white/85">{item.meaning}</p>
        </>
      )}
      {item.t === 'fillBlank' && (
        <>
          <p className="text-xl font-bold">{t('solo.fillQ')}</p>
          <p className="rounded-2xl bg-white/10 px-4 py-4 text-center text-2xl font-bold leading-snug">{item.sentence}</p>
          <p className="text-lg text-white/70">{item.meaning}</p>
        </>
      )}
      {item.t === 'translatePick' && (
        <>
          <p className="text-xl font-bold">{t('solo.translateQ')}</p>
          <p className="w-full rounded-2xl bg-white/10 px-5 py-4 text-center text-2xl font-bold leading-snug">{item.sentence}</p>
        </>
      )}
      {item.t === 'pickCorrect' && <p className="text-xl font-bold">{t('solo.correctQ')}</p>}
      {item.t === 'sayPick' && (
        <>
          <p className="text-xl font-bold">{t('soloTest.sayPickQ')}</p>
          {item.imageUrl && <img src={item.imageUrl} alt="" className="max-h-44 w-full max-w-xs rounded-3xl bg-white object-contain p-2" />}
          <p className="text-center text-2xl font-bold">{item.situation}</p>
        </>
      )}
      {item.t === 'unscramble' && <p className="text-xl font-bold">{t('solo.unscrambleQ')}</p>}

      {/* 답 */}
      {item.t === 'listenPick' && (
        <div className="grid w-full grid-cols-2 gap-3">
          {item.options.map((o, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(String(i))}
              className={`flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl p-2 [touch-action:manipulation] ${value === String(i) ? 'bg-warm-yellow text-deep-navy ring-4 ring-white' : 'bg-white text-deep-navy'}`}
            >
              {item.images[i] ? <img src={item.images[i] ?? ''} alt="" className="h-20 w-20 object-contain" /> : <span className="text-2xl font-bold">{o}</span>}
            </button>
          ))}
        </div>
      )}
      {CHOICE.includes(item.t) && item.t !== 'listenPick' && 'options' in item && (
        <div className="grid w-full gap-3">
          {item.options.map((o, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(String(i))}
              className={`min-h-16 rounded-2xl px-4 py-2 text-xl font-bold leading-snug [touch-action:manipulation] sm:text-2xl ${value === String(i) ? 'bg-warm-yellow text-deep-navy ring-4 ring-white' : 'bg-white text-deep-navy shadow-[0_4px_0_#9aa3b5]'}`}
            >
              {o}
            </button>
          ))}
        </div>
      )}
      {(item.t === 'spell' || item.t === 'unscramble') && (() => {
        const parts = item.t === 'spell' ? item.letters : item.words;
        const sep = item.t === 'spell' ? '' : ' ';
        return (
          <>
            <div className="flex min-h-16 w-full flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/30 p-3" aria-live="polite">
              {typed.length === 0 ? <span className="text-white/40">{t('soloTest.tapPieces')}</span> : <span className="text-3xl font-bold">{typed.map((n) => parts[n]).join(sep)}</span>}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {parts.map((p, n) => (
                <button
                  key={n}
                  type="button"
                  disabled={typed.includes(n)}
                  onClick={() => setTyped((a) => [...a, n])}
                  className="min-w-12 rounded-xl bg-white px-3 py-2 text-2xl font-bold text-deep-navy shadow-[0_4px_0_#9aa3b5] [touch-action:manipulation] disabled:opacity-30"
                >
                  {p}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setTyped((a) => a.slice(0, -1))} disabled={typed.length === 0} className="rounded-full border border-white/30 px-5 py-2 text-base text-white/80 disabled:opacity-30">
              {t('solo.erase')}
            </button>
          </>
        );
      })()}
      {(item.t === 'typeWord' || item.t === 'dictation') && (
        <form
          className="flex w-full flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) confirm();
          }}
        >
          <p className="text-center font-mono text-2xl tracking-[0.3em] text-white/60">{'_'.repeat(item.length)}</p>
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-14 w-full rounded-2xl bg-white px-4 text-center text-3xl font-bold text-deep-navy outline-none focus:ring-4 focus:ring-warm-yellow"
          />
        </form>
      )}

      {error && <p className="text-center text-lg text-warm-yellow" role="alert">{t('solo.error')}</p>}
      <button type="button" disabled={!ready || sending} onClick={confirm} className={`${btn} mt-auto w-full bg-warm-yellow text-deep-navy`}>
        {sending ? t('soloTest.sending') : index + 1 >= count ? t('soloTest.submit') : t('soloTest.next')}
      </button>
    </div>
  );
}

/* ---------------- 결과(성적표) ---------------- */

function TestResultView({ items, answers, result, onDone }: { items: SoloPublicTestItem[]; answers: (string | null)[]; result: TestResult; onDone: () => void }) {
  const { t } = useTranslation();
  const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
  const areas = useMemo(() => TEST_AREAS.filter((a) => result.by_area[a]?.total), [result]);

  /** 내가 낸 답을 글자로 */
  const givenText = (it: SoloPublicTestItem, v: string | null): string => {
    if (v === null || v === '') return t('soloTest.noAnswer');
    if ('options' in it && /^\d+$/.test(v)) return it.options[Number(v)] ?? v;
    return v;
  };
  const prompt = (it: SoloPublicTestItem): string => {
    switch (it.t) {
      case 'pickWord':
        return it.meaning;
      case 'pickMeaning':
        return it.word;
      case 'pickPos':
        return it.sentence ?? it.word;
      case 'listenPick':
      case 'dictation':
        return `🔊 ${it.word}`;
      case 'typeWord':
      case 'spell':
        return it.meaning;
      case 'fillBlank':
      case 'translatePick':
        return it.sentence;
      case 'sayPick':
        return it.situation;
      case 'pickCorrect':
        return t('solo.correctQ');
      case 'unscramble':
        return t('solo.unscrambleQ');
    }
  };

  return (
    <div className="flex w-full flex-1 flex-col items-center gap-4">
      <div className="solo-pop text-6xl">{pct >= 80 ? '🏆' : pct >= 50 ? '👏' : '💪'}</div>
      <h1 className="text-3xl font-bold">{t('soloTest.resultTitle')}</h1>
      <p className="text-5xl font-bold text-warm-yellow tabular-nums">{pct}%</p>
      <p className="text-xl text-white/80">{t('soloTest.resultScore', { score: result.score, total: result.total })}</p>

      <div className="w-full space-y-2 rounded-2xl bg-white/10 p-4">
        {areas.map((a: TestArea) => {
          const r = result.by_area[a] ?? { right: 0, total: 0 };
          const p = r.total ? Math.round((r.right / r.total) * 100) : 0;
          return (
            <div key={a} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-base font-bold">{t(`soloTest.area_${a}`)}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/15">
                <div className={`h-full rounded-full ${p >= 80 ? 'bg-emerald-300' : p >= 50 ? 'bg-sky-300' : 'bg-warm-yellow'}`} style={{ width: `${p}%` }} />
              </div>
              <span className="w-14 shrink-0 text-right text-base tabular-nums text-white/85">
                {r.right}/{r.total}
              </span>
            </div>
          );
        })}
      </div>

      <ol className="w-full space-y-2">
        {items.map((it, i) => {
          const r = result.items[i];
          return (
            <li key={i} className={`rounded-2xl px-4 py-3 text-left ${r?.correct ? 'bg-emerald-500/15' : 'bg-white/10'}`}>
              <div className="flex items-start gap-2">
                <span className={`material-symbols-outlined shrink-0 ${r?.correct ? 'text-emerald-300' : 'text-warm-yellow'}`}>{r?.correct ? 'check_circle' : 'cancel'}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-base text-white/70">
                    {i + 1}. {prompt(it)}
                  </div>
                  {!r?.correct && (
                    <div className="mt-1 text-lg">
                      <span className="text-white/60">{t('soloTest.yourAnswer')} </span>
                      <span className="line-through decoration-white/40">{givenText(it, answers[i])}</span>
                    </div>
                  )}
                  <div className="text-lg font-bold">
                    <span className="font-normal text-white/60">{t('soloTest.correctAnswer')} </span>
                    {r?.answer ?? ''}
                  </div>
                  {it.t === 'pickCorrect' && it.why && !r?.correct && <div className="mt-1 text-base text-white/75">💡 {it.why}</div>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <button type="button" onClick={onDone} className={`${btn} w-full bg-warm-yellow text-deep-navy`}>
        {t('solo.next')}
      </button>
    </div>
  );
}
