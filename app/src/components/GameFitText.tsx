import { useLayoutEffect, useMemo, useRef } from 'react';
import { classifyPlayText } from '../lib/gamePlayText';

interface Props {
  text: string;
  className?: string;
  /**
   * box: 부모 칸을 채워 글자 크기를 맞춘다 (틱택토·카드 칸).
   * block: 가로만 기준으로 맞춘다 (퀴즈 질문처럼 높이가 글에 따라 늘어나는 곳).
   */
  fit?: 'box' | 'block';
  align?: 'center' | 'left';
}

/**
 * 단어면 칸이 허락하는 한 크게, 문장이면 줄바꿈해서 잘리지 않게.
 * 부모에 크기가 있어야 box 모드가 동작한다.
 */
export default function GameFitText({ text, className, fit = 'box', align = 'center' }: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const kind = useMemo(() => classifyPlayText(text), [text]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const el = innerRef.current;
    if (!wrap || !el) return;

    const apply = () => {
      const maxW = wrap.clientWidth;
      let maxH = wrap.clientHeight;
      if (maxW < 8) return;
      if (fit === 'block' || maxH < 12) {
        maxH = kind === 'word' ? 96 : 160;
      }

      const min = 11;
      const wordCap = Math.min(fit === 'box' ? 68 : 72, Math.floor(maxH * 0.82) || 48);
      const sentenceCap = Math.min(fit === 'box' ? 32 : 40, Math.floor(maxH * 0.36) || 26);
      const max = Math.max(min, kind === 'word' ? wordCap : sentenceCap);

      el.style.whiteSpace = kind === 'word' ? 'nowrap' : 'pre-wrap';
      el.style.overflowWrap = kind === 'word' ? 'normal' : 'break-word';
      el.style.wordBreak = 'keep-all';

      let lo = min;
      let hi = max;
      let best = min;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        el.style.fontSize = `${mid}px`;
        const tooWide = el.scrollWidth > maxW + 1;
        const tooTall = el.scrollHeight > maxH + 1;
        if (tooWide || tooTall) {
          hi = mid;
        } else {
          best = mid;
          lo = mid;
        }
      }
      el.style.fontSize = `${best}px`;
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [text, kind, fit]);

  return (
    <span
      ref={wrapRef}
      data-play={kind}
      className={`game-fit game-fit-${fit} ${align === 'left' ? 'justify-start' : ''} ${className ?? ''}`}
    >
      <span ref={innerRef} className={`game-fit-inner ${align === 'left' ? 'text-left' : 'text-center'}`}>
        {text}
      </span>
    </span>
  );
}
