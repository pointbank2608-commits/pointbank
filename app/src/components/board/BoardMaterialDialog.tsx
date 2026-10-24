import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { fetchAllWordLists } from '../../lib/api';
import { BOARD_SAMPLE_WORDS, cardsFromLines, detectKind, mergeCards, parseBoardText, type BoardMaterial } from '../../lib/boardMaterial';
import { loadWordBank } from '../../lib/wordBankCache';
import type { FullCardItem, WordList } from '../../lib/types';
import AccessibleDialog from '../AccessibleDialog';
import SentenceBankPicker from '../SentenceBankPicker';
import WordListPicker from '../WordListPicker';

/** 오늘 수업 자료(단어·문장) 넣기: 붙여넣기 + 내 단어장·문장 목록 + 문장 은행. 한 번 넣으면 칠판의 모든 도구가 쓴다. */
export default function BoardMaterialDialog({
  material,
  onApply,
  onClose,
}: {
  material: BoardMaterial | null;
  onApply: (m: BoardMaterial | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { academy } = useAuth();
  const [cards, setCards] = useState<FullCardItem[]>(material?.cards ?? []);
  const [text, setText] = useState('');
  const [lists, setLists] = useState<WordList[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!academy?.id) {
      setLoading(false);
      return;
    }
    fetchAllWordLists(academy.id, 'all')
      .then((rows) => alive && setLists(rows))
      .catch(() => {
        /* 목록을 못 불러와도 붙여넣기는 된다 */
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [academy?.id]);

  async function addText() {
    if (!text.trim()) return;
    const bank = await loadWordBank().catch(() => []);
    setCards((prev) => mergeCards(prev, parseBoardText(text, bank).cards));
    setText('');
  }

  function addFull(items: FullCardItem[]) {
    setCards((prev) => mergeCards(prev, items.map((c) => ({ ...c, id: c.id || crypto.randomUUID() }))));
  }

  function apply() {
    onApply(cards.length ? { cards, kind: detectKind(cards) } : null);
    onClose();
  }

  const btn = 'min-h-11 rounded-xl border border-outline-variant bg-white px-4 py-2 text-base font-bold text-deep-navy focus-visible:outline-4 focus-visible:outline-primary disabled:opacity-40';
  return (
    <AccessibleDialog label={t('whiteboard.materialTitle')} onClose={onClose}>
      <div className="max-h-[88dvh] space-y-4 overflow-y-auto p-5 sm:p-7" data-board-material>
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-deep-navy">{t('whiteboard.materialTitle')}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{t('whiteboard.materialHelp')}</p>
          </div>
          <button type="button" className={btn} onClick={onClose}>
            {t('whiteboard.close')}
          </button>
        </header>

        <textarea
          aria-label={t('whiteboard.materialTitle')}
          className="min-h-32 w-full rounded-xl border border-outline-variant p-3"
          value={text}
          placeholder={t('whiteboard.materialPlaceholder')}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={`${btn} bg-primary! text-white!`} disabled={!text.trim()} onClick={() => void addText()}>
            +
          </button>
          <button type="button" className={btn} onClick={() => addFull(cardsFromLines(BOARD_SAMPLE_WORDS))}>
            {t('whiteboard.materialSample')}
          </button>
        </div>

        <div className="space-y-2 rounded-xl bg-surface-container-low p-3">
          <div className="text-sm font-bold text-on-surface-variant">{t('whiteboard.materialLists')}</div>
          <WordListPicker variant="full" wordLists={lists.filter((l) => l.kind !== 'sentence')} loading={loading} onImportFull={addFull} />
          <WordListPicker variant="full" kind="sentence" wordLists={lists.filter((l) => l.kind === 'sentence')} loading={loading} onImportFull={addFull} />
          <SentenceBankPicker onImportLabels={(lines) => addFull(cardsFromLines(lines))} />
        </div>

        <section aria-label={t('whiteboard.materialCount', { n: cards.length })}>
          <div className="mb-2 text-sm font-bold text-deep-navy">{t('whiteboard.materialCount', { n: cards.length })}</div>
          <ul className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
            {cards.map((c) => (
              <li key={c.id} className="flex items-center gap-1 rounded-full border border-outline-variant bg-white px-3 py-1 text-sm">
                <span className="font-bold">{c.word}</span>
                {c.meaning && <span className="text-on-surface-variant">· {c.meaning}</span>}
                <button type="button" aria-label={`${c.word} ✕`} className="ml-1 text-on-surface-variant hover:text-error" onClick={() => setCards((prev) => prev.filter((x) => x.id !== c.id))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={`${btn} bg-primary! text-white!`} onClick={apply}>
            {t('whiteboard.materialApply')}
          </button>
          <button type="button" className={btn} disabled={!cards.length} onClick={() => setCards([])}>
            {t('whiteboard.materialClear')}
          </button>
        </div>
      </div>
    </AccessibleDialog>
  );
}
