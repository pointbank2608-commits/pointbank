import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSyncedSubState } from '../../lib/presentSync';
import {
  buildSpanTree,
  maxDepth,
  RAINBOW_THEME,
  ROLE_LABEL_KO,
  type SNode,
  type StructureItem,
} from '../../lib/rainbow';
import { speak } from '../../lib/speech';

/** 가장 깊은 단계 번호. 0 = 색 없음(먼저 스스로 찾아보기), 1 = 동사 + 가장 바깥 덩어리, … 마지막 = 전체 */
function levelsOf(item: StructureItem) {
  return Math.max(1, maxDepth(item.spans));
}

/** 글자 하나가 놓이는 칸 — 덩어리 칸과 같은 테두리·안쪽 여백이라 글자 높이가 서로 맞는다 */
const BOX_PAD = '0.1em 0.26em 0.04em';
const wordBox = (bg?: string, line?: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: BOX_PAD,
  border: '0.07em solid transparent',
  borderBottomWidth: '0.17em',
  borderRadius: '0.35em',
  ...(bg ? { background: bg, borderColor: line } : {}),
});

/**
 * 덩어리를 "끊기지 않는 네모 칸"으로 그린다(줄 바꿈은 칸 안에서 일어난다).
 * 칸 이름표는 칸 윗 모서리에 걸쳐 놓아서 글자 줄과 정렬이 어긋나지 않는다.
 */
function renderRange(item: StructureItem, from: number, to: number, nodes: SNode[], level: number): ReactNode[] {
  const out: ReactNode[] = [];
  let i = from;
  while (i <= to) {
    const node = nodes.find((n) => n.span.from === i);
    if (node) {
      const inner = renderRange(item, node.span.from, node.span.to, node.children, level);
      // depth 가 level 이내인 덩어리만 칸을 그린다(레벨 1 이면 depth 0 만)
      if (node.depth < level) {
        const c = RAINBOW_THEME.role[node.span.role];
        out.push(
          <span
            key={`s${node.span.from}-${node.span.to}-${node.depth}`}
            style={{
              position: 'relative',
              display: 'inline-flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              justifyContent: 'center',
              columnGap: '0.22em',
              rowGap: '0.55em',
              maxWidth: '100%',
              padding: '0.2em 0.3em 0.06em',
              border: `0.07em solid ${c.line}`,
              borderBottomWidth: '0.17em',
              borderRadius: '0.4em',
              background: c.bg,
            }}
          >
            <span
              className="absolute left-[0.5em] whitespace-nowrap rounded-full bg-white px-[0.4em] font-bold leading-none"
              style={{ top: '-0.52em', fontSize: '0.4em', color: '#334155', border: `0.12em solid ${c.line}`, paddingTop: '0.18em', paddingBottom: '0.18em' }}
            >
              {node.span.kind ?? ROLE_LABEL_KO[node.span.role]}
            </span>
            {inner}
          </span>,
        );
      } else {
        out.push(<Fragment key={`f${node.span.from}-${node.depth}`}>{inner}</Fragment>);
      }
      i = node.span.to + 1;
    } else {
      const t = item.tokens[i];
      const isVerb = t.pos === 'verb' && level >= 1;
      const v = RAINBOW_THEME.role.verb;
      out.push(
        <span
          key={`t${i}`}
          style={isVerb ? wordBox(v.bg, v.line) : wordBox()}
          className={t.marker && level >= 1 ? 'font-bold underline decoration-dotted decoration-[0.08em] underline-offset-[0.18em]' : undefined}
        >
          {t.text}
        </span>,
      );
      i += 1;
    }
  }
  return out;
}

/**
 * 구조 보기(Rainbow Structure) — 긴 문장의 구·절 덩어리를 역할 색으로 감싸 보여 준다.
 * 명사 역할=빨강, 형용사 역할=초록, 부사 역할=주황, 모든 동사=노랑. 덩어리 안의 덩어리는 겹쳐 그린다.
 * 단계: 색 없음 → 1단계(동사 + 큰 덩어리) → 안쪽 덩어리 → 전체. →/← 로 한 단계씩 넘기고, 끝나면 다음 문장.
 */
export default function RainbowStructure({
  items,
  interactive = true,
  onComplete,
  fill = true,
  compact = false,
}: {
  items: StructureItem[];
  interactive?: boolean;
  onComplete?: () => void;
  fill?: boolean;
  compact?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [level, setLevel] = useState(0);
  const [showKo, setShowKo] = useState(false);
  const item = items[Math.min(idx, items.length - 1)];
  const nLevels = item ? levelsOf(item) : 1; // 레벨은 0..nLevels
  const stateRef = useRef({ idx, level, nLevels, count: items.length });
  stateRef.current = { idx, level, nLevels, count: items.length };

  const follower = useSyncedSubState({ idx, level, showKo }, (s) => {
    setIdx(Number(s.idx) || 0);
    setLevel(Number(s.level) || 0);
    setShowKo(!!s.showKo);
  });

  const key = items.map((i) => i.id).join('|');
  useEffect(() => {
    setIdx(0);
    setLevel(0);
  }, [key]);

  const forward = useCallback((): boolean => {
    const s = stateRef.current;
    if (s.level < s.nLevels) {
      setLevel(s.level + 1);
      return true;
    }
    if (s.idx + 1 < s.count) {
      setIdx(s.idx + 1);
      setLevel(0);
      return true;
    }
    return false;
  }, []);
  const backward = useCallback((): boolean => {
    const s = stateRef.current;
    if (s.level > 0) {
      setLevel(s.level - 1);
      return true;
    }
    if (s.idx > 0) {
      setIdx(s.idx - 1);
      setLevel(levelsOf(items[s.idx - 1]));
      return true;
    }
    return false;
  }, [items]);

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

  const tree = useMemo(() => (item ? buildSpanTree(item.spans) : []), [item]);
  if (!item) return null;

  const atEnd = level >= nLevels;
  const lastOfAll = idx === items.length - 1 && atEnd;
  const btn = 'rounded-full px-[2.6cqh] py-[1.2cqh] text-[2.4cqh] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40';
  // 글자 크기: 문장이 길수록 작게(칸 폭 기준)
  const len = item.sentence.length;
  const fontCqh = len > 80 ? 5.6 : len > 55 ? 6.4 : 7.4;
  const fontCqw = len > 80 ? 6.2 : len > 55 ? 7.2 : 8.4;
  const fontSize = compact ? `min(${fontCqh}cqh, ${fontCqw}cqw)` : `${fontCqh}cqh`;

  const levelLabel = (l: number) => (l === 0 ? '색 없음' : l === nLevels ? '전체' : `${l}단계`);

  return (
    <div
      className={`${fill ? 'absolute inset-0' : 'aspect-video w-full'} flex flex-col overflow-hidden rounded-2xl bg-white text-deep-navy`}
      style={{ containerType: 'size' }}
    >
      <div className="flex items-center justify-between px-[3cqh] pt-[2cqh]">
        <span className="text-[2.2cqh] font-bold tracking-wide text-deep-navy/50">RAINBOW STRUCTURE</span>
        <span className="text-[2.4cqh] font-bold tabular-nums text-deep-navy/70">
          {items.length > 1 && <span className="mr-[1.5cqh] font-medium text-deep-navy/50">{idx + 1}/{items.length}</span>}
          {levelLabel(level)}
        </span>
      </div>

      {/* 문장 */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[2cqh] px-[5cqh]">
        <div
          className="flex w-full flex-wrap items-baseline justify-center font-bold"
          style={{ fontSize, lineHeight: 1.25, columnGap: '0.25em', rowGap: '0.9em' }}
        >
          {renderRange(item, 0, item.tokens.length - 1, tree, level)}
        </div>
        {showKo && <p className="text-center text-[3.2cqh] font-medium text-deep-navy/70">{item.ko}</p>}
        {atEnd && <p className="max-w-[140cqh] rounded-2xl bg-surface-container-low px-[3cqh] py-[1.6cqh] text-center text-[2.6cqh] leading-snug text-deep-navy/80">{item.note}</p>}
      </div>

      {/* 색 안내 — 색만으로 구분하지 않게 이름도 함께 */}
      <div className="flex flex-wrap items-center justify-center gap-[1.5cqh] px-[3cqh] pb-[1cqh]">
        {(['noun', 'adj', 'adv', 'verb'] as const).map((r) => {
          const c = RAINBOW_THEME.role[r];
          return (
            <span
              key={r}
              className="rounded-lg px-[1.4cqh] py-[0.5cqh] text-[2.2cqh] font-bold"
              style={{ background: c.bg, borderBottom: `0.5cqh solid ${c.line}` }}
            >
              {ROLE_LABEL_KO[r]}
            </span>
          );
        })}
        <span className="text-[2cqh] text-deep-navy/50">점선 밑줄 = 덩어리를 여는 말</span>
      </div>

      {!follower && (
        <div className="flex flex-wrap items-center justify-center gap-[1.5cqh] border-t border-outline-variant/40 px-[3cqh] py-[1.5cqh]">
          <button type="button" onClick={() => backward()} disabled={idx === 0 && level === 0} className={`${btn} border-2 border-outline-variant bg-white hover:bg-surface-container-low`}>
            ‹ 이전
          </button>
          <button type="button" onClick={() => speak(item.sentence)} className={`${btn} border-2 border-outline-variant hover:bg-surface-container-low`}>
            🔊 읽어 주기
          </button>
          <button type="button" onClick={() => setShowKo((o) => !o)} className={`${btn} border-2 border-outline-variant text-deep-navy/70 hover:bg-surface-container-low`}>
            {showKo ? '한국어 숨기기' : '한국어 보기'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!forward() && lastOfAll) onComplete?.();
            }}
            disabled={lastOfAll && !onComplete}
            className={`${btn} bg-primary text-on-primary hover:bg-primary-container`}
          >
            {lastOfAll && onComplete ? '다 했어요' : level === 0 ? '색 보기 ›' : atEnd ? '다음 문장 ›' : '더 깊이 ›'}
          </button>
        </div>
      )}
    </div>
  );
}
