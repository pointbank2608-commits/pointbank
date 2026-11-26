import { useEffect, useMemo, useState } from 'react';
import { GameCategoryFilters, GameThumbnail, type GameFilter } from '../../GameBrowseCards';
import { GAME_BROWSE_GROUPS, gameBrowseGroups, type GameBrowseGroup } from '../../../lib/gameBrowse';
import { getGameCatalogEntry } from '../../../lib/gameCatalog';
import { soloGameCatalogId } from '../../../lib/homework/soloGameCatalog';
import { reviewGameNames, reviewGames, reviewGameSource, type ReviewGame } from '../../../lib/homework/materialReviewGames';
import type { Material } from '../../../lib/homework/materialPlan';
import '../../../styles/lesson-activity-picker.css';
import './material-review-games.css';

function gameEntry(game: ReviewGame) {
  if (game === 'shoot') return undefined;
  const id = game === 'memory' ? 'matchup' : game === 'guess' ? 'anagram' : game === 'flip' ? 'flashcards' : soloGameCatalogId(game);
  return id && getGameCatalogEntry(id);
}

export default function MaterialReviewGames({materials, enabled, games, onEnabled, onGames, en}: {
  materials: Material[]; enabled: boolean; games: ReviewGame[];
  onEnabled: (value: boolean) => void; onGames: (value: ReviewGame[]) => void; en: boolean;
}) {
  const [group, setGroup] = useState<GameFilter>('all');
  const [notice, setNotice] = useState('');
  const options = useMemo(() => reviewGames.map(game => {
    const entry = gameEntry(game);
    const groups: GameBrowseGroup[] = entry ? gameBrowseGroups(entry) : ['word'];
    return {game, entry, groups, ...reviewGameSource(materials, game, en)};
  }), [materials, en]);

  useEffect(() => {
    const invalid = options.filter(option => option.reason && games.includes(option.game));
    if (!invalid.length) return;
    setNotice(invalid.map(option => reviewGameNames[option.game][en ? 1 : 0] + ' · ' + option.reason).join(' '));
    onGames(games.filter(game => !invalid.some(option => option.game === game)));
  }, [options, games, onGames, en]);

  const categoryCount = (category: GameFilter) => category === 'all'
    ? options.length : options.filter(option => option.groups.includes(category)).length;
  const categories: GameFilter[] = ['all', ...GAME_BROWSE_GROUPS.filter(category => categoryCount(category) > 0)];

  return <section className="material-review-games">
    <label className="material-review-heading">
      <input type="checkbox" checked={enabled} onChange={event => {setNotice(''); onEnabled(event.target.checked);}} />
      <strong>{en ? 'Review with games' : '게임으로 복습하기'}</strong><span>{en ? '(optional)' : '(선택)'}</span>
    </label>
    {enabled && <>
      <GameCategoryFilters value={group} groups={categories} onChange={setGroup} count={categoryCount} />
      <ul className="activity-grid material-review-grid">
        {options.filter(option => group === 'all' || option.groups.includes(group)).map(({game, entry, reason, questionCount}) => {
          const selected = !reason && games.includes(game);
          const name = reviewGameNames[game][en ? 1 : 0];
          return <li key={game} className="activity-card" data-selected={selected}>
            <button type="button" className="activity-card-main material-review-option" aria-pressed={selected} disabled={!!reason}
              onClick={() => {setNotice(''); onGames(selected ? games.filter(value => value !== game) : [...games, game]);}}>
              <span className="activity-card-label">
                <span className="material-symbols-outlined activity-icon" aria-hidden="true">{entry?.icon ?? 'target'}</span>
                <strong>{name}</strong>
                {selected && <span className="material-review-check" aria-hidden="true">✓</span>}
              </span>
              <div className="activity-example" aria-hidden="true">
                {entry ? <GameThumbnail game={entry} /> : <span className="material-review-target"><i>↙</i></span>}
              </div>
              <span className="activity-example-tags">
                <span className={reason ? 'is-needed' : 'is-linked'}>
                  {reason || (en ? `Available · ${questionCount} items` : `선택 자료로 진행 가능 · ${questionCount}개`)}
                </span>
              </span>
            </button>
          </li>;
        })}
      </ul>
    </>}
    {notice && <small role="status">{notice}</small>}
  </section>;
}
