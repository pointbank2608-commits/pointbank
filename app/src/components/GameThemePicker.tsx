import { useTranslation } from 'react-i18next';
import { GAME_THEMES } from '../lib/gameThemes';

interface Props {
  value: string | null | undefined;
  onChange: (theme: string | null) => void;
}

/** 새 테마를 추가하면 gameThemes.ts 의 GAME_THEMES 배열에만 넣으면 이 선택기에도 자동으로 뜬다. */
export default function GameThemePicker({ value, onChange }: Props) {
  const { t } = useTranslation();

  function handleSelect(v: string) {
    onChange(v === 'default' ? null : v);
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
        {GAME_THEMES.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {t(theme.nameKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
