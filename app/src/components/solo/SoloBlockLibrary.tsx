import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BLOCKS, findBlock, isGradedSolo } from '../../lib/blocks/registry';
import { STEP_KINDS, kindOf } from '../../lib/soloEdit';
import { PRINTABLE_STEP_TYPES } from '../../lib/soloPrint';
import { WORD_BLOCK_TYPES } from '../../lib/soloLessons';
import type { SoloStep } from '../../lib/soloLessons';

/**
 * 개별수업 "블록 보관함" — 단체수업 편집기의 "슬라이드 추가 → 블록 보관함"과 같은 방식으로 블록을 찾아 넣는다.
 * 범주 칩 + 검색 + 카드(이름·한 줄 설명·채점/인쇄 표시)이고, 카드를 누르면 고른 그룹 끝에 블록이 들어간다.
 * 단체수업 전용 블록(돌림판·판서·점수판처럼 여럿이 함께 하거나 선생님이 조작하는 것)은 아래에 이유와 함께 따로 보여 준다.
 */
type Cat = 'all' | 'make' | 'learn' | 'quiz' | 'speak' | 'grammar' | 'video';
const CATS: Cat[] = ['make', 'learn', 'quiz', 'speak', 'grammar', 'video'];

/** 직접 입력이 필요해 별도 창으로 만드는 묶음 */
type Maker = 'grammar' | 'text' | 'test';

export interface LibraryGroup {
  gi: number;
  title: string;
}

export default function SoloBlockLibrary({
  groups,
  initialGroup,
  lessonWordCount,
  onAddType,
  onMake,
  onClose,
}: {
  groups: LibraryGroup[];
  initialGroup: number;
  lessonWordCount: number;
  onAddType: (gi: number, type: SoloStep['t']) => void;
  onMake: (gi: number, maker: Maker) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const ko = i18n.language.startsWith('ko');
  const [cat, setCat] = useState<Cat>('all');
  const [query, setQuery] = useState('');
  const [gi, setGi] = useState(initialGroup);
  const [showGroupOnly, setShowGroupOnly] = useState(false);
  const q = query.trim().toLowerCase();

  const makers: { id: Maker; icon: string; nameKey: string; helpKey: string }[] = [
    { id: 'grammar', icon: 'spellcheck', nameKey: 'soloGrammar.addButton', helpKey: 'soloGrammar.addHint' },
    { id: 'text', icon: 'lyrics', nameKey: 'soloText.addButton', helpKey: 'soloText.addHint' },
    { id: 'test', icon: 'assignment_turned_in', nameKey: 'soloTest.addButton', helpKey: 'soloTest.addHint' },
  ];

  const kinds = useMemo(() => STEP_KINDS.filter((k) => k.t !== 'intro' && k.t !== 'test'), []);
  const nameOf = (tt: SoloStep['t']) => t(`soloEdit.stepType_${tt}`);
  const helpOf = (tt: SoloStep['t']) => t(`soloEdit.stepHelp_${tt}`, { defaultValue: '' });
  const matches = (text: string) => !q || text.toLowerCase().includes(q);

  const shownMakers = makers.filter((m) => (cat === 'all' || cat === 'make') && matches(`${t(m.nameKey)} ${t(m.helpKey)}`));
  const shownKinds = kinds.filter((k) => (cat === 'all' || cat === k.group) && matches(`${nameOf(k.t)} ${helpOf(k.t)}`));
  const count = (c: Cat) => (c === 'make' ? makers.length : kinds.filter((k) => k.group === c).length);

  // 단체수업에서만 쓰는 블록(개별수업 문제로는 못 쓰는 것)
  const groupOnly = useMemo(
    () => BLOCKS.filter((b) => b.uses.includes('group') && !b.uses.includes('solo') && b.status === 'ready' && b.category !== 'free'),
    [],
  );
  const groupOnlyName = (b: (typeof BLOCKS)[number]) => (b.nameKey ? t(b.nameKey) : b.name?.[ko ? 'ko' : 'en'] ?? b.id);

  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`;
  const card =
    'flex flex-col gap-1 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0';
  const needWords = lessonWordCount < 4;

  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={t('soloLib.title')} onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-surface-container px-5 py-3">
          <span className="material-symbols-outlined text-primary">widgets</span>
          <h3 className="flex-1 font-title-md text-title-md font-bold text-deep-navy">{t('soloLib.title')}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          <p className="font-body-md text-body-md text-on-surface-variant">{t('soloLib.intro')}</p>

          {groups.length > 1 && (
            <label className="flex flex-wrap items-center gap-2 font-caption text-caption text-on-surface-variant">
              {t('soloLib.target')}
              <select value={gi} onChange={(e) => setGi(Number(e.target.value))} className="rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1 text-sm text-on-surface">
                {groups.map((g) => (
                  <option key={g.gi} value={g.gi}>
                    {g.title || t('soloBoard.ungrouped')}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('soloLib.search')}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-2 pl-10 pr-3 text-sm text-on-surface outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setCat('all')} className={chip(cat === 'all')}>
              {t('curriculum.library.all')} <span className="opacity-70">{kinds.length + makers.length}</span>
            </button>
            {CATS.map((c) => (
              <button key={c} type="button" onClick={() => setCat(c)} className={chip(cat === c)}>
                {c === 'make' ? t('soloLib.catMake') : t(`soloEdit.group_${c}`)} <span className="opacity-70">{count(c)}</span>
              </button>
            ))}
          </div>

          {needWords && <p className="rounded-lg bg-warm-yellow/25 px-3 py-2 font-caption text-caption text-on-surface">{t('soloEdit.addBlockNeed')}</p>}

          {shownMakers.length + shownKinds.length === 0 ? (
            <p className="py-6 text-center font-body-md text-on-surface-variant">{t('curriculum.library.empty')}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {shownMakers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onMake(gi, m.id);
                    onClose();
                  }}
                  className={`${card} border-primary/30 bg-primary-fixed/30`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[22px] text-primary">{m.icon}</span>
                    <span className="min-w-0 flex-1 font-label-md text-label-md font-bold text-on-surface">{t(m.nameKey)}</span>
                  </div>
                  <div className="line-clamp-3 font-caption text-caption text-on-surface-variant">{t(m.helpKey)}</div>
                  <div className="flex flex-wrap gap-1.5 font-caption text-caption">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{t('soloLib.catMake')}</span>
                  </div>
                </button>
              ))}
              {shownKinds.map((k) => {
                const isWord = (WORD_BLOCK_TYPES as readonly string[]).includes(k.t);
                const blocked = isWord && needWords;
                const def = findBlock(`solo.${k.t}`);
                const graded = def ? isGradedSolo(def) : false;
                return (
                  <button
                    key={k.t}
                    type="button"
                    disabled={blocked}
                    onClick={() => {
                      onAddType(gi, k.t);
                      onClose();
                    }}
                    className={card}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[22px] text-primary">{kindOf(k.t).icon}</span>
                      <span className="min-w-0 flex-1 font-label-md text-label-md font-bold text-on-surface">{nameOf(k.t)}</span>
                    </div>
                    {helpOf(k.t) && <div className="line-clamp-3 font-caption text-caption text-on-surface-variant">{helpOf(k.t)}</div>}
                    <div className="flex flex-wrap items-center gap-1.5 font-caption text-caption">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{t(`soloEdit.group_${k.group}`)}</span>
                      {graded && <span className="rounded bg-secondary-container/70 px-1.5 py-0.5 text-on-secondary-container">{t('soloLib.graded')}</span>}
                      {(PRINTABLE_STEP_TYPES as readonly string[]).includes(k.t) && <span className="rounded bg-surface-container px-1.5 py-0.5 text-on-surface-variant">{t('soloLib.printable')}</span>}
                      {isWord && <span className="text-on-surface-variant">{t('soloLib.fromWords')}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low/60 p-3">
            <button type="button" onClick={() => setShowGroupOnly((v) => !v)} className="flex w-full items-center gap-2 text-left" aria-expanded={showGroupOnly}>
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">{showGroupOnly ? 'expand_less' : 'expand_more'}</span>
              <span className="font-label-md text-label-md font-bold text-on-surface">{t('soloLib.groupOnlyTitle', { count: groupOnly.length })}</span>
            </button>
            {showGroupOnly && (
              <div className="mt-2 space-y-2">
                <p className="font-caption text-caption text-on-surface-variant">{t('soloLib.groupOnlyHint')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {groupOnly.map((b) => (
                    <span key={b.id} className="rounded-full border border-outline-variant/50 px-2.5 py-1 font-caption text-caption text-on-surface-variant">
                      {groupOnlyName(b)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
