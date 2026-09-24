import { useTranslation } from 'react-i18next';
import { decorThemes, lineartWordCount } from '../../lib/lineart';
import {
  NEW_WORKSHEET_KINDS,
  type AskTemplate,
  type ColoringLabelMode,
  type ColoringOptions,
  type ColoringPerPage,
} from '../../lib/worksheetGenerators';

function isNewKind(tab: string): boolean {
  return (NEW_WORKSHEET_KINDS as readonly string[]).includes(tab);
}

interface Props {
  tab: string;
  /** 옵션 블록은 단어가 있을 때만 의미가 있어서(예: 없으면 뭘 미리보는지 알 수 없음) 있고 없음만
   * 본다 — WorksheetPrintPage.tsx 의 기존 `words.length > 0` 게이팅과 동일. */
  hasWords: boolean;
  listShow: { pos: boolean; example: boolean; image: boolean };
  onListShowChange: (key: 'pos' | 'example' | 'image', value: boolean) => void;
  tracingShow: { meaning: boolean; image: boolean };
  onTracingShowChange: (key: 'meaning' | 'image', value: boolean) => void;
  showAnswerKey: boolean;
  onShowAnswerKeyChange: (value: boolean) => void;
  coloring: ColoringOptions;
  onColoringChange: (patch: Partial<ColoringOptions>) => void;
  askTemplate: AskTemplate;
  onAskTemplateChange: (value: AskTemplate) => void;
  includeAnswers: boolean;
  onIncludeAnswersChange: (value: boolean) => void;
  /** 다시 섞기는 "저장해둘 설정"이 아니라 그때그때 하는 조작이라 커리큘럼 편집에서는 안 씀 — 그
   * 페이지(WorksheetPrintPage)에서만 넘긴다. */
  onReshuffle?: () => void;
}

/** 워크시트 탭별 세부 옵션 컨트롤 — WorksheetPrintPage.tsx(수업 자료실)와 LessonSlideSorter.tsx
 * (내 커리큘럼 워크시트 슬라이드 추가/수정)가 똑같이 쓴다(2026-09-25, 자료실에만 있던 옵션을
 * 커리큘럼에서도 그대로 설정할 수 있게 뽑아냄). 어떤 블록을 보여줄지는 탭 하나로만 결정한다. */
export default function WorksheetOptionsFields({
  tab,
  hasWords,
  listShow,
  onListShowChange,
  tracingShow,
  onTracingShowChange,
  showAnswerKey,
  onShowAnswerKeyChange,
  coloring,
  onColoringChange,
  askTemplate,
  onAskTemplateChange,
  includeAnswers,
  onIncludeAnswersChange,
  onReshuffle,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      {tab === 'list' && hasWords && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-label-md text-label-md text-on-surface-variant">
          <span>{t('materials.worksheet.listShowLabel')}</span>
          {(['pos', 'example', 'image'] as const).map((key) => (
            <label key={key} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={listShow[key]}
                onChange={(e) => onListShowChange(key, e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              {t(`materials.worksheet.listShow_${key}`)}
            </label>
          ))}
        </div>
      )}

      {tab === 'tracing' && hasWords && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-label-md text-label-md text-on-surface-variant">
          <span>{t('materials.worksheet.listShowLabel')}</span>
          {(['meaning', 'image'] as const).map((key) => (
            <label key={key} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={tracingShow[key]}
                onChange={(e) => onTracingShowChange(key, e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              {t(`materials.worksheet.tracingShow_${key}`)}
            </label>
          ))}
        </div>
      )}

      {tab === 'quiz' && (
        <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant w-fit cursor-pointer">
          <input
            type="checkbox"
            checked={showAnswerKey}
            onChange={(e) => onShowAnswerKeyChange(e.target.checked)}
            className="h-4 w-4 rounded accent-primary"
          />
          {t('materials.worksheet.showAnswerKey')}
        </label>
      )}

      {tab === 'coloring' && hasWords && (
        <div className="space-y-3 rounded-lg border border-outline-variant/50 p-3">
          <label className="flex flex-wrap items-center gap-2 font-label-md text-label-md text-on-surface-variant">
            {t('materials.worksheet.coloringTitleLabel')}
            <input
              value={coloring.title}
              onChange={(e) => onColoringChange({ title: e.target.value })}
              maxLength={40}
              className="min-w-[200px] flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 font-body-md text-body-md text-on-surface"
            />
          </label>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-label-md text-label-md text-on-surface-variant">
            <label className="flex items-center gap-2">
              {t('materials.worksheet.coloringLabelMode')}
              <select
                value={coloring.labelMode}
                onChange={(e) => onColoringChange({ labelMode: e.target.value as ColoringLabelMode })}
                className="rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-on-surface"
              >
                <option value="word">{t('materials.worksheet.coloringModeWord')}</option>
                <option value="write">{t('materials.worksheet.coloringModeWrite')}</option>
                <option value="none">{t('materials.worksheet.coloringModeNone')}</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              {t('materials.worksheet.coloringPerPage')}
              <select
                value={coloring.perPage}
                onChange={(e) => onColoringChange({ perPage: Number(e.target.value) as ColoringPerPage })}
                className="rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-on-surface"
              >
                {[4, 6, 8, 9].map((n) => (
                  <option key={n} value={n}>
                    {t('materials.worksheet.coloringPerPageOption', { count: n })}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              {t('materials.worksheet.coloringTheme')}
              <select
                value={coloring.decorTheme ?? ''}
                onChange={(e) => onColoringChange({ decorTheme: e.target.value || null })}
                className="rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-on-surface"
              >
                <option value="">{t('materials.worksheet.coloringThemeNone')}</option>
                {decorThemes().map((th) => (
                  <option key={th} value={th}>
                    {th}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="font-caption text-caption text-on-surface-variant">
            {t('materials.worksheet.coloringCoverage', { count: lineartWordCount })}
          </p>
        </div>
      )}

      {(tab === 'miniBook' || tab === 'boardGame') && hasWords && (
        <div className="space-y-2 rounded-lg border border-outline-variant/50 p-3">
          <label className="flex flex-wrap items-center gap-2 font-label-md text-label-md text-on-surface-variant">
            {t('materials.worksheet.coloringTitleLabel')}
            <input
              value={coloring.title}
              onChange={(e) => onColoringChange({ title: e.target.value })}
              maxLength={40}
              className="min-w-[200px] flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 font-body-md text-body-md text-on-surface"
            />
          </label>
          {tab === 'miniBook' && (
            <p className="font-caption text-caption text-on-surface-variant">{t('materials.worksheet.miniBookHint')}</p>
          )}
        </div>
      )}

      {tab === 'askAnswer' && hasWords && (
        <label className="flex flex-wrap items-center gap-2 font-label-md text-label-md text-on-surface-variant">
          {t('materials.worksheet.askTemplateLabel')}
          <select
            value={askTemplate}
            onChange={(e) => onAskTemplateChange(e.target.value as AskTemplate)}
            className="rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-on-surface"
          >
            <option value="like">{t('materials.worksheet.askTemplateLike')}</option>
            <option value="have">{t('materials.worksheet.askTemplateHave')}</option>
            <option value="see">{t('materials.worksheet.askTemplateSee')}</option>
          </select>
        </label>
      )}

      {isNewKind(tab) && tab !== 'coloring' && tab !== 'miniBook' && tab !== 'askAnswer' && tab !== 'boardGame' && hasWords && (
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant w-fit cursor-pointer">
            <input
              type="checkbox"
              checked={includeAnswers}
              onChange={(e) => onIncludeAnswersChange(e.target.checked)}
              className="h-4 w-4 rounded accent-primary"
            />
            {t('materials.worksheet.includeAnswerPage')}
          </label>
          {onReshuffle && (
            <button
              type="button"
              onClick={onReshuffle}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-primary text-primary hover:bg-primary/10 font-label-md text-label-md transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                shuffle
              </span>
              {t('materials.worksheet.reshuffle')}
            </button>
          )}
        </div>
      )}
    </>
  );
}
