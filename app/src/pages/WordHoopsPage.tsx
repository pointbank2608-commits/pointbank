import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
    defaultConfig: () => ({ pairs: [], hoopsTeams: HOOPS_DEFAULTS.teams, hoopsShots: HOOPS_DEFAULTS.shots, hoopsMode: HOOPS_DEFAULTS.mode, hoopsRule: HOOPS_DEFAULTS.rule, hoopsSeconds: HOOPS_DEFAULTS.seconds }),
  });
  const { isStaff, studentClassName, classId, roster, templates, selected, selectedId, setSelectedId, loading, scopeLabel } = g;
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

  const classPicker = <h2 className="font-title-md text-title-md text-on-surface">{t('gameWordHoops.studentClassTitle', { className: studentClassName })}</h2>;

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
      {/* 선생님은 도구줄(반 설정·저장/불러오기)을 쓰므로 반 칩·게임 목록 링크·소개·저장된 게임 칩을 따로 두지 않는다 */}
      {!isStaff && (
        <GameInfoPanel
          description={t('gameWordHoops.infoDescription')}
          steps={t('gameWordHoops.infoSteps', { returnObjects: true }) as string[]}
        />
      )}

      {loading ? (
        <div className="py-16 text-center font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : (
        <div className="space-y-6">
          {selected && !isStaff && (
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy md:font-headline-lg md:text-headline-lg">{selected.name}</h2>
          )}

          <GameThemeFrame gameType="wordhoops" roster={roster} onRestart={() => setRoundKey((k) => k + 1)} className="rounded-[28px] bg-[#fffdf8] p-4 shadow-[0_8px_28px_rgba(0,107,93,0.08)] md:p-6">
            <WordHoops key={roundKey} pairs={pairs} teams={cfg.teams} shots={cfg.shots} mode={cfg.mode} rule={cfg.rule} seconds={cfg.seconds} />
          </GameThemeFrame>

          {usingSample && (
            <div className="text-center font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameWordHoops.emptyStaff') : t('gameWordHoops.emptyStudent')}
            </div>
          )}

          {!isStaff && classPicker}
          {!isStaff && templateRow}
        </div>
      )}
    </div>
  );
}
