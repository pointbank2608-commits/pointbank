import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BOARD_FONTS, boardSlideStyle, boardTheme, textOnAccent } from '../lib/boardThemes';
import { useSyncedSubState } from '../lib/presentSync';
import { speak } from '../lib/speech';
import type { DrillSlide } from '../lib/types';
import { extractYoutubeId } from '../lib/youtube';
import { CanvasStageBox } from './CanvasSlideView';
import SceneOverlay from './SceneOverlay';

/**
 * "바꿔 말하기" 칠판(2026-10-03, 클래스5 무비 수업 "문법 포인트"의 카드 연습 참고).
 * 처음엔 영화 속 본보기 문장 + 한 줄 설명(장면 보기). 다음부터 카드 하나씩: 단서(예: "study English")를 보고 다 같이 말한 뒤
 * 넘기면 정답 문장(읽어 주기)이 뒤집혀 나온다. 클리커·Space·→ 로 진행하고 끝나면 다음 슬라이드로 흘려보낸다.
 */
export default function DrillBoard({
  slide,
  interactive,
  videoUrl,
}: {
  slide: Pick<DrillSlide, 'sentence' | 'sentenceKo' | 'point' | 'drills' | 'time' | 'boardTheme' | 'title'>;
  interactive: boolean;
  videoUrl?: string | null;
}) {
  const { t } = useTranslation();
  const th = boardTheme(slide.boardTheme ?? 'green') ?? boardTheme('green')!;
  const font = BOARD_FONTS[th.font];
  const videoId = videoUrl ? extractYoutubeId(videoUrl) : null;
  // 0: 본보기 문장, 그다음 카드마다 [단서, 정답] 두 단계
  const total = 1 + slide.drills.length * 2;
  const [pos, setPos] = useState(0);
  const [scene, setScene] = useState<number | null>(null);
  const follower = useSyncedSubState({ pos }, (s) => setPos(Number(s.pos) || 0));
  const shown = interactive ? Math.min(pos, total - 1) : 0;
  const posRef = useRef(pos);
  posRef.current = pos;

  const cardIdx = shown === 0 ? -1 : Math.floor((shown - 1) / 2);
  const flipped = shown > 0 && (shown - 1) % 2 === 1;
  const card = cardIdx >= 0 ? slide.drills[cardIdx] : null;

  const spokenRef = useRef(-1);
  useEffect(() => {
    if (!interactive || follower || spokenRef.current === shown) return;
    spokenRef.current = shown;
    if (shown === 0) speak(slide.sentence);
    else if (flipped && card) speak(card.answer);
  });

  useEffect(() => {
    if (!interactive || follower) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const isFwd = e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown';
      const isBack = e.key === 'ArrowLeft' || e.key === 'PageUp';
      const p = posRef.current;
      if (isFwd && p < total - 1) {
        setPos(p + 1);
        setScene(null);
      } else if (isBack && p > 0) {
        setPos(p - 1);
        setScene(null);
      } else {
        if (e.key === ' ') e.preventDefault();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [interactive, follower, total]);

  const chipBtn = (icon: string, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex items-center gap-[1cqh] rounded-full px-[2.2cqh] py-[1cqh] transition-transform hover:scale-105"
      style={{ fontSize: '2.8cqh', background: th.chip, color: th.text }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '1.3em' }}>
        {icon}
      </span>
      {label}
    </button>
  );

  return (
    <div className="flex h-full w-full items-center justify-center" style={{ containerType: 'size' }}>
      <CanvasStageBox fitParent className="rounded-xl shadow-[0_8px_28px_rgba(0,0,0,0.15)]">
        <div className="absolute inset-0" style={boardSlideStyle(th)} />
        <div className="absolute inset-0 flex flex-col" style={{ padding: th.frame ? '5cqh 6cqh' : '4cqh 5cqh', color: th.text, fontFamily: font }}>
          <div className="flex items-center gap-[1.5cqh]" style={{ fontSize: '2.6cqh', color: th.muted }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2em' }}>
              swap_horiz
            </span>
            <span className="flex-1 truncate">{slide.title?.trim() || t('drill.title')}</span>
            {card && (
              <span className="tabular-nums">
                {cardIdx + 1} / {slide.drills.length}
              </span>
            )}
          </div>

          {/* 본보기 문장은 늘 위에 작게(첫 화면에선 크게) */}
          <div className={`flex flex-col ${shown === 0 ? 'min-h-0 flex-1 justify-center gap-[3cqh]' : 'gap-[0.8cqh] pt-[2cqh]'}`}>
            <div className="font-bold leading-tight" style={{ fontSize: shown === 0 ? (slide.sentence.length > 50 ? '7cqh' : '9cqh') : '3.6cqh' }}>
              “{slide.sentence}”
            </div>
            {slide.sentenceKo && (
              <div style={{ fontSize: shown === 0 ? '4.2cqh' : '2.6cqh', color: th.muted }}>{slide.sentenceKo}</div>
            )}
            <div
              className="self-start rounded-[1.5cqh] px-[2cqh] py-[1cqh]"
              style={{ fontSize: shown === 0 ? '4.8cqh' : '2.8cqh', background: th.chip, color: th.accent }}
            >
              {slide.point}
            </div>
          </div>

          {card && (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="w-[78%]" style={{ perspective: '200cqh' }}>
                <div
                  className="relative transition-transform duration-500"
                  style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'none', height: '34cqh' }}
                >
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-[3cqh] text-center"
                    style={{ backfaceVisibility: 'hidden', background: '#ffffff', color: '#1f2937' }}
                  >
                    <div style={{ fontSize: '3cqh', color: '#6b7280' }}>{t('drill.sayIt')}</div>
                    <div className="font-bold" style={{ fontSize: card.cue.length > 24 ? '6cqh' : '8cqh' }}>
                      ({card.cue.replace(/^\((.*)\)$/, '$1')})
                    </div>
                  </div>
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-[1.5cqh] rounded-[3cqh] px-[4cqh] text-center"
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: th.accent, color: textOnAccent(th.accent) }}
                  >
                    <div className="font-bold leading-tight" style={{ fontSize: card.answer.length > 40 ? '5.4cqh' : '6.6cqh' }}>
                      {card.answer}
                    </div>
                    {card.answerKo && <div style={{ fontSize: '3.2cqh', opacity: 0.9 }}>{card.answerKo}</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {interactive && !follower && (
            <div className="flex flex-wrap items-center justify-center gap-[1.5cqh] pt-[1.5cqh]">
              {chipBtn('volume_up', t('qna.listen'), () => speak(card ? card.answer : slide.sentence))}
              {shown === 0 && videoId && slide.time != null && chipBtn('movie', t('qna.scene'), () => setScene(slide.time ?? 0))}
              {card && !flipped && chipBtn('flip', t('drill.flip'), () => setPos((p) => p + 1))}
            </div>
          )}
        </div>
        {scene !== null && videoId && <SceneOverlay videoId={videoId} time={scene} onClose={() => setScene(null)} />}
      </CanvasStageBox>
    </div>
  );
}
