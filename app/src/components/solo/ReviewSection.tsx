import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildReviewLesson, pickReviewWords, type PoolWord, type ReviewMode } from '../../lib/soloReview';
import { soloReviewPool, soloStartReview, SoloError } from '../../lib/soloApi';

/**
 * 학생 홈의 "복습" — 표준 50분 흐름의 1단계(어제 수업 복습)와 2단계(누적 테스트)를 학생이 자기 자리에서 한다.
 * 버튼을 누르면 내가 만난 낱말 기록으로 복습 수업을 만들어 바로 시작한다(선생님 목록에는 안 보이고, 결과만 복습 현황에 보인다).
 */
export async function startReview(token: string, mode: ReviewMode, name: string, assignment?: string): Promise<{ id: string } | { empty: true }> {
  const pool = await soloReviewPool(token, assignment);
  const picked = pickReviewWords(pool, mode);
  const lesson = buildReviewLesson(mode, pool, picked, name);
  if (!lesson) return { empty: true };
  const id = await soloStartReview(token, lesson.name, lesson.minutes, lesson.steps);
  return { id };
}

export default function ReviewSection({ token }: { token: string }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<ReviewMode | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function go(mode: Extract<ReviewMode, 'daily' | 'cumulative'>) {
    if (busy) return;
    setBusy(mode);
    setMessage(null);
    try {
      const r = await startReview(token, mode, t(`studentPortal.review_${mode}`));
      if ('empty' in r) {
        setMessage(t('studentPortal.reviewEmpty'));
        return;
      }
      window.location.assign(`/s/lesson/${r.id}`);
    } catch (e) {
      setMessage(e instanceof SoloError && e.kind === 'network' ? t('studentPortal.err_network') : t('studentPortal.reviewError'));
    } finally {
      setBusy(null);
    }
  }

  const card = 'flex min-h-16 flex-1 items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left text-deep-navy disabled:opacity-60';
  return (
    <section className="mx-auto w-full max-w-xl rounded-3xl bg-white/10 p-5">
      <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
        <span className="material-symbols-outlined text-[24px] text-warm-yellow">history_edu</span>
        {t('studentPortal.reviewTitle')}
      </h2>
      <p className="mb-3 text-sm text-white/70">{t('studentPortal.reviewHint')}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        {(['daily', 'cumulative'] as const).map((m) => (
          <button key={m} type="button" disabled={busy !== null} onClick={() => void go(m)} className={card}>
            <span className="material-symbols-outlined text-[28px]">{m === 'daily' ? 'replay' : 'quiz'}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold">{t(`studentPortal.review_${m}`)}</span>
              <span className="block text-sm opacity-70">{busy === m ? t('common.loading') : t(`studentPortal.reviewDesc_${m}`)}</span>
            </span>
          </button>
        ))}
      </div>
      {message && (
        <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-base text-warm-yellow" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

/** 끝 화면에서 쓰는 보조: 이 수업에서 틀린 낱말이 있는지 */
export function missedOf(pool: PoolWord[]): PoolWord[] {
  return pool.filter((w) => w.missed_here && w.meaning);
}
