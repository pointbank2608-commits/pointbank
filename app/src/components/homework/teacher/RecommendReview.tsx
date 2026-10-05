import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../context/ToastContext';
import { fetchWordLists } from '../../../lib/api';
import { wordListToCards } from '../../../lib/gameFromWords';
import { createHomework, fetchReviewCandidates, teacherErrorKey } from '../../../lib/homework';
import { countQuestions, estimateMinutes } from '../../../lib/homework/build';
import { recommendForStudent, type Recommendation } from '../../../lib/homework/recommend';
import type { FullCardItem } from '../../../lib/types';
import { enrichCards, loadWordBank } from '../../../lib/wordBankCache';
import HomeworkPreview from './HomeworkPreview';
import { fetchClassWrongCards, useBuildLabels } from '../../../lib/homework/teacherHelpers';
import { ItemSummary } from './HomeworkWizard';

interface Row {
  studentId: string;
  name: string;
  rec: Recommendation | null;
  error?: string;
  include: boolean;
  /** 빼 둔 활동 번호 */
  dropped: Set<number>;
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));

/**
 * 맞춤 숙제 추천 확인(규칙 기반, 2026-10-05) — 학생마다 추천을 만들어 이유와 함께 보여 주고, 선생님이 학생·활동을 빼거나
 * 다시 만들고, 학생을 바꿔 가며 학생 화면을 미리 본 뒤 "확인하고 보내기"를 눌러야만 숙제가 생긴다(자동 발송 없음).
 * 보낸 숙제는 학생마다 하나씩(kind custom, 같은 group_id) — 개인 QR·링크로만 들어간다.
 */
export default function RecommendReview({
  academyId,
  classId,
  students,
  onClose,
  onSent,
}: {
  academyId: string;
  classId: string;
  students: { id: string; name: string }[];
  onClose: () => void;
  onSent: (groupId: string) => void;
}) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const labels = useBuildLabels();
  const [rows, setRows] = useState<Row[]>(() => students.map((s) => ({ studentId: s.id, name: s.name, rec: null, include: true, dropped: new Set() })));
  const [current, setCurrent] = useState(students[0]?.id ?? '');
  const [pool, setPool] = useState<FullCardItem[] | null>(null);
  const [common, setCommon] = useState<FullCardItem[]>([]);
  const [due, setDue] = useState('');
  const [sending, setSending] = useState(false);

  // 재료: 반의 가장 최근 단어장 + 반이 많이 틀린 낱말
  useEffect(() => {
    void (async () => {
      const [wls, wrong, bank] = await Promise.all([fetchWordLists(academyId, classId).catch(() => []), fetchClassWrongCards(classId).catch(() => []), loadWordBank().catch(() => [])]);
      const latest = [...wls].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
      setPool(enrichCards(wordListToCards(latest), bank));
      setCommon(wrong);
    })();
  }, [academyId, classId]);

  const make = async (studentId: string) => {
    if (!pool) return;
    try {
      const cand = await fetchReviewCandidates(studentId);
      const rec = recommendForStudent(cand, pool, common, labels);
      setRows((rs) => rs.map((r) => (r.studentId === studentId ? { ...r, rec, error: undefined, dropped: new Set() } : r)));
    } catch (e) {
      setRows((rs) => rs.map((r) => (r.studentId === studentId ? { ...r, error: t(teacherErrorKey(e)) } : r)));
    }
  };

  useEffect(() => {
    if (!pool) return;
    students.forEach((s) => void make(s.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  const row = rows.find((r) => r.studentId === current) ?? rows[0];
  const itemsOf = (r: Row) => (r.rec?.items ?? []).filter((_, i) => !r.dropped.has(i));
  const ready = rows.filter((r) => r.include && r.rec && itemsOf(r).length > 0);
  const currentItems = useMemo(() => (row ? itemsOf(row) : []), [row]);

  async function send() {
    setSending(true);
    const groupId = newId();
    let ok = 0;
    try {
      for (const r of ready) {
        await createHomework({
          classId,
          title: t('studentHw.recTitle', { name: r.name }),
          items: itemsOf(r),
          studentIds: [r.studentId],
          dueAt: due ? new Date(due).toISOString() : null,
          kind: 'custom',
          groupId,
          recommendation: { rule_version: r.rec!.ruleVersion, personal: r.rec!.personal, reasons: r.rec!.reasons, dropped_items: [...r.dropped] },
        });
        ok += 1;
      }
      notify(t('studentHw.recSent', { count: ok }));
      onSent(groupId);
    } catch (e) {
      notify(t(teacherErrorKey(e)), 'error');
      if (ok > 0) onSent(groupId);
    } finally {
      setSending(false);
    }
  }

  const btn = 'flex min-h-11 items-center gap-1.5 rounded-full px-4 font-label-md text-label-md disabled:opacity-40';
  return (
    <section aria-labelledby="hw-rec-title" className="space-y-4 rounded-2xl border-2 border-primary/30 bg-surface-container-lowest p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="hw-rec-title" className="font-title-md text-title-md text-deep-navy">{t('studentHw.recTitleDialog')}</h2>
            <p className="max-w-2xl text-base text-on-surface-variant">{t('studentHw.recIntro')}</p>
          </div>
          <button type="button" onClick={onClose} className="flex min-h-11 items-center gap-1 rounded-full px-3 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
            {t('common.cancel')}
          </button>
        </div>

        {/* 학생 바꿔 보기 */}
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t('studentHw.recStudents')}>
          {rows.map((r) => (
            <button
              key={r.studentId}
              type="button"
              role="tab"
              aria-selected={r.studentId === row?.studentId}
              onClick={() => setCurrent(r.studentId)}
              className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-base ${
                r.studentId === row?.studentId ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface'
              } ${r.include ? '' : 'opacity-50 line-through'}`}
            >
              {r.name}
              {!r.rec && !r.error && <span className="text-xs">…</span>}
            </button>
          ))}
        </div>

        {row && (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-3">
              {!row.rec && !row.error && <p className="text-base text-on-surface-variant">{t('common.loading')}</p>}
              {row.error && <p className="text-base text-error">{row.error}</p>}
              {row.rec && (
                <>
                  <div className={`rounded-xl px-4 py-3 text-base ${row.rec.personal ? 'bg-primary/10 text-deep-navy' : 'bg-surface-container-low text-on-surface'}`}>
                    {row.rec.personal ? t('studentHw.recPersonal') : t('studentHw.recNotEnough')}
                  </div>
                  <div className="space-y-1">
                    <div className="font-label-md text-label-md text-on-surface">{t('studentHw.recWhy')}</div>
                    <ul className="list-disc space-y-0.5 pl-5 text-base text-on-surface">
                      {row.rec.reasons.slice(0, 8).map((r, i) => (
                        <li key={i}>{t(`studentHw.reason_${r.kind}`, { word: r.word, count: r.count ?? 0, days: r.days ?? 0 })}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-1.5">
                    <div className="font-label-md text-label-md text-on-surface">{t('studentHw.recItems')}</div>
                    {row.rec.items.map((it, i) => {
                      const dropped = row.dropped.has(i);
                      return (
                        <label key={i} className={`flex min-h-12 items-center gap-3 rounded-xl border border-outline-variant/60 px-3 text-base ${dropped ? 'opacity-50' : ''}`}>
                          <input
                            type="checkbox"
                            className="h-5 w-5"
                            checked={!dropped}
                            onChange={() =>
                              setRows((rs) =>
                                rs.map((r) => {
                                  if (r.studentId !== row.studentId) return r;
                                  const d = new Set(r.dropped);
                                  if (dropped) d.delete(i);
                                  else d.add(i);
                                  return { ...r, dropped: d };
                                }),
                              )
                            }
                          />
                          <span className="flex-1">{it.title}</span>
                          <span className="text-on-surface-variant">{t('studentHw.questionCount', { count: it.content.questions.length })}</span>
                        </label>
                      );
                    })}
                  </div>
                  <ItemSummary items={currentItems} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void make(row.studentId)} className={`${btn} border border-outline-variant text-on-surface`}>
                      <span className="material-symbols-outlined text-[18px]">shuffle</span>
                      {t('studentHw.recRemake')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRows((rs) => rs.map((r) => (r.studentId === row.studentId ? { ...r, include: !r.include } : r)))}
                      className={`${btn} border border-outline-variant text-on-surface`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{row.include ? 'person_remove' : 'person_add'}</span>
                      {row.include ? t('studentHw.recExclude') : t('studentHw.recInclude')}
                    </button>
                  </div>
                </>
              )}
            </div>
            {row.rec && currentItems.length > 0 && <HomeworkPreview key={row.studentId + countQuestions(currentItems)} title={t('studentHw.recTitle', { name: row.name })} items={currentItems} studentName={row.name} />}
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-outline-variant/40 pt-4">
          <label className="space-y-1">
            <span className="font-label-md text-label-md text-on-surface-variant">{t('studentHw.dueLabel')}</span>
            <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="min-h-12 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-base" />
          </label>
          <div className="flex flex-col items-end gap-1">
            <span className="text-sm text-on-surface-variant">
              {t('studentHw.recSummary', { count: ready.length, minutes: Math.max(0, ...ready.map((r) => estimateMinutes(itemsOf(r)))) })}
            </span>
            <button type="button" disabled={sending || ready.length === 0} onClick={() => void send()} className={`${btn} min-h-12 bg-primary px-8 text-on-primary`}>
              <span className="material-symbols-outlined">send</span>
              {sending ? t('common.loading') : t('studentHw.recSend', { count: ready.length })}
            </button>
          </div>
        </div>
    </section>
  );
}
