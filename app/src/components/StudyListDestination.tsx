import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchAllWordLists, fetchClasses } from '../lib/api';
import type { ClassRow, WordList, WordListKind } from '../lib/types';

export default function StudyListDestination({ academy, kind, value, onChange, disabled, excludeId, allowNew = true, pickSource = false }: {
  academy: string; kind: WordListKind; value: string; onChange: (id: string, list?: WordList) => void;
  disabled?: boolean; excludeId?: string; allowNew?: boolean; pickSource?: boolean;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<{ lists: WordList[]; classes: ClassRow[] }>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError(false);
    void Promise.all([fetchAllWordLists(academy, kind), fetchClasses(academy)]).then(([lists, classes]) => {
      if (active) setData({ lists, classes });
    }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, [academy, kind, retry]);
  const lists = data?.lists.filter(list => list.id !== excludeId && (!pickSource || list.items.length > 0));
  return <div className="study-list-destination">
    <label>{t(pickSource ? 'aiMaterials.wordSource' : kind === 'word' ? 'aiMaterials.wordDestination' : 'aiMaterials.sentenceDestination')}
      <select value={value} disabled={disabled || !data} required={!allowNew}
        onChange={event => onChange(event.target.value, lists?.find(list => list.id === event.target.value))}>
        <option value="">{t(allowNew ? kind === 'word' ? 'aiMaterials.newWordList' : 'aiMaterials.newSentenceList' : 'aiMaterials.chooseExistingList')}</option>
        {lists?.map(list => <option key={list.id} value={list.id}>
          {list.group_name && `${list.group_name} · `}{list.name} · {list.class_id ? data?.classes.find(row => row.id === list.class_id)?.name ?? t('aiMaterials.classList') : t('wordLists.academyWide')} ({list.items.length})
        </option>)}
      </select>
    </label>
    {error && <p role="alert" className="textbook-error">{t('aiMaterials.destinationLoadFailed')}{' '}
      <button type="button" className="textbook-button" disabled={disabled} onClick={() => setRetry(number => number + 1)}>{t('textbook.retry')}</button>
    </p>}
    {!allowNew && lists?.length === 0 && <p className="textbook-note">{t(pickSource ? 'aiMaterials.noWordSource' : 'aiMaterials.noDestination')}</p>}
  </div>;
}
