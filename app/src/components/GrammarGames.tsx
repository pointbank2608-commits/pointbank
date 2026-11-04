import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { grammarPoint } from '../lib/grammar';
import {
  auctionLots, labRounds, punctOf, verbRounds, writeRounds,
  type GrammarGameType, type Lot,
} from '../lib/grammarGames';
import { useRemoteActions } from '../lib/remote';
import { useGameWorkspace } from '../context/GameWorkspaceContext';
import { GAME_SFX, playSfx } from '../lib/gameSfx';
import { initialTeams, setGrammarPlay, useGrammarPlay } from '../lib/grammarPlay';
import '../i18n/grammarLessonLocales';

/**
 * 문법별 게임 4종(문장 변신 연구소·주어·동사 짝꿍·문법 경매·조건 영작 대결).
 * 팀 점수(1~4팀)는 이 화면 안의 놀이 점수다 — 실제 칭찬 통장 포인트와 연결되지 않는다.
 */
export const TEAM_COLORS = ['bg-primary text-white', 'bg-warm-yellow text-deep-navy', 'bg-emerald-600 text-white', 'bg-rose-600 text-white'];
export const btn = 'min-h-11 rounded-xl border border-outline-variant bg-white px-4 py-2 font-semibold shadow-card disabled:opacity-40';
export const primary = 'min-h-11 rounded-xl bg-primary px-5 py-2 font-bold text-white shadow-card disabled:opacity-40';

export interface CommonProps { grammarId: string; seed?: number; onExit?: () => void }

export function useText() {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  return (ko: string, english: string) => (en ? english : ko);
}

/** 팀 이름: 혼자 풀기에서는 "나", 팀이 있으면 "1팀" */
export function useTeamLabel() {
  const text = useText();
  const { teams } = useGrammarPlay();
  return (k: number) => (teams === 0 ? text('나', 'Me') : text(`${k + 1}팀`, `Team ${k + 1}`));
}
export function useSolo(): boolean {
  return useGrammarPlay().teams === 0;
}

/**
 * 게임 화면에는 팀·점수 설정을 두지 않는다(기본은 문제만). 설정은 게임 설정 칸의 PlaySettings 에서 한다.
 * 게임들이 이 자리에 부르던 컴포넌트라 모양만 남겨 둔다.
 */
export function TeamSetup(_props: { teams: number; setTeams: (n: number) => void }) {
  return null;
}

/**
 * 반 설정: 반 선택(학생 명단 불러오기) → 참여 방식(없음 기본 / 개인 / 팀 2~4) → 순서 정하기(기존 팀·순서 패널).
 * 이 브라우저에 기억하고, 저장/불러오기에서 게임과 함께 저장된다.
 */
export function PlaySettings() {
  const text = useText();
  const play = useGrammarPlay();
  const workspace = useGameWorkspace();
  const info = workspace?.info;
  const mode = play.teams > 0 ? 'team' : play.showScore ? 'solo' : 'none';
  const pick = (m: 'none' | 'solo' | 'team') => {
    if (m === 'none') setGrammarPlay({ teams: 0, showScore: false });
    else if (m === 'solo') setGrammarPlay({ teams: 0, showScore: true });
    else setGrammarPlay({ teams: Math.max(2, play.teams), showScore: true });
  };
  const chip = (on: boolean) => `${btn} min-w-16 ${on ? 'ring-2 ring-primary' : ''}`;
  const roster = info?.roster ?? [];
  return (
    <div className="space-y-3" role="group" aria-label={text('반 설정', 'Class settings')}>
      {info && info.classes.length > 0 && (
        <div className="space-y-2 rounded-xl bg-surface-container-low p-3">
          <label className="block text-sm font-bold">{text('반', 'Class')}
            <select className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 font-normal" value={info.classId || ''} onChange={(e) => info.selectClass(e.target.value)}>
              <option value="">{text('반 없이 하기', 'No class')}</option>
              {info.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {info.classId && (
            <p className="text-sm" aria-live="polite">
              {roster.length > 0
                ? <>{text(`학생 ${roster.length}명을 불러왔어요: `, `${roster.length} students: `)}<span className="font-semibold">{roster.slice(0, 8).map((r) => r.label).join(', ')}{roster.length > 8 ? ' …' : ''}</span></>
                : text('이 반에는 학생이 없어요. 학생·출석 메뉴에서 먼저 추가해 주세요.', 'This class has no students yet.')}
            </p>
          )}
        </div>
      )}
      <div className="space-y-2">
        <p className="text-sm font-bold">{text('참여 방식', 'How to play')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={chip(mode === 'none')} aria-pressed={mode === 'none'} onClick={() => pick('none')}>{text('없음', 'None')}</button>
          <button type="button" className={chip(mode === 'solo')} aria-pressed={mode === 'solo'} onClick={() => pick('solo')}>{text('개인', 'Solo')}</button>
          <button type="button" className={chip(mode === 'team')} aria-pressed={mode === 'team'} onClick={() => pick('team')}>{text('팀', 'Teams')}</button>
          {mode === 'team' && [2, 3, 4].map((n) => (
            <button key={n} type="button" className={chip(play.teams === n)} aria-pressed={play.teams === n} onClick={() => setGrammarPlay({ teams: n })}>{text(`${n}팀`, String(n))}</button>
          ))}
          {workspace && roster.length > 0 && (
            <button type="button" className={btn} onClick={() => { workspace.open(null); workspace.openTeams(); }}>{text('순서 정하기', 'Set order')}</button>
          )}
        </div>
      </div>
      <p className="text-xs text-on-surface-variant">{text('없음이면 게임 화면에 문제만 나와요. 점수는 이 화면 안에서만 쓰고 칭찬 통장 포인트와 관계없어요.', 'With none, only the questions are shown. Scores stay on this screen and are separate from praise points.')}</p>
    </div>
  );
}

export function Scores({ scores, turn, unit }: { scores: number[]; turn: number | null; unit?: string }) {
  const text = useText();
  const play = useGrammarPlay();
  const label = useTeamLabel();
  if (play.teams === 0) {
    if (!play.showScore) return null;
    return (
      <ul className="flex flex-wrap justify-center gap-2" aria-label={text('내 점수', 'My score')}>
        <li className={`rounded-xl px-5 py-2 text-lg font-extrabold ${TEAM_COLORS[0]}`}>{text('내 점수', 'Score')} · {scores[0] ?? 0}{unit ?? ''}</li>
      </ul>
    );
  }
  return (
    <ul className="flex flex-wrap justify-center gap-2" aria-label={text('팀 점수', 'Team scores')}>
      {scores.map((s, i) => (
        <li key={i} className={`rounded-xl px-4 py-2 text-lg font-extrabold ${TEAM_COLORS[i]} ${turn === i ? 'ring-4 ring-deep-navy/40' : 'opacity-90'}`}>
          {label(i)}{play.showScore ? ` · ${s}${unit ?? ''}` : ''}
        </li>
      ))}
    </ul>
  );
}

/**
 * 게임 판(section)은 폭 900px 안에서 가운데에 놓는다. 전체화면에서 화면에 맞춰 키우는 일은 GameThemeFrame 이 한다
 * (판이 가로로 끝까지 늘어나 있으면 키울 여지가 없어 작고 왼쪽에 붙어 보였다). 여기서 따로 키우면 두 확대가 서로 흔든다.
 */
export function Stage({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export function Finish({ scores, onAgain, onExit, unit }: { scores: number[]; onAgain: () => void; onExit?: () => void; unit?: string }) {
  const text = useText();
  const play = useGrammarPlay();
  const label = useTeamLabel();
  useEffect(() => { playSfx(GAME_SFX.grammarlab.done); }, []);
  const top = Math.max(...scores);
  return (
    <Stage><section className="mx-auto max-w-[900px] space-y-4 rounded-2xl bg-white p-6 text-center shadow-card" role="status">
      <h2 className="text-3xl font-extrabold">{play.teams === 0 ? text('수고했어요!', 'Well done!') : text('게임 끝!', 'Game over!')}</h2>
      <Scores scores={scores} turn={null} unit={unit} />
      {play.teams > 0 && play.showScore && scores.length > 1 && <p className="text-xl">{scores.map((s, i) => (s === top ? label(i) : null)).filter(Boolean).join(', ')} {text('우승!', 'win!')}</p>}
      <div className="flex justify-center gap-2">
        <button className={primary} onClick={onAgain}>{text('다시 하기', 'Play again')}</button>
        {onExit && <button className={btn} onClick={onExit}>{text('나가기', 'Exit')}</button>}
      </div>
    </section></Stage>
  );
}

export function Frame({ grammarId, title, children }: { grammarId: string; title: string; children: React.ReactNode }) {
  const point = grammarPoint(grammarId);
  return (
    <Stage><section className="mx-auto max-w-[900px] space-y-4 rounded-2xl bg-surface-container-lowest p-4 text-center sm:p-6">
      <header>
        <p className="text-sm font-semibold text-primary">{title}</p>
        <h2 className="text-2xl font-extrabold">{point?.name ?? grammarId}</h2>
        {point && <p className="font-mono text-lg text-on-surface-variant">{point.pattern.replace(/\*\*/g, '')}</p>}
      </header>
      {children}
    </section></Stage>
  );
}

export function Empty({ grammarId, title }: { grammarId: string; title: string }) {
  const text = useText();
  return (
    <Frame grammarId={grammarId} title={title}>
      <p role="status" className="rounded-xl bg-primary-fixed p-4">{text('이 문법으로는 아직 이 게임을 만들 수 없어요. 다른 문법을 골라 보세요.', 'This game is not available for this grammar yet. Try another one.')}</p>
    </Frame>
  );
}

/* ---------------- 문장 변신 연구소 ---------------- */
function Lab({ grammarId, seed = 1, onExit }: CommonProps) {
  const { t } = useTranslation();
  const text = useText();
  const [run, setRun] = useState(seed);
  const rounds = useMemo(() => labRounds(grammarId, run), [grammarId, run]);
  const [teams, setTeams] = useState(initialTeams);
  const [scores, setScores] = useState<number[]>(() => Array(initialTeams()).fill(0));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [result, setResult] = useState<'ok' | 'bad' | null>(null);
  const turn = i % teams;
  const round = rounds[i];
  const title = text('문장 변신 연구소', 'Sentence Lab');
  const setTeamCount = (n: number) => { setTeams(n); setScores(Array(n).fill(0)); setI(0); setPicked([]); setResult(null); };
  const answerWords = picked.map((k) => round?.chips[k] ?? '');
  const built = answerWords.join(' ') + (answerWords.length ? punctOf(round?.to ?? '.') : '');
  const check = () => {
    if (!round || result) return;
    const ok = built === round.to;
    setResult(ok ? 'ok' : 'bad');
    playSfx(ok ? GAME_SFX.grammarlab.ok : GAME_SFX.grammarlab.wrong);
    if (ok) setScores((s) => s.map((v, k) => (k === turn ? v + 1 : v)));
  };
  const next = () => { setI((x) => x + 1); setPicked([]); setResult(null); };
  useRemoteActions(round && !result ? [{ id: 'check', label: text('확인', 'Check'), tone: 'primary', run: check }] : round ? [{ id: 'next', label: text('다음', 'Next'), tone: 'primary', run: next }] : []);
  if (rounds.length < 4) return <Empty grammarId={grammarId} title={title} />;
  if (!round) return <Finish scores={scores} onAgain={() => { setRun((r) => r + 1); setI(0); setPicked([]); setResult(null); setScores(Array(teams).fill(0)); }} onExit={onExit} />;
  return (
    <Frame grammarId={grammarId} title={`${title} · ${i + 1}/${rounds.length}`}>
      <TeamSetup teams={teams} setTeams={setTeamCount} />
      <Scores scores={scores} turn={turn} />
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-card">
        <p className="text-lg font-bold text-primary">{t(`grammarLesson.factory.${round.kind}`)}</p>
        <p className="text-3xl font-extrabold" lang="en">{round.from}</p>
        <div className="flex min-h-24 flex-wrap items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant p-3" aria-label={text('만든 문장', 'Your sentence')}>
          {answerWords.length === 0 && <span className="text-on-surface-variant">{text('아래 낱말을 눌러 문장을 만들어요', 'Tap the words below')}</span>}
          {answerWords.map((w, k) => (
            <button key={k} className={`${btn} text-xl`} disabled={Boolean(result)} onClick={() => setPicked((p) => p.filter((_, n) => n !== k))} lang="en">{w}</button>
          ))}
          {answerWords.length > 0 && <span className="text-2xl font-bold">{punctOf(round.to)}</span>}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {round.chips.map((c, k) => (
            <button key={k} className={`${btn} text-xl ${picked.includes(k) ? 'opacity-30' : ''}`} disabled={picked.includes(k) || Boolean(result)} onClick={() => setPicked((p) => [...p, k])} lang="en">{c}</button>
          ))}
        </div>
        <p role="status" aria-hidden={!result} className={`rounded-xl p-3 text-lg font-bold ${result === 'bad' ? 'bg-rose-100' : 'bg-emerald-100'} ${result ? '' : 'invisible'}`}>
          {result === 'bad' ? `${text('정답은', 'Answer:')} ${round.to}` : text('정답! +1점', 'Correct! +1')}
        </p>
        <div className="flex justify-center gap-2">
          {!result ? <button className={primary} disabled={picked.length === 0} onClick={check}>{text('확인', 'Check')}</button> : <button className={primary} onClick={next}>{text('다음', 'Next')}</button>}
          <button className={btn} disabled={Boolean(result) || picked.length === 0} onClick={() => setPicked([])}>{text('지우기', 'Clear')}</button>
        </div>
      </div>
    </Frame>
  );
}

/* ---------------- 주어·동사 짝꿍 ---------------- */
function Verb({ grammarId, seed = 1, onExit }: CommonProps) {
  const text = useText();
  const [run, setRun] = useState(seed);
  const rounds = useMemo(() => verbRounds(grammarId, run), [grammarId, run]);
  const [teams, setTeams] = useState(initialTeams);
  const [scores, setScores] = useState<number[]>(() => Array(initialTeams()).fill(0));
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const turn = i % teams;
  const round = rounds[i];
  const title = text('주어·동사 짝꿍', 'Subject-Verb Match');
  const setTeamCount = (n: number) => { setTeams(n); setScores(Array(n).fill(0)); setI(0); setChosen(null); };
  const pick = (w: string) => {
    if (!round || chosen) return;
    setChosen(w);
    playSfx(w === round.answer ? GAME_SFX.grammarverb.ok : GAME_SFX.grammarverb.wrong);
    if (w === round.answer) setScores((s) => s.map((v, k) => (k === turn ? v + 1 : v)));
  };
  const next = () => { setI((x) => x + 1); setChosen(null); };
  useRemoteActions(round && chosen ? [{ id: 'next', label: text('다음', 'Next'), tone: 'primary', run: next }] : []);
  if (rounds.length < 4) return <Empty grammarId={grammarId} title={title} />;
  if (!round) return <Finish scores={scores} onAgain={() => { setRun((r) => r + 1); setI(0); setChosen(null); setScores(Array(teams).fill(0)); }} onExit={onExit} />;
  return (
    <Frame grammarId={grammarId} title={`${title} · ${i + 1}/${rounds.length}`}>
      <TeamSetup teams={teams} setTeams={setTeamCount} />
      <Scores scores={scores} turn={turn} />
      <div className="space-y-4 rounded-2xl bg-white p-4 shadow-card">
        <p className="text-lg font-bold text-primary">{text(`주어가 ${round.subject}로 바뀌었어요. 동사를 알맞게 고쳐요!`, `The subject changed to ${round.subject}. Fix the verb!`)}</p>
        <p className="text-xl text-on-surface-variant" lang="en">{round.from}</p>
        <p className="text-3xl font-extrabold" lang="en">
          {round.before} <span className="inline-block min-w-24 border-b-4 border-primary text-center text-primary">{chosen ?? ' '}</span> {round.after}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {round.options.map((o) => {
            const state = !chosen ? '' : o === round.answer ? 'bg-emerald-100 ring-2 ring-emerald-600 disabled:opacity-100' : o === chosen ? 'bg-rose-100 ring-2 ring-rose-600 disabled:opacity-100' : 'opacity-50';
            return <button key={o} className={`${btn} min-w-28 text-2xl ${state}`} disabled={Boolean(chosen)} onClick={() => pick(o)} lang="en">{o}</button>;
          })}
        </div>
        <button className={`${primary} ${chosen ? '' : 'invisible'}`} tabIndex={chosen ? 0 : -1} aria-hidden={!chosen} onClick={next}>{text('다음', 'Next')}</button>
      </div>
    </Frame>
  );
}

/* ---------------- 문법 경매 ---------------- */
const START_COINS = 100;
function Auction({ grammarId, seed = 1, onExit }: CommonProps) {
  const text = useText();
  const label = useTeamLabel();
  const solo = useSolo();
  const [run, setRun] = useState(seed);
  const lots = useMemo<Lot[]>(() => auctionLots(grammarId, run), [grammarId, run]);
  const [teams, setTeams] = useState(initialTeams);
  const [coins, setCoins] = useState<number[]>(() => Array(initialTeams()).fill(START_COINS));
  const [bids, setBids] = useState<number[]>(() => Array(initialTeams()).fill(0));
  const [i, setI] = useState(0);
  const [reveal, setReveal] = useState<null | { winner: number | null; bid: number }>(null);
  const [fixed, setFixed] = useState(false);
  const lot = lots[i];
  const title = text('문법 경매', 'Grammar Auction');
  const rv = reveal ?? { winner: null as number | null, bid: 0 };
  const reset = (n: number) => { setTeams(n); setCoins(Array(n).fill(START_COINS)); setBids(Array(n).fill(0)); setI(0); setReveal(null); setFixed(false); };
  const adjust = (k: number, d: number) => setBids((b) => b.map((v, n) => (n === k ? Math.max(0, Math.min(coins[k], v + d)) : v)));
  const close = () => {
    if (!lot || reveal) return;
    const top = Math.max(...bids);
    const winners = bids.map((b, k) => (b === top ? k : -1)).filter((k) => k >= 0);
    const winner = top > 0 && winners.length === 1 ? winners[0] : null;
    if (winner !== null) setCoins((c) => c.map((v, k) => (k === winner ? v + (lot.ok ? top : -top) : v)));
    setReveal({ winner, bid: top });
    playSfx(lot.ok ? GAME_SFX.grammarauction.ok : GAME_SFX.grammarauction.wrong);
  };
  const fixIt = () => {
    if (!reveal || reveal.winner === null || lot?.ok || fixed) return;
    const back = Math.floor(reveal.bid / 2);
    setCoins((c) => c.map((v, k) => (k === reveal.winner ? v + back : v)));
    setFixed(true);
  };
  const next = () => { setI((x) => x + 1); setBids(Array(teams).fill(0)); setReveal(null); setFixed(false); };
  useRemoteActions(lot ? (reveal ? [{ id: 'next', label: text('다음 물건', 'Next lot'), tone: 'primary', run: next }] : [{ id: 'close', label: text('경매 마감', 'Close bidding'), tone: 'primary', run: close }]) : []);
  if (lots.length < 4) return <Empty grammarId={grammarId} title={title} />;
  if (!lot) return <Finish scores={coins} unit="🪙" onAgain={() => { setRun((r) => r + 1); reset(teams); }} onExit={onExit} />;
  return (
    <Frame grammarId={grammarId} title={`${title} · ${i + 1}/${lots.length}`}>
      <TeamSetup teams={teams} setTeams={reset} />
      <p className="text-sm text-on-surface-variant">{text('게임용 코인이에요. 칭찬 통장 포인트와 관계없어요. 가장 많이 건 쪽이 사요.', 'Game coins only — not your real praise points. The highest bid buys it.')}</p>
      <Scores scores={coins} turn={null} unit="🪙" />
      <div className="space-y-4 rounded-2xl bg-white p-4 shadow-card">
        <p className="text-lg font-bold text-primary">{text('이 문장이 맞을 것 같으면 코인을 걸어 사요! 틀린 문장을 사면 코인을 잃어요.', 'Bid if you think the sentence is correct. Buying a wrong one loses coins!')}</p>
        <p className="text-3xl font-extrabold" lang="en">“{lot.sentence}”</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {bids.map((b, k) => (
            <li key={k} className={`flex items-center justify-between gap-2 rounded-xl p-3 ${TEAM_COLORS[k]}`}>
              <span className="font-extrabold">{label(k)}</span>
              <span className="flex items-center gap-1">
                <button className="min-h-10 min-w-10 rounded-lg bg-white/90 text-xl font-bold text-deep-navy" disabled={Boolean(reveal)} onClick={() => adjust(k, -10)} aria-label={text('10 내리기', 'Down 10')}>−</button>
                <span className="min-w-16 text-center text-2xl font-extrabold">{b}</span>
                <button className="min-h-10 min-w-10 rounded-lg bg-white/90 text-xl font-bold text-deep-navy" disabled={Boolean(reveal)} onClick={() => adjust(k, 10)} aria-label={text('10 올리기', 'Up 10')}>+</button>
              </span>
            </li>
          ))}
        </ul>
        <button className={`${primary} ${reveal ? 'invisible' : ''}`} tabIndex={reveal ? -1 : 0} aria-hidden={Boolean(reveal)} onClick={close}>{text('경매 마감!', 'Close bidding')}</button>
        <div className={`space-y-2 ${reveal ? '' : 'invisible'}`} role="status" aria-hidden={!reveal}>
            <p className={`rounded-xl p-3 text-xl font-extrabold ${lot.ok ? 'bg-emerald-100' : 'bg-rose-100'}`}>{lot.ok ? text('✅ 맞는 문장이에요!', '✅ A correct sentence!') : text('❌ 틀린 문장이에요!', '❌ A wrong sentence!')}</p>
            <p>{rv.winner === null ? text(solo ? '아무도 사지 않았어요.' : '낙찰한 팀이 없어요.', 'No one bought it.') : `${solo ? text('내가', 'I') : `${label(rv.winner)}${text('이', '')}`} ${rv.bid}🪙 ${text(lot.ok ? '낙찰! +' + rv.bid : '낙찰… −' + rv.bid, lot.ok ? 'won +' + rv.bid : 'won, −' + rv.bid)}`}</p>
            {!lot.ok && lot.fix && <p className="text-xl" lang="en">✏️ <b>{lot.fix}</b></p>}
            <p className="text-on-surface-variant">{lot.why}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {!lot.ok && rv.winner !== null && !fixed && rv.bid >= 2 && <button className={btn} onClick={fixIt}>{text(`고쳐 말했어요 (+${Math.floor(rv.bid / 2)}🪙 되돌려 받기)`, `Fixed it (+${Math.floor(rv.bid / 2)}🪙 back)`)}</button>}
              <button className={primary} onClick={next}>{i + 1 === lots.length ? text('결과 보기', 'See results') : text('다음 물건', 'Next lot')}</button>
            </div>
        </div>
      </div>
    </Frame>
  );
}

/* ---------------- 조건 영작 대결 ---------------- */
function Write({ grammarId, seed = 1, onExit }: CommonProps) {
  const text = useText();
  const label = useTeamLabel();
  const solo = useSolo();
  const [run, setRun] = useState(seed);
  const rounds = useMemo(() => writeRounds(grammarId, run), [grammarId, run]);
  const [teams, setTeams] = useState(initialTeams);
  const [scores, setScores] = useState<number[]>(() => Array(initialTeams()).fill(0));
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [given, setGiven] = useState<boolean[]>(() => Array(initialTeams()).fill(false));
  const round = rounds[i];
  const title = text('조건 영작 대결', 'Write-off');
  const reset = (n: number) => { setTeams(n); setScores(Array(n).fill(0)); setGiven(Array(n).fill(false)); setI(0); setShown(false); };
  const toggle = (k: number) => {
    if (!given[k]) playSfx(GAME_SFX.grammarwrite.ok);
    setGiven((g) => g.map((v, n) => (n === k ? !v : v)));
    setScores((s) => s.map((v, n) => (n === k ? v + (given[k] ? -1 : 1) : v)));
  };
  const next = () => { setI((x) => x + 1); setShown(false); setGiven(Array(teams).fill(false)); };
  useRemoteActions(round ? (shown ? [{ id: 'next', label: text('다음', 'Next'), tone: 'primary', run: next }] : [{ id: 'show', label: text('모범 답 보기', 'Show answer'), tone: 'primary', run: () => setShown(true) }]) : []);
  if (rounds.length < 3) return <Empty grammarId={grammarId} title={title} />;
  if (!round) return <Finish scores={scores} onAgain={() => { setRun((r) => r + 1); reset(teams); }} onExit={onExit} />;
  return (
    <Frame grammarId={grammarId} title={`${title} · ${i + 1}/${rounds.length}`}>
      <TeamSetup teams={teams} setTeams={reset} />
      <Scores scores={scores} turn={null} />
      <div className="space-y-4 rounded-2xl bg-white p-4 shadow-card">
        <p className="text-sm font-semibold text-primary">{solo ? text('공책에 영어 문장을 써요.', 'Write the sentence on paper.') : text('팀마다 공책에 영어 문장을 써요.', 'Each team writes the sentence on paper.')}</p>
        <p className="text-3xl font-extrabold">{round.ko}</p>
        <p className="rounded-xl bg-warm-yellow/40 p-3 text-xl font-bold">📌 {round.cond}</p>
        <button className={`${primary} ${shown ? 'invisible' : ''}`} tabIndex={shown ? -1 : 0} aria-hidden={shown} onClick={() => setShown(true)}>{text('모범 답 보기', 'Show answer')}</button>
        <div className={`space-y-3 ${shown ? '' : 'invisible'}`} role="status" aria-hidden={!shown}>
            <p className="rounded-xl bg-emerald-100 p-3 text-2xl font-extrabold" lang="en">{round.model}</p>
            <p className="text-sm text-on-surface-variant">{solo ? text('모범 답과 비교해 조건을 모두 지켰고 문법이 맞으면 "맞았어요"를 눌러요. 뜻이 다른 표현도 조건에 맞으면 괜찮아요.', 'Compare with the model. If you met every condition, tap "Got it".') : text('조건을 모두 지키고 문법이 맞은 팀을 눌러 점수를 줘요. 뜻이 다른 표현도 조건에 맞으면 인정해도 좋아요.', 'Tap teams whose sentence meets every condition. Other valid wordings are fine.')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {given.map((g, k) => <button key={k} className={`min-h-11 rounded-xl px-4 py-2 font-extrabold shadow-card ${TEAM_COLORS[k]} ${g ? 'ring-4 ring-deep-navy/50' : 'opacity-70'}`} aria-pressed={g} onClick={() => toggle(k)}>{solo ? text('맞았어요', 'Got it') : label(k)} {g ? '✓' : '+1'}</button>)}
            </div>
            <button className={primary} onClick={next}>{i + 1 === rounds.length ? text('결과 보기', 'See results') : text('다음', 'Next')}</button>
        </div>
      </div>
    </Frame>
  );
}

export default function GrammarGame({ type, ...rest }: CommonProps & { type: GrammarGameType }) {
  if (type === 'grammarlab') return <Lab {...rest} />;
  if (type === 'grammarverb') return <Verb {...rest} />;
  if (type === 'grammarauction') return <Auction {...rest} />;
  return <Write {...rest} />;
}
