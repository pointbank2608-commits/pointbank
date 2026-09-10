import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { colorFor } from '../lib/wheel';
import GameFitText from './GameFitText';
import { useGamePlay } from './GameThemeFrame';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
  /** true면 오른쪽에 항목 개수 조절 + 이름 수정 목록 패널을 보여준다(선생님용 실제 플레이 화면에서만). */
  editable?: boolean;
  onEditItem?: (id: string, label: string) => void;
  /** 상단 이름 표시/수정 + 항목 개수 +/- 툴바. GameThemeFrame 안(전체화면 포함)에서도
   * 보이도록 Popcorn 자체에 둔다 — 페이지 바깥에 두면 전체화면에서 안 보였다. */
  templateName?: string;
  onRenameTemplate?: (name: string) => void;
  onAddItem?: () => void;
  onRemoveItem?: () => void;
}

type Team = 'blue' | 'red';
type Card = GameItem | 'pop';

const POP_RATIO = 0.25;
const KETTLE_SRC = '/skins/popcorn-kettle.png?v=2';
const KERNEL_SRC = '/skins/popcorn-kernel.png';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 항목 카드 사이사이에 'POP!' 카드를 섞어 넣은 뽑기 더미를 만든다. */
function buildDeck(items: GameItem[]): Card[] {
  const popCount = Math.max(1, Math.round(items.length * POP_RATIO));
  const deck: Card[] = [...items, ...Array<Card>(popCount).fill('pop')];
  return shuffle(deck);
}

const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';

export default function Popcorn({
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
  const [deck, setDeck] = useState<Card[]>(() => buildDeck(items));
  const [deckIndex, setDeckIndex] = useState(0);
  const [turn, setTurn] = useState<Team>('blue');
  const [scores, setScores] = useState<Record<Team, number>>({ blue: 0, red: 0 });
  const [lastCard, setLastCard] = useState<Card | null>(null);
  const [poppedTeam, setPoppedTeam] = useState<Team | null>(null);
  const [hop, setHop] = useState(0);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');

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

  function draw() {
    if (items.length === 0) return;
    let currentDeck = deck;
    let index = deckIndex;
    if (index >= currentDeck.length) {
      currentDeck = buildDeck(items);
      index = 0;
      setDeck(currentDeck);
    }
    const card = currentDeck[index];
    setDeckIndex(index + 1);
    setLastCard(card);
    setHop((n) => n + 1);

    if (card === 'pop') {
      setPoppedTeam(turn);
      setScores((prev) => ({ ...prev, [turn]: 0 }));
    } else {
      setPoppedTeam(null);
      setScores((prev) => ({ ...prev, [turn]: prev[turn] + 1 }));
    }
    setTurn((prev) => (prev === 'blue' ? 'red' : 'blue'));
  }

  function resetAll() {
    setDeck(buildDeck(items));
    setDeckIndex(0);
    setTurn('blue');
    setScores({ blue: 0, red: 0 });
    setLastCard(null);
    setPoppedTeam(null);
    setHop(0);
  }

  const teamLabel = (team: Team) => (team === 'blue' ? t('gamePopcorn.teamBlue') : t('gamePopcorn.teamRed'));
  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={KETTLE_SRC} alt="" className="mx-auto mb-3 h-16 w-auto" />
        <div className="font-body-md text-body-md">{t('gamePopcorn.needParticipants')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
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
          <div className="relative flex flex-col items-center">
      {lastCard === 'pop' && (
        <div
          key={`burst-${hop}`}
          className="pc-burst pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-[28px]"
          style={{ backgroundColor: 'rgba(242,139,115,0.95)' }}
        >
          <div className="pc-burst-emoji text-[28vw] leading-none sm:text-[180px]">🍿</div>
          <div
            className="rounded-full bg-white px-9 py-4 text-center font-title-md text-title-md"
            style={{ color: '#f28b73' }}
          >
            {t('gamePopcorn.popMessage', { team: teamLabel(poppedTeam ?? turn) })}
          </div>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2.5">
        <div
          data-skin-object="score-card"
          className="min-w-[92px] rounded-2xl px-5 py-2.5 text-center text-on-secondary"
          style={{ backgroundColor: '#3dbea8', boxShadow: woodShadow }}
        >
          <div className="font-caption text-[13px] font-bold opacity-90">{teamLabel('blue')}</div>
          <div className="font-title-md text-[26px] font-bold tabular-nums leading-none">{scores.blue}</div>
        </div>
        <div
          className={`rounded-full px-7 py-2.5 font-title-md text-[18px] font-bold shadow-sm ${
            turn === 'blue' ? 'bg-secondary text-on-secondary' : 'text-white'
          }`}
          style={turn === 'red' ? { backgroundColor: '#f28b73' } : undefined}
        >
          {t('gamePopcorn.turnLabel', { team: teamLabel(turn) })}
        </div>
        <div
          data-skin-object="score-card"
          className="min-w-[92px] rounded-2xl px-5 py-2.5 text-center text-white"
          style={{ backgroundColor: '#f28b73', boxShadow: woodShadow }}
        >
          <div className="font-caption text-[13px] font-bold opacity-90">{teamLabel('red')}</div>
          <div className="font-title-md text-[26px] font-bold tabular-nums leading-none">{scores.red}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={draw}
        data-skin-object="popcorn"
        aria-label={t('gamePopcorn.drawButton')}
        className="relative mb-4 max-w-[min(440px,92%)] overflow-visible transition-transform hover:scale-[1.03] active:scale-[0.98]"
      >
        <img
          key={`kettle-${hop}`}
          src={KETTLE_SRC}
          alt=""
          draggable={false}
          className={`w-full select-none ${hop > 0 ? 'pc-hop' : ''}`}
          style={{ filter: 'drop-shadow(0 10px 14px rgba(90, 50, 18, 0.26))' }}
        />
        {hop > 0 && (
          <img
            key={`kernel-${hop}`}
            src={KERNEL_SRC}
            alt=""
            draggable={false}
            className="pc-kernel select-none"
            style={
              {
                ['--pc-x']: `${hop % 3 === 0 ? 78 : hop % 3 === 1 ? -72 : 58}px`,
              } as CSSProperties
            }
          />
        )}
      </button>

      {lastCard && lastCard !== 'pop' && (
        <div key={hop} className="result-pop mb-5 w-[min(420px,92%)] text-center">
          <div
            className="flex items-center justify-center px-2 py-2"
            style={{
              borderRadius: 22,
              background: 'linear-gradient(180deg, #f8e4b8 0%, #e8c48a 42%, #c9964e 100%)',
              boxShadow: woodShadow,
            }}
          >
            <span
              className="flex min-h-[64px] w-full items-center justify-center px-4 py-2"
              style={{
                borderRadius: 16,
                background: 'linear-gradient(180deg, #fffef9 0%, #fff4e0 100%)',
                boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -3px 4px rgba(166,112,48,0.16)',
              }}
            >
              <span className="block w-full min-h-[64px]">
                <GameFitText text={lastCard.label} fit="block" />
              </span>
            </span>
          </div>
        </div>
      )}

      <button type="button" onClick={draw} className={pill}>
        {t('gamePopcorn.drawButton')}
      </button>

      <button
        type="button"
        onClick={resetAll}
        className="mt-6 font-caption text-caption text-on-surface-variant hover:text-error transition-colors"
      >
        {t('gamePopcorn.resetButton')}
      </button>
          </div>
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
