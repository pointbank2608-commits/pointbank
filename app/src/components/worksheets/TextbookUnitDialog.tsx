import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { textbookUnitName, type TextbookUnit } from '../../lib/textbooks';
import type { WordList } from '../../lib/types';
import '../../styles/textbooks.css';

export default function TextbookUnitDialog({ units, lists, loading, failed, kind, mode, onClose, onRetry, onChoose }: {
  units: TextbookUnit[]; lists: WordList[]; loading: boolean; failed: boolean; kind?: 'sentence';
  mode: 'source' | 'save'; onClose: () => void; onRetry: () => void; onChoose: (unit: TextbookUnit, list?: WordList) => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return <dialog className="textbook-chooser textbook-card no-print" ref={dialog} aria-labelledby="textbook-chooser-title"
    onCancel={e => { e.preventDefault(); onClose(); }}>
    <header className="textbook-heading"><h3 id="textbook-chooser-title">{t('textbook.chooseUnit')}</h3>
      <button type="button" className="textbook-button" onClick={onClose}>{t('common.cancel')}</button></header>
    {loading ? <p role="status">{t('common.loading')}</p> : failed ?
      <p role="alert">{t('textbook.loadFailed')} <button type="button" className="textbook-button" onClick={onRetry}>{t('textbook.retry')}</button></p> :
      !units.length ? <p>{t('textbook.empty')} <Link to="/wordlists?tab=textbooks">{t('textbook.tab')}</Link></p> :
        units.map(unit => {
          if (mode === 'save') return <button type="button" className="textbook-button" key={unit.id} onClick={() => onChoose(unit)}>{textbookUnitName(unit)}</button>;
          const words = kind !== 'sentence' && lists.find(list => list.id === unit.word_list_id && list.items.length);
          const sentences = lists.find(list => list.id === unit.sentence_list_id && list.items.length);
          return <section className="textbook-card" key={unit.id}>
            <h4>{textbookUnitName(unit)}</h4>
            <div className="textbook-actions">
              {words && <button type="button" className="textbook-button" onClick={() => onChoose(unit, words)}>{t('textbook.words')} · {words.items.length}</button>}
              {sentences && <button type="button" className="textbook-button" onClick={() => onChoose(unit, sentences)}>{t('textbook.sentences')} · {sentences.items.length}</button>}
              {!words && !sentences && <p>{t('textbook.noSource')}</p>}
            </div>
          </section>;
        })}
  </dialog>;
}
