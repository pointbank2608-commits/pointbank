import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSyncedSubState } from '../lib/presentSync';
import { parseShadowText, shadowCloze, shadowSpeakers, type ShadowLine } from '../lib/shadowLines';
import { extractYoutubeId, loadYoutubeIframeApi, type YoutubePlayer } from '../lib/youtube';
import { CanvasStageBox } from './CanvasSlideView';

export type ShadowFlow = 'auto' | 'manual';
export type ShadowSubtitle = 'both' | 'en' | 'ko' | 'cloze' | 'none';
export const SHADOW_SUBTITLES: ShadowSubtitle[] = ['both', 'en', 'ko', 'cloze', 'none'];
export const SHADOW_SPEEDS = [0.5, 0.75, 1];
export const SHADOW_REPEATS = [1, 2, 3, 4, 5];

type Phase = 'idle' | 'listen' | 'speak' | 'wait' | 'done';

/** 배역 팀 색(1팀부터) */
const TEAM_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706'];

/**
 * 쉐도잉 칠판(2026-10-03, 클래스5 무비 쉐도잉을 참고). 유튜브 영상을 대사표의 한 문장씩 재생하고 자동으로 멈춘 뒤,
 * 그 문장 길이만큼 "따라 말하기" 시간을 준다.
 *  - auto(연속 따라하기): 듣기 → 따라 말하기 → (반복 횟수만큼) → 다음 문장으로 저절로
 *  - manual(듣고 따라하기): 듣기 → 따라 말하기 → 기다림. Space·→·클리커로 다음 문장
 *  - 자막: 영어+한글 / 영어 / 한글 / 빈칸 / 없음 — 같은 영상을 점점 어렵게 여러 번 돌릴 수 있다
 *  - 배역 나눠 따라하기(roleTeams 2~4): 배역마다 팀을 정해 그 팀만 따라 말한다(교실 단체 수업용)
 * AI 발음 채점은 하지 않는다(사용자 결정 — 어린이에게 부정확한 점수는 역효과).
 */
export default function ShadowBoard({
  source,
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

  const [idx, setIdx] = useState(0);
  const [rep, setRep] = useState(1);
  const [phase, setPhase] = useState<Phase>('idle');
  const [flow, setFlow] = useState<ShadowFlow>(flowInit);
  const [repeat, setRepeat] = useState(repeatInit);
  const [speed, setSpeed] = useState(speedInit);
  const [subtitle, setSubtitle] = useState<ShadowSubtitle>(subtitleInit);
  const [roleTeams, setRoleTeams] = useState(roleTeamsInit);
  const [speakMs, setSpeakMs] = useState(0);
  const [ready, setReady] = useState(false);

  // 설정이 바뀌면(편집 화면에서 고칠 때) 따라간다
  useEffect(() => setFlow(flowInit), [flowInit]);
  useEffect(() => setRepeat(repeatInit), [repeatInit]);
  useEffect(() => setSpeed(speedInit), [speedInit]);
  useEffect(() => setSubtitle(subtitleInit), [subtitleInit]);
  useEffect(() => setRoleTeams(roleTeamsInit), [roleTeamsInit]);

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
        events: { onReady: () => setReady(true) },
      });
    });
    return () => {
      cancelled = true;
      clearTimers();
      playerRef.current?.destroy();
      playerRef.current = null;
      setReady(false);
    };
  }, [usePlayer, videoId, elementId]);

  useEffect(() => () => clearTimers(), []);

  /** i 번째 문장을 처음부터 듣기 */
  function playLine(i: number, repNo = 1) {
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
    player.seekTo(Math.max(0, line.start - 0.05), true);
    player.playVideo();
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
      else if (fl === 'auto' && i < ls.length - 1) playLine(i + 1, 1);
      else setPhase(i >= ls.length - 1 ? 'done' : 'wait');
    }, ms);
  }

  function stop() {
    clearTimers();
    playerRef.current?.pauseVideo();
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
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
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

  const ctl = 'flex items-center gap-[0.6cqh] rounded-full bg-white px-[1.6cqh] py-[0.8cqh] font-bold text-[#1f2937] shadow hover:bg-[#f1f5f9] disabled:opacity-40';

  return (
    <div className="flex h-full w-full items-center justify-center" style={{ containerType: 'size' }}>
      <CanvasStageBox fitParent className="rounded-xl bg-[#0f172a] shadow-[0_8px_28px_rgba(0,0,0,0.25)]">
        {/* 영상(위 66%) */}
        <div className="absolute left-0 right-0 top-0 h-[66%] bg-black">
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
          {usePlayer && phase === 'idle' && lines.length > 0 && (
            <button
              type="button"
              onClick={() => playLine(idx, 1)}
              disabled={!ready}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-[1.5cqh] bg-black/45 text-white"
            >
              <span className="flex h-[16cqh] w-[16cqh] items-center justify-center rounded-full bg-[#facc15] text-[#1f2937] shadow-lg">
                <span className="material-symbols-outlined" style={{ fontSize: '10cqh' }}>
                  play_arrow
                </span>
              </span>
              <span style={{ fontSize: '3cqh' }} className="font-bold">
                {ready ? t(flow === 'auto' ? 'curriculum.shadow.startAuto' : 'curriculum.shadow.startManual') : t('common.loading')}
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
                hearing
              </span>
              {t('curriculum.shadow.listen')}
            </div>
          )}
        </div>

        {/* 따라 말하기 시간 막대 */}
        <div className="absolute left-0 right-0 top-[66%] h-[0.9cqh] bg-[#e2e8f0]">
          {phase === 'speak' && (
            <div key={`${idx}-${rep}`} className="h-full bg-[#facc15]" style={{ animation: `shadow-bar ${speakMs}ms linear forwards` }} />
          )}
        </div>

        {/* 자막(아래) */}
        <div className="absolute bottom-[9cqh] left-0 right-0 top-[67%] bg-white">
          {lines.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[#64748b]" style={{ fontSize: '3cqh' }}>
              {t('curriculum.shadow.empty')}
            </div>
          ) : (
            subtitleBlock
          )}
        </div>

        {/* 조작 줄 */}
        <div className="absolute bottom-0 left-0 right-0 flex h-[9cqh] items-center gap-[1cqh] overflow-x-auto whitespace-nowrap bg-[#eef2f7] px-[1.5cqh]" style={{ fontSize: '2.2cqh' }}>
          {interactive && !follower && lines.length > 0 && (
            <>
              <button type="button" className={ctl} onClick={() => go(-1)} disabled={idx === 0} aria-label={t('curriculum.shadow.prev')}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.3em' }}>skip_previous</span>
              </button>
              {phase === 'listen' || phase === 'speak' ? (
                <button type="button" className={ctl} onClick={stop}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.3em' }}>pause</span>
                  {t('curriculum.shadow.pause')}
                </button>
              ) : (
                <button type="button" className={ctl} onClick={() => playLine(idx, 1)}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.3em' }}>replay</span>
                  {t('curriculum.shadow.replay')}
                </button>
              )}
              <button type="button" className={ctl} onClick={() => go(1)} disabled={idx >= lines.length - 1} aria-label={t('curriculum.shadow.next')}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.3em' }}>skip_next</span>
              </button>
              <span className="mx-[0.5cqh] h-[4cqh] w-px bg-[#cbd5e1]" />
              <div className="flex shrink-0 rounded-full bg-white p-[0.4cqh] shadow">
                {(['auto', 'manual'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFlow(f)}
                    className={`rounded-full px-[1.4cqh] py-[0.5cqh] font-bold ${flow === f ? 'bg-[#2563eb] text-white' : 'text-[#475569]'}`}
                  >
                    {t(`curriculum.shadow.flow_${f}`)}
                  </button>
                ))}
              </div>
              <select value={repeat} onChange={(e) => setRepeat(Number(e.target.value))} className="rounded-full bg-white px-[1.2cqh] py-[0.6cqh] font-bold text-[#1f2937] shadow">
                {SHADOW_REPEATS.map((n) => (
                  <option key={n} value={n}>
                    {t('curriculum.shadow.repeatN', { n })}
                  </option>
                ))}
              </select>
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded-full bg-white px-[1.2cqh] py-[0.6cqh] font-bold text-[#1f2937] shadow">
                {SHADOW_SPEEDS.map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>
              <select value={subtitle} onChange={(e) => setSubtitle(e.target.value as ShadowSubtitle)} className="rounded-full bg-white px-[1.2cqh] py-[0.6cqh] font-bold text-[#1f2937] shadow">
                {SHADOW_SUBTITLES.map((s) => (
                  <option key={s} value={s}>
                    {t(`curriculum.shadow.sub_${s}`)}
                  </option>
                ))}
              </select>
              {speakers.length > 1 && (
                <select value={roleTeams} onChange={(e) => setRoleTeams(Number(e.target.value))} className="rounded-full bg-white px-[1.2cqh] py-[0.6cqh] font-bold text-[#1f2937] shadow">
                  {[0, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? t('curriculum.shadow.rolesOff') : t('curriculum.shadow.rolesN', { n })}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
          {roleTeams > 0 && speakers.length > 1 && (
            <div className="ml-auto flex shrink-0 items-center gap-[0.6cqh]">
              {speakers.map((s) => (
                <span key={s} className="rounded-full px-[1.2cqh] py-[0.3cqh] font-bold text-white" style={{ background: TEAM_COLORS[teamOf(s) % TEAM_COLORS.length] }}>
                  {teamOf(s) + 1}·{s}
                </span>
              ))}
            </div>
          )}
        </div>
      </CanvasStageBox>
    </div>
  );
}
