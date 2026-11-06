import { useEffect, useRef, type ReactNode } from 'react';

/**
 * 학습 스튜디오 — 학생 숙제(단어)와 문법 학습이 함께 쓰는 화면 조각.
 * 아이보리 바탕 + 흰 학습 카드 한 장 + 같은 색 계열 보기. 채점·진행·센서는 알지 못한다(보여 주기만 한다).
 */

export const STUDIO_BG = 'bg-[#f8f1e3] text-[#1c2742]';

export function StudioShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div data-studio-shell className={`flex flex-1 flex-col ${STUDIO_BG} ${className}`}>{children}</div>;
}

/** 상단: 제목 + 간결한 진행 + (선택) 저장 상태 */
export function StudioTopBar({ title, progressText, progress, right }: { title: string; progressText?: string; progress?: number; right?: ReactNode }) {
  return (
    <header data-studio-top-bar className="sticky top-0 z-10 bg-[#f8f1e3]/95 px-4 pb-2 pt-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-base font-bold text-[#1c2742]">{title}</h1>
        <div className="flex shrink-0 items-center gap-3 text-sm text-[#5b6580]">
          {right}
          {progressText && <span className="font-bold tabular-nums text-[#1c2742]">{progressText}</span>}
        </div>
      </div>
      {progress !== undefined && (
        <div className="mx-auto mt-2 h-2 w-full max-w-2xl overflow-hidden rounded-full bg-[#e6dcc4]" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-[#3b5bdb] transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </header>
  );
}

/** 현재 문제를 담는 흰 카드 한 장 */
export function StudioCard({ children, label, className = '', barSpace = false }: { children: ReactNode; label?: string; className?: string; /** 하단 고정 버튼이 있을 때: 마지막 줄이 가려지지 않도록 여백 */ barSpace?: boolean }) {
  return (
    <main className={`flex flex-1 flex-col px-4 pt-[clamp(0.5rem,5vh,2.5rem)] ${barSpace ? 'pb-32' : 'pb-6'}`}>
      <section aria-label={label} className={`mx-auto w-full max-w-2xl rounded-3xl border border-[#eadfc5] bg-white p-5 shadow-[0_8px_24px_rgba(60,45,10,0.08)] sm:p-7 ${className}`}>{children}</section>
    </main>
  );
}

/** 지시문(한 번만, 작게) + 문제 */
export function StudioPrompt({ guide, text, sub, lang, extra }: { guide?: string; text: string; sub?: string; lang?: string; extra?: ReactNode }) {
  const len = text.length;
  const size = len <= 12 ? 'text-5xl sm:text-6xl' : len <= 30 ? 'text-3xl' : len <= 60 ? 'text-2xl' : 'text-xl';
  return (
    <div className="space-y-2 text-center">
      {guide && <p className="text-sm font-bold text-[#5b6580]">{guide}</p>}
      <p data-studio-prompt lang={lang} className={`break-words font-extrabold leading-tight text-[#1c2742] ${size}`}>{text}</p>
      {sub && <p className="text-base text-[#5b6580]">{sub}</p>}
      {extra}
    </div>
  );
}

export type StudioOptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dim';
export interface StudioOption { id: string; text: string; state?: StudioOptionState; disabled?: boolean }

const OPT_BASE = 'flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-bold transition active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#3b5bdb] [touch-action:manipulation]';
const OPT_STATE: Record<StudioOptionState, string> = {
  idle: 'border-[#d9d3c3] bg-[#fffdf8] text-[#1c2742] hover:border-[#3b5bdb] hover:bg-[#f0f3ff] disabled:hover:border-[#d9d3c3] disabled:hover:bg-[#fffdf8]',
  selected: 'border-[#3b5bdb] bg-[#e8edff] text-[#1c2742]',
  correct: 'border-emerald-600 bg-emerald-50 text-emerald-900',
  wrong: 'border-rose-500 bg-rose-50 text-rose-900',
  dim: 'border-[#e6dfce] bg-[#faf6ec] text-[#8a8574]',
};
const BADGE_STATE: Record<StudioOptionState, string> = {
  idle: 'bg-[#efe8d4] text-[#4a4636]',
  selected: 'bg-[#3b5bdb] text-white',
  correct: 'bg-emerald-600 text-white',
  wrong: 'bg-rose-500 text-white',
  dim: 'bg-[#ece5d1] text-[#8a8574]',
};
const STATE_LABEL: Partial<Record<StudioOptionState, { icon: string; text: string; cls: string }>> = {
  correct: { icon: 'check_circle', text: '정답', cls: 'text-emerald-700' },
  wrong: { icon: 'cancel', text: '내가 고른 답', cls: 'text-rose-700' },
  selected: { icon: 'radio_button_checked', text: '선택함', cls: 'text-[#3b5bdb]' },
};

/** 보기 목록 — 짧은 보기 4개 이하는 넓은 화면에서 2×2, 긴 보기·모바일은 한 줄씩. 숫자 키(1~)로도 고른다 */
export function StudioOptions({ options, onPick, disabled = false, label, className = 'mt-5' }: { options: StudioOption[]; onPick: (id: string, index: number) => void; disabled?: boolean; label?: string; className?: string }) {
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const compact = options.length <= 4 && options.every((o) => o.text.length <= 16);
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > options.length) return;
      const o = options[n - 1];
      if (o.disabled || (o.state && o.state !== 'idle')) return;
      pickRef.current(o.id, n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, disabled]);
  return (
    <div role="group" aria-label={label} className={`${className} grid gap-3 ${compact ? 'sm:grid-cols-2' : ''}`}>
      {options.map((o, i) => {
        const st = o.state ?? 'idle';
        const mark = STATE_LABEL[st];
        return (
          <button
            key={o.id}
            type="button"
            data-choice={i}
            disabled={disabled || o.disabled}
            aria-pressed={st === 'selected' || st === 'wrong' || st === 'correct'}
            onClick={() => onPick(o.id, i)}
            className={`${OPT_BASE} ${OPT_STATE[st]} ${o.disabled ? 'line-through opacity-40' : ''}`}
          >
            <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${BADGE_STATE[st]}`}>{i + 1}</span>
            <span className="min-w-0 flex-1 break-words">{o.text}</span>
            {mark && (
              <span className={`flex shrink-0 items-center gap-1 text-sm font-bold ${mark.cls}`}>
                <span aria-hidden="true" className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>{mark.icon}</span>
                <span className="max-sm:sr-only">{mark.text}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** 하단에 고정되는 "다음/계속하기" 버튼 줄 */
export function StudioActionBar({ children }: { children: ReactNode }) {
  return (
    <div data-studio-action-bar className="fixed inset-x-0 bottom-0 z-20 border-t border-[#eadfc5] bg-[#f8f1e3]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl justify-end">{children}</div>
    </div>
  );
}

/**
 * 같은 카드 안의 피드백 — 맞았는지는 아이콘·글·색으로 함께 알린다.
 * 다음으로 가는 버튼은 화면 아래에 고정되고, 자동으로 넘어가지 않는다.
 * 피드백이 화면 밖이면 읽기 시작할 위치로 한 번만 옮긴다.
 */
export function StudioFeedback({ correct, title, body, answerLine, media, onNext, nextLabel, busy }: {
  correct: boolean | null; title: string; body?: ReactNode; answerLine?: ReactNode; media?: ReactNode;
  onNext: () => void; nextLabel: string; busy?: boolean;
}) {
  const tone = correct === null ? 'border-[#d9d3c3] bg-[#faf6ec] text-[#1c2742]' : correct ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-rose-300 bg-rose-50 text-rose-950';
  const icon = correct === null ? 'cloud_upload' : correct ? 'celebration' : 'lightbulb';
  const boxRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const shell = el.closest('[data-studio-shell]');
    const topBar = shell?.querySelector(':scope > [data-studio-top-bar]')
      ?? shell?.parentElement?.querySelector(':scope > [data-studio-top-bar]');
    const actionBar = nextRef.current?.closest('[data-studio-action-bar]');
    const top = (topBar?.getBoundingClientRect().bottom ?? 0) + 8;
    const bottom = (actionBar?.getBoundingClientRect().top ?? window.innerHeight) - 8;
    const fits = rect.height <= bottom - top;
    let delta = fits ? Math.min(rect.top - top, Math.max(rect.bottom - bottom, 0)) : rect.top - top;

    // Keep the question visible when the feedback heading can still be read with it.
    const prompt = el.closest('section')?.querySelector('[data-studio-prompt]');
    const heading = el.firstElementChild;
    if (fits && prompt && heading) {
      const lastScrollWithPrompt = prompt.getBoundingClientRect().top - top;
      const firstScrollWithHeading = heading.getBoundingClientRect().bottom - bottom;
      if (firstScrollWithHeading <= lastScrollWithPrompt) {
        delta = Math.min(delta, lastScrollWithPrompt);
      }
    }
    if (Math.abs(delta) > 4) {
      const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: window.scrollY + delta, behavior: calm ? 'auto' : 'smooth' });
    }
  }, []);
  return (
    <>
      <div ref={boxRef} role="status" className={`mt-5 space-y-3 rounded-2xl border-2 p-4 ${tone} ${correct ? 'studio-pop' : ''}`}>
        <div className={media ? 'flex items-center justify-between gap-3' : undefined}>
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-2 text-xl font-extrabold">
              <span aria-hidden="true" className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
              {title}
            </div>
            {answerLine && <p className="text-base">{answerLine}</p>}
          </div>
          {media && <div className="shrink-0">{media}</div>}
        </div>
        {body && <div className="text-base leading-relaxed">{body}</div>}
        <style>{`@keyframes studio-pop{0%{transform:scale(.97)}50%{transform:scale(1.015)}100%{transform:scale(1)}}.studio-pop{animation:studio-pop .45s ease-out}@media (prefers-reduced-motion:reduce){.studio-pop{animation:none}}`}</style>
      </div>
      <StudioActionBar>
        <button ref={nextRef} type="button" disabled={busy} onClick={onNext} className="min-h-12 w-full rounded-full bg-[#3b5bdb] px-8 text-lg font-bold text-white shadow active:scale-95 disabled:opacity-50 sm:w-auto sm:min-w-44">{nextLabel}</button>
      </StudioActionBar>
    </>
  );
}

/** 문장 덩어리(역할) 표시 — 문법 예문에서 쓴다 */
export function StudioChunks({ chunks }: { chunks: { text: string; role: string; term?: string }[] }) {
  return (
    <dl className="flex flex-wrap gap-2" aria-label="문장 덩어리와 역할">
      {chunks.map((chunk, index) => (
        <div key={index} className="max-w-full rounded-xl border border-[#d9def5] bg-[#eef1ff] px-3 py-2">
          <dt lang="en" className="break-words font-bold text-[#1c2742]">{chunk.text}</dt>
          <dd className="text-sm text-[#4a5470]">{chunk.role}{chunk.term ? ` (${chunk.term})` : ''}</dd>
        </div>
      ))}
    </dl>
  );
}
