import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TEAM_COLORS } from '../../lib/slideHelpers';

const KEY = 'classbank.board.score.v1';
const COLORS = [...TEAM_COLORS, '#8e24aa', '#00897b'];

interface State {
  names: string[];
  scores: number[];
}

function load(): State {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || 'null') as State | null;
    if (v && Array.isArray(v.names) && Array.isArray(v.scores) && v.names.length >= 2 && v.names.length <= 6) return v;
  } catch {
    /* 기본값 */
  }
  return { names: ['1', '2'], scores: [0, 0] };
}

/** 전자칠판 점수판: 팀 2~6개, 이름 고치기, ＋/－ 점수. 이 탭에 저장돼 다른 화면에 다녀와도 이어진다. */
export default function BoardScoreboard({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [st, setSt] = useState<State>(load);
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(st));
    } catch {
      /* 못 남겨도 이번 화면에서는 그대로 쓴다 */
    }
  }, [st]);

  const label = (i: number) => (st.names[i] && st.names[i] !== String(i + 1) ? st.names[i] : `${t('whiteboard.scoreTeam')} ${i + 1}`);
  const add = (i: number, d: number) => setSt((s) => ({ ...s, scores: s.scores.map((v, k) => (k === i ? v + d : v)) }));
  function setTeams(n: number) {
    setSt((s) => ({
      names: Array.from({ length: n }, (_, i) => s.names[i] ?? String(i + 1)),
      scores: Array.from({ length: n }, (_, i) => s.scores[i] ?? 0),
    }));
  }
  const top = Math.max(...st.scores);
  const btn = 'flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-black text-white focus-visible:outline-4 focus-visible:outline-white';

  return (
    <div className="no-print fixed bottom-24 left-3 z-[65] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/20 bg-deep-navy/95 p-3 text-white shadow-2xl" data-board-score role="group" aria-label={t('whiteboard.scoreTitle')}>
      <div className="mb-2 flex items-center gap-2">
        <span className="mr-auto text-sm font-bold text-white/70">{t('whiteboard.scoreTitle')}</span>
        <button type="button" className="h-9 w-9 rounded-lg bg-white/10 font-bold hover:bg-white/20 disabled:opacity-30" disabled={st.names.length <= 2} onClick={() => setTeams(st.names.length - 1)} aria-label={t('whiteboard.scoreFewer')} data-score-fewer>
          −
        </button>
        <span className="text-sm font-bold" aria-live="polite">
          {st.names.length}
          {t('whiteboard.scoreTeams')}
        </span>
        <button type="button" className="h-9 w-9 rounded-lg bg-white/10 font-bold hover:bg-white/20 disabled:opacity-30" disabled={st.names.length >= 6} onClick={() => setTeams(st.names.length + 1)} aria-label={t('whiteboard.scoreMore')} data-score-more>
          ＋
        </button>
        <button type="button" className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20" onClick={() => setSt((s) => ({ ...s, scores: s.scores.map(() => 0) }))} data-score-reset>
          {t('whiteboard.scoreReset')}
        </button>
        <button type="button" onClick={onClose} aria-label={t('whiteboard.close')} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15">
          ✕
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {st.scores.map((score, i) => (
          <div key={i} className="flex min-w-[8.5rem] flex-col items-center rounded-xl p-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} data-score-team={i}>
            <input
              value={st.names[i] === String(i + 1) ? '' : st.names[i]}
              placeholder={label(i)}
              onChange={(e) => setSt((s) => ({ ...s, names: s.names.map((n, k) => (k === i ? e.target.value || String(i + 1) : n)) }))}
              aria-label={`${t('whiteboard.scoreName')} ${i + 1}`}
              className="w-full rounded-md bg-black/20 px-2 py-1 text-center text-sm font-bold text-white placeholder:text-white/80"
              maxLength={12}
            />
            <div className="flex items-center gap-1">
              <button type="button" className={`${btn} bg-black/25 hover:bg-black/40`} onClick={() => add(i, -1)} aria-label={`${label(i)} −1`} data-score-minus>
                −
              </button>
              <span className={`min-w-[3.2rem] text-center text-5xl font-black tabular-nums ${score === top && top > 0 ? 'drop-shadow-[0_0_8px_#FFD24D]' : ''}`} data-score-value>
                {score}
              </span>
              <button type="button" className={`${btn} bg-black/25 hover:bg-black/40`} onClick={() => add(i, 1)} aria-label={`${label(i)} +1`} data-score-plus>
                ＋
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
