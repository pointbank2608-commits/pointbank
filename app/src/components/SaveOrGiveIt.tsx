import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import { colorFor } from '../lib/wheel';
import type { GameItem, SaveOrGiveReward } from '../lib/types';

interface Props {
  items: GameItem[];
  rewardPool: SaveOrGiveReward[];
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

type Team = 'blue' | 'red';
type Phase = 'closed' | 'opening' | 'open' | 'reveal';

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

export default function SaveOrGiveIt({
  items,
  rewardPool,
  editable,
  onEditItem,
  templateName,
  onRenameTemplate,
  onAddItem,
  onRemoveItem,
}: Props) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('closed');
  const [turn, setTurn] = useState<Team>('blue');
  const [scores, setScores] = useState<Record<Team, number>>({ blue: 0, red: 0 });
  const [wordIndex, setWordIndex] = useState(0);
  const [lastReward, setLastReward] = useState<SaveOrGiveReward | null>(null);
  const [appliedTeam, setAppliedTeam] = useState<Team | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const opponent: Team = turn === 'blue' ? 'red' : 'blue';
  const currentItem = items[wordIndex % Math.max(items.length, 1)];

  function openBox() {
    if (phase !== 'closed') return;
    setPhase('opening');
    timerRef.current = setTimeout(() => setPhase('open'), OPEN_MS);
  }

  function choose(choice: 'save' | 'give') {
    if (phase !== 'open' || rewardPool.length === 0) return;
    const reward = rewardPool[Math.floor(Math.random() * rewardPool.length)];
    setLastReward(reward);
    if (reward.kind === 'swap') {
      setScores((prev) => ({ blue: prev.red, red: prev.blue }));
      setAppliedTeam(null);
    } else {
      const target = choice === 'save' ? turn : opponent;
      setAppliedTeam(target);
      setScores((prev) => ({ ...prev, [target]: prev[target] + (reward.value ?? 0) }));
    }
    setPhase('reveal');
  }

  function nextRound() {
    setLastReward(null);
    setAppliedTeam(null);
    setWordIndex((i) => i + 1);
    setTurn((tm) => (tm === 'blue' ? 'red' : 'blue'));
    setPhase('closed');
  }

  function resetAll() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase('closed');
    setTurn('blue');
    setScores({ blue: 0, red: 0 });
    setWordIndex(0);
    setLastReward(null);
    setAppliedTeam(null);
  }

  const teamLabel = (team: Team) => (team === 'blue' ? t('gameSaveOrGive.teamBlue') : t('gameSaveOrGive.teamRed'));
  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={CLOSED_SRC} alt="" className="mx-auto mb-3 h-20 w-auto" />
        <div className="font-body-md text-body-md">{t('gameSaveOrGive.needParticipants')}</div>
      </div>
    );
  }

  const scorePlaque = (team: Team) => (
    <div
      data-skin-object="score-card"
      className="min-w-[108px] rounded-2xl px-5 py-2.5 text-center"
      style={{
        backgroundColor: team === 'blue' ? '#3dbea8' : '#f28b73',
        border: '3px solid #f0d7a8',
        boxShadow: '0 3px 0 #c4925c, 0 6px 12px rgba(110,62,18,0.12)',
      }}
    >
      <div className="font-caption text-caption font-bold text-white/90">{teamLabel(team)}</div>
      <div className="font-title-md text-[22px] tabular-nums text-white">{scores[team]}</div>
    </div>
  );

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
          {editable && (
            <div className="mb-3 max-w-[420px] text-center font-caption text-caption text-on-surface-variant">
              {t('gameAdmin.editHintItems')}
            </div>
          )}

      <div className="mb-4 flex gap-3">
        {scorePlaque('blue')}
        {scorePlaque('red')}
      </div>

      {phase !== 'reveal' && (
        <div
          className={`mb-3 rounded-full px-6 py-2 font-label-md text-label-md shadow-sm ${
            turn === 'blue' ? 'bg-secondary text-on-secondary' : 'text-white'
          }`}
          style={turn === 'red' ? { backgroundColor: '#f28b73' } : undefined}
        >
          {t('gameSaveOrGive.turnLabel', { team: teamLabel(turn) })}
        </div>
      )}

      {(phase === 'closed' || phase === 'opening') && (
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
      )}

      {(phase === 'open' || phase === 'reveal') && (
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

      {phase === 'reveal' && lastReward && (
        <div className="result-pop mt-1 flex flex-col items-center gap-4">
          <div
            className="rounded-2xl px-9 py-4 text-center"
            style={{
              backgroundColor: '#f28b73',
              border: '3px solid #f0d7a8',
              boxShadow: '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)',
            }}
          >
            {lastReward.kind === 'swap' ? (
              <div className="font-title-md text-[22px] font-bold text-white">{t('gameSaveOrGive.swapMessage')}</div>
            ) : (
              <div className="font-title-md text-[22px] font-bold text-white">
                {t('gameSaveOrGive.rewardResultLabel', {
                  team: appliedTeam ? teamLabel(appliedTeam) : '',
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

      {phase === 'closed' && (
        <button
          onClick={resetAll}
          className="mt-5 font-caption text-caption text-on-surface-variant transition-colors hover:text-error"
        >
          {t('gameSaveOrGive.resetButton')}
        </button>
      )}
        </div>

        {editable && (
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
