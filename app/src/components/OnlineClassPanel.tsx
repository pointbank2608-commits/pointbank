import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { useLessonRunner } from '../context/LessonRunnerContext';
import { lessonViewUrl } from '../lib/lessonView';

/**
 * 발표 진행바 "온라인 수업" 창(2026-09-27) — 줌(화상) 수업에서 쓰는 법 + 학생 따라보기 링크 켜기/끄기.
 * 따라보기를 켜면 학생이 링크(또는 /watch + 번호)로 들어와 선생님이 넘기는 슬라이드를 자기 화면에서 본다.
 */
export default function OnlineClassPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { runner, startView, stopView } = useLessonRunner();
  const view = runner?.view ?? null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!view) {
      setQr(null);
      return;
    }
    void QRCode.toDataURL(lessonViewUrl(view.code), { margin: 1, width: 320 }).then(setQr);
  }, [view]);

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      await startView();
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      setError(/lesson_view|function/i.test(msg) ? t('online.needSetup') : msg);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!view) return;
    try {
      await navigator.clipboard.writeText(lessonViewUrl(view.code));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 주소 칸에서 직접 복사 */
    }
  }

  return (
    <div className="no-print fixed inset-0 z-40 flex items-start justify-end p-4 pt-16" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl bg-surface-container-lowest p-5 text-on-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-primary">cast_for_education</span>
          <h2 className="font-title-md text-title-md text-deep-navy">{t('online.title')}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-full p-1 hover:bg-surface-container" aria-label={t('curriculum.play.keysClose')}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* 1) 학생 따라보기 */}
        <section className="space-y-2 rounded-xl border border-outline-variant/50 p-4">
          <div className="font-label-md text-label-md text-primary">{t('online.followTitle')}</div>
          {!view ? (
            <>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{t('online.followIntro')}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void turnOn()}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">link</span>
                {busy ? t('common.loading') : t('online.followOn')}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-4">
                {qr && <img src={qr} alt="QR" className="h-28 w-28 rounded-lg border border-outline-variant/40" />}
                <div className="min-w-0 flex-1">
                  <div className="font-caption text-caption text-on-surface-variant">{t('online.code')}</div>
                  <div className="text-3xl font-bold tracking-[0.15em] text-deep-navy">{view.code}</div>
                  <div className="truncate font-caption text-caption text-on-surface-variant">{lessonViewUrl(view.code)}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => void copy()} className="flex-1 rounded-full bg-secondary-container py-2 font-label-md text-label-md text-on-secondary-container">
                  {copied ? t('online.copied') : t('online.copyLink')}
                </button>
                <button type="button" onClick={() => void stopView()} className="rounded-full border border-error px-4 py-2 font-label-md text-label-md text-error hover:bg-error/10">
                  {t('online.followOff')}
                </button>
              </div>
              <p className="font-caption text-caption text-on-surface-variant">{t('online.followHint')}</p>
            </>
          )}
          {error && <p className="font-caption text-caption text-error">{error}</p>}
        </section>

        {/* 2) 줌 화면 공유 */}
        <section className="space-y-1.5">
          <div className="font-label-md text-label-md text-primary">{t('online.zoomTitle')}</div>
          <ol className="list-decimal space-y-1 pl-5 font-body-sm text-body-sm text-on-surface-variant">
            <li>{t('online.zoom1')}</li>
            <li>{t('online.zoom2')}</li>
            <li>{t('online.zoom3')}</li>
          </ol>
        </section>

        {/* 3) 퀴즈쇼 */}
        <section className="space-y-1">
          <div className="font-label-md text-label-md text-primary">{t('online.quizTitle')}</div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{t('online.quizHint')}</p>
        </section>
      </div>
    </div>
  );
}
