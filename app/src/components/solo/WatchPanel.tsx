import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import {
  assignSoloLesson,
  checkSoloReviews,
  clearSoloHelp,
  createSoloLesson,
  fetchSoloAttention,
  fetchSoloLive,
  fetchSoloReviews,
  fetchStudentWords,
  type SoloAttentionRow,
  type SoloLiveRow,
  type SoloReviewRow,
} from '../../lib/soloApi';
import { buildSoloWordSteps } from '../../lib/soloLessons';
import type { FullCardItem } from '../../lib/types';

/**
 * 선생님 자리의 현황판(2026-10-11) — 학생은 자기 자리에서 개별수업·복습을 하고, 선생님은 여기서
 *  ① 지금 도움이 필요한 학생(도와주세요·모르겠어요가 많음·자주 틀림)을 먼저 보고 도와주고,
 *  ② 학생들이 한 복습·누적 테스트 결과를 확인하고(틀린 낱말 보기),
 *  ③ 약한 낱말로 숙제를 바로 처방한다(그 학생에게만 낸다).
 */
export default function WatchPanel({ academyId, classId }: { academyId: string; classId: string | null }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [attention, setAttention] = useState<SoloAttentionRow[]>([]);
  const [reviews, setReviews] = useState<SoloReviewRow[]>([]);
  // 지금 개별수업을 하고 있는 학생(071) — 함수가 없으면 이 구역만 숨긴다
  const [live, setLive] = useState<SoloLiveRow[]>([]);
  const [liveUnavailable, setLiveUnavailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** 057 을 아직 안 돌렸으면 서버 함수가 없다 — 패널을 조용히 숨긴다 */
  const [unavailable, setUnavailable] = useState(false);

  const loadAttention = useCallback(async () => {
    try {
      setAttention(await fetchSoloAttention());
    } catch {
      setUnavailable(true);
    }
  }, []);
  const loadLive = useCallback(async () => {
    try {
      setLive(await fetchSoloLive(classId));
    } catch {
      setLiveUnavailable(true);
    }
  }, [classId]);
  const loadReviews = useCallback(async () => {
    try {
      setReviews(await fetchSoloReviews(7));
    } catch {
      setUnavailable(true);
    }
  }, []);

  useEffect(() => {
    void loadAttention();
    void loadReviews();
    void loadLive();
    const a = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadAttention();
        void loadLive();
      }
    }, 10000);
    const r = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadReviews();
    }, 60000);
    return () => {
      window.clearInterval(a);
      window.clearInterval(r);
    };
  }, [loadAttention, loadReviews, loadLive]);

  if (unavailable) return null;

  async function helped(row: SoloAttentionRow) {
    setBusyId(row.assignment_id);
    try {
      await clearSoloHelp(row.assignment_id);
      await loadAttention();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function checkAll(rows: SoloReviewRow[]) {
    const ids = rows.filter((r) => !r.checked_at && r.finished_at).map((r) => r.assignment_id);
    if (ids.length === 0) return;
    try {
      await checkSoloReviews(ids);
      await loadReviews();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  /** 처방: 이 학생의 약한 낱말(틀린 낱말 먼저)로 숙제 수업을 만들어 그 학생에게만 낸다 */
  async function prescribe(row: SoloReviewRow) {
    if (busyId) return;
    setBusyId(row.assignment_id);
    try {
      const stats = await fetchStudentWords(row.student_id);
      const missed = new Set(row.missed_words.map((w) => w.toLowerCase()));
      const weak = stats.filter((w) => w.wrong + w.unsure > 0 && w.meaning).sort((a, b) => b.wrong + b.unsure - (a.wrong + a.unsure));
      const ordered = [...weak.filter((w) => missed.has(w.word)), ...weak.filter((w) => !missed.has(w.word))].slice(0, 8);
      const words: FullCardItem[] = ordered.map((w, i) => ({
        id: `p${i}`,
        word: w.word,
        meaning: w.meaning,
        imageUrl: w.image_url,
        example: w.example,
        partOfSpeech: w.pos,
      }));
      if (words.length < 4) {
        notify(t('solo.watch_prescribeTooFew'), 'error');
        return;
      }
      const name = t('solo.watch_prescribeName', { name: row.name });
      const steps = buildSoloWordSteps(name, words, stats.filter((s) => s.meaning).map((s, i) => ({ id: `s${i}`, word: s.word, meaning: s.meaning, imageUrl: s.image_url, example: s.example, partOfSpeech: s.pos })));
      const lesson = await createSoloLesson({ academyId, classId, name, level: null, minutes: Math.max(5, Math.round(steps.length * 0.4)), steps, source: 'prescription' });
      const due = new Date();
      due.setDate(due.getDate() + 3);
      await assignSoloLesson(lesson.id, [row.student_id], due.toISOString(), 'homework');
      notify(t('solo.watch_prescribed', { name: row.name, count: words.length }));
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusyId(null);
    }
  }

  const reasonStyle: Record<SoloAttentionRow['reason'], string> = {
    help: 'bg-error text-on-error',
    unsure: 'bg-warm-yellow text-deep-navy',
    struggling: 'bg-surface-container-high text-on-surface',
  };
  const unchecked = reviews.filter((r) => r.finished_at && !r.checked_at);
  const ago = (iso: string) => {
    const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (sec < 45) return t('solo.watch_justNow');
    return t('solo.watch_minAgo', { n: Math.max(1, Math.round(sec / 60)) });
  };
  const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <section className="space-y-3 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[22px] text-primary">support_agent</span>
        <h3 className="font-label-md text-label-md font-bold text-deep-navy">{t('solo.watch_title')}</h3>
        <span className="font-caption text-caption text-on-surface-variant">{t('solo.watch_live')}</span>
      </div>

      {!liveUnavailable && (
        <div className="space-y-1.5">
          <div className="font-caption text-caption font-bold text-on-surface-variant">{t('solo.watch_liveTitle', { count: live.length })}</div>
          {live.length === 0 ? (
            <p className="rounded-lg bg-surface-container-low px-3 py-2 font-caption text-caption text-on-surface-variant">{t('solo.watch_liveNone')}</p>
          ) : (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {live.map((r) => {
                const pct = r.total > 0 ? Math.round((Math.min(r.progress, r.total) / r.total) * 100) : 0;
                return (
                  <li key={r.assignment_id} className="space-y-1 rounded-lg border border-outline-variant/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-primary">person</span>
                      <span className="font-label-md text-label-md font-bold text-on-surface">{r.name}</span>
                      {r.help && <span className="rounded-full bg-error px-2 py-0.5 font-caption text-caption font-bold text-on-error">{t('solo.watch_reason_help')}</span>}
                      <span className="ml-auto font-caption text-caption text-on-surface-variant">{ago(r.last_at)}</span>
                    </div>
                    <div className="truncate font-caption text-caption text-on-surface">
                      {r.lesson_name}
                      {r.kind !== 'lesson' && ` (${t(`solo.watch_kind_${r.kind}`)})`}
                    </div>
                    <div className="truncate font-caption text-caption text-on-surface-variant">
                      {[r.stage_title, r.step_type ? t(`soloEdit.stepType_${r.step_type}`, { defaultValue: '' }) : ''].filter(Boolean).join(' · ') || t('solo.watch_starting')}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-caption text-caption tabular-nums text-on-surface-variant">
                        {Math.min(r.progress + 1, r.total)}/{r.total}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {attention.length === 0 ? (
        <p className="rounded-lg bg-surface-container-low px-3 py-2 font-caption text-caption text-on-surface-variant">{t('solo.watch_none')}</p>
      ) : (
        <ul className="space-y-1.5">
          {attention.map((a) => (
            <li key={a.assignment_id} className="flex flex-wrap items-center gap-2 rounded-lg border border-outline-variant/50 px-3 py-2">
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-caption text-caption font-bold ${reasonStyle[a.reason]}`}>{t(`solo.watch_reason_${a.reason}`)}</span>
              <span className="font-label-md text-label-md font-bold text-on-surface">{a.name}</span>
              <span className="min-w-0 flex-1 truncate font-caption text-caption text-on-surface-variant">
                {a.lesson_name} · {a.progress}/{a.total}
                {a.reason !== 'help' && ` · ${t('solo.watch_recent', { wrong: a.wrong_recent, unsure: a.unsure_recent })}`}
              </span>
              {a.reason === 'help' && (
                <button
                  type="button"
                  disabled={busyId === a.assignment_id}
                  onClick={() => void helped(a)}
                  className="shrink-0 rounded-full border border-primary px-3 py-1 font-label-md text-label-md text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  {t('solo.watch_helped')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-left font-label-md text-label-md text-on-surface">
        <span className="material-symbols-outlined text-[20px] text-primary">{open ? 'expand_less' : 'expand_more'}</span>
        {t('solo.watch_reviews')}
        <span className="font-caption text-caption text-on-surface-variant">{t('solo.watch_reviewsCount', { total: reviews.length, todo: unchecked.length })}</span>
      </button>

      {open && (
        <div className="space-y-2">
          {reviews.length === 0 ? (
            <p className="px-1 font-caption text-caption text-on-surface-variant">{t('solo.watch_reviewsEmpty')}</p>
          ) : (
            <>
              {unchecked.length > 0 && (
                <button type="button" onClick={() => void checkAll(reviews)} className="rounded-full border border-primary px-4 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10">
                  {t('solo.watch_checkAll', { count: unchecked.length })}
                </button>
              )}
              <ul className="space-y-1.5">
                {reviews.map((r) => (
                  <li key={r.assignment_id} className="space-y-1.5 rounded-lg border border-outline-variant/50 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-label-md text-label-md font-bold text-on-surface">{r.name}</span>
                      <span className="font-caption text-caption text-on-surface-variant">
                        {r.lesson_name} · {when(r.assigned_at)}
                      </span>
                      <span className="ml-auto font-caption text-caption text-on-surface">
                        {r.finished_at
                          ? t('solo.watch_score', { right: r.right_count, wrong: r.wrong_count, unsure: r.unsure_count })
                          : t('solo.watch_inProgress', { progress: r.progress, total: r.total })}
                      </span>
                      {r.checked_at ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-caption text-caption text-primary">{t('solo.watch_checked')}</span>
                      ) : r.finished_at ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await checkSoloReviews([r.assignment_id]);
                            await loadReviews();
                          }}
                          className="rounded-full border border-outline-variant px-3 py-0.5 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary"
                        >
                          {t('solo.watch_check')}
                        </button>
                      ) : null}
                    </div>
                    {r.missed_words.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-caption text-caption text-on-surface-variant">{t('solo.watch_missed')}</span>
                        {r.missed_words.map((w) => (
                          <span key={w} className="rounded-full bg-error-container px-2 py-0.5 font-caption text-caption text-on-error-container">
                            {w}
                          </span>
                        ))}
                        <button
                          type="button"
                          disabled={busyId === r.assignment_id}
                          onClick={() => void prescribe(r)}
                          className="ml-auto rounded-full bg-primary px-3 py-1 font-label-md text-label-md text-on-primary hover:bg-primary-container disabled:opacity-50"
                        >
                          {busyId === r.assignment_id ? t('common.loading') : t('solo.watch_prescribe')}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
