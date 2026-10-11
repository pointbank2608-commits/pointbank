import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GAME_SFX, playSfx } from '../lib/gameSfx';
import { formatClock, groupByPosition, POSITION_CLASS, TEAM_COLORS } from '../lib/slideHelpers';
import type { SlideHelper } from '../lib/types';

/**
 * 발표 중 슬라이드 위에 얹는 보조 블록(제목·타이머·점수판) — 진행바(LessonRunnerBar)가 그린다. 게임·자료실 슬라이드는
 * 그 페이지로 이동해서 보이므로 슬라이드 화면 안이 아니라 발표 층(fixed)에 둔다. 키보드는 쓰지 않는다(Space·방향키는
 * 주 블록과 러너가 받는다) — 버튼이 포커스를 잡지 않게 마우스 누름을 막는다.
 */
export default function SlideHelpersLayer({ helpers }: { helpers: SlideHelper[] }) {
  const groups = groupByPosition(helpers);
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-0 top-14 z-[32]" onMouseDown={(e) => e.preventDefault()}>
      {[...groups.entries()].map(([pos, list]) => (
        <div key={pos} className={`absolute flex flex-col gap-2 ${POSITION_CLASS[pos]}`}>
          {list.map((h) => (
            <div key={h.id} className="pointer-events-auto">
              {h.type === 'title' && <TitleHelper text={h.text} />}
              {h.type === 'timer' && <TimerHelper seconds={h.seconds} />}
              {h.type === 'scoreboard' && <ScoreboardHelper teams={h.teams} />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const glass = 'rounded-2xl bg-deep-navy/85 text-white shadow-lg backdrop-blur-sm';

function TitleHelper({ text }: { text: string }) {
  if (!text.trim()) return null;
  return <div className={`${glass} max-w-[40vw] px-5 py-2 text-center text-2xl font-bold leading-snug sm:text-3xl`}>{text}</div>;
}

function TimerHelper({ seconds }: { seconds: number }) {
  const { t } = useTranslation();
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const rang = useRef(false);

  useEffect(() => {
    setLeft(seconds);
    setRunning(false);
    rang.current = false;
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          window.clearInterval(id);
          setRunning(false);
          if (!rang.current) {
            rang.current = true;
            playSfx(GAME_SFX.quizshow.timeUp);
          }
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const over = left === 0;
  const warn = left <= 10 && !over;
  const btn = 'flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25';
  return (
    <div className={`${glass} flex items-center gap-3 px-4 py-2 ${over ? 'animate-pulse bg-error/90' : ''}`}>
      <span className="material-symbols-outlined text-[26px]">timer</span>
      <span className={`min-w-[4.5ch] text-center text-4xl font-bold tabular-nums ${warn ? 'text-warm-yellow' : ''}`}>{formatClock(left)}</span>
      <button
        type="button"
        tabIndex={-1}
        className={btn}
        aria-label={running ? t('curriculum.helpers.pause') : t('curriculum.helpers.start')}
        onClick={() => {
          if (over) {
            setLeft(seconds);
            rang.current = false;
          }
          setRunning((r) => !r);
        }}
      >
        <span className="material-symbols-outlined">{running ? 'pause' : 'play_arrow'}</span>
      </button>
      <button
        type="button"
        tabIndex={-1}
        className={btn}
        aria-label={t('curriculum.helpers.reset')}
        onClick={() => {
          setRunning(false);
          setLeft(seconds);
          rang.current = false;
        }}
      >
        <span className="material-symbols-outlined">replay</span>
      </button>
    </div>
  );
}

function ScoreboardHelper({ teams }: { teams: number }) {
  const { t } = useTranslation();
  const [scores, setScores] = useState<number[]>(() => Array(teams).fill(0));
  useEffect(() => setScores((s) => Array.from({ length: teams }, (_, i) => s[i] ?? 0)), [teams]);
  const change = (i: number, d: number) => {
    if (d > 0) playSfx(4015, 0.6);
    setScores((s) => s.map((v, j) => (j === i ? Math.max(0, v + d) : v)));
  };
  const btn = 'flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-2xl font-bold leading-none hover:bg-white/25';
  return (
    <div className={`${glass} flex items-stretch gap-2 p-2`}>
      {scores.map((v, i) => (
        <div key={i} className="flex min-w-[7.5rem] flex-col items-center gap-1 rounded-xl px-3 py-1.5" style={{ background: `${TEAM_COLORS[i % TEAM_COLORS.length]}cc` }}>
          <span className="text-base font-bold">{t('teamOrder.teamLabel', { n: i + 1 })}</span>
          <span className="text-4xl font-bold tabular-nums">{v}</span>
          <span className="flex gap-2">
            <button type="button" tabIndex={-1} className={btn} aria-label={t('curriculum.helpers.minus')} onClick={() => change(i, -1)}>
              −
            </button>
            <button type="button" tabIndex={-1} className={btn} aria-label={t('curriculum.helpers.plus')} onClick={() => change(i, 1)}>
              +
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
