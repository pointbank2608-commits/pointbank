import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { grammarPoint } from '../lib/grammar';
import {
  auctionLots, labRounds, punctOf, verbRounds, writeRounds,
  type GrammarGameType, type Lot,
} from '../lib/grammarGames';
import { useRemoteActions } from '../lib/remote';
import { GAME_SFX, playSfx } from '../lib/gameSfx';
import '../i18n/grammarLessonLocales';

/**
 * 문법별 게임 4종(문장 변신 연구소·주어·동사 짝꿍·문법 경매·조건 영작 대결).
 * 팀 점수(1~4팀)는 이 화면 안의 놀이 점수다 — 실제 칭찬 통장 포인트와 연결되지 않는다.
 */
const TEAM_COLORS = ['bg-primary text-white', 'bg-warm-yellow text-deep-navy', 'bg-emerald-600 text-white', 'bg-rose-600 text-white'];
const btn = 'min-h-11 rounded-xl border border-outline-variant bg-white px-4 py-2 font-semibold shadow-card disabled:opacity-40';
const primary = 'min-h-11 rounded-xl bg-primary px-5 py-2 font-bold text-white shadow-card disabled:opacity-40';

interface CommonProps { grammarId: string; seed?: number; onExit?: () => void }

function useText() {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  return (ko: string, english: string) => (en ? english : ko);
}

function TeamSetup({ teams, setTeams }: { teams: number; setTeams: (n: number) => void }) {
  const text = useText();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-semibold">{text('팀 수', 'Teams')}</span>
      {[1, 2, 3, 4].map((n) => (
        <button key={n} className={`${btn} ${teams === n ? 'ring-2 ring-primary' : ''}`} onClick={() => setTeams(n)} aria-pressed={teams === n}>{n}</button>
      ))}
    </div>
  );
}

function Scores({ scores, turn, unit }: { scores: number[]; turn: number | null; unit?: string }) {
  const text = useText();
  return (
    <ul className="flex flex-wrap gap-2" aria-label={text('팀 점수', 'Team scores')}>
      {scores.map((s, i) => (
        <li key={i} className={`rounded-xl px-4 py-2 text-lg font-extrabold ${TEAM_COLORS[i]} ${turn === i ? 'ring-4 ring-deep-navy/40' : 'opacity-90'}`}>
          {i + 1}{text('팀', '')} · {s}{unit ?? ''}
        </li>
      ))}
    </ul>
  );
}

function Finish({ scores, onAgain, onExit, unit }: { scores: number[]; onAgain: () => void; onExit?: () => void; unit?: string }) {
  const text = useText();
  useEffect(() => { playSfx(GAME_SFX.grammarlab.done); }, []);
  const top = Math.max(...scores);
  return (
    <div className="space-y-4 rounded-2xl bg-white p-6 text-center shadow-card" role="status">
      <h2 className="text-3xl font-extrabold">{text('게임 끝!', 'Game over!')}</h2>
      <Scores scores={scores} turn={null} unit={unit} />
      {scores.length > 1 && <p className="text-xl">{scores.map((s, i) => (s === top ? `${i + 1}${text('팀', '')}` : null)).filter(Boolean).join(', ')} {text('우승!', 'win!')}</p>}
      <div className="flex justify-center gap-2">
        <button className={primary} onClick={onAgain}>{text('다시 하기', 'Play again')}</button>
        {onExit && <button className={btn} onClick={onExit}>{text('나가기', 'Exit')}</button>}
      </div>
    </div>
  );
}

function Frame({ grammarId, title, children }: { grammarId: string; title: string; children: React.ReactNode }) {
  const point = grammarPoint(grammarId);
  return (
    <section className="space-y-4 rounded-2xl bg-surface-container-lowest p-4 sm:p-6">
      <header>
        <p className="text-sm font-semibold text-primary">{title}</p>
        <h2 className="text-2xl font-extrabold">{point?.name ?? grammarId}</h2>
        {point && <p className="font-mono text-lg text-on-surface-variant">{point.pattern.replace(/\*\*/g, '')}</p>}
      </header>
      {children}
    </section>
  );
}

function Empty({ grammarId, title }: { grammarId: string; title: string }) {
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
  const [teams, setTeams] = useState(2);
  const [scores, setScores] = useState<number[]>([0, 0]);
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
        <div className="flex min-h-16 flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-outline-variant p-3" aria-label={text('만든 문장', 'Your sentence')}>
          {answerWords.length === 0 && <span className="text-on-surface-variant">{text('아래 낱말을 눌러 문장을 만들어요', 'Tap the words below')}</span>}
          {answerWords.map((w, k) => (
            <button key={k} className={`${btn} text-xl`} disabled={Boolean(result)} onClick={() => setPicked((p) => p.filter((_, n) => n !== k))} lang="en">{w}</button>
          ))}
          {answerWords.length > 0 && <span className="text-2xl font-bold">{punctOf(round.to)}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {round.chips.map((c, k) => (
            <button key={k} className={`${btn} text-xl ${picked.includes(k) ? 'opacity-30' : ''}`} disabled={picked.includes(k) || Boolean(result)} onClick={() => setPicked((p) => [...p, k])} lang="en">{c}</button>
          ))}
        </div>
        {result && (
          <p role="status" className={`rounded-xl p-3 text-lg font-bold ${result === 'ok' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            {result === 'ok' ? text('정답! +1점', 'Correct! +1') : `${text('정답은', 'Answer:')} ${round.to}`}
          </p>
        )}
        <div className="flex gap-2">
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
  const [teams, setTeams] = useState(2);
  const [scores, setScores] = useState<number[]>([0, 0]);
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
        <div className="flex flex-wrap gap-3">
          {round.options.map((o) => {
            const state = !chosen ? '' : o === round.answer ? 'bg-emerald-100 ring-2 ring-emerald-600' : o === chosen ? 'bg-rose-100 ring-2 ring-rose-600' : 'opacity-50';
            return <button key={o} className={`${btn} min-w-28 text-2xl ${state}`} disabled={Boolean(chosen)} onClick={() => pick(o)} lang="en">{o}</button>;
          })}
        </div>
        {chosen && <button className={primary} onClick={next}>{text('다음', 'Next')}</button>}
      </div>
    </Frame>
  );
}

/* ---------------- 문법 경매 ---------------- */
const START_COINS = 100;
function Auction({ grammarId, seed = 1, onExit }: CommonProps) {
  const text = useText();
  const [run, setRun] = useState(seed);
  const lots = useMemo<Lot[]>(() => auctionLots(grammarId, run), [grammarId, run]);
  const [teams, setTeams] = useState(2);
  const [coins, setCoins] = useState<number[]>([START_COINS, START_COINS]);
  const [bids, setBids] = useState<number[]>([0, 0]);
  const [i, setI] = useState(0);
  const [reveal, setReveal] = useState<null | { winner: number | null; bid: number }>(null);
  const [fixed, setFixed] = useState(false);
  const lot = lots[i];
  const title = text('문법 경매', 'Grammar Auction');
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
      <TeamSetup teams={teams} setTeams={(n) => reset(Math.max(2, n))} />
      <p className="text-sm text-on-surface-variant">{text('게임용 코인이에요. 칭찬 통장 포인트와 관계없어요. (2팀 이상)', 'Game coins only — not your real praise points. (2+ teams)')}</p>
      <Scores scores={coins} turn={null} unit="🪙" />
      <div className="space-y-4 rounded-2xl bg-white p-4 shadow-card">
        <p className="text-lg font-bold text-primary">{text('이 문장이 맞을 것 같으면 코인을 걸어 사요! 틀린 문장을 사면 코인을 잃어요.', 'Bid if you think the sentence is correct. Buying a wrong one loses coins!')}</p>
        <p className="text-3xl font-extrabold" lang="en">“{lot.sentence}”</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {bids.map((b, k) => (
            <li key={k} className={`flex items-center justify-between gap-2 rounded-xl p-3 ${TEAM_COLORS[k]}`}>
              <span className="font-extrabold">{k + 1}{text('팀', '')}</span>
              <span className="flex items-center gap-1">
                <button className="min-h-10 min-w-10 rounded-lg bg-white/90 text-xl font-bold text-deep-navy" disabled={Boolean(reveal)} onClick={() => adjust(k, -10)} aria-label={text('10 내리기', 'Down 10')}>−</button>
                <span className="min-w-16 text-center text-2xl font-extrabold">{b}</span>
                <button className="min-h-10 min-w-10 rounded-lg bg-white/90 text-xl font-bold text-deep-navy" disabled={Boolean(reveal)} onClick={() => adjust(k, 10)} aria-label={text('10 올리기', 'Up 10')}>+</button>
              </span>
            </li>
          ))}
        </ul>
        {!reveal ? <button className={primary} onClick={close}>{text('경매 마감!', 'Close bidding')}</button> : (
          <div className="space-y-2" role="status">
            <p className={`rounded-xl p-3 text-xl font-extrabold ${lot.ok ? 'bg-emerald-100' : 'bg-rose-100'}`}>{lot.ok ? text('✅ 맞는 문장이에요!', '✅ A correct sentence!') : text('❌ 틀린 문장이에요!', '❌ A wrong sentence!')}</p>
            <p>{reveal.winner === null ? text('낙찰한 팀이 없어요.', 'No one bought it.') : `${reveal.winner + 1}${text('팀이', '')} ${reveal.bid}🪙 ${text(lot.ok ? '낙찰! +' + reveal.bid : '낙찰… −' + reveal.bid, lot.ok ? 'won +' + reveal.bid : 'won, −' + reveal.bid)}`}</p>
            {!lot.ok && lot.fix && <p className="text-xl" lang="en">✏️ <b>{lot.fix}</b></p>}
            <p className="text-on-surface-variant">{lot.why}</p>
            <div className="flex flex-wrap gap-2">
              {!lot.ok && reveal.winner !== null && !fixed && reveal.bid >= 2 && <button className={btn} onClick={fixIt}>{text(`고쳐 말했어요 (+${Math.floor(reveal.bid / 2)}🪙 되돌려 받기)`, `Fixed it (+${Math.floor(reveal.bid / 2)}🪙 back)`)}</button>}
              <button className={primary} onClick={next}>{i + 1 === lots.length ? text('결과 보기', 'See results') : text('다음 물건', 'Next lot')}</button>
            </div>
          </div>
        )}
      </div>
    </Frame>
  );
}

/* ---------------- 조건 영작 대결 ---------------- */
function Write({ grammarId, seed = 1, onExit }: CommonProps) {
  const text = useText();
  const [run, setRun] = useState(seed);
  const rounds = useMemo(() => writeRounds(grammarId, run), [grammarId, run]);
  const [teams, setTeams] = useState(2);
  const [scores, setScores] = useState<number[]>([0, 0]);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [given, setGiven] = useState<boolean[]>([false, false]);
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
        <p className="text-sm font-semibold text-primary">{text('팀마다 공책에 영어 문장을 써요.', 'Each team writes the sentence on paper.')}</p>
        <p className="text-3xl font-extrabold">{round.ko}</p>
        <p className="rounded-xl bg-warm-yellow/40 p-3 text-xl font-bold">📌 {round.cond}</p>
        {!shown ? <button className={primary} onClick={() => setShown(true)}>{text('모범 답 보기', 'Show answer')}</button> : (
          <div className="space-y-3" role="status">
            <p className="rounded-xl bg-emerald-100 p-3 text-2xl font-extrabold" lang="en">{round.model}</p>
            <p className="text-sm text-on-surface-variant">{text('조건을 모두 지키고 문법이 맞은 팀을 눌러 점수를 줘요. 뜻이 다른 표현도 조건에 맞으면 인정해도 좋아요.', 'Tap teams whose sentence meets every condition. Other valid wordings are fine.')}</p>
            <div className="flex flex-wrap gap-2">
              {given.map((g, k) => <button key={k} className={`min-h-11 rounded-xl px-4 py-2 font-extrabold shadow-card ${TEAM_COLORS[k]} ${g ? 'ring-4 ring-deep-navy/50' : 'opacity-70'}`} aria-pressed={g} onClick={() => toggle(k)}>{k + 1}{text('팀', '')} {g ? '✓' : '+1'}</button>)}
            </div>
            <button className={primary} onClick={next}>{i + 1 === rounds.length ? text('결과 보기', 'See results') : text('다음', 'Next')}</button>
          </div>
        )}
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
