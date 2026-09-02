import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GroupSortGroup } from '../lib/types';

export type GroupSortStyle = 'crates' | 'baskets';

interface Props {
  groups: GroupSortGroup[];
  boardStyle?: GroupSortStyle;
}

interface FlatItem {
  id: string;
  text: string;
  groupId: string;
  tone: number;
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

function flatten(groups: GroupSortGroup[]): FlatItem[] {
  return groups.flatMap((g, gi) =>
    g.items.map((it, ii) => ({
      id: it.id,
      text: it.text,
      groupId: g.id,
      tone: (gi + ii) % 4,
    })),
  );
}

function emptyBuckets(groups: GroupSortGroup[]): Record<string, FlatItem[]> {
  return Object.fromEntries(groups.map((g) => [g.id, [] as FlatItem[]]));
}

export default function GroupSort({ groups, boardStyle = 'crates' }: Props) {
  const { t } = useTranslation();
  const baskets = boardStyle === 'baskets';
  const [pool, setPool] = useState<FlatItem[]>(() => shuffle(flatten(groups)));
  const [placed, setPlaced] = useState<Record<string, FlatItem[]>>(() => emptyBuckets(groups));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wrongGroupId, setWrongGroupId] = useState<string | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const flashTimer = useRef<number | null>(null);
  const groupKey = groups.map((g) => `${g.id}:${g.items.map((it) => it.id).join(',')}`).join('|');

  useEffect(() => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    setPool(shuffle(flatten(groups)));
    setPlaced(emptyBuckets(groups));
    setSelectedId(null);
    setWrongGroupId(null);
    setWrongCount(0);
    setLocked(false);
  }, [groupKey]);

  useEffect(() => {
    return () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    };
  }, []);

  const allItems = flatten(groups);

  if (groups.length < 2 || allItems.length < 2) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mx-auto mb-3 flex justify-center gap-2">
          <span className="gs-clay gs-clay-0 pointer-events-none min-w-[64px]">A</span>
          <span className="gs-clay gs-clay-2 pointer-events-none min-w-[64px]">가</span>
        </div>
        <div className="font-body-md text-body-md">{t('gameGroupSort.needGroups')}</div>
      </div>
    );
  }

  const finished = pool.length === 0;

  function restart() {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    setPool(shuffle(flatten(groups)));
    setPlaced(emptyBuckets(groups));
    setSelectedId(null);
    setWrongGroupId(null);
    setWrongCount(0);
    setLocked(false);
  }

  function selectItem(itemId: string) {
    if (locked) return;
    setSelectedId((prev) => (prev === itemId ? null : itemId));
  }

  function dropOnGroup(groupId: string) {
    if (!selectedId || locked) return;
    const item = pool.find((it) => it.id === selectedId);
    if (!item) return;
    if (item.groupId === groupId) {
      setPool((prev) => prev.filter((it) => it.id !== selectedId));
      setPlaced((prev) => ({ ...prev, [groupId]: [...prev[groupId], item] }));
      setSelectedId(null);
      return;
    }
    setWrongCount((c) => c + 1);
    setWrongGroupId(groupId);
    setLocked(true);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      setWrongGroupId(null);
      setSelectedId(null);
      setLocked(false);
      flashTimer.current = null;
    }, 500);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
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
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameGroupSort.finishedTitle')}</div>
            <div className="font-display-lg text-[32px] tabular-nums text-deep-navy">
              {t('gameGroupSort.wrongCountLabel', { count: wrongCount })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameGroupSort.restartButton')}
        </button>
      </div>
    );
  }

  function placedChips(groupId: string) {
    return (placed[groupId] ?? []).map((it) =>
      baskets ? (
        <span key={it.id} className="gs-placed-tag">
          {it.text}
        </span>
      ) : (
        <span key={it.id} className={`gs-chip gs-clay-${it.tone}`}>
          {it.text}
        </span>
      ),
    );
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2 w-full">
      <div className="mb-4 rounded-full bg-secondary px-4 py-1 font-title-md text-[14px] font-bold tabular-nums text-on-secondary">
        {t('gameGroupSort.wrongCountLabel', { count: wrongCount })}
      </div>

      <div data-skin-stage="board" className="flex flex-wrap justify-center gap-3 mb-6 w-full max-w-[640px]">
        {groups.map((g, i) => {
          const mark =
            wrongGroupId === g.id ? 'is-no' : selectedId ? 'is-ready' : '';
          if (baskets) {
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => dropOnGroup(g.id)}
                disabled={!selectedId}
                data-skin-object="bucket"
                className={`gs-basket-wrap ${mark}`}
              >
                <span className="gs-basket-tag">{g.name}</span>
                <span className={`gs-basket gs-basket-${i % 4}`}>{placedChips(g.id)}</span>
              </button>
            );
          }
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => dropOnGroup(g.id)}
              disabled={!selectedId}
              data-skin-object="bucket"
              className={`gs-crate ${mark}`}
            >
              <div className="gs-crate-name">{g.name}</div>
              <div className="gs-crate-well">{placedChips(g.id)}</div>
            </button>
          );
        })}
      </div>

      {baskets ? (
        pool.length > 0 && (
          <div data-skin-stage="tile-pool" className="gs-hang">
            <div className="gs-hang-bar" aria-hidden />
            <div className="gs-hang-row">
              {pool.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => selectItem(it.id)}
                  data-skin-object="chip"
                  className={`gs-tag ${selectedId === it.id ? 'is-sel' : ''}`}
                >
                  {it.text}
                </button>
              ))}
            </div>
          </div>
        )
      ) : (
        <div data-skin-stage="tile-pool" className="flex flex-wrap justify-center gap-2 max-w-[560px]">
          {pool.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => selectItem(it.id)}
              data-skin-object="chip"
              className={`gs-clay gs-clay-${it.tone} ${selectedId === it.id ? 'is-sel' : ''}`}
            >
              {it.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
