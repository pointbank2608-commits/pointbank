import { useTranslation } from 'react-i18next';

/**
 * "장면 보기"(2026-10-03) — 영상에서 그 문장이 나오는 부분만 칠판 위에 띄워 틀어 준다(앞 2초 ~ 뒤 6초).
 * Q&A 슬라이드·단어 소개(영상 묶음 단어)가 같이 쓴다. 부모는 position: relative.
 */
export default function SceneOverlay({ videoId, time, onClose }: { videoId: string; time: number; onClose: () => void }) {
  const { t } = useTranslation();
  const start = Math.max(0, Math.floor(time - 2));
  const end = Math.ceil(time + 6);
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-[4cqh]"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="relative aspect-video h-full max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
        <iframe
          title="scene"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?start=${start}&end=${end}&autoplay=1&rel=0&modestbranding=1`}
          className="h-full w-full rounded-[2cqh]"
          allow="autoplay; encrypted-media"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="absolute -right-[2cqh] -top-[2cqh] flex h-[7cqh] w-[7cqh] items-center justify-center rounded-full bg-white text-deep-navy shadow-lg"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '4cqh' }}>
            close
          </span>
        </button>
      </div>
    </div>
  );
}
