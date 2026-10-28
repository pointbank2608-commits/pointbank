import {useVideoChrome} from '../lib/videoChrome';
import '../styles/video-teaching.css';
import {readPlaybackMemory,writePlaybackMemory} from '../lib/videoPlaybackMemory';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSyncedSubState } from '../lib/presentSync';
import { parseShadowText, shadowCloze, shadowSpeakers, type ShadowLine } from '../lib/shadowLines';
import { extractYoutubeId, loadYoutubeIframeApi, type YoutubePlayer } from '../lib/youtube';
import { CanvasStageBox } from './CanvasSlideView';

export type ShadowFlow = 'video' | 'auto' | 'manual';
export type ShadowSubtitle = 'both' | 'en' | 'ko' | 'cloze' | 'none';
export const SHADOW_SUBTITLES: ShadowSubtitle[] = ['both', 'en', 'ko', 'cloze', 'none'];
export const SHADOW_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
export const SHADOW_REPEATS = [1, 2, 3, 4, 5];

type Phase = 'idle' | 'listen' | 'speak' | 'wait' | 'done';

/** 배역 팀 색(1팀부터) */
const TEAM_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706'];

/**
 * 쉐도잉 칠판(2026-10-03, 클래스5 무비 쉐도잉을 참고). 유튜브 영상을 대사표의 한 문장씩 재생하고 자동으로 멈춘 뒤,
 * 그 문장 길이만큼 "따라 말하기" 시간을 준다.
 *  - video(영상 따라하기, 2026-10-11): 영상이 쉬지 않고 흘러가고 자막이 시간에 맞춰 바뀐다 — 소리를 들으며 바로 따라 말하는 진짜 쉐도잉
 *  - auto(자동 듣고 따라하기): 듣기 → 따라 말하기 → (반복 횟수만큼) → 다음 문장으로 저절로
 *  - manual(듣고 따라하기): 듣기 → 따라 말하기 → 기다림. Space·→·클리커로 다음 문장
 *  - 자막: 영어+한글 / 영어 / 한글 / 빈칸 / 없음 — 같은 영상을 점점 어렵게 여러 번 돌릴 수 있다
 *  - 배역 나눠 따라하기(roleTeams 2~4): 배역마다 팀을 정해 그 팀만 따라 말한다(교실 단체 수업용)
 * AI 발음 채점은 하지 않는다(사용자 결정 — 어린이에게 부정확한 점수는 역효과).
 */
export default function ShadowBoard({
  source,
  expanded=false,
  rememberKey,
  title,
  videoUrl,
  flow: flowInit = 'auto',
  repeat: repeatInit = 1,
  speed: speedInit = 1,
  subtitle: subtitleInit = 'both',
  roleTeams: roleTeamsInit = 0,
  interactive = true,
}: {
  source: string;
  expanded?:boolean;
  rememberKey?:string;
  title?: string;
  videoUrl?: string | null;
  flow?: ShadowFlow;
  repeat?: number;
  speed?: number;
  subtitle?: ShadowSubtitle;
  roleTeams?: number;
  interactive?: boolean;
}) {
  const { t } = useTranslation();
  const lines = parseShadowText(source);
  const speakers = shadowSpeakers(lines);
  const videoId = videoUrl ? extractYoutubeId(videoUrl) : null;

  const memoryKey=rememberKey?`${rememberKey}:${videoId}:${source}`:undefined;
  const restored=useRef(readPlaybackMemory(memoryKey));
  const [idx, setIdx] = useState(restored.current?.idx??0);
  const [rep, setRep] = useState(1);
  const [phase, setPhase] = useState<Phase>('idle');
  const [flow, setFlow] = useState<ShadowFlow>(restored.current?.flow??flowInit);
  const [repeat, setRepeat] = useState(restored.current?.repeat??repeatInit);
  const [speed, setSpeed] = useState(restored.current?.speed??speedInit);
  const [subtitle, setSubtitle] = useState<ShadowSubtitle>(restored.current?.subtitle??subtitleInit);
  const [roleTeams, setRoleTeams] = useState(restored.current?.roleTeams??roleTeamsInit);
  const [speakMs, setSpeakMs] = useState(0);
  const [ready, setReady] = useState(false);
  const [mediaError,setMediaError]=useState('');
  const [popup,setPopup]=useState<'settings'|'subtitles'|null>(null);
  const chrome=useVideoChrome(phase==='listen'||phase==='speak',popup!==null,expanded);
  const resumeAt=useRef(restored.current?.time);
  const remember=useRef({idx,flow,repeat,speed,subtitle,roleTeams});remember.current={idx,flow,repeat,speed,subtitle,roleTeams};

  // 설정이 바뀌면(편집 화면에서 고칠 때) 따라간다
  useEffect(() => {if(!restored.current)setFlow(flowInit);}, [flowInit]);
  useEffect(() => {if(!restored.current)setRepeat(repeatInit);}, [repeatInit]);
  useEffect(() => {if(!restored.current)setSpeed(speedInit);}, [speedInit]);
  useEffect(() => {if(!restored.current)setSubtitle(subtitleInit);}, [subtitleInit]);
  useEffect(() => {if(!restored.current)setRoleTeams(roleTeamsInit);}, [roleTeamsInit]);

  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setPopup(null);};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[]);
  const follower = useSyncedSubState({ idx, subtitle, roleTeams, phase }, (s) => {
    setIdx(Number(s.idx) || 0);
    setSubtitle((s.subtitle as ShadowSubtitle) ?? 'both');
    setRoleTeams(Number(s.roleTeams) || 0);
    setPhase((s.phase as Phase) ?? 'idle');
  });
  const usePlayer = interactive && !follower && !!videoId;

  const playerRef = useRef<YoutubePlayer | null>(null);
  const [elementId] = useState(() => `shadow-yt-${Math.random().toString(36).slice(2)}`);
  const timerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const state = useRef({ idx, rep, flow, repeat, speed, lines });
  state.current = { idx, rep, flow, repeat, speed, lines };

  function clearTimers() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (pollRef.current) window.clearInterval(pollRef.current);
    timerRef.current = null;
    pollRef.current = null;
  }

  useEffect(() => {
    if (!usePlayer || !videoId) return;
    let cancelled = false;
    void loadYoutubeIframeApi().then(() => {
      if (cancelled || !window.YT) return;
      playerRef.current = new window.YT.Player(elementId, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, controls: 0, disablekb: 1, iv_load_policy: 3, fs: 0 },
        events: { onReady: () => {setReady(true);if(restored.current?.time)playerRef.current?.seekTo(restored.current.time,true);},onError:(e:{data:number})=>{clearTimers();setReady(false);setMediaError(String(e.data));setPhase('wait');} },
      });
    }).catch(()=>{if(!cancelled)setMediaError('API');});
    return () => {
      cancelled = true;
      clearTimers();
      writePlaybackMemory(memoryKey,{...remember.current,time:playerRef.current?.getCurrentTime()??resumeAt.current??0});
      playerRef.current?.pauseVideo();
      playerRef.current?.destroy();
      playerRef.current = null;
      setReady(false);
    };
  }, [usePlayer, videoId, elementId,memoryKey]);

  useEffect(() => () => clearTimers(), []);

  /** i 번째 문장을 처음부터 듣기 */
  function playLine(i: number, repNo = 1,from?:number) {
    if(mediaError)return;
    const { lines: ls, speed: sp } = state.current;
    const line = ls[i];
    if (!line) return;
    clearTimers();
    setIdx(i);
    setRep(repNo);
    const player = playerRef.current;
    if (!player || !ready) {
      // 영상이 없으면 바로 따라 말하기 시간으로
      startSpeak(line, i, repNo);
      return;
    }
    setPhase('listen');
    player.setPlaybackRate(sp);
    player.seekTo(from??Math.max(0, line.start - 0.05), true);
    resumeAt.current=undefined;
    player.playVideo();
    if (state.current.flow === 'video') {
      // 영상 따라하기: 멈추지 않고 흘려보내며, 지금 시간이 속한 문장으로 자막만 바꾼다
      let shown = i;
      let seeked = false;
      const began = Date.now();
      pollRef.current = window.setInterval(() => {
        const now = player.getCurrentTime();
        const all = state.current.lines;
        // seekTo 가 반영되기 전의 옛 시간으로 자막이 되돌아가지 않게, 시작 위치 근처가 될 때까지 기다린다(최대 2초)
        if (!seeked) {
          if (Math.abs(now - line.start) < 1.5 || Date.now() - began > 2000) seeked = true;
          else return;
        }
        let k = 0;
        for (let n = 0; n < all.length; n++) {
          if (all[n].start <= now + 0.15) k = n;
          else break;
        }
        if (k !== shown) {
          shown = k;
          setIdx(k);
          setRep(1);
        }
        const last = all[all.length - 1];
        if (last && now >= last.end - 0.05) {
          player.pauseVideo();
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null;
          setIdx(all.length - 1);
          setPhase('done');
        }
      }, 100);
      return;
    }
    pollRef.current = window.setInterval(() => {
      const now = player.getCurrentTime();
      if (now >= line.end - 0.05) {
        player.pauseVideo();
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        startSpeak(line, i, repNo);
      }
    }, 80);
  }

  function startSpeak(line: ShadowLine, i: number, repNo: number) {
    const { speed: sp, repeat: rp, flow: fl, lines: ls } = state.current;
    const ms = Math.round((((line.end - line.start) / sp) * 1.2 + 0.8) * 1000);
    setSpeakMs(ms);
    setPhase('speak');
    timerRef.current = window.setTimeout(() => {
      if (repNo < rp) playLine(i, repNo + 1);
      else if (fl !== 'manual' && i < ls.length - 1) playLine(i + 1, 1);
      else setPhase(i >= ls.length - 1 ? 'done' : 'wait');
    }, ms);
  }

  function stop() {
    clearTimers();
    playerRef.current?.pauseVideo();
    resumeAt.current=playerRef.current?.getCurrentTime();
    setPhase((p) => (p === 'idle' ? 'idle' : 'wait'));
  }

  function go(delta: number) {
    const next = Math.min(lines.length - 1, Math.max(0, idx + delta));
    playLine(next, 1);
  }

  // 키보드·클리커: →·Space·PageDown 다음 문장(마지막 문장 뒤엔 다음 슬라이드로 흘려보냄), ←·PageUp 이전 문장
  const keyState = useRef({ idx, phase, len: lines.length });
  keyState.current = { idx, phase, len: lines.length };
  useEffect(() => {
    if (!interactive || follower) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'||tag==='BUTTON') return;
      const { idx: i, phase: ph, len } = keyState.current;
      const forward = e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown';
      const back = e.key === 'ArrowLeft' || e.key === 'PageUp';
      if (forward) {
        if (ph === 'idle') {
          e.preventDefault();
          e.stopPropagation();
          playLine(i, 1);
        } else if (i < len - 1) {
          e.preventDefault();
          e.stopPropagation();
          playLine(i + 1, 1);
        } else if (e.key === ' ') e.preventDefault();
      } else if (back && i > 0) {
        e.preventDefault();
        e.stopPropagation();
        playLine(i - 1, 1);
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, follower, ready]);

  const line = lines[Math.min(idx, Math.max(0, lines.length - 1))];
  const teamOf = (speaker: string | null) => (roleTeams > 0 && speaker ? speakers.indexOf(speaker) % roleTeams : -1);
  const team = line ? teamOf(line.speaker) : -1;
  const showEn = subtitle === 'both' || subtitle === 'en';
  const showKo = subtitle === 'both' || subtitle === 'ko';

  const subtitleBlock = line && (
    <div className="flex h-full flex-col items-center justify-center gap-[1.2cqh] px-[4cqh] text-center">
      <div className="flex items-center gap-[1.2cqh]" style={{ fontSize: '2.6cqh' }}>
        {line.speaker && (
          <span
            className="rounded-full px-[1.6cqh] py-[0.3cqh] font-bold text-white"
            style={{ background: team >= 0 ? TEAM_COLORS[team % TEAM_COLORS.length] : '#475569' }}
          >
            {team >= 0 ? `${t('teamOrder.teamLabel', { n: team + 1 })} · ` : ''}
            {line.speaker}
          </span>
        )}
        <span className="text-[#64748b]">
          {idx + 1} / {lines.length}
          {repeat > 1 && ` · ${t('curriculum.shadow.repLabel', { n: rep, total: repeat })}`}
        </span>
      </div>
      {subtitle === 'cloze' ? (
        <div className="font-bold leading-snug text-[#0f172a]" style={{ fontSize: line.en.length > 50 ? '4.6cqh' : '5.6cqh' }}>
          {shadowCloze(line.en, idx).map((seg, i) =>
            seg.blank ? (
              <span key={i} className="mx-[0.15em] inline-block border-b-[0.5cqh] border-[#f59e0b] text-transparent">
                {seg.text}
              </span>
            ) : (
              <span key={i}>{seg.text.replace(/\*\*/g, '')}</span>
            ),
          )}
        </div>
      ) : showEn ? (
        <div className="font-bold leading-snug text-[#0f172a]" style={{ fontSize: line.en.length > 50 ? '4.6cqh' : '5.6cqh' }}>
          {line.en.replace(/\*\*/g, '')}
        </div>
      ) : (
        subtitle === 'none' && <div style={{ fontSize: '4cqh' }} className="text-[#94a3b8]">🎧</div>
      )}
      {(showKo || subtitle === 'cloze') && line.ko && (
        <div className="text-[#475569]" style={{ fontSize: '3cqh' }}>
          {line.ko}
        </div>
      )}
    </div>
  );

  useEffect(()=>{if(ready)playerRef.current?.setPlaybackRate(speed);},[speed,ready]);
  const ctl = 'flex items-center gap-[0.6cqh] rounded-full bg-white px-[1.6cqh] py-[0.8cqh] font-bold text-[#1f2937] shadow hover:bg-[#f1f5f9] disabled:opacity-40';

  return (
    <div data-shadow-board onMouseMove={chrome.show} onPointerDown={chrome.pointer} onKeyDown={chrome.show} className="flex h-full w-full items-center justify-center" style={{ containerType: 'size' }}>
      <CanvasStageBox fitParent className="sb-stage rounded-xl bg-[#0f172a] shadow-[0_8px_28px_rgba(0,0,0,0.25)]">
        {/* 영상(위 66%) */}
        <div data-shadow-video className="absolute left-0 right-0 top-0 h-[66%] bg-black">
          {usePlayer ? (
            <div className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full">
              <div id={elementId} />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center gap-[1cqh] text-white/70" style={{ fontSize: '3.4cqh' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.4em' }}>
                record_voice_over
              </span>
              {title || t('curriculum.shadow.defaultTitle')}
            </div>
          )}
          {/* 영상을 직접 눌러 재생·정지하면 자막(문장)과 영상이 어긋나므로, 영상 위를 막고 아래 조작 줄로만 움직인다 */}
          {usePlayer && <div className="absolute inset-0 z-[5]" aria-hidden />}
          {mediaError&&<div role="alert" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-900/90 p-4 text-center text-sm text-white"><p>{t('readyMedia.videoError',{code:mediaError})}</p><a className="rounded-lg border px-4 py-2" href={videoUrl??undefined} target="_blank" rel="noopener noreferrer">{t('readyMedia.youtube')}</a></div>}
          {usePlayer && phase === 'idle' && lines.length > 0 && (
            <button
              type="button"
              onClick={() => playLine(idx, 1,resumeAt.current)}
              disabled={!ready}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-[1.5cqh] bg-black/45 text-white"
            >
              <span className="flex h-[16cqh] w-[16cqh] items-center justify-center rounded-full bg-[#facc15] text-[#1f2937] shadow-lg">
                <span className="material-symbols-outlined" style={{ fontSize: '10cqh' }}>
                  play_arrow
                </span>
              </span>
              <span style={{ fontSize: '3cqh' }} className="font-bold">
                {ready ? t(flow === 'video' ? 'curriculum.shadow.startVideo' : flow === 'auto' ? 'curriculum.shadow.startAuto' : 'curriculum.shadow.startManual') : t('common.loading')}
              </span>
            </button>
          )}
          {/* 따라 말하기 신호 */}
          {phase === 'speak' && (
            <div className="pointer-events-none absolute right-[2cqh] top-[2cqh] z-10 flex items-center gap-[0.8cqh] rounded-full bg-[#facc15] px-[2cqh] py-[1cqh] font-extrabold text-[#1f2937] shadow-lg" style={{ fontSize: '3.2cqh' }}>
              <span className="material-symbols-outlined animate-pulse" style={{ fontSize: '1.2em' }}>
                mic
              </span>
              {team >= 0 ? t('curriculum.shadow.teamSay', { n: team + 1 }) : t('curriculum.shadow.yourTurn')}
            </div>
          )}
          {phase === 'listen' && (
            <div className="pointer-events-none absolute right-[2cqh] top-[2cqh] z-10 flex items-center gap-[0.8cqh] rounded-full bg-white/90 px-[2cqh] py-[1cqh] font-bold text-[#1f2937]" style={{ fontSize: '2.8cqh' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.2em' }}>
                {flow === 'video' ? 'mic' : 'hearing'}
              </span>
              {flow === 'video' ? t('curriculum.shadow.together') : t('curriculum.shadow.listen')}
            </div>
          )}
        </div>

        {/* 따라 말하기 시간 막대 */}
        <div data-shadow-progress className="absolute left-0 right-0 top-[66%] h-[0.9cqh] bg-[#e2e8f0]">
          {phase === 'speak' && (
            <div key={`${idx}-${rep}`} className="h-full bg-[#facc15]" style={{ animation: `shadow-bar ${speakMs}ms linear forwards` }} />
          )}
        </div>

        {/* 자막(아래) */}
        <div data-shadow-caption className="absolute bottom-[9cqh] left-0 right-0 top-[67%] bg-white">
          {lines.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[#64748b]" style={{ fontSize: '3cqh' }}>
              {t('curriculum.shadow.empty')}
            </div>
          ) : (
            subtitleBlock
          )}
        </div>

        {popup&&<div data-video-popup role="group" aria-label={t('readyMedia.'+popup)} className="absolute right-[2%] top-[2%] z-30 max-h-[58%] max-w-[96%] overflow-auto rounded-xl border bg-white p-3 text-sm text-slate-900 shadow-xl" {...chrome.lock}>
          <button type="button" className="mb-2 rounded-lg border px-3 py-1" onClick={()=>setPopup(null)}>{t('readyMedia.close')}</button>
          {popup==='settings'?<div className="grid gap-2">
            <div className="flex flex-wrap gap-2">{(['video','auto','manual'] as const).map(f=><button type="button" key={f} aria-pressed={flow===f} className={`rounded-lg border p-2 ${flow===f?'bg-blue-600 text-white':''}`} onClick={()=>{stop();setFlow(f);}}>{t('curriculum.shadow.flow_'+f)}</button>)}</div>
            <label>{t('curriculum.player.rate')} <select aria-label={t('curriculum.player.rate')} value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{SHADOW_SPEEDS.map(n=><option key={n}>{n}</option>)}</select></label>
            <label>{t('curriculum.shadow.repeatN',{n:repeat})} <select aria-label={t('curriculum.shadow.repeatN',{n:repeat})} value={repeat} onChange={e=>setRepeat(Number(e.target.value))}>{SHADOW_REPEATS.map(n=><option key={n}>{n}</option>)}</select></label>
            {speakers.length>1&&<label>{t('readyMedia.roles')} <select aria-label={t('readyMedia.roles')} value={roleTeams} onChange={e=>setRoleTeams(Number(e.target.value))}>{[0,2,3,4].map(n=><option key={n} value={n}>{n===0?t('curriculum.shadow.rolesOff'):t('curriculum.shadow.rolesN',{n})}</option>)}</select></label>}
            <label><input type="checkbox" checked={chrome.always} onChange={e=>chrome.setAlways(e.target.checked)}/> {t('readyMedia.always')}</label>
          </div>:<div className="grid gap-2">{SHADOW_SUBTITLES.map(sub=><button type="button" key={sub} aria-pressed={subtitle===sub} className={`rounded-lg border p-2 ${subtitle===sub?'bg-blue-600 text-white':''}`} onClick={()=>{setSubtitle(sub);setPopup(null);}}>{t('curriculum.shadow.sub_'+sub)}</button>)}</div>}
        </div>}
        <div data-video-controls aria-hidden={!chrome.visible} className="absolute bottom-0 left-0 right-0 z-20 flex h-[9cqh] items-center gap-[1cqh] overflow-x-auto whitespace-nowrap bg-[#eef2f7] px-[1.5cqh] transition-opacity" style={{fontSize:'2.2cqh',opacity:chrome.visible?1:0,pointerEvents:chrome.visible?'auto':'none'}} {...chrome.lock}>
          {interactive&&!follower&&lines.length>0&&<>
            <div className="sb-main-controls">
            <button type="button" className={ctl} onClick={()=>go(-1)} disabled={idx===0} aria-label={t('curriculum.shadow.prev')}>◀</button>
            <button type="button" className={ctl} onClick={()=>phase==='listen'||phase==='speak'?stop():playLine(idx,1,resumeAt.current)} aria-label={t(phase==='listen'||phase==='speak'?'curriculum.shadow.pause':'readyMedia.play')}>{t(phase==='listen'||phase==='speak'?'curriculum.shadow.pause':'readyMedia.play')}</button>
            <button type="button" className={ctl} onClick={()=>playLine(idx,1)}>{t('curriculum.shadow.replay')}</button>
            <button type="button" className={ctl} onClick={()=>go(1)} disabled={idx>=lines.length-1} aria-label={t('curriculum.shadow.next')}>▶</button>
            </div><div className="sb-tool-controls">
            <button type="button" className={ctl} aria-pressed={flow!=='video'} onClick={()=>{stop();setFlow(flow==='video'?'auto':'video');}}>{t('readyMedia.follow')}</button>
            <button type="button" className={ctl} aria-expanded={popup==='settings'} onClick={()=>setPopup(p=>p==='settings'?null:'settings')}>{t('readyMedia.settings')}</button>
            <button type="button" className={ctl} aria-expanded={popup==='subtitles'} onClick={()=>setPopup(p=>p==='subtitles'?null:'subtitles')}>{t('readyMedia.subtitles')}</button>
            </div><span className="sb-summary">{t('readyMedia.summary',{repeat,speed,teams:roleTeams})}</span>
          </>}
        </div>
      </CanvasStageBox>
    </div>
  );
}
