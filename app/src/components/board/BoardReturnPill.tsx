import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clearBoardReturn, hasBoardReturn } from '../../lib/boardMaterial';

/** 전자칠판에서 게임·활동지로 나갔을 때 화면 구석에 뜨는 "칠판으로 돌아가기" 띠. 판서와 오늘 자료는 그대로 이어진다. */
export default function BoardReturnPill() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(hasBoardReturn() && (pathname.startsWith('/games/') || pathname.startsWith('/materials/')));
  }, [pathname]);

  if (!on) return null;
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
