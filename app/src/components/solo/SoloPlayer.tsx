import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { speak } from '../../lib/speech';
import { useYoutubeSegment } from '../../lib/useYoutubeSegment';
import RainbowSpeaking from '../rainbow/RainbowSpeaking';
import RainbowStructure from '../rainbow/RainbowStructure';
import { POS_HINT_KO, posFromKo, RAINBOW_THEME, SPEAKING_ITEMS, STRUCTURE_ITEMS, type StructureItem } from '../../lib/rainbow';
import type { SoloClip, SoloPublicStep } from '../../lib/soloLessons';

/**
 * 개별수업 플레이어 — 화면이 선생님이 되어 한 단계씩 이끈다. 학생 화면(/s/lesson)과 선생님 미리보기가 같이 쓴다.
 * 채점·기록은 api 가 한다(학생: 서버, 미리보기: 이 브라우저 안).
 *  - 고르기: 한 번 틀리면 "다시 해 볼까요?"(틀린 보기는 흐려짐), 두 번 틀리면 정답을 알려 준다.
 *  - 쓰기·문장 배열: 한 번 틀리면 힌트(첫 글자·글자 수), 두 번 틀리면 정답을 알려 준다.
 *  - "모르겠어요": 정답을 알려 주고 넘어간다(선생님 현황에 막힌 단계로 보인다).
 */
export interface SoloPlayerApi {
  /** 답 내기 → 맞았는지 */
  answer(step: number, value: string): Promise<boolean>;
  /** 단계를 끝냈다고 알리기(모르겠어요면 unsure) → 정답 글자(모르겠어요일 때) */
  advance(step: number, unsure: boolean): Promise<{ answer: string | null }>;
  /** 두 번 틀린 뒤 정답 보기 */
  reveal(step: number): Promise<string | null>;
  /** 따라 부른 녹음 보내기(보호자 동의가 있는 학생만) — 실패하면 false */
  record?(step: number, blob: Blob, seconds: number, sub?: number): Promise<boolean>;
}

type Phase = 'ask' | 'right' | 'wrong1' | 'shown';

const btn = 'min-h-14 rounded-2xl px-5 text-xl font-bold [touch-action:manipulation] disabled:opacity-40';
const CHOICE = ['pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect', 'lyricBlank', 'sayPick', 'pickPos'];
/** 문장에서 낱말(첫 번째로 나오는 것)을 노랗게 표시 */
function highlightWord(sentence: string, word: string) {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`\\b${esc}\\b`, 'i').exec(sentence);
  if (!m) return sentence;
  return (
    <>
      {sentence.slice(0, m.index)}
      <span className="rounded-lg bg-warm-yellow px-2 text-deep-navy">{m[0]}</span>
      {sentence.slice(m.index + m[0].length)}
    </>
  );
}

/** 낱말의 품사(명사·동사 …) — 색은 무지개 문법의 품사색과 같다. 어휘를 알아도 품사를 모르면 쓰지 못하므로 만날 때 같이 알려 준다. */
function PosBadge({ pos }: { pos: string }) {
  const c = RAINBOW_THEME.pos[posFromKo(pos) ?? 'other'];
  const hint = POS_HINT_KO[pos];
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="rounded-full px-5 py-1 text-xl font-bold text-deep-navy"
        style={{ background: c?.bg ?? '#E5E7EB', borderBottom: `3px solid ${c?.line ?? '#9CA3AF'}` }}
      >
        {pos}
      </span>
      {hint && <span className="text-base text-white/70">{hint}</span>}
    </div>
  );
}

const QUESTION = [...CHOICE, 'spell', 'typeWord', 'dictation', 'unscramble'];

export default function SoloPlayer({
  steps,
  startAt = 0,
  api,
  onExit,
  preview = false,
  canRecord = false,
}: {
  steps: SoloPublicStep[];
  startAt?: number;
  api: SoloPlayerApi;
  onExit: () => void;
  preview?: boolean;
  /** 이 학생의 녹음을 서버에 보관해도 되는지(보호자 동의) */
  canRecord?: boolean;
}) {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(() => Math.min(startAt, Math.max(0, steps.length - 1)));
  const [phase, setPhase] = useState<Phase>('ask');
  const [wrong, setWrong] = useState<number[]>([]);
  const [shownAnswer, setShownAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(startAt >= steps.length && steps.length > 0);
  const [stats, setStats] = useState({ right: 0, unsure: 0 });
  const [error, setError] = useState(false);
  const [typed, setTyped] = useState<number[]>([]);
  const [text, setText] = useState('');
  const [heard, setHeard] = useState(false);
  const [showKo, setShowKo] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const attempts = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const step = steps[idx];

  // 노래·영상 단계가 쓰는 유튜브 플레이어(수업 하나에 영상 하나) — 한 번만 만들고 구간만 바꿔 튼다
  const videoId = useMemo(() => {
    for (const st of steps) {
      const c = (st as { clip?: SoloClip }).clip;
      if (c) return c.videoId;
    }
    return null;
  }, [steps]);
  const yt = useYoutubeSegment(videoId);
  const clip = (step as { clip?: SoloClip } | undefined)?.clip ?? null;
  const [clipPlaying, setClipPlaying] = useState(false);

  async function playClip(c: SoloClip, fallback?: string) {
    setClipPlaying(true);
    try {
      if (yt.ready && !yt.failed) await yt.playSegment(c.start, c.end);
      else if (fallback) speak(fallback);
    } finally {
      setClipPlaying(false);
    }
  }

  // 따라 부르기 녹음(이 기기에서 듣기, 동의가 있으면 서버에도 보관)
  const [mic, setMic] = useState<'unknown' | 'asking' | 'ready' | 'denied' | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'MediaRecorder' in window && typeof navigator.mediaDevices?.getUserMedia === 'function' ? 'unknown' : 'unsupported',
  );
  const [recording, setRecording] = useState(false);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<'no' | 'yes' | 'fail'>('no');
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<{ blob: Blob; seconds: number } | null>(null);
  const recStartedAt = useRef(0);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    },
    [],
  );
  useEffect(
    () => () => {
      if (clipUrl) URL.revokeObjectURL(clipUrl);
    },
    [clipUrl],
  );

  async function enableMic() {
    setMic('asking');
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMic('ready');
    } catch {
      setMic('denied');
    }
  }

  function toggleRecord(maxSeconds: number) {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    if (!streamRef.current) return;
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(streamRef.current);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      setRecording(false);
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      blobRef.current = { blob, seconds: Math.round(((Date.now() - recStartedAt.current) / 1000) * 10) / 10 };
      setUploaded('no');
      setClipUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    };
    recRef.current = rec;
    recStartedAt.current = Date.now();
    rec.start();
    setRecording(true);
    window.setTimeout(() => rec.state === 'recording' && rec.stop(), Math.max(5000, maxSeconds * 1000 + 4000));
  }

  /** 한 줄을 다 불렀으면 녹음을 보내고(동의가 있고 서버가 받을 때) 다음으로 */
  async function uploadRecording(sub = 0): Promise<void> {
    const rec = blobRef.current;
    if (rec && canRecord && api.record) {
      const ok = await guard(() => api.record!(idx, rec.blob, rec.seconds, sub));
      setUploaded(ok ? 'yes' : 'fail');
    }
    blobRef.current = null;
    setClipUrl(null);
  }

  async function finishSing() {
    await uploadRecording(0);
    await next();
  }

  /* 끝 낱말부터 지우며 말하기(fadeRead): 라운드마다 가려지는 낱말이 늘고, 마지막은 한국어 뜻만 보고 전체를 말한다 */
  const [round, setRound] = useState(0);
  const [peek, setPeek] = useState(false);
  const fadeWords = useMemo(() => (step && step.t === 'fadeRead' ? step.sentence.split(/\s+/).filter(Boolean) : []), [step]);
  const fadeHidden = useMemo(() => {
    const n = fadeWords.length;
    if (n === 0) return [0];
    const per = Math.max(1, Math.ceil(n / 4));
    const list: number[] = [0];
    for (let h = per; h < n; h += per) list.push(h);
    list.push(n);
    return list;
  }, [fadeWords]);

  // 역할극: 1번 읽기(내 대사도 보임) → 2번 내 대사 숨기고 말하기
  const [rpPass, setRpPass] = useState<1 | 2>(1);
  const [rpTurn, setRpTurn] = useState(0);
  const [rpPeek, setRpPeek] = useState(false);

  // 새 단계로 올 때: 상태 비우고, 소리 나는 단계는 자동으로 읽어 준다
  useEffect(() => {
    setPhase('ask');
    setWrong([]);
    setShownAnswer(null);
    setTyped([]);
    setText('');
    setHeard(false);
    setShowKo(false);
    setAdvanced(false);
    setError(false);
    setClipUrl(null);
    setUploaded('no');
    blobRef.current = null;
    setRound(0);
    setPeek(false);
    setRpPass(1);
    setRpTurn(0);
    setRpPeek(false);
    attempts.current = 0;
    if (!step) return;
    if (step.t === 'fadeRead') speak(step.sentence);
    if (step.t === 'meet' || step.t === 'listenPick' || step.t === 'pickMeaning' || step.t === 'dictation') speak(step.word);
    if (step.t === 'example') speak(step.sentence);
    if (step.t === 'pickPos') speak(step.sentence ?? step.word);
    if (step.t === 'translatePick') speak(step.sentence);
  }, [idx, step]);

  const guard = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setError(false);
    try {
      return await fn();
    } catch {
      setError(true);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  async function next(unsure = false) {
    const r = await guard(() => api.advance(idx, unsure));
    if (r === null) return;
    if (unsure) {
      setStats((s) => ({ ...s, unsure: s.unsure + 1 }));
      setAdvanced(true);
      setShownAnswer(r.answer);
      setPhase('shown');
      return;
    }
    goOn();
  }

  function goOn() {
    if (idx + 1 >= steps.length) setFinished(true);
    else setIdx(idx + 1);
  }

  /** 답을 서버에 내고 맞았는지에 따라 단계 상태를 바꾼다 */
  async function submit(value: string, onWrong?: () => void) {
    const ok = await guard(() => api.answer(idx, value));
    if (ok === null) return;
    attempts.current += 1;
    if (ok) {
      setPhase('right');
      setStats((s) => ({ ...s, right: s.right + 1 }));
      return;
    }
    onWrong?.();
    if (attempts.current >= 2) await showAnswer();
    else setPhase('wrong1');
  }

  async function showAnswer() {
    const a = await guard(() => api.reveal(idx));
    if (a === null) return;
    setShownAnswer(a);
    setPhase('shown');
  }

  async function choose(i: number) {
    if (busy || phase === 'right' || phase === 'shown' || wrong.includes(i)) return;
    await submit(String(i), () => setWrong((w) => [...w, i]));
  }

  async function checkSpell() {
    if (!step || step.t !== 'spell') return;
    await submit(typed.map((n) => step.letters[n]).join(''), () => setTyped([]));
  }

  async function checkUnscramble() {
    if (!step || step.t !== 'unscramble') return;
    await submit(typed.map((n) => step.words[n]).join(' '), () => setTyped([]));
  }

  async function checkText() {
    if (!text.trim()) return;
    await submit(text.trim(), () => {
      setText('');
      inputRef.current?.focus();
    });
  }

  const percent = useMemo(() => (steps.length ? Math.round((Math.min(idx, steps.length) / steps.length) * 100) : 0), [idx, steps.length]);

  if (finished) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-[#16213e] p-6 text-center text-white">
        <div className="text-7xl">🎉</div>
        <h1 className="text-4xl font-bold">{t('solo.finishTitle')}</h1>
        <p className="text-xl text-white/80">{t('solo.finishStats', { right: stats.right, unsure: stats.unsure })}</p>
        <button type="button" onClick={onExit} className={`${btn} bg-warm-yellow text-deep-navy`}>
          {preview ? t('solo.closePreview') : t('solo.backHome')}
        </button>
      </div>
    );
  }
  if (!step) return null;

  const isQuestion = QUESTION.includes(step.t);
  const answered = phase === 'right' || phase === 'shown';
  const hintFirst = phase === 'wrong1' && (step.t === 'typeWord' || step.t === 'dictation');

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#16213e] text-white">
      <header className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onExit} aria-label={t('solo.exit')} className="rounded-full p-2 text-white/70 hover:bg-white/10">
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-warm-yellow transition-all" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-sm tabular-nums text-white/70">
          {idx + 1}/{steps.length}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-5 px-5 pb-6 pt-2">
        {/* 노래·영상 플레이어: 수업 안에서 계속 켜 두고, 영상이 필요한 단계에서만 보여 준다 */}
        {videoId && (
          <div
            className={
              clip
                ? `relative aspect-video w-full overflow-hidden rounded-2xl bg-black ${yt.failed ? 'hidden' : ''}`
                : 'pointer-events-none fixed -left-[9999px] top-0 h-48 w-80'
            }
          >
            <div id={yt.elementId} className="absolute inset-0 h-full w-full" />
          </div>
        )}
        {clip && yt.failed && <p className="rounded-xl bg-white/10 p-3 text-center text-sm text-white/80">{t('solo.videoFallback')}</p>}

        {step.t === 'watch' && (
          <>
            <p className="text-xl font-bold">{step.mode === 'listen' ? t('solo.watchListen') : t('solo.watchSing')}</p>
            <h2 className="text-center text-2xl font-bold text-warm-yellow">{step.title}</h2>
            <button type="button" disabled={clipPlaying} onClick={() => void playClip(step.clip)} className={`${btn} w-full bg-white/15 text-white`}>
              {clipPlaying ? t('solo.playing') : t('solo.play')}
            </button>
            <button type="button" disabled={busy} onClick={() => void next()} className={`${btn} w-full bg-warm-yellow text-deep-navy`}>
              {step.mode === 'listen' ? t('solo.heardAll') : t('solo.sangAll')}
            </button>
          </>
        )}

        {step.t === 'lyricBlank' && (
          <>
            <p className="text-xl font-bold">{t('solo.lyricQ')}</p>
            <button type="button" disabled={clipPlaying} onClick={() => void playClip(step.clip, step.sentence.replace('_____', ' '))} className="flex items-center gap-2 rounded-full bg-warm-yellow px-6 py-3 text-xl font-bold text-deep-navy disabled:opacity-60">
              <span className="material-symbols-outlined">{clipPlaying ? 'graphic_eq' : 'play_arrow'}</span>
              {t('solo.listenLine')}
            </button>
            <p className="rounded-2xl bg-white/10 px-4 py-4 text-center text-2xl font-bold leading-snug">{step.sentence}</p>
            {step.ko && <p className="text-lg text-white/70">{step.ko}</p>}
            <Options options={step.options} wrong={wrong} phase={phase} onPick={(i) => void choose(i)} />
          </>
        )}

        {step.t === 'lineSing' && (
          <>
            <p className="text-lg text-white/70">{t('solo.singPrompt')}</p>
            <p className="rounded-2xl bg-white/10 px-4 py-4 text-center text-3xl font-bold leading-snug">{step.en}</p>
            {step.ko && (showKo ? (
              <p className="text-xl text-white/85">{step.ko}</p>
            ) : (
              <button type="button" onClick={() => setShowKo(true)} className="rounded-full border border-white/30 px-4 py-1.5 text-base text-white/85">
                {t('solo.showKo')}
              </button>
            ))}
            <button type="button" disabled={clipPlaying} onClick={() => void playClip(step.clip, step.en)} className={`${btn} w-full bg-white/15 text-white`}>
              {clipPlaying ? t('solo.playing') : t('solo.listenLine')}
            </button>
            {mic === 'unknown' && (
              <div className="w-full rounded-2xl bg-white/10 p-3 text-sm text-white/85">
                <p>{t('solo.micExplain')}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => void enableMic()} className={`${btn} flex-1 bg-white text-deep-navy`}>
                    {t('solo.micOn')}
                  </button>
                  <button type="button" onClick={() => setMic('unsupported')} className={`${btn} flex-1 bg-white/15 text-white`}>
                    {t('solo.micSkip')}
                  </button>
                </div>
              </div>
            )}
            {mic === 'denied' && <p className="text-center text-base text-white/70">{t('solo.micDenied')}</p>}
            {mic === 'ready' && (
              <button type="button" onClick={() => toggleRecord(step.clip.end - step.clip.start)} className={`${btn} w-full ${recording ? 'bg-rose-600' : 'bg-white/15'} text-white`}>
                <span className="material-symbols-outlined align-middle">{recording ? 'stop_circle' : 'mic'}</span> {recording ? t('solo.stopRecording') : t('solo.recordMe')}
              </button>
            )}
            {clipUrl && (
              <div className="flex w-full flex-col items-center gap-1">
                <span className="text-sm text-white/70">{t('solo.myVoice')}</span>
                <audio src={clipUrl} controls className="w-full" />
              </div>
            )}
            {uploaded === 'fail' && <p className="text-center text-sm text-warm-yellow">{t('solo.uploadFail')}</p>}
            {canRecord && mic === 'ready' && <p className="text-center text-xs text-white/50">{t('solo.recordSavedNote')}</p>}
            <button
              type="button"
              disabled={busy || recording || (mic === 'ready' && !clipUrl)}
              onClick={() => void finishSing()}
              className={`${btn} w-full bg-warm-yellow text-deep-navy`}
            >
              {t('solo.sangIt')}
            </button>
          </>
        )}

        {step.t === 'fadeRead' && (
          <>
            <p className="text-lg text-white/70">{round === fadeHidden.length - 1 ? t('solo.fadeLast') : round === 0 ? t('solo.fadeFirst') : t('solo.fadeMid')}</p>
            <Picture url={step.imageUrl ?? null} />
            {step.ko && <p className="text-center text-2xl font-bold leading-snug">{step.ko}</p>}
            <div className="flex w-full flex-wrap items-center justify-center gap-2 rounded-2xl bg-white/10 px-3 py-4" aria-live="polite">
              {fadeWords.map((w, i) => {
                const hidden = i >= fadeWords.length - fadeHidden[round] && !peek;
                return hidden ? (
                  <span key={i} className="inline-block h-9 rounded-lg border-b-4 border-warm-yellow/70 bg-white/5" style={{ width: `${Math.max(2.2, w.length * 0.95)}rem` }} />
                ) : (
                  <span key={i} className="text-3xl font-bold">
                    {w}
                  </span>
                );
              })}
            </div>
            <div className="flex w-full flex-wrap justify-center gap-2">
              <button type="button" onClick={() => speak(step.sentence)} className="flex items-center gap-2 rounded-full bg-white/15 px-5 py-2 text-lg font-bold">
                <span className="material-symbols-outlined">volume_up</span>
                {t('solo.listenAgain')}
              </button>
              {round > 0 && (
                <button type="button" onMouseDown={() => setPeek(true)} onMouseUp={() => setPeek(false)} onMouseLeave={() => setPeek(false)} onTouchStart={() => setPeek(true)} onTouchEnd={() => setPeek(false)} className="rounded-full border border-white/30 px-5 py-2 text-lg text-white/85">
                  {t('solo.peek')}
                </button>
              )}
            </div>
            <div className="flex gap-1.5" aria-hidden>
              {fadeHidden.map((_, i) => (
                <span key={i} className={`h-2.5 w-2.5 rounded-full ${i <= round ? 'bg-warm-yellow' : 'bg-white/20'}`} />
              ))}
            </div>
            {round === fadeHidden.length - 1 && (
              <>
                {mic === 'unknown' && (
                  <div className="w-full rounded-2xl bg-white/10 p-3 text-sm text-white/85">
                    <p>{t('solo.micExplain')}</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => void enableMic()} className={`${btn} flex-1 bg-white text-deep-navy`}>
                        {t('solo.micOn')}
                      </button>
                      <button type="button" onClick={() => setMic('unsupported')} className={`${btn} flex-1 bg-white/15 text-white`}>
                        {t('solo.micSkip')}
                      </button>
                    </div>
                  </div>
                )}
                {mic === 'ready' && (
                  <button type="button" onClick={() => toggleRecord(Math.max(4, fadeWords.length))} className={`${btn} w-full ${recording ? 'bg-rose-600' : 'bg-white/15'} text-white`}>
                    <span className="material-symbols-outlined align-middle">{recording ? 'stop_circle' : 'mic'}</span> {recording ? t('solo.stopRecording') : t('solo.recordMe')}
                  </button>
                )}
                {clipUrl && <audio src={clipUrl} controls className="w-full" />}
                {uploaded === 'fail' && <p className="text-center text-sm text-warm-yellow">{t('solo.uploadFail')}</p>}
              </>
            )}
            <button
              type="button"
              disabled={busy || recording}
              onClick={async () => {
                if (round < fadeHidden.length - 1) {
                  setRound(round + 1);
                  setPeek(false);
                  return;
                }
                await uploadRecording(0);
                await next();
              }}
              className={`${btn} w-full bg-warm-yellow text-deep-navy`}
            >
              {round < fadeHidden.length - 1 ? t('solo.saidNext') : t('solo.saidIt')}
            </button>
          </>
        )}

        {step.t === 'sayPick' && (
          <>
            <p className="text-xl font-bold">{t('solo.sayPickQ')}</p>
            <Picture url={step.imageUrl ?? null} />
            <p className="rounded-2xl bg-white/10 px-4 py-3 text-center text-2xl font-bold leading-snug">{step.situation}</p>
            <Options options={step.options} wrong={wrong} phase={phase} onPick={(i) => void choose(i)} />
          </>
        )}

        {(step.t === 'rainbowSpeak' || step.t === 'rainbowStructure') && (() => {
          const sp = step.t === 'rainbowSpeak' ? SPEAKING_ITEMS.find((i) => i.id === step.itemId) : null;
          const st = step.t === 'rainbowStructure' ? STRUCTURE_ITEMS.find((i) => i.id === step.itemId) : null;
          if (!sp && !st) {
            return (
              <button type="button" onClick={() => void next()} className={`${btn} bg-warm-yellow text-deep-navy`}>
                {t('solo.next')}
              </button>
            );
          }
          return (
            <div className="relative h-[min(76dvh,680px)] w-full">
              {sp ? (
                <RainbowSpeaking key={idx} items={[sp]} compact onComplete={() => void next()} />
              ) : (
                <RainbowStructure key={idx} items={[st as StructureItem]} compact onComplete={() => void next()} />
              )}
            </div>
          );
        })()}

        {step.t === 'roleplay' && (() => {
          const lines = step.lines;
          const line = lines[rpTurn];
          const mine = line?.who === 'me';
          const hideMine = rpPass === 2 && mine && !rpPeek;
          const advanceTurn = async () => {
            if (rpTurn + 1 < lines.length) {
              setRpTurn(rpTurn + 1);
              setRpPeek(false);
              setClipUrl(null);
              blobRef.current = null;
              return;
            }
            if (rpPass === 1) {
              setRpPass(2);
              setRpTurn(0);
              setRpPeek(false);
              return;
            }
            await next();
          };
          return (
            <>
              <Picture url={step.imageUrl ?? null} />
              <p className="text-lg text-white/70">{rpPass === 1 ? t('solo.rpPass1') : t('solo.rpPass2')}</p>
              <div className="flex w-full flex-col gap-2">
                {lines.slice(0, rpTurn + 1).map((l, i) => {
                  const isCur = i === rpTurn;
                  const hide = rpPass === 2 && l.who === 'me' && (!isCur || !rpPeek);
                  return (
                    <div key={i} className={`flex ${l.who === 'me' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${l.who === 'me' ? 'bg-warm-yellow text-deep-navy' : 'bg-white/15'} ${isCur ? 'ring-2 ring-white/60' : 'opacity-80'}`}>
                        <div className="text-xs opacity-70">{l.speaker}</div>
                        <div className="text-xl font-bold leading-snug">{hide ? <span className="opacity-60">{l.ko}</span> : l.en}</div>
                        {!hide && l.ko && <div className="mt-0.5 text-sm opacity-70">{l.ko}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {line && (
                <div className="flex w-full flex-col gap-2">
                  {!mine && (
                    <button type="button" onClick={() => speak(line.en)} className="flex items-center justify-center gap-2 rounded-full bg-white/15 px-5 py-2 text-lg font-bold">
                      <span className="material-symbols-outlined">volume_up</span>
                      {t('solo.listenAgain')}
                    </button>
                  )}
                  {mine && (
                    <>
                      {rpPass === 1 && (
                        <button type="button" onClick={() => speak(line.en)} className="flex items-center justify-center gap-2 rounded-full bg-white/15 px-5 py-2 text-lg font-bold">
                          <span className="material-symbols-outlined">volume_up</span>
                          {t('solo.listenAgain')}
                        </button>
                      )}
                      {rpPass === 2 && hideMine && (
                        <button type="button" onClick={() => setRpPeek(true)} className="rounded-full border border-white/30 px-5 py-2 text-lg text-white/85">
                          {t('solo.showAnswer')}
                        </button>
                      )}
                      {rpPass === 2 && mic === 'unknown' && (
                        <div className="w-full rounded-2xl bg-white/10 p-3 text-sm text-white/85">
                          <p>{t('solo.micExplain')}</p>
                          <div className="mt-2 flex gap-2">
                            <button type="button" onClick={() => void enableMic()} className={`${btn} flex-1 bg-white text-deep-navy`}>
                              {t('solo.micOn')}
                            </button>
                            <button type="button" onClick={() => setMic('unsupported')} className={`${btn} flex-1 bg-white/15 text-white`}>
                              {t('solo.micSkip')}
                            </button>
                          </div>
                        </div>
                      )}
                      {rpPass === 2 && mic === 'ready' && (
                        <button type="button" onClick={() => toggleRecord(Math.max(4, line.en.split(/\s+/).length))} className={`${btn} w-full ${recording ? 'bg-rose-600' : 'bg-white/15'} text-white`}>
                          <span className="material-symbols-outlined align-middle">{recording ? 'stop_circle' : 'mic'}</span> {recording ? t('solo.stopRecording') : t('solo.recordMe')}
                        </button>
                      )}
                      {rpPass === 2 && clipUrl && <audio src={clipUrl} controls className="w-full" />}
                    </>
                  )}
                  <button
                    type="button"
                    disabled={busy || recording}
                    onClick={async () => {
                      if (rpPass === 2 && mine) await uploadRecording(rpTurn);
                      if (mine && rpPass === 1) speak(line.en);
                      await advanceTurn();
                    }}
                    className={`${btn} w-full bg-warm-yellow text-deep-navy`}
                  >
                    {mine ? t('solo.saidIt') : t('solo.next')}
                  </button>
                  {mic === 'ready' && canRecord && rpPass === 2 && mine && <p className="text-center text-xs text-white/50">{t('solo.recordSavedNote')}</p>}
                </div>
              )}
            </>
          );
        })()}

        {step.t === 'intro' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            {step.imageUrl ? <Picture url={step.imageUrl} wide /> : <div className="text-6xl">📚</div>}
            <h1 className="text-3xl font-bold">{step.title}</h1>
            <p className="max-w-sm text-xl text-white/85">{/^\d+$/.test(step.text) ? t('solo.introText', { count: Number(step.text) || 0 }) : step.text}</p>
            <button type="button" disabled={busy} onClick={() => void next()} className={`${btn} bg-warm-yellow px-10 text-deep-navy`}>
              {t('solo.start')}
            </button>
          </div>
        )}

        {step.t === 'meet' && (
          <>
            <p className="text-lg text-white/70">{t('solo.meetPrompt')}</p>
            <Picture url={step.imageUrl} />
            <button type="button" onClick={() => { speak(step.word); setHeard(true); }} className="flex items-center gap-3 rounded-2xl bg-white/10 px-6 py-3 text-5xl font-bold">
              <span className="material-symbols-outlined text-[40px] text-warm-yellow">volume_up</span>
              {step.word}
            </button>
            {step.pos && <PosBadge pos={step.pos} />}
            <p className="text-2xl text-white/85">{step.meaning}</p>
            {step.example && (
              <button type="button" onClick={() => speak(step.example ?? '')} className="rounded-xl bg-white/5 px-4 py-2 text-lg text-white/75">
                🔊 {step.example}
              </button>
            )}
            <p className="mt-1 text-center text-lg text-warm-yellow">{t('solo.sayIt')}</p>
            <button type="button" disabled={busy} onClick={() => void next()} className={`${btn} w-full bg-warm-yellow text-deep-navy`}>
              {heard ? t('solo.saidIt') : t('solo.saidItFirst')}
            </button>
          </>
        )}

        {step.t === 'rule' && (
          <>
            <p className="text-lg text-white/70">{t('solo.rulePrompt')}</p>
            <h2 className="text-center text-2xl font-bold">{step.title}</h2>
            <div className="w-full rounded-2xl bg-white/10 px-4 py-4 text-center text-2xl font-bold text-warm-yellow">{step.pattern}</div>
            <p className="text-center text-lg text-white/85">{step.explain}</p>
            {step.lines.length > 0 && (
              <ul className="w-full list-disc space-y-1.5 rounded-2xl bg-white/5 py-3 pl-8 pr-4 text-left text-lg text-white/85">
                {step.lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
            {step.tip && <p className="text-center text-xl font-bold text-emerald-200">💡 {step.tip}</p>}
            <button type="button" disabled={busy} onClick={() => void next()} className={`${btn} w-full bg-warm-yellow text-deep-navy`}>
              {t('solo.readIt')}
            </button>
          </>
        )}

        {step.t === 'example' && (
          <>
            <p className="text-lg text-white/70">{t('solo.examplePrompt')}</p>
            <button type="button" onClick={() => { speak(step.sentence); setHeard(true); }} className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-5 py-5 text-left text-3xl font-bold leading-snug">
              <span className="material-symbols-outlined shrink-0 text-[36px] text-warm-yellow">volume_up</span>
              {step.sentence}
            </button>
            {step.ko &&
              (showKo ? (
                <p className="text-2xl text-white/90">{step.ko}</p>
              ) : (
                <button type="button" onClick={() => setShowKo(true)} className="rounded-full border border-white/30 px-5 py-2 text-lg text-white/85">
                  {t('solo.showKo')}
                </button>
              ))}
            <p className="text-center text-lg text-warm-yellow">{t('solo.readAloud')}</p>
            <button type="button" disabled={busy} onClick={() => void next()} className={`${btn} w-full bg-warm-yellow text-deep-navy`}>
              {t('solo.readIt')}
            </button>
          </>
        )}

        {step.t === 'pickWord' && (
          <>
            <p className="text-xl font-bold">{t('solo.pickWordQ')}</p>
            <Picture url={step.imageUrl} />
            {!step.imageUrl && <p className="text-3xl font-bold">{step.meaning}</p>}
            <Options options={step.options} wrong={wrong} phase={phase} onPick={(i) => void choose(i)} />
          </>
        )}

        {step.t === 'pickMeaning' && (
          <>
            <p className="text-xl font-bold">{t('solo.pickMeaningQ')}</p>
            <Picture url={step.imageUrl} />
            <button type="button" onClick={() => speak(step.word)} className="flex items-center gap-3 rounded-2xl bg-white/10 px-6 py-3 text-5xl font-bold">
              <span className="material-symbols-outlined text-[40px] text-warm-yellow">volume_up</span>
              {step.word}
            </button>
            <Options options={step.options} wrong={wrong} phase={phase} onPick={(i) => void choose(i)} />
          </>
        )}

        {step.t === 'pickPos' && (
          <>
            <p className="text-xl font-bold">{step.sentence ? t('solo.pickPosSentenceQ') : t('solo.pickPosQ')}</p>
            {step.sentence ? (
              <button type="button" onClick={() => speak(step.sentence ?? '')} className="rounded-2xl bg-white/10 px-5 py-4 text-center text-3xl font-bold leading-snug">
                {highlightWord(step.sentence, step.word)}
              </button>
            ) : (
              <button type="button" onClick={() => speak(step.word)} className="flex items-center gap-3 rounded-2xl bg-white/10 px-6 py-3 text-5xl font-bold">
                <span className="material-symbols-outlined text-[40px] text-warm-yellow">volume_up</span>
                {step.word}
              </button>
            )}
            <Options options={step.options} wrong={wrong} phase={phase} onPick={(i) => void choose(i)} />
          </>
        )}

        {step.t === 'listenPick' && (
          <>
            <p className="text-xl font-bold">{t('solo.listenQ')}</p>
            <button type="button" onClick={() => speak(step.word)} className="flex items-center gap-2 rounded-full bg-warm-yellow px-6 py-3 text-xl font-bold text-deep-navy">
              <span className="material-symbols-outlined">volume_up</span>
              {t('solo.listenAgain')}
            </button>
            <div className="grid w-full grid-cols-2 gap-3">
              {step.options.map((o, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={wrong.includes(i) || answered}
                  onClick={() => void choose(i)}
                  className={`flex min-h-32 flex-col items-center justify-center gap-1 rounded-2xl p-2 ${wrong.includes(i) ? 'bg-white/10 opacity-40' : 'bg-white text-deep-navy'} [touch-action:manipulation]`}
                >
                  {step.images[i] ? <img src={step.images[i] ?? ''} alt="" className="h-24 w-24 object-contain" /> : <span className="text-2xl font-bold">{o}</span>}
                  {answered && step.images[i] && <span className="text-base font-bold">{o}</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {step.t === 'spell' && (
          <>
            <p className="text-xl font-bold">{t('solo.spellQ')}</p>
            <Picture url={step.imageUrl} />
            <p className="text-2xl text-white/85">{step.meaning}</p>
            <div className="flex min-h-16 flex-wrap items-center justify-center gap-2" aria-live="polite">
              {step.letters.map((_, slot) => (
                <span key={slot} className="flex h-14 w-12 items-center justify-center rounded-xl border-2 border-white/40 bg-white/10 text-3xl font-bold">
                  {typed[slot] !== undefined ? step.letters[typed[slot]] : ''}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {step.letters.map((l, n) => (
                <button
                  key={n}
                  type="button"
                  disabled={typed.includes(n) || answered || busy}
                  onClick={() => setTyped((a) => [...a, n])}
                  className="h-14 w-12 rounded-xl bg-white text-3xl font-bold text-deep-navy shadow-[0_4px_0_#9aa3b5] [touch-action:manipulation] disabled:opacity-30"
                >
                  {l}
                </button>
              ))}
            </div>
            {!answered && (
              <div className="flex w-full gap-3">
                <button type="button" onClick={() => setTyped((a) => a.slice(0, -1))} disabled={typed.length === 0} className={`${btn} flex-1 bg-white/15`}>
                  {t('solo.erase')}
                </button>
                <button type="button" onClick={() => void checkSpell()} disabled={typed.length !== step.letters.length || busy} className={`${btn} flex-1 bg-warm-yellow text-deep-navy`}>
                  {t('solo.check')}
                </button>
              </div>
            )}
          </>
        )}

        {(step.t === 'typeWord' || step.t === 'dictation') && (
          <>
            {step.t === 'typeWord' ? (
              <>
                <p className="text-xl font-bold">{t('solo.typeQ')}</p>
                <Picture url={step.imageUrl} />
                <p className="text-3xl font-bold">{step.meaning}</p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold">{t('solo.dictationQ')}</p>
                <button type="button" onClick={() => speak(step.word)} className="flex items-center gap-2 rounded-full bg-warm-yellow px-6 py-3 text-xl font-bold text-deep-navy">
                  <span className="material-symbols-outlined">volume_up</span>
                  {t('solo.listenAgain')}
                </button>
              </>
            )}
            <p className="font-mono text-2xl tracking-[0.3em] text-white/60" aria-label={t('solo.lettersHint', { n: step.length })}>
              {hintFirst && step.t === 'typeWord' ? `${step.first}${'_'.repeat(Math.max(0, step.length - 1))}` : '_'.repeat(step.length)}
            </p>
            {!answered && (
              <form
                className="flex w-full flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void checkText();
                }}
              >
                <input
                  ref={inputRef}
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="min-h-14 w-full rounded-2xl bg-white px-4 text-center text-3xl font-bold text-deep-navy outline-none focus:ring-4 focus:ring-warm-yellow"
                />
                <button type="submit" disabled={!text.trim() || busy} className={`${btn} bg-warm-yellow text-deep-navy`}>
                  {t('solo.check')}
                </button>
              </form>
            )}
          </>
        )}

        {step.t === 'fillBlank' && (
          <>
            <p className="text-xl font-bold">{t('solo.fillQ')}</p>
            <p className="rounded-2xl bg-white/10 px-4 py-4 text-center text-2xl font-bold leading-snug">{step.sentence}</p>
            <p className="text-lg text-white/70">{step.meaning}</p>
            <Options options={step.options} wrong={wrong} phase={phase} onPick={(i) => void choose(i)} />
          </>
        )}

        {step.t === 'translatePick' && (
          <>
            <p className="text-xl font-bold">{t('solo.translateQ')}</p>
            <button type="button" onClick={() => speak(step.sentence)} className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-5 py-4 text-left text-2xl font-bold leading-snug">
              <span className="material-symbols-outlined shrink-0 text-[32px] text-warm-yellow">volume_up</span>
              {step.sentence}
            </button>
            <Options options={step.options} wrong={wrong} phase={phase} onPick={(i) => void choose(i)} />
          </>
        )}

        {step.t === 'pickCorrect' && (
          <>
            <p className="text-xl font-bold">{t('solo.correctQ')}</p>
            <Options options={step.options} wrong={wrong} phase={phase} onPick={(i) => void choose(i)} />
            {answered && step.why && <p className="text-center text-lg text-white/80">💡 {step.why}</p>}
          </>
        )}

        {step.t === 'unscramble' && (
          <>
            <p className="text-xl font-bold">{t('solo.unscrambleQ')}</p>
            {step.clip && (
              <button type="button" disabled={clipPlaying} onClick={() => void playClip(step.clip!)} className="flex items-center gap-2 rounded-full bg-warm-yellow px-5 py-2 text-lg font-bold text-deep-navy disabled:opacity-60">
                <span className="material-symbols-outlined">{clipPlaying ? 'graphic_eq' : 'play_arrow'}</span>
                {t('solo.listenLine')}
              </button>
            )}
            <div className="flex min-h-20 w-full flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/30 p-3" aria-live="polite">
              {typed.map((n, k) => (
                <button key={k} type="button" disabled={answered} onClick={() => setTyped((a) => a.filter((_, j) => j !== k))} className="rounded-xl bg-white px-3 py-2 text-2xl font-bold text-deep-navy">
                  {step.words[n]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {step.words.map((w, n) => (
                <button
                  key={n}
                  type="button"
                  disabled={typed.includes(n) || answered || busy}
                  onClick={() => setTyped((a) => [...a, n])}
                  className="rounded-xl bg-white/90 px-3 py-2 text-2xl font-bold text-deep-navy shadow-[0_4px_0_#9aa3b5] [touch-action:manipulation] disabled:opacity-30"
                >
                  {w}
                </button>
              ))}
            </div>
            {!answered && (
              <div className="flex w-full gap-3">
                <button type="button" onClick={() => setTyped((a) => a.slice(0, -1))} disabled={typed.length === 0} className={`${btn} flex-1 bg-white/15`}>
                  {t('solo.erase')}
                </button>
                <button type="button" onClick={() => void checkUnscramble()} disabled={typed.length !== step.words.length || busy} className={`${btn} flex-1 bg-warm-yellow text-deep-navy`}>
                  {t('solo.check')}
                </button>
              </div>
            )}
          </>
        )}

        {/* 결과 말풍선 */}
        {isQuestion && phase === 'wrong1' && <Banner tone="try">{hintFirst ? t('solo.tryAgainHint') : t('solo.tryAgain')}</Banner>}
        {isQuestion && phase === 'right' && <Banner tone="ok">{t('solo.great')}</Banner>}
        {isQuestion && phase === 'shown' && (
          <Banner tone="show">
            {t('solo.answerIs')} <span className="font-bold">{shownAnswer ?? ''}</span>
          </Banner>
        )}
        {error && <p className="text-center text-lg text-warm-yellow" role="alert">{t('solo.error')}</p>}

        {isQuestion && answered && (
          <button type="button" disabled={busy} onClick={() => (phase === 'right' || !advanced ? void next() : goOn())} className={`${btn} w-full bg-warm-yellow text-deep-navy`}>
            {t('solo.next')}
          </button>
        )}

        {step.t !== 'intro' && step.t !== 'watch' && step.t !== 'lineSing' && step.t !== 'fadeRead' && step.t !== 'roleplay' && step.t !== 'rainbowSpeak' && step.t !== 'rainbowStructure' && !answered && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void next(true)}
            className="mt-auto rounded-full border border-white/30 px-5 py-2 text-base text-white/80 hover:bg-white/10"
          >
            {t('solo.dontKnow')}
          </button>
        )}
        {!isQuestion && phase === 'shown' && (
          <button type="button" onClick={goOn} className={`${btn} w-full bg-warm-yellow text-deep-navy`}>
            {t('solo.next')}
          </button>
        )}
        {preview && <p className="text-sm text-white/50">{t('solo.previewNote')}</p>}
      </main>
    </div>
  );
}

function Picture({ url, wide = false }: { url: string | null; wide?: boolean }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) return null;
  return (
    <img
      src={url}
      alt=""
      onError={() => setBroken(true)}
      className={wide ? 'w-full max-w-md rounded-3xl bg-white object-cover' : 'max-h-56 w-full max-w-sm rounded-3xl bg-white object-contain p-2 sm:max-h-64'}
    />
  );
}

function Options({ options, wrong, phase, onPick }: { options: string[]; wrong: number[]; phase: Phase; onPick: (i: number) => void }) {
  return (
    <div className="grid w-full gap-3">
      {options.map((o, i) => (
        <button
          key={i}
          type="button"
          disabled={wrong.includes(i) || phase === 'right' || phase === 'shown'}
          onClick={() => onPick(i)}
          className={`min-h-16 rounded-2xl px-4 py-2 text-xl font-bold leading-snug [touch-action:manipulation] sm:text-2xl ${wrong.includes(i) ? 'bg-white/10 text-white/40 line-through' : 'bg-white text-deep-navy shadow-[0_4px_0_#9aa3b5] active:translate-y-0.5 active:shadow-none'}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Banner({ tone, children }: { tone: 'ok' | 'try' | 'show'; children: React.ReactNode }) {
  const cls = tone === 'ok' ? 'bg-emerald-500/25 text-emerald-100' : tone === 'try' ? 'bg-warm-yellow/25 text-warm-yellow' : 'bg-sky-400/25 text-sky-100';
  return <div className={`w-full rounded-2xl px-4 py-3 text-center text-xl ${cls}`}>{children}</div>;
}
