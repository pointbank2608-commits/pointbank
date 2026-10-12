import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { playSfx } from '../../lib/gameSfx';
import { speak } from '../../lib/speech';

/**
 * 숙제 완료 도장 — 학생이 숙제를 끝내면 "Good job!" 과 함께 쾅 찍히고, 숙제 캘린더(학생·선생님)에도 같은 도장이 남는다.
 * 그림 파일 없이 SVG 로 그린다(색은 잉크 빨강, 살짝 기울어진 도장 느낌).
 */
const INK = '#e5484d';

export function HomeworkStamp({ size = 96, label = 'GOOD JOB', className = '' }: { size?: number; label?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={label} className={className}>
      <g transform="rotate(-10 60 60)" fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="60" cy="60" r="54" strokeWidth="6" />
        <circle cx="60" cy="60" r="44" strokeWidth="2.5" strokeDasharray="3 5" />
        <path
          d="M60 22 l9.4 19.1 21 3-15.2 14.8 3.6 20.9L60 70l-18.8 9.8 3.6-20.9L29.6 44.1l21-3z"
          fill={INK}
          fillOpacity="0.18"
          strokeWidth="5"
        />
        <text x="60" y="104" textAnchor="middle" fontSize="13" fontWeight="800" fill={INK} stroke="none" fontFamily="'Fredoka','Quicksand','Noto Sans KR',sans-serif" letterSpacing="1.5">
          {label}
        </text>
      </g>
    </svg>
  );
}

const CONFETTI = ['#ff6b6b', '#ffd43b', '#51cf66', '#4dabf7', '#b197fc', '#ff8fa3'];

/** 화면에 도장이 쾅 찍히는 연출 + "Good job!" + 반짝이 가루 + 박수 소리(움직임 줄이기 설정이면 가만히 보여 준다) */
export function StampCelebration({ kids = false }: { kids?: boolean }) {
  const { t } = useTranslation();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      playSfx(5037);
      speak('Good job!');
    }, 520);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="relative flex flex-col items-center gap-3 pt-4" aria-live="polite">
      <div className="hw-confetti-field" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span
            key={i}
            className="hw-confetti"
            style={{
              left: `${5 + ((i * 53) % 90)}%`,
              background: CONFETTI[i % CONFETTI.length],
              animationDelay: `${0.5 + (i % 6) * 0.07}s`,
              transform: `rotate(${(i * 37) % 360}deg)`,
            }}
          />
        ))}
      </div>
      <div className="relative flex h-44 w-44 items-center justify-center">
        <span className="hw-stamp-ring" aria-hidden="true" />
        <HomeworkStamp size={168} className="hw-stamp-drop drop-shadow-lg" />
      </div>
      <div className={`hw-goodjob font-bold ${kids ? 'text-5xl text-[#e5484d]' : 'text-4xl text-warm-yellow'}`} style={{ fontFamily: "'Fredoka','Quicksand','Noto Sans KR',sans-serif" }}>
        Good job!
      </div>
      <div className={`text-lg ${kids ? 'text-deep-navy/80' : 'text-white/80'}`}>{t('studentHw.stampGot')}</div>
    </div>
  );
}
