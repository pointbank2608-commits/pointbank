import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import WordListPicker from './WordListPicker';
import DictionaryPicker from './DictionaryPicker';
import type { FullCardItem, WordList } from '../lib/types';

interface Props {
  words: FullCardItem[];
  onChange: (words: FullCardItem[]) => void;
  wordLists: WordList[];
  wordListsLoading: boolean;
}

function uid(): string {
  return crypto.randomUUID();
}

/**
 * 인쇄 자료(메모리 카드·빙고판)용 단어 목록 입력 — 게임의 항목 입력란과 같은 패턴
 * (단어장/사전에서 불러오기 + 칩 목록 + 직접 입력)이지만, game_templates에 저장하지
 * 않고 부모가 배열 하나로만 들고 있는 가벼운 버전. 단어장/사전에서 담으면 뜻·이미지가
 * 같이 따라온다(메모리 카드가 카드 뒷면에 쓴다) — 직접 입력은 word만 있고 meaning/imageUrl은 없다.
 */
export default function MaterialsWordPicker({ words, onChange, wordLists, wordListsLoading }: Props) {
  const { t } = useTranslation();
  const [newWord, setNewWord] = useState('');

  function addWord() {
    const label = newWord.trim();
    if (!label) return;
    onChange([...words, { id: uid(), word: label, meaning: '', imageUrl: null }]);
    setNewWord('');
  }

  function addWordsBulk(items: FullCardItem[]) {
    if (items.length === 0) return;
    onChange([...words, ...items]);
  }

  function removeWord(id: string) {
    onChange(words.filter((w) => w.id !== id));
  }

  function clearAll() {
    if (words.length === 0) return;
    if (!confirm(t('materials.clearAllConfirm'))) return;
    onChange([]);
  }

  return (
    <div>
      <div className="flex flex-wrap items-start gap-2 mb-3 [&>*]:min-w-[180px] [&>*]:flex-none">
        <WordListPicker variant="full" wordLists={wordLists} loading={wordListsLoading} onImportFull={addWordsBulk} />
        <DictionaryPicker variant="full" onImportFull={addWordsBulk} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {words.length === 0 ? (
          <span className="font-caption text-caption text-on-surface-variant">{t('materials.noWords')}</span>
        ) : (
          words.map((w) => (
            <div
              key={w.id}
              className="flex items-center gap-1.5 pl-2 pr-2 py-1.5 rounded-full bg-surface-container-low font-label-md text-label-md text-on-surface"
            >
              {w.imageUrl && <img src={w.imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" />}
              {w.word}
              <button onClick={() => removeWord(w.id)} className="text-on-surface-variant hover:text-error">
                ✕
              </button>
            </div>
          ))
        )}
      </div>
      {words.length > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="mt-2 font-label-md text-label-md text-error hover:underline"
        >
          {t('materials.clearAllButton')}
        </button>
      )}

      <div className="flex gap-2 mt-3">
        <input
          type="text"
          placeholder={t('materials.addWordPlaceholder')}
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addWord();
          }}
          className="flex-1 min-w-0 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        />
        <button
          onClick={addWord}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors whitespace-nowrap"
        >
          {t('materials.addWordButton')}
        </button>
      </div>
    </div>
  );
}
