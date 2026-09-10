import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { colorFor } from '../lib/wheel';
import GameFitText from './GameFitText';
import { useGamePlay } from './GameThemeFrame';
import type { GameItem } from '../lib/types';

export type RankOrderStyle = 'podium' | 'plates';

interface Props {
  items: GameItem[];
  boardStyle?: RankOrderStyle;
  /** true면 오른쪽에 항목 개수 조절 + 이름 수정 목록 패널을 보여준다(선생님용 실제 플레이 화면에서만). */
  editable?: boolean;
  onEditItem?: (id: string, label: string) => void;
  /** 상단 이름 표시/수정 + 항목 개수 +/- 툴바. GameThemeFrame 안(전체화면 포함)에서도
   * 보이도록 RankOrder 자체에 둔다 — 페이지 바깥에 두면 전체화면에서 안 보였다. */
  templateName?: string;
  onRenameTemplate?: (name: string) => void;
  onAddItem?: () => void;
  onRemoveItem?: () => void;
}

const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';
const pill =
  'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleUntilDifferent(items: GameItem[]): GameItem[] {
  if (items.length <= 1) return [...items];
  let result = shuffle(items);
  let guard = 0;
  while (result.every((it, i) => it.id === items[i].id) && guard < 10) {
    result = shuffle(items);
    guard++;
  }
  return result;
}

export default function RankOrder({
  items,
  boardStyle = 'podium',
  editable,
  onEditItem,
  templateName,
  onRenameTemplate,
  onAddItem,
  onRemoveItem,
}: Props) {
  const { t } = useTranslation();
  const { itemsHidden } = useGamePlay();
  const plates = boardStyle === 'plates';
  const [order, setOrder] = useState<GameItem[]>(() => shuffleUntilDifferent(items));
  const [moveCount, setMoveCount] = useState(0);
  const itemKey = items.map((it) => it.id).join(',');
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');

  useEffect(() => {
    setOrder(shuffleUntilDifferent(items));
    setMoveCount(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

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

  if (items.length < 2) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mx-auto mb-3 flex justify-center">
          <div className="ro-step pointer-events-none w-[160px]">
            <span className="ro-num">1</span>
            <span className="ro-label">Aa</span>
          </div>
        </div>
        <div className="font-body-md text-body-md">{t('gameRankOrder.needParticipants')}</div>
      </div>
    );
  }

  if (order.length === 0) {
    return null;
  }

  const finished = order.length === items.length && order.every((it, i) => it.id === items[i].id);

  const nameHeader = editable && (
    <>
      {editingTemplateName ? (
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
      )}
      {!itemsHidden && (
        <div className="mb-3 max-w-[420px] text-center font-caption text-caption text-on-surface-variant">
          {t('gameAdmin.editHintItems')}
        </div>
      )}
    </>
  );

  const sidePanel = editable && !itemsHidden && (
    <div className="w-full md:w-[260px] md:shrink-0 space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-full bg-surface-container-lowest px-2 py-1.5 shadow-sm">
        <button
          type="button"
          onClick={onRemoveItem}
          disabled={items.length <= 2}
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
  );

  function restart() {
    setOrder(shuffleUntilDifferent(items));
    setMoveCount(0);
  }

  function moveUp(index: number) {
    if (index === 0 || finished) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setMoveCount((c) => c + 1);
  }

  function moveDown(index: number) {
    if (index === order.length - 1 || finished) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    setMoveCount((c) => c + 1);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div
          className={`flex flex-col items-center gap-6 ${editable ? 'md:flex-row md:items-start md:justify-center' : ''}`}
        >
          <div className="flex flex-col items-center">
            {nameHeader}
            <div
              className="mb-6 w-[min(360px,92%)] px-2 py-2 text-center"
              style={{
                borderRadius: 22,
                background: 'linear-gradient(180deg, #f8e4b8 0%, #e8c48a 42%, #c9964e 100%)',
                boxShadow: woodShadow,
              }}
            >
              <div
                className="px-4 py-5"
                style={{
                  borderRadius: 16,
                  background: 'linear-gradient(180deg, #fffef9 0%, #fff4e0 100%)',
                  boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -3px 4px rgba(166,112,48,0.16)',
                }}
              >
                <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameRankOrder.finishedTitle')}</div>
                <div className="font-display-lg text-[28px] tabular-nums text-deep-navy">
                  {t('gameRankOrder.moveCountLabel', { count: moveCount })}
                </div>
              </div>
            </div>
            <button onClick={restart} className={pill}>
              {t('gameRankOrder.restartButton')}
            </button>
          </div>
          {sidePanel}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div
        className={`flex flex-col items-center gap-6 ${editable ? 'md:flex-row md:items-start md:justify-center' : ''}`}
      >
        <div className="flex flex-col items-center">
          {nameHeader}
          <div className="mb-4 font-caption text-caption text-on-surface-variant">{t('gameRankOrder.hint')}</div>
          <div data-skin-stage="board" className="ro-list">
            {order.map((item, i) => {
              const correct = item.id === items[i]?.id;
              const tone = i % 4;
              return (
                <div key={item.id} data-skin-object="row" className="ro-row">
                  {plates ? (
                    <div className="ro-plate-wrap">
                      <span className="ro-tag">{i + 1}</span>
                      <div className={`ro-plate ro-clay-${tone} ${correct ? 'is-ok' : ''}`}>
                        <GameFitText text={item.label} fit="block" />
                      </div>
                    </div>
                  ) : (
                    <div className={`ro-step ${correct ? 'is-ok' : ''}`}>
                      <span className="ro-num">{i + 1}</span>
                      <span className="ro-label">
                        <GameFitText text={item.label} fit="block" />
                      </span>
                    </div>
                  )}
                  <div className="ro-arrows">
                    <button
                      type="button"
                      onClick={() => moveUp(i)}
                      disabled={i === 0}
                      aria-label={t('gameRankOrder.moveUpLabel')}
                      className={`ro-chev ${plates ? 'wood' : 'up'}`}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(i)}
                      disabled={i === order.length - 1}
                      aria-label={t('gameRankOrder.moveDownLabel')}
                      className={`ro-chev ${plates ? 'wood' : 'down'}`}
                    >
                      ▼
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {sidePanel}
      </div>
    </div>
  );
}
