import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { speak } from '../lib/speech';

export interface StudyCard {
  id: string;
  front: string;
  back: string;
  image_url: string | null;
}

function shuffleIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 전자칠판에 띄워놓고 한 장씩 넘기며 단어를 외우는 카드 뷰. 사전/파닉스/단어장 등 어디서든
 * word+meaning(+image) 목록만 StudyCard[] 로 넘기면 재사용할 수 있다. 학생 개인 진도·간격
 * 반복 저장은 하지 않는다 — 수업 중 다 같이 넘겨보는 용도(선생님 도구 원칙, CLAUDE.md).
 */
export default function FlashcardStudy({
  title,
  cards,
  onClose,
}: {
  title: string;
  cards: StudyCard[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setOrder(Array.from({ length: cards.length }, (_, i) => i));
    setPos(0);
    setFlipped(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  function go(delta: number) {
    setPos((p) => Math.max(0, Math.min(cards.length - 1, p + delta)));
    setFlipped(false);
  }

  function shuffle() {
    setOrder(shuffleIndices(cards.length));
    setPos(0);
    setFlipped(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, cards.length]);

  if (cards.length === 0) return null;
  const current = cards[order[pos]];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-inverse-surface p-4 sm:p-6">
      <div className="flex items-center justify-between text-inverse-on-surface">
        <div className="font-label-md text-label-md tabular-nums">
          {title} · {pos + 1}/{cards.length}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={shuffle}
            title={t('flashcardStudy.shuffle')}
            aria-label={t('flashcardStudy.shuffle')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-inverse-on-surface hover:bg-inverse-on-surface/10"
          >
            <span className="material-symbols-outlined text-[22px]">shuffle</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            title={t('common.cancel')}
            aria-label={t('common.cancel')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-inverse-on-surface hover:bg-inverse-on-surface/10"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center py-4">
        {/* 카드 안에 발음 버튼(별도 <button>)이 있어 카드 자체는 <button>이 아닌
         * role="button" div 로 만든다 — <button> 안에 <button>은 유효한 HTML이 아니다. */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setFlipped((f) => !f)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setFlipped((f) => !f);
            }
          }}
          className="flex h-full max-h-[560px] w-full max-w-[820px] cursor-pointer flex-col items-center justify-center gap-6 rounded-3xl bg-surface-container-lowest px-8 py-10 text-center shadow-xl transition-transform active:scale-[0.99]"
        >
          {!flipped ? (
            <>
              {current.image_url && (
                <img src={current.image_url} alt="" className="max-h-[38%] max-w-full rounded-2xl object-contain" />
              )}
              <div className="flex items-center gap-3">
                <span className="font-title-md text-[clamp(32px,7vw,72px)] font-bold text-deep-navy">{current.front}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    speak(current.front);
                  }}
                  aria-label={t('dictionary.playWord', { word: current.front })}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[32px]">volume_up</span>
                </button>
              </div>
              <span className="font-caption text-caption text-on-surface-variant">{t('flashcardStudy.tapToFlip')}</span>
            </>
          ) : (
            <span className="font-body-md text-[clamp(28px,6vw,56px)] font-semibold text-on-surface">{current.back}</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={pos === 0}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface disabled:opacity-30"
          aria-label={t('flashcardStudy.prev')}
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="rounded-full bg-primary px-8 py-3 font-label-md text-label-md text-on-primary hover:bg-primary-container"
        >
          {t('flashcardStudy.flip')}
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={pos === cards.length - 1}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface disabled:opacity-30"
          aria-label={t('flashcardStudy.next')}
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
