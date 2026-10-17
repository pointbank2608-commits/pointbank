import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { usePresenting } from '../context/LessonRunnerContext';
import { useGameEmbed } from '../context/GameEmbedContext';
import { worksheetPathForGame } from '../lib/gameWorksheets';
import { demoForGame } from '../lib/gameDemos';

interface Props {
  description: string;
  steps: string[];
  /** 워크시트 페이지로 넘길 상태(예: 이 게임에 넣은 문장) */
  worksheetState?: unknown;
}

/** 게임 페이지 상단에 붙는 "게임 소개 및 방법" 접이식 패널. 게임 페이지가 전부 공유한다.
 * 커리큘럼 발표 중엔 수업 화면에 필요 없어 숨긴다. */
export default function GameInfoPanel({ description, steps, worksheetState }: Props) {
  const { t } = useTranslation();
  const location = useLocation();
  const embed = useGameEmbed();
  // 수업 만들기 안(embed)에서는 편집 화면을 떠나게 하는 링크를 숨긴다
  const worksheetPath = embed ? null : worksheetPathForGame(location.pathname);
  const demoSrc = demoForGame(location.pathname);
  const [open, setOpen] = useState(false);
  const presenting = usePresenting();

  if (presenting) return null;

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-card overflow-hidden">
      <div className="flex items-center gap-2 pr-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex-1 min-w-0 flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="font-title-md text-title-md text-on-surface flex items-center gap-2">
          <span aria-hidden="true">💡</span>
          {t('gameAdmin.howToPlayTitle')}
        </span>
        <span className="font-label-md text-label-md text-primary shrink-0">
          {open ? t('gameAdmin.collapse') : t('gameAdmin.expand')}
        </span>
      </button>
      {demoSrc && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full border border-primary px-4 py-2 font-label-md text-label-md text-primary transition-colors hover:bg-primary/10"
        >
          ▶ {t('gameAdmin.watchDemo')}
        </button>
      )}
      {worksheetPath && (
        <Link
          to={worksheetPath}
          state={worksheetState}
          className="shrink-0 rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container"
        >
          🖨 {t('gameAdmin.printWorksheet')}
        </Link>
      )}
      </div>
      {open && (
        <div className="px-5 pb-5 space-y-3">
          {demoSrc && (
            <video
              key={demoSrc}
              src={demoSrc}
              className="w-full max-w-[640px] rounded-xl border border-outline-variant/40 shadow-card"
              autoPlay
              loop
              muted
              playsInline
              controls
              preload="metadata"
            />
          )}
          <p className="font-body-md text-body-md text-on-surface-variant">{description}</p>
          <ol className="list-decimal list-inside space-y-1.5 font-body-md text-sm text-on-surface-variant">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
