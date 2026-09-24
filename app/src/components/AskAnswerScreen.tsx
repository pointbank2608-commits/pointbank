import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AskRow, AskTemplate } from '../lib/worksheetGenerators';

/**
 * "짝 인터뷰" 워크시트(친구에게 물어보고 O/X 체크하는 인터뷰 표)에 맞춰, 전자칠판에 단어를 한
 * 개씩 크게 띄워두는 화면. FlashcardStudy.tsx 와 같은 전체 화면 오버레이 패턴을 쓰되, 이건
 * 암기용 카드가 아니라 "이 단어로 물어보세요" 안내판이라 뒤집기(flip)는 없다 — 아이들은 화면의
 * 질문 문장을 보고 직접 돌아다니며 묻고, 인쇄된 표에 O/X 를 적는다.
 */
export default function AskAnswerScreen({
  template,
  rows,
  onClose,
}: {
  template: AskTemplate;
  rows: AskRow[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [pos, setPos] = useState(0);

  function go(delta: number) {
    setPos((p) => Math.max(0, Math.min(rows.length - 1, p + delta)));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, rows.length]);

  if (rows.length === 0) return null;
  const current = rows[pos];
  if (!current) return null;

  // 'have' 템플릿만 관사가 붙는다 — "a apple"처럼 안 들리게 첫 글자로 a/an 을 대충 고른다(완벽한
  // 문법 규칙은 아니지만 초등 단어장 수준에서는 이 정도로 충분하다).
  const askWord =
    template === 'have' && /^[aeiou]/i.test(current.word) ? `an ${current.word}` : template === 'have' ? `a ${current.word}` : current.word;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-inverse-surface p-4 sm:p-6">
      <div className="flex shrink-0 items-center justify-between text-inverse-on-surface">
        <div className="font-label-md text-label-md tabular-nums">
          {pos + 1}/{rows.length}
        </div>
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

      {/* min-h-0 이 없으면 flex 자식은 기본적으로 내용물 크기 밑으로 줄어들지 않아서(min-height:
       * auto), 카드 내용(그림+단어+문장)이 화면이 낮을 때 아래 이전/다음 버튼을 뷰포트 밖으로
       * 밀어낸다 — 실제로 재현된 버그(2026-09-24). 그림도 %가 아니라 vh 로 캡을 걸어 뷰포트
       * 기준으로 항상 안전하게 작아지게 한다. */}
      <div className="flex min-h-0 flex-1 items-center justify-center py-4">
        <div className="flex max-h-full w-full max-w-[1100px] flex-col items-center justify-center gap-6 overflow-y-auto rounded-3xl bg-surface-container-lowest px-8 py-8 text-center shadow-xl">
          {current.imageUrl && (
            <img src={current.imageUrl} alt="" className="max-h-[28vh] max-w-full rounded-2xl object-contain" />
          )}
          <span className="font-title-md text-[clamp(40px,8vw,96px)] font-bold text-deep-navy">{current.word}</span>
          <span className="font-body-md text-[clamp(24px,4.5vw,44px)] font-semibold text-on-surface">
            {t(`materials.worksheet.screen.ask_${template}`, { word: askWord })}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-center gap-4">
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
          onClick={() => go(1)}
          disabled={pos === rows.length - 1}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface disabled:opacity-30"
          aria-label={t('flashcardStudy.next')}
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
