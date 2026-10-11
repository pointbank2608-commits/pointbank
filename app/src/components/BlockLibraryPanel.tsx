import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BLOCKS } from '../lib/blocks/registry';
import type { BlockCategory, BlockDef } from '../lib/blocks/types';

/**
 * 블록 보관함(BLOCK_SPEC 5단계) — 수업에 넣을 수 있는 블록을 범주별로 모아 보여 주고 검색한다.
 * 기능마다 따로 흩어져 있던 "슬라이드 추가" 갈래(게임 37종·자료실·배우기 화면·영상 …)를 한곳에서 찾게 한다.
 * 고른 블록을 실제로 슬라이드로 만드는 일은 부모(LessonSlideSorter)가 맡는다 — 입력이 필요한 블록은 기존 입력 화면으로 이어 준다.
 */
const ORDER: BlockCategory[] = ['game', 'practice', 'learn', 'print', 'media', 'free', 'helper'];

/** 슬라이드에 직접 놓는 블록이 아닌 보조 블록(다른 곳에서 쓴다) — 안내만 보여 준다 */
const INFO_ONLY: Record<string, string> = {
  'helper.textbox': 'curriculum.library.infoTextbox',
  'helper.picture': 'curriculum.library.infoPicture',
  'helper.annotation': 'curriculum.library.infoAnnotation',
  'helper.points': 'curriculum.library.infoPoints',
};

export default function BlockLibraryPanel({ onPick, canAttachHelper }: { onPick: (block: BlockDef) => void; canAttachHelper: boolean }) {
  const { t, i18n } = useTranslation();
  const ko = i18n.language.startsWith('ko');
  const [cat, setCat] = useState<BlockCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  const nameOf = (b: BlockDef) => (b.nameKey ? t(b.nameKey) : b.name?.[ko ? 'ko' : 'en'] ?? b.id);
  // 단체수업에 넣는 블록만(개별수업 문제 블록은 개별수업 편집기의 보관함에서)
  const list = useMemo(() => BLOCKS.filter((b) => b.uses.includes('group') && b.status === 'ready'), []);
  const q = query.trim().toLowerCase();
  const shown = list.filter((b) => (cat === 'all' || b.category === cat) && (!q || `${nameOf(b)} ${t(`curriculum.blockOptions.category_${b.category}`)}`.toLowerCase().includes(q)));
  const count = (c: BlockCategory) => list.filter((b) => b.category === c).length;
  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`;

  return (
    <div className="space-y-3">
      <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.library.intro')}</p>
      <div className="relative">
        <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">search</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('curriculum.library.search')}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-2 pl-10 pr-3 text-sm text-on-surface outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setCat('all')} className={chip(cat === 'all')}>
          {t('curriculum.library.all')} <span className="opacity-70">{list.length}</span>
        </button>
        {ORDER.filter((c) => count(c) > 0).map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={chip(cat === c)}>
            {t(`curriculum.blockOptions.category_${c}`)} <span className="opacity-70">{count(c)}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="py-6 text-center font-body-md text-on-surface-variant">{t('curriculum.library.empty')}</p>
      ) : (
        <div className="grid max-h-[52vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((b) => {
            const info = INFO_ONLY[b.id];
            const isHelper = b.category === 'helper';
            const disabled = !!info || (isHelper && !canAttachHelper);
            return (
              <button
                key={b.id}
                type="button"
                disabled={disabled}
                onClick={() => onPick(b)}
                className="flex flex-col gap-1 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[22px] text-primary">{b.icon}</span>
                  <span className="min-w-0 flex-1 font-label-md text-label-md font-bold text-on-surface">{nameOf(b)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 font-caption text-caption text-on-surface-variant">
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{t(`curriculum.blockOptions.category_${b.category}`)}</span>
                  {b.needs?.words && b.needs.words.min > 1 && b.needs.words.min <= 30 && <span>{t('curriculum.library.needWords', { n: b.needs.words.min })}</span>}
                </div>
                {info && <div className="font-caption text-caption text-on-surface-variant">{t(info)}</div>}
                {isHelper && !info && (
                  <div className="font-caption text-caption text-on-surface-variant">{canAttachHelper ? t('curriculum.library.helperHint') : t('curriculum.library.helperNeedSlide')}</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
