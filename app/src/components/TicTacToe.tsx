import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import { useGamePlay } from './GameThemeFrame';
import { playMusic } from '../lib/gameMusic';
import { colorFor } from '../lib/wheel';
import type { GameItem, MusicSelection, UndoHandle } from '../lib/types';

interface Props {
  items: GameItem[];
  /** true면 오른쪽에 항목 개수 조절 + 이름 수정 목록 패널을 보여준다(선생님용 실제 플레이 화면에서만). */
  editable?: boolean;
  onEditItem?: (id: string, label: string) => void;
  /** 상단 이름 표시/수정 + 항목 개수 +/- 툴바. GameThemeFrame 안(전체화면 포함)에서도
   * 보이도록 TicTacToe 자체에 둔다. */
  templateName?: string;
  onRenameTemplate?: (name: string) => void;
  onAddItem?: () => void;
  onRemoveItem?: () => void;
  /** 칸에 말을 놓을 때마다 울리는 효과음. */
  placeSound?: MusicSelection | null;
}

type Team = 'blue' | 'red';
type Mark = Team | null;

const BOARD_SRC = '/skins/tic-board.png';
const O_SRC = '/skins/tic-o.png';
const X_SRC = '/skins/tic-x.png';

/** 스킨 이미지에서 측정한 9칸. 값은 이미지 너비/높이 대비 비율. */
const CELLS = [
  { left: 0.091, top: 0.093, width: 0.255, height: 0.248 },
  { left: 0.38, top: 0.093, width: 0.246, height: 0.248 },
  { left: 0.661, top: 0.093, width: 0.256, height: 0.248 },
  { left: 0.091, top: 0.38, width: 0.255, height: 0.244 },
  { left: 0.381, top: 0.38, width: 0.245, height: 0.244 },
  { left: 0.662, top: 0.38, width: 0.255, height: 0.244 },
  { left: 0.092, top: 0.664, width: 0.254, height: 0.248 },
  { left: 0.381, top: 0.664, width: 0.245, height: 0.248 },
  { left: 0.662, top: 0.664, width: 0.255, height: 0.248 },
] as const;

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** 항목이 9개보다 많으면 무작위 9개만, 적으면 부족한 만큼 반복해서 판을 채운다. */
function pickBoardItems(items: GameItem[]): GameItem[] {
  if (items.length === 0) return [];
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({ length: 9 }, (_, i) => pool[i % pool.length]);
}

function checkWinner(marks: Mark[]): Team | null {
  for (const [a, b, c] of LINES) {
    if (marks[a] && marks[a] === marks[b] && marks[b] === marks[c]) return marks[a];
  }
  return null;
}

/**
 * 틱택토. 등록한 단어를 3×3 나무 판에 올려 두고, 두 팀이 번갈아 칸을 차지한다.
 */
const TicTacToe = forwardRef<UndoHandle, Props>(function TicTacToe(
  { items, editable, onEditItem, templateName, onRenameTemplate, onAddItem, onRemoveItem, placeSound },
  ref,
) {
  const { t } = useTranslation();
  const { itemsHidden } = useGamePlay();
  const [board, setBoard] = useState<GameItem[]>(() => pickBoardItems(items));
  const [marks, setMarks] = useState<Mark[]>(() => Array(9).fill(null));
  const [turn, setTurn] = useState<Team>('blue');
  const [prevSnapshot, setPrevSnapshot] = useState<{ marks: Mark[]; turn: Team } | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const winner = checkWinner(marks);
  const isDraw = !winner && marks.every((m) => m !== null);

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

  function newRound() {
    setBoard(pickBoardItems(items));
    setMarks(Array(9).fill(null));
    setTurn('blue');
    setPrevSnapshot(null);
  }

  function claim(index: number) {
    if (winner || isDraw || marks[index]) return;
    setPrevSnapshot({ marks, turn });
    const next = [...marks];
    next[index] = turn;
    setMarks(next);
    setTurn(turn === 'blue' ? 'red' : 'blue');
    playMusic(placeSound);
  }

  useImperativeHandle(ref, () => ({
    undo() {
      if (!prevSnapshot) return;
      setMarks(prevSnapshot.marks);
      setTurn(prevSnapshot.turn);
      setPrevSnapshot(null);
    },
  }));

  const teamLabel = (team: Team) => (team === 'blue' ? t('gameTicTacToe.teamBlue') : t('gameTicTacToe.teamRed'));
  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={BOARD_SRC} alt="" className="mx-auto mb-3 h-20 w-auto" />
        <div className="font-body-md text-body-md">{t('gameTicTacToe.needParticipants')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div
        className={`flex flex-col items-center gap-6 ${editable ? 'md:flex-row md:items-start md:justify-center' : ''}`}
      >
        <div className="flex flex-col items-center">
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

      {!winner && !isDraw && (
        <div
          className={`mb-4 rounded-full px-6 py-2.5 font-title-md text-title-md shadow-sm transition-colors ${
            turn === 'blue' ? 'bg-secondary text-on-secondary' : 'text-white'
          }`}
          style={turn === 'red' ? { backgroundColor: '#f28b73' } : undefined}
        >
          {t('gameTicTacToe.turnLabel', { team: teamLabel(turn) })}
        </div>
      )}

      {(winner || isDraw) && (
        <div className="mb-4 flex flex-col items-center gap-3">
          {winner ? (
            <div
              className="result-pop rounded-2xl px-9 py-4 text-center"
              style={{
                backgroundColor: winner === 'blue' ? '#3dbea8' : '#f28b73',
                border: '3px solid #f0d7a8',
                boxShadow: '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)',
              }}
            >
              <div className="font-title-md text-[22px] font-bold text-white">
                {t('gameTicTacToe.winMessage', { team: teamLabel(winner) })}
              </div>
            </div>
          ) : (
            <div className="rounded-full bg-[#f3eee4] px-6 py-2.5 font-title-md text-title-md text-on-surface">
              {t('gameTicTacToe.drawMessage')}
            </div>
          )}
          <button onClick={newRound} className={pill}>
            {t('gameTicTacToe.playAgainButton')}
          </button>
        </div>
      )}

      <div
        data-skin-stage="board"
        className="relative mb-3 w-[min(420px,92vw)]"
        style={{ filter: 'drop-shadow(0 10px 14px rgba(90, 50, 18, 0.28))' }}
      >
        <img src={BOARD_SRC} alt="" draggable={false} className="pointer-events-none w-full select-none" />
        {board.map((item, i) => {
          const mark = marks[i];
          const cell = CELLS[i];
          return (
            <button
              key={item.id + String(i)}
              type="button"
              onClick={() => claim(i)}
              disabled={!!mark || !!winner || isDraw}
              data-skin-object="cell"
              className={`absolute flex flex-col items-center justify-center px-1.5 text-center transition-transform ${
                mark || winner || isDraw ? 'cursor-default' : 'cursor-pointer hover:scale-[1.03]'
              }`}
              style={{
                left: `${cell.left * 100}%`,
                top: `${cell.top * 100}%`,
                width: `${cell.width * 100}%`,
                height: `${cell.height * 100}%`,
              }}
            >
              {mark ? (
                <>
                  <img
                    src={mark === 'blue' ? O_SRC : X_SRC}
                    alt=""
                    draggable={false}
                    className="pointer-events-none h-[58%] w-[58%] select-none object-contain"
                  />
                  <span className="mt-0.5 h-[34%] w-full min-h-0">
                    <GameFitText text={item.label} />
                  </span>
                </>
              ) : (
                <span className="h-[86%] w-full min-h-0">
                  <GameFitText text={item.label} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!winner && !isDraw && (
        <div className="mt-1 font-caption text-caption text-on-surface-variant">{t('gameTicTacToe.boardHint')}</div>
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
});

export default TicTacToe;
