import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import EditOnly from '../components/EditOnly';
import GameInfoPanel from '../components/GameInfoPanel';
import GameThemeFrame from '../components/GameThemeFrame';
import WordHoops from '../components/WordHoops';
import { useGameTemplates } from '../lib/useGameTemplates';
import { HOOPS_DEFAULTS, normalizeHoopsConfig, usablePairs } from '../lib/wordHoops';
import type { GameItem, MatchPair } from '../lib/types';

function defaultItems(): GameItem[] {
  return [];
}

/** 단어가 하나도 없을 때 바로 시작하는 샘플 낱말 */
function demoPairs(): MatchPair[] {
  return [
    ['apple', '사과'],
    ['banana', '바나나'],
    ['cat', '고양이'],
    ['dog', '강아지'],
    ['book', '책'],
    ['sun', '해'],
    ['milk', '우유'],
    ['bird', '새'],
  ].map(([left, right], i) => ({ id: `demo-${i}`, left, right }));
}

export default function WordHoopsPage() {
  const { t } = useTranslation();
  const g = useGameTemplates({
    gameType: 'wordhoops',
    defaultItems,
    defaultConfig: () => ({ pairs: [], hoopsTeams: HOOPS_DEFAULTS.teams, hoopsShots: HOOPS_DEFAULTS.shots, hoopsMode: HOOPS_DEFAULTS.mode }),
  });
  const { isStaff, classes, staffClassId, selectClass, reorderClasses, studentClassName, classId, roster, templates, selected, selectedId, setSelectedId, loading, scopeLabel } = g;
  const [roundKey, setRoundKey] = useState(0);
  const demo = useMemo(demoPairs, []);
  const cfg = normalizeHoopsConfig(selected?.config);
  const own = usablePairs(selected?.config.pairs);
  const usingSample = own.length < 2;
  const pairs = usingSample ? demo : own;

  if (g.noClasses) {
    return <div className="py-16 text-center font-body-md text-on-surface-variant">{t('gameAdmin.noClasses')}</div>;
  }
  if (!isStaff && !classId) {
    return <div className="py-16 text-center font-body-md text-on-surface-variant">{t('common.loading')}</div>;
  }

  const classPicker = isStaff ? (
    <ClassChipRow classes={classes} selectedId={staffClassId} onSelect={selectClass} onReorder={reorderClasses} />
  ) : (
    <h2 className="font-title-md text-title-md text-on-surface">{t('gameWordHoops.studentClassTitle', { className: studentClassName })}</h2>
  );

  const templateRow = templates.length > 0 && (
    <div className="flex flex-wrap gap-2">
      {templates.map((tpl) => (
        <button
          key={tpl.id}
          type="button"
          onClick={() => setSelectedId(tpl.id)}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 font-label-md text-label-md ${
            tpl.id === selectedId ? 'bg-primary text-on-primary' : 'border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant'
          }`}
        >
          {tpl.name}
          <span className="font-caption text-caption opacity-70">{scopeLabel(tpl)}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <EditOnly>
        <Link to="/games" className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant transition-colors hover:text-primary">
          {t('gameAdmin.backToList')}
        </Link>
      </EditOnly>

      <GameInfoPanel
        description={t('gameWordHoops.infoDescription')}
        steps={t('gameWordHoops.infoSteps', { returnObjects: true }) as string[]}
      />

      {loading ? (
        <div className="py-16 text-center font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : (
        <div className="space-y-6">
          {selected && !isStaff && (
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy md:font-headline-lg md:text-headline-lg">{selected.name}</h2>
          )}

          <GameThemeFrame gameType="wordhoops" roster={roster} onRestart={() => setRoundKey((k) => k + 1)} className="rounded-[28px] bg-[#fffdf8] p-4 shadow-[0_8px_28px_rgba(0,107,93,0.08)] md:p-6">
            <WordHoops key={roundKey} pairs={pairs} teams={cfg.teams} shots={cfg.shots} mode={cfg.mode} />
          </GameThemeFrame>

          {usingSample && (
            <div className="text-center font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameWordHoops.emptyStaff') : t('gameWordHoops.emptyStudent')}
            </div>
          )}

          <EditOnly>{classPicker}</EditOnly>
          <EditOnly>{templateRow}</EditOnly>
        </div>
      )}
    </div>
  );
}
