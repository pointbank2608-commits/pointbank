import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createGameTemplate } from '../lib/api';
import { blockOfSlide } from '../lib/blocks/registry';
import { buildGameContent, lessonGameTemplateName, wordListToCards } from '../lib/gameFromWords';
import type { FullCardItem, LessonSlide, WordList } from '../lib/types';
import { enrichCards, loadWordBank } from '../lib/wordBankCache';

/**
 * 블록 공통 옵션(BLOCK_SPEC §3·§4, 3단계) — 슬라이드의 주 블록이 무엇인지 알려 주고, 어떤 블록이든 같은 방식으로
 * "이 블록만 다른 단어장"을 쓰게 한다. 기본은 수업 단어장을 같이 쓴다.
 *  - 게임: 고른 단어장으로 그 게임 내용을 만들어 붙인다(templateId) — 이 슬라이드 전용 내용이 된다.
 *  - 단어 소개·카드로 외우기·자료실: 그 단어장 낱말을 이 슬라이드의 낱말(words)로 둔다.
 * 슬라이드마다 고른 단어장은 ownWordListId 에 기억해 이름을 보여 준다(되돌리면 수업 단어장을 다시 쓴다).
 */
const WORD_KINDS: LessonSlide['kind'][] = ['game', 'wordshow', 'study', 'material'];

export default function BlockOptionsPanel({
  slide,
  academyId,
  classId,
  lessonName,
  lessonCards,
  lessonListName,
  wordLists,
  onUpdate,
}: {
  slide: LessonSlide;
  academyId: string;
  classId: string | null;
  lessonName: string;
  /** 수업 단어장 낱말 */
  lessonCards: FullCardItem[];
  lessonListName?: string;
  wordLists: WordList[];
  onUpdate: (patch: Partial<LessonSlide>) => void;
}) {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const block = blockOfSlide(slide);
  if (!block) return null;

  const usesWords = WORD_KINDS.includes(slide.kind);
  const isGame = slide.kind === 'game';
  const slideWords: FullCardItem[] | undefined = 'words' in slide ? (slide.words as FullCardItem[] | undefined) : undefined;
  const templateId = slide.kind === 'game' ? slide.templateId : undefined;
  const own = isGame ? !!(slide.ownWordListId && templateId) : !!slideWords?.length;
  const ownList = slide.ownWordListId ? wordLists.find((w) => w.id === slide.ownWordListId) : undefined;
  const ownCount = isGame ? ownList?.items.length ?? 0 : slideWords?.length ?? 0;
  const available = own ? ownCount : lessonCards.length;
  const min = block.needs?.words?.min ?? 0;
  const name = block.nameKey ? t(block.nameKey) : block.name?.[i18n.language.startsWith('ko') ? 'ko' : 'en'] ?? block.id;
  const field = 'min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-sm text-on-surface outline-none focus:border-primary';

  async function pick(listId: string) {
    const list = wordLists.find((w) => w.id === listId);
    if (!list || busy) return;
    setBusy(true);
    try {
      if (slide.kind === 'game') {
        if (!profile) return;
        const cards = enrichCards(wordListToCards(list), await loadWordBank());
        const content = buildGameContent(slide.gameType, cards);
        if (!content) {
          notify(t('curriculum.blockOptions.failToast'), 'error');
          return;
        }
        const tpl = await createGameTemplate({
          academyId,
          classId,
          gameType: slide.gameType,
          name: lessonGameTemplateName(lessonName || t('curriculum.slides.gameContentDefaultName'), list.name),
          items: content.items,
          config: content.config,
          teacherId: profile.id,
        });
        onUpdate({ templateId: tpl.id, ownWordListId: list.id });
      } else {
        onUpdate({ words: wordListToCards(list), ownWordListId: list.id } as Partial<LessonSlide>);
      }
      notify(t('curriculum.blockOptions.madeToast', { name: list.name }));
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  function revert() {
    if (isGame) onUpdate({ templateId: undefined, ownWordListId: undefined });
    else onUpdate({ words: undefined, ownWordListId: undefined } as Partial<LessonSlide>);
  }

  return (
    <section className="space-y-3 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="material-symbols-outlined text-[20px] text-primary">{block.icon}</span>
        <h4 className="font-label-md text-label-md font-bold text-on-surface">{t('curriculum.blockOptions.title')}</h4>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-caption text-caption text-primary">{name}</span>
        <span className="rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant">
          {t(`curriculum.blockOptions.category_${block.category}`)}
        </span>
      </div>

      {!usesWords ? (
        <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.blockOptions.noWords')}</p>
      ) : (
        <div className="space-y-2">
          <div className="font-label-md text-label-md text-on-surface">{t('curriculum.blockOptions.wordsTitle')}</div>
          {own ? (
            <p className="rounded-lg bg-primary/10 px-3 py-2 font-body-md text-body-md text-on-surface">
              {ownList
                ? t('curriculum.blockOptions.ownNow', { name: ownList.name, count: ownCount })
                : isGame
                  ? t('curriculum.blockOptions.ownGame')
                  : t('curriculum.blockOptions.ownCustom', { count: ownCount })}
            </p>
          ) : (
            <p className="rounded-lg bg-surface-container-lowest px-3 py-2 font-body-md text-body-md text-on-surface">
              {lessonListName
                ? t('curriculum.blockOptions.useLesson', { name: lessonListName, count: lessonCards.length })
                : t('curriculum.blockOptions.useLessonNone', { count: lessonCards.length })}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value=""
              disabled={busy || wordLists.length === 0}
              onChange={(e) => void pick(e.target.value)}
              className={field}
              aria-label={t('curriculum.blockOptions.useOther')}
            >
              <option value="">{busy ? t('common.loading') : t('curriculum.blockOptions.useOther')}</option>
              {wordLists.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.items.length})
                </option>
              ))}
            </select>
            {own && (
              <button
                type="button"
                onClick={revert}
                className="rounded-full border border-outline-variant px-3 py-1.5 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary"
              >
                {t('curriculum.blockOptions.revert')}
              </button>
            )}
          </div>
          {min > 0 && available < min && (
            <p className="rounded-lg bg-warm-yellow/25 px-3 py-2 font-caption text-caption text-on-surface">
              {t('curriculum.blockOptions.needMore', { min, count: available })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
