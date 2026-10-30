import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from '../../AccessibleDialog';
import { getGameCatalogEntry } from '../../../lib/gameCatalog';
import { SOLO_GAME_NAMES, type SoloGame } from '../../../lib/homework/blocks';
import type { GameType } from '../../../lib/types';

/** 숙제 게임 → 게임 센터 카드(그림·이름·설명)와 숙제에서 달라지는 점 */
const GAMES: { game: SoloGame; catalog: GameType; note: [string, string] }[] = [
  { game: 'matchup', catalog: 'matchup', note: ['숙제에서는 단어와 뜻을 짝지어요(낱말 최대 8개)', 'Pair words with meanings (up to 8)'] },
  { game: 'anagram', catalog: 'anagram', note: ['섞인 글자를 순서대로 눌러 낱말을 만들어요(6개)', 'Tap scrambled letters in order (6)'] },
  { game: 'spelling', catalog: 'spellword', note: ['뜻을 보고 철자를 직접 써요(6개)', 'Write the spelling from the meaning (6)'] },
  { game: 'whack', catalog: 'whackamole', note: ['소리를 듣고 두더지 4마리 중 맞는 낱말을 잡아요(8개)', 'Hear it, whack the right word (8)'] },
  { game: 'fish', catalog: 'wordfishing', note: ['낱말을 보고 알맞은 뜻의 물고기를 낚아요(8개)', 'Catch the fish with the right meaning (8)'] },
  { game: 'balloon', catalog: 'balloonpop', note: ['뜻을 보고 알맞은 낱말 풍선을 터뜨려요(8개)', 'Pop the balloon with the right word (8)'] },
  { game: 'hangman', catalog: 'hangman', note: ['글자를 하나씩 골라 낱말을 맞혀요, 목숨 6개(6개)', 'Guess letters, 6 lives (6)'] },
];

/** 숙제에 넣을 수 있는 게임을 그림 카드로 보여 주고 고르게 하는 창 */
export default function HomeworkGamePicker({ onPick, onClose }: { onPick: (games: SoloGame[]) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const [sel, setSel] = useState<SoloGame[]>([]);
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
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map(({ game, catalog, note }) => {
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
        <div className="sticky -bottom-4 -mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant bg-white px-4 py-3 sm:-bottom-6 sm:-mx-6 sm:px-6">
          <span className="text-base font-bold">{en ? `${sel.length} selected` : `${sel.length}개 선택됨`}</span>
          <span className="flex gap-2">
            <button type="button" disabled={sel.length === 0} onClick={() => setSel([])} className="min-h-11 rounded-full border border-outline-variant px-4 font-bold disabled:opacity-40">{en ? 'Clear' : '선택 해제'}</button>
            <button type="button" disabled={sel.length === 0} onClick={() => onPick(sel)} className="min-h-11 rounded-full bg-primary px-6 font-bold text-on-primary disabled:opacity-40">{en ? 'Add selected' : '선택한 것 추가'}</button>
          </span>
        </div>
      </div>
    </AccessibleDialog>
  );
}
