import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BOARD_FONTS, boardSlideStyle, boardTheme, textOnAccent } from '../lib/boardThemes';
import { useSyncedSubState } from '../lib/presentSync';
import type { QnaItem } from '../lib/qnaLines';
import { speak } from '../lib/speech';
import { extractYoutubeId } from '../lib/youtube';
import { CanvasStageBox } from './CanvasSlideView';
import SceneOverlay from './SceneOverlay';

/**
 * Q&A 슬라이드 칠판(2026-10-03, 클래스5 무비 수업 "Q & A" 참고) — 영상 내용 질문을 하나씩.
 * 질문(읽어 주기) → 정답 공개(읽어 주기) → 다음 질문. 클리커·Space·→ 로 넘기고 마지막 정답 뒤에는 다음 슬라이드로
 * 흘려보낸다(단어 소개와 같은 capture 패턴). "장면 보기"는 답이 나오는 부분만 틀어 준다. 학생 따라보기와 단계가 맞춰진다.
 */
export default function QnaBoard({
  questions,
  title,
  videoUrl,
  themeId,
  interactive,
  initialShowKo = false,
  autoSpeak = true,
}: {
  questions: QnaItem[];
  title?: string;
  videoUrl?: string | null;
  themeId?: string | null;
  /** false: 편집 화면 미리보기 — 첫 질문의 정답까지 연 상태 */
  interactive: boolean;
  initialShowKo?: boolean;
  autoSpeak?: boolean;
}) {
  const { t } = useTranslation();
  const th = boardTheme(themeId ?? 'green') ?? boardTheme('green')!;
  const font = BOARD_FONTS[th.font];
  const videoId = videoUrl ? extractYoutubeId(videoUrl) : null;
  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [ko, setKo] = useState(initialShowKo);
  const [scene, setScene] = useState<number | null>(null);
  const follower = useSyncedSubState({ idx, step, ko }, (s) => {
    setIdx(Number(s.idx) || 0);
    setStep(Number(s.step) || 0);
    setKo(!!s.ko);
  });

  const item = questions[Math.min(idx, questions.length - 1)];
  const shownStep = interactive ? step : 1;
  const stateRef = useRef({ idx, step, total: questions.length });
  stateRef.current = { idx, step, total: questions.length };

  const spokenRef = useRef('');
  useEffect(() => {
    if (!interactive || follower || !autoSpeak || !item) return;
    const key = `${idx}:${step}`;
    if (spokenRef.current === key) return;
    spokenRef.current = key;
    speak(step === 0 ? item.q : item.a);
  });

  function forward(): boolean {
    const s = stateRef.current;
    if (s.step === 0) {
      setStep(1);
      return true;
    }
    if (s.idx < s.total - 1) {
      setIdx(s.idx + 1);
      setStep(0);
      setScene(null);
      return true;
    }
    return false;
  }
  function back(): boolean {
    const s = stateRef.current;
    if (s.step === 1) {
      setStep(0);
      return true;
    }
    if (s.idx > 0) {
      setIdx(s.idx - 1);
      setStep(1);
      setScene(null);
      return true;
    }
    return false;
  }

  useEffect(() => {
    if (!interactive || follower) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const isFwd = e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown';
      const isBack = e.key === 'ArrowLeft' || e.key === 'PageUp';
      if ((isFwd && forward()) || (isBack && back())) {
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === ' ') {
        e.preventDefault();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, follower]);

  if (!item) return <div className="flex h-full items-center justify-center text-on-surface-variant">{t('qna.empty')}</div>;

  const btn = (icon: string, label: string, onClick: () => void, on = false) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex items-center gap-[1cqh] rounded-full px-[2.2cqh] py-[1cqh] transition-transform hover:scale-105"
      style={{ fontSize: '2.8cqh', background: on ? th.accent : th.chip, color: on ? textOnAccent(th.accent) : th.text }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '1.3em' }}>
        {icon}
      </span>
      {label}
    </button>
  );
  const long = item.q.length > 60 || item.a.length > 70;

  return (
    <div className="flex h-full w-full items-center justify-center" style={{ containerType: 'size' }}>
      <CanvasStageBox fitParent className="rounded-xl shadow-[0_8px_28px_rgba(0,0,0,0.15)]">
        <div className="absolute inset-0" style={boardSlideStyle(th)} />
        <div className="absolute inset-0 flex flex-col" style={{ padding: th.frame ? '5cqh 6cqh' : '4cqh 5cqh', color: th.text, fontFamily: font }}>
          <div className="flex items-center gap-[1.5cqh]" style={{ fontSize: '2.6cqh', color: th.muted }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2em' }}>
              forum
            </span>
            <span className="flex-1 truncate">{title?.trim() || t('qna.title')}</span>
            <span className="tabular-nums">
              {t('qna.questionN', { n: Math.min(idx, questions.length - 1) + 1 })} / {questions.length}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-center gap-[4cqh]">
            <div className="flex items-start gap-[2cqh]">
              <span className="shrink-0 rounded-[1.5cqh] px-[1.6cqh] font-bold" style={{ fontSize: long ? '5cqh' : '6.5cqh', background: th.accent, color: textOnAccent(th.accent) }}>
                Q
              </span>
              <div className="min-w-0">
                <div className="font-bold leading-tight" style={{ fontSize: long ? '6cqh' : '8.4cqh' }}>
                  {item.q}
                </div>
                {ko && item.qKo && (
                  <div className="mt-[1cqh]" style={{ fontSize: '3.6cqh', color: th.muted }}>
                    {item.qKo}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-start gap-[2cqh] transition-opacity duration-300" style={{ opacity: shownStep >= 1 ? 1 : 0 }}>
              <span className="shrink-0 rounded-[1.5cqh] px-[1.6cqh] font-bold" style={{ fontSize: long ? '5cqh' : '6.5cqh', background: th.chip, color: th.accent }}>
                A
              </span>
              <div className="min-w-0">
                <div className="leading-tight" style={{ fontSize: long ? '5.4cqh' : '7.2cqh', color: th.accent }}>
                  {item.a}
                </div>
                {ko && item.aKo && (
                  <div className="mt-[1cqh]" style={{ fontSize: '3.4cqh', color: th.muted }}>
                    {item.aKo}
                  </div>
                )}
              </div>
            </div>
          </div>

          {interactive && !follower && (
            <div className="flex flex-wrap items-center justify-center gap-[1.5cqh]">
              {btn('volume_up', t('qna.listen'), () => speak(step === 0 ? item.q : item.a))}
              {shownStep === 0 ? btn('visibility', t('qna.showAnswer'), () => setStep(1)) : btn('visibility_off', t('qna.hideAnswer'), () => setStep(0))}
              {(item.qKo || item.aKo) && btn('translate', t('qna.korean'), () => setKo((k) => !k), ko)}
              {videoId && item.time !== undefined && btn('movie', t('qna.scene'), () => setScene(item.time ?? 0))}
            </div>
          )}
        </div>
        {scene !== null && videoId && <SceneOverlay videoId={videoId} time={scene} onClose={() => setScene(null)} />}
      </CanvasStageBox>
    </div>
  );
}
