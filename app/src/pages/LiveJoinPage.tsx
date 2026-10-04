import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { flushSync } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  forgetLiveToken,
  liveChannelName,
  liveErrorKey,
  liveJoin,
  liveState,
  liveSubmit,
  readLiveNickname,
  readLiveToken,
  type LiveStudentState,
} from '../lib/liveQuiz';
import { CHOICE_STYLES } from '../components/QuizShowHost';

/**
 * 대회 퀴즈쇼 — 학생 휴대폰 화면(/join, /join/:code). 로그인 없이 입장 번호 + 닉네임만.
 * 화면은 선생님 칠판을 따라간다: 방송(broadcast) 신호가 오면 바로 서버에 묻는다. 신호를 놓칠 때를 대비한
 * 예비 폴링은 방송 연결이 살아 있으면 10초, 끊겼거나 다시 붙는 중이면 2초(동시 대회가 많아도 서버가 버티게).
 * 창이 꺼져도 같은 휴대폰이면 저장해 둔 열쇠로, 다른 브라우저면 같은 닉네임으로 다시 들어와 점수가 이어진다(032).
 * 이름은 닉네임만 받는다(개인정보를 남기지 않게) — 선생님이 칠판에서 부적절한 닉네임을 내보낼 수 있다.
 */
export default function LiveJoinPage() {
  const { t } = useTranslation();
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(codeParam ?? '');
  const [nickname, setNickname] = useState(() => readLiveNickname());
  const [rejoined, setRejoined] = useState(false);
  const [token, setToken] = useState<string | null>(() => (codeParam ? readLiveToken(codeParam) : null));
  const [state, setState] = useState<LiveStudentState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<number | 'text' | 'buzz' | null>(null);
  const offsetRef = useRef(0);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const s = await liveState(token);
      if (s.error === 'no_player') {
        // 선생님이 내보냈거나 대회가 새로 열림
        forgetLiveToken(code);
        setToken(null);
        setState(null);
        setError(t('liveQuiz.err_no_player'));
        return;
      }
      offsetRef.current = Date.parse(s.server_now) - Date.now();
      setState(s);
    } catch {
      /* 잠깐 끊김 — 다음 번에 */
    }
  }, [token, code, t]);

  useEffect(() => {
    if (!token) return;
    void load();
    let poll: number | undefined;
    const setPoll = (ms: number) => {
      window.clearInterval(poll);
      poll = window.setInterval(() => void load(), ms);
    };
    setPoll(FALLBACK_POLL_MS);
    const ch = supabase
      .channel(liveChannelName(code))
      .on('broadcast', { event: 'state' }, () => void load())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // 방송이 (다시) 연결됐다 — 끊긴 사이 놓친 화면을 바로 받고, 예비 폴링은 느리게
          void load();
          setPoll(HEALTHY_POLL_MS);
        } else {
          setPoll(FALLBACK_POLL_MS);
        }
      });
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(ch);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [token, code, load]);

  useEffect(() => {
    if (!rejoined) return;
    const id = window.setTimeout(() => setRejoined(false), 4000);
    return () => window.clearTimeout(id);
  }, [rejoined]);

  // 문제가 바뀌면 입력칸 비우기
  const qKey = `${state?.phase}:${state?.q_index}`;
  useEffect(() => {
    setText('');
    setPending(null);
    setError(null);
  }, [qKey]);

  useEffect(() => {
    if (state?.phase !== 'question') return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [state?.phase]);

  async function join() {
    const c = code.replace(/\D/g, '');
    if (c.length !== 6 || !nickname.trim()) return;
    setBusy(true);
    setError(null);
    try {
      // 이 휴대폰이 이 대회에 들어왔던 적이 있으면(첫 화면 /join 으로 다시 온 경우) 그 열쇠로 이어서
      const saved = readLiveToken(c);
      if (saved) {
        const s = await liveState(saved).catch(() => null);
        if (s && s.error !== 'no_player') {
          setCode(c);
          if (codeParam !== c) navigate(`/join/${c}`, { replace: true });
          setToken(saved);
          setRejoined(true);
          return;
        }
        forgetLiveToken(c);
      }
      const res = await liveJoin(c, nickname.trim());
      const tk = res.token;
      if (res.rejoined) setRejoined(true);
      setCode(c);
      if (codeParam !== c) navigate(`/join/${c}`, { replace: true });
      setToken(tk);
    } catch (e) {
      setError(t(liveErrorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  async function submit(choice: number | null, answerText: string | null, kind: 'choice' | 'text' | 'buzz') {
    if (!token || !state) return;
    setPending(kind === 'choice' ? choice : kind);
    setError(null);
    try {
      await liveSubmit(token, state.q_index, choice, answerText);
      if ('vibrate' in navigator) navigator.vibrate?.(60);
      await load();
    } catch (e) {
      setError(t(liveErrorKey(e)));
      setPending(null);
      void load();
    }
  }

  function leave() {
    forgetLiveToken(code);
    setToken(null);
    setState(null);
  }

  const shell = 'flex min-h-[100dvh] flex-col bg-[#16213e] text-white';
  const topBar = state && (
    <>
    {rejoined && (
      <div className="bg-[#2e9e5b] px-4 py-2 text-center text-sm font-bold">{t('liveQuiz.rejoined')}</div>
    )}
    <div className="flex items-center gap-2 px-4 py-3 text-sm text-white/80">
      <span className="font-bold text-white">{state.nickname}</span>
      <span className="ml-auto tabular-nums">
        {t('liveQuiz.myScore')} <b className="text-warm-yellow">{state.score.toLocaleString()}</b>
      </span>
    </div>
    </>
  );

  /* ---------- 입장 ---------- */
  if (!token || !state) {
    const ready = code.replace(/\D/g, '').length === 6 && nickname.trim().length > 0;
    return (
      <div className={`${shell} items-center justify-center p-6`}>
        <form
          className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 text-deep-navy shadow-xl"
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '32px' }}>emoji_events</span>
            <h1 className="text-2xl font-bold">{t('liveQuiz.joinTitle')}</h1>
          </div>
          {token && !state && <p className="text-center text-on-surface-variant">{t('common.loading')}</p>}
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-on-surface-variant">{t('liveQuiz.codeLabel')}</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="123456"
              className="w-full rounded-xl border-2 border-outline-variant px-4 py-3 text-center text-3xl font-bold tracking-[0.3em] outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-on-surface-variant">{t('liveQuiz.nicknameLabel')}</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 12))}
              autoComplete="off"
              autoFocus={!!codeParam}
              placeholder={t('liveQuiz.nicknamePlaceholder')}
              className="w-full rounded-xl border-2 border-outline-variant px-4 py-3 text-center text-xl font-bold outline-none focus:border-primary"
            />
          </label>
          {error && <p className="rounded-lg bg-error-container px-3 py-2 text-center text-sm text-on-error-container">{error}</p>}
          <button
            type="submit"
            disabled={!ready || busy}
            className="w-full rounded-full bg-primary py-3.5 text-lg font-bold text-on-primary shadow-md disabled:opacity-40"
          >
            {busy ? t('common.loading') : t('liveQuiz.joinButton')}
          </button>
          <p className="text-center text-xs text-on-surface-variant">{t('liveQuiz.privacyNote')}</p>
        </form>
      </div>
    );
  }

  const q = state.question;
  const mine = state.my_answer;
  const center = 'flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center';

  if (state.phase === 'ended') {
    return (
      <div className={shell}>
        <div className={center}>
          <span className="material-symbols-outlined text-warm-yellow" style={{ fontSize: '64px' }}>flag</span>
          <h2 className="text-2xl font-bold">{t('liveQuiz.endedTitle')}</h2>
          <button type="button" onClick={leave} className="rounded-full bg-white/15 px-6 py-3 font-bold">
            {t('liveQuiz.leave')}
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === 'lobby' || !q) {
    return (
      <div className={shell}>
        {topBar}
        <div className={center}>
          <span className="material-symbols-outlined animate-bounce text-warm-yellow" style={{ fontSize: '64px' }}>sentiment_very_satisfied</span>
          <h2 className="text-3xl font-bold">{t('liveQuiz.youreIn', { name: state.nickname })}</h2>
          <p className="text-white/70">{t('liveQuiz.lookAtBoard')}</p>
        </div>
      </div>
    );
  }

  if (state.phase === 'leaderboard' || state.phase === 'final') {
    return (
      <div className={shell}>
        {topBar}
        <div className={center}>
          <span className="material-symbols-outlined" style={{ fontSize: '72px',  color: state.rank <= 3 ? '#FFD54F' : '#ffffffaa' }}>
            {state.phase === 'final' && state.rank === 1 ? 'trophy' : state.rank <= 3 ? 'workspace_premium' : 'military_tech'}
          </span>
          <div className="text-lg text-white/80">{state.phase === 'final' ? t('liveQuiz.finalRank') : t('liveQuiz.nowRank')}</div>
          <div className="text-6xl font-black text-warm-yellow">{t('liveQuiz.rankN', { n: state.rank })}</div>
          <div className="text-white/70">{t('liveQuiz.ofPlayers', { count: state.players })}</div>
        </div>
      </div>
    );
  }

  // 정답 공개
  if (state.phase === 'reveal') {
    const ok = mine?.correct === true;
    const judged = mine && mine.correct != null;
    return (
      <div className={shell} style={{ background: !mine ? '#16213e' : ok ? '#2e9e5b' : judged ? '#c0393e' : '#16213e' }}>
        {topBar}
        <div className={center}>
          <span className="material-symbols-outlined" style={{ fontSize: '88px' }}>{!mine ? 'hourglass_disabled' : ok ? 'check_circle' : judged ? 'cancel' : 'help'}</span>
          <h2 className="text-4xl font-black">
            {!mine ? t('liveQuiz.noAnswerMine') : ok ? t('liveQuiz.correct') : judged ? t('liveQuiz.wrong') : t('liveQuiz.notJudged')}
          </h2>
          {ok && mine?.points != null && <div className="text-2xl font-bold">+{mine.points.toLocaleString()}</div>}
          {(q.kind === 'text' || q.kind === 'buzzer') && q.answer && (
            <div className="text-white/85">
              {t('liveQuiz.answerIs')} <b className="text-xl">{q.answer}</b>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 문제 — 이미 냈으면 기다리기
  if (mine) {
    return (
      <div className={shell}>
        {topBar}
        <div className={center}>
          {q.kind === 'buzzer' ? (
            <>
              <div className="text-7xl font-black text-warm-yellow">{mine.buzz_order ?? '?'}</div>
              <h2 className="text-2xl font-bold">{t('liveQuiz.buzzedOrder', { n: mine.buzz_order ?? '?' })}</h2>
              <p className="text-white/75">
                {mine.correct === true ? t('liveQuiz.correct') : mine.correct === false ? t('liveQuiz.wrong') : t('liveQuiz.sayAnswer')}
              </p>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined animate-pulse text-warm-yellow" style={{ fontSize: '72px' }}>schedule</span>
              <h2 className="text-2xl font-bold">{t('liveQuiz.submitted')}</h2>
              {mine.text && <div className="rounded-xl bg-white/10 px-4 py-2 text-xl font-bold">{mine.text}</div>}
              <p className="text-white/70">{t('liveQuiz.waitReveal')}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const secs = q.seconds ?? 20;
  const remaining =
    q.kind !== 'buzzer' && state.started_at
      ? Math.max(0, Math.ceil(secs - (now + offsetRef.current - Date.parse(state.started_at)) / 1000))
      : null;
  const timeUp = remaining === 0;

  return (
    <div className={shell}>
      {topBar}
      <div className="flex items-center gap-3 px-4">
        <span className="text-sm text-white/70">{t('liveQuiz.questionOf', { n: state.q_index + 1, total: state.q_count })}</span>
        {remaining != null && (
          <span className={`ml-auto rounded-full px-3 py-1 text-lg font-bold tabular-nums ${remaining <= 5 ? 'bg-error' : 'bg-white/15'}`}>
            {remaining}
          </span>
        )}
      </div>
      <div className="px-4 py-3 text-center text-2xl font-bold leading-snug">{q.prompt}</div>
      {error && <p className="mx-4 rounded-lg bg-error px-3 py-2 text-center text-sm">{error}</p>}

      {q.kind === 'choice' && (
        <div className="grid flex-1 grid-cols-1 gap-3 p-4 min-[400px]:grid-cols-2">
          {(q.choices ?? []).map((c, i) => {
            const st = CHOICE_STYLES[i % CHOICE_STYLES.length];
            return (
              <button
                key={i}
                type="button"
                disabled={pending != null || timeUp}
                onClick={() => void submit(i, null, 'choice')}
                className={`flex min-h-[84px] items-center gap-3 rounded-2xl px-4 text-left text-xl font-bold shadow-lg active:scale-95 disabled:opacity-60 ${pending === i ? 'ring-4 ring-white' : ''}`}
                style={{ background: st.bg }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '30px',  fontVariationSettings: "'FILL' 1" }}>{st.icon}</span>
                <span className="min-w-0 flex-1 break-words">{c}</span>
              </button>
            );
          })}
        </div>
      )}

      {q.kind === 'ox' && (
        <div className="grid flex-1 grid-cols-2 gap-3 p-4">
          {['O', 'X'].map((mark, i) => (
            <button
              key={mark}
              type="button"
              disabled={pending != null || timeUp}
              onClick={() => void submit(i, null, 'choice')}
              className={`rounded-3xl text-[96px] font-black shadow-lg active:scale-95 disabled:opacity-60 ${pending === i ? 'ring-4 ring-white' : ''}`}
              style={{ background: i === 0 ? '#2f6fdb' : '#e5484d' }}
            >
              {mark}
            </button>
          ))}
        </div>
      )}

      {q.kind === 'text' && (
        <TextAnswer
          text={text}
          setText={setText}
          disabled={pending != null || timeUp}
          onSubmit={() => {
            if (text.trim()) void submit(null, text.trim(), 'text');
          }}
        />
      )}

      {q.kind === 'buzzer' && (
        <div className="flex flex-1 items-center justify-center p-6">
          <button
            type="button"
            disabled={pending != null}
            onClick={() => void submit(null, null, 'buzz')}
            className="flex aspect-square w-[min(78vw,340px)] items-center justify-center rounded-full border-[10px] border-[#8f1d21] bg-[#e5484d] text-4xl font-black shadow-[0_14px_0_#8f1d21] active:translate-y-2 active:shadow-[0_6px_0_#8f1d21] disabled:opacity-70"
          >
            {t('liveQuiz.buzz')}
          </button>
        </div>
      )}
      {timeUp && <p className="pb-6 text-center font-bold text-white/80">{t('liveQuiz.timeUp')}</p>}
    </div>
  );
}

/** 방송이 살아 있을 때 예비 폴링 간격 / 끊겼을 때 */
const HEALTHY_POLL_MS = 10_000;
const FALLBACK_POLL_MS = 2_000;

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const KBD_PREF_KEY = 'classbank.live.keyboard';

function readKbdPref(): 'screen' | 'device' {
  try {
    return localStorage.getItem(KBD_PREF_KEY) === 'device' ? 'device' : 'screen';
  } catch {
    return 'screen';
  }
}

/**
 * 철자 쓰기(주관식) 답 칸 — 기본은 화면 자판(2026-09-28). 아이패드·아이폰 사파리는 입력칸을 코드로 눌러 줘도
 * 기기 자판이 안 뜨고, 아이가 칸을 한 번 더 눌러야 해서 순발력 대회에서 불리했다. 화면 자판은 문제가 뜨자마자
 * 바로 누를 수 있고 모든 기기에서 같다(자동 고침·대문자 자동 변환도 없음). 연결된 실물 키보드로도 칠 수 있다.
 * 한글 답처럼 화면 자판에 없는 글자가 필요하면 "기기 자판으로 쓰기"로 바꾼다(선택은 이 휴대폰에 기억).
 */
export function TextAnswer({
  text,
  setText,
  disabled,
  onSubmit,
}: {
  text: string;
  setText: (v: string | ((prev: string) => string)) => void;
  disabled: boolean;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'screen' | 'device'>(readKbdPref);
  const inputRef = useRef<HTMLInputElement>(null);
  const type = useCallback((ch: string) => setText((prev) => (prev + ch).slice(0, 60)), [setText]);
  const back = useCallback(() => setText((prev) => prev.slice(0, -1)), [setText]);

  // 실물 키보드(블루투스 키보드·노트북)
  useEffect(() => {
    if (mode !== 'screen' || disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Backspace') back();
      else if (e.key === 'Enter') onSubmit();
      else if (e.key.length === 1 && /[a-zA-Z '\-.]/.test(e.key)) type(e.key.toLowerCase());
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, disabled, back, type, onSubmit]);

  function switchMode(next: 'screen' | 'device') {
    try {
      localStorage.setItem(KBD_PREF_KEY, next);
    } catch {
      /* 무시 */
    }
    // 아이패드는 누른 그 순간(같은 터치 안)에 입력칸을 눌러 줘야 자판이 뜬다 — 바로 그리고 바로 누른다
    flushSync(() => setMode(next));
    if (next === 'device') inputRef.current?.focus();
  }

  const key = 'flex h-14 min-w-0 flex-1 items-center justify-center rounded-xl bg-white text-2xl font-bold text-deep-navy shadow-[0_3px_0_#9aa3b5] active:translate-y-0.5 active:shadow-none disabled:opacity-50 [touch-action:manipulation]';

  if (mode === 'device') {
    return (
      <form
        className="flex flex-1 flex-col gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 60))}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          enterKeyHint="send"
          placeholder={t('liveQuiz.typeHere')}
          className="w-full rounded-2xl border-2 border-white/30 bg-white px-4 py-4 text-center text-2xl font-bold text-deep-navy outline-none focus:border-warm-yellow"
        />
        <button
          type="submit"
          disabled={!text.trim() || disabled}
          className="rounded-full bg-warm-yellow py-4 text-xl font-bold text-deep-navy shadow-lg disabled:opacity-50"
        >
          {t('liveQuiz.submit')}
        </button>
        <button type="button" onClick={() => switchMode('screen')} className="mx-auto text-sm text-white/70 underline">
          {t('liveQuiz.useScreenKeyboard')}
        </button>
      </form>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 p-3">
      <div
        className={`flex min-h-[64px] items-center justify-center break-all rounded-2xl border-2 bg-white px-4 py-3 text-center text-3xl font-bold text-deep-navy ${text ? 'border-warm-yellow' : 'border-white/30'}`}
        aria-live="polite"
      >
        {text ? (
          <span>
            {text}
            <span className="ml-0.5 inline-block h-8 w-[3px] animate-pulse bg-deep-navy align-middle" />
          </span>
        ) : (
          <span className="text-xl text-on-surface-variant">{t('liveQuiz.typeHere')}</span>
        )}
      </div>
      <div className="flex flex-col gap-2 select-none">
        {KEY_ROWS.map((row, r) => (
          <div key={row} className="flex gap-1.5" style={{ paddingInline: r === 1 ? '4%' : r === 2 ? '0' : undefined }}>
            {r === 2 && (
              <button type="button" disabled={disabled} onClick={() => type("'")} className={key} aria-label="apostrophe">
                &#39;
              </button>
            )}
            {[...row].map((ch) => (
              <button key={ch} type="button" disabled={disabled} onClick={() => type(ch)} className={key}>
                {ch}
              </button>
            ))}
            {r === 2 && (
              <button type="button" disabled={disabled || !text} onClick={back} className={`${key} flex-[1.6] bg-white/80`} aria-label={t('liveQuiz.backspace')}>
                <span aria-hidden>⌫</span>
              </button>
            )}
          </div>
        ))}
        <div className="flex gap-1.5">
          <button type="button" disabled={disabled} onClick={() => type('-')} className={key}>
            -
          </button>
          <button type="button" disabled={disabled} onClick={() => type(' ')} className={`${key} flex-[5] text-base`}>
            {t('liveQuiz.space')}
          </button>
          <button
            type="button"
            disabled={disabled || !text.trim()}
            onClick={onSubmit}
            className="flex h-14 min-w-0 flex-[3] items-center justify-center rounded-xl bg-warm-yellow text-xl font-bold text-deep-navy shadow-lg active:translate-y-0.5 disabled:opacity-50 [touch-action:manipulation]"
          >
            {t('liveQuiz.submit')}
          </button>
        </div>
      </div>
      <button type="button" onClick={() => switchMode('device')} className="mx-auto mt-1 text-sm text-white/70 underline">
        {t('liveQuiz.useDeviceKeyboard')}
      </button>
    </div>
  );
}
