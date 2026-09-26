import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GAME_CATALOG } from '../lib/gameCatalog';
import { fetchSharedLesson, importSharedLesson, type LessonShareSnapshot } from '../lib/lessonShare';
import { useClasses } from '../lib/useClasses';
import type { LessonSlide } from '../lib/types';

export const PENDING_SHARE_KEY = 'classbank.pendingShare';

/** 슬라이드 종류 아이콘·이름(미리보기용) */
function slideInfo(s: LessonSlide, t: (k: string) => string): { icon: string; label: string } {
  switch (s.kind) {
    case 'game': {
      const g = GAME_CATALOG.find((x) => x.type === s.gameType);
      return { icon: g?.icon ?? 'sports_esports', label: g ? t(g.nameKey) : s.gameType };
    }
    case 'canvas':
      return { icon: 'dashboard_customize', label: t('curriculum.slides.kindCanvas') };
    case 'image':
      return { icon: 'image', label: t('curriculum.slides.kindImage') };
    case 'video':
      return { icon: 'smart_display', label: t('curriculum.slides.kindVideo') };
    case 'web':
      return { icon: 'language', label: t('curriculum.slides.kindWeb') };
    case 'grammar':
      return { icon: 'rule', label: t('curriculum.slides.kindGrammar') };
    case 'reading':
      return { icon: 'lyrics', label: t('curriculum.reading.defaultTitle') };
    case 'study':
      return { icon: 'style', label: t('curriculum.slides.kindStudy') };
    case 'wordshow':
      return { icon: 'menu_book', label: t('curriculum.slides.kindWordShow') };
    case 'attendance':
      return { icon: 'how_to_reg', label: t('curriculum.slides.kindAttendance') };
    default:
      return { icon: 'print', label: t('curriculum.slides.kindMaterial') };
  }
}

/**
 * 공유받은 수업(/share/:token, 2026-09-27) — 로그인 안 해도 미리 볼 수 있고, 선생님이면 반을 골라
 * "내 수업으로 가져오기". 로그인 전이면 링크를 기억해 두고 로그인 뒤 대시보드가 여기로 다시 보낸다.
 */
export default function SharedLessonPage() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { loading: authLoading, session, profile, isStaff, academy } = useAuth();
  const { classes, selectedId } = useClasses(isStaff ? academy?.id : null);
  const [data, setData] = useState<{ title: string; snapshot: LessonShareSnapshot; academy_name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classId, setClassId] = useState<string>('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchSharedLesson(token)
      .then((d) => (d ? setData(d) : setError(t('lessonShare.notFound'))))
      .catch(() => setError(t('lessonShare.notFound')));
  }, [token, t]);

  useEffect(() => {
    if (!classId && (selectedId || classes[0]?.id)) setClassId(selectedId ?? classes[0].id);
  }, [classId, selectedId, classes]);

  const slides = data?.snapshot.lesson.slides ?? [];
  const words = data?.snapshot.wordList?.items ?? [];
  const counts = useMemo(() => {
    const m = new Map<string, { icon: string; label: string; n: number }>();
    for (const s of slides) {
      const info = slideInfo(s, t);
      const cur = m.get(info.label) ?? { ...info, n: 0 };
      cur.n += 1;
      m.set(info.label, cur);
    }
    return [...m.values()];
  }, [slides, t]);

  async function doImport() {
    if (!data || !academy?.id || !profile || !classId) return;
    setImporting(true);
    setError(null);
    try {
      await importSharedLesson(data.snapshot, { academyId: academy.id, classId, teacherId: profile.id });
      try {
        localStorage.removeItem(PENDING_SHARE_KEY);
        // 수업 화면이 가져온 반을 열도록(useClasses 가 기억하는 반)
        localStorage.setItem('classbank.selectedClassId', classId);
      } catch {
        /* 무시 */
      }
      navigate('/curriculum', { state: { importedToast: data.title } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }

  function loginFirst() {
    try {
      localStorage.setItem(PENDING_SHARE_KEY, token);
    } catch {
      /* 무시 */
    }
    navigate('/login');
  }

  return (
    <div className="min-h-[100dvh] bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center gap-2 text-primary">
          <span className="material-symbols-outlined text-[28px]">share</span>
          <span className="font-label-md text-label-md">{t('lessonShare.receivedTitle')}</span>
        </div>
        {error && !data && <p className="rounded-xl bg-error-container p-4 text-on-error-container">{error}</p>}
        {!data && !error && <p className="text-on-surface-variant">{t('common.loading')}</p>}
        {data && (
          <div className="space-y-5 rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
            <div>
              <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-deep-navy">{data.title}</h1>
              <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
                {t('lessonShare.from', { academy: data.academy_name, count: slides.length })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {counts.map((c) => (
                <span key={c.label} className="flex items-center gap-1 rounded-full bg-surface-container-low px-3 py-1.5 font-label-md text-label-md text-on-surface">
                  <span className="material-symbols-outlined text-[18px] text-primary">{c.icon}</span>
                  {c.label}
                  {c.n > 1 && <span className="text-on-surface-variant">×{c.n}</span>}
                </span>
              ))}
            </div>
            {words.length > 0 && (
              <div>
                <div className="mb-1.5 font-label-md text-label-md text-on-surface-variant">
                  {t('lessonShare.wordsTitle', { name: data.snapshot.wordList?.name ?? '', count: words.length })}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {words.slice(0, 40).map((w) => (
                    <span key={w.id} className="rounded-full border border-outline-variant/60 px-2.5 py-0.5 font-caption text-caption text-on-surface">
                      {w.word}
                    </span>
                  ))}
                  {words.length > 40 && <span className="font-caption text-caption text-on-surface-variant">+{words.length - 40}</span>}
                </div>
              </div>
            )}

            <div className="border-t border-outline-variant/40 pt-4">
              {authLoading ? (
                <p className="text-on-surface-variant">{t('common.loading')}</p>
              ) : !session ? (
                <button type="button" onClick={loginFirst} className="w-full rounded-full bg-primary py-3 font-label-md text-label-md text-on-primary shadow-sm">
                  {t('lessonShare.loginToImport')}
                </button>
              ) : !isStaff ? (
                <p className="text-on-surface-variant">{t('lessonShare.staffOnly')}</p>
              ) : classes.length === 0 ? (
                <p className="text-on-surface-variant">{t('gameAdmin.noClasses')}</p>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="font-label-md text-label-md text-on-surface-variant">{t('lessonShare.pickClass')}</label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={importing || !classId}
                    onClick={() => void doImport()}
                    className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    {importing ? t('common.loading') : t('lessonShare.import')}
                  </button>
                </div>
              )}
              {error && data && <p className="mt-2 font-caption text-caption text-error">{error}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
