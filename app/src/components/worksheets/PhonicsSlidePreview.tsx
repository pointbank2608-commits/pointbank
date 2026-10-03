import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPhonicsBank } from '../../lib/api';
import { CVC_READERS, readerCardFromBank, readerIdsForWords } from '../../lib/cvcReaders';
import { fillPhonicsMarks } from '../../lib/phonicsFill';
import { buildWorksheet, chunk, DEFAULT_COLORING_OPTIONS, isWorksheetEmpty, PHONICS_PER_PAGE, type NewWorksheetKind } from '../../lib/worksheetGenerators';
import type { FullCardItem, PhonicsBankEntry, PhonicsSlideOptions } from '../../lib/types';
import { PhonicsListCute, PhonicsTracingCute, ReaderCute } from './PhonicsCuteSheets';
import WorksheetSheets from './WorksheetSheets';

let bankPromise: Promise<PhonicsBankEntry[]> | null = null;
const loadBank = () => (bankPromise ??= fetchPhonicsBank().catch(() => ((bankPromise = null), [])));

/**
 * 수업 만들기의 파닉스 워크시트 슬라이드 미리보기(2026-10-03 "미리보기가 안 보인다" 제보).
 * 발표 때 /materials/phonics 가 그릴 첫 장을 같은 부품으로 작게 그린다 — 단어를 파닉스 자료와 맞추는 방식도 그 페이지와 같다.
 */
export default function PhonicsSlidePreview({ tab, words, options }: { tab: string; words: FullCardItem[]; options: PhonicsSlideOptions }) {
  const { t } = useTranslation();
  const [bank, setBank] = useState<PhonicsBankEntry[] | null>(null);
  useEffect(() => {
    let alive = true;
    void loadBank().then((b) => alive && setBank(b));
    return () => {
      alive = false;
    };
  }, []);

  // 단어 → 파닉스 자료의 같은 낱말(규칙까지 같으면 그것) → 워크시트 카드
  const cards = useMemo<FullCardItem[]>(() => {
    if (!bank) return [];
    const filled = fillPhonicsMarks(words, bank, true);
    const out: FullCardItem[] = [];
    for (const c of filled) {
      const w = c.word.trim().toLowerCase();
      const hit = bank.find((e) => e.word.toLowerCase() === w && (!c.category || e.rule === c.category)) ?? bank.find((e) => e.word.toLowerCase() === w);
      if (hit && !out.some((o) => o.id === hit.id)) {
        out.push({ id: hit.id, word: hit.word, meaning: hit.meaning ?? '', imageUrl: hit.image_url, category: hit.rule, patternMarked: hit.pattern_marked });
      }
    }
    return out;
  }, [bank, words]);

  const color = options.cuteColor !== false;
  const showImage = options.showImage !== false;
  const showMeaning = !!options.showMeaning;
  const imageOf = (word: string | null) => (word ? (bank?.find((e) => e.word.toLowerCase() === word.toLowerCase())?.image_url ?? `/phonics-images/${word.toLowerCase()}.webp`) : null);

  let sheet: React.ReactNode = null;
  if (bank) {
    if (tab === 'phonicsReader') {
      const ids = readerIdsForWords(cards.map((c) => c.word));
      const readers = CVC_READERS.filter((r) => (ids.length ? ids : [1, 2, 3, 4]).includes(r.n)).map(readerCardFromBank);
      sheet = <ReaderCute cards={readers.slice(0, PHONICS_PER_PAGE.reader)} color={color} startIndex={0} imageMode="draw" imageOf={imageOf} />;
    } else if (cards.length > 0 && tab === 'phonicsList') {
      const per = showImage ? PHONICS_PER_PAGE.list : PHONICS_PER_PAGE.list + 2;
      sheet = <PhonicsListCute rows={chunk(cards, per)[0]} color={color} startIndex={0} showImage={showImage} showMeaning={showMeaning} />;
    } else if (cards.length > 0 && tab === 'phonicsTracing') {
      sheet = <PhonicsTracingCute rows={chunk(cards, PHONICS_PER_PAGE.tracing)[0]} color={color} startIndex={0} showImage={showImage} showMeaning={showMeaning} />;
    } else if (cards.length > 0) {
      const data = buildWorksheet(tab as NewWorksheetKind, cards, 1, { coloring: { ...DEFAULT_COLORING_OPTIONS, title: 'Phonics' } });
      if (data && !isWorksheetEmpty(data)) sheet = <WorksheetSheets data={data} includeAnswers={false} cuteColor={color} />;
    }
  }

  if (!bank) return <div className="font-caption text-caption text-on-surface-variant">{t('common.loading')}</div>;
  if (!sheet) return <div className="px-6 text-center font-body-md text-body-md text-on-surface-variant">{t('curriculum.wordSource.phonicsPreviewEmpty')}</div>;
  return (
    <div className="h-full w-full overflow-y-auto bg-white">
      {/* A4(210mm) 를 미리보기 칸 폭에 맞게 줄여 보여 준다 */}
      <div className="print-sheet mx-auto" style={{ zoom: 0.42 }}>
        {sheet}
      </div>
    </div>
  );
}
