import { useMemo, useState } from 'react';
import {
  askRounds, condRounds, passiveRounds, relativeRounds, shopRounds,
  type CondRound, type PassiveRound, type RelRound, type ShopRound,
} from '../lib/grammarGamesC';
import type { GrammarGameType } from '../lib/grammarGames';
import { GAME_SFX, playSfx } from '../lib/gameSfx';
import { Empty, Finish, Frame, Scores, TeamSetup, btn, primary, useText, type CommonProps } from './GrammarGames';
import { Choice } from './GrammarGamesB';

/** 문법별 게임 3차 묶음 화면 5종. 팀 점수는 이 화면 안의 놀이 점수다(칭찬 통장과 무관). */
type CGameType = Extract<GrammarGameType, 'grammarpassive' | 'grammarcond' | 'grammarrelative' | 'grammarask' | 'grammarshop'>;

const blank = (chosen: string | null) => (
  <span className="inline-block min-w-32 border-b-4 border-primary text-center text-primary">{chosen ?? ' '}</span>
);

/* ---------------- 수동태 카메라 ---------------- */
function Passive({ grammarId, seed = 1, onExit }: CommonProps) {
  const text = useText();
  return (
    <Choice<PassiveRound>
      grammarId={grammarId} seed={seed} onExit={onExit} game="grammarpassive" title={text('수동태 카메라', 'Passive Camera')}
      make={(s) => passiveRounds(grammarId, s)}
      stem={(r, chosen) => (
        <>
          <p className="text-lg font-bold text-primary">{text('카메라가 비추는 것이 주어가 돼요. 문장을 카메라가 비추는 쪽에서 말해 봐요!', 'The camera points at the subject. Tell it from the camera’s view!')}</p>
          <div className="flex items-center justify-center gap-4 text-5xl" aria-hidden>
            <span title="actor">{r.actorE}</span><span className="text-3xl">➡️</span><span title="object">{r.objE}</span><span className="text-4xl">🎥</span>
          </div>
          <p className="text-xl text-on-surface-variant" lang="en">{r.active}</p>
          <p className="text-3xl font-extrabold" lang="en">{r.before} {blank(chosen)} {r.after}</p>
        </>
      )}
      explain={() => text('수동태 = be + 과거분사. 행동을 당한 것이 주어가 되고, 행동한 사람은 by 뒤에 써요.', 'Passive = be + past participle. The receiver is the subject; the doer goes after "by".')}
    />
  );
}

/* ---------------- 조건문 선택 모험 ---------------- */
function Cond({ grammarId, seed = 1, onExit }: CommonProps) {
  const text = useText();
  return (
    <Choice<CondRound>
      grammarId={grammarId} seed={seed} onExit={onExit} game="grammarcond" title={text('조건문 선택 모험', 'If-Adventure')}
      make={(s) => condRounds(grammarId, s)}
      stem={(r, chosen) => (
        <>
          <p className="text-6xl" aria-hidden>{r.scene}</p>
          <p className="text-lg font-bold text-primary">{text('이야기가 이어지게 알맞은 말을 골라요!', 'Pick the words that keep the story going!')}</p>
          <p className="text-3xl font-extrabold" lang="en">{r.before} {blank(chosen)} {r.after}</p>
        </>
      )}
      explain={(r) => `${r.full}  ·  ${text('if 절에서는 미래도 현재형을 쓰고, 결과에는 will + 동사원형을 써요.', 'After "if" use the present tense; the result uses will + base verb.')}`}
    />
  );
}

/* ---------------- 관계사 인물 찾기 ---------------- */
function Relative({ grammarId, seed = 1, onExit }: CommonProps) {
  const text = useText();
  return (
    <Choice<RelRound>
      grammarId={grammarId} seed={seed} onExit={onExit} game="grammarrelative" title={text('관계사 인물 찾기', 'Relative Detective')}
      make={(s) => relativeRounds(grammarId, s)}
      stem={(r) => (
        <>
          <p className="text-lg font-bold text-primary">{text('단서 문장을 읽고 알맞은 카드를 눌러요!', 'Read the clue and tap the matching card!')}</p>
          <p className="text-3xl font-extrabold" lang="en">{r.clue}</p>
        </>
      )}
      explain={(r) => text(r.explain[0], r.explain[1])}
    />
  );
}

/* ---------------- 문법 장보기 ---------------- */
function Shop({ grammarId, seed = 1, onExit }: CommonProps) {
  const text = useText();
  return (
    <Choice<ShopRound>
      grammarId={grammarId} seed={seed} onExit={onExit} game="grammarshop" title={text('문법 장보기', 'Grammar Shopping')}
      make={(s) => shopRounds(grammarId, s)}
      stem={(r, chosen) => (
        <>
          <p className="text-7xl" aria-hidden>{r.e}</p>
          <p className="text-lg font-bold text-primary">{text('장바구니 문장을 완성해요!', 'Complete the shopping sentence!')}</p>
          <p className="text-3xl font-extrabold" lang="en">{r.before} {blank(chosen)} {r.after}</p>
        </>
      )}
      explain={(r) => text(r.explain[0], r.explain[1])}
    />
  );
}

/* ---------------- 질문으로 친구 찾기 ---------------- */
function Ask({ grammarId, seed = 1, onExit }: CommonProps) {
  const text = useText();
  const [run, setRun] = useState(seed);
  const rounds = useMemo(() => askRounds(grammarId, run), [grammarId, run]);
  const [teams, setTeams] = useState(2);
  const [scores, setScores] = useState<number[]>([0, 0]);
  const [r, setR] = useState(0);
  const [turn, setTurn] = useState(0);
  const [asked, setAsked] = useState<{ q: number; yes: boolean }[]>([]);
  const [wrong, setWrong] = useState<number[]>([]);
  const [guessing, setGuessing] = useState(false);
  const [found, setFound] = useState<number | null>(null);
  const round = rounds[r];
  const title = text('질문으로 친구 찾기', 'Find the Friend');
  const reset = (n: number) => { setTeams(n); setScores(Array(n).fill(0)); setR(0); setTurn(0); setAsked([]); setWrong([]); setGuessing(false); setFound(null); };
  if (rounds.length < 2) return <Empty grammarId={grammarId} title={title} />;
  if (!round) return <Finish scores={scores} onAgain={() => { setRun((x) => x + 1); reset(teams); }} onExit={onExit} />;
  const secret = round.chars[round.secret];
  const out = (i: number) => wrong.includes(i) || asked.some((a) => round.chars[i].traits[a.q] !== a.yes);
  const left = round.chars.filter((_, i) => !out(i)).length;
  const lastAnswer = asked.at(-1);
  const ask = (q: number) => {
    if (found !== null || asked.some((a) => a.q === q)) return;
    const yes = secret.traits[q];
    playSfx(GAME_SFX.grammarask.ok);
    setAsked((a) => [...a, { q, yes }]);
    setGuessing(false);
    setTurn((t) => (t + 1) % teams);
  };
  const guess = (i: number) => {
    if (!guessing || found !== null || out(i)) return;
    if (i === round.secret) {
      const pts = Math.max(1, 5 - asked.length);
      playSfx(GAME_SFX.grammarask.done);
      setScores((s) => s.map((v, k) => (k === turn ? v + pts : v)));
      setFound(i);
    } else {
      playSfx(GAME_SFX.grammarask.wrong);
      setWrong((w) => [...w, i]);
      setTurn((t) => (t + 1) % teams);
    }
    setGuessing(false);
  };
  const next = () => { setR((x) => x + 1); setAsked([]); setWrong([]); setGuessing(false); setFound(null); };
  return (
    <Frame grammarId={grammarId} title={`${title} · ${r + 1}/${rounds.length}`}>
      <TeamSetup teams={teams} setTeams={reset} />
      <Scores scores={scores} turn={found === null ? turn : null} />
      <div className="space-y-4 rounded-2xl bg-white p-4 shadow-card">
        <p className="text-lg font-bold text-primary">
          {found === null
            ? text(`${turn + 1}팀 차례! 질문을 하나 고르거나, 누구인지 맞혀 봐요. (남은 친구 ${left}명)`, `Team ${turn + 1}'s turn! Ask a question or guess who it is. (${left} left)`)
            : text(`정답! ${secret.n} 이에요! +${Math.max(1, 5 - asked.length)}점`, `Correct! It's ${secret.n}! +${Math.max(1, 5 - asked.length)}`)}
        </p>
        <ul className="grid grid-cols-4 gap-2" aria-label={text('친구들', 'Friends')}>
          {round.chars.map((c, i) => {
            const gone = out(i);
            const isSecret = found === i;
            return (
              <li key={c.n}>
                <button
                  className={`w-full rounded-xl border p-2 text-center shadow-card ${isSecret ? 'bg-emerald-100 ring-4 ring-emerald-500' : gone ? 'bg-surface-container-low opacity-40' : guessing ? 'bg-primary-fixed ring-2 ring-primary' : 'bg-white'}`}
                  disabled={!guessing || gone || found !== null} onClick={() => guess(i)} aria-label={c.n}
                >
                  <span className="block text-4xl">{c.e}</span>
                  <span className="block text-sm font-bold">{c.n}</span>
                  <span className="block min-h-6 text-lg" aria-hidden>{c.traits.map((t, b) => (t ? ASK_ICON[round.family][b] : '')).join('')}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap justify-center gap-2">
          {round.questions.map((q) => {
            const done = asked.find((a) => a.q === q.id);
            return (
              <button key={q.id} className={`${btn} text-lg ${done ? (done.yes ? 'bg-emerald-100' : 'bg-rose-100') : ''}`} disabled={Boolean(done) || found !== null} onClick={() => ask(q.id)} lang="en">
                {q.icon} {q.text}{done ? (done.yes ? ' ✅' : ' ❌') : ''}
              </button>
            );
          })}
        </div>
        <p role="status" className={`rounded-xl bg-primary-fixed p-3 text-xl font-extrabold ${lastAnswer ? '' : 'invisible'}`}>
          {lastAnswer ? (lastAnswer.yes ? 'Yes, it does! ✅' : 'No, it doesn’t. ❌') : ' '}
        </p>
        <div className="flex justify-center gap-2">
          {found === null
            ? <button className={primary} disabled={left < 1} onClick={() => setGuessing((g) => !g)}>{guessing ? text('질문하기로 돌아가기', 'Back to questions') : text('누구인지 맞히기', 'I know who it is!')}</button>
            : <button className={primary} onClick={next}>{r + 1 === rounds.length ? text('결과 보기', 'See results') : text('다음 판', 'Next round')}</button>}
        </div>
      </div>
    </Frame>
  );
}
const ASK_ICON: Record<'does' | 'is' | 'can', string[]> = {
  does: ['👓', '🎩', '💇', '🍕', '🐶'],
  is: ['📏', '😊', '🧒', '👕', '📖'],
  can: ['🏊', '🎤', '💃', '🚲', '🍳'],
};

export default function GrammarGameC({ type, ...rest }: CommonProps & { type: CGameType }) {
  if (type === 'grammarpassive') return <Passive {...rest} />;
  if (type === 'grammarcond') return <Cond {...rest} />;
  if (type === 'grammarrelative') return <Relative {...rest} />;
  if (type === 'grammarshop') return <Shop {...rest} />;
  return <Ask {...rest} />;
}
