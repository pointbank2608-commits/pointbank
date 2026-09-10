import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
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

type Phase = 'grid' | 'cracking' | 'open' | 'picking' | 'reveal';

const CRACK_MS = 1250;

const CRACK_BITS: { dx: number; dy: number; size: number; delay: number }[] = [
  { dx: -108, dy: -58, size: 16, delay: 0.26 },
  { dx: 96, dy: -64, size: 13, delay: 0.28 },
  { dx: -72, dy: 70, size: 15, delay: 0.3 },
  { dx: 118, dy: 42, size: 12, delay: 0.27 },
  { dx: -132, dy: 8, size: 11, delay: 0.32 },
  { dx: 64, dy: 88, size: 14, delay: 0.29 },
  { dx: 8, dy: -96, size: 10, delay: 0.31 },
  { dx: -28, dy: 102, size: 12, delay: 0.33 },
];

function formatReward(r: SaveOrGiveReward, t: (key: string) => string): string {
  if (r.kind === 'swap') return t('gameSaveOrGive.swapReward');
  const v = r.value ?? 0;
  return v > 0 ? `+${v}` : `${v}`;
}

const BALL_SRC = '/skins/sog-ball.png?v=5';
const SCORE_SRC = '/skins/sog-score.png?v=2';
const BOARD_SRC = '/skins/sog-board.png?v=3';
const SAVE_SRC = '/skins/gift-save.png';
const GIVE_SRC = '/skins/gift-give.png';

const SCORE_TEXT = { left: '9%', top: '14%', width: '82%', height: '72%' };
const BOARD_TEXT = { left: '10%', top: '16%', width: '80%', height: '68%' };

function NumberBall({
  n,
  color,
  used,
  size,
  onClick,
  disabled,
  label,
}: {
  n: string | number;
  color: string;
  used?: boolean;
  size: number;
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const inner = (
    <>
      <span
        className={`sog-clay-ball ${used ? 'is-used' : ''}`}
        style={{ '--sog-ball-color': used ? '#c9c3b8' : color } as CSSProperties}
      >
        <img src={BALL_SRC} alt="" draggable={false} className="sog-clay-ball-tex select-none" />
      </span>
      <span className="sog-clay-ball-num font-title-md" style={{ fontSize: Math.max(16, size * 0.38) }}>
        {used ? '✓' : n}
      </span>
    </>
  );

  const boxStyle = { width: size, height: size };

  if (!onClick) {
    return (
      <div className="relative shrink-0" style={boxStyle}>
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="relative shrink-0 transition-transform enabled:hover:scale-110 disabled:cursor-default"
      style={boxStyle}
    >
      {inner}
    </button>
  );
}

function ScorePlaque({
  color,
  label,
  score,
  current,
}: {
  color: string;
  label: string;
  score: number;
  current?: boolean;
}) {
  return (
    <div
      data-skin-object="score-card"
      className={`relative h-[168px] w-[350px] max-w-[46vw] transition-transform ${current ? 'scale-105' : ''}`}
      style={{ filter: 'drop-shadow(0 12px 16px rgba(90, 50, 18, 0.24))' }}
    >
      <img
        src={SCORE_SRC}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
      />
      <div className="absolute z-10 flex items-center gap-4 px-4" style={SCORE_TEXT}>
        <span
          className="h-11 w-11 shrink-0 rounded-full"
          style={{
            background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.75), ${color} 52%, rgba(0,0,0,0.18) 100%)`,
            boxShadow: '0 3px 6px rgba(90,50,18,0.28), inset 1px 1px 3px rgba(255,255,255,0.5)',
          }}
        />
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate font-caption text-[20px] font-bold leading-tight text-[#6a5640]">{label}</div>
          <div className="font-title-md text-[56px] font-bold tabular-nums leading-none text-[#2a241c]">{score}</div>
        </div>
      </div>
    </div>
  );
}

function CrackingBall({ n, color }: { n: number; color: string }) {
  return (
    <div className="sog-crack-overlay" aria-hidden>
      <div className="sog-crack-half is-left">
        <NumberBall n={n} color={color} size={200} />
      </div>
      <div className="sog-crack-half is-right">
        <NumberBall n={n} color={color} size={200} />
      </div>
      <span className="sog-crack-line" />
      {CRACK_BITS.map((bit, i) => (
        <span
          key={i}
          className="sog-crack-bit"
          style={
            {
              '--sog-ball-color': color,
              '--dx': `${bit.dx}px`,
              '--dy': `${bit.dy}px`,
              '--bit-size': `${bit.size}px`,
              animationDelay: `${bit.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function BoardFace({ children }: { children: ReactNode }) {
  return (
    <>
      <img
        src={BOARD_SRC}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
      />
      <div className="absolute z-10 flex items-center justify-center px-3 text-center" style={BOARD_TEXT}>
        {children}
      </div>
    </>
  );
}

/**
 * 등록한 단어·문장 개수만큼 번호 공이 늘어서 있다 — 아무 공이나 눌러서 여는 방식(무작위
 * 자동 추첨 아님). 연 공에서 보드가 튀어나와 단어·문장이 보이고, 맞혔으면 "정답 처리"를
 * 눌러 Save it/Give it 선택지를 연다(틀렸으면 "다음 항목"으로 보상 없이 넘어간다).
 * Save it/Give it을 고르면 무작위 보상(+점수/-점수/0/점수 교환)이 정해져서 반영된다.
 * 한 번 연 공은 다시 안 나온다 — 다 열면 "다시 시작"으로 새 라운드를 연다. 참가자가
 * 3명(팀) 이상이면 "주기"나 "교환" 보상이 나왔을 때 누구에게 적용할지 그 자리에서 직접
 * 고른다(2명뿐이면 자동으로 상대가 정해짐).
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
  const [phase, setPhase] = useState<Phase>('grid');
  const [turnIndex, setTurnIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [answeredCorrect, setAnsweredCorrect] = useState(false);
  const [lastReward, setLastReward] = useState<SaveOrGiveReward | null>(null);
  const [appliedPlayerId, setAppliedPlayerId] = useState<string | null>(null);
  const [pendingReward, setPendingReward] = useState<SaveOrGiveReward | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');

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

  const canPlay = players.length >= 2;
  const remainingItems = items.filter((i) => !usedIds.has(i.id));
  const currentItem = items.find((i) => i.id === currentItemId) ?? null;
  const currentItemIndex = items.findIndex((i) => i.id === currentItemId);
  const currentPlayer = players[turnIndex % Math.max(players.length, 1)];
  const allUsed = remainingItems.length === 0;

  function otherPlayerId(excludeId: string): string {
    return players.find((p) => p.id !== excludeId)?.id ?? excludeId;
  }

  function openItem(id: string) {
    if (phase !== 'grid' || usedIds.has(id)) return;
    setCurrentItemId(id);
    setAnsweredCorrect(false);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPhase(reduceMotion ? 'open' : 'cracking');
  }

  useEffect(() => {
    if (phase !== 'cracking') return;
    const timer = window.setTimeout(() => setPhase('open'), CRACK_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function markCorrect() {
    if (phase !== 'open') return;
    setAnsweredCorrect(true);
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
    if (phase !== 'open' || !answeredCorrect || rewardPool.length === 0) return;
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

  /** 보상 없이 다음 항목으로: 오답이었을 때("다음 항목") 쓴다. */
  function skipItem() {
    if (phase !== 'open') return;
    goToNextRound();
  }

  function goToNextRound() {
    setLastReward(null);
    setAppliedPlayerId(null);
    setAnsweredCorrect(false);
    if (currentItemId) setUsedIds((prev) => new Set(prev).add(currentItemId));
    setCurrentItemId(null);
    setTurnIndex((i) => (i + 1) % Math.max(players.length, 1));
    setPhase('grid');
  }

  function resetAll() {
    setPhase('grid');
    setTurnIndex(0);
    setScores(Object.fromEntries(players.map((p) => [p.id, 0])));
    setUsedIds(new Set());
    setCurrentItemId(null);
    setAnsweredCorrect(false);
    setLastReward(null);
    setAppliedPlayerId(null);
    setPendingReward(null);
  }

  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';
  const placeholderBall = (
    <div className="mx-auto mb-3 w-fit">
      <NumberBall n="?" color="#f2a154" size={80} />
    </div>
  );

  if (!canPlay) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        {placeholderBall}
        <div className="font-body-md text-body-md">{t('gameSaveOrGive.needParticipants')}</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        {placeholderBall}
        <div className="font-body-md text-body-md">{t('gameSaveOrGive.needItems')}</div>
      </div>
    );
  }

  const appliedPlayer = players.find((p) => p.id === appliedPlayerId) ?? null;
  const sidePanelVisible = !!editable && !itemsHidden;
  const ballSize = items.length > 20 ? 72 : items.length > 12 ? 88 : items.length > 6 ? 104 : 120;

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div
        className={`flex w-full flex-col items-center gap-6 ${editable ? 'md:flex-row md:items-start md:justify-center' : ''}`}
      >
        <div className={`flex flex-col items-center ${sidePanelVisible ? '' : 'w-full'}`}>
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

          <div className="mb-4 flex flex-wrap justify-center gap-2.5">
            {players.map((p) => (
              <ScorePlaque
                key={p.id}
                color={p.color}
                label={p.label}
                score={scores[p.id] ?? 0}
                current={phase !== 'reveal' && phase !== 'cracking' && p.id === currentPlayer.id}
              />
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

          {phase === 'grid' &&
            (allUsed ? (
              <div className="flex flex-col items-center gap-3 py-6">
                {placeholderBall}
                <div className="font-body-md text-body-md text-on-surface-variant">{t('gameSaveOrGive.allUsedMessage')}</div>
                <button onClick={resetAll} className={pill}>
                  {t('gameSaveOrGive.resetButton')}
                </button>
              </div>
            ) : (
              <div className="mb-2 flex max-w-[min(560px,94vw)] flex-wrap justify-center gap-2.5 py-2">
                {items.map((item, i) => {
                  const used = usedIds.has(item.id);
                  return (
                    <NumberBall
                      key={item.id}
                      n={i + 1}
                      color={colorFor(i)}
                      used={used}
                      size={ballSize}
                      disabled={used}
                      onClick={() => openItem(item.id)}
                      label={t('gameSaveOrGive.openBallLabel', { n: i + 1 })}
                    />
                  );
                })}
              </div>
            ))}

          {(phase === 'cracking' || phase === 'open' || phase === 'picking' || phase === 'reveal') &&
            currentItem && (
            <>
              <div className="relative mb-5 mt-5 overflow-visible">
                {phase !== 'cracking' && (
                  <div className="absolute -top-5 left-1/2 z-30 -translate-x-1/2">
                    <NumberBall n={currentItemIndex + 1} color={colorFor(Math.max(currentItemIndex, 0))} size={44} />
                  </div>
                )}
                <div className={`sog-flip-scene ${phase === 'cracking' ? 'sog-board-emerge' : ''}`}>
                  <div className={`sog-flip-card ${phase === 'reveal' ? 'is-flipped' : ''}`}>
                    <div className="sog-flip-face">
                      <BoardFace>
                        <GameFitText text={currentItem.label} maxSize={48} className="font-bold text-[#2a241c]" />
                      </BoardFace>
                    </div>
                    <div className="sog-flip-face sog-flip-back">
                      <BoardFace>
                        {lastReward?.kind === 'swap' ? (
                          <div className="font-title-md text-[28px] font-bold leading-snug text-[#2a241c]">
                            {t('gameSaveOrGive.swapMessage', { a: currentPlayer.label, b: appliedPlayer?.label ?? '' })}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="font-caption text-[20px] font-bold text-[#6a5640]">
                              {appliedPlayer?.label ?? ''}
                            </div>
                            <div className="font-title-md text-[64px] font-bold tabular-nums leading-none text-[#2a241c]">
                              {lastReward ? formatReward(lastReward, t) : ''}
                            </div>
                          </div>
                        )}
                      </BoardFace>
                    </div>
                  </div>
                </div>
                {phase === 'cracking' && (
                  <CrackingBall n={currentItemIndex + 1} color={colorFor(Math.max(currentItemIndex, 0))} />
                )}
              </div>

              {phase === 'open' && !answeredCorrect && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={markCorrect}
                    className="rounded-full bg-primary px-8 py-3 font-title-md text-title-md text-on-primary shadow-sm transition-colors hover:bg-primary-container"
                  >
                    {t('gameSaveOrGive.correctButton')}
                  </button>
                  <button
                    type="button"
                    onClick={skipItem}
                    className="rounded-full bg-surface-container px-8 py-3 font-title-md text-title-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
                  >
                    {t('gameSaveOrGive.skipButton')}
                  </button>
                </div>
              )}

              {phase === 'open' && answeredCorrect && (
                <>
                  <div className="mb-4 font-body-md text-body-md text-on-surface-variant">{t('gameSaveOrGive.chooseAfterRead')}</div>
                  <div className="flex w-full max-w-[460px] items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={() => choose('save')}
                      aria-label={t('gameSaveOrGive.saveButton')}
                      className="transition-transform hover:scale-105"
                    >
                      <img
                        src={SAVE_SRC}
                        alt=""
                        draggable={false}
                        className="h-[72px] w-auto select-none"
                        style={{ filter: 'drop-shadow(0 8px 10px rgba(90, 50, 18, 0.24))' }}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => choose('give')}
                      aria-label={t('gameSaveOrGive.giveButton')}
                      className="transition-transform hover:scale-105"
                    >
                      <img
                        src={GIVE_SRC}
                        alt=""
                        draggable={false}
                        className="h-[72px] w-auto select-none"
                        style={{ filter: 'drop-shadow(0 8px 10px rgba(90, 50, 18, 0.24))' }}
                      />
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

              {phase === 'reveal' && (
                <button onClick={goToNextRound} className={pill}>
                  {t('gameSaveOrGive.nextRoundButton')}
                </button>
              )}
            </>
          )}

          {phase === 'grid' && !allUsed && (
            <button
              onClick={resetAll}
              className="mt-5 font-caption text-caption text-on-surface-variant transition-colors hover:text-error"
            >
              {t('gameSaveOrGive.resetButton')}
            </button>
          )}
        </div>

        {sidePanelVisible && (
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
