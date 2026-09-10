import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import { useGamePlay } from './GameThemeFrame';
import { colorFor } from '../lib/wheel';
import type { GameItem, SaveOrGiveReward } from '../lib/types';

export interface SaveOrGivePlayer {
  id: string;
  label: string;
  color: string;
}

interface Props {
  items: GameItem[];
  rewardPool: SaveOrGiveReward[];
  /** 개인전이면 학생 각자, 팀전이면 팀들. 최소 2명(팀) 있어야 플레이할 수 있다. */
  players: SaveOrGivePlayer[];
  /** true면 오른쪽에 항목 개수 조절 + 이름 수정 목록 패널을 보여준다(선생님용 실제 플레이 화면에서만). */
  editable?: boolean;
  onEditItem?: (id: string, label: string) => void;
  /** 상단 이름 표시/수정 + 항목 개수 +/- 툴바. GameThemeFrame 안(전체화면 포함)에서도
   * 보이도록 SaveOrGiveIt 자체에 둔다. */
  templateName?: string;
  onRenameTemplate?: (name: string) => void;
  onAddItem?: () => void;
  onRemoveItem?: () => void;
}

type Phase = 'closed' | 'opening' | 'open' | 'picking' | 'reveal';

const CLOSED_SRC = '/skins/gift-closed.png';
const OPEN_SRC = '/skins/gift-open.png';
const SAVE_SRC = '/skins/gift-save.png';
const GIVE_SRC = '/skins/gift-give.png';
/** 열린 상자 스킨에서 측정한 단어 보드. 값은 이미지 너비/높이 대비 비율. */
const WORD_BOARD = { left: 0.175, top: 0.295, width: 0.65, height: 0.26 };
const OPEN_MS = 520;

function formatReward(r: SaveOrGiveReward, t: (key: string) => string): string {
  if (r.kind === 'swap') return t('gameSaveOrGive.swapReward');
  const v = r.value ?? 0;
  return v > 0 ? `+${v}` : `${v}`;
}

/**
 * 상자를 열면 항목(단어·상품) 하나가 보이고, "간직하기"/"주기"를 고르면 무작위 보상이
 * 정해져서 점수에 반영된다. 한 번 나온 항목은 다시 안 나온다(교체 없이 소비) — 다 쓰면
 * "다시 시작"으로 새 라운드를 연다. 참가자가 3명(팀) 이상이면 "주기"나 "교환" 보상이
 * 나왔을 때 누구에게 적용할지 그 자리에서 직접 고른다(2명뿐이면 자동으로 상대가 정해짐).
 */
export default function SaveOrGiveIt({
  items,
  rewardPool,
  players,
  editable,
  onEditItem,
  templateName,
  onRenameTemplate,
  onAddItem,
  onRemoveItem,
}: Props) {
  const { t } = useTranslation();
  const { itemsHidden } = useGamePlay();
  const [phase, setPhase] = useState<Phase>('closed');
  const [turnIndex, setTurnIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [lastReward, setLastReward] = useState<SaveOrGiveReward | null>(null);
  const [appliedPlayerId, setAppliedPlayerId] = useState<string | null>(null);
  const [pendingReward, setPendingReward] = useState<SaveOrGiveReward | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setItemDrafts(Object.fromEntries(items.map((i) => [i.id, i.label])));
  }, [items]);

  // players 는 부모가 개인전/팀전 설정에서 매 렌더마다 새로 만들어 내려줄 수 있어 참조가
  // 자주 바뀐다. id 구성이 실제로 바뀌었을 때만(모드 전환, 팀 수 변경, 참가자 추가/삭제)
  // 점수판을 초기화한다 — 매 렌더마다 초기화하면 점수가 계속 0으로 리셋되는 버그가 생긴다.
  const playerKey = players.map((p) => p.id).join('|');
  useEffect(() => {
    setScores(Object.fromEntries(players.map((p) => [p.id, 0])));
    setTurnIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerKey]);

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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const canPlay = players.length >= 2;
  const remainingItems = items.filter((i) => !usedIds.has(i.id));
  const currentItem = items.find((i) => i.id === currentItemId) ?? null;
  const currentPlayer = players[turnIndex % Math.max(players.length, 1)];

  function otherPlayerId(excludeId: string): string {
    return players.find((p) => p.id !== excludeId)?.id ?? excludeId;
  }

  function openBox() {
    if (phase !== 'closed' || remainingItems.length === 0) return;
    const pick = remainingItems[Math.floor(Math.random() * remainingItems.length)];
    setCurrentItemId(pick.id);
    setPhase('opening');
    timerRef.current = setTimeout(() => setPhase('open'), OPEN_MS);
  }

  function applyReward(reward: SaveOrGiveReward, targetId: string) {
    setLastReward(reward);
    setAppliedPlayerId(targetId);
    if (reward.kind === 'swap') {
      const selfId = currentPlayer.id;
      setScores((prev) => {
        const next = { ...prev };
        const tmp = next[selfId] ?? 0;
        next[selfId] = next[targetId] ?? 0;
        next[targetId] = tmp;
        return next;
      });
    } else {
      setScores((prev) => ({ ...prev, [targetId]: (prev[targetId] ?? 0) + (reward.value ?? 0) }));
    }
    setPhase('reveal');
  }

  function choose(choice: 'save' | 'give') {
    if (phase !== 'open' || rewardPool.length === 0) return;
    const reward = rewardPool[Math.floor(Math.random() * rewardPool.length)];
    const needsOtherTarget = reward.kind === 'swap' || choice === 'give';
    if (!needsOtherTarget) {
      applyReward(reward, currentPlayer.id);
      return;
    }
    if (players.length <= 2) {
      applyReward(reward, otherPlayerId(currentPlayer.id));
      return;
    }
    setPendingReward(reward);
    setPhase('picking');
  }

  function pickTarget(targetId: string) {
    if (phase !== 'picking' || !pendingReward) return;
    applyReward(pendingReward, targetId);
    setPendingReward(null);
  }

  function nextRound() {
    setLastReward(null);
    setAppliedPlayerId(null);
    if (currentItemId) setUsedIds((prev) => new Set(prev).add(currentItemId));
    setCurrentItemId(null);
    setTurnIndex((i) => (i + 1) % Math.max(players.length, 1));
    setPhase('closed');
  }

  function resetAll() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase('closed');
    setTurnIndex(0);
    setScores(Object.fromEntries(players.map((p) => [p.id, 0])));
    setUsedIds(new Set());
    setCurrentItemId(null);
    setLastReward(null);
    setAppliedPlayerId(null);
    setPendingReward(null);
  }

  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  if (!canPlay) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={CLOSED_SRC} alt="" className="mx-auto mb-3 h-20 w-auto" />
        <div className="font-body-md text-body-md">{t('gameSaveOrGive.needParticipants')}</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={CLOSED_SRC} alt="" className="mx-auto mb-3 h-20 w-auto" />
        <div className="font-body-md text-body-md">{t('gameSaveOrGive.needItems')}</div>
      </div>
    );
  }

  const appliedPlayer = players.find((p) => p.id === appliedPlayerId) ?? null;
  const boxVisible = phase === 'open' || phase === 'picking' || phase === 'reveal';
  const allUsed = remainingItems.length === 0;

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

      <div className="mb-4 flex flex-wrap justify-center gap-3">
        {players.map((p) => (
          <div
            key={p.id}
            data-skin-object="score-card"
            className="min-w-[108px] rounded-2xl px-5 py-2.5 text-center"
            style={{
              backgroundColor: p.color,
              border: '3px solid #f0d7a8',
              boxShadow: '0 3px 0 #c4925c, 0 6px 12px rgba(110,62,18,0.12)',
            }}
          >
            <div className="font-caption text-caption font-bold text-white/90 truncate max-w-[140px]">{p.label}</div>
            <div className="font-title-md text-[22px] tabular-nums text-white">{scores[p.id] ?? 0}</div>
          </div>
        ))}
      </div>

      {phase !== 'reveal' && (
        <div
          className="mb-3 rounded-full px-6 py-2 font-label-md text-label-md text-white shadow-sm"
          style={{ backgroundColor: currentPlayer.color }}
        >
          {t('gameSaveOrGive.turnLabel', { team: currentPlayer.label })}
        </div>
      )}

      {phase === 'closed' && allUsed ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <img src={CLOSED_SRC} alt="" className="h-20 w-auto opacity-50" />
          <div className="font-body-md text-body-md text-on-surface-variant">{t('gameSaveOrGive.allUsedMessage')}</div>
          <button onClick={resetAll} className={pill}>
            {t('gameSaveOrGive.resetButton')}
          </button>
        </div>
      ) : (
        (phase === 'closed' || phase === 'opening') && (
          <>
            <button
              type="button"
              onClick={openBox}
              disabled={phase === 'opening'}
              aria-label={t('gameSaveOrGive.openBoxButton')}
              className={`relative mb-3 w-[min(280px,78vw)] bg-transparent p-0 ${
                phase === 'opening' ? 'lottery-box-shake' : ''
              }`}
              style={phase === 'closed' ? { filter: 'drop-shadow(0 10px 14px rgba(90, 50, 18, 0.28))' } : undefined}
            >
              <img src={CLOSED_SRC} alt="" draggable={false} className="pointer-events-none w-full select-none" />
            </button>
            <div className="mb-1 font-caption text-caption text-on-surface-variant">{t('gameSaveOrGive.openHint')}</div>
          </>
        )
      )}

      {boxVisible && (
        <div
          data-skin-object="gift-box"
          className={`relative mb-3 w-[min(250px,72vw)] ${phase === 'open' ? 'gift-lid-pop' : ''}`}
          style={{ filter: 'drop-shadow(0 10px 14px rgba(90, 50, 18, 0.28))' }}
        >
          <img src={OPEN_SRC} alt="" draggable={false} className="pointer-events-none w-full select-none" />
          <div
            className="absolute flex items-center justify-center px-2 text-center"
            style={{
              left: `${WORD_BOARD.left * 100}%`,
              top: `${WORD_BOARD.top * 100}%`,
              width: `${WORD_BOARD.width * 100}%`,
              height: `${WORD_BOARD.height * 100}%`,
            }}
          >
            <span className="block h-full w-full min-h-0">
              <GameFitText text={currentItem?.label ?? ''} />
            </span>
          </div>
        </div>
      )}

      {phase === 'open' && (
        <>
          <div className="mb-4 font-body-md text-body-md text-on-surface-variant">{t('gameSaveOrGive.chooseAfterRead')}</div>
          <div className="flex w-full max-w-[420px] items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => choose('save')}
              aria-label={t('gameSaveOrGive.saveButton')}
              className="h-[72px] w-[min(190px,44vw)] bg-transparent p-0 transition-[filter] hover:brightness-105 active:brightness-95"
              style={{ filter: 'drop-shadow(0 6px 10px rgba(90, 50, 18, 0.22))' }}
            >
              <img src={SAVE_SRC} alt="" draggable={false} className="pointer-events-none h-full w-full select-none object-contain" />
            </button>
            <button
              type="button"
              onClick={() => choose('give')}
              aria-label={t('gameSaveOrGive.giveButton')}
              className="h-[72px] w-[min(190px,44vw)] bg-transparent p-0 transition-[filter] hover:brightness-105 active:brightness-95"
              style={{ filter: 'drop-shadow(0 6px 10px rgba(90, 50, 18, 0.22))' }}
            >
              <img src={GIVE_SRC} alt="" draggable={false} className="pointer-events-none h-full w-full select-none object-contain" />
            </button>
          </div>
        </>
      )}

      {phase === 'picking' && (
        <div className="flex flex-col items-center gap-3">
          <div className="font-body-md text-body-md text-on-surface-variant">{t('gameSaveOrGive.pickTargetHint')}</div>
          <div className="flex flex-wrap justify-center gap-2.5">
            {players
              .filter((p) => p.id !== currentPlayer.id)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickTarget(p.id)}
                  className="rounded-full px-5 py-2.5 font-label-md text-label-md text-white shadow-sm transition-transform hover:scale-105"
                  style={{ backgroundColor: p.color }}
                >
                  {p.label}
                </button>
              ))}
          </div>
        </div>
      )}

      {phase === 'reveal' && lastReward && (
        <div className="result-pop mt-1 flex flex-col items-center gap-4">
          <div
            className="rounded-2xl px-9 py-4 text-center"
            style={{
              backgroundColor: appliedPlayer?.color ?? '#f28b73',
              border: '3px solid #f0d7a8',
              boxShadow: '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)',
            }}
          >
            {lastReward.kind === 'swap' ? (
              <div className="font-title-md text-[22px] font-bold text-white">
                {t('gameSaveOrGive.swapMessage', { a: currentPlayer.label, b: appliedPlayer?.label ?? '' })}
              </div>
            ) : (
              <div className="font-title-md text-[22px] font-bold text-white">
                {t('gameSaveOrGive.rewardResultLabel', {
                  team: appliedPlayer?.label ?? '',
                  reward: formatReward(lastReward, t),
                })}
              </div>
            )}
          </div>
          <button onClick={nextRound} className={pill}>
            {t('gameSaveOrGive.nextRoundButton')}
          </button>
        </div>
      )}

      {phase === 'closed' && !allUsed && (
        <button
          onClick={resetAll}
          className="mt-5 font-caption text-caption text-on-surface-variant transition-colors hover:text-error"
        >
          {t('gameSaveOrGive.resetButton')}
        </button>
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
