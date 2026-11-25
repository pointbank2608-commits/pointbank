import { useAuth } from '../context/AuthContext';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from './AccessibleDialog';
import { GAME_CATALOG, isFreeTierGame } from '../lib/gameCatalog';
import { prepareClassroomGame, isSentenceList } from '../lib/gameWorkspace';
import type { ClassRow, GameType, WordList } from '../lib/types';

export default function WordListGameLauncher({ list, classes, selectedClassId, isPaid, busy, error, onClose, onLaunch }: {
  list: WordList; classes: ClassRow[]; selectedClassId: string | null; isPaid: boolean;
  busy: boolean; error: boolean; onClose: () => void;
  onLaunch: (game: GameType, classId: string) => void;
}) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  // 문장 목록은 문장 게임만, 단어장은 단어 게임만
  const games = GAME_CATALOG.filter((entry) => prepareClassroomGame(entry.type, list));
  const [game, setGame] = useState<GameType>(games[0]?.type ?? 'wheel');
  const preferred = list.class_id ?? selectedClassId;
  const classId = classes.find(row => row.id === preferred)?.id ?? '';
  const prepared = useMemo(() => { const content = prepareClassroomGame(game,list); return { ready: !!content, count: content ? list.items.filter(item => item.word.trim()).length : 0 }; }, [list, game]);
  const canLaunch = prepared.ready && (isPaid || isFreeTierGame(game, profile?.free_game_choices));
  return (
    <AccessibleDialog label={t('classroomUx.launchTitle')} onClose={() => { if (!busy) onClose(); }}>
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-deep-navy">{t('classroomUx.launchTitle')}</h2>
            <p className="mt-1 break-words font-semibold text-primary">{list.name}</p><p className="mt-1 text-sm text-on-surface-variant">{isSentenceList(list)?'문장 모음':'단어장'}</p>
          </div>
          <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-lg px-3 text-on-surface-variant">{t('common.close')}</button>
        </div>
        <p className="mt-3 leading-relaxed text-on-surface-variant">{t('quick.listHint')}</p>
        <fieldset disabled={busy} className="mt-5 space-y-5 disabled:opacity-60">
          <fieldset>
            <legend className="mb-2 font-semibold">{t('classroomUx.chooseGame')}</legend>
            <div className="grid grid-cols-2 gap-3">
              {games.map((entry) => {
                const { type } = entry;
                const locked = !isPaid && !isFreeTierGame(type, profile?.free_game_choices);
                return <button key={type} type="button" disabled={locked} aria-pressed={game === type} onClick={() => setGame(type)}
                  className={`flex flex-col items-stretch gap-2 overflow-hidden rounded-xl border-2 p-0 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60 ${game === type ? 'border-primary bg-primary/5' : 'border-outline-variant/40'}`}>
                  <span aria-hidden className="grid aspect-video w-full place-items-center overflow-hidden bg-primary-fixed text-primary">
                    {entry.cover ? <img src={entry.cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      : <span className="material-symbols-outlined text-2xl">{entry.icon}</span>}
                  </span>
                  <span className="min-w-0 p-3">
                    <span className="flex items-start gap-1.5 break-words font-semibold">
                      <span className="min-w-0">{t(entry.nameKey)}</span>
                      {game === type && <span aria-hidden className="material-symbols-outlined shrink-0 text-[1.15rem] text-primary">check_circle</span>}
                    </span>
                    <span className="mt-1 block break-words text-sm text-on-surface-variant">{locked ? t('classroomUx.paidGame') : t(entry.descKey)}</span>
                  </span>
                </button>;
              })}
            </div>
          </fieldset>
        </fieldset>
        <p aria-live="polite" className="mt-4 text-sm text-on-surface-variant">
          {prepared.ready ? t(isSentenceList(list)?'classroomUx.usableSentences':'classroomUx.usableWords', { count: prepared.count }) : t(list.kind === 'sentence' ? 'wordLists.sentence.needSentences' : 'classroomUx.needWords')}
        </p>
        {error && <p role="alert" className="mt-3 rounded-xl bg-error-container p-3 text-on-error-container">{t('classroomUx.launchFailed')}</p>}
        <button type="button" disabled={busy || !canLaunch} onClick={() => onLaunch(game, classId)} className="mt-5 min-h-12 w-full rounded-xl bg-primary px-5 py-3 font-bold text-on-primary disabled:opacity-50">
          {busy ? t('classroomUx.creating') : t('curriculum.play.openGame')}
        </button>
      </div>
    </AccessibleDialog>
  );
}
