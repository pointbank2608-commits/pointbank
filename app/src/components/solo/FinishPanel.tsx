import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { soloReviewPool, SoloError } from '../../lib/soloApi';
import { studentHome, type PortalHome } from '../../lib/studentPortal';
import { startReview } from './ReviewSection';

/**
 * 개별수업 끝 화면의 아래쪽(표준 50분 흐름의 10단계) — 학생이 자기 자리에서:
 *  ① 이 수업에서 틀렸거나 모르겠다고 한 낱말을 "다시 배우기"로 바로 이어서 하고
 *  ② 낸 숙제와 기한, 아직 안 한 수업을 확인한다.
 * 선생님은 따로 안내하지 않아도 된다.
 */
export default function FinishPanel({ token, assignment, onStarted }: { token: string; assignment: string; onStarted: (assignmentId: string) => void }) {
  const { t } = useTranslation();
  const [missed, setMissed] = useState<number | null>(null);
  const [home, setHome] = useState<PortalHome | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    soloReviewPool(token, assignment)
      .then((p) => alive && setMissed(p.filter((w) => w.missed_here && w.meaning).length))
      .catch(() => alive && setMissed(0));
    studentHome(token)
      .then((h) => alive && setHome(h))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [token, assignment]);

  async function relearn() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await startReview(token, 'relearn', t('studentPortal.review_relearn'), assignment);
      if ('empty' in r) setMessage(t('studentPortal.reviewEmpty'));
      else onStarted(r.id);
    } catch (e) {
      setMessage(e instanceof SoloError && e.kind === 'network' ? t('studentPortal.err_network') : t('studentPortal.reviewError'));
    } finally {
      setBusy(false);
    }
  }

  const todo = (home?.lessons ?? []).filter((l) => !l.done && l.id !== assignment);
  const homework = (home?.homework ?? []).filter((h) => !h.done);
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

  return (
    <div className="w-full max-w-md space-y-3 text-left">
      {missed !== null && missed > 0 && (
        <div className="rounded-2xl bg-white/10 p-4">
          <p className="mb-2 text-lg font-bold">{t('solo.finishRelearnTitle', { count: missed })}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void relearn()}
            className="min-h-14 w-full rounded-2xl bg-warm-yellow px-5 text-xl font-bold text-deep-navy disabled:opacity-50"
          >
            {busy ? t('common.loading') : t('solo.finishRelearn')}
          </button>
          {message && <p className="mt-2 text-base text-warm-yellow">{message}</p>}
        </div>
      )}

      {(todo.length > 0 || homework.length > 0) && (
        <div className="rounded-2xl bg-white/10 p-4">
          <p className="mb-2 text-lg font-bold">{t('solo.finishHomeworkTitle')}</p>
          <ul className="space-y-1.5 text-base">
            {todo.map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-warm-yellow">{l.kind === 'homework' ? 'edit_note' : 'school'}</span>
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                {l.due_at && <span className="shrink-0 text-sm text-white/70">{t('studentHw.dueAt', { date: fmt(l.due_at) })}</span>}
              </li>
            ))}
            {homework.map((h) => (
              <li key={h.access} className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-warm-yellow">edit_note</span>
                <span className="min-w-0 flex-1 truncate">{h.title || t('studentHw.defaultTitle')}</span>
                {h.due_at && <span className="shrink-0 text-sm text-white/70">{t('studentHw.dueAt', { date: fmt(h.due_at) })}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-center text-base text-white/70">{t('solo.finishWorksheetNote')}</p>
    </div>
  );
}
