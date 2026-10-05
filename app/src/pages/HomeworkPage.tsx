import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ClassChipRow from '../components/ClassChipRow';
import HomeworkResults from '../components/homework/teacher/HomeworkResults';
import HomeworkSharePanel from '../components/homework/teacher/HomeworkSharePanel';
import HomeworkWizard from '../components/homework/teacher/HomeworkWizard';
import LearningCardModal from '../components/homework/teacher/LearningCardModal';
import PinManager from '../components/homework/teacher/PinManager';
import RecommendReview from '../components/homework/teacher/RecommendReview';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchStudentsOfClass } from '../lib/api';
import { fetchHomeworkOverview, fetchHomeworkUsage, teacherErrorKey, type HomeworkOverviewRow } from '../lib/homework';
import type { FullCardItem, Student } from '../lib/types';
import { useClasses } from '../lib/useClasses';

type Panel =
  | { k: 'none' }
  | { k: 'wizard'; studentIds?: string[]; cards?: FullCardItem[]; title?: string }
  | { k: 'recommend'; studentIds: string[] };

/**
 * 숙제(Classbank Student, 2026-10-05 2단계) — 수업 자료 → 온라인 숙제 → 서버 채점·학습 기록 → 학습 카드 → 맞춤 숙제 추천
 * → 선생님 확인 뒤 발송. 목록·결과 숫자는 서버가 집계한다.
 */
export default function HomeworkPage() {
  const { t } = useTranslation();
  const { academy } = useAuth();
  const { notify } = useToast();
  const { classes, selectedId, select, reorder } = useClasses(academy?.id);
  const classId = selectedId ?? classes[0]?.id ?? null;
  const className = classes.find((c) => c.id === classId)?.name ?? '';
  const [list, setList] = useState<HomeworkOverviewRow[] | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>({ k: 'none' });
  const [shareId, setShareId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cardStudent, setCardStudent] = useState<string | null>(null);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);

  const reload = useCallback(async () => {
    if (!classId) return;
    try {
      const [hw, st] = await Promise.all([fetchHomeworkOverview(classId), fetchStudentsOfClass(classId)]);
      setList(hw);
      setStudents(st);
      setError(null);
    } catch (e) {
      setError(t(teacherErrorKey(e)));
      setList([]);
    }
  }, [classId, t]);

  useEffect(() => {
    setList(null);
    setPanel({ k: 'none' });
    setShareId(null);
    setOpenId(null);
    void reload();
  }, [reload]);

  // 이번 달 온라인 숙제를 시작한 학생 수(안내용 — 요금·제한과 연결되지 않음)
  useEffect(() => {
    const now = new Date();
    fetchHomeworkUsage(new Date(now.getFullYear(), now.getMonth(), 1), now).then(
      (u) => setUsage(u.active_students),
      () => setUsage(null),
    );
  }, [list]);

  // 맞춤 숙제는 같은 묶음(group_id)끼리 모아서 보여 준다
  const groups = useMemo(() => {
    const out: { key: string; rows: HomeworkOverviewRow[] }[] = [];
    const byGroup = new Map<string, HomeworkOverviewRow[]>();
    for (const h of list ?? []) {
      if (h.kind === 'custom' && h.group_id) {
        if (!byGroup.has(h.group_id)) {
          byGroup.set(h.group_id, []);
          out.push({ key: h.group_id, rows: byGroup.get(h.group_id)! });
        }
        byGroup.get(h.group_id)!.push(h);
      } else out.push({ key: h.id, rows: [h] });
    }
    return out;
  }, [list]);

  const openCard = (id: string) => setCardStudent(id);
  const startRecommend = (ids: string[]) => {
    const use = ids.length ? ids : students.map((s) => s.id);
    if (use.length === 0) {
      notify(t('studentHw.noStudentsTeacher'), 'error');
      return;
    }
    setCardStudent(null);
    setPanel({ k: 'recommend', studentIds: use });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const headerBtn = 'flex min-h-11 items-center gap-1.5 rounded-full px-4 font-label-md text-label-md';
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-label-md text-label-md text-primary">Classbank Student</div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy md:font-headline-lg md:text-headline-lg">{t('studentHw.pageTitle')}</h1>
          <p className="mt-1 max-w-3xl font-body-md text-body-md text-on-surface-variant">{t('studentHw.pageIntro')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPinsOpen(true)} disabled={!classId} className={`${headerBtn} border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low disabled:opacity-40`}>
            <span className="material-symbols-outlined text-[18px]">key</span>
            {t('studentHw.pinsButton')}
          </button>
          <button type="button" onClick={() => startRecommend([])} disabled={!classId} className={`${headerBtn} border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low disabled:opacity-40`}>
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            {t('studentHw.checkRecommend')}
          </button>
          <button type="button" onClick={() => setPanel({ k: 'wizard' })} disabled={!classId} className={`${headerBtn} bg-primary px-5 text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-40`}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t('studentHw.newButton')}
          </button>
        </div>
      </div>

      {classes.length > 0 && <ClassChipRow classes={classes} selectedId={classId} onSelect={select} onReorder={reorder} />}
      {error && <div className="rounded-lg bg-error-container px-4 py-2 text-base text-on-error-container">{error}</div>}

      {panel.k === 'wizard' && classId && academy?.id && (
        <HomeworkWizard
          key={`${panel.title ?? ''}-${panel.studentIds?.join(',') ?? ''}`}
          academyId={academy.id}
          classId={classId}
          className={className}
          initialStudentIds={panel.studentIds}
          initialCards={panel.cards}
          initialTitle={panel.title}
          onCancel={() => setPanel({ k: 'none' })}
          onCreated={async (hw) => {
            setPanel({ k: 'none' });
            notify(t('studentHw.created'));
            await reload();
            setShareId(hw.id);
          }}
        />
      )}

      {panel.k === 'recommend' && classId && academy?.id && (
        <RecommendReview
          academyId={academy.id}
          classId={classId}
          students={students.filter((s) => panel.studentIds.includes(s.id)).map((s) => ({ id: s.id, name: s.name }))}
          onClose={() => setPanel({ k: 'none' })}
          onSent={async () => {
            setPanel({ k: 'none' });
            await reload();
          }}
        />
      )}

      {list === null ? (
        <div className="text-base text-on-surface-variant">{t('common.loading')}</div>
      ) : list.length === 0 && panel.k === 'none' ? (
        <div className="rounded-xl bg-surface-container-lowest p-8 text-center text-base text-on-surface-variant shadow-sm">{t('studentHw.empty')}</div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) =>
            g.rows.length > 1 || g.rows[0].kind === 'custom' ? (
              <CustomGroup key={g.key} rows={g.rows} shareId={shareId} openId={openId} setShareId={setShareId} setOpenId={setOpenId} renderOpen={(hw) => renderPanels(hw)} />
            ) : (
              <HomeworkCard key={g.key} hw={g.rows[0]} shareOpen={shareId === g.rows[0].id} resultsOpen={openId === g.rows[0].id} onShare={() => setShareId(shareId === g.key ? null : g.key)} onResults={() => setOpenId(openId === g.key ? null : g.key)}>
                {renderPanels(g.rows[0])}
              </HomeworkCard>
            ),
          )}
        </div>
      )}

      {usage !== null && <p className="text-sm text-on-surface-variant">{t('studentHw.usageNote', { count: usage })}</p>}

      {cardStudent && <LearningCardModal studentId={cardStudent} onClose={() => setCardStudent(null)} onRecommend={(id) => startRecommend([id])} />}
      {pinsOpen && classId && <PinManager classId={classId} className={className} onClose={() => setPinsOpen(false)} />}
    </div>
  );

  function renderPanels(hw: HomeworkOverviewRow) {
    return (
      <>
        {shareId === hw.id && <HomeworkSharePanel hw={hw} />}
        {openId === hw.id && (
          <HomeworkResults
            hw={hw}
            onChanged={() => void reload()}
            onCard={openCard}
            onRecommend={startRecommend}
            onMakeHomework={({ studentIds, cards, title }) => {
              setPanel({ k: 'wizard', studentIds, cards, title });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </>
    );
  }
}

function HomeworkCard({
  hw,
  shareOpen,
  resultsOpen,
  onShare,
  onResults,
  children,
  compact = false,
}: {
  hw: HomeworkOverviewRow;
  shareOpen: boolean;
  resultsOpen: boolean;
  onShare: () => void;
  onResults: () => void;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const pastDue = !!hw.due_at && new Date(hw.due_at).getTime() < Date.now();
  const btn = 'flex min-h-11 items-center gap-1 rounded-full px-4 text-base font-bold';
  return (
    <div className={`${compact ? 'border-t border-outline-variant/40' : 'rounded-xl bg-surface-container-lowest shadow-sm'} ${hw.closed_at ? 'opacity-75' : ''}`}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-deep-navy">{compact && hw.custom_student ? hw.custom_student : hw.title || t('studentHw.defaultTitle')}</span>
            {hw.kind === 'selected' && <span className="rounded-full bg-secondary-container/60 px-2.5 py-0.5 text-sm">{t('studentHw.kindSelected')}</span>}
            {hw.closed_at && <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-sm text-on-surface-variant">{t('studentHw.closed')}</span>}
            {!hw.closed_at && pastDue && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm text-amber-900">{t('studentHw.pastDue')}</span>}
          </div>
          <div className="text-sm text-on-surface-variant">
            {t('studentHw.questionCount', { count: hw.question_count })}
            {hw.kind !== 'custom' && (
              <>
                {' · '}
                {t('studentHw.code')} <b className="tabular-nums">{hw.code}</b>
              </>
            )}
            {hw.due_at && ` · ${t('studentHw.dueShort', { date: new Date(hw.due_at).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) })}`}
          </div>
        </div>
        <div className="flex items-center gap-5 text-center">
          <div>
            <div className="text-lg font-bold tabular-nums text-deep-navy">
              {hw.done}/{hw.target_count}
            </div>
            <div className="text-sm text-on-surface-variant">{t('studentHw.doneCount')}</div>
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums text-deep-navy">{hw.avg_pct === null ? '–' : `${Math.round(hw.avg_pct)}%`}</div>
            <div className="text-sm text-on-surface-variant">{t('studentHw.avgScore')}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-expanded={shareOpen} onClick={onShare} className={`${btn} bg-secondary-container/60 text-on-surface hover:bg-secondary-container`}>
            <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
            {t('studentHw.share')}
          </button>
          <button type="button" aria-expanded={resultsOpen} onClick={onResults} className={`${btn} bg-primary text-on-primary hover:bg-primary-container`}>
            <span className="material-symbols-outlined text-[18px]">monitoring</span>
            {t('studentHw.results')}
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function CustomGroup({
  rows,
  shareId,
  openId,
  setShareId,
  setOpenId,
  renderOpen,
}: {
  rows: HomeworkOverviewRow[];
  shareId: string | null;
  openId: string | null;
  setShareId: (id: string | null) => void;
  setOpenId: (id: string | null) => void;
  renderOpen: (hw: HomeworkOverviewRow) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const done = rows.filter((r) => r.done > 0).length;
  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sm">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-h-14 w-full flex-wrap items-center gap-3 p-4 text-left">
        <span className="material-symbols-outlined text-primary">auto_awesome</span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold text-deep-navy">{t('studentHw.customGroup', { count: rows.length })}</span>
          <span className="block text-sm text-on-surface-variant">{new Date(rows[0].created_at).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</span>
        </span>
        <span className="text-lg font-bold tabular-nums text-deep-navy">
          {done}/{rows.length} <span className="text-sm font-normal text-on-surface-variant">{t('studentHw.doneCount')}</span>
        </span>
        <span className="material-symbols-outlined">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open &&
        rows.map((hw) => (
          <HomeworkCard
            key={hw.id}
            hw={hw}
            compact
            shareOpen={shareId === hw.id}
            resultsOpen={openId === hw.id}
            onShare={() => setShareId(shareId === hw.id ? null : hw.id)}
            onResults={() => setOpenId(openId === hw.id ? null : hw.id)}
          >
            {renderOpen(hw)}
          </HomeworkCard>
        ))}
    </div>
  );
}
