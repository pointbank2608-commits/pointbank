import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import { useGamePlay } from './GameThemeFrame';
import { colorFor } from '../lib/wheel';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
  /** true면 오른쪽에 항목 개수 조절 + 이름 수정 목록 패널을 보여준다(선생님용 실제 플레이 화면에서만). */
  editable?: boolean;
  onEditItem?: (id: string, label: string) => void;
  /** 상단 이름 표시/수정 + 항목 개수 +/- 툴바. GameThemeFrame 안(전체화면 포함)에서도
   * 보이도록 TwoDice 자체에 둔다. */
  templateName?: string;
  onRenameTemplate?: (name: string) => void;
  onAddItem?: () => void;
  onRemoveItem?: () => void;
}

type Team = 'blue' | 'red';

const SIZE = 6;
const ROLL_MS = 980;
const TEAL_DIE = '/skins/twodice-teal.png?v=3';
const CORAL_DIE = '/skins/twodice-coral.png?v=3';
const BOARD_SRC = '/skins/twodice-board.png';

const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';

/** 표준 주사위 3×3 점 위치 (0=좌상 … 8=우하). */
const PIP_MAP: number[][] = [
  [],
  [4],
  [0, 8],
  [0, 4, 8],
  [0, 2, 6, 8],
  [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8],
];

/** 그 눈이 카메라를 향하게 하는 큐브 회전. 반대면 합이 7. */
const FACE_ROT: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0, ry: 0 },
  2: { rx: -90, ry: 0 },
  3: { rx: 0, ry: -90 },
  4: { rx: 0, ry: 90 },
  5: { rx: 90, ry: 0 },
  6: { rx: 0, ry: 180 },
};

const CUBE_FACES: { n: number; pos: string }[] = [
  { n: 1, pos: 'front' },
  { n: 6, pos: 'back' },
  { n: 3, pos: 'right' },
  { n: 4, pos: 'left' },
  { n: 2, pos: 'top' },
  { n: 5, pos: 'bottom' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 항목이 36개보다 많으면 무작위 36개만, 적으면 부족한 만큼 반복해서 6x6 판을 채운다. */
function pickBoardItems(items: GameItem[]): GameItem[] {
  const pool = shuffle(items);
  return Array.from({ length: SIZE * SIZE }, (_, i) => pool[i % pool.length]);
}

/** 가로 6줄 + 세로 6줄 + 대각선 2줄 = 빙고에서 이길 수 있는 모든 줄. */
const LINES: number[][] = [
  ...Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => r * SIZE + c)),
  ...Array.from({ length: SIZE }, (_, c) => Array.from({ length: SIZE }, (_, r) => r * SIZE + c)),
  Array.from({ length: SIZE }, (_, i) => i * SIZE + i),
  Array.from({ length: SIZE }, (_, i) => i * SIZE + (SIZE - 1 - i)),
];

function findWinningLine(claimed: Record<number, Team>, team: Team): number[] | null {
  for (const line of LINES) {
    if (line.every((idx) => claimed[idx] === team)) return line;
  }
  return null;
}

function Pips({ n }: { n: number }) {
  const on = new Set(PIP_MAP[n] ?? PIP_MAP[1]);
  return (
    <div className="td-pips" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={on.has(i) ? 'td-pip' : undefined} />
      ))}
    </div>
  );
}

function ClayDie({
  src,
  tint,
  value,
  rolling,
  spin,
  tossKey,
}: {
  src: string;
  tint: 'teal' | 'coral';
  value: number;
  rolling: boolean;
  spin: 'a' | 'b';
  tossKey: number;
}) {
  const rot = FACE_ROT[value] ?? FACE_ROT[1];
  const tumble = rolling ? (spin === 'b' ? 'td-tumble-b' : 'td-tumble') : '';
  return (
    <div data-skin-object="die" className={`td-die-scene ${rolling ? 'is-rolling' : ''}`}>
      <div className={`td-toss ${rolling ? 'td-tossing' : ''}`}>
        <div
          key={tossKey}
          className={`td-cube ${tumble}`}
          style={
            {
              ['--td-rx']: `${rot.rx}deg`,
              ['--td-ry']: `${rot.ry}deg`,
              ['--td-skin']: `url(${src})`,
            } as CSSProperties
          }
        >
          {CUBE_FACES.map((face) => (
            <div key={face.n} className={`td-face td-face-${face.pos} td-face-${tint}`}>
              <Pips n={face.n} />
            </div>
          ))}
        </div>
      </div>
      <div className={`td-die-shadow ${rolling ? 'td-die-shadow-toss' : ''}`} />
    </div>
  );
}

export default function TwoDice({
  items,
  editable,
  onEditItem,
  templateName,
  onRenameTemplate,
  onAddItem,
  onRemoveItem,
}: Props) {
  const { t } = useTranslation();
  const { itemsHidden } = useGamePlay();
  const [board, setBoard] = useState<GameItem[]>(() => pickBoardItems(items));
  const [die1, setDie1] = useState<number | null>(null);
  const [die2, setDie2] = useState<number | null>(null);
  const [target1, setTarget1] = useState(1);
  const [target2, setTarget2] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<{ key: string; label: string; team: Team }[]>([]);
  const [tossKey, setTossKey] = useState(0);
  const [claimed, setClaimed] = useState<Record<number, Team>>({});
  const [turn, setTurn] = useState<Team>('blue');
  const [winner, setWinner] = useState<Team | null>(null);
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // 오른쪽 목록 입력창의 초안 텍스트를 실제 항목과 맞춰둔다 — 타이핑 중엔 이 draft를
  // 보여주다가(반응성), blur/Enter 시점에 onEditItem으로 실제 반영한다.
  useEffect(() => {
    setItemDrafts(Object.fromEntries(items.map((i) => [i.id, i.label])));
  }, [items]);

  function handleItemDraftChange(id: string, value: string) {
    setItemDrafts((prev) => ({ ...prev, [id]: value }));
  }

  function commitItemDraft(id: string) {
    const value = (itemDrafts[id] ?? '').trim();
    if (value) onEditItem?.(id, value);
  }

  function startEditTemplateName() {
    setTemplateNameDraft(templateName ?? '');
    setEditingTemplateName(true);
  }

  function commitTemplateNameEdit() {
    const trimmed = templateNameDraft.trim();
    setEditingTemplateName(false);
    if (trimmed && trimmed !== templateName) onRenameTemplate?.(trimmed);
  }

  function reshuffleBoard() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setBoard(pickBoardItems(items));
    setHighlightIndex(null);
    setDie1(null);
    setDie2(null);
    setTarget1(1);
    setTarget2(1);
    setHistory([]);
    setRolling(false);
    setClaimed({});
    setTurn('blue');
    setWinner(null);
    setWinLine(null);
  }

  function roll() {
    if (rolling || items.length === 0 || winner) return;
    const d1 = 1 + Math.floor(Math.random() * SIZE);
    const d2 = 1 + Math.floor(Math.random() * SIZE);
    setTarget1(d1);
    setTarget2(d2);
    setHighlightIndex(null);
    setRolling(true);
    setTossKey((n) => n + 1);
    const rollingTeam = turn;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDie1(d1);
      setDie2(d2);
      const idx = (d1 - 1) * SIZE + (d2 - 1);
      setHighlightIndex(idx);
      const word = board[idx];
      setHistory((prev) => [{ key: `${Date.now()}`, label: word.label, team: rollingTeam }, ...prev].slice(0, 8));
      setClaimed((prev) => {
        if (prev[idx]) return prev;
        const next = { ...prev, [idx]: rollingTeam };
        const line = findWinningLine(next, rollingTeam);
        if (line) {
          setWinner(rollingTeam);
          setWinLine(line);
        }
        return next;
      });
      setRolling(false);
      setTurn((prev) => (prev === 'blue' ? 'red' : 'blue'));
    }, ROLL_MS);
  }

  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={TEAL_DIE} alt="" className="mx-auto mb-3 h-16 w-auto" />
        <div className="font-body-md text-body-md">{t('gameTwoDice.needParticipants')}</div>
      </div>
    );
  }

  const row = die1 ?? 1;
  const col = die2 ?? 1;
  const teamLabel = (team: Team) => (team === 'blue' ? t('gameTwoDice.teamBlue') : t('gameTwoDice.teamRed'));
  const blueCount = Object.values(claimed).filter((v) => v === 'blue').length;
  const redCount = Object.values(claimed).filter((v) => v === 'red').length;

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div
        className={`flex w-full flex-col items-center gap-6 ${editable ? 'md:flex-row md:items-start md:justify-center' : ''}`}
      >
        <div className="flex w-full flex-col items-center">
          {editable &&
            (editingTemplateName ? (
              <input
                autoFocus
                value={templateNameDraft}
                onChange={(e) => setTemplateNameDraft(e.target.value)}
                onBlur={commitTemplateNameEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTemplateNameEdit();
                  if (e.key === 'Escape') setEditingTemplateName(false);
                }}
                className="mb-2 w-full max-w-[420px] font-headline-lg-mobile text-headline-lg-mobile text-deep-navy bg-surface-container-lowest border border-primary rounded-lg px-2 outline-none text-center"
              />
            ) : (
              <button
                type="button"
                onClick={startEditTemplateName}
                title={t('gameAdmin.renameInlineHint')}
                className="mb-2 max-w-[420px] truncate font-headline-lg-mobile text-headline-lg-mobile text-deep-navy hover:bg-surface-container-lowest rounded-lg px-2 transition-colors"
              >
                {templateName}
              </button>
            ))}
          {editable && !itemsHidden && (
            <div className="mb-3 max-w-[420px] text-center font-caption text-caption text-on-surface-variant">
              {t('gameAdmin.editHintItems')}
            </div>
          )}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2.5">
        <div
          data-skin-object="score-card"
          className="min-w-[92px] rounded-2xl px-5 py-2.5 text-center text-on-secondary"
          style={{ backgroundColor: '#3dbea8', boxShadow: woodShadow }}
        >
          <div className="font-caption text-[13px] font-bold opacity-90">{teamLabel('blue')}</div>
          <div className="font-title-md text-[26px] font-bold tabular-nums leading-none">{blueCount}</div>
        </div>
        <div
          className={`rounded-full px-7 py-2.5 text-center font-title-md text-[16px] font-bold shadow-sm ${
            turn === 'blue' && !winner ? 'bg-secondary text-on-secondary' : 'text-white'
          }`}
          style={turn === 'red' || winner === 'red' ? { backgroundColor: '#f28b73' } : undefined}
        >
          {winner ? t('gameTwoDice.bingoMessage', { team: teamLabel(winner) }) : t('gameTwoDice.turnLabel', { team: teamLabel(turn) })}
        </div>
        <div
          data-skin-object="score-card"
          className="min-w-[92px] rounded-2xl px-5 py-2.5 text-center text-white"
          style={{ backgroundColor: '#f28b73', boxShadow: woodShadow }}
        >
          <div className="font-caption text-[13px] font-bold opacity-90">{teamLabel('red')}</div>
          <div className="font-title-md text-[26px] font-bold tabular-nums leading-none">{redCount}</div>
        </div>
      </div>

      <div className="td-dice-row mb-4 flex items-end justify-center gap-10 sm:gap-14">
        <div className="flex flex-col items-center gap-2">
          <ClayDie src={TEAL_DIE} tint="teal" value={rolling ? target2 : col} rolling={rolling} spin="a" tossKey={tossKey} />
          <div className="font-title-md text-[15px] font-bold text-deep-navy">{t('gameTwoDice.colLabel', { n: col })}</div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <ClayDie src={CORAL_DIE} tint="coral" value={rolling ? target1 : row} rolling={rolling} spin="b" tossKey={tossKey} />
          <div className="font-title-md text-[15px] font-bold text-deep-navy">{t('gameTwoDice.rowLabel', { n: row })}</div>
        </div>
      </div>

      <button onClick={roll} disabled={rolling || !!winner} className={`mb-5 ${pill} disabled:opacity-60`}>
        {rolling ? t('gameTwoDice.rolling') : t('gameTwoDice.rollButton')}
      </button>

      <div data-skin-stage="board" className="td-board mb-3">
        <img src={BOARD_SRC} alt="" draggable={false} className="td-board-img" />
        <div className="td-board-grid">
          <div />
          {Array.from({ length: SIZE }, (_, n) => (
            <div
              key={`col-${n}`}
              className={`td-bead ${!rolling && die2 === n + 1 ? 'td-bead-col' : ''}`}
            >
              {n + 1}
            </div>
          ))}
          {board.map((item, i) => {
            const r = Math.floor(i / SIZE);
            const showRowBead = i % SIZE === 0;
            const hit = i === highlightIndex;
            const owner = claimed[i];
            const inWinLine = winLine?.includes(i) ?? false;
            return (
              <div key={`row-${r}-${i}`} className="contents">
                {showRowBead && (
                  <div className={`td-bead ${!rolling && die1 === r + 1 ? 'td-bead-row' : ''}`}>
                    {r + 1}
                  </div>
                )}
                <div
                  data-skin-object="cell"
                  className={`td-cell ${owner ? `td-cell-${owner}` : ''} ${hit ? 'td-hit' : ''} ${inWinLine ? 'td-cell-win' : ''}`}
                >
                  <GameFitText text={item.label} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={reshuffleBoard}
        className="mb-4 font-label-md text-label-md text-secondary hover:underline"
      >
        {winner ? t('gameTwoDice.playAgainButton') : t('gameTwoDice.reshuffleButton')}
      </button>

      {history.length > 0 && (
        <div className="w-full max-w-[420px]">
          <div className="mb-2 font-caption text-caption text-on-surface-variant">{t('gameTwoDice.recentResults')}</div>
          <div className="flex flex-wrap gap-1.5">
            {history.map((h, i) => (
              <span
                key={h.key}
                className="rounded-full px-3 py-1 font-label-md text-label-md text-deep-navy"
                style={{
                  background:
                    h.team === 'blue'
                      ? 'linear-gradient(180deg, #eafaf6 0%, #bfeee3 100%)'
                      : 'linear-gradient(180deg, #fdeee9 0%, #f7c9ba 100%)',
                  border: i === 0 ? '2px solid #f28b73' : '2px solid #f0d7a8',
                  boxShadow: i === 0 ? woodShadow : '0 2px 0 #e8c48a',
                }}
              >
                {h.label}
              </span>
            ))}
          </div>
        </div>
      )}
        </div>

        {editable && !itemsHidden && (
          <div className="w-full md:w-[260px] md:shrink-0 space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-full bg-surface-container-lowest px-2 py-1.5 shadow-sm">
              <button
                type="button"
                onClick={onRemoveItem}
                disabled={items.length <= 1}
                aria-label={t('gameAdmin.removeItemQuick')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">remove</span>
              </button>
              <span className="font-label-md text-label-md text-on-surface-variant tabular-nums whitespace-nowrap">
                {t('gameAdmin.itemCountLabel', { count: items.length })}
              </span>
              <button
                type="button"
                onClick={onAddItem}
                aria-label={t('gameAdmin.addItemQuick')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
              </button>
            </div>
            <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
              {items.map((item, i) => (
                <input
                  key={item.id}
                  value={itemDrafts[item.id] ?? item.label}
                  onChange={(e) => handleItemDraftChange(item.id, e.target.value)}
                  onBlur={() => commitItemDraft(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  style={{ color: colorFor(i) }}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
