import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ClassChipRow from '../components/ClassChipRow';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchWordLists } from '../lib/api';
import { wordListToCards } from '../lib/gameFromWords';
import {
  buildHomeworkQuestions,
  closeHomework,
  createHomework,
  DEFAULT_HOMEWORK_ROUNDS,
  deleteHomework,
  fetchHomeworkAnswers,
  fetchHomeworkAttempts,
  fetchHomeworks,
  fetchStudentPins,
  homeworkUrl,
  randomPin,
  setStudentPin,
  type HomeworkAnswer,
  type HomeworkAssignment,
  type HomeworkAttempt,
  type HomeworkRoundSetting,
} from '../lib/homework';
import { contestRoundNames } from '../lib/liveQuiz';
import { useClasses } from '../lib/useClasses';
import { enrichCards, loadWordBank } from '../lib/wordBankCache';
import type { WordList } from '../lib/types';

/**
 * 숙제(2026-10-04, Classbank Student ②) — 선생님이 단어장으로 숙제를 내고(활동·문제 수·마감), 숙제 번호·링크·QR 을
 * 학생에게 준다. 학생별 진행(안 함·하는 중·완료)·점수·자주 틀린 낱말을 보고, 학생 PIN(4자리)을 관리한다.
 */
export default function HomeworkPage() {
  const { t } = useTranslation();
  const { academy } = useAuth();
  const { notify } = useToast();
  const { classes, selectedId, select, reorder } = useClasses(academy?.id);
  const classId = selectedId ?? classes[0]?.id ?? null;
  const [wordLists, setWordLists] = useState<WordList[]>([]);
  const [list, setList] = useState<HomeworkAssignment[] | null>(null);
  const [attempts, setAttempts] = useState<HomeworkAttempt[]>([]);
  const [students, setStudents] = useState<{ id: string; name: string; hw_pin: string | null }[]>([]);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!classId || !academy?.id) return;
    try {
      const [hw, wl, st] = await Promise.all([fetchHomeworks(classId), fetchWordLists(academy.id, classId), fetchStudentPins(classId)]);
      setList(hw);
      setWordLists(wl);
      setStudents(st);
      setAttempts(await fetchHomeworkAttempts(hw.map((h) => h.id)));
      setError(null);
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      setError(/homework|hw_pin|relation|column/i.test(msg) ? t('studentHw.needSetup') : msg);
      setList([]);
    }
  }, [classId, academy?.id, t]);

  useEffect(() => {
    setList(null);
    void reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-label-md text-label-md text-primary">Classbank Student</div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy md:font-headline-lg md:text-headline-lg">{t('studentHw.pageTitle')}</h1>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{t('studentHw.pageIntro')}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPinsOpen((o) => !o)} className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 font-label-md text-label-md text-on-surface hover:bg-surface-container-low">
            <span className="material-symbols-outlined text-[18px]">pin</span>
            {t('studentHw.pinsButton')}
          </button>
          <button type="button" onClick={() => setCreating(true)} disabled={!classId} className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-40">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t('studentHw.newButton')}
          </button>
        </div>
      </div>

      {classes.length > 0 && <ClassChipRow classes={classes} selectedId={classId} onSelect={select} onReorder={reorder} />}
      {error && <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">{error}</div>}

      {pinsOpen && <PinPanel students={students} onChanged={reload} />}

      {creating && classId && (
        <CreatePanel
          classId={classId}
          wordLists={wordLists}
          onCancel={() => setCreating(false)}
          onCreated={async (hw) => {
            setCreating(false);
            setShareId(hw.id);
            notify(t('studentHw.created'));
            await reload();
          }}
        />
      )}

      {list === null ? (
        <div className="text-on-surface-variant">{t('common.loading')}</div>
      ) : list.length === 0 && !creating ? (
        <div className="rounded-xl bg-surface-container-lowest p-8 text-center text-on-surface-variant shadow-sm">{t('studentHw.empty')}</div>
      ) : (
        <div className="space-y-3">
          {list.map((hw) => {
            const att = attempts.filter((a) => a.assignment_id === hw.id);
            const finished = att.filter((a) => a.finished_at);
            const avg = finished.length ? Math.round((finished.reduce((s, a) => s + a.score / Math.max(1, a.total), 0) / finished.length) * 100) : null;
            return (
              <div key={hw.id} className={`rounded-xl bg-surface-container-lowest shadow-sm ${hw.closed_at ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-title-md text-title-md text-deep-navy">{hw.title || t('studentHw.defaultTitle')}</span>
                      {hw.closed_at && <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">{t('studentHw.closed')}</span>}
                    </div>
                    <div className="font-caption text-caption text-on-surface-variant">
                      {t('studentHw.questionCount', { count: hw.questions.length })} · {t('studentHw.code')} <b className="tabular-nums">{hw.code}</b>
                      {hw.due_at && ` · ${t('studentHw.dueShort', { date: new Date(hw.due_at).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) })}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-center">
                    <div>
                      <div className="font-title-md text-title-md tabular-nums text-deep-navy">
                        {finished.length}/{students.length}
                      </div>
                      <div className="text-xs text-on-surface-variant">{t('studentHw.doneCount')}</div>
                    </div>
                    <div>
                      <div className="font-title-md text-title-md tabular-nums text-deep-navy">{avg === null ? '–' : `${avg}%`}</div>
                      <div className="text-xs text-on-surface-variant">{t('studentHw.avgScore')}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setShareId(shareId === hw.id ? null : hw.id)} className="flex items-center gap-1 rounded-full bg-secondary-container/60 px-3 py-1.5 text-sm text-on-surface hover:bg-secondary-container">
                      <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                      {t('studentHw.share')}
                    </button>
                    <button type="button" onClick={() => setOpenId(openId === hw.id ? null : hw.id)} className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm text-on-primary hover:bg-primary-container">
                      <span className="material-symbols-outlined text-[18px]">monitoring</span>
                      {t('studentHw.results')}
                    </button>
                  </div>
                </div>
                {shareId === hw.id && <SharePanel hw={hw} />}
                {openId === hw.id && (
                  <ResultsPanel
                    hw={hw}
                    attempts={att}
                    students={students}
                    onClose={async (closed) => {
                      await closeHomework(hw.id, closed);
                      await reload();
                    }}
                    onDelete={async () => {
                      if (!window.confirm(t('studentHw.deleteConfirm'))) return;
                      await deleteHomework(hw.id);
                      await reload();
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreatePanel({ classId, wordLists, onCancel, onCreated }: { classId: string; wordLists: WordList[]; onCancel: () => void; onCreated: (hw: HomeworkAssignment) => void }) {
  const { t } = useTranslation();
  const [wordListId, setWordListId] = useState(wordLists[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [rounds, setRounds] = useState<HomeworkRoundSetting[]>(DEFAULT_HOMEWORK_ROUNDS);
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const wl = wordLists.find((w) => w.id === wordListId) ?? null;
  const total = rounds.filter((r) => r.on).reduce((s, r) => s + r.count, 0);

  async function create() {
    if (!wl) return;
    setBusy(true);
    setErr(null);
    try {
      const cards = enrichCards(wordListToCards(wl), await loadWordBank());
      const questions = buildHomeworkQuestions(cards, contestRoundNames(t), rounds);
      if (questions.length === 0) {
        setErr(t('studentHw.noQuestions'));
        return;
      }
      const hw = await createHomework({
        classId,
        title: title.trim() || wl.name,
        questions,
        wordListId: wl.id,
        rounds,
        dueAt: due ? new Date(due).toISOString() : null,
      });
      onCreated(hw);
    } catch (e) {
      setErr(String((e as { message?: string })?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const input = 'w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary';
  return (
    <div className="space-y-4 rounded-xl border-2 border-primary/30 bg-surface-container-lowest p-4 shadow-sm">
      <div className="font-title-md text-title-md text-deep-navy">{t('studentHw.newTitle')}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="font-label-md text-label-md text-on-surface-variant">{t('studentHw.wordList')}</span>
          <select className={input} value={wordListId} onChange={(e) => setWordListId(e.target.value)}>
            {wordLists.length === 0 && <option value="">{t('studentHw.noWordLists')}</option>}
            {wordLists.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.items.length})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="font-label-md text-label-md text-on-surface-variant">{t('studentHw.titleLabel')}</span>
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={wl?.name ?? ''} />
        </label>
        <label className="space-y-1">
          <span className="font-label-md text-label-md text-on-surface-variant">{t('studentHw.dueLabel')}</span>
          <input className={input} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
      </div>
      <div className="space-y-2">
        <div className="font-label-md text-label-md text-on-surface-variant">{t('studentHw.activities')}</div>
        <div className="flex flex-wrap gap-2">
          {rounds.map((r, i) => (
            <div key={r.type} className={`flex items-center gap-1 rounded-full border px-1 py-1 ${r.on ? 'border-primary bg-primary/10' : 'border-outline-variant'}`}>
              <button type="button" onClick={() => setRounds((rs) => rs.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} className="flex items-center gap-1 rounded-full px-2 text-sm">
                <span className="material-symbols-outlined text-[18px]">{r.on ? 'check_box' : 'check_box_outline_blank'}</span>
                {t(`studentHw.round_${r.type}`)}
              </button>
              {r.on && (
                <span className="flex items-center gap-0.5">
                  <button type="button" className="h-6 w-6 rounded-full hover:bg-surface-container-high" onClick={() => setRounds((rs) => rs.map((x, j) => (j === i ? { ...x, count: Math.max(1, x.count - 1) } : x)))}>
                    −
                  </button>
                  <span className="w-5 text-center text-sm tabular-nums">{r.count}</span>
                  <button type="button" className="h-6 w-6 rounded-full hover:bg-surface-container-high" onClick={() => setRounds((rs) => rs.map((x, j) => (j === i ? { ...x, count: Math.min(20, x.count + 1) } : x)))}>
                    +
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="font-caption text-caption text-on-surface-variant">{t('studentHw.activitiesHint', { count: total })}</p>
      </div>
      {err && <div className="text-sm text-error">{err}</div>}
      <div className="flex gap-2">
        <button type="button" disabled={busy || !wl || total === 0} onClick={() => void create()} className="rounded-full bg-primary px-6 py-2 font-label-md text-label-md text-on-primary disabled:opacity-40">
          {busy ? t('common.loading') : t('studentHw.createButton')}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-outline-variant px-6 py-2 font-label-md text-label-md text-on-surface-variant">
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

function SharePanel({ hw }: { hw: HomeworkAssignment }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [qr, setQr] = useState<string | null>(null);
  const url = homeworkUrl(hw.code);
  useEffect(() => {
    void QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: 'M' }).then(setQr);
  }, [url]);
  const message = t('studentHw.shareMessage', { title: hw.title || t('studentHw.defaultTitle'), url, code: hw.code });
  return (
    <div className="flex flex-wrap items-center gap-6 border-t border-outline-variant/40 p-4">
      {qr && <img src={qr} alt="" className="h-40 w-40 rounded-lg bg-white p-1" />}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="font-caption text-caption text-on-surface-variant">{t('studentHw.code')}</div>
        <div className="font-headline-md text-headline-md tabular-nums tracking-widest text-deep-navy">{hw.code}</div>
        <div className="break-all font-body-md text-body-md text-primary">{url}</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(message).then(() => notify(t('studentHw.copied')));
            }}
            className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm text-on-primary"
          >
            <span className="material-symbols-outlined text-[18px]">content_copy</span>
            {t('studentHw.copyMessage')}
          </button>
        </div>
        <p className="font-caption text-caption text-on-surface-variant">{t('studentHw.shareHint')}</p>
      </div>
    </div>
  );
}

function ResultsPanel({
  hw,
  attempts,
  students,
  onClose,
  onDelete,
}: {
  hw: HomeworkAssignment;
  attempts: HomeworkAttempt[];
  students: { id: string; name: string }[];
  onClose: (closed: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<HomeworkAnswer[]>([]);
  useEffect(() => {
    void fetchHomeworkAnswers(attempts.map((a) => a.id)).then(setAnswers).catch(() => setAnswers([]));
  }, [attempts]);

  const wrongWords = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of answers) if (!a.correct && a.word) m.set(a.word, (m.get(a.word) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [answers]);

  return (
    <div className="space-y-4 border-t border-outline-variant/40 p-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-on-surface-variant">
              <th className="py-2 pr-3 font-label-md">{t('studentHw.colName')}</th>
              <th className="py-2 pr-3 font-label-md">{t('studentHw.colStatus')}</th>
              <th className="py-2 pr-3 font-label-md">{t('studentHw.colScore')}</th>
              <th className="py-2 pr-3 font-label-md">{t('studentHw.colTime')}</th>
              <th className="py-2 font-label-md">{t('studentHw.colWrong')}</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const a = attempts.find((x) => x.student_id === s.id);
              const mine = a ? answers.filter((x) => x.attempt_id === a.id) : [];
              const correct = mine.filter((x) => x.correct).length;
              const minutes = a ? Math.max(1, Math.round((new Date(a.finished_at ?? a.last_seen_at).getTime() - new Date(a.started_at).getTime()) / 60000)) : null;
              const status = !a ? 'none' : a.finished_at ? 'done' : 'doing';
              return (
                <tr key={s.id} className="border-t border-outline-variant/30">
                  <td className="py-2 pr-3 font-label-md text-on-surface">{s.name}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        status === 'done' ? 'bg-emerald-100 text-emerald-800' : status === 'doing' ? 'bg-amber-100 text-amber-800' : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {t(`studentHw.status_${status}`)}
                      {status === 'doing' && ` ${mine.length}/${hw.questions.length}`}
                    </span>
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{a ? `${correct} / ${hw.questions.length}` : '–'}</td>
                  <td className="py-2 pr-3 tabular-nums">{minutes === null ? '–' : t('studentHw.minutes', { n: minutes })}</td>
                  <td className="py-2 text-on-surface-variant">
                    {mine
                      .filter((x) => !x.correct)
                      .map((x) => x.word)
                      .filter(Boolean)
                      .slice(0, 6)
                      .join(', ')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {wrongWords.length > 0 && (
        <div className="space-y-1">
          <div className="font-label-md text-label-md text-on-surface">{t('studentHw.classWrongWords')}</div>
          <div className="flex flex-wrap gap-1.5">
            {wrongWords.map(([w, n]) => (
              <span key={w} className="rounded-full bg-error-container/60 px-2.5 py-1 text-sm text-on-error-container">
                {w} <b>×{n}</b>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void onClose(!hw.closed_at)} className="rounded-full border border-outline-variant px-4 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-low">
          {t(hw.closed_at ? 'studentHw.reopen' : 'studentHw.close')}
        </button>
        <button type="button" onClick={() => void onDelete()} className="rounded-full px-4 py-1.5 text-sm text-error hover:bg-error-container/40">
          {t('studentHw.delete')}
        </button>
      </div>
    </div>
  );
}

function PinPanel({ students, onChanged }: { students: { id: string; name: string; hw_pin: string | null }[]; onChanged: () => Promise<void> }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="space-y-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
      <div>
        <div className="font-title-md text-title-md text-deep-navy">{t('studentHw.pinsTitle')}</div>
        <p className="font-caption text-caption text-on-surface-variant">{t('studentHw.pinsHint')}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {students.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-outline-variant/50 px-3 py-2">
            <span className="truncate font-label-md text-label-md">{s.name}</span>
            <span className="flex items-center gap-1">
              <b className="tabular-nums tracking-widest text-deep-navy">{s.hw_pin ?? '----'}</b>
              <button
                type="button"
                disabled={busy === s.id}
                onClick={async () => {
                  setBusy(s.id);
                  try {
                    await setStudentPin(s.id, randomPin());
                    await onChanged();
                  } finally {
                    setBusy(null);
                  }
                }}
                title={t('studentHw.newPin')}
                aria-label={t('studentHw.newPin')}
                className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container-low"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
              </button>
            </span>
          </div>
        ))}
      </div>
      {students.length === 0 && <p className="text-sm text-on-surface-variant">{t('studentHw.noStudentsTeacher')}</p>}
    </div>
  );
}
