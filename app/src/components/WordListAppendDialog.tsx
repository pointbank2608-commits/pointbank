import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from './AccessibleDialog';
import StudyListDestination from './StudyListDestination';
import { saveAiMaterials, type AiMaterialList } from '../lib/aiMaterials';
import { wordListKindOf } from '../lib/api';
import type { WordList } from '../lib/types';
import '../styles/textbooks.css';

export default function WordListAppendDialog({ academy, owner, list, pickSource, onClose, onSaved }: {
  academy: string; owner: string; list: WordList; pickSource: boolean; onClose: () => void; onSaved: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<WordList>();
  const source = pickSource ? picked : list;
  const target = pickSource ? list.id : picked?.id;
  const title = t(pickSource ? 'aiMaterials.importFromList' : 'aiMaterials.appendToExisting');
  const [selected, setSelected] = useState(() => new Set(source?.items.map(item => item.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef<AiMaterialList | undefined>(undefined);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || !target || !source || !selected.size) return;
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
  return <AccessibleDialog label={title} onClose={onClose} nativeDismiss={busy ? 'disabled' : 'enabled'}
    className="textbook-chooser textbook-card ai-materials-dialog">
    <header className="textbook-heading"><h3>{title}</h3>
      <button type="button" className="textbook-button" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
    </header>
    <form onSubmit={save} className="ai-materials-form">
      <p className="textbook-note">{pickSource ? t('aiMaterials.importHelp', { name: list.name }) : t('aiMaterials.appendHelp')}</p>
      <StudyListDestination academy={academy} kind={wordListKindOf(list)} value={picked?.id ?? ''} pickSource={pickSource}
        onChange={(_, row) => {
          setPicked(row);
          if (pickSource) setSelected(new Set(row?.items.map(item => item.id)));
        }} excludeId={list.id} allowNew={false} disabled={frozen} />
      {source && <fieldset disabled={frozen}>
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
      </fieldset>}
      {error && <p role="alert" className="textbook-error">{t('aiMaterials.saveFailed')}</p>}
      <button type="submit" className="textbook-button textbook-primary" disabled={busy || !target || !selected.size}>
        {t(busy ? 'textbook.saving' : frozen ? 'aiMaterials.retrySave' : 'aiMaterials.appendSelected')}
      </button>
    </form>
  </AccessibleDialog>;
}
