import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createWordList } from '../lib/api';
import type { WordList, WordListItem } from '../lib/types';
import { WordListEditor } from '../pages/WordListsPage';

/**
 * 수업 만들기 안에서 단어장 만들기·고치기(2026-09-27). 수업을 만들다 "내 단어장"으로 나갈 필요 없이
 * 여기서 새 단어장을 만들고(이 수업의 반 단어장), 직접 입력·사전에서 고르기·카테고리/파닉스 단계로
 * 한꺼번에 담는다. 편집기는 "내 단어장" 페이지의 WordListEditor 를 그대로 쓴다.
 */
export default function LessonWordListModal({
  academyId,
  classId,
  teacherId,
  list,
  defaultName,
  onClose,
  onCreated,
  onItemsChange,
}: {
  academyId: string;
  classId: string | null;
  teacherId: string;
  /** 고칠 단어장(edit) — new 에서는 만든 뒤 부모가 넘겨준다 */
  list: WordList | null;
  defaultName: string;
  onClose: () => void;
  onCreated: (list: WordList) => void;
  onItemsChange: (listId: string, items: WordListItem[]) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultName);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function create() {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createWordList({ academyId, classId, name: name.trim(), items: [], teacherId });
      onCreated(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-3xl space-y-4 rounded-2xl bg-surface-container-lowest p-5 shadow-xl sm:p-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[24px] text-primary">library_books</span>
          <h2 className="min-w-0 flex-1 truncate font-title-md text-title-md font-bold text-deep-navy">
            {list ? t('curriculum.wordListTools.editTitle', { name: list.name }) : t('curriculum.wordListTools.newTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container"
          >
            {list ? t('curriculum.wordListTools.done') : t('common.cancel')}
          </button>
        </div>

        {list ? (
          <>
            <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.wordListTools.editHint')}</p>
            <WordListEditor list={list} onChange={(items) => onItemsChange(list.id, items)} />
          </>
        ) : (
          <div className="space-y-3">
            <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.wordListTools.newHint')}</p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void create()}
              placeholder={t('curriculum.wordListTools.namePlaceholder')}
              className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {error && <p className="font-caption text-caption text-error">{error}</p>}
            <button
              type="button"
              disabled={!name.trim() || creating}
              onClick={() => void create()}
              className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {creating ? t('common.loading') : t('curriculum.wordListTools.createAndAdd')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
