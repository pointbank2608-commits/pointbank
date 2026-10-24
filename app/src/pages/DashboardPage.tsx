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
import '../styles/home-dashboard.css';
import AddActivityToLesson from '../components/AddActivityToLesson';
import type { WordList, CurriculumLesson, ClassRow } from '../lib/types';

const button = 'home-button';
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
  return <div className="home-dashboard" data-home-dashboard>
    <header className="home-heading"><div><h1>{t('quick.title')}</h1><p>{t('quick.subtitle')}</p></div><div className="home-create"><GameCreateButton /></div></header>
    <div className="home-launch-grid">
      <section className="home-launch home-launch-games" aria-labelledby="home-games-title">
        <div className="home-launch-copy"><h2 id="home-games-title">{t('quick.gameTitle')}</h2><p>{t('home.gameHint')}</p><Link to="/games" className={`${button} home-button-primary`}>{t('quick.chooseGame')} <span aria-hidden="true">→</span></Link></div>
        <img className="home-launch-art" src="/home/hero-games.webp" width={800} height={533} alt="" fetchPriority="high" decoding="async" />
      </section>
      <section className="home-launch home-launch-worksheet" aria-labelledby="home-worksheet-title"><div className="home-launch-copy"><h2 id="home-worksheet-title">{t('quick.worksheet')}</h2><p>{t('quick.worksheetHint')}</p><Link to="/materials" className={button}>{t('quick.chooseWorksheet')} <span aria-hidden="true">→</span></Link></div><img className="home-launch-art" src="/home/hero-worksheet.webp" width={480} height={480} alt="" decoding="async" /></section>
    </div>
    <section className="home-material-start" aria-labelledby="whiteboard-start-title" data-home-whiteboard><div><h2 id="whiteboard-start-title">{t('whiteboard.homeTitle')}</h2><p>{t('whiteboard.homeDesc')}</p></div><div className="home-actions"><Link className={`${button} home-button-primary`} to="/whiteboard">{t('whiteboard.homeOpen')} <span aria-hidden="true">→</span></Link></div></section>
    <section className="home-material-start" aria-labelledby="material-start-title"><div><h2 id="material-start-title">{t('flow.materialTitle')}</h2><p>{t('flow.materialSubtitle')}</p></div><div className="home-actions"><Link className={button} to="/wordlists" state={{createMaterialKind:'word'}}>{t('flow.createWords')}</Link><Link className={button} to="/wordlists" state={{createMaterialKind:'sentence'}}>{t('flow.createSentences')}</Link><Link className={button} to="/wordlists">{t('flow.loadMaterial')}</Link></div></section>
    <section className="home-recommended" aria-labelledby="recommend-title"><div className="home-section-heading"><h2 id="recommend-title">{t('quick.recommended')}</h2><Link to="/games" className="home-text-link">{t('quick.allGames')} <span aria-hidden="true">→</span></Link></div>
      <div className="home-game-grid">{recommended.map((type,index) => { const g = GAME_CATALOG.find(game => game.type === type)!; const locked = !hasFullAccess && !isFreeTierGame(g.type); return <article key={type} className="home-game-card">
        <img className="home-game-art" src={`/home/game-${type}.webp`} alt={t(`quick.${previews[index]}`)} width={640} height={400} loading="lazy" decoding="async" />
        <div className="home-game-copy"><h3>{t(g.nameKey)} {locked && <span className="home-lock" aria-label={t('nav.premiumPageBadge')}><svg aria-hidden="true" viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="7" width="10" height="7" rx="2"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg></span>}</h3><p>{t(`home.descriptions.${type}`)}</p><Link to={g.path} className={`${button} home-button-soft`} aria-label={`${t(g.nameKey)} · ${t('quick.start')}`}>{t('quick.start')} <span aria-hidden="true">→</span></Link></div>
      </article>; })}</div>
    </section>
    {error && <div role="alert" className="home-error">{t('quick.failed')} <button className={button} onClick={() => setRetry(n=>n+1)}>{t('quick.retry')}</button></div>}
    <div className={`home-lower-grid ${!groupOpen ? 'home-lower-single' : ''}`}>
      <section className="home-records" aria-labelledby="home-recent-title" aria-busy={loading}><div className="home-section-heading"><div><h2 id="home-recent-title">{t('home.recent')}</h2><p>{t('quick.recentHint')}</p></div><Link to="/wordlists" className="home-text-link">{t('quick.allLists')} <span aria-hidden="true">→</span></Link></div>
        {loading ? <p role="status" className="home-empty">{t('common.loading')}</p> : !error && !lists.length ? <div className="home-empty"><p>{t('quick.emptyLists')}</p><div className="home-actions"><Link to="/games/wheel" className={button}>{t('quick.sample')}</Link><Link to="/wordlists" className={button}>{t('quick.newList')}</Link></div></div> : lists.map(list => <div key={list.id} className="home-record"><div className="home-record-name"><h3>{list.name}</h3><p>{t(list.kind === 'sentence' ? 'quick.sentences' : 'quick.words')} · {t('quick.items', {count:list.items.length})}</p></div><div className="home-actions">
          <Link to="/games" state={{quickSource:{ownerId:session?.user.id,academyId:academy?.id,cards:wordListToCards(list),kind:list.kind || 'word',name:list.name,id:list.id}}} className={button}>{t('quick.otherGame')}</Link>
          <Link to="/materials/worksheet" state={{materialsOwnerId:session?.user.id,materialsAcademyId:academy?.id,materialsWords:wordListToCards(list),materialsKind:list.kind || 'word',materialsTab:'list'}} className={button}>{t('quick.worksheet')}</Link>
          {groupOpen && <button className={button} onClick={() => setAddList(list)}>{t('quick.addLesson')}</button>}
        </div></div>)}
      </section>
      {groupOpen && <section className="home-records" aria-labelledby="home-lessons-title" aria-busy={loading}><div className="home-section-heading"><div><h2 id="home-lessons-title">{t('quick.lessons')}</h2><p>{t('quick.lessonHint')}</p></div><div className="home-actions"><Link to="/curriculum" className="home-text-link">{t('quick.allLessons')} <span aria-hidden="true">→</span></Link><Link to="/curriculum" state={{openQuick:true}} className={button}>{t('quick.newLesson')}</Link></div></div>
        {loading ? <p role="status" className="home-empty">{t('common.loading')}</p> : !error && !lessons.length ? <p className="home-empty">{t('quick.emptyLessons')}</p> : lessons.map(lesson => <div key={lesson.id} className="home-record"><div className="home-record-name"><h3>{lesson.name}</h3><p>{t('quick.activities',{count:lesson.playlist.length})}</p></div><Link className={`${button} home-button-primary`} to="/curriculum" state={{focusClassId:lesson.class_id,startLessonId:lesson.id}}>{t('quick.continueLesson')}</Link></div>)}
        {classesToday(classes).map(cls => <p key={cls.id} className="home-schedule">{cls.name} · {shortTime(cls.schedule?.time || '')} <Link to="/curriculum" state={{focusClassId:cls.id}} className="home-text-link">{t('quick.lessons')} →</Link></p>)}
      </section>}
    </div>
    <section className="home-management"><h2>{t('quick.manage')}</h2><div className="home-actions">{[['/attendance','nav.attendance'],['/board','nav.board'],['/results','nav.reports'],['/settings','nav.settings']].map(([to,label]) => <Link key={to} to={to} className={button}>{t(label)}</Link>)}</div></section>
    {addList && <AddActivityToLesson source={{cards:wordListToCards(addList),kind:addList.kind || 'word',name:addList.name}} onClose={() => setAddList(null)} />}
  </div>;
}
