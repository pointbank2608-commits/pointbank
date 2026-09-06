import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import { colorFor } from '../lib/wheel';
import type { GameItem, UndoHandle } from '../lib/types';

interface Props {
  items: GameItem[];
  targetCount: number;
  /** true면 상단 이름 수정 + 오른쪽에 항목 개수 조절/이름 수정 목록 패널을 보여준다(선생님용 실제 플레이 화면). */
  editable?: boolean;
  templateName?: string;
  onRenameTemplate?: (name: string) => void;
  onEditItem?: (id: string, label: string) => void;
  onAddItem?: () => void;
  onRemoveItem?: () => void;
}

type Team = 'blue' | 'red';

const PICK_OPTIONS = [1, 2, 3];
const CONE_SRC = '/skins/baskin-cone.png';
const COUNTER_SRC = '/skins/baskin-counter.png';
const CARD_SRC = '/skins/miss-card.png';

/** 스킨 이미지에서 측정한 화면 구멍. 값은 이미지 너비/높이 대비 비율. */
const SCREEN = { left: 0.12, top: 0.25, width: 0.75, height: 0.5 };
const SCREEN_FILL = { left: 0.095, top: 0.195, width: 0.805, height: 0.615 };

interface Snapshot {
  count: number;
  turn: Team;
  wordIndex: number;
  lastWords: string[];
  loser: Team | null;
}

const Baskin31 = forwardRef<UndoHandle, Props>(function Baskin31(
  { items, targetCount, editable, templateName, onRenameTemplate, onEditItem, onAddItem, onRemoveItem },
  ref,
) {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);
  const [turn, setTurn] = useState<Team>('blue');
  const [wordIndex, setWordIndex] = useState(0);
  const [lastWords, setLastWords] = useState<string[]>([]);
  const [loser, setLoser] = useState<Team | null>(null);
  const [prevSnapshot, setPrevSnapshot] = useState<Snapshot | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');

  // 오른쪽 목록 입력창의 초안 텍스트를 실제 항목과 맞춰둔다 — 타이핑 중엔 이 draft를
  // 보여주다가(blur/Enter 시점에 onEditItem으로 실제 반영한다.
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

  function pick(n: number) {
    if (loser || items.length === 0) return;
    setPrevSnapshot({ count, turn, wordIndex, lastWords, loser });
    const words = Array.from({ length: n }, (_, i) => items[(wordIndex + i) % items.length].label);
    const nextCount = count + n;
    setLastWords(words);
    setWordIndex((wordIndex + n) % items.length);
    if (nextCount >= targetCount) {
      setCount(targetCount);
      setLoser(turn);
    } else {
      setCount(nextCount);
      setTurn(turn === 'blue' ? 'red' : 'blue');
    }
  }

  function resetAll() {
    setCount(0);
    setTurn('blue');
    setWordIndex(0);
    setLastWords([]);
    setLoser(null);
    setPrevSnapshot(null);
  }

  useImperativeHandle(ref, () => ({
    undo() {
      if (!prevSnapshot) return;
      setCount(prevSnapshot.count);
      setTurn(prevSnapshot.turn);
      setWordIndex(prevSnapshot.wordIndex);
      setLastWords(prevSnapshot.lastWords);
      setLoser(prevSnapshot.loser);
      setPrevSnapshot(null);
    },
  }));

  const pill =
    'px-6 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={CONE_SRC} alt="" className="mx-auto mb-3 h-16 w-auto" />
        <div className="font-body-md text-body-md">{t('gameBaskin31.needParticipants')}</div>
      </div>
    );
  }

  const teamLabel = (team: Team) => (team === 'blue' ? t('gameBaskin31.teamBlue') : t('gameBaskin31.teamRed'));

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div
        className={`flex w-full flex-col items-center gap-6 ${editable ? 'md:flex-row md:items-start md:justify-center' : ''}`}
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
      <img
        src={CONE_SRC}
        alt=""
        data-skin-object="scoop"
        draggable={false}
        className={`mb-4 h-[min(168px,38vw)] w-auto select-none transition-all ${
          loser ? 'scale-90 grayscale opacity-40' : ''
        }`}
        style={{ filter: loser ? undefined : 'drop-shadow(0 8px 12px rgba(90, 50, 18, 0.22))' }}
      />

      <div
        className="relative mb-4 w-[min(280px,86vw)]"
        style={{ filter: 'drop-shadow(0 8px 12px rgba(90, 50, 18, 0.28))' }}
      >
        <div
          className="absolute z-0 bg-[#1a2430]"
          style={{
            left: `${SCREEN_FILL.left * 100}%`,
            top: `${SCREEN_FILL.top * 100}%`,
            width: `${SCREEN_FILL.width * 100}%`,
            height: `${SCREEN_FILL.height * 100}%`,
          }}
        />
        <img src={COUNTER_SRC} alt="" draggable={false} className="pointer-events-none relative z-10 w-full select-none" />
        <div
          className="absolute z-20 flex items-center justify-center"
          style={{
            left: `${SCREEN.left * 100}%`,
            top: `${SCREEN.top * 100}%`,
            width: `${SCREEN.width * 100}%`,
            height: `${SCREEN.height * 100}%`,
          }}
        >
          <span className="font-mono text-[clamp(22px,7vw,36px)] font-bold tabular-nums tracking-wide text-[#e8fbf6]">
            {count}
            <span className="text-[0.62em] text-[#9adfd4]"> / {targetCount}</span>
          </span>
        </div>
      </div>

      {!loser && (
        <div
          className={`mb-4 rounded-full px-6 py-2 font-label-md text-label-md shadow-sm ${
            turn === 'blue' ? 'bg-secondary text-on-secondary' : 'text-white'
          }`}
          style={turn === 'red' ? { backgroundColor: '#f28b73' } : undefined}
        >
          {t('gameBaskin31.turnLabel', { team: teamLabel(turn) })}
        </div>
      )}

      {lastWords.length > 0 && (
        <div className="mb-5 flex flex-wrap justify-center gap-2">
          {lastWords.map((w, i) => (
            <div
              key={`${w}-${i}`}
              className="relative w-[min(118px,30vw)]"
              style={{ filter: 'drop-shadow(0 5px 7px rgba(90, 50, 18, 0.16))' }}
            >
              <img src={CARD_SRC} alt="" draggable={false} className="pointer-events-none w-full select-none" />
              <div
                className="absolute flex items-center justify-center px-1"
                style={{ left: '10%', top: '13%', width: '81%', height: '75%' }}
              >
                <span className="block h-full w-full min-h-0">
                  <GameFitText text={w} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loser ? (
        <div className="flex flex-wrap justify-center gap-2.5">
          {PICK_OPTIONS.map((n) => (
            <button key={n} onClick={() => pick(n)} className={pill}>
              {t('gameBaskin31.pickButton', { n })}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div
            className="result-pop rounded-2xl px-8 py-4 text-center"
            style={{
              backgroundColor: '#f28b73',
              border: '3px solid #f0d7a8',
              boxShadow: '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)',
            }}
          >
            <div className="font-title-md text-[20px] font-bold text-white">
              {t('gameBaskin31.loseMessage', { team: teamLabel(loser), target: targetCount })}
            </div>
          </div>
          <button onClick={resetAll} className={`${pill} px-10`}>
            {t('gameBaskin31.playAgainButton')}
          </button>
        </div>
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
});

export default Baskin31;
