import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import AccessibleDialog from './AccessibleDialog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createWordList, fetchAllWordLists, updateWordListItems } from '../lib/api';
import { useClasses } from '../lib/useClasses';
import type { FullCardItem, WordList, WordListItem } from '../lib/types';

function toItem(w: FullCardItem): WordListItem {
  return {
    id: crypto.randomUUID(),
    word: w.word,
    meaning: w.meaning,
    image_url: w.imageUrl,
    category: w.category ?? null,
    partOfSpeech: w.partOfSpeech ?? null,
    patternMarked: w.patternMarked ?? null,
  };
}

/**
 * 사전·파닉스에서 고른 낱말을 "내 단어장"으로 옮겨 담는 창(2026-10-03) — 휴대폰 사진첩에서 사진을 골라 앨범으로
 * 옮기는 것처럼: 단어장을 누르면 거기에 담기고, 새 단어장을 만들며 바로 담을 수도 있다. 같은 낱말·뜻은 두 번 담지 않는다.
 */
export default function AddToWordListModal({ words, onClose, onDone }: { words: FullCardItem[]; onClose: () => void; onDone?: () => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const { academy, profile } = useAuth();
  const { classes, selectedId } = useClasses(academy?.id);
  const [lists, setLists] = useState<WordList[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [newClassId, setNewClassId] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string>('all');

  useEffect(() => {
    if (!academy?.id) return;
    fetchAllWordLists(academy.id)
      .then((l) => setLists([...l].reverse()))
      .catch(() => setLists([]));
  }, [academy?.id]);
  useEffect(() => setNewClassId(selectedId ?? null), [selectedId]);

  const className = (id: string | null) => (id ? (classes.find((c) => c.id === id)?.name ?? '') : t('addToWordList.academyWide'));
  const shown = useMemo(() => (lists ?? []).filter((l) => filterClass === 'all' || (filterClass === 'none' ? !l.class_id : l.class_id === filterClass)), [lists, filterClass]);

  async function addTo(list: WordList) {
    if (busy) return;
    setBusy(true);
    try {
      const have = new Set(list.items.map((i) => `${i.word.toLowerCase()}::${i.meaning}`));
      const fresh = words.filter((w) => !have.has(`${w.word.toLowerCase()}::${w.meaning}`));
      if (fresh.length > 0) await updateWordListItems(list.id, [...list.items, ...fresh.map(toItem)]);
      notify(
        fresh.length === words.length
          ? t('addToWordList.added', { count: fresh.length, name: list.name })
          : t('addToWordList.addedSkipped', { count: fresh.length, skipped: words.length - fresh.length, name: list.name }),
      );
      onDone?.();
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function createAndAdd() {
    const name = newName.trim();
    if (!name || !academy || !profile || busy) return;
    setBusy(true);
    try {
      const list = await createWordList({ academyId: academy.id, classId: newClassId, name, items: words.map(toItem), teacherId: profile.id });
      notify(t('addToWordList.created', { count: words.length, name: list.name }));
      onDone?.();
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  const chip = (on: boolean) =>
    `rounded-full px-3 py-1 font-label-md text-label-md transition-colors ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`;

  return (
    <AccessibleDialog label={t('addToWordList.title')} onClose={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-surface-container px-5 py-4">
          <span className="material-symbols-outlined text-primary">library_add</span>
          <h3 className="flex-1 font-title-md text-title-md text-deep-navy">{t('addToWordList.title', { count: words.length })}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.cancel')} className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-surface-container px-5 py-2.5">
          {words.slice(0, 14).map((w) => (
            <span key={w.id} className="flex items-center gap-1 rounded-full bg-surface-container-low px-2 py-0.5 text-xs text-on-surface">
              {w.imageUrl && <img src={w.imageUrl} alt="" className="h-4 w-4 rounded-full object-cover" />}
              {w.word}
            </span>
          ))}
          {words.length > 14 && <span className="text-xs text-on-surface-variant">+{words.length - 14}</span>}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {/* 새 단어장 */}
          <div className="space-y-2 rounded-xl border-2 border-dashed border-primary/30 p-3">
            <div className="font-label-md text-label-md font-bold text-on-surface">{t('addToWordList.newTitle')}</div>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void createAndAdd()}
                placeholder={t('addToWordList.newPlaceholder')}
                className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => void createAndAdd()}
                disabled={!newName.trim() || busy}
                className="whitespace-nowrap rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-container disabled:opacity-40"
              >
                {t('addToWordList.createButton')}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-caption text-caption text-on-surface-variant">{t('addToWordList.whereLabel')}</span>
              {classes.map((c) => (
                <button key={c.id} type="button" onClick={() => setNewClassId(c.id)} className={chip(newClassId === c.id)}>
                  {c.name}
                </button>
              ))}
              <button type="button" onClick={() => setNewClassId(null)} className={chip(newClassId === null)}>
                {t('addToWordList.academyWide')}
              </button>
            </div>
          </div>

          {/* 있는 단어장 */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-label-md text-label-md font-bold text-on-surface">{t('addToWordList.existingTitle')}</span>
              <button type="button" onClick={() => setFilterClass('all')} className={chip(filterClass === 'all')}>
                {t('addToWordList.all')}
              </button>
              {classes.map((c) => (
                <button key={c.id} type="button" onClick={() => setFilterClass(c.id)} className={chip(filterClass === c.id)}>
                  {c.name}
                </button>
              ))}
              <button type="button" onClick={() => setFilterClass('none')} className={chip(filterClass === 'none')}>
                {t('addToWordList.academyWide')}
              </button>
            </div>
            {lists === null ? (
              <div className="py-4 text-center font-caption text-caption text-on-surface-variant">{t('common.loading')}</div>
            ) : shown.length === 0 ? (
              <div className="py-4 text-center font-caption text-caption text-on-surface-variant">{t('addToWordList.noLists')}</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {shown.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void addTo(l)}
                    className="flex items-center gap-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md disabled:opacity-50"
                  >
                    <div className="grid h-11 w-11 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-lg bg-surface-container">
                      {l.items
                        .filter((i) => i.image_url)
                        .slice(0, 4)
                        .map((i) => (
                          <img key={i.id} src={i.image_url!} alt="" className="h-full w-full object-cover" />
                        ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-label-md text-label-md font-bold text-on-surface">{l.name}</div>
                      <div className="font-caption text-caption text-on-surface-variant">
                        {className(l.class_id)} · {t('addToWordList.wordCount', { count: l.items.length })}
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-primary">add_circle</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-surface-container px-5 py-3 text-right">
          <Link to="/wordlists" className="font-label-md text-label-md text-primary hover:underline">
            {t('addToWordList.openWordLists')}
          </Link>
        </div>
      </div>
    </AccessibleDialog>
  );
}
