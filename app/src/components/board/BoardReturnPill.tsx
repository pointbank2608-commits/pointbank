import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePresenting } from '../../context/LessonRunnerContext';
import { clearBoardReturn, hasBoardReturn } from '../../lib/boardMaterial';

/** 전자칠판에서 게임·활동지로 나갔을 때 화면 구석에 뜨는 "칠판으로 돌아가기" 띠. 판서와 오늘 자료는 그대로 이어진다. */
export default function BoardReturnPill() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [on, setOn] = useState(false);
  const presenting = usePresenting();

  useEffect(() => {
    // 칠판에서 나간 표시는 게임·활동지 화면에서만 의미가 있다. 칠판 자신이나 다른 화면(내 수업·게임 목록 등)으로 가면 지워서,
    // 나중에 내 수업 등에서 게임에 들어갔을 때 "칠판으로 돌아가기"가 뜨지 않게 한다.
    const inItem = pathname.startsWith('/games/') || pathname.startsWith('/materials/');
    if (!inItem) clearBoardReturn();
    setOn(inItem && hasBoardReturn());
  }, [pathname]);

  // 수업 발표 중 열린 게임에는 칠판 표시를 하지 않는다.
  if (!on || presenting) return null;
  return (
    <div className="no-print fixed bottom-4 left-4 z-[45] flex items-center gap-1 rounded-full bg-deep-navy py-1 pl-1 pr-2 text-white shadow-xl" data-board-return>
      <button
        type="button"
        className="min-h-11 rounded-full bg-primary px-5 text-base font-bold text-white focus-visible:outline-4 focus-visible:outline-white"
        onClick={() => {
          clearBoardReturn();
          setOn(false);
          navigate('/whiteboard');
        }}
      >
        {t('whiteboard.returnPill')}
      </button>
      <button
        type="button"
        aria-label={t('whiteboard.close')}
        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"
        onClick={() => {
          clearBoardReturn();
          setOn(false);
        }}
      >
        ✕
      </button>
    </div>
  );
}
