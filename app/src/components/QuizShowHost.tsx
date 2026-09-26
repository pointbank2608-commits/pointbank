import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  liveChannelName,
  liveErrorKey,
  liveFetchAnswers,
  liveFetchPlayers,
  liveHostCreate,
  liveHostSet,
  liveJoinUrl,
  liveJudge,
  liveKick,
  liveRanking,
  type LiveAnswer,
  type LivePhase,
  type LivePlayer,
  type LiveSession,
} from '../lib/liveQuiz';
import type { LiveQuestion } from '../lib/types';

/**
 * 대회 퀴즈쇼 — 전자칠판(선생님) 화면. 대기실(QR·입장 번호) → 라운드 소개 → 문제 → 정답 공개 → 순위 → … → 시상대.
 * 칠판은 학생들이 같이 보는 화면이라 주관식·부저 정답은 문제가 열려 있는 동안 나오지 않는다
 * (선생님은 "정답 살짝 보기"를 누르고 있는 동안만 본다).
 */

export const CHOICE_STYLES = [
  { bg: '#e5484d', icon: 'change_history' },
  { bg: '#2f6fdb', icon: 'diamond' },
  { bg: '#d99a00', icon: 'circle' },
  { bg: '#2e9e5b', icon: 'square' },
  { bg: '#8e4ec6', icon: 'hexagon' },
  { bg: '#12a594', icon: 'star' },
];

const norm = (s: string) => s.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');

interface Props {
  title: string;
  questions: LiveQuestion[];
  classId: string | null;
  templateId: string | null;
  speedBonus: boolean;
}

export default function QuizShowHost({ title, questions, classId, templateId, speedBonus }: Props) {
  const { t } = useTranslation();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [players, setPlayers] = useState<LivePlayer[]>([]);
  const [answers, setAnswers] = useState<LiveAnswer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  // 라운드 소개 화면(서버 단계와 별개로 칠판에만 잠깐 보인다)
  const [roundIntro, setRoundIntro] = useState<number | null>(null);
  const [peek, setPeek] = useState(false);
  const [startLocal, setStartLocal] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const channelRef = useRef<RealtimeChannel | null>(null);

  const phase: LivePhase | null = session?.phase ?? null;
  const qIndex = session?.q_index ?? -1;
  const qs = session?.questions ?? questions;
  const current = qIndex >= 0 ? qs[qIndex] : null;
  const currentAnswers = useMemo(() => answers.filter((a) => a.q_index === qIndex), [answers, qIndex]);
  const ranking = useMemo(() => liveRanking(players, answers), [players, answers]);
  const nameOf = useCallback((pid: string) => players.find((p) => p.id === pid)?.nickname ?? '?', [players]);

  // 발표 중 슬라이드를 오가거나 새로고침해도 열려 있던 대회(같은 템플릿, 3시간 안)를 그대로 이어서 진행한다.
  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    void supabase
      .from('live_sessions')
      .select('*')
      .eq('template_id', templateId)
      .is('ended_at', null)
      .gt('created_at', new Date(Date.now() - 3 * 3600 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const row = data?.[0] as LiveSession | undefined;
        if (!cancelled && row) {
          setSession((cur) => cur ?? row);
          if (row.phase === 'question') setStartLocal(Date.parse(row.q_started_at ?? '') || Date.now());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  /* ---------- 불러오기·실시간 ---------- */
  const refresh = useCallback(async (sid: string) => {
    try {
      const [p, a] = await Promise.all([liveFetchPlayers(sid), liveFetchAnswers(sid)]);
      setPlayers(p);
      setAnswers(a);
    } catch {
      /* 다음 번에 다시 */
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const sid = session.id;
    void refresh(sid);
    let timer: number | undefined;
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(sid), 150);
    };
    const db = supabase
      .channel(`live-host-${sid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_players', filter: `session_id=eq.${sid}` }, soon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_answers', filter: `session_id=eq.${sid}` }, soon)
      .subscribe();
    const bc = supabase.channel(liveChannelName(session.code));
    bc.subscribe();
    channelRef.current = bc;
    // 실시간이 끊겨도 늦게라도 맞게
    const poll = window.setInterval(() => void refresh(sid), 3000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      void supabase.removeChannel(db);
      void supabase.removeChannel(bc);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  useEffect(() => {
    if (!session) return;
    void QRCode.toDataURL(liveJoinUrl(session.code), { margin: 1, width: 480, errorCorrectionLevel: 'M' }).then(setQr);
  }, [session?.code, session]);

  // 문제 타이머
  useEffect(() => {
    if (phase !== 'question') return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [phase]);

  function ping() {
    void channelRef.current?.send({ type: 'broadcast', event: 'state', payload: {} });
  }

  async function go(nextPhase: LivePhase | 'ended', nextIndex: number) {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const row = await liveHostSet(session.id, nextPhase, nextIndex);
      if (nextPhase === 'ended') {
        setSession(null);
        setPlayers([]);
        setAnswers([]);
        setRoundIntro(null);
        return;
      }
      if (nextPhase === 'question') setStartLocal(Date.now());
      setSession(row);
      setPeek(false);
      ping();
    } catch (e) {
      setError(t(liveErrorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const row = await liveHostCreate({ title, questions, classId, templateId, speedBonus });
      setSession(row);
      setRoundIntro(null);
    } catch (e) {
      setError(t(liveErrorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  /** "다음" 한 버튼으로 흐름을 넘긴다 — 라운드가 바뀌면 라운드 소개를 먼저. */
  function next() {
    if (!session) return;
    if (roundIntro != null) {
      const i = roundIntro;
      setRoundIntro(null);
      void go('question', i);
      return;
    }
    if (phase === 'question') return void go('reveal', qIndex);
    if (phase === 'reveal') return void go('leaderboard', qIndex);
    // lobby / leaderboard → 다음 문제
    const ni = qIndex + 1;
    if (ni >= qs.length) return void go('final', qIndex);
    const round = qs[ni].round?.trim();
    if (round && round !== qs[qIndex]?.round?.trim()) {
      setRoundIntro(ni);
      return;
    }
    void go('question', ni);
  }

  const secs = current?.seconds ?? 20;
  const remaining =
    phase === 'question' && startLocal != null && current?.kind !== 'buzzer'
      ? Math.max(0, Math.ceil(secs - (now - startLocal) / 1000))
      : null;
  const everyoneAnswered = players.length > 0 && currentAnswers.length >= players.length;

  // 시간이 다 되거나 모두 답하면 정답 공개(부저는 선생님이 판정)
  const autoRevealed = useRef<number>(-1);
  useEffect(() => {
    if (phase !== 'question' || !current || current.kind === 'buzzer' || busy) return;
    if ((remaining === 0 || everyoneAnswered) && autoRevealed.current !== qIndex) {
      // 문제마다 한 번만. 타이머 숫자가 바뀌어 이 effect 가 다시 돌아도 예약을 취소하지 않는다.
      autoRevealed.current = qIndex;
      const at = qIndex;
      window.setTimeout(() => {
        if (autoRevealed.current === at) void go('reveal', at);
      }, everyoneAnswered ? 900 : 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, everyoneAnswered, phase, qIndex]);

  async function judge(a: LiveAnswer, correct: boolean) {
    setAnswers((prev) => prev.map((x) => (x.id === a.id ? { ...x, correct, points: correct ? x.potential : 0 } : x)));
    try {
      await liveJudge(a, correct);
    } catch (e) {
      setError(t(liveErrorKey(e)));
      if (session) void refresh(session.id);
    }
  }

  async function kick(p: LivePlayer) {
    if (!confirm(t('liveQuiz.kickConfirm', { name: p.nickname }))) return;
    setPlayers((prev) => prev.filter((x) => x.id !== p.id));
    try {
      await liveKick(p.id);
    } catch (e) {
      setError(t(liveErrorKey(e)));
    }
  }

  function endContest() {
    if (!confirm(t('liveQuiz.endConfirm'))) return;
    void go('ended', qIndex);
  }

  /* ---------- 화면 ---------- */
  const stage = 'relative flex min-h-[62vh] flex-col overflow-hidden rounded-[24px] bg-[#16213e] text-white [container-type:inline-size]';
  const bigBtn =
    'flex items-center gap-2 rounded-full bg-warm-yellow px-7 py-3 text-[clamp(16px,1.6cqw,26px)] font-bold text-deep-navy shadow-lg transition-transform hover:scale-[1.03] disabled:opacity-50';

  if (!session) {
    const rounds = [...new Set(questions.map((q) => q.round?.trim()).filter(Boolean))];
    return (
      <div className={stage}>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
          <span className="material-symbols-outlined text-warm-yellow" style={{ fontSize: 'clamp(48px,7cqw,110px)' }}>emoji_events</span>
          <h2 className="text-[clamp(26px,4cqw,64px)] font-bold leading-tight">{title}</h2>
          <p className="text-[clamp(14px,1.6cqw,24px)] text-white/75">
            {t('liveQuiz.summary', { count: questions.length })}
            {rounds.length > 0 && ` · ${rounds.join(' → ')}`}
          </p>
          <button type="button" className={bigBtn} disabled={busy || questions.length === 0} onClick={() => void start()}>
            <span className="material-symbols-outlined">qr_code_2</span>
            {busy ? t('common.loading') : t('liveQuiz.open')}
          </button>
          <p className="max-w-xl text-[clamp(12px,1.2cqw,18px)] text-white/60">{t('liveQuiz.openHint')}</p>
          {error && <p className="rounded-lg bg-error px-4 py-2 text-on-error">{error}</p>}
        </div>
      </div>
    );
  }

  const header = (
    <div className="flex flex-wrap items-center gap-3 px-5 pt-4 text-[clamp(12px,1.2cqw,18px)] text-white/80">
      <span className="rounded-full bg-white/10 px-3 py-1 font-bold tracking-widest">{t('liveQuiz.codeLabel')} {session.code}</span>
      {current && phase !== 'lobby' && (
        <span>
          {t('liveQuiz.questionOf', { n: qIndex + 1, total: qs.length })}
          {current.round ? ` · ${current.round}` : ''}
        </span>
      )}
      <span className="ml-auto flex items-center gap-1">
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>group</span>
        {players.length}
      </span>
      <button type="button" onClick={endContest} className="rounded-full px-3 py-1 text-white/60 hover:bg-white/10 hover:text-white">
        {t('liveQuiz.end')}
      </button>
    </div>
  );

  const footer = (label: string, icon = 'arrow_forward', disabled = false) => (
    <div className="flex items-center justify-end gap-3 px-5 pb-5">
      {error && <span className="mr-auto rounded-lg bg-error px-3 py-1.5 text-on-error">{error}</span>}
      <button type="button" className={bigBtn} disabled={busy || disabled} onClick={next}>
        {label}
        <span className="material-symbols-outlined">{icon}</span>
      </button>
    </div>
  );

  // 대기실
  if (phase === 'lobby' && roundIntro == null) {
    return (
      <div className={stage}>
        {header}
        <div className="grid flex-1 items-center gap-6 p-6 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-3">
            {qr && <img src={qr} alt="QR" className="w-[clamp(180px,26cqw,420px)] rounded-2xl bg-white p-3" />}
            <div className="text-center">
              <div className="text-[clamp(13px,1.3cqw,20px)] text-white/70">{liveJoinUrl('').replace(/\/$/, '')}</div>
              <div className="text-[clamp(40px,7cqw,110px)] font-bold leading-none tracking-[0.15em] text-warm-yellow">{session.code}</div>
            </div>
          </div>
          <div className="flex h-full min-h-0 flex-col">
            <h3 className="mb-3 text-[clamp(20px,2.6cqw,40px)] font-bold">{t('liveQuiz.lobbyTitle')}</h3>
            <p className="mb-4 text-[clamp(13px,1.3cqw,20px)] text-white/70">{t('liveQuiz.lobbyHint')}</p>
            <div className="flex flex-wrap content-start gap-2">
              {players.length === 0 && <span className="text-white/50">{t('liveQuiz.waiting')}</span>}
              {players.map((p) => (
                <span key={p.id} className="group flex items-center gap-1 rounded-full bg-white/15 py-1.5 pl-4 pr-2 text-[clamp(14px,1.6cqw,26px)] font-bold">
                  {p.nickname}
                  <button
                    type="button"
                    onClick={() => void kick(p)}
                    title={t('liveQuiz.kick')}
                    aria-label={t('liveQuiz.kick')}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-white/40 hover:bg-white/20 hover:text-white"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
        {footer(t('liveQuiz.startFirst'), 'play_arrow')}
      </div>
    );
  }

  // 라운드 소개
  if (roundIntro != null) {
    const q = qs[roundIntro];
    return (
      <div className={stage}>
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <span className="material-symbols-outlined text-warm-yellow" style={{ fontSize: 'clamp(44px,6cqw,96px)' }}>{KIND_ICON[q.kind]}</span>
          <h2 className="text-[clamp(30px,5cqw,80px)] font-bold">{q.round}</h2>
          <p className="max-w-3xl text-[clamp(15px,1.8cqw,28px)] text-white/80">{t(`liveQuiz.howTo_${q.kind}`)}</p>
        </div>
        {footer(t('liveQuiz.openQuestion'), 'play_arrow')}
      </div>
    );
  }

  // 순위
  if (phase === 'leaderboard' || phase === 'final') {
    const top = ranking.slice(0, phase === 'final' ? 3 : 8);
    const max = Math.max(1, ...ranking.map((r) => r.score));
    return (
      <div className={stage}>
        {header}
        <div className="flex flex-1 flex-col items-center gap-4 p-6">
          <h2 className="text-[clamp(24px,3.6cqw,56px)] font-bold">
            {phase === 'final' ? t('liveQuiz.finalTitle') : t('liveQuiz.leaderboardTitle')}
          </h2>
          {phase === 'final' ? (
            <div className="flex w-full max-w-4xl items-end justify-center gap-[2cqw]" style={{ height: "clamp(260px, 36cqw, 520px)" }}>
              {[1, 0, 2].map((i) => {
                const r = top[i];
                if (!r) return <div key={i} className="flex-1" />;
                const h = ['62%', '46%', '34%'][i];
                return (
                  <div key={r.player.id} className="flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 'clamp(28px,4cqw,64px)',  color: ['#FFD54F', '#cfd8dc', '#d7a26b'][i] }}>
                      {i === 0 ? 'trophy' : 'workspace_premium'}
                    </span>
                    <div className="mb-2 max-w-full truncate text-[clamp(16px,2.4cqw,40px)] font-bold">{r.player.nickname}</div>
                    <div className="mb-2 text-[clamp(13px,1.5cqw,24px)] tabular-nums text-white/80">{r.score.toLocaleString()}</div>
                    <div
                      className="flex w-full items-start justify-center rounded-t-2xl pt-3 text-[clamp(30px,5cqw,80px)] font-bold"
                      style={{ height: h, background: ['#FFD54F', '#b0bec5', '#c98b52'][i], color: '#16213e' }}
                    >
                      {i + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <ol className="w-full max-w-3xl space-y-2">
              {top.map((r, i) => (
                <li key={r.player.id} className="flex items-center gap-3">
                  <span className="w-8 text-right text-[clamp(16px,2cqw,30px)] font-bold tabular-nums text-warm-yellow">{i + 1}</span>
                  <div className="relative h-[clamp(34px,4.4cqw,64px)] flex-1 overflow-hidden rounded-xl bg-white/10">
                    <div className="absolute inset-y-0 left-0 rounded-xl bg-[#2f6fdb] transition-all duration-700" style={{ width: `${Math.max(8, (r.score / max) * 100)}%` }} />
                    <div className="relative flex h-full items-center justify-between px-4 text-[clamp(15px,1.9cqw,30px)] font-bold">
                      <span className="truncate">{r.player.nickname}</span>
                      <span className="tabular-nums">{r.score.toLocaleString()}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {phase === 'final' && ranking.length > 3 && (
            <div className="flex max-w-4xl flex-wrap justify-center gap-2 text-[clamp(12px,1.3cqw,20px)] text-white/75">
              {ranking.slice(3).map((r, i) => (
                <span key={r.player.id} className="rounded-full bg-white/10 px-3 py-1">
                  {i + 4}. {r.player.nickname} · {r.score.toLocaleString()}
                </span>
              ))}
            </div>
          )}
        </div>
        {phase === 'final' ? (
          <div className="flex justify-end px-5 pb-5">
            <button type="button" className={bigBtn} onClick={endContest}>
              {t('liveQuiz.end')}
              <span className="material-symbols-outlined">flag</span>
            </button>
          </div>
        ) : (
          footer(qIndex + 1 >= qs.length ? t('liveQuiz.toFinal') : t('liveQuiz.nextQuestion'))
        )}
      </div>
    );
  }

  if (!current) return null;
  const revealed = phase === 'reveal';
  const counts = (current.choices ?? ['O', 'X']).map((_, i) => currentAnswers.filter((a) => a.choice === i).length);

  return (
    <div className={stage}>
      {header}
      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* 문제 */}
        <div className="flex items-center gap-4">
          {remaining != null && (
            <div
              className={`flex h-[clamp(56px,7cqw,110px)] w-[clamp(56px,7cqw,110px)] shrink-0 items-center justify-center rounded-full text-[clamp(22px,3.2cqw,52px)] font-bold tabular-nums ${
                remaining <= 5 ? 'bg-error text-on-error' : 'bg-white/15'
              }`}
            >
              {remaining}
            </div>
          )}
          <div className="min-w-0 flex-1 text-center">
            <div className="break-words text-[clamp(26px,4.6cqw,78px)] font-bold leading-tight">{current.prompt}</div>
          </div>
          <div className="shrink-0 text-center text-[clamp(12px,1.3cqw,20px)] text-white/75">
            <div className="text-[clamp(22px,3cqw,48px)] font-bold tabular-nums text-white">{currentAnswers.length}</div>
            {current.kind === 'buzzer' ? t('liveQuiz.buzzes') : t('liveQuiz.answers')}
          </div>
        </div>
        {current.imageUrl && (
          <img src={current.imageUrl} alt="" className="mx-auto max-h-[28vh] rounded-2xl bg-white object-contain p-2" />
        )}

        {/* 보기·답 */}
        {current.kind === 'choice' && (
          <div className="grid flex-1 grid-cols-2 gap-3">
            {(current.choices ?? []).map((c, i) => {
              const st = CHOICE_STYLES[i % CHOICE_STYLES.length];
              const right = i === current.correctIndex;
              return (
                <div
                  key={i}
                  className={`relative flex min-h-[clamp(56px,8cqw,130px)] items-center gap-3 rounded-2xl px-5 text-[clamp(18px,2.8cqw,46px)] font-bold transition-opacity ${
                    revealed && !right ? 'opacity-35' : ''
                  }`}
                  style={{ background: st.bg }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1em',  fontVariationSettings: "'FILL' 1" }}>{st.icon}</span>
                  <span className="min-w-0 flex-1 break-words">{c}</span>
                  {revealed && (
                    <span className="flex items-center gap-1 rounded-full bg-black/25 px-3 py-1 text-[0.6em] tabular-nums">
                      {right && <span className="material-symbols-outlined" style={{ fontSize: '1.2em' }}>check</span>}
                      {counts[i]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {current.kind === 'ox' && (
          <div className="grid flex-1 grid-cols-2 gap-4">
            {['O', 'X'].map((mark, i) => {
              const right = i === current.correctIndex;
              return (
                <div
                  key={mark}
                  className={`flex min-h-[clamp(90px,14cqw,220px)] flex-col items-center justify-center rounded-3xl text-[clamp(60px,10cqw,170px)] font-black leading-none transition-opacity ${
                    revealed && !right ? 'opacity-30' : ''
                  }`}
                  style={{ background: i === 0 ? '#2f6fdb' : '#e5484d' }}
                >
                  {mark}
                  {revealed && <span className="mt-2 text-[clamp(14px,1.8cqw,28px)] font-bold tabular-nums">{t('liveQuiz.peopleCount', { count: counts[i] })}</span>}
                </div>
              );
            })}
          </div>
        )}

        {(current.kind === 'text' || current.kind === 'buzzer') && !revealed && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <p className="text-[clamp(15px,1.9cqw,30px)] text-white/80">{t(`liveQuiz.howTo_${current.kind}`)}</p>
            {current.kind === 'buzzer' && <BuzzList answers={currentAnswers} nameOf={nameOf} onJudge={judge} startedAt={session.q_started_at} />}
            <button
              type="button"
              onPointerDown={() => setPeek(true)}
              onPointerUp={() => setPeek(false)}
              onPointerLeave={() => setPeek(false)}
              className="rounded-full border border-white/25 px-4 py-1.5 text-[clamp(12px,1.2cqw,18px)] text-white/70 hover:bg-white/10"
            >
              {peek ? `${t('liveQuiz.answerIs')} ${current.answer}` : t('liveQuiz.peek')}
            </button>
          </div>
        )}

        {current.kind === 'text' && revealed && (
          <TextAnswers answers={currentAnswers} correct={current.answer ?? ''} nameOf={nameOf} onJudge={judge} />
        )}

        {current.kind === 'buzzer' && revealed && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="text-[clamp(14px,1.6cqw,24px)] text-white/70">{t('liveQuiz.answerIs')}</div>
            <div className="text-[clamp(36px,6cqw,100px)] font-bold text-warm-yellow">{current.answer}</div>
            <div className="text-[clamp(15px,1.9cqw,30px)]">
              {currentAnswers.filter((a) => a.correct).map((a) => nameOf(a.player_id)).join(', ') || t('liveQuiz.nobody')}
            </div>
          </div>
        )}
      </div>
      {phase === 'question'
        ? footer(t('liveQuiz.reveal'), 'visibility')
        : footer(t('liveQuiz.showRanking'), 'leaderboard')}
    </div>
  );
}

const KIND_ICON: Record<LiveQuestion['kind'], string> = {
  choice: 'grid_view',
  ox: 'rule',
  text: 'edit_note',
  buzzer: 'campaign',
};

/** 부저를 누른 순서 — 맨 앞 판정 전 학생에게 정답/오답 버튼. */
function BuzzList({
  answers,
  nameOf,
  onJudge,
  startedAt,
}: {
  answers: LiveAnswer[];
  nameOf: (id: string) => string;
  onJudge: (a: LiveAnswer, ok: boolean) => void;
  startedAt: string | null;
}) {
  const { t } = useTranslation();
  const ordered = [...answers].sort((a, b) => a.answered_at.localeCompare(b.answered_at));
  const turn = ordered.find((a) => a.correct == null);
  const t0 = startedAt ? Date.parse(startedAt) : null;
  if (ordered.length === 0) {
    return <div className="animate-pulse text-[clamp(20px,3cqw,48px)] font-bold text-warm-yellow">{t('liveQuiz.waitBuzz')}</div>;
  }
  return (
    <ol className="w-full max-w-2xl space-y-2">
      {ordered.slice(0, 6).map((a, i) => (
        <li
          key={a.id}
          className={`flex items-center gap-3 rounded-2xl px-4 py-2 text-[clamp(16px,2.2cqw,36px)] font-bold ${
            a === turn ? 'bg-warm-yellow text-deep-navy' : a.correct ? 'bg-[#2e9e5b]' : a.correct === false ? 'bg-white/10 text-white/50 line-through' : 'bg-white/10'
          }`}
        >
          <span className="w-8 tabular-nums">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate">{nameOf(a.player_id)}</span>
          {t0 != null && <span className="text-[0.55em] tabular-nums opacity-70">+{((Date.parse(a.answered_at) - t0) / 1000).toFixed(2)}s</span>}
          {a === turn && (
            <>
              <button type="button" onClick={() => onJudge(a, true)} className="rounded-full bg-[#2e9e5b] px-4 py-1 text-[0.6em] text-white">
                {t('liveQuiz.judgeRight')}
              </button>
              <button type="button" onClick={() => onJudge(a, false)} className="rounded-full bg-[#e5484d] px-4 py-1 text-[0.6em] text-white">
                {t('liveQuiz.judgeWrong')}
              </button>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

/** 주관식 답 모아 보기 — 같은 답끼리 묶고, 틀린 답도 선생님이 "정답 인정"할 수 있다. */
function TextAnswers({
  answers,
  correct,
  nameOf,
  onJudge,
}: {
  answers: LiveAnswer[];
  correct: string;
  nameOf: (id: string) => string;
  onJudge: (a: LiveAnswer, ok: boolean) => void;
}) {
  const { t } = useTranslation();
  const groups = new Map<string, { text: string; list: LiveAnswer[] }>();
  for (const a of answers) {
    const key = norm(a.answer ?? '');
    const g = groups.get(key) ?? { text: (a.answer ?? '').trim(), list: [] };
    g.list.push(a);
    groups.set(key, g);
  }
  const rows = [...groups.values()].sort((a, b) => Number(!!b.list[0].correct) - Number(!!a.list[0].correct) || b.list.length - a.list.length);
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="text-center">
        <span className="text-[clamp(14px,1.6cqw,24px)] text-white/70">{t('liveQuiz.answerIs')} </span>
        <span className="text-[clamp(30px,4.6cqw,76px)] font-bold text-warm-yellow">{correct}</span>
      </div>
      {rows.length === 0 && <div className="text-center text-white/50">{t('liveQuiz.noAnswers')}</div>}
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((g) => {
          const ok = !!g.list[0].correct;
          return (
            <div key={g.text} className={`flex items-center gap-3 rounded-2xl px-4 py-2 ${ok ? 'bg-[#2e9e5b]' : 'bg-white/10'}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 'clamp(18px,2cqw,30px)' }}>{ok ? 'check_circle' : 'cancel'}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[clamp(18px,2.4cqw,38px)] font-bold">{g.text || '—'}</div>
                <div className="truncate text-[clamp(11px,1.1cqw,17px)] text-white/75">{g.list.map((a) => nameOf(a.player_id)).join(', ')}</div>
              </div>
              <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-[clamp(13px,1.4cqw,22px)] font-bold tabular-nums">{g.list.length}</span>
              <button
                type="button"
                onClick={() => g.list.forEach((a) => onJudge(a, !ok))}
                className="shrink-0 rounded-full border border-white/40 px-3 py-1 text-[clamp(11px,1.1cqw,16px)] hover:bg-white/15"
              >
                {ok ? t('liveQuiz.unaccept') : t('liveQuiz.accept')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
