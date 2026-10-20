import GameCreateButton from '../components/GameCreateButton';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PENDING_SHARE_KEY } from './SharedLessonPage';
import { fetchAllWordLists, fetchAllCurriculumLessons, fetchClasses } from '../lib/api';
import { GAME_CATALOG, isFreeTierGame } from '../lib/gameCatalog';
import { wordListToCards } from '../lib/gameFromWords';
import { useFeature } from '../lib/features';
import { classesToday, shortTime } from '../lib/classSchedule';
import { recentSourceUses } from '../lib/quickActivity';
import ActivityPreview from '../components/ActivityPreview';
import AddActivityToLesson from '../components/AddActivityToLesson';
import type { WordList, CurriculumLesson, ClassRow } from '../lib/types';

const button = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/25 bg-white px-4 py-2 font-bold text-primary hover:bg-primary/5 focus-visible:outline-4 focus-visible:outline-primary';
const recommended = ['wheel', 'matchup', 'unscramble', 'treasuredig'];
const previews = ['previewWheel', 'previewMatch', 'previewSentence', 'previewDig'];
export default function DashboardPage() {
  const { t } = useTranslation();
  const { academy, session, hasFullAccess } = useAuth();
  const navigate = useNavigate();
  const groupOpen = useFeature('group');
  const [lists, setLists] = useState<WordList[]>([]);
  const [lessons, setLessons] = useState<CurriculumLesson[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [addList, setAddList] = useState<WordList | null>(null);
  useEffect(() => {
    try { const pending = localStorage.getItem(PENDING_SHARE_KEY); if (pending) { localStorage.removeItem(PENDING_SHARE_KEY); navigate(`/share/${pending}`, { replace: true }); } } catch { /* storage unavailable */ }
  }, [navigate]);
  useEffect(() => {
    let active = true;
    setLists([]); setLessons([]); setClasses([]); setLoading(true); setError(false);
    if (!academy) { setLoading(false); return; }
    Promise.all([fetchAllWordLists(academy.id, 'all'), groupOpen ? fetchAllCurriculumLessons(academy.id) : Promise.resolve([]), fetchClasses(academy.id)])
      .then(([words, units, groups]) => { if (!active) return; const uses = recentSourceUses(session?.user.id, academy.id); setLists([...words].sort((a,b) => (uses[b.id] || 0) - (uses[a.id] || 0) || b.updated_at.localeCompare(a.updated_at)).slice(0,3)); setLessons(units.slice(0,3)); setClasses(groups); })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [academy, session?.user.id, groupOpen, retry]);
  return <div className="space-y-7">
    <div className="flex flex-wrap items-center justify-between gap-4"><GameCreateButton /></div>
    <header><h1 className="text-[clamp(1.7rem,3vw,2.5rem)] font-black tracking-tight text-deep-navy">{t('quick.title')}</h1><p className="mt-2 text-lg text-on-surface-variant">{t('quick.subtitle')}</p></header>
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/15 to-sky-50 p-6 sm:p-8 lg:col-span-2">
        <span aria-hidden className="text-4xl">🎮</span>
        <h2 className="mt-2 text-2xl font-black text-deep-navy">{t('quick.gameTitle')}</h2><p className="my-3 text-lg">{t('quick.gameHint')}</p>
        <Link to="/games" className={`${button} border-0 bg-primary! px-7 text-white!`}>{t('quick.chooseGame')} →</Link><p className="mt-3 text-sm text-on-surface-variant">{t('quick.gameFirst')}</p>
      </section>
      <section className="rounded-3xl bg-amber-100 p-6 sm:p-8"><span aria-hidden className="text-4xl">📝</span><h2 className="mt-2 text-2xl font-black text-deep-navy">{t('quick.worksheet')}</h2><p className="my-3">{t('quick.worksheetHint')}</p><Link to="/materials" className={button}>{t('quick.chooseWorksheet')} →</Link></section>
    </div>
    <section className="space-y-3 rounded-2xl border border-outline-variant bg-white p-5" aria-labelledby="material-start-title"><h2 id="material-start-title" className="text-xl font-extrabold">{t('flow.materialTitle')}</h2><p className="text-on-surface-variant">{t('flow.materialSubtitle')}</p><div className="flex flex-wrap gap-2"><Link className={button} to="/wordlists" state={{createMaterialKind:'word'}}>{t('flow.createWords')}</Link><Link className={button} to="/wordlists" state={{createMaterialKind:'sentence'}}>{t('flow.createSentences')}</Link><Link className={button} to="/wordlists">{t('flow.loadMaterial')}</Link></div></section>
    <section aria-labelledby="recommend-title"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 id="recommend-title" className="text-2xl font-extrabold text-deep-navy">{t('quick.recommended')}</h2><Link to="/games" className={button}>{t('quick.allGames')} →</Link></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{recommended.map((type,index) => { const g = GAME_CATALOG.find(game => game.type === type)!; const locked = !hasFullAccess && !isFreeTierGame(g.type); return <article key={type} className="overflow-hidden rounded-2xl border border-outline-variant/50 bg-white shadow-card">
        <ActivityPreview type={type} label={t(`quick.${previews[index]}`)} />
        <div className="flex min-h-48 flex-col p-4"><h3 className="text-lg font-bold">{t(g.nameKey)} {locked && <span className="text-sm" aria-label={t('nav.premiumPageBadge')}>🔒</span>}</h3><p className="mt-1 flex-1 text-on-surface-variant">{t(g.descKey)}</p><Link to={g.path} className={button} aria-label={`${t(g.nameKey)} · ${t('quick.start')}`}>{t('quick.start')}</Link></div>
      </article>; })}</div>
    </section>
    {error && <div role="alert" className="rounded-xl bg-error-container p-4">{t('quick.failed')} <button className={button} onClick={() => setRetry(n=>n+1)}>{t('quick.retry')}</button></div>}
    <section className="space-y-3 rounded-2xl bg-emerald-50 p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-extrabold text-deep-navy">{t('quick.reuse')}</h2><p className="mt-1 text-sm text-on-surface-variant">{t('quick.recentHint')}</p></div><Link to="/wordlists" className={button}>{t('quick.allLists')}</Link></div>
      {loading ? <p role="status">{t('common.loading')}</p> : !error && !lists.length ? <div className="space-y-3 rounded-xl bg-white p-4"><p>{t('quick.emptyLists')}</p><Link to="/games/wheel" className={button}>{t('quick.sample')}</Link> <Link to="/wordlists" className={button}>{t('quick.newList')}</Link></div> : lists.map(list => <div key={list.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4"><div><h3 className="font-bold">{list.name}</h3><p className="text-sm text-on-surface-variant">{t('quick.items', {count:list.items.length})} · {t(list.kind === 'sentence' ? 'quick.sentences' : 'quick.words')}</p></div><div className="flex flex-wrap gap-2">
        <Link to="/games" state={{quickSource:{ownerId:session?.user.id,academyId:academy?.id,cards:wordListToCards(list),kind:list.kind || 'word',name:list.name,id:list.id}}} className={button}>{t('quick.otherGame')}</Link>
        <Link to="/materials/worksheet" state={{materialsOwnerId:session?.user.id,materialsAcademyId:academy?.id,materialsWords:wordListToCards(list),materialsKind:list.kind || 'word',materialsTab:'list'}} className={button}>{t('quick.worksheet')}</Link>
        {groupOpen && <button className={button} onClick={() => setAddList(list)}>{t('quick.addLesson')}</button>}
      </div></div>)}
    </section>
    {groupOpen && <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-extrabold text-deep-navy">{t('quick.lessons')}</h2><p className="mt-1 text-on-surface-variant">{t('quick.lessonHint')}</p></div><div className="flex gap-2"><Link to="/curriculum" className={button}>{t('quick.allLessons')}</Link><Link to="/curriculum" state={{openQuick:true}} className={button}>{t('quick.newLesson')}</Link></div></div>
      {loading ? <p role="status">{t('common.loading')}</p> : !error && !lessons.length ? <p className="rounded-xl border p-4">{t('quick.emptyLessons')}</p> : lessons.map(lesson => <div key={lesson.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-white p-4"><div><h3 className="font-bold">{lesson.name}</h3><p className="text-sm text-on-surface-variant">{t('quick.activities',{count:lesson.playlist.length})}</p></div><Link className={button} to="/curriculum" state={{focusClassId:lesson.class_id,startLessonId:lesson.id}}>{t('quick.continueLesson')}</Link></div>)}
      {classesToday(classes).map(cls => <p key={cls.id} className="rounded-lg bg-surface-container-low p-3">{cls.name} · {shortTime(cls.schedule?.time || '')} <Link to="/curriculum" state={{focusClassId:cls.id}} className="ml-3 font-bold text-primary">{t('quick.lessons')} →</Link></p>)}
    </section>}
    <section className="rounded-2xl border border-outline-variant p-4"><h2 className="mb-3 font-bold">{t('quick.manage')}</h2><div className="flex flex-wrap gap-2">{[['/attendance','nav.attendance'],['/board','nav.board'],['/results','nav.reports'],['/settings','nav.settings']].map(([to,label]) => <Link key={to} to={to} className={button}>{t(label)}</Link>)}</div></section>
    {addList && <AddActivityToLesson source={{cards:wordListToCards(addList),kind:addList.kind || 'word',name:addList.name}} onClose={() => setAddList(null)} />}
  </div>;
}
