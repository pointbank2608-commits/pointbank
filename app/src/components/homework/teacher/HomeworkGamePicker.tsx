import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from '../../AccessibleDialog';
import { getGameCatalogEntry } from '../../../lib/gameCatalog';
import { SOLO_GAME_NAMES, type SoloGame } from '../../../lib/homework/blocks';
import { WORD_GAMES, SENTENCE_GAMES } from '../../../lib/homework/soloGameCatalog';

export const WORD_HOMEWORK_GAMES = WORD_GAMES.map(({ game }) => game);
const SECTIONS: { id: string; title: [string, string]; help: [string, string]; games: typeof WORD_GAMES }[] = [
  { id: 'word', title: ['단어 암기 게임', 'Word games'], help: ['낱말·뜻·철자를 외우는 게임이에요', 'Words, meanings and spelling'], games: WORD_GAMES },
  { id: 'sentence', title: ['문장 암기 게임', 'Sentence games'], help: ['문장 목록(또는 예문이 있는 낱말)으로 만들어져요. 낱말 순서와 문장 틀을 익혀요', 'Made from sentence lists (or words with examples)'], games: SENTENCE_GAMES },
];

/** 숙제에 넣을 수 있는 게임을 그림 카드로 보여 주고 고르게 하는 창 */
export default function HomeworkGamePicker({ onPick, onClose, available, initial }: {
  onPick: (games: SoloGame[]) => void; onClose: () => void; available?: SoloGame[]; initial?: SoloGame[];
}) {
  const { t, i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const [sel, setSel] = useState<SoloGame[]>(initial ?? []);
  const toggle = (g: SoloGame) => setSel((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  return (
    <AccessibleDialog label={en ? 'Choose a game' : '게임 고르기'} onClose={onClose}>
      <div className="hw-game-picker bg-white p-4 text-deep-navy sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{en ? 'Choose a game for homework' : '숙제에 넣을 게임 고르기'}</h2>
          <button type="button" onClick={onClose} className="min-h-11 rounded-full border border-outline-variant px-4 font-bold">
            {en ? 'Close' : '닫기'}
          </button>
        </div>
        <p className="mb-4 text-sm text-on-surface-variant">
          {en ? 'Only games a child can do alone at home are listed. Tap to select several, then add.' : '집에서 혼자 할 수 있는 게임만 있어요. 여러 개를 눌러 고른 뒤 한꺼번에 추가할 수 있어요. 정답은 서버가 채점하고 기록해요.'}
        </p>
        {SECTIONS.map(sec => ({ ...sec, games: sec.games.filter(({game}) => !available || available.includes(game)) }))
          .filter(sec => sec.games.length > 0).map((sec) => (
          <section key={sec.id} className="mb-6" aria-labelledby={`hw-games-${sec.id}`}>
            <h3 id={`hw-games-${sec.id}`} className="text-lg font-extrabold">{sec.title[en ? 1 : 0]}</h3>
            <p className="mb-3 text-sm text-on-surface-variant">{sec.help[en ? 1 : 0]}</p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sec.games.map(({ game, catalog, note }) => {
            const entry = getGameCatalogEntry(catalog);
            return (
              <li key={game}>
                <button type="button" aria-pressed={sel.includes(game)} onClick={() => toggle(game)} className={`relative flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-card transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-primary ${sel.includes(game) ? 'ring-4 ring-primary' : 'ring-1 ring-outline-variant hover:ring-primary'}`}>
                  <span className={`absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${sel.includes(game) ? 'bg-primary text-on-primary' : 'border-2 border-white bg-black/20 text-transparent'}`} aria-hidden="true">{sel.includes(game) ? sel.indexOf(game) + 1 : '○'}</span>
                  {entry?.cover && <img src={entry.cover} alt="" loading="lazy" className="h-36 w-full object-cover" />}
                  <span className="flex flex-1 flex-col gap-1 p-3">
                    <span className="text-lg font-bold">{entry ? t(entry.nameKey) : SOLO_GAME_NAMES[game][en ? 1 : 0]}</span>
                    {entry && <span className="text-sm text-on-surface-variant">{t(entry.descKey)}</span>}
                    <span className="mt-1 rounded-lg bg-primary/10 px-2 py-1 text-sm font-bold text-deep-navy">{note[en ? 1 : 0]}</span>
                  </span>
                </button>
              </li>
            );
          })}
            </ul>
          </section>
        ))}
        <div className="sticky -bottom-4 -mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant bg-white px-4 py-3 sm:-bottom-6 sm:-mx-6 sm:px-6">
          <span className="text-base font-bold">{en ? `${sel.length} selected` : `${sel.length}개 선택됨`}</span>
          <span className="flex gap-2">
            <button type="button" disabled={sel.length === 0} onClick={() => setSel([])} className="min-h-11 rounded-full border border-outline-variant px-4 font-bold disabled:opacity-40">{en ? 'Clear' : '선택 해제'}</button>
            <button type="button" disabled={!initial && sel.length === 0} onClick={() => onPick(sel)} className="min-h-11 rounded-full bg-primary px-6 font-bold text-on-primary disabled:opacity-40">{initial ? t('wordMemory.applyGames') : en ? 'Add selected' : '선택한 것 추가'}</button>
          </span>
        </div>
      </div>
    </AccessibleDialog>
  );
}
