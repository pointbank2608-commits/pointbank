import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type MaterialDraftItem = {
  id: string; text: string; meaning: string; included: boolean; focusOnMount?: boolean;
};
type DraftEdit = Partial<Pick<MaterialDraftItem, 'text' | 'meaning' | 'included'>>;

export default function MaterialDraftReview({ title, items, disabled, onEdit, source, actions }: {
  title: string;
  items: MaterialDraftItem[];
  disabled?: boolean;
  onEdit: (id: string, update: DraftEdit) => void;
  source?: (index: number) => ReactNode;
  actions?: { addLabel: string; removeLabel: string; onAdd: () => void; onRemove: (id: string) => void };
}) {
  const { t } = useTranslation();
  const addButton = useRef<HTMLButtonElement>(null);
  return <fieldset disabled={disabled}>
    <legend>{title}</legend>
    {actions && <button ref={addButton} type="button" className="textbook-button textbook-draft-add" onClick={actions.onAdd}>
      <span className="material-symbols-outlined" aria-hidden="true">add</span>{actions.addLabel}
    </button>}
    {!items.length && <p>{t('aiMaterials.noItems')}</p>}
    {items.map((item, index) => <div className="textbook-item" key={item.id}>
      <div className="textbook-actions">
        <label className="textbook-check">
          <input type="checkbox" checked={item.included} onChange={e => onEdit(item.id, { included: e.target.checked })} />
          {t('textbook.include')}
        </label>
        {source?.(index)}
        {actions && <button type="button" className="textbook-button textbook-draft-remove"
          aria-label={item.text.trim() ? item.text.trim() + ' · ' + actions.removeLabel : actions.removeLabel}
          onClick={() => { actions.onRemove(item.id); addButton.current?.focus(); }}>
          <span className="material-symbols-outlined" aria-hidden="true">delete</span>{t('common.delete')}
        </button>}
      </div>
      <div className="textbook-fields">
        <label>{t('textbook.english')}<input value={item.text} maxLength={100} autoFocus={item.focusOnMount}
          onChange={e => onEdit(item.id, { text: e.target.value })} /></label>
        <label>{t('textbook.meaning')}<input value={item.meaning} maxLength={160} onChange={e => onEdit(item.id, { meaning: e.target.value })} /></label>
      </div>
    </div>)}
  </fieldset>;
}
