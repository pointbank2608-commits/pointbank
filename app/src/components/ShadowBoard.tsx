import TeachingVideoFrame from './TeachingVideoFrame';
import '../styles/video-teaching.css';
import {readPlaybackMemory,writePlaybackMemory} from '../lib/videoPlaybackMemory';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSyncedSubState } from '../lib/presentSync';
import { parseShadowText, shadowCloze, shadowSpeakers, type ShadowLine } from '../lib/shadowLines';
import { extractYoutubeId, loadYoutubeIframeApi,retryYoutubeIframeApi, type YoutubePlayer } from '../lib/youtube';


export type ShadowFlow = 'video' | 'auto' | 'manual';
export type ShadowSubtitle = 'both' | 'en' | 'ko' | 'cloze' | 'none';
export const SHADOW_SUBTITLES: ShadowSubtitle[] = ['both', 'en', 'ko', 'cloze', 'none'];
export const SHADOW_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
export const SHADOW_REPEATS = [1, 2, 3, 4, 5];

type Phase = 'loading' | 'idle' | 'listen' | 'speak' | 'wait' | 'done';

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
  const [position,setPosition]=useState(restored.current?.time??lines[0]?.start??0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [flow, setFlow] = useState<ShadowFlow>(restored.current?.flow??flowInit);
  const [repeat, setRepeat] = useState(restored.current?.repeat??repeatInit);
  const [speed, setSpeed] = useState(restored.current?.speed??speedInit);
  const [subtitle, setSubtitle] = useState<ShadowSubtitle>(restored.current?.subtitle??subtitleInit);
  const [roleTeams, setRoleTeams] = useState(restored.current?.roleTeams??roleTeamsInit);
  const [ready, setReady] = useState(false);
  const [mediaError,setMediaError]=useState('');
  const [actualPlaying,setActualPlaying]=useState(false),[attempt,setAttempt]=useState(0);
  const resumeAt=useRef(restored.current?.time);
  const remember=useRef({idx,flow,repeat,speed,subtitle,roleTeams});remember.current={idx,flow,repeat,speed,subtitle,roleTeams};

  // 설정이 바뀌면(편집 화면에서 고칠 때) 따라간다
  useEffect(() => {if(!restored.current)setFlow(flowInit);}, [flowInit]);
  useEffect(() => {if(!restored.current)setRepeat(repeatInit);}, [repeatInit]);
  useEffect(() => {if(!restored.current)setSpeed(speedInit);}, [speedInit]);
  useEffect(() => {if(!restored.current)setSubtitle(subtitleInit);}, [subtitleInit]);
  useEffect(() => {if(!restored.current)setRoleTeams(roleTeamsInit);}, [roleTeamsInit]);

  const follower = useSyncedSubState({ idx, subtitle, roleTeams, phase }, (s) => {
    setIdx(Number(s.idx) || 0);
    setSubtitle((s.subtitle as ShadowSubtitle) ?? 'both');
    setRoleTeams(Number(s.roleTeams) || 0);
    setPhase((s.phase as Phase) ?? 'idle');
  });
  const usePlayer = interactive && !follower && !!videoId;

  const playerRef = useRef<YoutubePlayer | null>(null);
  const [elementId] = useState(() => `shadow-yt-${Math.random().toString(36).slice(2)}`);
  const requestTimeout=useRef<number|undefined>(undefined);
  const timerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const state = useRef({ idx, rep, flow, repeat, speed, lines });
  state.current = { idx, rep, flow, repeat, speed, lines };

  function clearTimers() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (pollRef.current) window.clearInterval(pollRef.current);
    clearTimeout(requestTimeout.current);
    timerRef.current = null;
    pollRef.current = null;
  }

  useEffect(() => {
    if (!usePlayer || !videoId) return;
    let cancelled = false;
    setMediaError('');setReady(false);
    const loadingTimeout=window.setTimeout(()=>{if(!cancelled)setMediaError('API_TIMEOUT');},15000);
    void loadYoutubeIframeApi().then(() => {
      if (cancelled || !window.YT) return;
      playerRef.current = new window.YT.Player(elementId, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, controls: 0, disablekb: 1, iv_load_policy: 3, fs: 0 },
        events: { onReady: () => {clearTimeout(loadingTimeout);setReady(true);if(restored.current?.time)playerRef.current?.seekTo(restored.current.time,true);},onStateChange:(e:{data:number})=>{setActualPlaying(e.data===1);if(e.data===1){clearTimeout(requestTimeout.current);setPhase('listen');}if(e.data===2)setPhase(p=>p==='speak'?p:'wait');},onError:(e:{data:number})=>{setActualPlaying(false);clearTimers();setReady(false);setMediaError(String(e.data));setPhase('wait');} },
      });
    }).catch(()=>{if(!cancelled)setMediaError('API');});
    return () => {
      cancelled = true;
      clearTimeout(loadingTimeout);
      clearTimers();
      writePlaybackMemory(memoryKey,{...remember.current,time:playerRef.current?.getCurrentTime()??resumeAt.current??0});
      playerRef.current?.pauseVideo();
      playerRef.current?.destroy();
      playerRef.current = null;
      setReady(false);
    };
  }, [usePlayer, videoId, elementId,memoryKey,attempt]);

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
    if(usePlayer&&(!player||!ready))return;
    if (!player || !ready) {
      // 영상이 없으면 바로 따라 말하기 시간으로
      startSpeak(line, i, repNo);
      return;
    }
    setPhase('loading');
    player.setPlaybackRate(sp);
    player.seekTo(from??Math.max(0, line.start - 0.05), true);
    resumeAt.current=undefined;
    requestTimeout.current=window.setTimeout(()=>{if(player.getPlayerState?.()!==1){clearTimers();setActualPlaying(false);setMediaError('PLAYBACK_TIMEOUT');setPhase('wait');}},12000);
    player.playVideo();
    if (state.current.flow === 'video') {
      // 영상 따라하기: 멈추지 않고 흘려보내며, 지금 시간이 속한 문장으로 자막만 바꾼다
      let shown = i;
      let seeked = false;
      const began = Date.now();
      pollRef.current = window.setInterval(() => {
        if(player.getPlayerState&&player.getPlayerState()!==1)return;
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

  const subtitleBlock=line&&<div><div className="tv-speaker">{line.speaker&&<span style={{color:team>=0?TEAM_COLORS[team%TEAM_COLORS.length]:'#b1c5e2'}}>{team>=0?t('mediaV2.teams',{n:team+1})+' · ':''}{line.speaker} · </span>}{idx+1} / {lines.length}{repeat>1?' · '+rep+'/'+repeat:''}</div>
   {subtitle==='cloze'?<div className="tv-en">{shadowCloze(line.en,idx).map((seg,i)=>seg.blank?<span key={i} style={{borderBottom:'2px solid #5ba3ff',color:'transparent'}}>{seg.text}</span>:<span key={i}>{seg.text.replace(/\*\*/g,'')}</span>)}</div>:showEn?<div className="tv-en">{line.en.replace(/\*\*/g,'')}</div>:null}
   {(showKo||subtitle==='cloze')&&line.ko&&<div className="tv-ko">{line.ko}</div>}
  </div>;

  useEffect(()=>{if(ready)playerRef.current?.setPlaybackRate(speed);},[speed,ready]);
  useEffect(()=>{if(!ready)return;const poll=window.setInterval(()=>{const now=playerRef.current?.getCurrentTime();if(typeof now==='number')setPosition(now);},200);return()=>clearInterval(poll);},[ready]);
  const start=lines[0]?.start??0,end=lines.at(-1)?.end??start+1;
  const fmt=(n:number)=>`${Math.floor(Math.max(0,n)/60)}:${String(Math.floor(Math.max(0,n)%60)).padStart(2,'0')}`;

  return <div data-shadow-board className="h-full w-full"><TeachingVideoFrame expanded={expanded} title={title} playing={actualPlaying||phase==='speak'} pending={phase==='loading'} ready={usePlayer?ready:true} error={videoUrl&&!videoId?'URL':mediaError} youtube={videoUrl??undefined} retry={()=>{void retryYoutubeIframeApi();setAttempt(n=>n+1);}}
   video={usePlayer?<div key={attempt} className="absolute inset-0"><div id={elementId}/><div className="absolute inset-0 z-[2]" aria-hidden/></div>:<div className="flex h-full items-center justify-center">{title}</div>} caption={subtitleBlock}
   onPlay={()=>actualPlaying||phase==='speak'||phase==='loading'?stop():playLine(idx,1,resumeAt.current)} onReplay={()=>playLine(idx,1)} onPrev={interactive&&!follower&&lines.length?()=>go(-1):undefined} onNext={interactive&&!follower&&lines.length?()=>go(1):undefined} previousDisabled={idx===0} nextDisabled={idx>=lines.length-1}
   progress={lines.length&&usePlayer?<><span>{fmt(position-start)}</span><input aria-label={t('mediaV2.seek')} type="range" min={start} max={end} step={.1} value={Math.min(end,Math.max(start,position))} onChange={e=>{const time=Number(e.target.value);const next=Math.max(0,lines.reduce((last,l,i)=>l.start<=time?i:last,0));const wasPlaying=actualPlaying;stop();setIdx(next);setPosition(time);playerRef.current?.seekTo(time,true);if(wasPlaying)playLine(next,1,time);}}/><span>{fmt(end-start)}</span></>:undefined}
   follow={interactive&&!follower?<button type="button" className={flow!=='video'?'is-active':''} aria-pressed={flow!=='video'} onClick={()=>{stop();setFlow(flow==='video'?'auto':'video');}}>{t('mediaV2.follow')}</button>:undefined}
   summary={<>{t('mediaV2.repeat',{n:repeat})} · {t('mediaV2.speed',{n:speed})} · {t(roleTeams?'mediaV2.teams':'mediaV2.rolesOff',{n:roleTeams})}</>}
   settings={interactive&&!follower?(always,setAlways)=><><div className="tv-mode-options">{(['video','auto','manual'] as const).map(f=><button type="button" key={f} className={flow===f?'is-active':''} aria-pressed={flow===f} onClick={()=>{stop();setFlow(f);}}>{t('mediaV2.'+({video:'videoMode',auto:'autoMode',manual:'manualMode'}[f]))}</button>)}</div><label>{t('mediaV2.repeatLabel')}<select aria-label={t('mediaV2.repeatLabel')} value={repeat} onChange={e=>setRepeat(Number(e.target.value))}>{SHADOW_REPEATS.map(n=><option key={n} value={n}>{t('mediaV2.repeat',{n})}</option>)}</select></label><label>{t('mediaV2.speedLabel')}<select aria-label={t('mediaV2.speedLabel')} value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{SHADOW_SPEEDS.map(n=><option key={n} value={n}>{n}×</option>)}</select></label><label>{t('mediaV2.rolesLabel')}<select aria-label={t('mediaV2.rolesLabel')} value={roleTeams} onChange={e=>setRoleTeams(Number(e.target.value))}>{[0,2,3,4].map(n=><option value={n} key={n}>{t(n?'mediaV2.teams':'mediaV2.rolesOff',{n})}</option>)}</select></label><label>{t('mediaV2.always')}<input type="checkbox" checked={always} onChange={e=>setAlways(e.target.checked)}/></label></>:undefined}
   subtitles={interactive&&!follower?<>{SHADOW_SUBTITLES.map(sub=><button type="button" key={sub} aria-pressed={subtitle===sub} onClick={()=>setSubtitle(sub)}>{t('mediaV2.sub_'+sub)}</button>)}</>:undefined}/></div>;
}
