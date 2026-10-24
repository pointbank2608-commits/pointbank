import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from '../components/AccessibleDialog';
import BoardGameDialog from '../components/board/BoardGameDialog';
import BoardMaterialDialog from '../components/board/BoardMaterialDialog';
import BoardQuiz from '../components/board/BoardQuiz';
import BoardSentenceReader from '../components/board/BoardSentenceReader';
import FlashcardStudy, { type StudyCard } from '../components/FlashcardStudy';
import LessonAnnotationLayer from '../components/LessonAnnotationLayer';
import MaterialsLaunchButtons from '../components/MaterialsLaunchButtons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  BOARD_STROKES_KEY,
  BOARD_THEME_KEY,
  clearBoardReturn,
  loadBoardMaterial,
  markBoardReturn,
  saveBoardMaterial,
  type BoardMaterial,
} from '../lib/boardMaterial';

type Tool = 'flash' | 'read' | 'quiz' | 'game' | 'print';
type Theme = 'white' | 'green' | 'black' | 'grid';

const THEMES: Record<Theme, { cls: string; style?: React.CSSProperties; dark: boolean }> = {
  white: { cls: 'bg-white', dark: false },
  green: { cls: 'bg-[#1f4d3a]', dark: true },
  black: { cls: 'bg-[#15171c]', dark: true },
  grid: {
    cls: 'bg-white',
    dark: false,
    style: {
      backgroundImage: 'linear-gradient(#dbe4f0 1px, transparent 1px), linear-gradient(90deg, #dbe4f0 1px, transparent 1px)',
      backgroundSize: '40px 40px',
    },
  },
};

function readTheme(): Theme {
  try {
    const v = sessionStorage.getItem(BOARD_THEME_KEY);
    if (v === 'white' || v === 'green' || v === 'black' || v === 'grid') return v;
  } catch {
    /* 기본값 */
  }
  return 'green';
}

/**
 * 전자칠판(2026-10-24): 빈 칠판에 펜으로 쓰면서, 위쪽 단추로 오늘 자료의 플래시카드·예문 읽기·간단 퀴즈·게임·활동지 인쇄를 불러온다.
 * 즉흥 수업에서도 흐름이 끊기지 않게 — 도구를 끝내면 판서가 그대로인 칠판으로 돌아온다(판서는 이 탭에만 남는다).
 */
export default function WhiteboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { hasFullAccess } = useAuth();
  const root = useRef<HTMLDivElement>(null);
  const [material, setMaterial] = useState<BoardMaterial | null>(() => loadBoardMaterial());
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [tool, setTool] = useState<Tool | null>(null);
  const [pending, setPending] = useState<Tool | null>(null);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [full, setFull] = useState(false);
  // 처음 쓰기 시작하면(또는 이미 쓴 판서가 있으면) 안내 글을 걷는다
  const [wrote, setWrote] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(BOARD_STROKES_KEY) || '[]').length > 0;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    clearBoardReturn();
  }, []);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  const applyMaterial = useCallback(
    (m: BoardMaterial | null) => {
      setMaterial(m);
      saveBoardMaterial(m);
      if (m && pending) setTool(pending);
      setPending(null);
    },
    [pending],
  );

  function open(next: Tool) {
    if (!material) {
      setPending(next);
      setMaterialOpen(true);
      return;
    }
    setTool(next);
  }
  function chooseTheme(next: Theme) {
    setTheme(next);
    try {
      sessionStorage.setItem(BOARD_THEME_KEY, next);
    } catch {
      /* 무시 */
    }
  }
  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch {
      notify(t('whiteboard.fsFailed'), 'error');
    }
  }
  function exit() {
    clearBoardReturn();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    navigate('/dashboard');
  }

  const studyCards = useMemo<StudyCard[]>(
    () => (material?.cards ?? []).map((c) => ({ id: c.id, word: c.word, back: c.meaning, example: c.example ?? null, image_url: c.imageUrl })),
    [material],
  );
  const th = THEMES[theme];
  const label = material ? t(material.kind === 'sentence' ? 'whiteboard.materialSentences' : 'whiteboard.materialWords', { n: material.cards.length }) : t('whiteboard.materialNone');
  const topBtn = 'flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-[15px] font-bold text-white focus-visible:outline-4 focus-visible:outline-white hover:bg-white/15';
  const tools: { id: Tool; icon: string; label: string }[] = [
    { id: 'flash', icon: 'style', label: t('whiteboard.toolFlash') },
    { id: 'read', icon: 'menu_book', label: t('whiteboard.toolRead') },
    { id: 'quiz', icon: 'quiz', label: t('whiteboard.toolQuiz') },
    { id: 'game', icon: 'sports_esports', label: t('whiteboard.toolGame') },
    { id: 'print', icon: 'print', label: t('whiteboard.toolPrint') },
  ];

  return (
    <div ref={root} className={`fixed inset-0 z-50 select-none ${th.cls}`} style={th.style} data-whiteboard data-theme-name={theme} onPointerDownCapture={(e) => { if ((e.target as HTMLElement).tagName === 'CANVAS') setWrote(true); }}>
      <header className="no-print absolute inset-x-0 top-0 z-[45] flex h-14 items-center gap-1 bg-deep-navy px-2 text-white" aria-label={t('whiteboard.title')}>
        <button type="button" className={topBtn} onClick={exit} aria-label={t('whiteboard.exit')}>
          <span className="material-symbols-outlined text-[22px]" aria-hidden>
            arrow_back
          </span>
          <span className="hidden sm:inline">{t('whiteboard.exit')}</span>
        </button>
        <span className="mx-1 hidden font-extrabold xl:inline">{t('whiteboard.title')}</span>
        <button type="button" className={`${topBtn} bg-white/10`} onClick={() => setMaterialOpen(true)} data-board-material-open>
          <span className="material-symbols-outlined text-[22px]" aria-hidden>
            edit_note
          </span>
          <span className="max-w-[9rem] truncate">{label}</span>
        </button>
        <nav className="mx-1 flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto" aria-label={t('whiteboard.title')}>
          {tools.map((x) => (
            <button
              key={x.id}
              type="button"
              className={`${topBtn} disabled:opacity-40`}
              // 활동지 인쇄 화면(자료실)은 체험이 끝난 무료 플랜에서는 잠겨 있다
              disabled={x.id === 'print' && !hasFullAccess}
              onClick={() => open(x.id)}
              aria-label={x.label}
              title={x.id === 'print' && !hasFullAccess ? t('whiteboard.gameLocked') : x.label}
              data-board-tool={x.id}
            >
              <span className="material-symbols-outlined text-[22px]" aria-hidden>
                {x.icon}
              </span>
              <span className="hidden lg:inline">{x.label}</span>
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-0.5" role="group" aria-label={t('whiteboard.bg')}>
          {(['white', 'green', 'black', 'grid'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={theme === k}
              aria-label={t(`whiteboard.bg_${k}`)}
              title={t(`whiteboard.bg_${k}`)}
              onClick={() => chooseTheme(k)}
              className={`h-8 w-8 rounded-full border-2 ${theme === k ? 'border-white' : 'border-white/30'}`}
              style={{ background: k === 'white' ? '#fff' : k === 'green' ? '#1f4d3a' : k === 'black' ? '#15171c' : 'repeating-linear-gradient(0deg,#fff,#fff 5px,#cbd5e1 5px,#cbd5e1 6px)' }}
            />
          ))}
        </div>
        <button type="button" className={topBtn} onClick={() => void toggleFull()} aria-pressed={full}>
          <span className="material-symbols-outlined text-[22px]" aria-hidden>
            {full ? 'fullscreen_exit' : 'fullscreen'}
          </span>
          <span className="sr-only">{full ? t('whiteboard.exitFullscreen') : t('whiteboard.fullscreen')}</span>
        </button>
      </header>

      {!wrote && <p className={`pointer-events-none absolute inset-x-0 top-[40%] px-6 text-center text-xl font-bold ${th.dark ? 'text-white/35' : 'text-slate-400'}`}>{t('whiteboard.hint')}</p>}

      <LessonAnnotationLayer top={56} persistent persistKey={BOARD_STROKES_KEY} onClose={() => undefined} />

      {tool && (
        <div className="absolute inset-0 z-[60] bg-[#f7f9fd]" data-board-overlay={tool}>
          <button
            type="button"
            onClick={() => setTool(null)}
            className="absolute left-3 top-3 z-[70] min-h-12 rounded-xl bg-deep-navy px-5 text-base font-bold text-white shadow focus-visible:outline-4 focus-visible:outline-primary"
            data-board-back
          >
            ← {t('whiteboard.backToBoard')}
          </button>
          <div className="h-full pt-16">
            {tool === 'flash' && material && <FlashcardStudy title={t('whiteboard.toolFlash')} cards={studyCards} inline startShuffled />}
            {tool === 'read' && material && <BoardSentenceReader cards={material.cards} onClose={() => setTool(null)} />}
            {tool === 'quiz' && material && <BoardQuiz cards={material.cards} onClose={() => setTool(null)} />}
          </div>
          {tool === 'game' && material && <BoardGameDialog material={material} onClose={() => setTool(null)} />}
          {tool === 'print' && material && (
            <AccessibleDialog label={t('whiteboard.printTitle')} onClose={() => setTool(null)}>
              <div className="space-y-4 p-5 sm:p-7" data-board-print>
                <h2 className="text-2xl font-black text-deep-navy">{t('whiteboard.printTitle')}</h2>
                <p className="text-sm text-on-surface-variant">{t('whiteboard.printHelp')}</p>
                <div onClickCapture={markBoardReturn}>
                  <MaterialsLaunchButtons words={material.cards} />
                </div>
                <button type="button" className="min-h-11 rounded-xl border border-outline-variant bg-white px-4 py-2 font-bold text-deep-navy" onClick={() => setTool(null)}>
                  {t('whiteboard.close')}
                </button>
              </div>
            </AccessibleDialog>
          )}
        </div>
      )}

      {materialOpen && (
        <BoardMaterialDialog
          material={material}
          onApply={applyMaterial}
          onClose={() => {
            setMaterialOpen(false);
            setPending(null);
          }}
        />
      )}
    </div>
  );
}
