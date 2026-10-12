import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { updateWordListItems } from '../lib/api';
import { newSentenceItems, parseSentenceLines } from '../lib/sentenceLists';
import type { WordList, WordListItem } from '../lib/types';

/**
 * 문장 목록(내 단어장의 "문장" 종류, 066) 편집 — 영어 문장 + 해석을 하나씩 넣거나 여러 줄을 붙여 넣는다.
 * 항목 모양은 단어장과 같다(word = 영어 문장, meaning = 해석). 문장 게임(문장 배열하기)이 불러다 쓴다.
 */
export default function SentenceListEditor({ list, onChange }: { list: WordList; onChange: (items: WordListItem[]) => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [sentence, setSentence] = useState('');
  const [meaning, setMeaning] = useState('');
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(next: WordListItem[], toast?: string) {
    setBusy(true);
    try {
      await updateWordListItems(list.id, next);
      onChange(next);
      if (toast) notify(toast);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function addOne() {
    const fresh = newSentenceItems(list.items, [{ sentence: sentence.trim(), meaning: meaning.trim() }].filter((p) => p.sentence), () => crypto.randomUUID());
    if (fresh.length === 0) {
      if (sentence.trim()) notify(t('wordLists.sentence.nothingNew'));
      return;
    }
    await save([...list.items, ...fresh]);
    setSentence('');
    setMeaning('');
  }

  async function addPasted() {
    const fresh = newSentenceItems(list.items, parseSentenceLines(paste), () => crypto.randomUUID());
    if (fresh.length === 0) {
      notify(t('wordLists.sentence.nothingNew'));
      return;
    }
    await save([...list.items, ...fresh], t('wordLists.sentence.added', { count: fresh.length }));
    setPaste('');
  }

  const input =
    'min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary';

  return (
    <div className="mt-3 space-y-4 border-t border-surface-container pt-3" aria-busy={busy}>
      <p className="font-caption text-caption text-on-surface-variant">{t('wordLists.sentence.hint')}</p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void addOne()}
          placeholder={t('wordLists.sentence.englishPlaceholder')}
          className={`${input} min-w-[220px] flex-[2]`}
        />
        <input
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void addOne()}
          placeholder={t('wordLists.sentence.meaningPlaceholder')}
          className={`${input} min-w-[160px] flex-1`}
        />
        <button
          type="button"
          disabled={busy || !sentence.trim()}
          onClick={() => void addOne()}
          className="rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container disabled:opacity-40"
        >
          {t('wordLists.sentence.addButton')}
        </button>
      </div>

      <details className="rounded-lg bg-surface-container-low px-3 py-2">
        <summary className="cursor-pointer font-label-md text-label-md text-primary">{t('wordLists.sentence.pasteTitle')}</summary>
        <p className="mt-2 font-caption text-caption text-on-surface-variant">{t('wordLists.sentence.pasteHint')}</p>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={5}
          placeholder={t('wordLists.sentence.pastePlaceholder')}
          className={`${input} mt-2 w-full`}
        />
        <button
          type="button"
          disabled={busy || !paste.trim()}
          onClick={() => void addPasted()}
          className="mt-2 rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container disabled:opacity-40"
        >
          {t('wordLists.sentence.pasteButton')}
        </button>
      </details>

      {list.items.length === 0 ? (
        <p className="font-caption text-caption text-on-surface-variant">{t('wordLists.sentence.empty')}</p>
      ) : (
        <ol className="space-y-1.5">
          {list.items.map((item, i) => (
            <li key={item.id} className="flex items-start gap-2 rounded-lg bg-surface-container-low px-3 py-2">
              <span className="w-6 shrink-0 text-right font-caption text-caption tabular-nums text-on-surface-variant">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block break-words font-body-md text-body-md text-on-surface">{item.word}</span>
                {item.meaning && <span className="block break-words font-caption text-caption text-on-surface-variant">{item.meaning}</span>}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save(list.items.filter((x) => x.id !== item.id))}
                aria-label={t('wordLists.sentence.remove')}
                title={t('wordLists.sentence.remove')}
                className="shrink-0 rounded-full p-1 text-on-surface-variant hover:bg-error hover:text-on-error"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
