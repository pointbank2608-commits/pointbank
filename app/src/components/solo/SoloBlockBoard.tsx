import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { kindOf, STEP_KINDS } from '../../lib/soloEdit';
import { PRINTABLE_STEP_TYPES } from '../../lib/soloPrint';
import { WORD_BLOCK_TYPES } from '../../lib/soloLessons';
import type { SoloStep } from '../../lib/soloLessons';
import { buildBoard, formatMinutes, sameStepSource, type BoardBlock } from '../../lib/soloBoard';
import type { WordList } from '../../lib/types';

/**
 * 개별수업 "블록 보드"(BLOCK_SPEC 4단계) — 수업 전체를 그룹 > 블록 카드로 한눈에 보고, 블록 단위로 고친다.
 * 문제 하나하나는 "문제 보기"로 들어가 고친다. 저장되는 것은 지금처럼 문제 목록이다(서버 채점은 그대로).
 */
export interface BoardActions {
  setMinutes: (n: number) => void;
  groupUpdate: (intro: number, patch: { title?: string; minutes?: number | null }) => void;
  groupMove: (gi: number, dir: -1 | 1) => void;
  groupRemove: (gi: number) => void;
  groupAdd: (title: string) => void;
  blockCount: (b: BoardBlock, n: number) => void;
  blockMove: (b: BoardBlock, dir: -1 | 1) => void;
  blockCopy: (b: BoardBlock) => void;
  blockRemove: (b: BoardBlock) => void;
  blockRegen: (b: BoardBlock) => void;
  blockPickList: (b: BoardBlock, listId: string) => void;
  blockOpen: (b: BoardBlock) => void;
  blockAdd: (gi: number, type: SoloStep['t']) => void;
  capacity: (b: BoardBlock) => number;
  /** 수업 맨 끝에 시험 블록 넣기 */
  testAddEnd: () => void;
  /** 그룹 끝에 글(가사·대사)로 만든 블록 넣기 */
  textAdd: (gi: number) => void;
  /** 이 블록의 문제를 인쇄 */
  blockPrint: (b: BoardBlock) => void;
}

export default function SoloBlockBoard({
  steps,
  minutes,
  lessonWordCount,
  wordLists,
  problemIndexes,
  actions,
}: {
  steps: SoloStep[];
  minutes: number;
  lessonWordCount: number;
  /** null = 불러오는 중, 빈 배열 = 단어장 없음 */
  wordLists: WordList[] | null;
  /** 저장 전 검사에서 걸린 문제 위치 */
  problemIndexes: Set<number>;
  actions: BoardActions;
}) {
  const { t } = useTranslation();
  const board = useMemo(() => buildBoard(steps), [steps]);
  const [paletteFor, setPaletteFor] = useState<number | null>(null);
  const [newGroup, setNewGroup] = useState('');
  const est = formatMinutes(board.totalSeconds);
  const blockCount = board.groups.reduce((n, g) => n + g.blocks.filter((b) => b.type !== 'intro').length, 0);
  const iconBtn = 'rounded p-1 text-on-surface-variant hover:bg-surface-container hover:text-primary disabled:opacity-30';
  const field = 'rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1 text-sm text-on-surface outline-none focus:border-primary';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* 한눈에: 수업 요약 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-primary-fixed/25 px-4 py-3">
        <span className="font-label-md text-label-md font-bold text-deep-navy">{t('soloBoard.summary', { groups: board.groups.filter((g) => g.intro !== null).length, blocks: blockCount, steps: board.totalSteps })}</span>
        <span className="font-caption text-caption text-on-surface-variant">{t('soloBoard.estimate', { n: est })}</span>
        <button type="button" onClick={() => actions.textAdd(Math.max(0, board.groups.length - 1))} className="ml-auto flex items-center gap-1 rounded-full bg-tertiary-fixed/70 px-3 py-1 font-label-md text-label-md text-deep-navy hover:bg-tertiary-fixed">
          <span className="material-symbols-outlined text-[18px]">lyrics</span>
          {t('soloText.addButton')}
        </button>
        <button type="button" onClick={actions.testAddEnd} className="flex items-center gap-1 rounded-full bg-secondary-container/70 px-3 py-1 font-label-md text-label-md text-on-secondary-container hover:bg-secondary-container">
          <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
          {t('soloTest.addButton')}
        </button>
        {Math.abs(est - minutes) >= 3 && (
          <button type="button" onClick={() => actions.setMinutes(est)} className="font-caption text-caption text-primary hover:underline">
            {t('soloBoard.matchMinutes', { n: est })}
          </button>
        )}
      </div>

      {board.groups.length === 0 && <p className="py-8 text-center font-body-md text-on-surface-variant">{t('soloBoard.empty')}</p>}

      {board.groups.map((g, gi) => (
        <section key={`${g.start}`} className="space-y-2 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-3 shadow-sm">
          {/* 그룹 머리 */}
          {g.intro !== null ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-label-md text-label-md font-bold text-on-primary">{g.no}</span>
              <input
                key={`${g.intro}-${g.title}`}
                defaultValue={g.title}
                onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== g.title && actions.groupUpdate(g.intro as number, { title: e.target.value.trim() })}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                aria-label={t('soloBoard.groupName')}
                className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 font-title-md text-title-md font-bold text-deep-navy outline-none focus:border-primary focus:bg-surface-container-low"
              />
              <label className="flex items-center gap-1 font-caption text-caption text-on-surface-variant">
                <input
                  type="number"
                  min={1}
                  max={90}
                  defaultValue={g.minutes ?? ''}
                  key={`${g.intro}-m${g.minutes}`}
                  onBlur={(e) => {
                    const v = Math.round(Number(e.target.value));
                    if (v >= 1 && v !== g.minutes) actions.groupUpdate(g.intro as number, { minutes: v });
                  }}
                  aria-label={t('soloBoard.groupMinutes')}
                  className={`${field} w-14 text-center tabular-nums`}
                />
                {t('soloBoard.minutesUnit')}
              </label>
              <span className="font-caption text-caption text-on-surface-variant">{t('soloBoard.groupEstimate', { n: formatMinutes(g.seconds) })}</span>
              <span className="flex items-center">
                <button type="button" disabled={gi <= (board.groups[0].intro === null ? 1 : 0)} onClick={() => actions.groupMove(gi, -1)} aria-label={t('soloBoard.groupUp')} className={iconBtn}>
                  <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
                </button>
                <button type="button" disabled={gi >= board.groups.length - 1} onClick={() => actions.groupMove(gi, 1)} aria-label={t('soloBoard.groupDown')} className={iconBtn}>
                  <span className="material-symbols-outlined text-[20px]">arrow_downward</span>
                </button>
                <button type="button" onClick={() => actions.groupRemove(gi)} aria-label={t('soloBoard.groupDelete')} className={`${iconBtn} hover:text-error`}>
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </span>
            </div>
          ) : (
            <div className="font-caption text-caption text-on-surface-variant">{t('soloBoard.ungrouped')}</div>
          )}

          {/* 블록 카드 */}
          <ul className="space-y-2">
            {g.blocks.map((b, bi) => {
              const k = kindOf(b.type);
              const bad = [...problemIndexes].some((p) => p >= b.start && p <= b.end);
              const isIntro = b.type === 'intro';
              const isTest = b.type === 'test';
              const test = isTest ? (steps[b.start] as Extract<SoloStep, { t: 'test' }>) : null;
              const cap = actions.capacity(b);
              const canRegen = (WORD_BLOCK_TYPES as readonly string[]).includes(b.type) && lessonWordCount >= 4;
              return (
                <li key={`${b.start}-${bi}`} className={`rounded-xl border p-2.5 ${bad ? 'border-error bg-error/5' : 'border-outline-variant/50 bg-surface'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`material-symbols-outlined shrink-0 text-[24px] ${bad ? 'text-error' : 'text-primary'}`}>{bad ? 'error' : k.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-label-md text-label-md font-bold text-on-surface">{t(`soloEdit.stepType_${b.type}`)}</div>
                      {test && <div className="truncate font-caption text-caption text-on-surface-variant">{test.title} · {t('soloTest.boardInfo', { count: test.items.length })}{test.timed ? ` · ${t('soloTest.timedShort')}` : ''}</div>}
                      {b.words.length > 0 && <div className="truncate font-caption text-caption text-on-surface-variant">{b.words.join(' · ')}{b.count > b.words.length ? ' …' : ''}</div>}
                      {(WORD_BLOCK_TYPES as readonly string[]).includes(b.type) && (
                        <div className="mt-0.5 flex items-center gap-1 font-caption text-caption">
                          <span className="material-symbols-outlined text-[14px] text-primary">book_2</span>
                          <span className={b.source && b.source !== 'mixed' && !sameStepSource(b.source, board.lessonSource) ? 'font-bold text-primary' : 'text-on-surface-variant'}>
                            {b.source === 'mixed'
                              ? t('soloBoard.sourceMixed')
                              : b.source && sameStepSource(b.source, board.lessonSource)
                                ? t('soloBoard.sourceLessonNamed', { name: b.source.name })
                                : b.source
                                  ? t('soloBoard.source', { name: b.source.name })
                                  : t('soloBoard.sourceLesson')}
                          </span>
                        </div>
                      )}
                    </div>
                    {!isIntro && !isTest && (
                      <span className="flex shrink-0 items-center gap-1 font-caption text-caption text-on-surface-variant">
                        <button type="button" onClick={() => actions.blockCount(b, b.count - 1)} disabled={b.count <= 1} aria-label={t('soloEdit.blockFewer')} className="rounded-full border border-outline-variant px-1.5 leading-5 hover:border-primary disabled:opacity-30">−</button>
                        <span className="min-w-[3.2rem] text-center tabular-nums text-on-surface">{t('soloBoard.questions', { n: b.count })}</span>
                        <button type="button" onClick={() => actions.blockCount(b, b.count + 1)} disabled={b.count >= cap} aria-label={t('soloEdit.blockMore')} className="rounded-full border border-outline-variant px-1.5 leading-5 hover:border-primary disabled:opacity-30">+</button>
                      </span>
                    )}
                    <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption tabular-nums text-on-surface-variant">{t('soloBoard.about', { n: formatMinutes(b.seconds) })}</span>
                  </div>
                  {b.edited > 0 && <div className="mt-1 font-caption text-caption text-on-surface-variant">✎ {t('soloBoard.edited', { n: b.edited })}</div>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button type="button" onClick={() => actions.blockOpen(b)} className="rounded-full bg-primary/10 px-3 py-1 font-label-md text-label-md text-primary hover:bg-primary/20">
                      {t('soloBoard.openQuestions')}
                    </button>
                    {(PRINTABLE_STEP_TYPES as string[]).includes(b.type) && (
                      <button type="button" onClick={() => actions.blockPrint(b)} className="flex items-center gap-1 rounded-full border border-outline-variant px-3 py-1 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary">
                        <span className="material-symbols-outlined text-[16px]">print</span>
                        {t('soloPrint.blockButton')}
                      </button>
                    )}
                    {isTest && (
                      <button type="button" onClick={() => actions.blockRegen(b)} className="rounded-full border border-outline-variant px-3 py-1 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary">
                        {t('soloTest.regenButton')}
                      </button>
                    )}
                    {canRegen && (
                      <button type="button" onClick={() => actions.blockRegen(b)} className="rounded-full border border-outline-variant px-3 py-1 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary">
                        {b.source && b.source !== 'mixed' && !sameStepSource(b.source, board.lessonSource) ? t('soloBoard.revertLesson') : t('soloBoard.regen')}
                      </button>
                    )}
                    {(WORD_BLOCK_TYPES as readonly string[]).includes(b.type) && wordLists && wordLists.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => e.target.value && actions.blockPickList(b, e.target.value)}
                        className={`${field} max-w-[11rem]`}
                        aria-label={t('soloBoard.otherList')}
                      >
                        <option value="">{t('soloBoard.otherList')}</option>
                        {wordLists.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.items.length})
                          </option>
                        ))}
                      </select>
                    )}
                    {!isIntro && (
                      <span className="ml-auto flex items-center">
                        <button type="button" onClick={() => actions.blockMove(b, -1)} aria-label={t('soloEdit.blockUp')} className={iconBtn}>
                          <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                        </button>
                        <button type="button" onClick={() => actions.blockMove(b, 1)} aria-label={t('soloEdit.blockDown')} className={iconBtn}>
                          <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                        </button>
                        <button type="button" onClick={() => actions.blockCopy(b)} aria-label={t('soloEdit.blockCopy')} className={iconBtn}>
                          <span className="material-symbols-outlined text-[18px]">content_copy</span>
                        </button>
                        <button type="button" onClick={() => actions.blockRemove(b)} aria-label={t('soloEdit.blockDelete')} className={`${iconBtn} hover:text-error`}>
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <button type="button" onClick={() => setPaletteFor(gi)} className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-primary/50 py-2 font-label-md text-label-md text-primary hover:bg-primary/5">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t('soloBoard.addBlock')}
          </button>
        </section>
      ))}

      {/* 그룹 추가 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-outline-variant p-3">
        <input
          value={newGroup}
          onChange={(e) => setNewGroup(e.target.value)}
          placeholder={t('soloBoard.newGroupPlaceholder')}
          className={`${field} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={() => {
            actions.groupAdd(newGroup.trim() || t('soloBoard.newGroupDefault'));
            setNewGroup('');
          }}
          className="rounded-full border border-primary px-4 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10"
        >
          + {t('soloBoard.addGroup')}
        </button>
      </div>

      {/* 블록 보관함 */}
      {paletteFor !== null && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={() => setPaletteFor(null)}>
          <div className="max-h-[80vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-surface-container-lowest p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <h3 className="flex-1 font-title-md text-title-md font-bold text-deep-navy">{t('soloBoard.paletteTitle')}</h3>
              <button type="button" onClick={() => setPaletteFor(null)} aria-label={t('common.close')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                actions.textAdd(paletteFor);
                setPaletteFor(null);
              }}
              className="flex w-full items-center gap-2 rounded-xl bg-tertiary-fixed/60 px-3 py-2.5 text-left hover:bg-tertiary-fixed"
            >
              <span className="material-symbols-outlined text-[24px] text-deep-navy">lyrics</span>
              <span className="min-w-0 flex-1">
                <span className="block font-label-md text-label-md font-bold text-deep-navy">{t('soloText.addButton')}</span>
                <span className="block font-caption text-caption text-on-surface-variant">{t('soloText.addHint')}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                actions.blockAdd(paletteFor, 'test');
                setPaletteFor(null);
              }}
              className="flex w-full items-center gap-2 rounded-xl bg-secondary-container/60 px-3 py-2.5 text-left hover:bg-secondary-container"
            >
              <span className="material-symbols-outlined text-[24px] text-on-secondary-container">assignment_turned_in</span>
              <span className="min-w-0 flex-1">
                <span className="block font-label-md text-label-md font-bold text-on-secondary-container">{t('soloTest.addButton')}</span>
                <span className="block font-caption text-caption text-on-surface-variant">{t('soloTest.addHint')}</span>
              </span>
            </button>
            <div>
              <div className="mb-1 font-caption text-caption font-bold text-on-surface-variant">{t('soloEdit.addBlockGroup')}</div>
              {lessonWordCount < 4 && <p className="mb-1 font-caption text-caption text-on-surface-variant">{t('soloEdit.addBlockNeed')}</p>}
              <div className="grid grid-cols-2 gap-1.5">
                {WORD_BLOCK_TYPES.map((bt) => (
                  <button
                    key={bt}
                    type="button"
                    disabled={lessonWordCount < 4}
                    onClick={() => {
                      actions.blockAdd(paletteFor, bt);
                      setPaletteFor(null);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-outline-variant/50 px-2 py-1.5 text-left font-label-md text-label-md text-on-surface hover:border-primary hover:bg-primary/5 disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[18px] text-primary">{kindOf(bt).icon}</span>
                    <span className="truncate">{t(`soloEdit.stepType_${bt}`)}</span>
                  </button>
                ))}
              </div>
            </div>
            {(['learn', 'quiz', 'speak', 'grammar', 'video'] as const).map((grp) => {
              const list = STEP_KINDS.filter((k) => k.group === grp && k.t !== 'intro' && k.t !== 'test' && !(WORD_BLOCK_TYPES as readonly string[]).includes(k.t));
              if (list.length === 0) return null;
              return (
                <div key={grp}>
                  <div className="mb-1 font-caption text-caption font-bold text-on-surface-variant">{t(`soloEdit.group_${grp}`)}</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {list.map((k) => (
                      <button
                        key={k.t}
                        type="button"
                        onClick={() => {
                          actions.blockAdd(paletteFor, k.t);
                          setPaletteFor(null);
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-outline-variant/50 px-2 py-1.5 text-left font-label-md text-label-md text-on-surface hover:border-primary hover:bg-primary/5"
                      >
                        <span className="material-symbols-outlined text-[18px] text-primary">{k.icon}</span>
                        <span className="truncate">{t(`soloEdit.stepType_${k.t}`)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
