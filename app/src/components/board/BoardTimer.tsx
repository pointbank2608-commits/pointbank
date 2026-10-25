import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatClock } from '../../lib/slideHelpers';

const PRESETS = [30, 60, 180, 300, 600];

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((at) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.25;
      o.connect(g);
      g.connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 0.22);
    });
    setTimeout(() => void ctx.close(), 1500);
  } catch {
    /* 소리를 못 내도 화면 알림은 된다 */
  }
}

/** 전자칠판 타이머: 칠판 위에 떠 있어 판서·다른 도구와 함께 쓴다. 끝나면 깜빡이고 소리가 난다. */
export default function BoardTimer({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [total, setTotal] = useState(180);
  const [left, setLeft] = useState(180);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const endRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const rest = Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000));
      setLeft(rest);
      if (rest <= 0) {
        setRunning(false);
        setDone(true);
        beep();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [running]);

  function pick(sec: number) {
    const s = Math.min(5999, Math.max(1, Math.round(sec)));
    setTotal(s);
    setLeft(s);
    setRunning(false);
    setDone(false);
  }
  function toggle() {
    if (running) {
      setRunning(false);
      return;
    }
    const from = left > 0 ? left : total;
    setLeft(from);
    endRef.current = Date.now() + from * 1000;
    setDone(false);
    setRunning(true);
  }

  const btn = 'min-h-11 rounded-xl px-4 font-bold focus-visible:outline-4 focus-visible:outline-white';
  return (
    <div
      className={`no-print fixed right-3 top-[68px] z-[65] w-[19rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/20 bg-deep-navy/95 p-3 text-white shadow-2xl ${done ? 'animate-pulse ring-4 ring-warm-yellow' : ''}`}
      data-board-timer
      role="timer"
      aria-label={t('whiteboard.timerTitle')}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white/70">{t('whiteboard.timerTitle')}</span>
        <button type="button" onClick={onClose} aria-label={t('whiteboard.close')} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15">
          ✕
        </button>
      </div>
      <div className={`py-1 text-center font-black tabular-nums ${done ? 'text-warm-yellow' : left <= 10 && running ? 'text-red-300' : ''}`} style={{ fontSize: '4.5rem', lineHeight: 1.1 }} data-timer-clock>
        {formatClock(left)}
      </div>
      {done && <p className="pb-1 text-center text-lg font-extrabold text-warm-yellow">{t('whiteboard.timerDone')}</p>}
      <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label={t('whiteboard.timerPresets')}>
        {PRESETS.map((s) => (
          <button key={s} type="button" onClick={() => pick(s)} aria-pressed={total === s} data-timer-preset={s} className={`min-h-10 rounded-lg px-3 text-sm font-bold ${total === s ? 'bg-white text-deep-navy' : 'bg-white/10 hover:bg-white/20'}`}>
            {s < 60 ? `${s}${t('whiteboard.timerSec')}` : `${s / 60}${t('whiteboard.timerMin')}`}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-2">
        <button type="button" onClick={() => pick(total - 60)} aria-label="-1" className={`${btn} bg-white/10 hover:bg-white/20`} disabled={running}>
          −1{t('whiteboard.timerMin')}
        </button>
        <button type="button" onClick={() => pick(total + 60)} aria-label="+1" className={`${btn} bg-white/10 hover:bg-white/20`} disabled={running}>
          +1{t('whiteboard.timerMin')}
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={toggle} className={`${btn} flex-1 bg-primary text-white`} data-timer-toggle>
          {running ? t('whiteboard.timerPause') : left > 0 && left < total ? t('whiteboard.timerResume') : t('whiteboard.timerStart')}
        </button>
        <button type="button" onClick={() => pick(total)} className={`${btn} bg-white/10 hover:bg-white/20`} data-timer-reset>
          {t('whiteboard.timerReset')}
        </button>
      </div>
    </div>
  );
}
