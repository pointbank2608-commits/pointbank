import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import LessonAnnotationLayer from './LessonAnnotationLayer';

/**
 * 수업 자료실(/materials/…) 화면 위에 바로 쓰는 판서 — 수업 발표 밖에서 자료실을 전자칠판에 띄워 쓸 때.
 * 발표 중에는 진행바의 판서를 쓰므로 이 버튼은 보이지 않는다. 선은 저장하지 않고 인쇄에도 안 나온다.
 */
export default function MaterialsPenButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('curriculum.play.annotation')}
          className="no-print fixed bottom-5 right-5 z-30 flex h-14 items-center gap-2 rounded-full bg-primary px-5 font-label-md text-label-md font-bold text-on-primary shadow-lg transition-colors hover:bg-primary-container"
        >
          <span className="material-symbols-outlined">ink_pen</span>
          {t('curriculum.play.annotation')}
        </button>
      )}
      {open && <LessonAnnotationLayer top={0} onClose={() => setOpen(false)} />}
    </>
  );
}
