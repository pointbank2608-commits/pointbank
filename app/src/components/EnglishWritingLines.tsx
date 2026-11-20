import { useEffect, useRef, useState } from 'react';

/** SVG text uses an explicit alphabetic baseline, shared by print and lesson slides. */
export default function EnglishWritingLines({ text = '', copies = 1 }: { text?: string; copies?: number }) {
  const svg = useRef<SVGSVGElement>(null);
  const [height, setHeight] = useState(76);
  const [width, setWidth] = useState(500);
  const [metrics, setMetrics] = useState({ cap: .76, x: .52, descent: .22, word: text.length * .55 });
  useEffect(() => {
    const observer = new ResizeObserver(entries => { setHeight(entries[0].contentRect.height || 76); setWidth(entries[0].contentRect.width); });
    if (svg.current) observer.observe(svg.current);
    let live = true;
    void document.fonts.load('100px Andika').catch(() => []).then(() => {
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx || !live) return;
      ctx.font = '100px Andika, sans-serif';
      setMetrics({ cap: ctx.measureText('Hbdhklft').actualBoundingBoxAscent / 100 || .76, x: ctx.measureText('x').actualBoundingBoxAscent / 100 || .52, descent: ctx.measureText('gpqy').actualBoundingBoxDescent / 100 || .22, word: ctx.measureText(text).width / 100 });
    });
    return () => { live = false; observer.disconnect(); };
  }, [text]);
  const em = Math.min(.65 / metrics.cap, .2 / metrics.descent);
  const count = Math.min(copies, Math.max(1, Math.floor((width - 6) / (height * em * metrics.word + height * .15))));
  const guide = (ratio: number) => `${ratio * 100}%`;
  return <svg ref={svg} className="english-writing-guides" width="100%" height="100%" role={text ? 'img' : undefined} aria-label={text || undefined} aria-hidden={!text || undefined} style={{ display: 'block', overflow: 'visible' }}>
    <line x1="0" x2="100%" y1={guide(.75 - em * metrics.cap)} y2={guide(.75 - em * metrics.cap)} stroke="#8293a5" strokeWidth="1"/>
    <line x1="0" x2="100%" y1={guide(.75 - em * metrics.x)} y2={guide(.75 - em * metrics.x)} stroke="#a8b5c3" strokeWidth="1" strokeDasharray="5 4"/>
    <line x1="0" x2="100%" y1="75%" y2="75%" stroke="#647589" strokeWidth="1"/>
    <line x1="0" x2="100%" y1="97%" y2="97%" stroke="#bcc6d0" strokeWidth=".7"/>
    {text && Array.from({ length: count }, (_, i) => <text key={i} x={copies === 1 ? '3%' : `${(i + .5) / count * 100}%`} y="75%" textAnchor={copies === 1 ? 'start' : 'middle'} fill="#a0a7b0" fontFamily="Andika, sans-serif" fontWeight="400" fontSize={height * em} style={{ whiteSpace: 'pre' }}>{text}</text>)}
  </svg>;
}
