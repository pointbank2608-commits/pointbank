import { useEffect, useMemo, useState } from 'react';
import AccessibleDialog from '../../AccessibleDialog';
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

export default function MaterialReviewGames({materials, games, onGames, en}: {
  materials: Material[]; games: ReviewGame[];
  onGames: (value: ReviewGame[]) => void; en: boolean;
}) {
  const [draft,setDraft]=useState<ReviewGame[]|null>(null);
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
    <div className="material-review-heading"><strong>{en?'Review games':'게임으로 복습하기'}</strong>
      <button type="button" className="hw-small-action" onClick={()=>{setGroup('all');setDraft([...games]);}}>
        {games.length ? (en?'Edit review games':'복습 게임 변경') : (en?'Add review games':'복습 게임 추가')}</button>
    </div>
    {games.length>0 && <p>{games.map(game=>reviewGameNames[game][en?1:0]).join(' · ')}</p>}
    {draft && <AccessibleDialog label={en?'Choose review games':'복습 게임 선택'} onClose={()=>setDraft(null)} className="hw-review-picker">
      <header><h2>{en?'Choose review games':'복습 게임 선택'}</h2><button type="button" onClick={()=>setDraft(null)}>{en?'Close':'닫기'}</button></header>
      <GameCategoryFilters value={group} groups={categories} onChange={setGroup} count={categoryCount} />
      <ul className="activity-grid material-review-grid">
        {options.filter(option => group === 'all' || option.groups.includes(group)).map(({game, entry, reason, questionCount}) => {
          const selected = !reason && draft.includes(game);
          const name = reviewGameNames[game][en ? 1 : 0];
          return <li key={game} className="activity-card" data-selected={selected}>
            <button type="button" className="activity-card-main material-review-option" aria-pressed={selected} disabled={!!reason}
              onClick={() => setDraft(selected ? draft.filter(value=>value!==game) : [...draft,game])}>
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
      <footer><button type="button" onClick={()=>setDraft(null)}>{en?'Cancel':'취소'}</button>
        <button type="button" className="hw-forward" onClick={()=>{onGames(draft.filter(game=>options.some(o=>o.game===game && !o.reason)));setNotice('');setDraft(null);}}>{en?'Apply':'적용'}</button></footer>
    </AccessibleDialog>}
    {notice && <small role="status">{notice}</small>}
  </section>;
}
