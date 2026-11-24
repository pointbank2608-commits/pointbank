import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from './AccessibleDialog';
import StudyListDestination from './StudyListDestination';
import { saveAiMaterials, type AiMaterialList } from '../lib/aiMaterials';
import { wordListKindOf } from '../lib/api';
import type { WordList } from '../lib/types';
import '../styles/textbooks.css';

export default function WordListAppendDialog({ academy, owner, source, onClose, onSaved }: {
  academy: string; owner: string; source: WordList; onClose: () => void; onSaved: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [target, setTarget] = useState('');
  const [selected, setSelected] = useState(() => new Set(source.items.map(item => item.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef<AiMaterialList | undefined>(undefined);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || !target || !selected.size) return;
    pending.current ??= { id: target, name: source.name, kind: wordListKindOf(source), append: true,
      items: source.items.filter(item => selected.has(item.id)).map(item => ({ ...item, id: crypto.randomUUID() })) };
    setBusy(true);
    setError(false);
    try {
      await saveAiMaterials(academy, owner, [pending.current]);
      onSaved(pending.current.id);
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  const frozen = busy || error;
  return <AccessibleDialog label={t('aiMaterials.appendToExisting')} onClose={onClose} nativeDismiss={busy ? 'disabled' : 'enabled'}
    className="textbook-chooser textbook-card ai-materials-dialog">
    <header className="textbook-heading"><h3>{t('aiMaterials.appendToExisting')}</h3>
      <button type="button" className="textbook-button" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
    </header>
    <form onSubmit={save} className="ai-materials-form">
      <p className="textbook-note">{t('aiMaterials.appendHelp')}</p>
      <StudyListDestination academy={academy} kind={wordListKindOf(source)} value={target} onChange={setTarget}
        excludeId={source.id} allowNew={false} disabled={frozen} />
      <fieldset disabled={frozen}>
        <legend>{source.name}</legend>
        <label className="textbook-check"><input type="checkbox" checked={selected.size === source.items.length}
          onChange={event => setSelected(new Set(event.target.checked ? source.items.map(item => item.id) : []))} />{t('aiMaterials.selectAll')}</label>
        {source.items.map(item => <label key={item.id} className="textbook-check">
          <input type="checkbox" checked={selected.has(item.id)} onChange={event => setSelected(current => {
            const next = new Set(current);
            if (event.target.checked) next.add(item.id); else next.delete(item.id);
            return next;
          })} />
          <span>{item.word}{item.meaning && ` · ${item.meaning}`}</span>
        </label>)}
      </fieldset>
      {error && <p role="alert" className="textbook-error">{t('aiMaterials.saveFailed')}</p>}
      <button type="submit" className="textbook-button textbook-primary" disabled={busy || !target || !selected.size}>
        {t(busy ? 'textbook.saving' : frozen ? 'aiMaterials.retrySave' : 'aiMaterials.appendSelected')}
      </button>
    </form>
  </AccessibleDialog>;
}
