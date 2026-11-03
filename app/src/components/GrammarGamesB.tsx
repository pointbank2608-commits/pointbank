import { useMemo, useState } from 'react';
import {
  compareRounds, frameRounds, habitRounds, linkRounds, linkSentence, posRounds,
  type CompareRound, type FramePart, type HabitRound, type LinkRound, type PosCat, type PosRound,
} from '../lib/grammarGamesB';
import type { GrammarGameType } from '../lib/grammarGames';
import { useRemoteActions } from '../lib/remote';
import { GAME_SFX, playSfx } from '../lib/gameSfx';
import { Empty, Finish, Frame, Scores, TeamSetup, btn, primary, useText, type CommonProps } from './GrammarGames';

/** 문법별 게임 2차 묶음 화면 5종. 팀 점수는 이 화면 안의 놀이 점수다(칭찬 통장과 무관). */
type BGameType = Extract<GrammarGameType, 'grammarpos' | 'grammarframe' | 'grammarcompare' | 'grammarlink' | 'grammarhabit'>;

/** 팀 점수·차례·다음 버튼·결과 화면을 한곳에 모은 진행 틀 */
function useRun<T extends { id: string }>(make: (seed: number) => T[], seed: number, min: number) {
  const [run, setRun] = useState(seed);
  const rounds = useMemo(() => make(run), [make, run]);
  const [teams, setTeams] = useState(2);
  const [scores, setScores] = useState<number[]>([0, 0]);
  const [i, setI] = useState(0);
  const turn = i % teams;
  const award = (ok: boolean) => { if (ok) setScores((s) => s.map((v, k) => (k === turn ? v + 1 : v))); };
  const next = () => setI((x) => x + 1);
  const setTeamCount = (n: number) => { setTeams(n); setScores(Array(n).fill(0)); setI(0); };
  const again = () => { setRun((r) => r + 1); setI(0); setScores(Array(teams).fill(0)); };
  return { rounds, round: rounds[i] as T | undefined, i, total: rounds.length, teams, scores, turn, award, next, setTeamCount, again, enough: rounds.length >= min };
}

const stateOf = (chosen: string | null, opt: string, answer: string) =>
  !chosen ? '' : opt === answer ? 'bg-emerald-100 ring-2 ring-emerald-600 disabled:opacity-100' : opt === chosen ? 'bg-rose-100 ring-2 ring-rose-600 disabled:opacity-100' : 'opacity-50';

/* ---------------- 문장 속 품사 탐험 ---------------- */
const POS_NAME: Record<PosCat, [string, string]> = {
  verb: ['동사', 'verb'], pronoun: ['대명사', 'pronoun'], preposition: ['전치사', 'preposition'], determiner: ['관사·소유격', 'article / possessive'], conjunction: ['접속사', 'conjunction'],
};
const POS_HINT: Record<PosCat, [string, string]> = {
  verb: ['움직임이나 상태를 나타내요 (am, is, plays …)', 'shows an action or state (am, is, plays …)'],
  pronoun: ['사람·사물 이름을 대신해요 (I, he, they …)', 'replaces a noun (I, he, they …)'],
  preposition: ['위치나 방향을 말해요 (in, on, under …)', 'shows place or direction (in, on, under …)'],
  determiner: ['명사 앞에 붙어요 (a, the, my …)', 'comes before a noun (a, the, my …)'],
  conjunction: ['말을 이어 줘요 (and, but, because)', 'joins words or sentences (and, but, because)'],
};
function Pos({ grammarId, seed = 1, onExit }: CommonProps) {
  const text = useText();
  const r = useRun<PosRound>((s) => posRounds(grammarId, s), seed, 4);
  const [chosen, setChosen] = useState<number | null>(null);
  const title = text('문장 속 품사 탐험', 'Parts of Speech Quest');
  const next = () => { r.next(); setChosen(null); };
  const pick = (k: number) => {
    if (!r.round || chosen !== null) return;
    setChosen(k);
    const ok = r.round.correct.includes(k);
    playSfx(ok ? GAME_SFX.grammarpos.ok : GAME_SFX.grammarpos.wrong);
    r.award(ok);
  };
  useRemoteActions(r.round && chosen !== null ? [{ id: 'next', label: text('다음', 'Next'), tone: 'primary', run: next }] : []);
  if (!r.enough) return <Empty grammarId={grammarId} title={title} />;
  if (!r.round) return <Finish scores={r.scores} onAgain={() => { r.again(); setChosen(null); }} onExit={onExit} />;
  const round = r.round;
  const name = POS_NAME[round.cat];
  return (
    <Frame grammarId={grammarId} title={`${title} · ${r.i + 1}/${r.total}`}>
      <TeamSetup teams={r.teams} setTeams={(n) => { r.setTeamCount(n); setChosen(null); }} />
      <Scores scores={r.scores} turn={r.turn} />
      <div className="space-y-4 rounded-2xl bg-white p-4 shadow-card">
        <p className="text-xl font-bold text-primary">{text(`문장에서 ${name[0]}를 찾아 눌러요!`, `Tap the ${name[1]} in the sentence!`)}</p>
        <p className="text-on-surface-variant">{text(POS_HINT[round.cat][0], POS_HINT[round.cat][1])}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {round.tokens.map((w, k) => {
            const ok = round.correct.includes(k);
            const st = chosen === null ? '' : ok ? 'bg-emerald-100 ring-2 ring-emerald-600 disabled:opacity-100' : k === chosen ? 'bg-rose-100 ring-2 ring-rose-600 disabled:opacity-100' : 'opacity-60';
            return <button key={k} className={`${btn} text-2xl ${st}`} disabled={chosen !== null} onClick={() => pick(k)} lang="en">{w}</button>;
          })}
        </div>
        <p role="status" aria-hidden={chosen === null} className={`rounded-xl bg-primary-fixed p-3 text-lg font-bold ${chosen === null ? 'invisible' : ''}`}>
          {chosen === null || round.correct.includes(chosen) ? text('정답! +1점', 'Correct! +1') : text(`정답은 ${round.correct.map((k) => round.tokens[k]).join(', ')}`, `Answer: ${round.correct.map((k) => round.tokens[k]).join(', ')}`)}
        </p>
        <button className={`${primary} ${chosen === null ? 'invisible' : ''}`} tabIndex={chosen === null ? -1 : 0} aria-hidden={chosen === null} onClick={next}>{text('다음', 'Next')}</button>
      </div>
    </Frame>
  );
}

/* ---------------- 문장 뼈대 조립소 ---------------- */
const SLOT_NAME: Record<FramePart, [string, string, string]> = {
  subject: ['주어', '누가 / 무엇이', 'Who / What'], verb: ['동사', '한다 / 이다', 'Does / Is'], rest: ['나머지', '무엇을 · 어디서 · 어떻게', 'What · Where · How'],
};
const SLOTS: FramePart[] = ['subject', 'verb', 'rest'];
function FramePlay({ grammarId, seed = 1, onExit }: CommonProps) {
  const text = useText();
  const r = useRun<ReturnType<typeof frameRounds>[number]>((s) => frameRounds(grammarId, s), seed, 4);
  const [held, setHeld] = useState<FramePart | null>(null);
  const [placed, setPlaced] = useState<Record<FramePart, FramePart | null>>({ subject: null, verb: null, rest: null });
  const [done, setDone] = useState(false);
  const title = text('문장 뼈대 조립소', 'Sentence Frame');
  const reset = () => { setHeld(null); setPlaced({ subject: null, verb: null, rest: null }); setDone(false); };
  const next = () => { r.next(); reset(); };
  const round = r.round;
  const used = new Set(Object.values(placed).filter(Boolean));
  const full = SLOTS.every((s) => placed[s]);
  const correct = SLOTS.every((s) => placed[s] === s);
  const put = (slot: FramePart) => {
    if (done) return;
    if (placed[slot]) { setPlaced((p) => ({ ...p, [slot]: null })); return; }
    if (held) { setPlaced((p) => ({ ...p, [slot]: held })); setHeld(null); }
  };
  const check = () => { if (!full || done) return; setDone(true); playSfx(correct ? GAME_SFX.grammarframe.ok : GAME_SFX.grammarframe.wrong); r.award(correct); };
  useRemoteActions(round ? (done ? [{ id: 'next', label: text('다음', 'Next'), tone: 'primary', run: next }] : full ? [{ id: 'check', label: text('확인', 'Check'), tone: 'primary', run: check }] : []) : []);
  if (!r.enough) return <Empty grammarId={grammarId} title={title} />;
  if (!round) return <Finish scores={r.scores} onAgain={() => { r.again(); reset(); }} onExit={onExit} />;
  return (
    <Frame grammarId={grammarId} title={`${title} · ${r.i + 1}/${r.total}`}>
      <TeamSetup teams={r.teams} setTeams={(n) => { r.setTeamCount(n); reset(); }} />
      <Scores scores={r.scores} turn={r.turn} />
      <div className="space-y-4 rounded-2xl bg-white p-4 shadow-card">
        <p className="text-lg font-bold text-primary">{text('조각을 눌러 고른 다음, 알맞은 칸을 눌러 놓아요.', 'Tap a piece, then tap the right box.')}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {SLOTS.map((s) => {
            const piece = placed[s];
            const st = !done ? '' : placed[s] === s ? 'ring-4 ring-emerald-500' : 'ring-4 ring-rose-500';
            return (
              <button key={s} onClick={() => put(s)} disabled={done} className={`min-h-28 rounded-2xl border-2 border-dashed border-outline-variant bg-primary-fixed/50 p-3 text-center ${st}`} aria-label={SLOT_NAME[s][0]}>
                <span className="block text-sm font-bold text-primary">{text(SLOT_NAME[s][0], SLOT_NAME[s][0])}</span>
                <span className="block text-xs text-on-surface-variant">{text(SLOT_NAME[s][1], SLOT_NAME[s][2])}</span>
                <span className="mt-2 block text-2xl font-extrabold" lang="en">{piece ? round[piece] : ' '}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {round.order.map((p) => (
            <button key={p} className={`${btn} text-2xl ${held === p ? 'ring-4 ring-primary' : ''} ${used.has(p) ? 'opacity-30' : ''}`} disabled={used.has(p) || done} onClick={() => setHeld(p)} lang="en">{round[p]}</button>
          ))}
        </div>
        <p role="status" aria-hidden={!done} className={`rounded-xl p-3 text-xl font-bold ${done && !correct ? 'bg-rose-100' : 'bg-emerald-100'} ${done ? '' : 'invisible'}`} lang="en">{done && !correct ? `${round.subject} | ${round.verb} | ${round.rest}` : `✅ ${round.sentence}`}</p>
        <div className="flex justify-center gap-2">
          {!done ? <button className={primary} disabled={!full} onClick={check}>{text('확인', 'Check')}</button> : <button className={primary} onClick={next}>{text('다음', 'Next')}</button>}
          <button className={btn} disabled={done} onClick={reset}>{text('다시 놓기', 'Reset')}</button>
        </div>
      </div>
    </Frame>
  );
}

/* ---------------- 객관식 공용 틀: 비교급·연결·습관 ---------------- */
function Choice<T extends { id: string; options: string[]; answer: string }>(props: {
  grammarId: string; seed: number; onExit?: () => void; title: string; game: BGameType; make: (seed: number) => T[];
  stem: (round: T, chosen: string | null) => React.ReactNode; explain?: (round: T) => string; label?: (opt: string) => string;
}) {
  const text = useText();
  const r = useRun<T>(props.make, props.seed, 4);
  const [chosen, setChosen] = useState<string | null>(null);
  const next = () => { r.next(); setChosen(null); };
  const pick = (o: string) => {
    if (!r.round || chosen) return;
    setChosen(o);
    const ok = o === r.round.answer;
    playSfx(ok ? GAME_SFX[props.game].ok : GAME_SFX[props.game].wrong);
    r.award(ok);
  };
  useRemoteActions(r.round && chosen ? [{ id: 'next', label: text('다음', 'Next'), tone: 'primary', run: next }] : []);
  if (!r.enough) return <Empty grammarId={props.grammarId} title={props.title} />;
  if (!r.round) return <Finish scores={r.scores} onAgain={() => { r.again(); setChosen(null); }} onExit={props.onExit} />;
  const round = r.round;
  return (
    <Frame grammarId={props.grammarId} title={`${props.title} · ${r.i + 1}/${r.total}`}>
      <TeamSetup teams={r.teams} setTeams={(n) => { r.setTeamCount(n); setChosen(null); }} />
      <Scores scores={r.scores} turn={r.turn} />
      <div className="space-y-4 rounded-2xl bg-white p-4 shadow-card">
        {props.stem(round, chosen)}
        <div className="flex flex-wrap justify-center gap-3">
          {round.options.map((o) => (
            <button key={o} className={`${btn} min-w-28 text-2xl ${stateOf(chosen, o, round.answer)}`} disabled={Boolean(chosen)} onClick={() => pick(o)} lang="en">{props.label ? props.label(o) : o}</button>
          ))}
        </div>
        <div role="status" aria-hidden={!chosen} className={`space-y-2 ${chosen ? '' : 'invisible'}`}>
          <p className={`rounded-xl p-3 text-lg font-bold ${chosen === round.answer ? 'bg-emerald-100' : 'bg-rose-100'}`}>{!chosen || chosen === round.answer ? text('정답! +1점', 'Correct! +1') : text(`정답은 ${props.label ? props.label(round.answer) : round.answer}`, `Answer: ${props.label ? props.label(round.answer) : round.answer}`)}</p>
          {props.explain && <p className="text-on-surface-variant">{props.explain(round)}</p>}
          <button className={primary} tabIndex={chosen ? 0 : -1} onClick={next}>{text('다음', 'Next')}</button>
        </div>
      </div>
    </Frame>
  );
}

function Compare({ grammarId, seed = 1, onExit }: CommonProps) {
  const text = useText();
  return (
    <Choice<CompareRound>
      grammarId={grammarId} seed={seed} onExit={onExit} game="grammarcompare" title={text('비교급 챔피언', 'Comparison Champion')} make={(s) => compareRounds(grammarId, s)}
      stem={(r, chosen) => (
        <>
          <ul className="space-y-2" aria-label={text('비교', 'Compare')}>
            {r.things.map((t) => (
              <li key={t.n} className="grid grid-cols-[9rem_1fr_5.5rem] items-center gap-3 text-left">
                <span className="text-xl font-bold" lang="en">{t.e} {t.n}</span>
                <span className="h-6 rounded-full bg-primary" style={{ width: `${t.pct}%` }} />
                <span className="text-sm text-on-surface-variant">{t.v} {t.unit}</span>
              </li>
            ))}
          </ul>
          <p className="text-3xl font-extrabold" lang="en">{r.before} <span className="inline-block min-w-32 border-b-4 border-primary text-center text-primary">{chosen ?? ' '}</span> {r.after}</p>
        </>
      )}
      explain={(r) => (r.kind === 'comp'
        ? text('둘을 비교할 때는 형용사 뒤에 -er(또는 more)를 붙이고 than 을 써요.', 'To compare two things, use -er (or more) with than.')
        : text('셋 이상 중 가장 …할 때는 the + -est(또는 most)를 써요.', 'For the top of three or more, use the + -est (or most).'))}
    />
  );
}

function Link({ grammarId, seed = 1, onExit }: CommonProps) {
  const text = useText();
  return (
    <Choice<LinkRound & { options: string[] }>
      grammarId={grammarId} seed={seed} onExit={onExit} game="grammarlink" title={text('이유·결과 연결 다리', 'Connector Bridge')} make={(s) => linkRounds(grammarId, s)}
      stem={(r, chosen) => (
        <>
          <p className="text-lg font-bold text-primary">{text('두 말을 알맞게 이어 줄 낱말을 골라요.', 'Pick the word that joins the two parts.')}</p>
          <p className="text-3xl font-extrabold" lang="en">{r.a} <span className="inline-block min-w-28 border-b-4 border-primary text-center text-primary">{chosen ?? ' '}</span> {r.b}.</p>
        </>
      )}
      explain={(r) => {
        const note: Record<string, [string, string]> = {
          and: ['and = 비슷한 내용을 더해요.', 'and = adds similar ideas.'],
          but: ['but = 반대되는 내용을 이어요.', 'but = joins opposite ideas.'],
          because: ['because 뒤에는 이유가 와요.', 'because is followed by the reason.'],
          so: ['so 뒤에는 결과가 와요.', 'so is followed by the result.'],
        };
        return `${linkSentence(r.a, r.answer, r.b)}  ·  ${text(note[r.answer][0], note[r.answer][1])}`;
      }}
    />
  );
}

const DAYS_KO = ['월', '화', '수', '목', '금', '토', '일'];
const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function Habit({ grammarId, seed = 1, onExit }: CommonProps) {
  const text = useText();
  return (
    <Choice<HabitRound>
      grammarId={grammarId} seed={seed} onExit={onExit} game="grammarhabit" title={text('습관 캘린더', 'Habit Calendar')} make={(s) => habitRounds(grammarId, s)}
      stem={(r, chosen) => (r.kind === 'calendar' ? (
        <>
          <p className="text-lg font-bold text-primary">{text('일주일 달력에서 ✓ 가 몇 번인지 보고 알맞은 말을 골라요.', 'Count the ✓ marks in the week and pick the right word.')}</p>
          <ol className="grid grid-cols-7 gap-1 text-center" aria-label={text('일주일 달력', 'Week calendar')}>
            {r.days.map((d, k) => (
              <li key={k} className={`rounded-lg p-2 ${d ? 'bg-emerald-100' : 'bg-surface-container-low'}`}>
                <span className="block text-xs">{text(DAYS_KO[k], DAYS_EN[k])}</span>
                <span className="text-xl font-extrabold">{d ? '✓' : '·'}</span>
              </li>
            ))}
          </ol>
          <p className="text-3xl font-extrabold" lang="en">{r.before} <span className="inline-block min-w-32 border-b-4 border-primary text-center text-primary">{chosen ?? ' '}</span> {r.after}</p>
        </>
      ) : (
        <p className="text-lg font-bold text-primary">{text('낱말 순서가 올바른 문장을 골라요.', 'Pick the sentence with the right word order.')}</p>
      ))}
      explain={(r) => (r.kind === 'calendar'
        ? text(`✓ 가 ${r.days.filter(Boolean).length}번이에요.`, `There are ${r.days.filter(Boolean).length} checks.`)
        : text('빈도부사는 be동사 뒤, 일반동사 앞에 와요.', 'A frequency adverb goes after "be" and before other verbs.'))}
    />
  );
}

export default function GrammarGameB({ type, ...rest }: CommonProps & { type: BGameType }) {
  if (type === 'grammarpos') return <Pos {...rest} />;
  if (type === 'grammarframe') return <FramePlay {...rest} />;
  if (type === 'grammarcompare') return <Compare {...rest} />;
  if (type === 'grammarlink') return <Link {...rest} />;
  return <Habit {...rest} />;
}
