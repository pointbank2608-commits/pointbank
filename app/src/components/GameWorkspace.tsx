import GameSetupGuide from './GameSetupGuide';
import '../teacherGames.css';
import { guideProblem } from '../lib/gameGuide';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { GameWorkspaceContext, useGameWorkspace, type GameWorkspaceBridge } from '../context/GameWorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { usePresenting } from '../context/LessonRunnerContext';
import { GAME_CATALOG, isFreeTierGame } from '../lib/gameCatalog';
import { activityName as defaultActivityName } from '../lib/activityNames';
import { demoForGame } from '../lib/gameDemos';
import { GameMethodVideo } from './GameInfoPanel';
import { gamePreparation, gameReadyDetails, isNativeGameReady } from '../lib/gamePreparation';
import { prepareClassroomGame, classroomGameRequirement } from '../lib/gameWorkspace';
import { isActivityDraft, sampleActivityCards } from '../lib/quickActivity';
import { pauseGameClock } from '../lib/gameClock';
import { loadTeamOrder, saveTeamOrder, TEAM_ORDER_EVENT, turnLabels } from '../lib/teamOrder';
import { useFeature } from '../lib/features';
import TeamOrderPanel from './TeamOrderPanel';
import AddActivityToLesson from './AddActivityToLesson';

type Panel = 'settings' | 'content' | 'games' | 'teacher' | 'video' | 'guide' | null;
const EMPTY_ROSTER: import('../lib/types').GameItem[] = [];
const btn = 'min-h-11 rounded-xl border border-outline-variant bg-white px-4 py-2 text-base font-bold text-deep-navy focus-visible:outline-4 focus-visible:outline-primary disabled:opacity-40';
export default function GameWorkspace({ children }: { children: ReactNode }) {
  const { isStaff } = useAuth();
  // Student play retains its existing read-only game route.
  return isStaff ? <TeacherGameWorkspace>{children}</TeacherGameWorkspace> : <>{children}</>;
}
function TeacherGameWorkspace({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { hasFullAccess, session, academy } = useAuth();
  const presenting = usePresenting();
  const groupOpen = useFeature('group');
  const navigate = useNavigate();
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [teacherToolsTarget, setTeacherToolsTarget] = useState<HTMLDivElement | null>(null);
  const [info, setInfo] = useState<GameWorkspaceBridge | null>(null);
  const bridge = useRef<GameWorkspaceBridge | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [guideNative,setGuideNative]=useState(false);
  const guideOpened=useRef('');
  const [playing, setPlaying] = useState(false);
  const [fullscreen,setFullscreen]=useState(false);
  const [running, setRunning] = useState(false);
  const [teams, setTeams] = useState(false);
  const [absent, setAbsent] = useState<string[]>([]);
  const [ordered, setOrdered] = useState(false);
  const [participantText, setParticipantText] = useState('');
  const [revision, setRevision] = useState(0);
  const [hasBoard, setHasBoard] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [addLesson, setAddLesson] = useState(false);
  const [activityName, setActivityName] = useState('');
  const [saveOriginal, setSaveOriginal] = useState(false);
  const [materialName, setMaterialName] = useState('');
  const [sampleRequested,setSampleRequested]=useState(false);
  const sampleFromId=useRef<string|null|undefined>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const owner = useRef(crypto.randomUUID());
  const identity = `${session?.user.id}:${info?.academyId}:${info?.classId}:${info?.gameType}`;
  const participantKey = `classbank:participants:${session?.user.id}:${academy?.id}`;
  const scope = `${session?.user.id}:${academy?.id}`;
  const capabilities = gamePreparation(info?.gameType || 'wheel');
  const source = info?.selected?.config.classroomSource;
  const sourceKind = source?.kind || (capabilities.kinds[0] || 'word');
  const reuseLabel = source || capabilities.kinds.length
    ? sourceKind === 'sentence' ? 'teacherGame.moreSentences' : 'teacherGame.moreWords'
    : 'teacherGame.moreContent';
  const sourceReady = !source || (!!info && !!prepareClassroomGame(info.gameType, source.cards, source.kind));
  const requirement = source && info && !sourceReady ? classroomGameRequirement(info.gameType, source.kind) : { key:'quick.needFormat', count:0 };
  const canStart = !!info && info.academyId===academy?.id && !info.loading && hasBoard && !!info.selected && isNativeGameReady(info.selected) && !guideProblem(info.selected) && sourceReady;
  const publish = useCallback((next: GameWorkspaceBridge) => {
    bridge.current = next;
    setInfo(old => old && old.gameType === next.gameType && old.sharedView === next.sharedView && old.classId === next.classId && old.selected === next.selected && old.roster === next.roster && old.lists === next.lists && old.templates === next.templates && old.loading === next.loading && old.classes === next.classes ? old : next);
  }, []);
  useEffect(() => { setRunning(false); setPlaying(false); setAbsent([]); setPanel(null); setSampleRequested(false); }, [identity]);
  useEffect(() => { setRunning(false); setPlaying(false); }, [info?.selected?.id]);
  useEffect(() => { setSaveOriginal(false); setMaterialName(''); }, [info?.selected?.id]);
  useEffect(()=>{if(!presenting&&info&&!info.loading&&info.temporary&&info.selected&&isActivityDraft(info.selected.id)&&guideOpened.current!==identity){guideOpened.current=identity;setPanel('guide');}},[info,identity,presenting]);
  useEffect(() => {
    try { setParticipantText(sessionStorage.getItem(participantKey) || ''); } catch { setParticipantText(''); }
    setOrdered(false);
  }, [participantKey]);
  useEffect(() => {
    const token = owner.current;
    pauseGameClock(token, !running || !!panel || teams);
    return () => pauseGameClock(token, false);
  }, [running, panel, teams]);
  useEffect(() => {
    if (!stage) return;
    const check = () => setHasBoard(!!stage.querySelector('[data-game]'));
    const observer = new MutationObserver(check); observer.observe(stage, { childList: true, subtree: true }); check();
    return () => observer.disconnect();
  }, [stage]);
  useEffect(() => {
    const d = dialog.current; if (!d) return;
    if (panel && !d.open) d.showModal(); else if (!panel && d.open) d.close();
  }, [panel]);
  useEffect(() => {
    const update = () => setRevision(value => value + 1);
    window.addEventListener(TEAM_ORDER_EVENT, update);
    return () => window.removeEventListener(TEAM_ORDER_EVENT, update);
  }, []);
  useEffect(() => {
    if (!playing || presenting) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; document.documentElement.dataset.gameFocus = 'true';
    const chrome = Array.from(document.querySelectorAll<HTMLElement>('[data-app-chrome]'));
    const previousInert = chrome.map(node => node.inert); chrome.forEach(node => { node.inert = true; });
    return () => { document.body.style.overflow = previousOverflow; delete document.documentElement.dataset.gameFocus; chrome.forEach((node,index) => { node.inert = previousInert[index]; }); };
  }, [playing, presenting]);
  const allRoster = useMemo(() => participantText.trim() ? participantText.split(/\r?\n/).map(name=>name.trim()).filter(Boolean).map((label,index)=>({id:`temporary:${scope}:${index}`,label})) : info?.roster.length ? info.roster : [t('flow.participant',{n:1}),t('flow.participant',{n:2})].map((label,index)=>({id:`temporary:${scope}:${index}`,label})), [info?.roster, participantText, scope, t]);
  const roster = useMemo(() => allRoster.filter(row => !absent.includes(row.id)), [allRoster, absent]);
  const order = useMemo(() => { void revision; return loadTeamOrder(roster, scope); }, [roster, scope, revision]);
  const turnClick = useRef(0);
  const advance = useCallback(() => {
    const now = Date.now(); if (now - turnClick.current < 250 || order.order.length < 2) return false;
    turnClick.current = now; saveTeamOrder(roster, { ...order, turn:(order.turn + 1) % order.order.length }, scope); return true;
  }, [roster, order, scope]);
  const labels = turnLabels(order, roster, n => t('teamOrder.teamLabel',{n}));
  const turn = capabilities.manualTurns && ordered && labels ? { ...labels, index:order.turn, total:order.order.length, advance } : null;
  async function action(fn: () => Promise<void>, close = true) {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError('');
    try { await fn(); if (close) setPanel(null); return true; }
    catch { setError(t('flow.actionFailed')); return false; }
    finally { lock.current = false; setBusy(false); }
  }
  function start() {
    if (!canStart) { setPanel('settings'); return; }
    setPanel(null); setPlaying(true); setRunning(true);
  }
  useEffect(()=>{if(sampleRequested && canStart && info?.selected?.id!==sampleFromId.current){setSampleRequested(false);setPlaying(true);setRunning(true);}},[sampleRequested,canStart,info?.selected]);
  function exitPlay() { window.dispatchEvent(new Event('classbank:exit-game-fullscreen')); setPlaying(false); setRunning(false); setPanel(null); }
  async function startFromEditor() {
    if (saveOriginal) {
      if (!await action(() => bridge.current!.saveMaterial(materialName.trim()), false)) return;
      setSaveOriginal(false);
    }
    setPanel(null);
  }
  async function begin(kind: 'word' | 'sentence') {
    if (await action(() => bridge.current!.beginMaterial(kind))) setPanel('settings');
  }
  const details = info?.selected ? gameReadyDetails(info.selected) : null;
  const readiness = [details?.count !== null && details?.count !== undefined ? t(`flow.count_${details.kind}`,{count:details.count}) : null,
    ordered && capabilities.manualTurns ? order.mode==='team' ? t('flow.count_teams',{count:order.teamCount}) : t('flow.count_participants',{count:roster.length}) : details?.teams ? t('flow.count_teams',{count:details.teams}) : null,
    canStart ? t('flow.readyComplete') : null].filter(Boolean).join(' · ');
  const validation = info?.loading ? t('common.loading') : info?.selected&&guideProblem(info.selected) ? t(`guide.${guideProblem(info.selected)}`) : !canStart ? t(requirement.key,{count:requirement.count}) : '';
  const game = GAME_CATALOG.find(row => row.type === info?.gameType);
  const demo = game && demoForGame(game.path);
  const defaultMaterialName = defaultActivityName('',t(sourceKind==='sentence'?'flow.defaultSentences':'flow.defaultWords'),info?.lists.map(row=>row.name));
  const defaultGameName = defaultActivityName('',game ? t(game.nameKey) : t('flow.defaultActivity'),info?.templates.filter(row=>!isActivityDraft(row.id)).map(row=>row.name));
  const value = useMemo(() => ({ fullscreen, setFullscreen, canStart, readiness, validation, stage, running, playing, teacherToolsTarget, hasSource:!!info?.sourceCards, pause:()=>setRunning(false), panel, publish, roster:capabilities.manualTurns ? roster : EMPTY_ROSTER, openTeams:()=>setTeams(true), open:setPanel, start, exitPlay, turn }), [stage, running, playing, teacherToolsTarget, panel, publish, roster, info?.sourceCards, turn, canStart, readiness, validation, fullscreen, capabilities.manualTurns]); // eslint-disable-line react-hooks/exhaustive-deps
  const contentName = source?.name || info?.selected?.name || t('quick.sampleTitle');
  const materialButtons = (includeLoad = true) => <div className="flex flex-wrap gap-2" data-material-actions>
    {capabilities.kinds.map(kind => <button key={kind} className={btn} disabled={busy || !info?.temporary || !!info.sharedView} onClick={() => void begin(kind)}>{t(kind === 'word' ? 'flow.createWords' : 'flow.createSentences')}</button>)}
    {includeLoad && <button className={btn} disabled={busy || !info || info.loading} onClick={() => setPanel('content')}>{t('flow.loadMaterial')}</button>}
    <button className={btn} disabled={busy || !info || info.loading || !!info.sharedView} onClick={() => {sampleFromId.current=info?.selected?.id;void action(() => bridge.current!.useSource({cards: sampleActivityCards(sourceKind),kind:sourceKind,name:t('quick.sampleTitle')})).then(ok=>{if(ok)setSampleRequested(true);});}}>{t('quick.sample')}</button>
  </div>;
  const reuse = <div className="flex flex-wrap gap-2">
    {!!info?.sourceCards?.length && <><button className={btn} onClick={() => setPanel('games')}>{t('teacherGame.switchGame')}</button><button className={btn} onClick={() => navigate('/materials/worksheet',{state:{materialsOwnerId:session?.user.id,materialsAcademyId:academy?.id,materialsWords:info.sourceCards,materialsKind:sourceKind,materialsTab:'list'}})}>{t('quick.worksheet')}</button></>}
    {!presenting && groupOpen && info?.selected && <button className={btn} onClick={() => { setPanel(null); setAddLesson(true); }}>{t('teacherGame.addToLesson')}</button>}
  </div>;
  return <GameWorkspaceContext.Provider value={value}>
    <section className={`game-workspace relative space-y-3 ${playing && !presenting ? 'game-workspace-focus' : ''}`} aria-label={t('flow.workspace')} data-play-mode={playing ? 'play' : 'prepare'}>
      {!playing && !presenting && <header className="space-y-4 rounded-2xl border border-outline-variant bg-white p-4 sm:p-6" data-game-preparation>
        <Link to="/games" className={`${btn} inline-flex items-center`}>{t('gameAdmin.backToList')}</Link>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-primary">{t('flow.preparation')}</p><h1 className="text-2xl font-black">{game ? t(game.nameKey) : t('nav.gameCenter')}</h1><p className="mt-1 text-on-surface-variant">{contentName}</p></div></div>
        <button className={`${btn} bg-primary! px-6! text-lg! text-white!`} disabled={!info||info.loading||!!info.sharedView} onClick={()=>setPanel('guide')}>{t('guide.title')}</button>
        <details><summary className="cursor-pointer py-2 font-bold text-primary">{t('guide.optional')}</summary><div className="space-y-3">{capabilities.kinds.length ? materialButtons() : <p>{t('flow.noMaterialRequired')}</p>}
        {demo && <button className={btn} onClick={()=>setPanel('video')}>▶ {t('flow.methodVideo')}</button>}
        <div className="flex flex-wrap gap-2"><button className={btn} onClick={() => setPanel('settings')}>{t('flow.nativeEditor')}</button>{capabilities.manualTurns && <button className={btn} onClick={() => setTeams(true)}>{t('flow.participation')}</button>}<button className={btn} onClick={() => setPanel('content')}>{t('flow.savedGames')}</button></div>
        </div></details>
        {info && !canStart && !info.loading && <p role="status" className="text-error">{validation}</p>}
        {info?.temporary && <p className="text-sm text-on-surface-variant">{t('quick.temporary')}</p>}
        <details className="game-optional-actions"><summary>{t(reuseLabel)}</summary><div className="mt-3">{reuse}</div></details>
        <p className="text-base text-deep-navy">{t('teacherGame.prepareHint')}</p>
      </header>}
      <div ref={setStage} className={`game-workspace-stage relative ${!running || panel || teams ? 'game-workspace-paused' : ''}`} style={presenting ? {height:'calc(100dvh - 100px)',minHeight:320}:undefined}>

      </div>
      <dialog ref={dialog} className="classroom-dialog game-workspace-dialog" aria-label={t(panel === 'teacher' ? 'flow.menuTitle' : 'flow.teacherPreparation')} onCancel={event => {event.preventDefault(); if (!busy) setPanel(null);}}>
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-deep-navy p-4 text-white"><div><h2 className="text-xl font-bold">{t(panel === 'teacher' ? 'flow.menuTitle' : 'flow.teacherPreparation')}</h2><p className="text-sm">{t(capabilities.realtime ? 'flow.onlineContinues' : 'flow.localPaused')}</p></div><button className={btn} disabled={busy} onClick={() => setPanel(null)}>{t('common.close')}</button></header>
        {error && <p role="alert" className="bg-error-container p-4 text-on-error-container">{error}</p>}
        {info?.sharedView && <p className="bg-amber-50 p-4">{t('flow.sharedView')}</p>}
        <div hidden={panel !== 'teacher'} className="space-y-4 p-4">
          <button className={`${btn} bg-primary! text-white!`} onClick={() => setPanel(null)}>{t('flow.resume')}</button>
          <p>{t('teacherGame.menuHint')}</p>
          <button className={btn} onClick={() => setPanel('settings')}>{t('flow.nativeEditor')}</button>
          {capabilities.manualTurns && <button className={btn} onClick={() => {setPanel(null);setTeams(true);}}>{t('flow.participation')}</button>}
          <button className={btn} onClick={exitPlay}>{t('flow.backToPreparation')}</button>
          <Link className={`${btn} inline-flex`} to="/games">{t('teacherGame.leave')}</Link>
          <p className="text-base">{t('teacherGame.navigationHint')}</p>
          <details className="game-optional-actions"><summary>{t('teacherGame.tools')}</summary><div ref={setTeacherToolsTarget} className="mt-3 space-y-2" data-teacher-game-tools /></details>
          <details className="game-optional-actions"><summary>{t(reuseLabel)}</summary><div className="mt-3">{reuse}</div></details>
        </div>
        {panel === 'video' && demo && <div className="p-4"><GameMethodVideo src={demo} /></div>}
        {panel === 'content' && !info?.sharedView && <div className="space-y-4 p-4">
          {!!capabilities.kinds.length && materialButtons(false)}
          <label className="block">{t('quick.optionalClass')}<select className={`${btn} ml-2`} value={info?.classId || ''} disabled={busy} onChange={event => bridge.current?.selectClass(event.target.value)}><option value="">{t('quick.noClassNeeded')}</option>{info?.classes.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <p>{t('quick.listHint')}</p>
          <div className="grid gap-2 sm:grid-cols-2">{[...(info?.lists || [])].sort((a,b)=>Number(!!prepareClassroomGame(info!.gameType,b))-Number(!!prepareClassroomGame(info!.gameType,a))).map(list => {const ready=!!prepareClassroomGame(info!.gameType,list);const requirement=classroomGameRequirement(info!.gameType,list.kind);return <button key={list.id} className={`${btn} text-left`} disabled={busy || !ready} onClick={()=>void action(()=>bridge.current!.useList(list))}>{list.name} · {t(list.kind==='sentence'?'flow.sentences':'flow.words')} · {t('quick.items',{count:list.items.length})}{!ready && <small className="block font-normal">{t(requirement.key,{count:requirement.count})}</small>}</button>;})}</div>
          {!info?.lists.length && <p>{t('quick.emptyLists')}</p>}
          <h3 className="font-bold">{t('flow.savedGames')}</h3>
          {info?.templates.filter(row=>!isActivityDraft(row.id)).map(row=><button key={row.id} className={`${btn} mr-2 mb-2`} onClick={()=>{bridge.current?.selectTemplate(row.id);setPanel(null);}}>{row.name}</button>)}
        </div>}
        {panel === 'games' && !info?.sharedView && <div className="space-y-3 p-4">{GAME_CATALOG.filter(game=>game.type!==info?.gameType && info?.sourceCards && prepareClassroomGame(game.type,info.sourceCards,sourceKind)).map(game=><button key={game.type} className={`${btn} m-1`} disabled={busy || (!hasFullAccess&&!isFreeTierGame(game.type))} onClick={()=>void action(()=>bridge.current!.switchGame(game.type))}>{i18n.t(game.nameKey)}</button>)}</div>}
        {info && <GameSetupGuide info={info} active={panel==='guide'} canStart={canStart} busy={busy} run={fn=>action(fn,false)} start={start} nativeVisible={setGuideNative} setParticipants={text=>{setParticipantText(text);setOrdered(!!text.trim());}} openTeams={()=>setTeams(true)} />}
        <div hidden={(panel !== 'settings' && !(panel==='guide'&&guideNative)) || !!info?.sharedView} className="p-4" data-game-existing-settings>
          {info?.selected && <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-surface-container-low p-3" data-activity-title>
            <span className="font-bold">{info.selected.name}</span><button className={btn} disabled={busy} onClick={()=>void action(()=>bridge.current!.renameActivity(),false)}>{t('wordLists.rename')}</button>
          </div>}
          <p className="mb-3 text-sm text-on-surface-variant">{t('flow.nativeEditorHint')}</p><p className="mb-3 text-sm text-on-surface-variant">{t('flow.editsMayRestart')}</p>
          {children}
          <div hidden={panel==='guide'} className="sticky bottom-0 z-20 mt-5 space-y-3 rounded-xl border bg-white/95 p-4 shadow-lg" data-preparation-submit>
            {info?.temporary && !!capabilities.kinds.length && <><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={saveOriginal} onChange={event=>setSaveOriginal(event.target.checked)} />{t(sourceKind==='sentence'?'flow.saveSentences':'flow.saveWords')}</label>{saveOriginal && <p className="text-sm text-on-surface-variant">{t('flow.defaultNameHint',{name:defaultMaterialName})}</p>}{saveOriginal && <label className="block">{t('flow.materialName')}<input placeholder={defaultMaterialName} className={`${btn} ml-2`} value={materialName} onChange={event=>setMaterialName(event.target.value)} /></label>}</>}
            <button className={`${btn} bg-primary! text-white!`} disabled={busy || !canStart} onClick={()=>void startFromEditor()}>{t(saveOriginal?'flow.saveAndPrepare':'flow.confirmContent')}</button>
            {info?.temporary && info.selected && isActivityDraft(info.selected.id) && <details><summary className="cursor-pointer py-2 font-bold text-primary">{t('quick.saveActivity')}</summary><p className="my-2 text-sm text-on-surface-variant">{t('flow.defaultNameHint',{name:defaultGameName})}</p><label>{t('quick.activityName')}<input placeholder={defaultGameName} className={`${btn} ml-2`} value={activityName} onChange={event=>setActivityName(event.target.value)} /></label><button className={btn} disabled={busy} onClick={()=>void action(()=>bridge.current!.saveActivity(activityName.trim()))}>{t('quick.saveActivity')}</button></details>}
          </div>
        </div>
      </dialog>
      {addLesson && info?.selected && <AddActivityToLesson activity={info.selected} onClose={()=>setAddLesson(false)} />}
      {teams && <TeamOrderPanel key={`${scope}:${roster.map(row=>row.id).join(',')}`} scope={scope} roster={roster} onClose={async()=>{const next=loadTeamOrder(roster,scope);if(next.mode==='team'&&info?.teamCount!==undefined&&next.teamCount!==info.teamCount){if(!await action(()=>bridge.current!.configureTeams(next.teamCount),false))return;}setTeams(false);}}>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={ordered} onChange={event=>setOrdered(event.target.checked)} />{t('flow.showTurns')}</label>
        {!info?.roster.length && <label className="block">{t('flow.temporaryParticipants')}<textarea className="mt-2 min-h-24 w-full rounded-xl border p-3" value={participantText} onChange={event=>{setParticipantText(event.target.value);setAbsent([]);try{sessionStorage.setItem(participantKey,event.target.value);}catch{/* tab only */}}} /></label>}
        <p>{t('flow.excludeParticipants')}</p>{allRoster.map(row=><label key={row.id} className="mr-3 inline-flex min-h-11 items-center gap-2"><input type="checkbox" checked={absent.includes(row.id)} onChange={event=>setAbsent(old=>event.target.checked?[...old,row.id]:old.filter(id=>id!==row.id))}/>{row.label}</label>)}
      </TeamOrderPanel>}
    </section>
  </GameWorkspaceContext.Provider>;
}
export function GameWorkspaceFrameControls({ fullscreen=false, onExitFullscreen, onFullscreen, presenting=false }: {fullscreen?:boolean;onExitFullscreen?:()=>void;onFullscreen?:()=>void;presenting?:boolean}) {
  const workspace=useGameWorkspace();const {t}=useTranslation();if(!workspace)return null;
  return <div className="teacher-game-controls relative z-30 shrink-0 bg-white p-2" data-frame-controls data-play-controls>
    <p className="teacher-game-status font-bold text-deep-navy" role="status">{t(workspace.playing ? workspace.running ? 'teacherGame.playing' : 'teacherGame.paused' : 'teacherGame.ready')}</p>
    <div className="teacher-game-actions">
      <button className={btn} onClick={()=>workspace.open('teacher')}>{t('flow.teacherMenu')}</button>
      {workspace.playing && workspace.running && <button className={`${btn} teacher-game-primary`} onClick={workspace.pause}>{t('teacherGame.pause')}</button>}
      {workspace.playing && !presenting && <button className={btn} onClick={workspace.exitPlay}>{t('flow.backToPreparation')}</button>}
      {!presenting && <button className={btn} onClick={fullscreen ? onExitFullscreen : onFullscreen}>{t(fullscreen ? 'gamePlay.exitFullscreen' : 'gamePlay.fullscreen')}</button>}
    </div>
  </div>;
}
export function GameWorkspaceStartOverlay() {
  const workspace=useGameWorkspace();const {t}=useTranslation();if(!workspace || workspace.running || workspace.panel)return null;
  return <div className="game-start-overlay absolute inset-0 z-20 flex items-center justify-center bg-white/35 p-4" data-game-ready-overlay>
    <div className="w-full max-w-lg rounded-3xl border border-white/80 bg-white/95 p-5 text-center shadow-xl sm:p-8">
      <button aria-label={t(workspace.playing?'flow.resume':'flow.start')} className="min-h-20 rounded-2xl bg-primary px-8 py-4 text-2xl font-black text-white shadow-lg focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:opacity-50 sm:text-3xl" disabled={!workspace.canStart} onClick={workspace.start}>
        <span aria-hidden>▶ </span>{t(workspace.playing?'flow.resume':'flow.start')}
      </button>
      <p className="mt-4 text-lg font-bold text-deep-navy" role="status">{workspace.readiness}</p>
      {!!workspace.validation && <><p className="mt-3 text-error">{workspace.validation}</p><button className={`${btn} mt-3`} onClick={()=>workspace.open('settings')}>{t('flow.nativeEditor')}</button></>}
    </div>
  </div>;
}
