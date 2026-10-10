import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSyncedSubState } from '../../lib/presentSync';
import {
  CHUNK_QUESTION_KO,
  POS_LABEL_KO,
  RAINBOW_THEME,
  stageCount,
  type RChunk,
  type RToken,
  type SpeakingItem,
} from '../../lib/rainbow';
import { speak } from '../../lib/speech';

/** 품사 색이 칠해진 낱말 하나 — 색만으로 구분하지 않게 품사 이름도 작게 붙인다 */
function TokenChip({ token, size = 'md', small = false }: { token: RToken; size?: 'md' | 'lg'; small?: boolean }) {
  const c = RAINBOW_THEME.pos[token.pos];
  const label = POS_LABEL_KO[token.pos];
  return (
    <span
      className="inline-flex flex-col items-center rounded-lg px-[1.2cqh] pb-[0.4cqh] pt-[0.6cqh]"
      style={{
        background: c?.bg ?? 'transparent',
        borderBottom: `${size === 'lg' ? 0.8 : 0.6}cqh solid ${c?.line ?? '#9aa3af'}`,
      }}
    >
      <span className="font-bold leading-tight text-deep-navy" style={{ fontSize: small ? (size === 'lg' ? '4.8cqh' : '3.9cqh') : size === 'lg' ? '6.6cqh' : '5.2cqh' }}>
        {token.text}
      </span>
      {label && (
        <span className="font-medium leading-none text-deep-navy/60" style={{ fontSize: small ? '1.5cqh' : size === 'lg' ? '2cqh' : '1.8cqh' }}>
          {label}
        </span>
      )}
    </span>
  );
}

const tokenOf = (item: SpeakingItem, id: string) => item.tokens.find((t) => t.id === id);

/**
 * 그림 보고 말하기(Rainbow Picture Speaking) — 한 문장을 6단계로 풀어 준다.
 * 상황 → WHO → ACTION → WHAT → WHERE/TO(문장 완성) → 새 그림으로 혼자 말하기.
 * 하단 칸(WHO/ACTION/…)은 말하기 청크이고, 그 안의 낱말은 각자 품사 색을 갖는다(칸 자체는 중립).
 * 단계 수는 청크 수 + 2 이고, 문장은 데이터로만 바뀐다.
 */
export default function RainbowSpeaking({
  items,
  interactive = true,
  initialShowKo = false,
  onComplete,
  fill = true,
  compact = false,
}: {
  items: SpeakingItem[];
  /** 키보드(←/→/PageUp/PageDown)·버튼 조작 */
  interactive?: boolean;
  /** 마지막 독립 말하기에서 한국어 문장을 처음부터 보여 줄지(기본 숨김) */
  initialShowKo?: boolean;
  /** 마지막 문장의 마지막 단계에서 '다음'을 눌렀을 때(개별수업은 다음 단계로) */
  onComplete?: () => void;
  fill?: boolean;
  /** 좁은 화면(학생 폰): 청크를 두 줄로 */
  compact?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [stage, setStage] = useState(0);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [showKo, setShowKo] = useState(initialShowKo);

  const item = items[Math.min(idx, items.length - 1)];
  const total = item ? stageCount(item) : 0;
  const stateRef = useRef({ idx, stage, total, count: items.length });
  stateRef.current = { idx, stage, total, count: items.length };

  const follower = useSyncedSubState({ idx, stage, answerOpen, showKo }, (s) => {
    setIdx(Number(s.idx) || 0);
    setStage(Number(s.stage) || 0);
    setAnswerOpen(!!s.answerOpen);
    setShowKo(!!s.showKo);
  });

  // 문장 목록이 바뀌면 처음으로
  const itemsKey = items.map((i) => i.id).join('|');
  useEffect(() => {
    setIdx(0);
    setStage(0);
    setAnswerOpen(false);
  }, [itemsKey]);

  /** 앞으로 한 단계. 더 갈 곳이 없으면 false(키는 바깥으로 흘려보낸다) */
  const forward = useCallback((): boolean => {
    const s = stateRef.current;
    if (s.stage + 1 < s.total) {
      setStage(s.stage + 1);
      setAnswerOpen(false);
      return true;
    }
    if (s.idx + 1 < s.count) {
      setIdx(s.idx + 1);
      setStage(0);
      setAnswerOpen(false);
      return true;
    }
    return false;
  }, []);

  const backward = useCallback((): boolean => {
    const s = stateRef.current;
    if (s.stage > 0) {
      setStage(s.stage - 1);
      setAnswerOpen(false);
      return true;
    }
    if (s.idx > 0) {
      const prev = items[s.idx - 1];
      setIdx(s.idx - 1);
      setStage(prev ? stageCount(prev) - 1 : 0);
      setAnswerOpen(false);
      return true;
    }
    return false;
  }, [items]);

  // → · PageDown(클리커) = 다음, ← · PageUp = 이전. 더 갈 곳이 없으면 그냥 흘려보내 발표 진행바가 슬라이드를 넘긴다.
  useEffect(() => {
    if (!interactive || follower) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const fwd = e.key === 'ArrowRight' || e.key === 'PageDown';
      const back = e.key === 'ArrowLeft' || e.key === 'PageUp';
      if (fwd && forward()) {
        e.preventDefault();
        e.stopPropagation();
      } else if (back && backward()) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [interactive, follower, forward, backward]);

  const revealedIds = useMemo(() => {
    if (!item) return new Set<string>();
    const n = Math.max(0, Math.min(stage, item.revealOrder.length));
    return new Set(item.revealOrder.slice(0, n));
  }, [item, stage]);

  if (!item) return null;

  const independent = stage === total - 1;
  const complete = !independent && stage === total - 2;
  const lastOfAll = idx === items.length - 1 && stage === total - 1;
  const justRevealed = stage >= 1 && stage <= item.revealOrder.length ? item.revealOrder[stage - 1] : null;
  const justChunk = justRevealed ? item.chunks.find((c) => c.id === justRevealed) : null;
  const question = independent
    ? item.selfTalkCue ?? ''
    : justChunk
      ? CHUNK_QUESTION_KO[justChunk.label]
      : '그림을 보고 누가, 무엇을 하는지 떠올려 봐요.';

  const chunkOrder: RChunk[] = item.revealOrder.map((id) => item.chunks.find((c) => c.id === id)).filter((c): c is RChunk => !!c);

  const sentence = (
    <div className="flex flex-wrap items-end justify-center gap-[1.2cqh]">
      {item.tokens.map((t) => (
        <TokenChip key={t.id} token={t} size="lg" small={compact} />
      ))}
    </div>
  );

  const btn =
    'rounded-full px-[3cqh] py-[1.4cqh] text-[2.6cqh] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div
      className={`${fill ? 'absolute inset-0' : 'aspect-video w-full'} @container flex flex-col overflow-hidden rounded-2xl bg-white text-deep-navy`}
      style={{ containerType: 'size' }}
    >
      {/* 머리: 작은 이름 + 단계 */}
      <div className="flex items-center justify-between px-[3cqh] pt-[2cqh]">
        <span className="text-[2.2cqh] font-bold tracking-wide text-deep-navy/50">RAINBOW SPEAKING</span>
        <span className="flex items-center gap-[1.5cqh] text-[2.4cqh] font-bold tabular-nums text-deep-navy/70">
          {items.length > 1 && <span className="font-medium text-deep-navy/50">{idx + 1}/{items.length}</span>}
          <span>
            {stage + 1} / {total}
          </span>
        </span>
      </div>

      {/* 한국어 상황문 */}
      <div className="flex min-h-[10cqh] items-center justify-center px-[4cqh] text-center">
        {independent && !showKo ? (
          <span className="text-[3.4cqh] font-bold text-deep-navy/80">{question}</span>
        ) : (
          <span className="text-[5cqh] font-bold leading-tight">{item.koreanPrompt}</span>
        )}
      </div>

      {/* 그림 */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-[3cqh]">
        <img
          src={independent ? item.imageTransfer : item.imageMain}
          alt=""
          className="max-h-full max-w-full rounded-2xl object-contain shadow-sm"
          draggable={false}
        />
      </div>

      {/* 질문 한 줄 */}
      {(!independent || showKo) && question && (
        <div className="px-[3cqh] pt-[1cqh] text-center text-[2.8cqh] font-medium text-deep-navy/70">{question}</div>
      )}

      {/* 청크 4칸 또는 독립 말하기 */}
      {independent ? (
        <div className="flex min-h-[20cqh] flex-col items-center justify-center gap-[1.5cqh] px-[3cqh] py-[1.5cqh]">
          {answerOpen ? (
            <>
              {sentence}
              <button type="button" onClick={() => speak(item.englishAnswer)} className="text-[2.2cqh] font-bold text-primary hover:underline">
                🔊 {item.englishAnswer}
              </button>
            </>
          ) : (
            <span className="rounded-2xl bg-surface-container-low px-[3cqh] py-[2cqh] text-[3cqh] font-bold text-deep-navy/70">
              색도 영어 힌트도 없어요. 문장 전체를 말해 봐요!
            </span>
          )}
        </div>
      ) : (
        <div className="px-[3cqh] py-[1.5cqh]">
          <div className="grid gap-[1.5cqh]" style={{ gridTemplateColumns: `repeat(${compact ? 2 : Math.max(1, chunkOrder.length)}, minmax(0, 1fr))` }}>
            {chunkOrder.map((c) => {
              const open = revealedIds.has(c.id);
              const fresh = c.id === justRevealed;
              return (
                <div
                  key={c.id}
                  className={`flex ${compact ? 'min-h-[9cqh]' : 'min-h-[14cqh]'} flex-col items-center justify-center rounded-2xl border-2 px-[1cqh] py-[1cqh] ${
                    fresh ? 'border-primary bg-primary/5' : 'border-outline-variant/60 bg-surface-container-lowest'
                  }`}
                >
                  <span className="text-[1.9cqh] font-bold tracking-wider text-deep-navy/50">{c.label}</span>
                  {open ? (
                    <span className="mt-[0.6cqh] flex flex-wrap items-end justify-center gap-[0.8cqh]">
                      {c.tokenIds.map((id) => {
                        const t = tokenOf(item, id);
                        return t ? <TokenChip key={id} token={t} small={compact} /> : null;
                      })}
                    </span>
                  ) : (
                    <span className="text-[6cqh] font-bold leading-none text-deep-navy/30">?</span>
                  )}
                </div>
              );
            })}
          </div>
          {complete && !compact && (
            <div className="mt-[1.5cqh] flex items-center justify-center gap-[1.5cqh]">
              <span className="text-[2.4cqh] text-deep-navy/60">전체 문장:</span>
              <button type="button" onClick={() => speak(item.englishAnswer)} className="text-[3.2cqh] font-bold hover:underline">
                {item.englishAnswer}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 조작 */}
      {!follower && (
        <div className="flex flex-wrap items-center justify-center gap-[1.5cqh] border-t border-outline-variant/40 px-[3cqh] py-[1.5cqh]">
          <button type="button" onClick={() => backward()} disabled={idx === 0 && stage === 0} className={`${btn} border-2 border-outline-variant bg-white text-deep-navy hover:bg-surface-container-low`}>
            ‹ 이전
          </button>
          {independent && (
            <>
              <button
                type="button"
                onClick={() => setAnswerOpen((o) => !o)}
                className={`${btn} border-2 border-primary text-primary hover:bg-primary/10`}
              >
                {answerOpen ? '정답 숨기기' : '정답 보기'}
              </button>
              <button type="button" onClick={() => setShowKo((o) => !o)} className={`${btn} border-2 border-outline-variant text-deep-navy/70 hover:bg-surface-container-low`}>
                {showKo ? '한국어 숨기기' : '한국어 보기'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setStage(0);
              setAnswerOpen(false);
            }}
            className={`${btn} text-deep-navy/60 hover:bg-surface-container-low`}
          >
            {compact ? '↺ 처음부터' : '↺ 이 문장 처음부터'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!forward() && lastOfAll) onComplete?.();
            }}
            disabled={lastOfAll && !onComplete}
            className={`${btn} bg-primary text-on-primary hover:bg-primary-container`}
          >
            {lastOfAll && onComplete ? '다 했어요' : '다음 ›'}
          </button>
        </div>
      )}
    </div>
  );
}
