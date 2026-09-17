import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from './AccessibleDialog';
import { GAME_CATALOG, isFreeTierGame } from '../lib/gameCatalog';
import { prepareWordListGame, WORD_LIST_GAMES, type WordListGame } from '../lib/wordListLaunch';
import type { ClassRow, WordList } from '../lib/types';

export default function WordListGameLauncher({ list, classes, selectedClassId, isPaid, busy, error, onClose, onLaunch }: {
  list: WordList; classes: ClassRow[]; selectedClassId: string | null; isPaid: boolean;
  busy: boolean; error: boolean; onClose: () => void;
  onLaunch: (game: WordListGame, classId: string) => void;
}) {
  const { t } = useTranslation();
  const [game, setGame] = useState<WordListGame>('wheel');
  const [classId, setClassId] = useState(() => {
    const preferred = list.class_id ?? selectedClassId;
    return classes.some((row) => row.id === preferred) ? preferred! : classes[0]?.id ?? '';
  });
  const prepared = useMemo(() => prepareWordListGame(list.items, game), [list.items, game]);
  const canLaunch = prepared.ready && classes.some((row) => row.id === classId) && (isPaid || isFreeTierGame(game));
  return (
    <AccessibleDialog label={t('classroomUx.launchTitle')} onClose={() => { if (!busy) onClose(); }}>
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-deep-navy">{t('classroomUx.launchTitle')}</h2>
            <p className="mt-1 break-words font-semibold text-primary">{list.name}</p>
          </div>
          <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-lg px-3 text-on-surface-variant">{t('common.close')}</button>
        </div>
        <p className="mt-3 leading-relaxed text-on-surface-variant">{t('classroomUx.launchHint')}</p>
        <fieldset disabled={busy} className="mt-5 space-y-5 disabled:opacity-60">
          <label className="block font-semibold">
            {t('classroomUx.chooseClass')}
            <select value={classId} onChange={(event) => setClassId(event.target.value)} className="mt-2 block min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3">
              {classes.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
          {classes.length === 0 && <p>{t('classroomUx.noClass')}</p>}
          <fieldset>
            <legend className="mb-2 font-semibold">{t('classroomUx.chooseGame')}</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {WORD_LIST_GAMES.map((type) => {
                const entry = GAME_CATALOG.find((item) => item.type === type)!;
                const locked = !isPaid && !isFreeTierGame(type);
                return <button key={type} type="button" disabled={locked} aria-pressed={game === type} onClick={() => setGame(type)}
                  className={`min-h-16 rounded-xl border-2 p-3 text-left disabled:opacity-60 ${game === type ? 'border-primary bg-primary/5' : 'border-outline-variant/40'}`}>
                  <span className="flex items-center gap-2 font-semibold"><span aria-hidden className="material-symbols-outlined">{game === type ? 'check_circle' : entry.icon}</span>{t(entry.nameKey)}</span>
                  <span className="mt-1 block text-sm text-on-surface-variant">{locked ? t('classroomUx.paidGame') : t(entry.descKey)}</span>
                </button>;
              })}
            </div>
          </fieldset>
        </fieldset>
        <p aria-live="polite" className="mt-4 text-sm text-on-surface-variant">
          {prepared.ready ? t('classroomUx.usableWords', { count: prepared.count }) : t('classroomUx.needWords')}
        </p>
        {error && <p role="alert" className="mt-3 rounded-xl bg-error-container p-3 text-on-error-container">{t('classroomUx.launchFailed')}</p>}
        <button type="button" disabled={busy || !canLaunch} onClick={() => onLaunch(game, classId)} className="mt-5 min-h-12 w-full rounded-xl bg-primary px-5 py-3 font-bold text-on-primary disabled:opacity-50">
          {busy ? t('classroomUx.creating') : t('classroomUx.createAndPlay')}
        </button>
      </div>
    </AccessibleDialog>
  );
}
