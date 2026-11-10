import { usePictureWordTurn } from './PictureWordTurn';
import {useNativeGameTurn} from '../context/GameTurnContext';
import { gameClock } from '../lib/gameClock';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ClayDie from './ClayDie';
import AccessibleDialog from './AccessibleDialog';
import { DICE_ROLL_MS } from '../lib/diceMotion';
import GameFitText from './GameFitText';
import { useGamePlay } from './GameThemeFrame';
import { colorFor } from '../lib/wheel';
import type { GameItem } from '../lib/types';
import { GAME_SFX, playSfx, useStepSounds } from '../lib/gameSfx';
import './two-dice.css';

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
  onRemoveItem?: (itemId?: string) => void;
}

type Team = 'blue' | 'red';

const SIZE = 6;
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
  if (!items.length) return [];
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

export default function TwoDice({
  items,
  editable,
  onEditItem,
  templateName,
  onRenameTemplate,
  onAddItem,
  onRemoveItem,
}: Props) {
  const pictureTurn = usePictureWordTurn();
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
  useNativeGameTurn({current:t('gameTwoDice.'+(turn==='blue'?'teamBlue':'teamRed')),next:t('gameTwoDice.'+(turn==='blue'?'teamRed':'teamBlue')),index:turn==='blue'?0:1,total:2,enabled:items.length>0&&!winner});
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [reshuffleOpen, setReshuffleOpen] = useState(false);
  const rollingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof gameClock.setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) gameClock.clearTimeout(timerRef.current);
    };
  }, []);

  // 오른쪽 목록 입력창의 초안 텍스트를 실제 항목과 맞춰둔다 — 타이핑 중엔 이 draft를
  // 보여주다가(반응성), blur/Enter 시점에 onEditItem으로 실제 반영한다.
  useEffect(() => {
    setItemDrafts(Object.fromEntries(items.map((i) => [i.id, i.label])));
  }, [items]);

  const reshuffleBoard = useCallback(() => {
    if (timerRef.current) gameClock.clearTimeout(timerRef.current);
    setBoard(pickBoardItems(items));
    rollingRef.current = false;
    setTossKey(0);
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
  }, [items]);

  const itemIds = JSON.stringify(items.map((item) => item.id));
  const previousItemIds = useRef(itemIds);
  useEffect(() => {
    if (previousItemIds.current !== itemIds) {
      previousItemIds.current = itemIds;
      reshuffleBoard();
    } else {
      const byId = new Map(items.map((item) => [item.id, item]));
      setBoard((prev) => prev.map((item) => byId.get(item.id) ?? item));
    }
  }, [items, itemIds, reshuffleBoard]);

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


  function roll() {
    if (rollingRef.current || items.length === 0 || board.length !== SIZE * SIZE || winner) return;
    rollingRef.current = true;
    const d1 = 1 + Math.floor(Math.random() * SIZE);
    const d2 = 1 + Math.floor(Math.random() * SIZE);
    setTarget1(d1);
    setTarget2(d2);
    setHighlightIndex(null);
    setRolling(true);
    setTossKey((n) => n + 1);
    playSfx(GAME_SFX.twodice.shake);
    const rollingTeam = turn;
    if (timerRef.current) gameClock.clearTimeout(timerRef.current);
    timerRef.current = gameClock.setTimeout(() => {
      setDie1(d1);
      setDie2(d2);
      const idx = (d1 - 1) * SIZE + (d2 - 1);
      playSfx(GAME_SFX.twodice.roll);
      // 빈 칸을 차지하면 칩 놓는 소리(빙고가 되면 빙고 소리가 따로 난다)
      if (!claimed[idx]) gameClock.setTimeout(() => playSfx(GAME_SFX.twodice.claim), 220);
      setHighlightIndex(idx);
      const word = board[idx];
      setHistory((prev) => [{ key: `${gameClock.dateNow()}`, label: word.label, team: rollingTeam }, ...prev].slice(0, 8));
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
      rollingRef.current = false;
      setRolling(false);
      setTurn((prev) => (prev === 'blue' ? 'red' : 'blue'));
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 80 : DICE_ROLL_MS);
  }

  useStepSounds(0, !!winner, undefined, GAME_SFX.twodice.bingo);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <span aria-hidden="true" className="material-symbols-outlined mb-3 text-4xl text-primary">casino</span>
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
    <div className="td-game">
          {editable && !itemsHidden && (editingTemplateName ? (
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
      <section className="td-scoreboard" data-turn-display aria-label={t('turnDisplay.region')}>
        <div className="td-score td-score-blue"><span>{teamLabel('blue')}</span><b>{blueCount}</b></div>
        <span data-turn-current hidden>{teamLabel(winner ?? turn)}</span>
        <span data-turn-next hidden>{teamLabel(turn === 'blue' ? 'red' : 'blue')}</span>
        <div className={`td-turn td-turn-${winner ?? turn}`} role="status">
          {winner ? t('gameTwoDice.bingoMessage', { team: teamLabel(winner) }) : t('gameTwoDice.turnLabel', { team: teamLabel(turn) })}
        </div>
        <div className="td-score td-score-red"><span>{teamLabel('red')}</span><b>{redCount}</b></div>
      </section>

      <div className="td-layout">
        <div className="td-board" data-skin-stage="board">
          <table aria-label={t('gameTwoDice.boardLabel')}>
            <colgroup><col className="td-axis-col" /><col span={SIZE} /></colgroup>
            <thead>
              <tr>
                <td />
                {Array.from({ length: SIZE }, (_, c) => (
                  <th key={c} scope="col" className={!rolling && die2 === c + 1 ? 'td-active-col' : undefined}>{c + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: SIZE }, (_, r) => (
                <tr key={r} className={!rolling && die1 === r + 1 ? 'td-active-row' : undefined}>
                  <th scope="row">{r + 1}</th>
                  {board.slice(r * SIZE, (r + 1) * SIZE).map((item, c) => {
                    const i = r * SIZE + c;
                    const owner = claimed[i];
                    return (
                      <td key={c} data-skin-object="cell" title={item.label}
                        className={`td-cell ${!rolling && die2 === c + 1 ? 'td-active-col' : ''} ${owner ? `td-cell-${owner}` : ''} ${i === highlightIndex ? 'td-hit' : ''} ${winLine?.includes(i) ? 'td-cell-win' : ''}`}>
                        <div className="td-cell-text"><GameFitText text={item.label} maxSize={42} wrapLongWord /></div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="td-side">
          <div className="td-controls">
            <div className="td-dice-row">
              <div className="td-die-slot td-col-die">
                <ClayDie label={rolling ? t('gameTwoDice.rolling') : t('gameTwoDice.colLabel', { n: col })} tint="blue" value={rolling ? target2 : col} rolling={rolling} spin="a" tossKey={tossKey} />
                <span className="td-die-label">{rolling || die2 === null ? t('gameTwoDice.colAxis') : t('gameTwoDice.colLabel', { n: col })}</span>
              </div>
              <div className="td-die-slot td-row-die">
                <ClayDie label={rolling ? t('gameTwoDice.rolling') : t('gameTwoDice.rowLabel', { n: row })} tint="red" value={rolling ? target1 : row} rolling={rolling} spin="b" tossKey={tossKey} />
                <span className="td-die-label">{rolling || die1 === null ? t('gameTwoDice.rowAxis') : t('gameTwoDice.rowLabel', { n: row })}</span>
              </div>
            </div>
            <button type="button" onClick={() => pictureTurn(roll)} disabled={rolling || !!winner} className="td-roll">
              {rolling ? t('gameTwoDice.rolling') : t('gameTwoDice.rollButton')}
            </button>
          </div>

          <div className="td-reading">
            <h3>{t('gameTwoDice.readWord')}</h3>
            <div className="td-reading-word" aria-live="polite">
              {highlightIndex === null
                ? <span className="td-reading-placeholder">—</span>
                : <GameFitText text={board[highlightIndex]?.label ?? ''} maxSize={76} wrapLongWord />}
            </div>
          </div>
        </div>
      </div>

      <div className="td-footer">
        <button type="button" onClick={() => setReshuffleOpen(true)} className="td-reset">
          {winner ? t('gameTwoDice.playAgainButton') : t('gameTwoDice.reshuffleButton')}
        </button>
        {history.length > 0 && (
          <details className="td-history">
            <summary>{t('gameTwoDice.recentResults')}</summary>
            <ul>
              {history.map((h) => <li key={h.key} className={`td-score-${h.team}`}>{h.label}</li>)}
            </ul>
          </details>
        )}
      </div>

      {reshuffleOpen && <AccessibleDialog label={t('classroomUx.restartTitle')} onClose={() => setReshuffleOpen(false)}>
        <div className="p-6">
          <h2 className="text-xl font-bold">{t('classroomUx.restartTitle')}</h2>
          <p className="mt-3">{t('classroomUx.restartHint')}</p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button autoFocus className="min-h-11 rounded-xl border px-5" onClick={() => setReshuffleOpen(false)}>{t('classroomUx.keepPlaying')}</button>
            <button className="td-roll td-confirm-reset" onClick={() => { setReshuffleOpen(false); reshuffleBoard(); }}>{t('gameTwoDice.reshuffleButton')}</button>
          </div>
        </div>
      </AccessibleDialog>}

        {editable && !itemsHidden && (
          <div className="w-full md:w-[260px] md:shrink-0 space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-full bg-surface-container-lowest px-2 py-1.5 shadow-sm">
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
                <div key={item.id} className="flex items-center gap-1">
                  <input
                  value={itemDrafts[item.id] ?? item.label}
                  onChange={(e) => handleItemDraftChange(item.id, e.target.value)}
                  onBlur={() => commitItemDraft(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  style={{ color: colorFor(i) }}
                  className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                  <button
                    type="button"
                    onClick={() => onRemoveItem?.(item.id)}
                    disabled={items.length <= 1}
                    title={t('gameAdmin.removeThisItem')}
                    aria-label={t('gameAdmin.removeThisItem')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined text-[18px]">remove_circle</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
