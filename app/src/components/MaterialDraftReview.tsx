import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type MaterialDraftItem = { text: string; meaning: string; included: boolean };

export default function MaterialDraftReview({ title, items, disabled, onEdit, source }: {
  title: string;
  items: MaterialDraftItem[];
  disabled?: boolean;
  onEdit: (index: number, update: Partial<MaterialDraftItem>) => void;
  source?: (index: number) => ReactNode;
}) {
  const { t } = useTranslation();
  return <fieldset disabled={disabled}>
    <legend>{title}</legend>
    {!items.length && <p>{t('aiMaterials.noItems')}</p>}
    {items.map((item, index) => <div className="textbook-item" key={index}>
      <div className="textbook-actions">
        <label className="textbook-check">
          <input type="checkbox" checked={item.included} onChange={e => onEdit(index, { included: e.target.checked })} />
          {t('textbook.include')}
        </label>
        {source?.(index)}
      </div>
      <div className="textbook-fields">
        <label>{t('textbook.english')}<input value={item.text} maxLength={100} onChange={e => onEdit(index, { text: e.target.value })} /></label>
        <label>{t('textbook.meaning')}<input value={item.meaning} maxLength={160} onChange={e => onEdit(index, { meaning: e.target.value })} /></label>
      </div>
    </div>)}
  </fieldset>;
}
