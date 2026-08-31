import { useTranslation } from 'react-i18next';
import type { GameTemplateConfig } from '../lib/types';

type ThemeValue = NonNullable<GameTemplateConfig['theme']>;

interface Props {
  value: ThemeValue | null | undefined;
  onChange: (theme: ThemeValue | null) => void;
}

const THEMES: ThemeValue[] = ['space', 'jungle', 'candy'];

export default function GameThemePicker({ value, onChange }: Props) {
  const { t } = useTranslation();

  function handleSelect(v: string) {
    onChange(v === 'default' ? null : (v as ThemeValue));
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="font-label-md text-label-md text-on-surface-variant shrink-0">{t('gameTheme.label')}</span>
      <select
        value={value ?? 'default'}
        onChange={(e) => handleSelect(e.target.value)}
        className="min-w-0 max-w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
      >
        <option value="default">{t('gameTheme.default')}</option>
        {THEMES.map((theme) => (
          <option key={theme} value={theme}>
            {t(`gameTheme.${theme}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
