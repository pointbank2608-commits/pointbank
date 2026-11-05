import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WordMemoryResults from '../components/wordMemory/WordMemoryResults';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ClassChipRow from '../components/ClassChipRow';
import HomeworkResults from '../components/homework/teacher/HomeworkResults';
import HomeworkSharePanel from '../components/homework/teacher/HomeworkSharePanel';
import HomeworkWizard from '../components/homework/teacher/HomeworkWizard';
import HomeworkBlockEditor from '../components/homework/teacher/HomeworkBlockEditor';
import HomeworkComposer from '../components/homework/teacher/HomeworkComposer';
import AdaptiveHomeworkComposer from '../components/homework/teacher/AdaptiveHomeworkComposer';
import AdaptiveHomeworkResults from '../components/homework/teacher/AdaptiveHomeworkResults';
import { useFeature } from '../lib/features';
import type { HwItemDraft } from '../lib/homework/types';
import LearningCardModal from '../components/homework/teacher/LearningCardModal';
import PinManager from '../components/homework/teacher/PinManager';
import RecommendReview from '../components/homework/teacher/RecommendReview';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchStudentsOfClass } from '../lib/api';
import { deleteHomework, fetchHomeworkOverview, fetchHomeworkUsage, teacherErrorKey, type HomeworkOverviewRow } from '../lib/homework';
import type { FullCardItem, Student } from '../lib/types';
import { useClasses } from '../lib/useClasses';

type Panel =
  | { k: 'none' }
  | { k: 'adaptive' }
  | { k: 'compose'; mode?:'lesson'|'list'; cards?:FullCardItem[]; title?:string; lessonId?:string }
  | { k: 'editor'; items?: HwItemDraft[]; title?: string; lessonId?: string; importLesson?: boolean; studentIds?: string[] | null; due?: string }
  | { k: 'wizard'; studentIds?: string[]; cards?: FullCardItem[]; title?: string; lessonId?: string; pickedCards?: FullCardItem[] }
  | { k: 'recommend'; studentIds: string[]; gamesOnly?: boolean; source?:{cards:FullCardItem[];name:string} };

/**
 * 숙제(Classbank Student, 2026-10-05 2단계) — 수업 자료 → 온라인 숙제 → 서버 채점·학습 기록 → 학습 카드 → 맞춤 숙제 추천
 * → 선생님 확인 뒤 발송. 목록·결과 숫자는 서버가 집계한다.
 */
export default function HomeworkPage() {
  const { t, i18n } = useTranslation();
  const { academy, profile } = useAuth();
  const homeworkOpen = useFeature('homework');
  const soloOpen = useFeature('solo');
  const [adaptiveRevision,setAdaptiveRevision]=useState(0);
  const en=i18n.language.startsWith('en');
  const { notify } = useToast();
  const { classes, selectedId, select, reorder } = useClasses(academy?.id);
  const classId = selectedId ?? classes[0]?.id ?? null;
  const className = classes.find((c) => c.id === classId)?.name ?? '';
  const [list, setList] = useState<HomeworkOverviewRow[] | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadedClass,setLoadedClass]=useState('');
  const loadSequence=useRef(0);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>({ k: 'none' });
  const [shareId, setShareId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cardStudent, setCardStudent] = useState<string | null>(null);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);

  const reload = useCallback(async () => {
    const sequence=++loadSequence.current;
    if (!classId) return;
    try {
      const [hw, st] = await Promise.all([fetchHomeworkOverview(classId), fetchStudentsOfClass(classId)]);
      if(sequence!==loadSequence.current)return;
      setList(hw);
      setStudents(st);
      setLoadedClass(classId);
      setError(null);
    } catch (e) {
      if(sequence!==loadSequence.current)return;
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
    setPanel({ k: 'recommend', studentIds: use, gamesOnly:true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const headerBtn = 'flex min-h-11 items-center gap-1.5 rounded-full px-4 font-label-md text-label-md';
  // 내 수업 카드의 "숙제 내기"에서 넘어온 경우: 그 수업으로 마법사를 한 번만 연다
  useEffect(() => {
    const st = location.state as { fromLessonId?: string; fromClassId?: string; pickedCards?: FullCardItem[]; pickedTitle?: string; personalGame?:{cards:FullCardItem[];name:string} } | null;
    if (!classId) return;
    if (st?.fromClassId && classId !== st.fromClassId) { select(st.fromClassId); return; }
    if(st?.personalGame?.cards?.length){
      if(loadedClass!==classId)return;
      if(!students.length){notify(t('studentHw.noStudentsTeacher'),'error');navigate(location.pathname,{replace:true,state:null});return;}
      setPanel({k:'recommend',gamesOnly:true,studentIds:students.map(s=>s.id),source:st.personalGame});
      navigate(location.pathname,{replace:true,state:null});return;
    }
    // 단어 사전·파닉스에서 고른 낱말로 숙제 내기
    if (st?.pickedCards?.length) {
      setPanel({ k: 'compose', cards: st.pickedCards, title: st.pickedTitle });
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (!st?.fromLessonId) return;
    setPanel({ k: 'compose', lessonId: st.fromLessonId });
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, classId, navigate, select,loadedClass,students,notify,t]);

  if (!homeworkOpen) return <p className="p-6 text-on-surface-variant">{t('studentHw.err_feature_closed')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-label-md text-label-md text-primary">Classbank Student</div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy md:font-headline-lg md:text-headline-lg">{t('studentHw.pageTitle')}</h1>
          <p className="mt-1 max-w-3xl font-body-md text-body-md text-on-surface-variant">{i18n.language.startsWith('en')?'Choose a lesson or collection, preview the practice, then send it to your students.':'수업이나 단어장을 고르고, 학생 화면을 확인한 뒤 숙제를 보내세요.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <details className="relative"><summary className={`${headerBtn} cursor-pointer border border-outline-variant bg-white`}>{i18n.language.startsWith('en')?'More':'더보기'}</summary><div className="absolute right-0 top-full z-20 mt-2 grid w-72 max-w-[85vw] gap-2 rounded-2xl border border-outline-variant bg-white p-3 shadow-xl">
          <button type="button" disabled={!classId||!students.length} onClick={()=>setPanel({k:'recommend',studentIds:students.map(s=>s.id),gamesOnly:true})} className={`${headerBtn} bg-deep-navy text-white`}>{i18n.language.startsWith('en')?'Personal game practice':'학생별 맞춤 게임'}</button>
          <button type="button" onClick={() => setPanel({ k: 'editor' })} disabled={!classId} className={`${headerBtn} bg-warm-yellow text-deep-navy disabled:opacity-40`}>{i18n.language.startsWith('en') ? 'Detailed editing' : '직접 세부 편집'}</button>
          <button type="button" onClick={() => setPinsOpen(true)} disabled={!classId} className={`${headerBtn} border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low disabled:opacity-40`}>
            <span className="material-symbols-outlined text-[18px]">key</span>
            {t('studentHw.pinsButton')}
          </button>
          <button type="button" onClick={() => startRecommend([])} disabled={!classId} className={`${headerBtn} border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low disabled:opacity-40`}>
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            {t('studentHw.checkRecommend')}
          </button>
          <button type="button" onClick={() => setPanel({k:'wizard'})} disabled={!classId} className={`${headerBtn} border border-outline-variant`}>{i18n.language.startsWith('en')?'Use the previous wizard':'기존 방식으로 만들기'}</button>
          </div></details>
          <button type="button" onClick={() => setPanel({ k: 'compose' })} disabled={!classId} className={`${headerBtn} bg-primary px-5 text-white shadow-sm hover:bg-primary-container disabled:opacity-40`}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t('studentHw.newButton')}
          </button>
        </div>
      </div>

      {classes.length > 0 && <ClassChipRow classes={classes} selectedId={classId} onSelect={select} onReorder={reorder} />}
      {error && <div className="rounded-lg bg-error-container px-4 py-2 text-base text-on-error-container">{error}</div>}

      {panel.k==='none'&&classId&&<section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/25 bg-primary-fixed/25 p-5">
        <div><h2 className="text-lg font-bold text-deep-navy">{en?'Adaptive vocabulary homework':'필요한 만큼 배우는 단어 숙제'}</h2><p className="mt-1 text-sm text-on-surface-variant">{en?'Choose words, preview the plan and send. Students practise what they need and check their memory later.':'단어를 고르고 계획을 확인하면, 학생마다 필요한 연습과 이후 복습 확인이 이어져요.'}</p>{!soloOpen&&<p className="mt-2 text-sm">{en?'This homework uses the academy’s individual learning feature.':'이 숙제는 학원의 개별수업 기능이 열려 있어야 만들 수 있어요.'}</p>}</div>
        <button type="button" className={`${headerBtn} bg-primary text-white disabled:opacity-40`} disabled={!soloOpen} onClick={()=>setPanel({k:'adaptive'})}>{en?'Create adaptive homework':'맞춤 단어 숙제 만들기'}</button>
      </section>}
      {panel.k==='adaptive'&&classId&&academy?.id&&<AdaptiveHomeworkComposer key={classId} academyId={academy.id} classId={classId} onClose={()=>setPanel({k:'none'})} onCreated={()=>{setPanel({k:'none'});setAdaptiveRevision(n=>n+1);notify(en?'Homework assigned. Students can start from their portal.':'숙제를 배정했어요. 학생 홈의 숙제에서 시작할 수 있어요.');}}/>}
      {panel.k==='none'&&classId&&<div className="hw-source-choices rounded-2xl border border-outline-variant bg-white p-5">
        <button type="button" onClick={()=>setPanel({k:'compose',mode:'lesson'})}><span className="material-symbols-outlined" aria-hidden>school</span><strong>{i18n.language.startsWith('en')?'Review a lesson':'오늘 수업 복습시키기'}</strong><span>{i18n.language.startsWith('en')?'Choose a saved lesson and collect its learning content.':'만든 수업을 고르면 단어·표현을 한 번에 모아요.'}</span></button>
        <button type="button" onClick={()=>setPanel({k:'compose',mode:'list'})}><span className="material-symbols-outlined" aria-hidden>style</span><strong>{i18n.language.startsWith('en')?'Learn words and expressions':'단어·문장 외우게 하기'}</strong><span>{i18n.language.startsWith('en')?'Use your collections to build a practice routine.':'내 단어장·문장 모음으로 반복 학습을 만들어요.'}</span></button>
      </div>}
      {panel.k==='compose'&&classId&&academy?.id&&profile&&<HomeworkComposer
        key={`${classId}:${panel.lessonId||panel.mode||'new'}:${panel.cards?.length||0}`}
        academyId={academy.id} ownerId={profile.id} classId={classId} className={className}
        initialLessonId={panel.lessonId} initialMode={panel.mode} initialCards={panel.cards} initialTitle={panel.title}
        onClose={()=>setPanel({k:'none'})}
        onLegacy={()=>setPanel({k:'wizard',lessonId:panel.lessonId,pickedCards:panel.cards,title:panel.title})}
        onEdit={(items,title,studentIds,due)=>setPanel({k:'editor',items,title,studentIds,due})}
        onCreated={async hw=>{setPanel({k:'none'});notify(t('studentHw.created'));await reload();setShareId(hw.id);}}
      />}

      {panel.k === 'editor' && classId && academy?.id && profile && <HomeworkBlockEditor
        key={`${classId}-${panel.lessonId ?? ''}`} academyId={academy.id} classId={classId} ownerId={profile.id}
        initialItems={panel.items} initialTitle={panel.title} lessonId={panel.lessonId}
        startWithLessonImport={panel.importLesson}
        initialStudentIds={panel.studentIds} initialDue={panel.due}
        classOptions={classes.filter((c) => c.id !== classId).map((c) => ({ id: c.id, name: c.name }))}
        onClose={() => setPanel({ k: 'none' })}
        onCreated={async (hw) => { setPanel({ k: 'none' }); await reload(); setShareId(hw.id); }}
      />}

      {panel.k === 'wizard' && classId && academy?.id && (
        <HomeworkWizard
          key={`${panel.title ?? ''}-${panel.studentIds?.join(',') ?? ''}-${panel.lessonId ?? ''}-${panel.pickedCards?.length ?? 0}`}
          initialLessonId={panel.lessonId}
          pickedCards={panel.pickedCards}
          academyId={academy.id}
          classId={classId}
          className={className}
          initialStudentIds={panel.studentIds}
          initialCards={panel.cards}
          initialTitle={panel.title}
          onCancel={() => setPanel({ k: 'none' })}
          onEdit={(items, title, studentIds, due) => setPanel({ k: 'editor', items, title, studentIds, due })}
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
          key={`${classId}-${panel.gamesOnly?'game':'review'}-${panel.studentIds.join(',')}`}
          initialGamesOnly={panel.gamesOnly}
          initialSource={panel.source}
          academyId={academy.id}
          classId={classId}
          students={students.filter((s) => panel.studentIds.includes(s.id)).map((s) => ({ id: s.id, name: s.name }))}
          onClose={() => setPanel({ k: 'none' })}
          onCommonReview={() => setPanel({ k: 'editor', importLesson: true })}
          onEditBlocks={(a) => setPanel({ k: 'editor', items: a.items, title: t('studentHw.recTitle', { name: a.name }), studentIds: [a.studentId] })}
          onSent={async () => {
            setPanel({ k: 'none' });
            await reload();
          }}
        />
      )}

      {classId && <AdaptiveHomeworkResults key={`adaptive-${classId}`} classId={classId} revision={adaptiveRevision}/> }
      {classId && <WordMemoryResults key={classId} classId={classId} initialPlanId={(location.state as { wmPlanId?: string } | null)?.wmPlanId} />}

      {list === null ? (
        <div className="text-base text-on-surface-variant">{t('common.loading')}</div>
      ) : list.length === 0 && panel.k === 'none' ? (
        <div className="rounded-xl bg-surface-container-lowest p-8 text-center text-base text-on-surface-variant shadow-sm">{t('studentHw.empty')}</div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) =>
            g.rows.length > 1 || g.rows[0].kind === 'custom' ? (
              <CustomGroup key={g.key} rows={g.rows} onChanged={() => void reload()} shareId={shareId} openId={openId} setShareId={setShareId} setOpenId={setOpenId} renderOpen={(hw) => renderPanels(hw)} />
            ) : (
              <HomeworkCard key={g.key} hw={g.rows[0]} shareOpen={shareId === g.rows[0].id} resultsOpen={openId === g.rows[0].id} onShare={() => setShareId(shareId === g.key ? null : g.key)} onResults={() => setOpenId(openId === g.key ? null : g.key)} onChanged={() => void reload()}>
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
  onChanged,
  children,
  compact = false,
}: {
  hw: HomeworkOverviewRow;
  shareOpen: boolean;
  resultsOpen: boolean;
  onShare: () => void;
  onResults: () => void;
  onChanged: () => void;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
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
          {confirmDelete ? (
            <span className="flex flex-wrap items-center gap-1.5 rounded-full bg-error-container/40 px-3" role="alert">
              <span className="text-sm text-on-error-container">{t('studentHw.deleteConfirm')}</span>
              <button
                type="button"
                className={`${btn} bg-error text-on-error`}
                onClick={() =>
                  void deleteHomework(hw.id).then(
                    () => {
                      notify(t('studentHw.deleted'));
                      onChanged();
                    },
                    (e) => notify(t(teacherErrorKey(e)), 'error'),
                  )
                }
              >
                {t('studentHw.delete')}
              </button>
              <button type="button" className={`${btn} border border-outline-variant`} onClick={() => setConfirmDelete(false)}>
                {t('common.cancel')}
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className={`${btn} text-error hover:bg-error-container/40`}>
              <span className="material-symbols-outlined text-[18px]">delete</span>
              {t('studentHw.delete')}
            </button>
          )}
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
  onChanged,
}: {
  onChanged: () => void;
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
            onChanged={onChanged}
          >
            {renderOpen(hw)}
          </HomeworkCard>
        ))}
    </div>
  );
}
