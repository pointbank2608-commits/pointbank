import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fetchPresets, fetchStudentsOfClass } from '../../lib/api';
import { dateKey } from '../../lib/format';
import type { Preset } from '../../lib/types';
import {
  assignSoloLesson,
  createSoloLesson,
  deleteSoloLesson,
  fetchSoloAssignmentCounts,
  fetchSoloLessons,
  fetchSoloStatus,
  renameSoloLesson,
  rewardSoloLesson,
  type SoloLesson,
  type SoloStatusRow,
} from '../../lib/soloApi';
import { grammarLevelTag } from '../../lib/grammar';
import {
  buildSoloDayLessons,
  buildSoloFromCatalog,
  buildSoloGrammarLesson,
  buildSoloSongLesson,
  songTimedLineCount,
  SOLO_CATALOG,
  SOLO_GRAMMAR_POINTS,
  type SoloCatalogItem,
  type SoloStep,
  type SoloWordStyle,
} from '../../lib/soloLessons';
import type { Student } from '../../lib/types';
import { extractYoutubeId } from '../../lib/youtube';
import { loadWordBank } from '../../lib/wordBankCache';
import { parseShadowText } from '../../lib/shadowLines';
import RecordingsModal from './RecordingsModal';
import SoloLessonEditor from './SoloLessonEditor';
import SoloPreview from './SoloPreview';
import { buildSoloScenarioLesson, SOLO_SCENARIOS } from '../../lib/soloScenarios';

/**
 * 내 수업 → "개별수업" 탭. 개별수업은 화면이 선생님이 되어 학생이 혼자 하는 수업이다(단체수업과 목록·만들기가 따로).
 * 만들기 = "커리큘럼 보기"에서 미리 만든 수업을 골라 이 반 것으로 가져온다 → 학생에게 내기 → 현황 보기.
 */
export default function SoloLessonsPanel({ academyId, classId }: { academyId: string; classId: string | null }) {
  const { t, i18n } = useTranslation();
  const { notify } = useToast();
  const [lessons, setLessons] = useState<SoloLesson[]>([]);
  const [counts, setCounts] = useState<Map<string, { total: number; done: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [preview, setPreview] = useState<SoloLesson | null>(null);
  const [editing, setEditing] = useState<SoloLesson | null>(null);
  const [assigning, setAssigning] = useState<SoloLesson | null>(null);
  const [statusOf, setStatusOf] = useState<SoloLesson | null>(null);
  const [recordsOf, setRecordsOf] = useState<{ lesson: SoloLesson; row: SoloStatusRow } | null>(null);

  const reload = useCallback(async () => {
    if (!classId) {
      setLessons([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchSoloLessons(academyId, classId);
      setLessons(list);
      setCounts(await fetchSoloAssignmentCounts(list.map((l) => l.id)));
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [academyId, classId, notify]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function rename(l: SoloLesson) {
    const next = window.prompt(t('solo.renamePrompt'), l.name);
    if (!next?.trim() || next.trim() === l.name) return;
    try {
      await renameSoloLesson(l.id, next.trim());
      void reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function remove(l: SoloLesson) {
    if (!window.confirm(t('solo.deleteConfirm', { name: l.name }))) return;
    try {
      await deleteSoloLesson(l.id);
      void reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-primary-fixed/25 p-4">
        <p className="font-body-md text-body-md text-on-surface">{t('solo.intro')}</p>
      </div>

      <button
        type="button"
        onClick={() => setCatalogOpen(true)}
        disabled={!classId}
        className="rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-50"
      >
        + {t('solo.createButton')}
      </button>

      {loading ? (
        <div className="py-10 text-center font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : lessons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant py-12 text-center font-body-md text-on-surface-variant">{t('solo.empty')}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lessons.map((l) => {
            const c = counts.get(l.id);
            return (
              <div key={l.id} className="space-y-3 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-sm">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-title-md text-title-md font-bold text-deep-navy">{l.name}</div>
                    <div className="font-caption text-caption text-on-surface-variant">
                      {t('solo.cardMeta', { minutes: l.minutes, steps: l.steps.length })}
                      {l.level ? ` · ${l.level}` : ''}
                    </div>
                  </div>
                  <button type="button" onClick={() => void rename(l)} aria-label={t('solo.rename')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-primary">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button type="button" onClick={() => void remove(l)} aria-label={t('common.delete')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-error">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
                <div className="font-caption text-caption text-on-surface-variant">
                  {c ? t('solo.assignedCount', { total: c.total, done: c.done }) : t('solo.notAssigned')}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditing(l)} className="flex items-center gap-1 rounded-full border border-primary px-3 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10">
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    {t('solo.editLesson')}
                  </button>
                  <button type="button" onClick={() => setPreview(l)} className="rounded-full border border-primary px-3 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10">
                    {t('solo.preview')}
                  </button>
                  <button type="button" onClick={() => setAssigning(l)} className="rounded-full bg-primary px-3 py-1.5 font-label-md text-label-md text-on-primary hover:bg-primary-container">
                    {t('solo.assign')}
                  </button>
                  <button type="button" onClick={() => setStatusOf(l)} className="rounded-full border border-outline-variant px-3 py-1.5 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary">
                    {t('solo.status')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {catalogOpen && classId && (
        <CatalogModal
          onClose={() => setCatalogOpen(false)}
          onBatch={async (lessons, level, source) => {
            try {
              for (const l of lessons) {
                await createSoloLesson({ academyId, classId, name: l.name, level, minutes: l.minutes, steps: l.steps, source });
              }
              notify(t('solo.createdMany', { count: lessons.length }));
              setCatalogOpen(false);
              void reload();
            } catch (e) {
              notify(e instanceof Error ? e.message : String(e), 'error');
            }
          }}
          onPick={async (item) => {
            try {
              const built = buildSoloFromCatalog(item, await loadWordBank(), i18n.language);
              if (!built) {
                notify(t('solo.buildFailed'), 'error');
                return;
              }
              await createSoloLesson({ academyId, classId, name: built.name, level: item.level, minutes: item.minutes, steps: built.steps, source: item.id });
              notify(t('solo.created', { name: built.name }));
              setCatalogOpen(false);
              void reload();
            } catch (e) {
              notify(e instanceof Error ? e.message : String(e), 'error');
            }
          }}
        />
      )}
      {preview && <SoloPreview steps={preview.steps} onClose={() => setPreview(null)} />}
      {editing && (
        <SoloLessonEditor
          lesson={editing}
          academyId={academyId}
          assignedCount={counts.get(editing.id)?.total ?? 0}
          onClose={(saved) => {
            setEditing(null);
            if (saved) void reload();
          }}
        />
      )}
      {assigning && classId && (
        <AssignModal
          lesson={assigning}
          classId={classId}
          onClose={() => setAssigning(null)}
          onDone={() => {
            setAssigning(null);
            void reload();
          }}
        />
      )}
      {statusOf && <StatusModal lesson={statusOf} onClose={() => setStatusOf(null)} onRecords={(row) => setRecordsOf({ lesson: statusOf, row })} />}
      {recordsOf && <RecordingsModal lesson={recordsOf.lesson} row={recordsOf.row} onClose={() => setRecordsOf(null)} />}
    </div>
  );
}

/* ---------------- 커리큘럼 보기(미리 만든 개별수업) ---------------- */

type BatchLesson = { name: string; steps: SoloStep[]; minutes: number };

function CatalogModal({
  onClose,
  onPick,
  onBatch,
}: {
  onClose: () => void;
  onPick: (item: SoloCatalogItem) => Promise<void>;
  onBatch: (lessons: BatchLesson[], level: string, source: string) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const { notify } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const ko = i18n.language.startsWith('ko');
  const tracks: { id: SoloCatalogItem['track']; icon: string }[] = [
    { id: 'word', icon: 'abc' },
    { id: 'grammar', icon: 'rule' },
    { id: 'talk', icon: 'forum' },
    { id: 'video', icon: 'movie' },
  ];

  // 교육부 초등 800 · DAY별(하루 분량과 활동 방식은 만들 때 정한다)
  const [day, setDay] = useState(1);
  const [per, setPer] = useState(10);
  const [style, setStyle] = useState<SoloWordStyle>('writing');

  async function makeDay() {
    setBusy('moe800');
    try {
      const lessons = buildSoloDayLessons(await loadWordBank(), { day, perLesson: per, style, baseName: t('solo.moe800Name', { day }) });
      if (lessons.length === 0) {
        notify(t('solo.moe800Missing'), 'error');
        return;
      }
      await onBatch(lessons, t('solo.moe800Level'), `solo-moe800-d${day}-${style}-${per}`);
    } finally {
      setBusy(null);
    }
  }

  // 노래 수업: 유튜브 링크 + 가사(선생님이 붙여넣기 — 이 수업 안에만 저장된다)
  const [songUrl, setSongUrl] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [songText, setSongText] = useState('');
  const songLines = useMemo(() => parseShadowText(songText).length, [songText]);
  const songTimed = useMemo(() => songTimedLineCount(songText), [songText]);
  async function makeSong() {
    const videoId = extractYoutubeId(songUrl);
    if (!videoId || !songTitle.trim()) return;
    setBusy('song');
    try {
      const lesson = buildSoloSongLesson({ title: songTitle.trim(), videoId, source: songText }, await loadWordBank());
      if (!lesson) {
        notify(t('solo.songTooShort'), 'error');
        return;
      }
      await onBatch([lesson], t('solo.songLevel'), 'solo-song');
    } finally {
      setBusy(null);
    }
  }

  // 문법: 묶음(초등 Level / 중1~3)별 목록
  const grammarGroups = useMemo(() => {
    const map = new Map<string, typeof SOLO_GRAMMAR_POINTS>();
    for (const p of SOLO_GRAMMAR_POINTS) {
      const key = p.stage === 'elementary' ? `L${p.level}` : `G${p.level}`;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, []);

  async function makeGrammar(points: typeof SOLO_GRAMMAR_POINTS, label: string) {
    setBusy(label);
    try {
      await onBatch(points.map(buildSoloGrammarLesson), label, `solo-grammar-${points[0]?.id ?? ''}`);
    } finally {
      setBusy(null);
    }
  }

  const chip = (on: boolean) => `rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`;
  const select = 'rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="my-6 w-full max-w-3xl space-y-4 rounded-2xl bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[24px] text-primary">route</span>
          <div className="min-w-0 flex-1">
            <h3 className="font-title-md text-title-md font-bold text-deep-navy">{t('solo.catalogTitle')}</h3>
            <p className="font-caption text-caption text-on-surface-variant">{t('solo.catalogHint')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {tracks.map((tr) => (
          <div key={tr.id} className="space-y-2">
            <div className="flex items-center gap-1.5 font-label-md text-label-md font-bold text-deep-navy">
              <span className="material-symbols-outlined text-[18px] text-primary">{tr.icon}</span>
              {t(`solo.track_${tr.id}`)}
            </div>

            {tr.id === 'word' && (
              <div className="space-y-3 rounded-xl border border-primary/30 bg-primary-fixed/20 p-3">
                <div className="font-label-md text-label-md font-bold text-on-surface">{t('solo.moe800Title')}</div>
                <p className="font-caption text-caption text-on-surface-variant">{t('solo.moe800Hint')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 16 }, (_, i) => i + 1).map((d) => (
                    <button key={d} type="button" onClick={() => setDay(d)} className={chip(day === d)}>
                      DAY {d}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <label className="space-y-1">
                    <span className="block font-caption text-caption text-on-surface-variant">{t('solo.perLesson')}</span>
                    <select value={per} onChange={(e) => setPer(Number(e.target.value))} className={select}>
                      {[5, 10, 15, 20, 25, 50].map((n) => (
                        <option key={n} value={n}>
                          {t('solo.perLessonOption', { n, lessons: Math.ceil(50 / n) })}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="space-y-1">
                    <span className="block font-caption text-caption text-on-surface-variant">{t('solo.styleLabel')}</span>
                    <div className="flex gap-1.5">
                      {(['writing', 'picture'] as const).map((st) => (
                        <button key={st} type="button" onClick={() => setStyle(st)} className={chip(style === st)}>
                          {t(`solo.style_${st}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void makeDay()}
                    className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-50"
                  >
                    {busy === 'moe800' ? t('common.loading') : t('solo.makeDay', { day })}
                  </button>
                </div>
                <p className="font-caption text-caption text-on-surface-variant">{t(`solo.styleHint_${style}`)}</p>
              </div>
            )}

            {tr.id === 'talk' && (
              <div className="space-y-2">
                <p className="font-caption text-caption text-on-surface-variant">{t('solo.talkHint')}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SOLO_SCENARIOS.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      disabled={busy !== null}
                      onClick={async () => {
                        setBusy(sc.id);
                        try {
                          const lesson = buildSoloScenarioLesson(sc, await loadWordBank(), i18n.language);
                          if (!lesson) {
                            notify(t('solo.buildFailed'), 'error');
                            return;
                          }
                          await onBatch([lesson], t('solo.talkLevel'), sc.id);
                        } finally {
                          setBusy(null);
                        }
                      }}
                      className="flex flex-col gap-1 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[22px] text-primary">{sc.icon}</span>
                        <span className="min-w-0 flex-1 font-label-md text-label-md font-bold text-on-surface">{ko ? sc.ko : sc.en}</span>
                        <span className="rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant">{t('recipes.minutes', { n: 20 })}</span>
                      </div>
                      <div className="font-caption text-caption text-on-surface-variant">{ko ? sc.koDesc : sc.enDesc}</div>
                      {busy === sc.id && <div className="font-caption text-caption text-primary">{t('common.loading')}</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tr.id === 'video' && (
              <div className="space-y-3 rounded-xl border border-primary/30 bg-primary-fixed/20 p-3">
                <div className="font-label-md text-label-md font-bold text-on-surface">{t('solo.songTitle')}</div>
                <p className="font-caption text-caption text-on-surface-variant">{t('solo.songHint')}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={songTitle} onChange={(e) => setSongTitle(e.target.value)} placeholder={t('solo.songNamePlaceholder')} className={`${select} w-full`} />
                  <input value={songUrl} onChange={(e) => setSongUrl(e.target.value)} placeholder={t('solo.songUrlPlaceholder')} className={`${select} w-full`} />
                </div>
                <textarea
                  value={songText}
                  onChange={(e) => setSongText(e.target.value)}
                  rows={7}
                  placeholder={t('solo.songTextPlaceholder')}
                  className={`${select} w-full font-mono`}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={busy !== null || !extractYoutubeId(songUrl) || !songTitle.trim() || songLines < 4}
                    onClick={() => void makeSong()}
                    className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-50"
                  >
                    {busy === 'song' ? t('common.loading') : t('solo.makeSong')}
                  </button>
                  <span className="font-caption text-caption text-on-surface-variant">{t('solo.songLineCount', { lines: songLines, timed: songTimed })}</span>
                </div>
                {songLines > 0 && songTimed < songLines / 2 && <p className="rounded-lg bg-warm-yellow/25 px-3 py-2 font-caption text-caption text-on-surface">{t('solo.songNoTimes')}</p>}
                <p className="font-caption text-caption text-on-surface-variant">{t('solo.songCopyright')}</p>
              </div>
            )}

            {tr.id === 'grammar' && (
              <div className="space-y-2">
                <p className="font-caption text-caption text-on-surface-variant">{t('solo.grammarHint')}</p>
                {grammarGroups.map(([key, points]) => {
                  const label = grammarLevelTag(points[0]);
                  return (
                    <details key={key} className="rounded-xl border border-outline-variant/50 bg-surface-container-lowest">
                      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 font-label-md text-label-md text-on-surface">
                        <span className="flex-1">
                          {label} <span className="font-caption text-caption text-on-surface-variant">· {t('solo.grammarCount', { count: points.length })}</span>
                        </span>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={(e) => {
                            e.preventDefault();
                            if (window.confirm(t('solo.makeAllConfirm', { count: points.length, label }))) void makeGrammar(points, label);
                          }}
                          className="rounded-full border border-primary px-3 py-1 font-label-md text-label-md text-primary hover:bg-primary/10 disabled:opacity-50"
                        >
                          {busy === label ? t('common.loading') : t('solo.makeAll')}
                        </button>
                      </summary>
                      <div className="grid gap-1.5 px-3 pb-3 sm:grid-cols-2">
                        {points.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void makeGrammar([p], label)}
                            className="truncate rounded-lg border border-outline-variant/50 px-3 py-2 text-left font-body-sm text-body-sm text-on-surface transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {SOLO_CATALOG.filter((c) => c.track === tr.id).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={!!c.soon || busy !== null}
                  onClick={async () => {
                    setBusy(c.id);
                    await onPick(c);
                    setBusy(null);
                  }}
                  className="flex flex-col gap-1 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[22px] text-primary">{c.icon}</span>
                    <span className="min-w-0 flex-1 font-label-md text-label-md font-bold text-on-surface">{ko ? c.ko : c.en}</span>
                    {c.soon ? (
                      <span className="rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant">{t('solo.soon')}</span>
                    ) : (
                      <span className="rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant">{t('recipes.minutes', { n: c.minutes })}</span>
                    )}
                  </div>
                  <div className="font-caption text-caption text-on-surface-variant">{ko ? c.koDesc : c.enDesc}</div>
                  {busy === c.id && <div className="font-caption text-caption text-primary">{t('common.loading')}</div>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 학생에게 내기 ---------------- */

function AssignModal({ lesson, classId, onClose, onDone }: { lesson: SoloLesson; classId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [due, setDue] = useState('');
  const [kind, setKind] = useState<'lesson' | 'homework'>('lesson');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchStudentsOfClass(classId)
      .then((s) => {
        setStudents(s);
        setPicked(new Set(s.map((x) => x.id)));
      })
      .catch((e) => notify(e instanceof Error ? e.message : String(e), 'error'));
  }, [classId, notify]);

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function send() {
    if (picked.size === 0 || busy) return;
    setBusy(true);
    try {
      const n = await assignSoloLesson(lesson.id, [...picked], due ? new Date(`${due}T23:59:59`).toISOString() : null, kind);
      notify(t('solo.assignedToast', { count: n }));
      onDone();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 font-title-md text-title-md font-bold text-deep-navy">{t('solo.assignTitle', { name: lesson.name })}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('solo.kindLabel')}>
          {(['lesson', 'homework'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-xl border-2 px-3 py-2 text-left ${kind === k ? 'border-primary bg-primary/10' : 'border-outline-variant hover:bg-surface-container-low'}`}
            >
              <span className="block font-label-md text-label-md font-bold text-deep-navy">{t(`solo.kind_${k}`)}</span>
              <span className="block font-caption text-caption text-on-surface-variant">{t(`solo.kindHint_${k}`)}</span>
            </button>
          ))}
        </div>
        <p className="font-caption text-caption text-on-surface-variant">{t('solo.assignHint')}</p>
        <div className="flex gap-3 font-caption text-caption">
          <button type="button" onClick={() => setPicked(new Set(students.map((s) => s.id)))} className="text-primary hover:underline">{t('solo.selectAll')}</button>
          <button type="button" onClick={() => setPicked(new Set())} className="text-on-surface-variant hover:underline">{t('solo.selectNone')}</button>
        </div>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {students.map((s) => (
            <li key={s.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container-low">
                <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4" />
                <span className="font-label-md text-label-md text-on-surface">{s.name}</span>
              </label>
            </li>
          ))}
        </ul>
        <label className="block space-y-1">
          <span className="font-caption text-caption text-on-surface-variant">{t('solo.dueLabel')}</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm" />
        </label>
        <div className="flex items-center gap-2">
          <button type="button" disabled={picked.size === 0 || busy} onClick={() => void send()} className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary disabled:opacity-40">
            {t('solo.sendTo', { count: picked.size })}
          </button>
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 현황 ---------------- */

function StatusModal({ lesson, onClose, onRecords }: { lesson: SoloLesson; onClose: () => void; onRecords: (row: SoloStatusRow) => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const { academy, pointUnit } = useAuth();
  const [rows, setRows] = useState<SoloStatusRow[] | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetId, setPresetId] = useState('');
  const [rewarding, setRewarding] = useState(false);
  const [tick, setTick] = useState(0);
  const hasSing = lesson.steps.some((st) => st.t === 'lineSing' || st.t === 'fadeRead' || st.t === 'roleplay');

  useEffect(() => {
    if (!academy?.id) return;
    fetchPresets(academy.id).then(
      (ps) => {
        const plus = ps.filter((p) => p.delta > 0);
        setPresets(plus);
        setPresetId((cur) => cur || (plus.find((p) => p.is_homework) ?? plus[0])?.id || '');
      },
      () => setPresets([]),
    );
  }, [academy?.id]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchSoloStatus(lesson.id)
        .then((r) => alive && setRows(r))
        .catch((e) => alive && notify(e instanceof Error ? e.message : String(e), 'error'));
    void load();
    const timer = window.setInterval(load, 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [lesson.id, notify, tick]);

  const waiting = (rows ?? []).filter((r) => r.finished_at && !r.rewarded);
  const rewardedCount = (rows ?? []).filter((r) => r.rewarded).length;
  const preset = presets.find((p) => p.id === presetId);

  async function give() {
    if (!preset || waiting.length === 0 || rewarding) return;
    setRewarding(true);
    try {
      const r = await rewardSoloLesson(lesson.id, preset.id, waiting.map((w) => w.student_id), dateKey());
      if (r.locked) notify(t('solo.rewardLocked'), 'error');
      else notify(t('solo.rewardGiven', { count: r.given, delta: preset.delta, unit: pointUnit }));
      setTick((n) => n + 1);
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setRewarding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="my-6 w-full max-w-2xl space-y-4 rounded-2xl bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 font-title-md text-title-md font-bold text-deep-navy">{t('solo.statusTitle', { name: lesson.name })}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {rows === null ? (
          <div className="py-8 text-center text-on-surface-variant">{t('common.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-on-surface-variant">{t('solo.statusEmpty')}</div>
        ) : (
          <>
            {(() => {
              const stuck = rows.filter((r) => r.unsure_count > 0);
              if (stuck.length === 0) return null;
              return (
                <div className="rounded-lg bg-warm-yellow/25 px-3 py-2 font-caption text-caption text-on-surface">
                  {t('solo.stuckSummary', { count: stuck.length })}
                </div>
              );
            })()}
            {rows.some((r) => r.finished_at) && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warm-yellow/30 p-3">
                <span className="material-symbols-outlined text-deep-navy">savings</span>
                <div className="min-w-0 flex-1 font-label-md text-label-md text-deep-navy">
                  {waiting.length > 0 ? (
                    <>
                      <b>{t('solo.rewardWaiting', { count: waiting.length })}</b>
                      <span className="ml-1 font-caption text-caption text-on-surface-variant">{waiting.map((w) => w.name).join(', ')}</span>
                    </>
                  ) : (
                    <b>{t('solo.rewardAllDone', { count: rewardedCount })}</b>
                  )}
                </div>
                {waiting.length > 0 &&
                  (presets.length === 0 ? (
                    <span className="font-caption text-caption text-on-surface-variant">{t('solo.rewardNoPreset')}</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={presetId}
                        onChange={(e) => setPresetId(e.target.value)}
                        aria-label={t('solo.rewardPreset')}
                        className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm"
                      >
                        {presets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label} (+{p.delta})
                          </option>
                        ))}
                      </select>
                      <button type="button" disabled={rewarding} onClick={() => void give()} className="rounded-full bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary disabled:opacity-40">
                        {t('solo.rewardGive')}
                      </button>
                    </div>
                  ))}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="font-caption text-caption text-on-surface-variant">
                    <th className="pb-2 pr-3">{t('attendance.name')}</th>
                    <th className="pb-2 pr-3">{t('solo.colProgress')}</th>
                    <th className="pb-2 pr-3">{t('solo.colRight')}</th>
                    <th className="pb-2 pr-3">{t('solo.colUnsure')}</th>
                    {hasSing && <th className="pb-2" />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.assignment_id} className="border-t border-surface-container">
                      <td className="py-2 pr-3 font-label-md text-label-md text-on-surface">{r.name}</td>
                      <td className="py-2 pr-3">
                        {r.finished_at ? (
                          <span className="rounded-full bg-secondary-container/60 px-2 py-0.5 font-caption text-caption">{t('solo.finished')}{r.rewarded ? ` · ${t('solo.rewardedBadge')}` : ''}</span>
                        ) : r.started_at ? (
                          <span className="font-caption text-caption tabular-nums text-on-surface">
                            {r.progress}/{r.total}
                          </span>
                        ) : (
                          <span className="font-caption text-caption text-on-surface-variant">{t('solo.notStarted')}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-caption text-caption tabular-nums text-on-surface">
                        {r.right_count + r.wrong_count > 0 ? `${r.right_count}/${r.right_count + r.wrong_count}` : '-'}
                      </td>
                      <td className="py-2 pr-3 font-caption text-caption text-on-surface">
                        {r.unsure_count > 0 ? t('solo.unsureAt', { steps: r.unsure_steps.join(', ') }) : '-'}
                      </td>
                      {hasSing && (
                        <td className="py-2">
                          <button type="button" onClick={() => onRecords(r)} className="whitespace-nowrap rounded-full border border-primary px-3 py-1 font-label-md text-label-md text-primary hover:bg-primary/10">
                            {t('solo.listenRecordings')}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
