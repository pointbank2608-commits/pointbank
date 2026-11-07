import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { wordListToCards } from '../../lib/gameFromWords';
import type { FullCardItem, WordList } from '../../lib/types';
import { useClassWordLists } from '../../lib/useClassWordLists';
import { enrichCards, loadWordBank } from '../../lib/wordBankCache';
import WordMemoryAssignModal from './WordMemoryAssignModal';

export default function WordProjectHomework({ academyId, classId, onClose, onAssigned }: {
  academyId: string;
  classId: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const { t } = useTranslation();
  const { lists, loading, error, reload } = useClassWordLists(academyId, classId);
  const [listId, setListId] = useState('');
  const [assignment, setAssignment] = useState<{ list: WordList; cards: FullCardItem[] } | null>(null);
  const [loadingCards, setLoadingCards] = useState(false);
  const selected = lists.find((list) => list.id === listId);

  async function choose() {
    if (!selected || loadingCards) return;
    setLoadingCards(true);
    const bank = await loadWordBank().catch(() => []);
    setAssignment({ list: selected, cards: enrichCards(wordListToCards(selected), bank) });
    setLoadingCards(false);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-primary/25 bg-white p-5" aria-labelledby="homework-word-project">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="homework-word-project" className="text-lg font-bold text-deep-navy">{t('wordMemory.homeworkProjectTitle')}</h2>
        <button type="button" className="min-h-11 rounded-full border border-outline-variant px-4" onClick={onClose}>{t('wordMemory.close')}</button>
      </div>
      <Link to="/dictionary" state={{ wordProjectClassId: classId }} className="inline-flex min-h-11 items-center rounded-full border border-primary/40 px-4 font-bold text-primary">
        {t('wordMemory.homeworkProjectDictionary')}
      </Link>
      {error ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert">{t('wordMemory.homeworkProjectListsError')}</p>
          <button type="button" className="min-h-11 font-bold text-primary underline" onClick={reload}>{t('wordMemory.retry')}</button>
        </div>
      ) : loading ? <p role="status">{t('wordMemory.loading')}</p>
        : lists.length === 0 ? <p>{t('studentHw.noWordLists')}</p>
        : (
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid min-w-0 gap-1 font-bold">
              {t('wordMemory.homeworkProjectLists')}
              <select value={listId} onChange={(event) => setListId(event.target.value)} disabled={loadingCards}
                className="min-h-11 min-w-0 max-w-full rounded-xl border border-outline-variant bg-white px-3">
                <option value="">—</option>
                {lists.map((list) => <option key={list.id} value={list.id}>{list.name} · {t('studentHw.wordsN', { count: list.items.length })}</option>)}
              </select>
            </label>
            <button type="button" disabled={!selected || loadingCards} onClick={() => void choose()}
              className="min-h-11 rounded-full bg-primary px-4 font-bold text-on-primary disabled:opacity-40">
              {loadingCards ? t('wordMemory.loading') : t('wordMemory.homeworkProjectCreate')}
            </button>
          </div>
        )}
      {assignment && (
        <WordMemoryAssignModal
          source={{ type: 'wordlist', id: assignment.list.id, name: assignment.list.name }}
          cards={assignment.cards}
          defaultClassId={classId}
          onClose={() => setAssignment(null)}
          onAssigned={onAssigned}
        />
      )}
    </section>
  );
}
