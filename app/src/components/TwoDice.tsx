import {useNativeGameTurn} from '../context/GameTurnContext';
import { gameClock } from '../lib/gameClock';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  size?: number;
  teamCount?: number;
  rounds?: number;
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

const TEAMS = ['blue', 'red', 'green', 'purple'] as const;
type Team = typeof TEAMS[number];
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickBoardItems(items: GameItem[], size: number): GameItem[] {
  if (!items.length) return [];
  const pool = shuffle(items);
  return Array.from({ length: size * size }, (_, i) => pool[i % pool.length]);
}

function findWinningLine(claimed: Record<number, Team>, team: Team, size: number, idx: number): number[] | null {
  const row = Math.floor(idx / size);
  const col = idx % size;
  const line = (cell: (i: number) => number) => Array.from({ length: size }, (_, i) => cell(i));
  return [
    line(i => row * size + i), line(i => i * size + col),
    ...(row === col ? [line(i => i * (size + 1))] : []),
    ...(row + col === size - 1 ? [line(i => (i + 1) * (size - 1))] : []),
  ].find(cells => cells.every(i => claimed[i] === team)) ?? null;
}

export default function TwoDice({
  items,
  size = 6,
  teamCount = 2,
  rounds = 9,
  editable,
  onEditItem,
  templateName,
  onRenameTemplate,
  onAddItem,
  onRemoveItem,
}: Props) {
  const { t } = useTranslation();
  const { itemsHidden } = useGamePlay();
  const teams = useMemo(() => TEAMS.slice(0, teamCount), [teamCount]);
  const solo = teamCount === 1;
  const turnLimit = teamCount >= 3 ? rounds * teamCount : null;
  const [board, setBoard] = useState<GameItem[]>(() => pickBoardItems(items, size));
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
  const [rollCount, setRollCount] = useState(0);
  const [result, setResult] = useState<{ leaders: Team[]; bingo: boolean } | null>(null);
  const teamLabel = (team: Team) => t(solo ? 'gameTwoDice.solo' : `gameTwoDice.teams.${team}`);
  const turnIndex = teams.indexOf(turn);
  const nextTeam = teams[(turnIndex + 1) % teamCount];
  useNativeGameTurn({ current: teamLabel(turn), next: teamLabel(nextTeam), index: turnIndex, total: teamCount, enabled: !solo && items.length > 0 && !result });
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [reshuffleOpen, setReshuffleOpen] = useState(false);
  const rollingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof gameClock.setTimeout> | null>(null);
  const claimSoundRef = useRef<ReturnType<typeof gameClock.setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) gameClock.clearTimeout(timerRef.current);
      if (claimSoundRef.current !== null) gameClock.clearTimeout(claimSoundRef.current);
    };
  }, []);

  // 오른쪽 목록 입력창의 초안 텍스트를 실제 항목과 맞춰둔다 — 타이핑 중엔 이 draft를
  // 보여주다가(반응성), blur/Enter 시점에 onEditItem으로 실제 반영한다.
  useEffect(() => {
    setItemDrafts(Object.fromEntries(items.map((i) => [i.id, i.label])));
  }, [items]);

  const reshuffleBoard = useCallback(() => {
    if (timerRef.current !== null) gameClock.clearTimeout(timerRef.current);
    if (claimSoundRef.current !== null) gameClock.clearTimeout(claimSoundRef.current);
    setBoard(pickBoardItems(items, size));
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
    setRollCount(0);
    setResult(null);
    setWinLine(null);
  }, [items, size]);

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
    if (rollingRef.current || items.length === 0 || board.length !== size * size || result) return;
    rollingRef.current = true;
    const d1 = 1 + Math.floor(Math.random() * size);
    const d2 = 1 + Math.floor(Math.random() * size);
    setTarget1(d1);
    setTarget2(d2);
    setHighlightIndex(null);
    setRolling(true);
    setTossKey((n) => n + 1);
    playSfx(GAME_SFX.twodice.shake);
    const rollingTeam = turn;
    if (timerRef.current !== null) gameClock.clearTimeout(timerRef.current);
    timerRef.current = gameClock.setTimeout(() => {
      setDie1(d1);
      setDie2(d2);
      const idx = (d1 - 1) * size + (d2 - 1);
      playSfx(GAME_SFX.twodice.roll);
      setHighlightIndex(idx);
      const word = board[idx];
      setHistory((prev) => [{ key: `${gameClock.dateNow()}`, label: word.label, team: rollingTeam }, ...prev].slice(0, 8));
      const newClaim = !claimed[idx];
      const next = newClaim ? { ...claimed, [idx]: rollingTeam } : claimed;
      const owners = Object.values(next);
      const line = newClaim ? findWinningLine(next, rollingTeam, size, idx) : null;
      if (newClaim && !line) {
        if (claimSoundRef.current !== null) gameClock.clearTimeout(claimSoundRef.current);
        claimSoundRef.current = gameClock.setTimeout(() => playSfx(GAME_SFX.twodice.claim), 220);
      }
      setClaimed(next);
      setRollCount(rollCount + 1);
      if (line) {
        setResult({ leaders: [rollingTeam], bingo: true });
        setWinLine(line);
      } else if (owners.length === size * size || (turnLimit !== null && rollCount + 1 >= turnLimit)) {
        const counts = teams.map(team => owners.filter(owner => owner === team).length);
        setResult({ leaders: teams.filter((_, i) => counts[i] === Math.max(...counts)), bingo: false });
      } else {
        setTurn(nextTeam);
      }
      rollingRef.current = false;
      setRolling(false);
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 80 : DICE_ROLL_MS);
  }

  useStepSounds(0, result?.bingo === true, undefined, GAME_SFX.twodice.bingo);

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
  const owners = Object.values(claimed);
  const score = (team: Team) => (
    <div key={team} className={`td-score td-score-${team}`}><span>{teamLabel(team)}</span><b>{owners.filter(owner => owner === team).length}</b></div>
  );
  const resultNames = result?.leaders.map(teamLabel).join(' · ');
  const status = result
    ? result.bingo ? (solo ? t('gameTwoDice.soloBingo') : t('gameTwoDice.bingoMessage', { team: resultNames }))
      : t(result.leaders.length > 1 ? 'gameTwoDice.tied' : 'gameTwoDice.mostCells', { team: resultNames })
    : solo ? t('gameTwoDice.soloGoal') : t('gameTwoDice.turnLabel', { team: teamLabel(turn) });

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
      <section className={`td-scoreboard td-scoreboard-${teamCount}`} data-turn-display aria-label={t('turnDisplay.region')}>
        {teamCount === 2 ? score('blue') : teams.map(score)}
        <span data-turn-current hidden>{teamLabel(turn)}</span>
        <span data-turn-next hidden>{teamLabel(nextTeam)}</span>
        <div className={`td-turn td-turn-${result?.leaders.length === 1 ? result.leaders[0] : turn}`} role="status">
          {status}
          {!result && turnLimit !== null && <small className="td-rolls-left">{t('gameTwoDice.rollsLeft', { count: turnLimit - rollCount })}</small>}
        </div>
        {teamCount === 2 && score('red')}
      </section>

      <div className="td-layout">
        <div className="td-board" data-skin-stage="board">
          <table aria-label={t('gameTwoDice.boardLabel', { size })}>
            <colgroup><col className="td-axis-col" /><col span={size} /></colgroup>
            <thead>
              <tr>
                <td />
                {Array.from({ length: size }, (_, c) => (
                  <th key={c} scope="col" className={!rolling && die2 === c + 1 ? 'td-active-col' : undefined}>{c + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: size }, (_, r) => (
                <tr key={r} className={!rolling && die1 === r + 1 ? 'td-active-row' : undefined}>
                  <th scope="row">{r + 1}</th>
                  {board.slice(r * size, (r + 1) * size).map((item, c) => {
                    const i = r * size + c;
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
            <button type="button" onClick={roll} disabled={rolling || !!result} className="td-roll">
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
        <button type="button" onClick={() => setReshuffleOpen(true)} className="td-roll td-reset">
          {result ? t('gameTwoDice.playAgainButton') : t('gameTwoDice.reshuffleButton')}
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
