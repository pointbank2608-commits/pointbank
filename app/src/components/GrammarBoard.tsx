import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSyncedSubState } from '../lib/presentSync';
import { useTranslation } from 'react-i18next';
import { BOARD_FONTS, boardSlideStyle, boardTheme } from '../lib/boardThemes';
import { classroomStep, grammarLevelTag, parseMarked, plainText, type GeneratedSentence, type GrammarPoint, type GrammarTeachingStep } from '../lib/grammar';
import { speak, speakSequence } from '../lib/speech';
import { CanvasStageBox } from './CanvasSlideView';
import GuidedPracticePanel from './grammar/GuidedPracticePanel';

export type GrammarField = 'name' | 'pattern' | 'explain' | 'rule' | 'en' | 'ko' | 'usage' | 'detail' | 'tip' | 'wrong' | 'right' | 'why' | Exclude<keyof GrammarTeachingStep, 'practice'>;
export interface GrammarBoardPosition {
  view: 'lesson' | 'examples' | 'pitfalls' | 'explain';
  step: number;
  hintOpen: boolean;
  answerOpen: boolean;
  showKo: boolean;
  shown: number;
}
export interface GrammarBoardEditor {
  field: (key: GrammarField, value: string, display: ReactNode, index?: number) => ReactNode;
  addExample: () => void;
  addPitfall: () => void;
}

/**
 * 문법 한 가지를 칠판·화이트보드에 띄우는 화면 — 커리큘럼 "문법" 슬라이드와 문법 페이지의
 * "크게 보기"가 같이 쓴다. 16:9 무대에 글자 크기를 cqh 로 줘서 작은 미리보기·전자칠판 어디서든
 * 같은 비율로 보인다.
 *
 * 수업 흐름(SEE → CHOOSE…): 문장 틀을 먼저 보여주고, 예문은 하나씩 꺼내(→ / Space) 읽어준다.
 */
export default function GrammarBoard({
  point,
  extra = [],
  themeId,
  interactive = true,
  keyboard = interactive,
  className = '',
  initialShowKo = false,
  initialRevealAll = false,
  onCue,
  editor,
  initialPosition,
  requestedStage,
  onPositionChange,
}: {
  point: GrammarPoint;
  /** 우리 단어장으로 만든 예문 */
  extra?: GeneratedSentence[];
  themeId?: string | null;
  /** false 면 미리보기(버튼·키보드 없이 예문 전부 표시) */
  interactive?: boolean;
  keyboard?: boolean;
  className?: string;
  /** 슬라이드 설정: 해석을 켠 채로 시작 */
  initialShowKo?: boolean;
  /** 슬라이드 설정: 예문을 처음부터 모두 보여주기(하나씩 꺼내지 않음) */
  initialRevealAll?: boolean;
  onCue?: (action: 'shown' | 'submitted' | 'hint' | 'revealed', stageIndex: number) => void;
  editor?: GrammarBoardEditor;
  initialPosition?: GrammarBoardPosition;
  requestedStage?: { index:number };
  onPositionChange?: (position: GrammarBoardPosition) => void;
}) {
  const { t } = useTranslation();
  const th = boardTheme(themeId ?? 'green') ?? boardTheme('green')!;
  const lines = [
    ...point.examples.map((m, i) => ({ marked: m, mine: false, ko: point.translations?.[i] ?? null })),
    ...extra.map((g) => ({ marked: g.marked, mine: true, ko: null as string | null })),
  ];
  const startShown = !interactive || initialRevealAll ? lines.length : 1;
  const [shown, setShown] = useState(Math.min(initialPosition?.shown ?? startShown, lines.length));
  // 예문 / 틀리기 쉬운 것(✗ → ✓) / 설명(이럴 때 써요·쉽게 이해하기) 화면
  const startView = point.steps?.length === 6 && !initialRevealAll && !initialShowKo ? 'lesson' : 'examples';
  const [view, setView] = useState<GrammarBoardPosition['view']>(initialPosition?.view ?? startView);
  const [step, setStep] = useState(initialPosition?.step ?? 0);
  const [hintOpen, setHintOpen] = useState(initialPosition?.hintOpen ?? false);
  const [answerOpen, setAnswerOpen] = useState(initialPosition?.answerOpen ?? false);
  const lesson = classroomStep(point,step);
  const cue = useRef(onCue);
  cue.current = onCue;
  const observed = !!onCue;
  useEffect(() => {
    if (observed && view === 'lesson') cue.current?.('shown', step);
  }, [observed, point.id, view, step]);
  function moveTo(index: number) {
    setStep(index);
    setHintOpen(false);
    setAnswerOpen(false);
  }
  useEffect(()=>{
    if(requestedStage){setView('lesson');moveTo(requestedStage.index);}
  },[requestedStage]);
  const pitfalls = point.pitfalls ?? [];
  const hasExplain = !!(point.usage?.length || point.detail?.length);
  // 예문 해석(초보자용) — 켜면 예문 아래에 작게 한국어가 붙는다.
  const [showKo, setShowKo] = useState(initialPosition?.showKo ?? initialShowKo);
  useEffect(() => {
    onPositionChange?.({ view, step, hintOpen, answerOpen, showKo, shown });
  }, [onPositionChange, view, step, hintOpen, answerOpen, showKo, shown]);
  const translations = point.translations ?? [];
  const shownRef = useRef(shown);
  shownRef.current = shown;
  // 학생 따라보기: 선생님이 꺼낸 예문 수·화면·해석을 학생 화면에 그대로
  const follower = useSyncedSubState({ shown, view, showKo, step, hintOpen, answerOpen }, (s) => {
    setStep(Math.max(0, Math.min(5, Number(s.step) || 0)));
    setHintOpen(!!s.hintOpen);
    setAnswerOpen(!!s.answerOpen);
    setShown(Number(s.shown) || 1);
    setView((s.view as typeof view) ?? 'examples');
    setShowKo(!!s.showKo);
  });

  const resetExampleCount = editor ? 0 : point.examples.length;
  const resetKey = JSON.stringify([point.id, interactive, resetExampleCount, extra.length, initialRevealAll, initialShowKo]);
  const previousKey = useRef(resetKey);
  useEffect(() => {
    if (previousKey.current === resetKey) return;
    previousKey.current = resetKey;
    setShown(startShown);
    setView(startView);
    moveTo(0);
    setShowKo(initialShowKo);
  }, [resetKey, startShown, startView, initialShowKo]);

  // → · Space · PageDown(클리커): 예문을 하나씩 꺼낸다. 다 꺼냈으면 그냥 흘려보내서 발표 진행바가
  // 다음 슬라이드로 넘긴다. ← · PageUp 은 반대. capture 단계에서 먼저 받아 처리한 키만 전파를 막는다.
  useEffect(() => {
    if (!keyboard || follower) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ((tag === 'BUTTON' || tag === 'SUMMARY') && e.key === ' ')) return;
      const forward = e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown';
      const back = e.key === 'ArrowLeft' || e.key === 'PageUp';
      if (view === 'lesson') {
        if ((forward && step < 5) || (back && step > 0)) {
          e.preventDefault();
          e.stopPropagation();
          moveTo(step + (forward ? 1 : -1));
        }
        return;
      }
      if (forward && shownRef.current < lines.length) {
        e.preventDefault();
        e.stopPropagation();
        setView('examples');
        setShown((n) => Math.min(lines.length, n + 1));
      } else if (back && shownRef.current > 1) {
        e.preventDefault();
        e.stopPropagation();
        setShown((n) => Math.max(1, n - 1));
      } else if (e.key === ' ') {
        e.preventDefault();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [keyboard, lines.length, follower, view, step]);

  const visible = editor ? lines : lines.slice(0, shown);
  function field(key: GrammarField, value: string, display: ReactNode = value, index?: number) {
    return editor ? editor.field(key, value, display, index) : display;
  }
  const firstMine = lines.findIndex((l) => l.mine);
  const firstMineIdx = firstMine;
  // ── 글자 크기 맞추기 ──
  // 무대 폭은 약 178cqh(16:9), 높이 100cqh. 낱말 수가 아니라 "몇 줄로 접힐지"를 글자 수로 어림해서
  // 예문 칸에 다 들어가는 가장 큰 글자를 고른다. 한 단으로는 칠판에서 안 보일 만큼 작아지면 두 단으로.
  const padX = th.frame ? 6 : 5;
  const innerW = 177.8 - padX * 2;
  const EN = 0.55; // 영어 한 글자 폭(글자 크기 대비)
  const KO = 0.95; // 한글 한 글자 폭
  const wrapLines = (len: number, charW: number, size: number, width: number) => Math.max(1, Math.ceil((len * charW * size) / width));
  const ruleSpace = view === 'explain' || !point.rule?.length
    ? 0
    : point.rule.reduce((sum, r) => sum + wrapLines(r.length, KO, 2.6, innerW - 4) * 2.6 * 1.4, 0) + 3.4;
  const patternSpace = (wrapLines(plainText(point.pattern).length, EN, 6.4, innerW) - 1) * 8.4;
  const explainSpace = (wrapLines(point.explain.length, KO, 3.2, innerW) - 1) * 4.4;
  const room = (interactive ? 50 : 56) - ruleSpace - patternSpace - explainSpace;
  const maxSize = point.stage === 'elementary' ? 5.4 : 4.4;
  const withKo = showKo && translations.length > 0;
  const itemHeight = (l: (typeof lines)[number], idx: number, size: number, width: number) => {
    const avail = width - size * 2.6; // 번호·스피커 아이콘 자리
    let h = wrapLines(plainText(l.marked).length, EN, size, avail) * size * 1.3 + 1.2;
    if (withKo && l.ko) h += wrapLines(l.ko.length, KO, size * 0.6, avail) * size * 0.6 * 1.4;
    if (idx === firstMineIdx) h += 2.6 * 1.3 + 0.8;
    return h;
  };
  const heightFor = (size: number, cols: 1 | 2) => {
    const width = cols === 1 ? innerW : (innerW - 4) / 2;
    if (cols === 1) return lines.reduce((sum, l, idx) => sum + itemHeight(l, idx, size, width), 0);
    const half = Math.ceil(lines.length / 2);
    const col = (from: number, to: number) => lines.slice(from, to).reduce((sum, l, k) => sum + itemHeight(l, from + k, size, width), 0);
    return Math.max(col(0, half), col(half, lines.length));
  };
  const bestSize = (cols: 1 | 2) => {
    for (let size = maxSize; size > 2.4; size -= 0.1) if (heightFor(size, cols) <= room) return size;
    return 2.4;
  };
  const oneColSize = bestSize(1);
  const twoCol = lines.length >= 4 && oneColSize < 3.6 && bestSize(2) > oneColSize;
  const lineSize = twoCol ? bestSize(2) : oneColSize;
  const wrongColor = th.dark ? '#fca5a5' : '#dc2626';
  const font = BOARD_FONTS[th.font];

  function Marked({ text, mine }: { text: string; mine?: boolean }) {
    return (
      <>
        {parseMarked(text).map((seg, i) =>
          seg.strong ? (
            <span
              key={i}
              style={{
                color: th.accent,
                fontWeight: 700,
                textDecoration: mine ? 'underline dotted' : undefined,
                textUnderlineOffset: '0.6cqh',
              }}
            >
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </>
    );
  }

  /** 문장 틀 — [ ] 는 빈칸 상자로. */
  function Pattern() {
    return (
      <>
        {point.pattern.split(/(\[[^\]]*\])/).map((part, i) =>
          /^\[.*\]$/.test(part) ? (
            <span
              key={i}
              className="mx-[0.6cqh] inline-block align-baseline"
              style={{ minWidth: '12cqh', borderBottom: `0.5cqh solid ${th.muted}`, color: th.muted, fontSize: '0.7em', textAlign: 'center' }}
            >
              {part.slice(1, -1).trim()}
            </span>
          ) : (
            <Marked key={i} text={part} />
          ),
        )}
      </>
    );
  }

  return (
    <div className={`flex h-full w-full items-center justify-center ${className}`} style={{ containerType: 'size' }}>
      <CanvasStageBox fitParent className="rounded-xl shadow-[0_8px_28px_rgba(0,0,0,0.15)]">
        <div className="absolute inset-0" style={boardSlideStyle(th)} />
        <div
          className={`absolute inset-0 flex flex-col ${editor ? 'grammar-edit-surface' : ''}`}
          style={{ padding: th.frame ? '5cqh 6cqh' : '4cqh 5cqh', color: th.text, fontFamily: font }}
        >
          <div className="flex items-center gap-[1.5cqh]" style={{ fontSize: '2.8cqh', color: th.muted }}>
            <span className="rounded-full px-[1.4cqh] py-[0.3cqh]" style={{ background: th.chip }}>
              {point.workshop ? (point.workshop.grade<=6?'초'+point.workshop.grade:point.workshop.grade<=9?'중'+(point.workshop.grade-6):'고'+(point.workshop.grade-9)) : grammarLevelTag(point)}
            </span>
            <span>{view === 'lesson' && lesson?.practice?.independentPrompts && !editor ? lesson.practice.title : field('name', point.name)}</span>
          </div>
          {view === 'lesson' && lesson ? <section key={step} className="mt-[2cqh] min-h-0 flex-1 space-y-[2cqh] overflow-y-auto pb-[9cqh]" style={{ fontFamily: BOARD_FONTS.sans }}>
            <h2 className="font-bold" style={{ fontSize: '4.8cqh', color: th.accent }}>{step + 1} / 6 · {lesson.practice?.title ?? t('myGrammar.stage' + (step + 1))}</h2>
            {step === 0 && point.audience && <div className="space-y-[0.8cqh] rounded-[1cqh] p-[1.6cqh]" style={{ background: th.chip, fontSize: '3.2cqh' }}>
              <p>{field('explain', point.explain, <Marked text={point.explain} />)}</p>
              {point.examples[0] && <div>
                <p className="font-bold">{field('en', point.examples[0], <Marked text={point.examples[0]} />, 0)}</p>
                {point.translations?.[0] && <p>{field('ko', point.translations[0], <Marked text={point.translations[0]} />, 0)}</p>}
              </div>}
            </div>}
            <p className="whitespace-pre-line leading-snug" style={{ fontSize: '4.2cqh' }}>{field('prompt', lesson.prompt, <Marked text={lesson.prompt} />, step)}</p>
            {interactive && lesson.practice && <div style={{ fontSize: '3.4cqh' }}>
              <GuidedPracticePanel practice={lesson.practice} workshop={point.workshop} review={[lesson.answer, lesson.followUp].join('\n\n')} onHelp={() => onCue?.('hint', step)} onReveal={() => {onCue?.('submitted',step);onCue?.('revealed', step);}} />
            </div>}
            {hintOpen && (!lesson.practice?.independentPrompts || editor) && <p className="whitespace-pre-line rounded-[1cqh] p-[1.4cqh]" style={{ background: th.chip, fontSize: '3.2cqh' }}>
              <strong>{t('myGrammar.hint')} · </strong>{field('hint', lesson.hint, <Marked text={lesson.hint} />, step)}
            </p>}
            {answerOpen && (!lesson.practice?.independentPrompts || editor) && <div className="space-y-[1cqh] whitespace-pre-line" style={{ fontSize: '3.4cqh' }}>
                <div className="pt-[1cqh]"><strong className="block" style={{ color: th.accent, fontSize: '2.6cqh' }}>{t('myGrammar.answer')}</strong>{field('answer', lesson.answer, <Marked text={lesson.answer} />, step)}</div>
                <div className="mt-[2cqh] border-t pt-[1.3cqh]" style={{ borderColor: th.muted }}><strong className="block" style={{ color: th.accent, fontSize: '2.6cqh' }}>{t('myGrammar.followUp')}</strong>{field('followUp', lesson.followUp, <Marked text={lesson.followUp} />, step)}</div>
            </div>}
          </section> : <>
          <div className="mt-[2cqh] font-bold leading-tight" style={{ fontSize: '6.4cqh' }}>
            {field('pattern', point.pattern, <Pattern />)}
          </div>
          <div className="mt-[1.2cqh]" style={{ fontSize: '3.2cqh', color: th.muted, fontFamily: BOARD_FONTS.sans }}>
            {field('explain', point.explain)}
          </div>
          {view !== 'explain' && (!!point.rule?.length || editor) && (
            <div
              className="mt-[1.6cqh] space-y-[0.5cqh] rounded-[1.5cqh] px-[2cqh] py-[1.2cqh]"
              style={{ background: th.chip, fontSize: '2.6cqh', fontFamily: BOARD_FONTS.sans }}
            >
              {field('rule', point.rule?.join('\n') ?? '', point.rule?.map((r, i) => (
                <span key={i} className="flex gap-[1cqh]">
                  <span style={{ color: th.accent }}>▸</span>
                  <span>{r}</span>
                </span>
              )))}
            </div>
          )}
          <div className="mt-[2cqh] h-px w-full" style={{ background: th.line }} />
          {view === 'explain' ? (
            <div
              className="mt-[2cqh] grid min-h-0 flex-1 grid-cols-2 content-start gap-x-[4cqh] gap-y-[1.6cqh] overflow-y-auto pb-[6cqh]"
              style={{ fontSize: '2.8cqh', lineHeight: 1.45, fontFamily: BOARD_FONTS.sans }}
            >
              {(editor || !!point.usage?.length) && (
                <div>
                  <div style={{ color: th.accent, fontWeight: 700 }}>💡 {t('grammar.usageTitle')}</div>
                  {field('usage', point.usage?.join('\n') ?? '', point.usage?.map((u, i) => (
                    <span className="block" key={i}>· {u}</span>
                  )))}
                </div>
              )}
              {(editor || !!point.detail?.length) && (
                <div>
                  <div style={{ color: th.accent, fontWeight: 700 }}>📘 {t('grammar.detailTitle')}</div>
                  {field('detail', point.detail?.join('\n') ?? '', point.detail?.map((d, i) => (
                    <span className="block" key={i}>
                      {i + 1}. {d}
                    </span>
                  )))}
                </div>
              )}
              {(editor || point.tip) && (
                <div className="col-span-2 rounded-[1.5cqh] px-[2cqh] py-[1cqh]" style={{ background: th.chip }}>
                  ✨ {field('tip', point.tip ?? '')}
                </div>
              )}
            </div>
          ) : view === 'pitfalls' ? (
            <ul className="mt-[2cqh] flex min-h-0 flex-1 flex-col gap-[2cqh] overflow-y-auto" style={{ fontSize: '3.8cqh' }}>
              {pitfalls.map((pf, i) => (
                <li key={i} className="space-y-[0.4cqh]">
                  <div style={{ color: wrongColor }}>
                    ✗ <span className="line-through decoration-[0.3cqh]">{field('wrong', pf.wrong, pf.wrong, i)}</span>
                  </div>
                  {editor ? <div>✓ {field('right', pf.right, <Marked text={pf.right} />, i)}</div> : <button type="button" onClick={() => speak(plainText(pf.right))} className="text-left">
                    ✓ <Marked text={pf.right} />
                  </button>}
                  <div style={{ fontSize: '0.65em', color: th.muted, fontFamily: BOARD_FONTS.sans }}>{field('why', pf.why, pf.why, i)}</div>
                </li>
              ))}
            </ul>
          ) : (
          <ul
            className={`mt-[2cqh] min-h-0 flex-1 gap-[1.2cqh] overflow-y-auto ${twoCol ? 'grid grid-cols-2 content-start gap-x-[4cqh]' : 'flex flex-col'}`}
            // 오른쪽 아래 버튼 줄과 겹치지 않게 아래를 비워 둔다.
            style={{
              fontSize: `${lineSize}cqh`,
              paddingBottom: interactive ? '6cqh' : 0,
              // 두 단이면 왼쪽 단을 먼저 채운다(1·2·3 | 4·5·6) — 하나씩 꺼낼 때도 읽는 순서 그대로.
              ...(twoCol ? { gridTemplateRows: `repeat(${Math.ceil(lines.length / 2)}, auto)`, gridAutoFlow: 'column' } : {}),
            }}
          >
            {visible.map((line, i) => (
              <li key={i}>
                {i === firstMine && (
                  <div className="mb-[0.8cqh]" style={{ fontSize: '2.6cqh', color: th.muted, fontFamily: BOARD_FONTS.sans }}>
                    {t('grammar.fromWordList')}
                  </div>
                )}
                {editor ? <div className="flex items-baseline gap-[1.2cqh]">
                  <span style={{ color: th.muted, fontSize: '0.7em' }}>{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    {field('en', line.marked, <Marked text={line.marked} />, i)}
                    {showKo && <div style={{ fontSize: '0.65em', color: th.muted, fontFamily: BOARD_FONTS.sans }}>
                      {field('ko', line.ko ?? '', line.ko, i)}
                    </div>}
                  </div>
                </div> : <button
                  type="button"
                  tabIndex={interactive ? 0 : -1}
                  onClick={() => interactive && speak(plainText(line.marked))}
                  className="flex items-center gap-[1.2cqh] text-left"
                  style={{ cursor: interactive ? 'pointer' : 'default' }}
                >
                  <span style={{ color: th.muted, fontSize: '0.7em' }}>{i + 1}.</span>
                  <span>
                    <Marked text={line.marked} mine={line.mine} />
                    {showKo && line.ko && (
                      <span className="block" style={{ fontSize: '0.6em', color: th.muted, fontFamily: BOARD_FONTS.sans }}>
                        {line.ko}
                      </span>
                    )}
                  </span>
                  {interactive && (
                    <span className="material-symbols-outlined" style={{ fontSize: '0.8em', color: th.muted }}>
                      volume_up
                    </span>
                  )}
                </button>}
              </li>
            ))}
          </ul>
          )}
          </>}
        </div>
        {interactive && (
          <div className="absolute bottom-[2.5cqh] right-[3cqh] flex items-center gap-[1cqh]" style={{ fontSize: '2.4cqh' }}>
            {point.steps?.length === 6 && (view !== 'lesson' || !lesson?.practice?.independentPrompts || editor) && <BoardButton icon={view === 'lesson' ? undefined : 'menu_book'}
              label={t(view === 'lesson' ? 'grammar.backToExamples' : 'myGrammar.sixSteps')}
              onClick={() => setView(view === 'lesson' ? 'examples' : 'lesson')} />}
            {view === 'lesson' && <>
              {(!lesson?.practice?.independentPrompts || editor) && <>
              <BoardButton pressed={hintOpen} label={t('myGrammar.hint')} onClick={() => {
                if (!hintOpen) onCue?.('hint', step);
                setHintOpen(!hintOpen);
              }} />
              <BoardButton pressed={answerOpen} label={t('myGrammar.answer')} onClick={() => {
                if (!answerOpen) onCue?.('revealed', step);
                setAnswerOpen(!answerOpen);
              }} />
              </>}
              <BoardButton label={t('myGrammar.prev')} disabled={step === 0} onClick={() => moveTo(step - 1)} />
              <BoardButton label={t('myGrammar.next')} disabled={step === 5} onClick={() => moveTo(step + 1)} />
            </>}
            {view !== 'lesson' && (hasExplain || editor) && (
              <BoardButton
                icon={view === 'explain' ? 'format_list_numbered' : 'menu_book'}
                label={view === 'explain' ? t('grammar.backToExamples') : t('grammar.explainView')}
                onClick={() => setView((v) => (v === 'explain' ? 'examples' : 'explain'))}
              />
            )}
            {(pitfalls.length > 0 || editor) && view !== 'lesson' && view !== 'explain' && (
              <BoardButton
                icon={view === 'pitfalls' ? 'format_list_numbered' : 'error'}
                label={view === 'pitfalls' ? t('grammar.backToExamples') : t('grammar.pitfalls')}
                onClick={() => setView((v) => (v === 'pitfalls' ? 'examples' : 'pitfalls'))}
              />
            )}
            {view === 'examples' && (translations.length > 0 || editor) && (
              <BoardButton icon="translate" label={showKo ? t('grammar.hideKo') : t('grammar.showKo')} onClick={() => setShowKo((v) => !v)} />
            )}
            {editor && view === 'examples' && <BoardButton icon="add" label={t('myGrammar.addExample')} onClick={editor.addExample} />}
            {editor && view === 'pitfalls' && <BoardButton icon="add" label={t('myGrammar.addPitfall')} onClick={editor.addPitfall} />}
            {view === 'examples' && !editor && (
            <>
            <BoardButton
              icon="visibility"
              label={shown < lines.length ? t('grammar.showNext', { n: shown, total: lines.length }) : t('grammar.allShown')}
              disabled={shown >= lines.length}
              onClick={() => setShown((n) => Math.min(lines.length, n + 1))}
            />
            <BoardButton icon="done_all" label={t('grammar.showAll')} disabled={shown >= lines.length} onClick={() => setShown(lines.length)} />
            <BoardButton icon="volume_up" label={t('grammar.readAll')} onClick={() => speakSequence(visible.map((l) => plainText(l.marked)))} />
            </>
            )}
          </div>
        )}
      </CanvasStageBox>
    </div>
  );
}

function BoardButton({ icon, label, onClick, disabled, pressed }: { icon?: string; label: string; onClick: () => void; disabled?: boolean; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className="flex items-center gap-[0.6cqh] rounded-full bg-white/90 px-[1.8cqh] py-[0.9cqh] font-bold text-[#1f2937] shadow-md transition-opacity hover:bg-white disabled:opacity-40"
      style={{ fontFamily: BOARD_FONTS.sans }}
    >
      {icon && <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: '1.2em' }}>
        {icon}
      </span>}
      {label}
    </button>
  );
}
