import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GameInfoPanel from '../components/GameInfoPanel';
import GameThemeFrame from '../components/GameThemeFrame';
import TugOfWar from '../components/TugOfWar';
import { useGameTemplates } from '../lib/useGameTemplates';
import { pictureWordQuestions } from '../lib/pictureWordQuestions';
import { TUG_DEFAULTS, normalizeTugConfig, playableTugQuestions } from '../lib/tugOfWar';
import type { GameItem, QuizQuestion } from '../lib/types';

function defaultItems(): GameItem[] {
  return [];
}

/** 문제가 하나도 없을 때 바로 시작하는 샘플 문제(전치사) */
function demoQuestions(): QuizQuestion[] {
  const rows: Array<[string, string[], number]> = [
    ['The cat is ___ the box. (상자 안에)', ['in', 'on', 'under', 'behind'], 0],
    ['The book is ___ the table. (탁자 위에)', ['under', 'on', 'in', 'next to'], 1],
    ['The dog is ___ the chair. (의자 아래에)', ['on', 'in', 'under', 'between'], 2],
    ['The ball is ___ the bed. (침대 옆에)', ['next to', 'in', 'on', 'under'], 0],
    ['apple', ['바나나', '사과', '우유', '책'], 1],
    ['She sits ___ Tom and Amy. (톰과 에이미 사이에)', ['on', 'under', 'between', 'in'], 2],
    ['sun', ['달', '별', '해', '구름'], 2],
    ['The bird is ___ the tree. (나무 위쪽에)', ['above', 'under', 'in', 'next to'], 0],
  ];
  return rows.map(([question, choices, correctIndex], i) => ({ id: `demo-${i}`, question, choices, correctIndex }));
}

export default function TugOfWarPage() {
  const { t } = useTranslation();
  const g = useGameTemplates({
    gameType: 'tugofwar',
    defaultItems,
    defaultConfig: () => ({ questions: [], tugPull: TUG_DEFAULTS.pull, tugFreeze: TUG_DEFAULTS.freeze, tugSeconds: TUG_DEFAULTS.seconds }),
  });
  const { isStaff, studentClassName, classId, roster, templates, selected, selectedId, setSelectedId, loading, scopeLabel } = g;
  const [roundKey, setRoundKey] = useState(0);
  const demo = useMemo(demoQuestions, []);
  const cfg = normalizeTugConfig(selected?.config);
  const own = playableTugQuestions(selected?.config.questions);
  const pictures = useMemo(() => pictureWordQuestions(selected?.config), [selected?.config]);
  const pictureMode = selected?.config.tugMode === 'picture';
  const usingSample = own.length < 2;
  const questions = pictureMode ? pictures : usingSample ? demo : own;

  if (g.noClasses) {
    return <div className="py-16 text-center font-body-md text-on-surface-variant">{t('gameAdmin.noClasses')}</div>;
  }
  if (!isStaff && !classId) {
    return <div className="py-16 text-center font-body-md text-on-surface-variant">{t('common.loading')}</div>;
  }

  const classPicker = <h2 className="font-title-md text-title-md text-on-surface">{t('gameTugOfWar.studentClassTitle', { className: studentClassName })}</h2>;

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
          description={t('gameTugOfWar.infoDescription')}
          steps={t('gameTugOfWar.infoSteps', { returnObjects: true }) as string[]}
        />
      )}

      {loading ? (
        <div className="py-16 text-center font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : (
        <div className="space-y-6">
          {selected && !isStaff && (
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy md:font-headline-lg md:text-headline-lg">{selected.name}</h2>
          )}

          <GameThemeFrame gameType="tugofwar" autoStartForSelection roster={roster} onRestart={() => setRoundKey((k) => k + 1)} className="rounded-[28px] bg-[#fffdf8] p-4 shadow-[0_8px_28px_rgba(0,107,93,0.08)] md:p-6">
            <TugOfWar key={roundKey} questions={questions} pull={cfg.pull} freeze={cfg.freeze} seconds={cfg.seconds} />
          </GameThemeFrame>

          {usingSample && !pictureMode && (
            <div className="text-center font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameTugOfWar.emptyStaff') : t('gameTugOfWar.emptyStudent')}
            </div>
          )}

          {!isStaff && classPicker}
          {!isStaff && templateRow}
        </div>
      )}
    </div>
  );
}
