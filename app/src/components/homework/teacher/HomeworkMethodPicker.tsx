import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from '../../AccessibleDialog';
import { MEMORY_METHODS, MEMORY_METHOD_LIST, type MemoryMethod } from '../../../lib/homework/memory';

const LEVEL: Record<MemoryMethod, 0 | 1 | 2> = {
  meaning: 0, reverse: 0, listen: 0, picture: 0,
  blank: 1, confuse: 1, letters: 1, sentence: 1,
  spell: 2, flash: 2, fade: 2, graduate: 2,
  copy: 0, hint: 1, typepic: 1, dictation: 2,
};
const LEVEL_NAME: [string, string][] = [['쉬움', 'Easy'], ['보통', 'Medium'], ['어려움', 'Hard']];
const LEVEL_STYLE = ['bg-emerald-100 text-emerald-900', 'bg-amber-100 text-amber-900', 'bg-rose-100 text-rose-900'];

const Pill = ({ children, on }: { children: ReactNode; on?: boolean }) => (
  <span className={`rounded-lg px-2 py-1 text-xs font-bold ${on ? 'bg-emerald-500 text-white' : 'bg-white text-deep-navy ring-1 ring-outline-variant'}`}>{children}</span>
);
const Tile = ({ children, ghost }: { children: ReactNode; ghost?: boolean }) => (
  <span className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-sm font-bold ${ghost ? 'border-2 border-dashed border-primary/40 text-transparent' : 'bg-white text-deep-navy shadow ring-1 ring-outline-variant'}`}>{children}</span>
);
const Frame = ({ children, label }: { children: ReactNode; label?: string }) => (
  <span className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl bg-white px-1.5 py-1.5 text-center ring-1 ring-outline-variant">
    {children}
    {label && <span className="text-[10px] font-bold text-on-surface-variant">{label}</span>}
  </span>
);
const Arrow = () => <span className="text-primary" aria-hidden="true">→</span>;
const Big = ({ children }: { children: ReactNode }) => <span className="text-2xl font-extrabold text-deep-navy">{children}</span>;
const Row = ({ children }: { children: ReactNode }) => <span className="flex flex-wrap items-center justify-center gap-1">{children}</span>;
const Mono = ({ children }: { children: ReactNode }) => <span className="font-mono text-lg font-bold">{children}</span>;

/** 학생이 보는 화면을 아주 작게 그려 방식을 한눈에 알아보게 한다(예: apple / 사과) */
export function MethodIllustration({ method, en }: { method: MemoryMethod; en: boolean }) {
  const k = (ko: string, e: string) => (en ? e : ko);
  const body = (() => {
    switch (method) {
      case 'meaning':
        return (<><Big>apple</Big><Row><Pill on>{k('사과', 'apple')}</Pill><Pill>{k('바나나', 'banana')}</Pill><Pill>{k('고양이', 'cat')}</Pill></Row></>);
      case 'reverse':
        return (<><Big>{k('사과', 'apple')}</Big><Row><Pill on>apple</Pill><Pill>banana</Pill><Pill>cat</Pill></Row></>);
      case 'listen':
        return (<><span className="text-3xl" aria-hidden="true">🔊</span><Row><Pill on>apple</Pill><Pill>apply</Pill><Pill>cat</Pill></Row></>);
      case 'picture':
        return (<><span className="text-4xl" aria-hidden="true">🍎</span><Row><Pill on>apple</Pill><Pill>banana</Pill><Pill>cat</Pill></Row></>);
      case 'blank':
        return (<><span className="text-sm font-bold text-deep-navy">I eat an ____.</span><Row><Pill on>apple</Pill><Pill>book</Pill><Pill>cat</Pill></Row></>);
      case 'spell':
        return (<><span className="text-sm font-bold text-on-surface-variant">{k('사과', 'apple')}</span><Row><Tile>a</Tile><Tile>p</Tile><Tile>p</Tile><Tile ghost>l</Tile><Tile ghost>e</Tile></Row><span className="text-[10px] text-on-surface-variant">{k('직접 써요', 'Type it')}</span></>);
      case 'letters':
        return (<><Row><Tile>e</Tile><Tile>p</Tile><Tile>l</Tile><Tile>a</Tile><Tile>p</Tile></Row><Arrow /><Row><Tile>a</Tile><Tile>p</Tile><Tile>p</Tile><Tile>l</Tile><Tile>e</Tile></Row></>);
      case 'sentence':
        return (<><Row><Tile>apples</Tile><Tile>I</Tile><Tile>like</Tile></Row><Arrow /><Row><Tile>I</Tile><Tile>like</Tile><Tile>apples</Tile></Row></>);
      case 'flash':
        return (
          <span className="flex w-full items-stretch gap-1">
            <Frame label={k('1.5초 보기', '1.5s')}><Big>apple</Big></Frame><Arrow />
            <Frame label={k('가려져요', 'hidden')}><span className="text-2xl" aria-hidden="true">🙈</span></Frame><Arrow />
            <Frame label={k('기억해서 쓰기', 'write it')}><Row><Tile>a</Tile><Tile ghost>p</Tile></Row></Frame>
          </span>
        );
      case 'fade':
        return (
          <span className="flex w-full items-stretch gap-1">
            <Frame><Mono>apple</Mono></Frame><Arrow />
            <Frame><Mono>_pp_e</Mono></Frame><Arrow />
            <Frame><Mono>_p__e</Mono></Frame><Arrow />
            <Frame label={k('직접 쓰기', 'write')}><Mono>?</Mono></Frame>
          </span>
        );
      case 'copy':
        return (<><Mono>apple</Mono><Row><Tile>a</Tile><Tile>p</Tile><Tile>p</Tile><Tile>l</Tile><Tile>e</Tile></Row><span className="text-[10px] text-on-surface-variant">{k('보면서 똑같이', 'Copy it')}</span></>);
      case 'hint':
        return (<><span className="text-sm font-bold text-on-surface-variant">{k('사과', 'apple')}</span><Mono>a _ _ _ e</Mono><Row><Tile>a</Tile><Tile ghost>p</Tile><Tile ghost>p</Tile><Tile ghost>l</Tile><Tile>e</Tile></Row></>);
      case 'typepic':
        return (<><span className="text-4xl" aria-hidden="true">🍎</span><Row><Tile ghost>a</Tile><Tile ghost>p</Tile><Tile ghost>p</Tile><Tile ghost>l</Tile><Tile ghost>e</Tile></Row><span className="text-[10px] text-on-surface-variant">{k('그림만 보고 써요', 'Picture only')}</span></>);
      case 'dictation':
        return (<><span className="text-3xl" aria-hidden="true">🔊</span><Row><Tile ghost>a</Tile><Tile ghost>p</Tile><Tile ghost>p</Tile><Tile ghost>l</Tile><Tile ghost>e</Tile></Row><span className="text-[10px] text-on-surface-variant">{k('듣고 써요', 'Hear and type')}</span></>);
      case 'confuse':
        return (<><span className="text-sm font-bold text-on-surface-variant">{k('사과', 'apple')}</span><Row><Pill on>apple</Pill><Pill>apply</Pill><Pill>ample</Pill></Row><span className="text-[10px] text-on-surface-variant">{k('철자가 비슷해요', 'Look-alikes')}</span></>);
      case 'graduate':
        return (<><span className="text-3xl" aria-hidden="true">🎓</span><Row><Pill>{k('뜻', 'meaning')}</Pill><Pill>{k('듣기', 'listen')}</Pill><Pill>{k('철자', 'spell')}</Pill><Pill>{k('빈칸', 'blank')}</Pill></Row></>);
    }
  })();
  return <span className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-xl bg-primary/5 p-2">{body}</span>;
}

/** 암기 방식을 그림 카드로 보여 주고 고르게 하는 창 */
export default function HomeworkMethodPicker({ onPick, onClose }: { onPick: (methods: MemoryMethod[]) => void; onClose: () => void }) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const [sel, setSel] = useState<MemoryMethod[]>([]);
  const toggle = (m: MemoryMethod) => setSel((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  return (
    <AccessibleDialog label={en ? 'Choose a method' : '암기 방식 고르기'} onClose={onClose}>
      <div className="hw-game-picker bg-white p-4 text-deep-navy sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{en ? 'Choose a memorize method' : '암기 방식 고르기'}</h2>
          <button type="button" onClick={onClose} className="min-h-11 rounded-full border border-outline-variant px-4 font-bold">{en ? 'Close' : '닫기'}</button>
        </div>
        <p className="mb-4 text-sm text-on-surface-variant">
          {en ? 'Small pictures show what the student sees (example: apple). Tap to select several, then add.' : '학생이 보는 화면을 작게 그렸어요(예: apple). 여러 개를 눌러 고른 뒤 한꺼번에 추가할 수 있어요. 번호 순서대로 이어져요.'}
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MEMORY_METHOD_LIST.map((m) => (
            <li key={m}>
              <button type="button" aria-pressed={sel.includes(m)} onClick={() => toggle(m)} className={`relative flex h-full w-full flex-col gap-2 rounded-2xl bg-white p-3 text-left shadow-card transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-primary ${sel.includes(m) ? 'ring-4 ring-primary' : 'ring-1 ring-outline-variant hover:ring-primary'}`}>
                <span className={`absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${sel.includes(m) ? 'bg-primary text-on-primary' : 'border-2 border-outline-variant bg-white/80 text-transparent'}`} aria-hidden="true">{sel.includes(m) ? sel.indexOf(m) + 1 : '○'}</span>
                <MethodIllustration method={m} en={en} />
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold">{MEMORY_METHODS[m].name[en ? 1 : 0]}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${LEVEL_STYLE[LEVEL[m]]}`}>{LEVEL_NAME[LEVEL[m]][en ? 1 : 0]}</span>
                </span>
                <span className="text-sm text-on-surface-variant">{MEMORY_METHODS[m].help[en ? 1 : 0]}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="sticky -bottom-4 -mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant bg-white px-4 py-3 sm:-bottom-6 sm:-mx-6 sm:px-6">
          <span className="text-base font-bold">{en ? `${sel.length} selected` : `${sel.length}개 선택됨`}</span>
          <span className="flex gap-2">
            <button type="button" disabled={sel.length === 0} onClick={() => setSel([])} className="min-h-11 rounded-full border border-outline-variant px-4 font-bold disabled:opacity-40">{en ? 'Clear' : '선택 해제'}</button>
            <button type="button" disabled={sel.length === 0} onClick={() => onPick(sel)} className="min-h-11 rounded-full bg-primary px-6 font-bold text-on-primary disabled:opacity-40">{en ? 'Add selected' : '선택한 것 추가'}</button>
          </span>
        </div>
      </div>
    </AccessibleDialog>
  );
}
