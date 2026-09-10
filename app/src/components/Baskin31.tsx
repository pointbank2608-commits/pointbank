import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import { useGamePlay } from './GameThemeFrame';
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

type Cup = {
  id: string;
  absIndex: number;
  word: string;
  tone: 0 | 1 | 2;
  slot: number;
  leaving?: boolean;
  spawn?: boolean;
};

interface Snapshot {
  count: number;
  turn: Team;
  head: number;
  loser: Team | null;
}

const PICK_OPTIONS = [1, 2, 3];
const CUP_SRCS = [
  '/skins/baskin-cup-mint.png?v=1',
  '/skins/baskin-cup-yellow.png?v=1',
  '/skins/baskin-cup-coral.png?v=1',
];
const COUNTER_SRC = '/skins/baskin-counter.png';
const CARD_SRC = '/skins/miss-card.png';
const LEAVE_MS = 420;
const SLIDE_MS = 560;

/** 스킨 이미지에서 측정한 화면 구멍. 값은 이미지 너비/높이 대비 비율. */
const SCREEN = { left: 0.12, top: 0.25, width: 0.75, height: 0.5 };
const SCREEN_FILL = { left: 0.095, top: 0.195, width: 0.805, height: 0.615 };

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function makeCup(absIndex: number, slot: number, items: GameItem[]): Cup {
  const item = items[absIndex % items.length];
  return {
    id: `cup-${absIndex}`,
    absIndex,
    word: item.label,
    tone: (absIndex % 3) as 0 | 1 | 2,
    slot,
  };
}

function windowCups(head: number, items: GameItem[]): Cup[] {
  if (items.length === 0) return [];
  return [0, 1, 2].map((slot) => makeCup(head + slot, slot, items));
}

const Baskin31 = forwardRef<UndoHandle, Props>(function Baskin31(
  { items, targetCount, editable, templateName, onRenameTemplate, onEditItem, onAddItem, onRemoveItem },
  ref,
) {
  const { t } = useTranslation();
  const { itemsHidden } = useGamePlay();
  const [count, setCount] = useState(0);
  const [turn, setTurn] = useState<Team>('blue');
  const [head, setHead] = useState(0);
  const [loser, setLoser] = useState<Team | null>(null);
  const [prevSnapshot, setPrevSnapshot] = useState<Snapshot | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [cups, setCups] = useState<Cup[]>(() => windowCups(0, items));
  const [busy, setBusy] = useState(false);
  const [countTick, setCountTick] = useState(0);
  const moveGen = useRef(0);
  const cupsRef = useRef(cups);
  const headRef = useRef(head);
  cupsRef.current = cups;
  headRef.current = head;

  useEffect(() => {
    CUP_SRCS.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    setItemDrafts(Object.fromEntries(items.map((i) => [i.id, i.label])));
  }, [items]);

  useEffect(() => {
    if (items.length === 0) {
      setCups([]);
      return;
    }
    setCups((cs) => {
      if (cs.length === 0) return windowCups(headRef.current, items);
      return cs.map((c) => ({
        ...c,
        word: items[c.absIndex % items.length]?.label ?? c.word,
      }));
    });
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

  function applyPick(n: number, alreadySnapshotted = false) {
    if (loser || items.length === 0) return;
    if (!alreadySnapshotted) {
      setPrevSnapshot({ count, turn, head, loser });
    }
    const nextCount = count + n;
    setHead(head + n);
    setCountTick((k) => k + 1);
    if (nextCount >= targetCount) {
      setCount(targetCount);
      setLoser(turn);
    } else {
      setCount(nextCount);
      setTurn(turn === 'blue' ? 'red' : 'blue');
    }
  }

  function requestPick(n: number) {
    if (loser || busy || items.length === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyPick(n);
      setCups(windowCups(head + n, items));
      return;
    }
    const gen = ++moveGen.current;
    const startHead = head;
    setPrevSnapshot({ count, turn, head, loser });
    setBusy(true);
    setCups((cs) => cs.map((c) => (c.slot < n ? { ...c, leaving: true } : c)));

    void (async () => {
      const still = () => moveGen.current === gen;
      await sleep(LEAVE_MS);
      if (!still()) return;

      const staying = cupsRef.current
        .filter((c) => !c.leaving)
        .map((c) => ({ ...c, slot: c.slot - n, leaving: false, spawn: false }));
      const incoming = Array.from({ length: n }, (_, i) => ({
        ...makeCup(startHead + 3 + i, 3 + i, items),
        spawn: true,
      }));
      setCups([...staying, ...incoming]);
      applyPick(n, true);

      await nextFrame();
      if (!still()) return;
      setCups((cs) =>
        cs.map((c) => (c.spawn ? { ...c, slot: c.slot - n, spawn: false } : c)),
      );

      await sleep(SLIDE_MS);
      if (!still()) return;
      setBusy(false);
    })();
  }

  function resetAll() {
    moveGen.current += 1;
    setBusy(false);
    setCount(0);
    setTurn('blue');
    setHead(0);
    setLoser(null);
    setPrevSnapshot(null);
    setCups(windowCups(0, items));
  }

  useImperativeHandle(ref, () => ({
    undo() {
      moveGen.current += 1;
      setBusy(false);
      if (!prevSnapshot) return;
      setCount(prevSnapshot.count);
      setTurn(prevSnapshot.turn);
      setHead(prevSnapshot.head);
      setLoser(prevSnapshot.loser);
      setCups(windowCups(prevSnapshot.head, items));
      setPrevSnapshot(null);
    },
  }));

  const pill =
    'px-6 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={CUP_SRCS[0]} alt="" className="mx-auto mb-3 h-20 w-auto" />
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
        <div className={`flex flex-col items-center ${editable && !itemsHidden ? '' : 'w-full'}`}>
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

          <div className="bk-line mb-4" data-skin-stage="baskin">
            <div className="bk-track">
              {cups.map((cup) => (
                <div
                  key={cup.id}
                  className={`bk-cell${cup.leaving ? ' is-leaving' : ''}${cup.spawn ? ' is-spawn' : ''}`}
                  style={{ ['--slot' as string]: String(cup.slot) }}
                  data-skin-object="scoop"
                >
                  <div className="bk-word">
                    <img src={CARD_SRC} alt="" draggable={false} />
                    <div className="bk-word-text">
                      <span className="block h-full w-full min-h-0">
                        <GameFitText text={cup.word} />
                      </span>
                    </div>
                  </div>
                  <img src={CUP_SRCS[cup.tone]} alt="" draggable={false} className="bk-cup" />
                </div>
              ))}
            </div>
          </div>

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
              <span
                key={countTick}
                className={`font-mono text-[clamp(22px,7vw,36px)] font-bold tabular-nums tracking-wide text-[#e8fbf6] ${
                  countTick > 0 ? 'bk-count-tick' : ''
                }`}
              >
                {count}
                <span className="text-[0.62em] text-[#9adfd4]"> / {targetCount}</span>
              </span>
            </div>
          </div>

          {/* 방금 읽은 단어 바로 아래에 둬야 "누가 방금 읽었는지"와 헷갈리지 않는다 —
              위에 두면 다음 차례 팀이 방금 읽은 것처럼 보인다는 실사용 피드백으로 순서를 바꿈. */}
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

          {!loser ? (
            <div className="flex flex-wrap justify-center gap-2.5">
              {PICK_OPTIONS.map((n) => (
                <button key={n} onClick={() => requestPick(n)} disabled={busy} className={`${pill} disabled:opacity-50`}>
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

export default Baskin31;
