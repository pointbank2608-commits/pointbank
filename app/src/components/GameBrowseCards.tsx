import { useTranslation } from 'react-i18next';
import { GAME_BROWSE_GROUPS, type GameBrowseGroup } from '../lib/gameBrowse';
import type { GameCatalogEntry } from '../lib/gameCatalog';

export type GameFilter = GameBrowseGroup | 'all';
const allFilters = ['all', ...GAME_BROWSE_GROUPS] as const;

export function GameCategoryFilters({value, onChange, count, groups = allFilters}: {
  value: GameFilter;
  onChange: (group: GameFilter) => void;
  count: (group: GameFilter) => number;
  groups?: readonly GameFilter[];
}) {
  const { t } = useTranslation();
  return <div className="activity-game-filters" role="group" aria-label={t('lessonUx.games')}>
    {groups.map(group => <button type="button" key={group} aria-pressed={value === group}
      onClick={() => onChange(group)}>
      {t(group === 'all' ? 'gameCategory.all' : `gameBrowse.${group}`)} {count(group)}
    </button>)}
  </div>;
}

export function GameThumbnail({game, sentenceTokens, prompt, choices}: {
  game: GameCatalogEntry;
  sentenceTokens?: readonly string[];
  prompt?: string;
  choices?: readonly string[];
}) {
  const sentenceScene = sentenceTokens && (game.type === 'wordtrain' || game.type === 'sentencerocket');
  return <div className="activity-game-cover" data-game-scene={game.type}>
    {sentenceScene ? <>
      <img src={game.type === 'wordtrain' ? '/skins/adventure/train.webp' : '/skins/adventure/rocket.webp'} alt="" loading="lazy" />
      <div className={`activity-sentence-scene activity-sentence-${game.type}`}>
        <img src={game.type === 'wordtrain' ? '/skins/adventure/engine.webp' : '/skins/adventure/rocket-sprite.webp'} alt="" />
        <div>{sentenceTokens.map((token, i) => <span key={i}>{token}</span>)}</div>
      </div>
    </> : game.cover ? <img src={game.cover} alt="" loading="lazy" /> : <span className="material-symbols-outlined" aria-hidden>{game.icon}</span>}
    {prompt && !sentenceScene && <div className="activity-game-prompt">
      <b>{prompt}</b>
      {choices?.length ? <div className="activity-game-choices">{choices.slice(0, 5).map((choice, index) => <span key={index}>{choice}</span>)}</div> : null}
    </div>}
  </div>;
}
