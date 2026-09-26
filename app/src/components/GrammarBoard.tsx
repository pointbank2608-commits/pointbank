import { useEffect, useRef, useState } from 'react';
import { useSyncedSubState } from '../lib/presentSync';
import { useTranslation } from 'react-i18next';
import { BOARD_FONTS, boardSlideStyle, boardTheme } from '../lib/boardThemes';
import { grammarLevelTag, parseMarked, plainText, type GeneratedSentence, type GrammarPoint } from '../lib/grammar';
import { speak, speakSequence } from '../lib/speech';
import { CanvasStageBox } from './CanvasSlideView';

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
  className = '',
  initialShowKo = false,
  initialRevealAll = false,
}: {
  point: GrammarPoint;
  /** 우리 단어장으로 만든 예문 */
  extra?: GeneratedSentence[];
  themeId?: string | null;
  /** false 면 미리보기(버튼·키보드 없이 예문 전부 표시) */
  interactive?: boolean;
  className?: string;
  /** 슬라이드 설정: 해석을 켠 채로 시작 */
  initialShowKo?: boolean;
  /** 슬라이드 설정: 예문을 처음부터 모두 보여주기(하나씩 꺼내지 않음) */
  initialRevealAll?: boolean;
}) {
  const { t } = useTranslation();
  const th = boardTheme(themeId ?? 'green') ?? boardTheme('green')!;
  const lines = [
    ...point.examples.map((m, i) => ({ marked: m, mine: false, ko: point.translations?.[i] ?? null })),
    ...extra.map((g) => ({ marked: g.marked, mine: true, ko: null as string | null })),
  ];
  const startShown = !interactive || initialRevealAll ? lines.length : 1;
  const [shown, setShown] = useState(startShown);
  // 예문 / 틀리기 쉬운 것(✗ → ✓) / 설명(이럴 때 써요·쉽게 이해하기) 화면
  const [view, setView] = useState<'examples' | 'pitfalls' | 'explain'>('examples');
  const pitfalls = point.pitfalls ?? [];
  const hasExplain = !!(point.usage?.length || point.detail?.length);
  // 예문 해석(초보자용) — 켜면 예문 아래에 작게 한국어가 붙는다.
  const [showKo, setShowKo] = useState(initialShowKo);
  const translations = point.translations ?? [];
  const shownRef = useRef(shown);
  shownRef.current = shown;
  // 학생 따라보기: 선생님이 꺼낸 예문 수·화면·해석을 학생 화면에 그대로
  const follower = useSyncedSubState({ shown, view, showKo }, (s) => {
    setShown(Number(s.shown) || 1);
    setView((s.view as typeof view) ?? 'examples');
    setShowKo(!!s.showKo);
  });

  useEffect(() => {
    setShown(startShown);
    setView('examples');
    setShowKo(initialShowKo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point.id, interactive, extra.length, initialRevealAll, initialShowKo]);

  // → · Space · PageDown(클리커): 예문을 하나씩 꺼낸다. 다 꺼냈으면 그냥 흘려보내서 발표 진행바가
  // 다음 슬라이드로 넘긴다. ← · PageUp 은 반대. capture 단계에서 먼저 받아 처리한 키만 전파를 막는다.
  useEffect(() => {
    if (!interactive || follower) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const forward = e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown';
      const back = e.key === 'ArrowLeft' || e.key === 'PageUp';
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
  }, [interactive, lines.length, follower]);

  const visible = lines.slice(0, shown);
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
          className="absolute inset-0 flex flex-col"
          style={{ padding: th.frame ? '5cqh 6cqh' : '4cqh 5cqh', color: th.text, fontFamily: font }}
        >
          <div className="flex items-center gap-[1.5cqh]" style={{ fontSize: '2.8cqh', color: th.muted }}>
            <span className="rounded-full px-[1.4cqh] py-[0.3cqh]" style={{ background: th.chip }}>
              {grammarLevelTag(point)}
            </span>
            <span>{point.name}</span>
          </div>
          <div className="mt-[2cqh] font-bold leading-tight" style={{ fontSize: '6.4cqh' }}>
            <Pattern />
          </div>
          <div className="mt-[1.2cqh]" style={{ fontSize: '3.2cqh', color: th.muted, fontFamily: BOARD_FONTS.sans }}>
            {point.explain}
          </div>
          {view !== 'explain' && point.rule && point.rule.length > 0 && (
            <ul
              className="mt-[1.6cqh] space-y-[0.5cqh] rounded-[1.5cqh] px-[2cqh] py-[1.2cqh]"
              style={{ background: th.chip, fontSize: '2.6cqh', fontFamily: BOARD_FONTS.sans }}
            >
              {point.rule.map((r, i) => (
                <li key={i} className="flex gap-[1cqh]">
                  <span style={{ color: th.accent }}>▸</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-[2cqh] h-px w-full" style={{ background: th.line }} />
          {view === 'explain' ? (
            <div
              className="mt-[2cqh] grid min-h-0 flex-1 grid-cols-2 content-start gap-x-[4cqh] gap-y-[1.6cqh] overflow-y-auto pb-[6cqh]"
              style={{ fontSize: '2.8cqh', lineHeight: 1.45, fontFamily: BOARD_FONTS.sans }}
            >
              {point.usage && point.usage.length > 0 && (
                <div>
                  <div style={{ color: th.accent, fontWeight: 700 }}>💡 {t('grammar.usageTitle')}</div>
                  {point.usage.map((u, i) => (
                    <div key={i}>· {u}</div>
                  ))}
                </div>
              )}
              {point.detail && point.detail.length > 0 && (
                <div>
                  <div style={{ color: th.accent, fontWeight: 700 }}>📘 {t('grammar.detailTitle')}</div>
                  {point.detail.map((d, i) => (
                    <div key={i}>
                      {i + 1}. {d}
                    </div>
                  ))}
                </div>
              )}
              {point.tip && (
                <div className="col-span-2 rounded-[1.5cqh] px-[2cqh] py-[1cqh]" style={{ background: th.chip }}>
                  ✨ {point.tip}
                </div>
              )}
            </div>
          ) : view === 'pitfalls' ? (
            <ul className="mt-[2cqh] flex min-h-0 flex-1 flex-col gap-[2cqh] overflow-y-auto" style={{ fontSize: '3.8cqh' }}>
              {pitfalls.map((pf, i) => (
                <li key={i} className="space-y-[0.4cqh]">
                  <div style={{ color: wrongColor }}>
                    ✗ <span className="line-through decoration-[0.3cqh]">{pf.wrong}</span>
                  </div>
                  <button type="button" onClick={() => speak(plainText(pf.right))} className="text-left">
                    ✓ <Marked text={pf.right} />
                  </button>
                  <div style={{ fontSize: '0.65em', color: th.muted, fontFamily: BOARD_FONTS.sans }}>{pf.why}</div>
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
                <button
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
                </button>
              </li>
            ))}
          </ul>
          )}
        </div>
        {interactive && (
          <div className="absolute bottom-[2.5cqh] right-[3cqh] flex items-center gap-[1cqh]" style={{ fontSize: '2.4cqh' }}>
            {hasExplain && (
              <BoardButton
                icon={view === 'explain' ? 'format_list_numbered' : 'menu_book'}
                label={view === 'explain' ? t('grammar.backToExamples') : t('grammar.explainView')}
                onClick={() => setView((v) => (v === 'explain' ? 'examples' : 'explain'))}
              />
            )}
            {pitfalls.length > 0 && view !== 'explain' && (
              <BoardButton
                icon={view === 'pitfalls' ? 'format_list_numbered' : 'error'}
                label={view === 'pitfalls' ? t('grammar.backToExamples') : t('grammar.pitfalls')}
                onClick={() => setView((v) => (v === 'pitfalls' ? 'examples' : 'pitfalls'))}
              />
            )}
            {view === 'examples' && translations.length > 0 && (
              <BoardButton icon="translate" label={showKo ? t('grammar.hideKo') : t('grammar.showKo')} onClick={() => setShowKo((v) => !v)} />
            )}
            {view === 'examples' && (
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

function BoardButton({ icon, label, onClick, disabled }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-[0.6cqh] rounded-full bg-white/90 px-[1.8cqh] py-[0.9cqh] font-bold text-[#1f2937] shadow-md transition-opacity hover:bg-white disabled:opacity-40"
      style={{ fontFamily: BOARD_FONTS.sans }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '1.2em' }}>
        {icon}
      </span>
      {label}
    </button>
  );
}
