import { useTranslation } from 'react-i18next';
import { FONT_SCALES, useFontScale } from '../lib/fontScale';

const GLYPH_PX = { normal: 13, large: 16, xlarge: 19 } as const;

/** 글자 크기(보통·크게·아주 크게). 버튼 글자는 픽셀 고정이라 설정에 따라 토글 자체가 커지지 않는다. */
export default function FontSizeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { t } = useTranslation();
  const [scale, setScale] = useFontScale();
  return (
    <div className="flex items-center gap-2">
      {showLabel && <span className="hidden font-caption text-caption text-on-surface-variant lg:inline">{t('fontScale.label')}</span>}
      <div role="group" aria-label={t('fontScale.label')} className="flex rounded-full bg-surface-container-low p-0.5">
        {FONT_SCALES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={scale === s}
            aria-label={t(`fontScale.${s}`)}
            title={t(`fontScale.${s}`)}
            onClick={() => setScale(s)}
            style={{ fontSize: GLYPH_PX[s] }}
            className={`min-h-9 min-w-9 rounded-full px-2 font-bold leading-none transition-all ${
              scale === s ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            가
          </button>
        ))}
      </div>
    </div>
  );
}
