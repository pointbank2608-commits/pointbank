import { formatHomeworkDeadline } from '../lib/homework/deadline';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WordMemoryResults from '../components/wordMemory/WordMemoryResults';
import { toWmError, wmPlanList } from '../lib/wordMemory/api';
import type { WmPlanSummary } from '../lib/wordMemory/types';
import WordProjectHomework from '../components/wordMemory/WordProjectHomework';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../styles/homework-studio.css';
import ClassChipRow from '../components/ClassChipRow';
import HomeworkResults from '../components/homework/teacher/HomeworkResults';
import HomeworkSharePanel from '../components/homework/teacher/HomeworkSharePanel';
import HomeworkBlockEditor from '../components/homework/teacher/HomeworkBlockEditor';
import PublishedHomeworkDialog from '../components/homework/teacher/PublishedHomeworkDialog';
import type { CheckType } from '../lib/homework/guided';
import HomeworkComposer from '../components/homework/teacher/HomeworkComposer';
import MaterialHomeworkComposer from '../components/homework/teacher/MaterialHomeworkComposer';
import AdaptiveHomeworkComposer from '../components/homework/teacher/AdaptiveHomeworkComposer';
import AdaptiveHomeworkResults from '../components/homework/teacher/AdaptiveHomeworkResults';
import GrammarTeacherPanel from '../components/grammar/GrammarTeacherPanel';
import { useFeature } from '../lib/features';
import type { HwItemDraft } from '../lib/homework/types';
import LearningCardModal from '../components/homework/teacher/LearningCardModal';
import RecommendReview from '../components/homework/teacher/RecommendReview';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchStudentsOfClass } from '../lib/api';
import { deleteHomework, fetchHomeworkOverview, fetchHomeworkUsage, materialWorkloadLabel, teacherErrorKey, type HomeworkOverviewRow } from '../lib/homework';
import type { FullCardItem, Student } from '../lib/types';
import { useClasses } from '../lib/useClasses';

type Panel =
  | { k: 'none' }
  | { k: 'adaptive' }
  | { k: 'wordProject' }
  | { k: 'compose'; mode?:'lesson'|'list'; studentIds?:string[]; cards?:FullCardItem[]; title?:string; lessonId?:string; followUp?:{studentId:string;type:CheckType} }
  | { k: 'editor'; items?: HwItemDraft[]; title?: string; lessonId?: string; importLesson?: boolean; studentIds?: string[] | null; due?: string; draftScope?: string }
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
  const [adaptiveState,setAdaptiveState]=useState<Record<string,'empty'|'present'|'error'>>({});
  const onAdaptiveAvailability=useCallback((id:string,state:'empty'|'present'|'error')=>{
    setAdaptiveState(old=>old[id]===state?old:{...old,[id]:state});
  },[]);
  const en=i18n.language.startsWith('en');
  const { notify } = useToast();
  const { classes, selectedId, select, reorder, loading:classesLoading, error:classesError, reload:reloadClasses } = useClasses(academy?.id);
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
  const materialComposer = panel.k === 'compose' && panel.mode !== 'lesson' && !panel.lessonId &&
    !panel.cards && !panel.followUp && !panel.studentIds;
  const [wordProjectRevision, setWordProjectRevision] = useState(0);
  const [wordPlans,setWordPlans] = useState<{classId:string; plans:WmPlanSummary[]; error:boolean} | null>(null);
  const projectLocation = location.state as { wmPlanId?: string; fromClassId?: string } | null;
  const openPlanId = !projectLocation?.fromClassId || projectLocation.fromClassId === classId ? projectLocation?.wmPlanId : undefined;
  useEffect(() => {
    if (openPlanId) setPanel({ k: 'none' });
  }, [openPlanId, location.key]);
  const [shareId, setShareId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cardStudent, setCardStudent] = useState<string | null>(null);
  const [sent, setSent] = useState<{classId:string; id?:string; count?:number; existing?:boolean} | null>(null);
  const [usage, setUsage] = useState<number | null>(null);

  const reload = useCallback(async () => {
    const sequence=++loadSequence.current;
    if (!classId) return;
    void wmPlanList(classId).then(plans=>{
      if(sequence===loadSequence.current)setWordPlans({classId,plans,error:false});
    },cause=>{
      if(sequence===loadSequence.current)setWordPlans(old=>({classId,plans:old?.classId===classId?old.plans:[],error:!['feature_closed','not_found'].includes(toWmError(cause).kind)}));
    });
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
      setList(old=>old ?? []);
    }
  }, [classId, t]);
  useEffect(()=>{
    if (panel.k !== 'none' || !classId) return;
    const refresh = () => { if(document.visibilityState==='visible') void reload(); };
    const timer = window.setInterval(refresh,15000);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);
    return ()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[classId,panel.k,reload]);
  const sentCount = sent?.classId!==classId ? undefined : sent?.id ? (loadedClass===classId ? list?.find(row=>row.id===sent.id)?.target_count : undefined) : sent?.count;
  useEffect(()=>{
    if (sentCount==null && !sent?.existing) return;
    const timeout = window.setTimeout(()=>setSent(null),4500);
    return ()=>window.clearTimeout(timeout);
  },[sent,sentCount]);
  function publicationChanged(newId?: string) {
    if (newId) {
      setOpenId(null);
      setShareId(newId);
    }
    void reload();
  }

  useEffect(() => {
    setList(null);
    setError(null);
    setPanel({ k: 'none' });
    setShareId(null);
    setOpenId(null);
    void reload();
  }, [reload]);
  useEffect(()=>{
    if(openPlanId)setOpenId(openPlanId);
  },[openPlanId,location.key]);

  // 이번 달 온라인 숙제를 시작한 학생 수(안내용 — 요금·제한과 연결되지 않음)
  useEffect(() => {
    const now = new Date();
    fetchHomeworkUsage(new Date(now.getFullYear(), now.getMonth(), 1), now).then(
      (u) => setUsage(u.active_students),
      () => setUsage(null),
    );
  }, [academy?.id]);

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

  const register = useMemo(()=>{
    const current = loadedClass===classId ? groups : [];
    const words = wordPlans?.classId===classId ? wordPlans.plans : [];
    return [...current.map(group=>({key:group.key,created:group.rows[0].created_at,group,plan:null as WmPlanSummary|null})),
      ...words.map(plan=>({key:plan.id,created:plan.created_at,group:null as typeof groups[number]|null,plan}))].sort((a,b)=>Date.parse(b.created)-Date.parse(a.created));
  },[groups,wordPlans,loadedClass,classId]);

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
    const st = location.state as { fromLessonId?: string; fromClassId?: string; pickedCards?: FullCardItem[]; pickedTitle?: string; personalGame?:{cards:FullCardItem[];name:string}; recordingLesson?:{title:string;items:HwItemDraft[]} } | null;
    if (!classId) return;
    if (st?.fromClassId && classId !== st.fromClassId) { select(st.fromClassId); return; }
    if (st?.recordingLesson?.items.length) {
      setPanel({k:'editor',items:st.recordingLesson.items,title:st.recordingLesson.title});
      navigate(location.pathname,{replace:true,state:null});
      return;
    }
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
    <div className="hw-management">
      {!materialComposer && <>
        <nav className="hw-breadcrumb" aria-label={en?'Breadcrumb':'현재 위치'}><span>{en?'My classes':'우리 반'}</span><span aria-hidden>›</span><span>{en?'Homework':'숙제'}</span></nav>
        <div className="hw-management-heading"><h1>{en?'Homework':'숙제'}</h1>
          {panel.k==='none' && <button type="button" className="hw-forward" disabled={!classId} onClick={()=>setPanel({k:'compose'})}><span aria-hidden>＋</span>{en?'New homework':'새 숙제 내기'}</button>}</div>
        {classes.length>0 && <ClassChipRow classes={classes} selectedId={classId} onSelect={select} onReorder={reorder}/>}
      </>}
      {panel.k==='none' && sent?.classId===classId && (sentCount!=null || sent.existing) && <div className="hw-sent-toast" role="status"><span aria-hidden>✓</span>
        {sent.existing ? t('materialHomework:projectExists') : t('materialHomework:sentCount',{n:sentCount})}
        <button type="button" aria-label={en?'Close':'닫기'} onClick={()=>setSent(null)}>×</button></div>}
      {error && <div role="alert" className="hw-studio-issue">{error} <button onClick={()=>void reload()}>{en?'Retry':'다시 불러오기'}</button></div>}
      {classesError && <p role="alert">{en?'Could not load the class list.':'반 목록을 불러오지 못했어요.'} <button type="button" onClick={()=>void reloadClasses()}>{en?'Retry':'다시 불러오기'}</button></p>}
      {panel.k==='adaptive'&&classId&&academy?.id&&<AdaptiveHomeworkComposer key={classId} academyId={academy.id} classId={classId} onClose={()=>setPanel({k:'none'})} onCreated={()=>{setPanel({k:'none'});setAdaptiveRevision(n=>n+1);notify(en?'Homework assigned. Students can start from their portal.':'숙제를 배정했어요. 학생 홈의 숙제에서 시작할 수 있어요.');}}/>}
      {panel.k === 'wordProject' && classId && academy?.id && homeworkOpen && (
        <WordProjectHomework
          key={classId}
          academyId={academy.id}
          classId={classId}
          onClose={() => setPanel({ k: 'none' })}
          onAssigned={() => {setWordProjectRevision(revision=>revision+1);void reload();}}
        />
      )}

      {materialComposer && classId && academy?.id && profile && <MaterialHomeworkComposer
        key={classId} classId={classId} classes={classes} academyId={academy.id} ownerId={profile.id}
        students={classId === loadedClass ? students : []} onClose={() => setPanel({ k: 'none' })}
        onCreated={async (result,targetClass)=>{
          setPanel({k:'none'}); setShareId(null); setOpenId(null);
          setSent({classId:targetClass,id:result.assignment?.id,count:result.project?.created,existing:!result.assignment&&!result.project?.created});
          if(result.project) setWordProjectRevision(n=>n+1);
          if(targetClass!==classId) select(targetClass); else await reload();
        }}
      />}
      {panel.k==='compose'&&!materialComposer&&classId&&academy?.id&&profile&&<HomeworkComposer
        key={`${classId}:${panel.lessonId||panel.mode||'new'}:${panel.cards?.length||0}`}
        academyId={academy.id} ownerId={profile.id} classId={classId} className={className}
        initialLessonId={panel.lessonId} initialMode={panel.mode} initialStudents={panel.studentIds} followUp={panel.followUp} initialCards={panel.cards} initialTitle={panel.title}
        onSwitch={!panel.lessonId&&!panel.cards&&!panel.followUp&&!panel.studentIds?kind=>setPanel({k:kind}):undefined} adaptiveEnabled={soloOpen}
        onGrammarReview={({scope, ...draft})=>setPanel({k:'editor',draftScope:scope,...draft})}
        onClose={()=>setPanel({k:'none'})}
        onCreated={async hw=>{setPanel({k:'none'});notify(t('studentHw.created'));await reload();setShareId(hw.id);}}
      />}

      {panel.k === 'editor' && classId && academy?.id && profile && <HomeworkBlockEditor
        key={`${classId}-${panel.draftScope ?? panel.lessonId ?? ''}`} academyId={academy.id} classId={classId} ownerId={profile.id}
        initialItems={panel.items} initialTitle={panel.title} lessonId={panel.lessonId}
        draftScope={panel.draftScope}
        startWithLessonImport={panel.importLesson}
        initialStudentIds={panel.studentIds} initialDue={panel.due}
        classOptions={classes.filter((c) => c.id !== classId).map((c) => ({ id: c.id, name: c.name }))}
        onClose={() => setPanel({ k: 'none' })}
        onCreated={async (hw) => { setPanel({ k: 'none' }); await reload(); setShareId(hw.id); }}
      />}

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

      {panel.k==='none' && <>
        {wordPlans?.classId===classId && wordPlans?.error && <p role="alert">{en?'Could not load vocabulary homework.':'단어 프로젝트를 불러오지 못했어요.'} <button type="button" onClick={()=>void reload()}>{en?'Retry':'다시 불러오기'}</button></p>}
        {classesLoading || (classId && !error && (list===null || loadedClass!==classId || wordPlans?.classId!==classId)) ? <p role="status">{t('common.loading')}</p> :
        !register.length ? (!classesError && !error && !wordPlans?.error && (!classId || adaptiveState[classId]==='empty') && <div className="hw-empty"><span className="material-symbols-outlined" aria-hidden>assignment</span>
          <strong>{en?'No homework yet.':'아직 등록된 숙제가 없습니다.'}</strong><p>{en?'Create homework and send it to your students.':'새 숙제를 만들어 학생들에게 보내보세요.'}</p>
          <button type="button" className="hw-forward" disabled={!classId} onClick={()=>setPanel({k:'compose'})}>＋ {en?'New homework':'새 숙제 내기'}</button></div>) :
          <div className="hw-table-wrap"><table className="hw-register"><colgroup><col/><col/><col/><col/></colgroup>
            <thead><tr><th>{en?'Homework title':'숙제명'}</th><th>{en?'Due':'마감'}</th><th>{en?'Completion':'완료 현황'}</th><th>{en?'Results':'결과'}</th></tr></thead>
            <tbody>{register.map(({group:g,plan})=>g ? (g.rows.length>1 ? <CustomGroup key={g.key} rows={g.rows} onChanged={publicationChanged} shareId={shareId} openId={openId} setShareId={setShareId} setOpenId={setOpenId} renderOpen={renderPanels}/> :
                <HomeworkCard key={g.key} hw={g.rows[0]} shareOpen={shareId===g.rows[0].id} resultsOpen={openId===g.rows[0].id}
                  onShare={()=>setShareId(shareId===g.rows[0].id ? null : g.rows[0].id)} onResults={()=>setOpenId(openId===g.rows[0].id ? null : g.rows[0].id)} onChanged={publicationChanged}>
                  {renderPanels(g.rows[0])}
                </HomeworkCard>) : plan && <Fragment key={plan.id}>
              <tr className="hw-register-entry"><td><strong>{plan.title || t('wordMemory.title')}</strong></td><td>—</td><td>{en?'Today':'오늘 완료'} {plan.today_done}/{plan.students}</td>
                <td><button className="hw-result" type="button" aria-expanded={openId===plan.id} onClick={()=>setOpenId(openId===plan.id?null:plan.id)}>{en?'Results':'결과'}</button></td></tr>
              {openId===plan.id && classId && <tr className="hw-register-detail"><td colSpan={4}><WordMemoryResults key={wordProjectRevision} classId={classId} onlyPlanId={plan.id} initialPlanId={plan.id} onDeleted={()=>{setOpenId(null);void reload();}}/></td></tr>}
            </Fragment>)}</tbody></table></div>}
      {classId && <AdaptiveHomeworkResults key={`adaptive-${classId}`} classId={classId} revision={adaptiveRevision} onAvailability={onAdaptiveAvailability}/> }

        <details className="hw-other-tools"><summary>{en?'More homework tools':'다른 숙제 도구'}</summary><div>
          <button type="button" disabled={!classId||!students.length} onClick={()=>setPanel({k:'recommend',studentIds:students.map(s=>s.id),gamesOnly:true})} className={`${headerBtn} bg-deep-navy text-white`}>{i18n.language.startsWith('en')?'Personal game practice':'학생별 맞춤 게임'}</button>
          <button type="button" onClick={() => startRecommend([])} disabled={!classId} className={`${headerBtn} border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low disabled:opacity-40`}>
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            {t('studentHw.checkRecommend')}
          </button>

      {panel.k==='none'&&classId&&<div className="hw-source-choices rounded-2xl border border-outline-variant bg-white p-5">
        <button type="button" onClick={()=>setPanel({k:'compose',mode:'lesson'})}><span className="material-symbols-outlined" aria-hidden>school</span><strong>{i18n.language.startsWith('en')?'Review a lesson':'오늘 수업 복습시키기'}</strong><span>{i18n.language.startsWith('en')?'Choose a saved lesson and collect its learning content.':'만든 수업을 고르면 단어·표현을 한 번에 모아요.'}</span></button>
        <button type="button" onClick={()=>setPanel({k:'compose',mode:'list'})}><span className="material-symbols-outlined" aria-hidden>style</span><strong>{i18n.language.startsWith('en')?'Learn words and expressions':'단어·문장 외우게 하기'}</strong><span>{i18n.language.startsWith('en')?'Use your collections to build a practice routine.':'내 단어장·문장 모음으로 반복 학습을 만들어요.'}</span></button>
      </div>}

          {classId && <><button type="button" className={headerBtn} disabled={!soloOpen} onClick={()=>setPanel({k:'adaptive'})}>{t('materialHomework:adaptive')}</button>
          <button type="button" className={headerBtn} onClick={()=>setPanel({k:'wordProject'})}>{t('materialHomework:project')}</button></>}
      {panel.k === 'none' && classId && soloOpen && homeworkOpen && <GrammarTeacherPanel classId={classId} mode="homework" />}
          {usage!==null && <p>{t('studentHw.usageNote',{count:usage})}</p>}
        </div></details>
      </>}
      {cardStudent && <LearningCardModal studentId={cardStudent} onClose={() => setCardStudent(null)} onRecommend={(id) => startRecommend([id])} />}
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
            onPrepareGuided={(studentId,cards,type) => {
              setOpenId(null);
              setPanel({ k: 'compose', cards, title: en?'Follow-up practice':'보충 연습', followUp:{studentId,type} });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onMakeHomework={({ studentIds, cards, title }) => {
              setPanel({ k: 'compose', studentIds, cards, title });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </>
    );
  }
}

function DueStatus({due,en}:{due:string|null;en:boolean}) {
  if (!due) return <>—</>;
  if (new Date(due).getTime() < Date.now()) return <span className="hw-overdue">{en?'Past due':'마감 지남'}</span>;
  return <>{formatHomeworkDeadline(due,en?'en':'ko')}</>;
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
  onChanged: (newId?: string) => void;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { notify } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [publicationMode, setPublicationMode] = useState<'edit'|'reissue'|null>(null);
  const en = i18n.language.startsWith('en');
  const btn = 'min-h-10 text-left';
  return <>
    <tr className="hw-register-entry">
      <td><strong>{compact && hw.custom_student ? hw.custom_student : hw.title || t('studentHw.defaultTitle')}</strong>
        {hw.closed_at && <small>{t('studentHw.closed')}</small>}</td>
      <td><DueStatus due={hw.due_at} en={en}/></td>
      <td>{en?'Done':'완료'} {hw.done}/{hw.target_count}</td>
      <td><div className="hw-table-actions">
        <button type="button" className="hw-result" aria-expanded={resultsOpen} onClick={onResults}>{en?'Results':'결과'}</button>
        <details className="hw-row-menu"><summary aria-label={en?'More homework actions':'숙제 더보기'}>⋮</summary><div>
          <p>{t('studentHw.code')} {hw.code} · {t('studentHw.avgScore')} {hw.avg_pct==null?'–':Math.round(hw.avg_pct)+'%'}</p>
          <p>{hw.material_workload ? materialWorkloadLabel(hw.material_workload,en) : t('studentHw.questionCount',{count:hw.question_count})}</p>
          <button type="button" className={btn} onClick={()=>setPublicationMode('edit')}>{en?'Edit':'수정'}</button>
          <button type="button" className={btn} onClick={()=>setPublicationMode('reissue')}>{en?'Reissue':'재발행'}</button>
          <button type="button" className={btn} aria-expanded={shareOpen} onClick={onShare}>{t('studentHw.share')}</button>
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
        </div></details></div></td>
    </tr>
    {(shareOpen||resultsOpen) && <tr className="hw-register-detail"><td colSpan={4}>{children}</td></tr>}
    {publicationMode && <PublishedHomeworkDialog id={hw.id} initialMode={publicationMode} onClose={()=>setPublicationMode(null)} onSaved={(newId,code)=>{
      setPublicationMode(null); notify(newId ? (en?`Homework reissued. New code: ${code}`:`재발행했어요. 새 숙제 번호는 ${code}예요.`) : en?'Changes saved.':'숙제를 수정했어요.');onChanged(newId);
    }}/>}
  </>;
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
  onChanged: (newId?: string) => void;
  rows: HomeworkOverviewRow[];
  shareId: string | null;
  openId: string | null;
  setShareId: (id: string | null) => void;
  setOpenId: (id: string | null) => void;
  renderOpen: (hw: HomeworkOverviewRow) => React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const done = rows.reduce((sum,row)=>sum+row.done,0);
  const targets = rows.reduce((sum,row)=>sum+row.target_count,0);
  return (
    <>
      <tr className="hw-register-entry"><td>{t('studentHw.customGroup',{count:rows.length})}</td><td><DueStatus due={rows[0].due_at} en={i18n.language.startsWith('en')}/></td>
        <td>{t('studentHw.doneCount')} {done}/{targets}</td><td><button type="button" className="hw-result" aria-expanded={open} onClick={()=>setOpen(o=>!o)}>{t('studentHw.results')}</button></td></tr>
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
    </>
  );
}
