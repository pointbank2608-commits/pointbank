import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchAllWordLists } from '../../lib/api';
import { loadWordBank } from '../../lib/wordBankCache';
import DictionaryPicker from '../DictionaryPicker';
import WordListPicker from '../WordListPicker';
import type { WordList } from '../../lib/types';
import { buildSoloWordSteps, buildSoloWritingSteps, type SoloStep, type SoloWordStyle } from '../../lib/soloLessons';
import type { FullCardItem } from '../../lib/types';

/** "apple 사과" 또는 "apple" 한 줄 → 영어와 (있으면) 뜻 */
export function parseWordLines(text: string): { word: string; meaning: string }[] {
  const out: { word: string; meaning: string }[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z][A-Za-z' .-]*?)\s*(?:[,:\t=\-–]\s*|\s+)?([가-힣].*)?$/);
    if (!m) continue;
    const word = m[1].trim();
    if (!word || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    out.push({ word, meaning: (m[2] ?? '').trim() });
  }
  return out;
}

/**
 * 단어를 붙여넣으면 사전에서 뜻·그림·예문을 찾아 단어 학습 단계(만나기·고르기·쓰기)를 자동으로 채운다.
 * 사전에 없는 단어는 붙여넣은 뜻을 쓰고, 뜻도 없으면 건너뛴다(어떤 단어가 빠졌는지 알려 준다).
 */
export default function SoloPasteWords({
  academyId,
  hasSteps,
  onAdd,
  onClose,
}: {
  academyId?: string;
  hasSteps: boolean;
  onAdd: (steps: SoloStep[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  // 내 단어장·단어 사전에서 고른 낱말(그 카드의 뜻·그림·예문을 그대로 쓴다). 글칸에도 낱말을 보여 줘서 고칠 수 있다.
  const [picked, setPicked] = useState<Record<string, FullCardItem>>({});
  const [wordLists, setWordLists] = useState<WordList[]>([]);
  const [listsLoading, setListsLoading] = useState(true);

  useEffect(() => {
    if (!academyId) {
      setListsLoading(false);
      return;
    }
    let cancelled = false;
    fetchAllWordLists(academyId)
      .then((l) => !cancelled && setWordLists(l))
      .catch(() => undefined)
      .finally(() => !cancelled && setListsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [academyId]);

  function importCards(cards: FullCardItem[]) {
    const have = new Set(parseWordLines(text).map((p) => p.word.toLowerCase()));
    const next = { ...picked };
    const lines: string[] = [];
    for (const c of cards) {
      const w = c.word.trim();
      if (!w || !/^[A-Za-z]/.test(w)) continue;
      next[w.toLowerCase()] = c;
      if (have.has(w.toLowerCase())) continue;
      have.add(w.toLowerCase());
      // 뜻이 한글로 시작할 때만 같이 적는다(아니면 낱말만 — 뜻은 고른 카드에서 가져온다)
      lines.push(/^[가-힣]/.test(c.meaning.trim()) ? `${w} ${c.meaning.trim()}` : w);
    }
    setPicked(next);
    if (lines.length > 0) setText((cur) => (cur.trim() ? `${cur.replace(/\s+$/, '')}\n` : '') + lines.join('\n'));
  }
  const [style, setStyle] = useState<SoloWordStyle>('picture');
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [error, setError] = useState('');

  const parsed = parseWordLines(text);

  async function build() {
    setBusy(true);
    setError('');
    try {
      const bank = await loadWordBank();
      const byWord = new Map<string, (typeof bank)[number]>();
      for (const e of bank) {
        const k = e.word.toLowerCase();
        if (e.meaning && !byWord.has(k)) byWord.set(k, e);
      }
      const cards: FullCardItem[] = [];
      const miss: string[] = [];
      for (const p of parsed) {
        const pk = picked[p.word.toLowerCase()];
        if (pk && (p.meaning || pk.meaning)) {
          cards.push({ ...pk, word: p.word, meaning: p.meaning || pk.meaning });
          continue;
        }
        const e = byWord.get(p.word.toLowerCase());
        const meaning = p.meaning || e?.meaning || '';
        if (!meaning) {
          miss.push(p.word);
          continue;
        }
        cards.push({
          id: e?.id ?? `paste-${p.word}`,
          word: p.word,
          meaning,
          imageUrl: e?.image_url ?? null,
          category: e?.category ?? null,
          example: e?.example_sentence ?? null,
          partOfSpeech: e?.part_of_speech ?? null,
        });
      }
      setSkipped(miss);
      if (cards.length < 4) {
        setError(t('soloEdit.pasteTooFew'));
        return;
      }
      const built = style === 'writing' ? buildSoloWritingSteps('', cards) : buildSoloWordSteps('', cards);
      // 이미 단계가 있는 수업에 붙일 땐 맨 앞 소개 화면은 뺀다
      onAdd(hasSteps ? built.filter((s) => s.t !== 'intro') : built);
    } catch {
      setError(t('soloEdit.pasteFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg space-y-3 rounded-2xl bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 font-title-md text-title-md font-bold text-deep-navy">{t('soloEdit.pasteTitle')}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <p className="font-caption text-caption text-on-surface-variant">{t('soloEdit.pasteHint')}</p>
        <div className="space-y-2 rounded-xl border border-outline-variant/50 bg-surface-container-low/60 p-3">
          <div className="font-label-md text-label-md font-bold text-deep-navy">{t('soloEdit.pastePickTitle')}</div>
          <p className="font-caption text-caption text-on-surface-variant">{t('soloEdit.pastePickHint')}</p>
          <WordListPicker variant="full" wordLists={wordLists} loading={listsLoading} onImportFull={importCards} />
          <DictionaryPicker variant="full" onImportFull={importCards} />
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={'apple 사과\nbanana\nthank you 고마워요'}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 font-mono text-sm"
        />
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t('soloEdit.pasteStyle')}>
          {(['picture', 'writing'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={style === s}
              onClick={() => setStyle(s)}
              className={`rounded-full border px-3 py-1 font-label-md text-label-md ${style === s ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant'}`}
            >
              {t(`soloEdit.pasteStyle_${s}`)}
            </button>
          ))}
          <span className="ml-auto font-caption text-caption text-on-surface-variant">{t('soloEdit.pasteCount', { count: parsed.length })}</span>
        </div>
        {error && <p className="rounded-lg bg-error/10 px-3 py-2 font-caption text-caption text-error">{error}</p>}
        {skipped.length > 0 && <p className="font-caption text-caption text-on-surface-variant">{t('soloEdit.pasteSkipped', { words: skipped.join(', ') })}</p>}
        <div className="flex items-center gap-2">
          <button type="button" disabled={busy || parsed.length < 4} onClick={() => void build()} className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary disabled:opacity-40">
            {busy ? t('common.loading') : t('soloEdit.pasteMake')}
          </button>
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
