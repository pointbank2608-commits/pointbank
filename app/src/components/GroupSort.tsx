import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GroupSortGroup } from '../lib/types';

interface Props {
  groups: GroupSortGroup[];
}

interface FlatItem {
  id: string;
  text: string;
  groupId: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function flatten(groups: GroupSortGroup[]): FlatItem[] {
  return groups.flatMap((g) => g.items.map((it) => ({ id: it.id, text: it.text, groupId: g.id })));
}

function emptyBuckets(groups: GroupSortGroup[]): Record<string, FlatItem[]> {
  return Object.fromEntries(groups.map((g) => [g.id, [] as FlatItem[]]));
}

export default function GroupSort({ groups }: Props) {
  const { t } = useTranslation();
  const [pool, setPool] = useState<FlatItem[]>(() => shuffle(flatten(groups)));
  const [placed, setPlaced] = useState<Record<string, FlatItem[]>>(() => emptyBuckets(groups));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wrongGroupId, setWrongGroupId] = useState<string | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [locked, setLocked] = useState(false);

  const allItems = flatten(groups);

  if (groups.length < 2 || allItems.length < 2) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🗂️</div>
        <div className="font-body-md text-body-md">{t('gameGroupSort.needGroups')}</div>
      </div>
    );
  }

  const finished = pool.length === 0;

  function restart() {
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
    setTimeout(() => {
      setWrongGroupId(null);
      setSelectedId(null);
      setLocked(false);
    }, 500);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div className="text-5xl mb-3">🎉</div>
        <div className="font-title-md text-title-md text-on-surface mb-2">{t('gameGroupSort.finishedTitle')}</div>
        <div className="font-display-lg text-[32px] text-deep-navy mb-6 tabular-nums">
          {t('gameGroupSort.wrongCountLabel', { count: wrongCount })}
        </div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameGroupSort.restartButton')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2 w-full">
      <div className="font-caption text-caption text-on-surface-variant mb-4 tabular-nums">
        {t('gameGroupSort.wrongCountLabel', { count: wrongCount })}
      </div>

      <div data-skin-stage="board" className="flex flex-wrap justify-center gap-3 mb-6 w-full max-w-[640px]">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => dropOnGroup(g.id)}
            disabled={!selectedId}
            data-skin-object="bucket"
            className={`flex-1 min-w-[140px] rounded-xl border-2 p-3 text-left transition-colors ${
              wrongGroupId === g.id
                ? 'bg-error-container border-error'
                : selectedId
                  ? 'bg-primary-container/30 border-primary/60 hover:bg-primary-container/50'
                  : 'bg-surface-container-low border-outline-variant/40'
            }`}
          >
            <div className="font-label-md text-label-md text-on-surface mb-2">{g.name}</div>
            <div className="flex flex-wrap gap-1.5">
              {(placed[g.id] ?? []).map((it) => (
                <span
                  key={it.id}
                  className="px-2.5 py-1 rounded-full bg-secondary-container/50 font-caption text-caption text-on-surface"
                >
                  {it.text}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div data-skin-stage="tile-pool" className="flex flex-wrap justify-center gap-2 max-w-[560px]">
        {pool.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => selectItem(it.id)}
            data-skin-object="chip"
            className={`px-4 py-2 rounded-full font-label-md text-label-md border-2 transition-all ${
              selectedId === it.id
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface hover:bg-surface-container-low'
            }`}
          >
            {it.text}
          </button>
        ))}
      </div>
    </div>
  );
}
