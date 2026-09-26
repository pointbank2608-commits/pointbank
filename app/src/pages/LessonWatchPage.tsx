import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import LessonSlideContent from '../components/LessonSlideContent';
import { GAME_CATALOG } from '../lib/gameCatalog';
import { lessonViewChannel, lessonViewGet, lessonViewState, type LessonViewSnapshot } from '../lib/lessonView';
import { MATERIALS_CATALOG } from '../lib/materialsCatalog';
import { PresentSyncContext, type PresentSyncApi } from '../lib/presentSync';
import { supabase } from '../lib/supabase';

/**
 * 학생 따라보기(/watch, /watch/:code, 2026-09-27) — 온라인(줌) 수업에서 학생이 링크를 열면 선생님이 넘기는
 * 슬라이드가 학생 화면에도 그대로 나온다. 로그인 없음. 문법 예문 몇 개·노래 몇 번째 줄·카드 몇 번째 같은
 * 단계도 선생님을 따라간다(lib/presentSync). 게임·워크시트는 선생님 화면 공유로 보도록 안내 카드만,
 * 대회 퀴즈쇼면 참가 버튼.
 */
export default function LessonWatchPage() {
  const { t } = useTranslation();
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const [codeInput, setCodeInput] = useState(codeParam ?? '');
  const code = codeParam ?? '';
  const [title, setTitle] = useState('');
  const [snapshot, setSnapshot] = useState<LessonViewSnapshot | null>(null);
  const [slideId, setSlideId] = useState<string | null>(null);
  const [sub, setSub] = useState<Record<string, unknown> | null>(null);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((s: { slide_id?: string | null; sub?: Record<string, unknown> | null; ended?: boolean }) => {
    if (s.ended) {
      setEnded(true);
      return;
    }
    if ('slide_id' in s) setSlideId(s.slide_id ?? null);
    if ('sub' in s) setSub(s.sub ?? null);
  }, []);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    setError(null);
    lessonViewGet(code)
      .then((v) => {
        if (!alive) return;
        if (!v) {
          setError(t('lessonWatch.notFound'));
          return;
        }
        setTitle(v.title);
        setSnapshot(v.snapshot);
        setEnded(v.ended);
        setSlideId(v.slide_id);
        setSub(v.sub);
      })
      .catch(() => alive && setError(t('lessonWatch.notFound')));
    const ch = supabase
      .channel(lessonViewChannel(code))
      .on('broadcast', { event: 'state' }, ({ payload }) => apply(payload as Record<string, unknown>))
      .subscribe();
    // 방송을 놓쳐도 3초 안에 따라잡는다
    const poll = window.setInterval(() => {
      void lessonViewState(code).then((s) => s && alive && apply(s));
    }, 3000);
    return () => {
      alive = false;
      window.clearInterval(poll);
      void supabase.removeChannel(ch);
    };
  }, [code, apply, t]);

  const slide = useMemo(() => snapshot?.slides.find((s) => s.id === slideId) ?? null, [snapshot, slideId]);
  const syncApi = useMemo<PresentSyncApi>(() => ({ role: 'student', remote: sub, report: () => {} }), [sub]);

  const shell = 'flex min-h-[100dvh] flex-col bg-[#16213e] text-white';

  if (!code) {
    const ok = codeInput.replace(/\D/g, '').length === 6;
    return (
      <div className={`${shell} items-center justify-center p-6`}>
        <form
          className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 text-deep-navy shadow-xl"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) navigate(`/watch/${codeInput.replace(/\D/g, '')}`);
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '32px' }}>
              cast_for_education
            </span>
            <h1 className="text-2xl font-bold">{t('lessonWatch.joinTitle')}</h1>
          </div>
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="123456"
            className="w-full rounded-xl border-2 border-outline-variant px-4 py-3 text-center text-3xl font-bold tracking-[0.3em] outline-none focus:border-primary"
          />
          <button type="submit" disabled={!ok} className="w-full rounded-full bg-primary py-3.5 text-lg font-bold text-on-primary disabled:opacity-40">
            {t('lessonWatch.joinButton')}
          </button>
        </form>
      </div>
    );
  }

  const header = (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
      <span className="material-symbols-outlined text-warm-yellow" style={{ fontSize: '22px' }}>
        cast_for_education
      </span>
      <span className="min-w-0 flex-1 truncate font-bold">{title || t('lessonWatch.joinTitle')}</span>
      <span className="hidden text-white/60 sm:inline">{t('lessonWatch.following')}</span>
    </div>
  );

  if (error || ended) {
    return (
      <div className={shell}>
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <span className="material-symbols-outlined text-warm-yellow" style={{ fontSize: '64px' }}>
            {ended ? 'flag' : 'error'}
          </span>
          <p className="text-xl font-bold">{ended ? t('lessonWatch.ended') : error}</p>
          <Link to="/watch" className="rounded-full bg-white/15 px-5 py-2.5 font-bold">
            {t('lessonWatch.otherCode')}
          </Link>
        </div>
      </div>
    );
  }

  let body: React.ReactNode;
  let onSlide = false;
  if (!snapshot) {
    body = <p className="text-white/70">{t('common.loading')}</p>;
  } else if (!slide || slide.kind === 'game' || slide.kind === 'material') {
    // 게임·워크시트·인쇄 화면: 선생님 화면 공유로 본다. 대회 퀴즈쇼면 휴대폰·컴퓨터로 참가.
    const game = slide?.kind === 'game' ? GAME_CATALOG.find((g) => g.type === slide.gameType) : null;
    const material = slide?.kind === 'material' ? MATERIALS_CATALOG.find((m) => m.id === slide.materialId) : null;
    body = (
      <div className="flex max-w-md flex-col items-center gap-4 rounded-3xl bg-white/10 p-8 text-center">
        <span className="material-symbols-outlined text-warm-yellow" style={{ fontSize: '64px' }}>
          {game?.icon ?? material?.icon ?? 'co_present'}
        </span>
        <div className="text-2xl font-bold">{game ? t(game.nameKey) : material ? t(material.nameKey) : t('lessonWatch.teacherScreen')}</div>
        <p className="text-white/75">{game?.type === 'quizshow' ? t('lessonWatch.quizshowHint') : t('lessonWatch.lookAtShare')}</p>
        {game?.type === 'quizshow' && (
          <Link to="/join" className="rounded-full bg-warm-yellow px-6 py-3 font-bold text-deep-navy">
            {t('lessonWatch.joinQuizshow')}
          </Link>
        )}
      </div>
    );
  } else {
    onSlide = true;
    body = (
      <PresentSyncContext.Provider value={syncApi}>
        <LessonSlideContent slide={slide} words={snapshot.words} fill lessonName={title} attendance={null} student />
      </PresentSyncContext.Provider>
    );
  }

  return (
    <div className={shell}>
      {header}
      <div
        className={`relative flex flex-1 items-center justify-center p-4 ${onSlide ? 'bg-background text-on-surface' : ''}`}
        style={{ minHeight: 'calc(100dvh - 48px)' }}
      >
        {body}
      </div>
    </div>
  );
}
