import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import SoloGameStep from './SoloGameStep';
import { speak } from '../../lib/speech';
import { useYoutubeSegment } from '../../lib/useYoutubeSegment';
import RainbowSpeaking from '../rainbow/RainbowSpeaking';
import RainbowStructure from '../rainbow/RainbowStructure';
import { COMMON_SFX, playSfx } from '../../lib/gameSfx';
import { POS_HINT_KO, posFromKo, RAINBOW_THEME, SPEAKING_ITEMS, STRUCTURE_ITEMS, type StructureItem } from '../../lib/rainbow';
import type { SoloClip, SoloPass, SoloPublicStep } from '../../lib/soloLessons';
import type { TestResult } from '../../lib/soloTest';
import { applyFixEdits, fixTokens } from '../../lib/grammarBlocks';
import { checkCondition, looseNorm } from '../../lib/soloLessons';
import SoloTestRunner from './SoloTestRunner';

/**
 * 개별수업 플레이어 — 화면이 선생님이 되어 한 단계씩 이끈다. 학생 화면(/s/lesson)과 선생님 미리보기가 같이 쓴다.
 * 채점·기록은 api 가 한다(학생: 서버, 미리보기: 이 브라우저 안).
 *  - 고르기: 한 번 틀리면 "다시 해 볼까요?"(틀린 보기는 흐려짐), 두 번 틀리면 정답을 알려 준다.
 *  - 쓰기·문장 배열: 한 번 틀리면 힌트(첫 글자·글자 수), 두 번 틀리면 정답을 알려 준다.
 *  - "모르겠어요": 정답을 알려 주고 넘어간다(선생님 현황에 막힌 단계로 보인다).
 */
export interface SoloPlayerApi {
  /** 답 내기 → 맞았는지 */
  answer(step: number, value: string): Promise<boolean | { ok: boolean; model?: string | null }>;
  /** 단계를 끝냈다고 알리기(모르겠어요면 unsure) → 정답 글자(모르겠어요일 때) */
  advance(step: number, unsure: boolean): Promise<{ answer: string | null }>;
  /** 두 번 틀린 뒤 정답 보기 */
  reveal(step: number): Promise<string | null>;
  /** 따라 부른 녹음 보내기(보호자 동의가 있는 학생만) — 실패하면 false */
  record?(step: number, blob: Blob, seconds: number, sub?: number): Promise<boolean>;
  /** 시험 블록 답안을 한 번에 내고 채점 결과 받기 */
  submitTest(step: number, answers: (string | null)[]): Promise<TestResult>;
  /** 시험에서 틀린 문제만 다시 풀기(복습 수업으로) — 없으면 버튼이 안 보인다 */
  retryTest?(step: number, wrong: number[]): Promise<void>;
  /** 게임 단계가 쓰는 선생님의 게임 템플릿(069) — 못 읽으면 null */
  gameTemplate?(templateId: string): Promise<{ game_type: string; name: string; items: unknown[]; config: Record<string, unknown> } | null>;
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

/** 그룹 합격선·다시 풀기에서 점수로 치는 문제(조건 영작은 뜻을 서버가 못 가려서 뺀다) */
const GRADED = ['pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect', 'lyricBlank', 'sayPick', 'pickPos', 'spell', 'typeWord', 'dictation', 'unscramble', 'gapType', 'lineOrder', 'fixError', 'orderWrite'];
const isStage = (steps: SoloPublicStep[], i: number): boolean => i > 0 && steps[i].t === 'intro' && /^\d+\.\s/.test((steps[i] as { title: string }).title);
const QUESTION = [...CHOICE, 'spell', 'typeWord', 'dictation', 'unscramble', 'gapType', 'lineOrder', 'fixError', 'orderWrite', 'condWrite'];

/**
 * 큰 화면(전자칠판·데스크톱)에서는 수업 화면이 위쪽 구석에 작게 붙어 비어 보이므로, 화면 크기에 맞춰 글자·버튼·그림을 같이 키운다.
 * 폭 640px·높이 약 700px 정도를 한 화면 기준으로 보고 최대 1.7배까지만 키운다(작은 화면은 그대로 1배).
 */
function useStageZoom(): number {
  const calc = () => {
    if (typeof window === 'undefined') return 1;
    const z = Math.min(window.innerWidth / 640, (window.innerHeight - 80) / 620);
    return Math.round(Math.max(1, Math.min(1.7, z)) * 20) / 20;
  };
  const [zoom, setZoom] = useState(calc);
  useEffect(() => {
    const on = () => setZoom(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return zoom;
}

export default function SoloPlayer({
  steps,
  startAt = 0,
  api,
  onExit,
  preview = false,
  canRecord = false,
  finishExtra,
  onHelp,
  onHelpDone,
  headerExtra,
}: {
  steps: SoloPublicStep[];
  startAt?: number;
  api: SoloPlayerApi;
  onExit: () => void;
  preview?: boolean;
  /** 이 학생의 녹음을 서버에 보관해도 되는지(보호자 동의) */
  canRecord?: boolean;
  /** 끝 화면 아래에 더 보여 줄 것(다시 배우기·숙제 안내) */
  finishExtra?: ReactNode;
  /** "선생님 도와주세요" — 주면 위쪽에 버튼이 보인다(학생 화면만) */
  onHelp?: (step: number) => Promise<void>;
  /** 선생님이 와서 알려 준 뒤 학생이 "도와줬어요"를 누를 때 — 서버의 도움 요청도 같이 닫는다 */
  onHelpDone?: () => Promise<void>;
  /** 위쪽 줄 도움 버튼 옆에 붙는 것(선생님 채팅 버튼 등) */
  headerExtra?: ReactNode;
}) {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(() => Math.min(startAt, Math.max(0, steps.length - 1)));
  const [phase, setPhase] = useState<Phase>('ask');
  const [wrong, setWrong] = useState<number[]>([]);
  const [shownAnswer, setShownAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(startAt >= steps.length && steps.length > 0);
  const [stats, setStats] = useState({ right: 0, unsure: 0 });
  /** 틀렸거나 "모르겠어요"를 누른 단계 번호 — 끝 화면에서 다시 볼 것으로 보여 준다 */
  const [missed, setMissed] = useState<Set<number>>(new Set());
  const markMissed = (i: number) => setMissed((cur) => (cur.has(i) ? cur : new Set(cur).add(i)));
  /** 시험 블록에서 틀린 낱말(시험은 문제 여러 개가 한 단계라 낱말로 모은다) */
  const [testMissed, setTestMissed] = useState<string[]>([]);
  const markMissedWord = (it: object) => {
    const w = 'word' in it && typeof it.word === 'string' ? it.word.trim() : '';
    if (w) setTestMissed((cur) => (cur.includes(w) ? cur : [...cur, w]));
  };
  const [error, setError] = useState(false);
  const [typed, setTyped] = useState<number[]>([]);
  const [text, setText] = useState('');
  const [heard, setHeard] = useState(false);
  const [showKo, setShowKo] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const attempts = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [helpSent, setHelpSent] = useState(false);
  /** 문제마다 "처음 답이 맞았는지"(다시 풀기에서 처음 답이 맞으면 다시 점수로 친다) — 그룹 합격선과 틀린 것 다시 풀기가 쓴다 */
  const [credit, setCredit] = useState<Record<number, boolean>>({});
  /** 그룹 결과 화면(합격선이 있는 그룹을 끝냈을 때) */
  const [result, setResult] = useState<{ start: number; end: number } | null>(null);
  /** 틀린 것 다시 풀기: 풀 단계 번호 줄과 지금 위치, 끝나면 돌아갈 곳 */
  const [retry, setRetry] = useState<{ queue: number[]; pos: number; back: { start: number; end: number } | null } | null>(null);
  const [nonce, setNonce] = useState(0);

  const step = steps[idx];
  const zoom = useStageZoom();

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
  // 어법 오류 고치기: 고친 낱말(칸 번호 → 글)과 지금 고치는 칸
  const [fixEdits, setFixEdits] = useState<Record<number, string>>({});
  const [fixOpen, setFixOpen] = useState<number | null>(null);
  // 조건 영작을 맞혔을 때 서버가 돌려준 예시 답
  const [modelNote, setModelNote] = useState<string | null>(null);

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
    setFixEdits({});
    setFixOpen(null);
    setModelNote(null);
    attempts.current = 0;
    if (!step) return;
    if (step.t === 'fadeRead') speak(step.sentence);
    if (step.t === 'meet' || step.t === 'listenPick' || step.t === 'pickMeaning' || step.t === 'dictation') speak(step.word);
    if (step.t === 'example') speak(step.sentence);
    if (step.t === 'pickPos') speak(step.sentence ?? step.word);
    if (step.t === 'translatePick') speak(step.sentence);
  }, [idx, step, nonce]);

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

  // 맞히면 짧은 소리, 한 번 틀리면 부드러운 소리 — 끝나면 박수와 칭찬 목소리
  useEffect(() => {
    if (phase === 'right') playSfx(4015);
    else if (phase === 'wrong1') playSfx(4025);
  }, [phase, idx]);
  useEffect(() => {
    if (!finished) return;
    playSfx(5037);
    const timer = window.setTimeout(() => playSfx(COMMON_SFX.praise), 900);
    return () => window.clearTimeout(timer);
  }, [finished]);

  async function next(unsure = false) {
    const r = await guard(() => api.advance(idx, unsure));
    if (r === null) return;
    if (unsure) {
      markCredit(idx, false);
      markMissed(idx);
      setStats((s) => ({ ...s, unsure: s.unsure + 1 }));
      setAdvanced(true);
      setShownAnswer(r.answer);
      setPhase('shown');
      return;
    }
    goOn();
  }

  /** 이 단계의 처음 답을 적는다 — 다시 풀기 중이면 이번 첫 답이 맞을 때 점수를 되찾고, 아니면 처음 한 번만 적는다 */
  function markCredit(i: number, ok: boolean) {
    if (!GRADED.includes(steps[i]?.t)) return;
    setCredit((c) => (retry ? { ...c, [i]: ok || c[i] === true } : i in c ? c : { ...c, [i]: ok }));
  }

  /** i 번 단계가 속한 그룹(숫자로 시작하는 나눔 화면 ~ 다음 나눔 전) */
  function groupAt(i: number): { start: number; end: number; pass: SoloPass } | null {
    let a = i;
    while (a > 0 && !isStage(steps, a)) a--;
    if (!isStage(steps, a)) return null;
    const pass = (steps[a] as { pass?: SoloPass }).pass;
    if (!pass) return null;
    let b = a + 1;
    while (b < steps.length && !isStage(steps, b)) b++;
    return { start: a, end: b - 1, pass };
  }

  /** 그룹의 점수 — 이번에 푼(기록이 있는) 문제만 센다 */
  function scoreOf(g: { start: number; end: number }) {
    const idxs: number[] = [];
    for (let i = g.start + 1; i <= g.end; i++) if (GRADED.includes(steps[i].t) && i in credit) idxs.push(i);
    const right = idxs.filter((i) => credit[i]).length;
    return { total: idxs.length, right, missed: idxs.filter((i) => !credit[i]), pct: idxs.length ? Math.round((right / idxs.length) * 100) : 100 };
  }

  function jumpTo(i: number) {
    setIdx(i);
    setNonce((n) => n + 1);
  }

  /** 틀린 것 다시 풀기 시작 */
  function startRetry(queue: number[], back: { start: number; end: number } | null) {
    if (queue.length === 0) return;
    setResult(null);
    setFinished(false);
    setRetry({ queue, pos: 0, back });
    jumpTo(queue[0]);
  }

  /** 그룹(또는 수업)을 다음으로 넘긴다 */
  function leaveGroup(g: { end: number }) {
    setResult(null);
    if (g.end + 1 >= steps.length) setFinished(true);
    else jumpTo(g.end + 1);
  }

  function goOn() {
    if (retry) {
      if (retry.pos + 1 < retry.queue.length) {
        setRetry({ ...retry, pos: retry.pos + 1 });
        jumpTo(retry.queue[retry.pos + 1]);
        return;
      }
      const back = retry.back;
      setRetry(null);
      if (back) setResult(back);
      else setFinished(true);
      return;
    }
    const g = groupAt(idx);
    if (g && idx === g.end && scoreOf(g).total > 0) {
      setResult({ start: g.start, end: g.end });
      return;
    }
    if (idx + 1 >= steps.length) setFinished(true);
    else setIdx(idx + 1);
  }

  /** 답을 서버에 내고 맞았는지에 따라 단계 상태를 바꾼다 */
  async function submit(value: string, onWrong?: () => void) {
    const res = await guard(() => api.answer(idx, value));
    if (res === null) return;
    const ok = typeof res === 'boolean' ? res : res.ok;
    if (typeof res !== 'boolean' && res.model) setModelNote(res.model);
    attempts.current += 1;
    if (attempts.current === 1) markCredit(idx, ok);
    if (ok) {
      setPhase('right');
      setStats((s) => ({ ...s, right: s.right + 1 }));
      return;
    }
    onWrong?.();
    markMissed(idx);
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

  async function checkFixError() {
    if (!step || step.t !== 'fixError') return;
    await submit(applyFixEdits(step.wrong, fixEdits));
  }

  async function checkLineOrder() {
    if (!step || step.t !== 'lineOrder') return;
    await submit(typed.map((n) => step.pieces[n]).join(' '), () => setTyped([]));
  }

  async function checkText() {
    if (!text.trim()) return;
    await submit(text.trim(), () => {
      setText('');
      inputRef.current?.focus();
    });
  }

  /** 지금 활동(같은 종류 단계 묶음)에서 몇 번째인지 */
  const activity = useMemo(() => {
    const cur = steps[idx];
    if (!cur || cur.t === 'intro') return null;
    let a = idx;
    while (a > 0 && steps[a - 1].t === cur.t) a--;
    let b = idx;
    while (b + 1 < steps.length && steps[b + 1].t === cur.t) b++;
    return { n: idx - a + 1, of: b - a + 1 };
  }, [steps, idx]);

  /** 끝 화면: 새로 만난 낱말 수, 다시 볼 낱말 */
  const learned = useMemo(() => new Set(steps.filter((s) => s.t === 'meet').map((s) => (s as { word: string }).word.toLowerCase())).size, [steps]);
  const review = useMemo(() => {
    const out: string[] = [];
    for (const i of [...missed].sort((a, b) => a - b)) {
      const s = steps[i] as { word?: string; sentence?: string } | undefined;
      const w = s?.word?.trim();
      if (w && !out.includes(w)) out.push(w);
    }
    for (const w of testMissed) if (!out.includes(w)) out.push(w);
    return out.slice(0, 10);
  }, [missed, steps, testMissed]);

  const percent = useMemo(() => (steps.length ? Math.round((Math.min(idx, steps.length) / steps.length) * 100) : 0), [idx, steps.length]);

  if (result) {
    const sc = scoreOf(result);
    const pass = (steps[result.start] as { pass?: SoloPass }).pass as SoloPass;
    const passed = sc.pct >= pass.pct;
    const title = String((steps[result.start] as { title: string }).title).replace(/^\d+\.\s*/, '');
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-[#16213e] p-6 text-center text-white">
        <div className="flex w-full flex-col items-center gap-5" style={{ zoom }}>
        <div className="solo-pop text-7xl">{passed ? '🎉' : '💪'}</div>
        <h1 className="text-3xl font-bold">{t('solo.groupResult', { title })}</h1>
        <p className="text-5xl font-bold tabular-nums text-warm-yellow">{sc.pct}%</p>
        <p className="text-xl text-white/85">{t('solo.groupScore', { right: sc.right, total: sc.total, pct: sc.pct })}</p>
        <p className="text-lg text-white/70">{t('solo.passLineText', { pct: pass.pct })}</p>
        <p className="max-w-sm text-xl font-bold">{passed ? t('solo.passedMsg') : pass.gate ? t('solo.notPassedGate') : t('solo.notPassedRef')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {sc.missed.length > 0 && (
            <button type="button" onClick={() => startRetry(sc.missed, result)} className={`${btn} ${passed || !pass.gate ? 'bg-white/15 text-white' : 'bg-warm-yellow text-deep-navy'}`}>
              {t('solo.retryMissed', { count: sc.missed.length })}
            </button>
          )}
          {(passed || !pass.gate) && (
            <button type="button" onClick={() => leaveGroup(result)} className={`${btn} bg-warm-yellow px-8 text-deep-navy`}>
              {t('solo.continueNext')}
            </button>
          )}
        </div>
        </div>
      </div>
    );
  }

  if (finished) {
    const missedAll = Object.keys(credit).map(Number).filter((i) => !credit[i]).sort((a, b) => a - b);
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-[#16213e] p-6 text-center text-white">
        <div className="flex w-full flex-col items-center gap-5" style={{ zoom }}>
        <div className="solo-pop text-7xl">🎉</div>
        <h1 className="text-4xl font-bold">{t('solo.finishTitle')}</h1>
        {learned > 0 && <p className="text-2xl font-bold text-warm-yellow">{t('solo.finishLearned', { count: learned })}</p>}
        <p className="text-xl text-white/80">{t('solo.finishStats', { right: stats.right, unsure: stats.unsure })}</p>
        {review.length > 0 && (
          <div className="w-full max-w-md rounded-2xl bg-white/10 px-4 py-3 text-left">
            <div className="mb-2 text-base font-bold text-white/80">{t('solo.finishReview')}</div>
            <div className="flex flex-wrap gap-2">
              {review.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => speak(w)}
                  className="rounded-full bg-white/15 px-3 py-1.5 text-lg font-bold hover:bg-white/25"
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}
        {missedAll.length > 0 && (
          <button type="button" onClick={() => startRetry(missedAll, null)} className={`${btn} bg-white/15 text-white`}>
            {t('solo.retryAllMissed', { count: missedAll.length })}
          </button>
        )}
        {finishExtra}
        <button type="button" onClick={onExit} className={`${btn} bg-warm-yellow text-deep-navy`}>
          {preview ? t('solo.closePreview') : t('solo.backHome')}
        </button>
        </div>
      </div>
    );
  }
  if (!step) return null;

  const isQuestion = QUESTION.includes(step.t);
  const answered = phase === 'right' || phase === 'shown';
  const hintFirst = phase === 'wrong1' && (step.t === 'typeWord' || step.t === 'dictation' || step.t === 'gapType');

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
        {onHelp && (
          <button
            type="button"
            onClick={async () => {
              if (helpSent) {
                // 선생님이 와서 알려 줬다 → 버튼을 되돌리고 서버의 도움 요청도 닫는다(실패해도 화면은 되돌린다)
                setHelpSent(false);
                try {
                  await onHelpDone?.();
                } catch {
                  /* 서버가 못 닫아도 선생님이 현황판에서 닫을 수 있다 */
                }
                return;
              }
              setHelpSent(true);
              try {
                await onHelp(idx);
              } catch {
                setHelpSent(false);
              }
            }}
            className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-bold hover:bg-white/10 ${
              helpSent ? 'border-warm-yellow bg-warm-yellow/15 text-warm-yellow' : 'border-white/30 text-white/90'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{helpSent ? 'check_circle' : 'back_hand'}</span>
            {helpSent ? t('solo.helpResolved') : t('solo.help')}
          </button>
        )}
        {headerExtra}
      </header>

      {retry && (
        <div className="-mt-1 flex justify-center px-4 pb-1">
          <span className="rounded-full bg-warm-yellow px-4 py-1 text-base font-bold text-deep-navy">{t('solo.retryChip', { n: retry.pos + 1, of: retry.queue.length })}</span>
        </div>
      )}
      {activity && (
        <div className="-mt-1 flex justify-center px-4 pb-1">
          <span className="rounded-full bg-white/10 px-4 py-1 text-base font-bold text-white/80">
            {t(`soloEdit.stepType_${step.t}`)}
            {activity.of > 1 ? ` · ${activity.n}/${activity.of}` : ''}
          </span>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 px-5 pb-6 pt-2" style={{ zoom }}>
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

        {step.t === 'test' && (
          <SoloTestRunner
            key={idx}
            step={step}
            onSubmit={async (answers) => {
              const r = await api.submitTest(idx, answers);
              setStats((st) => ({ ...st, right: st.right + r.score }));
              r.items.forEach((it, k) => {
                if (!it.correct) markMissedWord(step.items[k]);
              });
              return r;
            }}
            onDone={goOn}
            onRetry={api.retryTest ? (wrong) => api.retryTest!(idx, wrong) : undefined}
          />
        )}

        {step.t === 'intro' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            {step.imageUrl ? <Picture url={step.imageUrl} wide /> : <div className="text-6xl">{/^\d+\.\s/.test(step.title) ? '⏱️' : '📚'}</div>}
            <h1 className="text-3xl font-bold">{step.title}</h1>
            <p className="max-w-sm text-xl text-white/85">{/^\d+$/.test(step.text) ? t('solo.introText', { count: Number(step.text) || 0 }) : step.text}</p>
            <button type="button" disabled={busy} onClick={() => void next()} className={`${btn} bg-warm-yellow px-10 text-deep-navy`}>
              {t(/^\d+\.\s/.test(step.title) ? 'solo.startStage' : 'solo.start')}
            </button>
          </div>
        )}

        {step.t === 'game' && (
          <SoloGameStep key={`${idx}-${step.templateId}`} step={step} load={api.gameTemplate} busy={busy} onDone={() => void next()} />
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

        {step.t === 'gapType' && (
          <>
            <p className="text-xl font-bold">{t('solo.gapQ')}</p>
            {step.clip && (
              <button type="button" disabled={clipPlaying} onClick={() => void playClip(step.clip!, step.sentence.replace('_____', ' '))} className="flex items-center gap-2 rounded-full bg-warm-yellow px-5 py-2 text-lg font-bold text-deep-navy disabled:opacity-60">
                <span className="material-symbols-outlined">{clipPlaying ? 'graphic_eq' : 'play_arrow'}</span>
                {t('solo.listenLine')}
              </button>
            )}
            <p className="w-full rounded-2xl bg-white/10 px-4 py-4 text-center text-2xl font-bold leading-snug">{step.sentence}</p>
            {step.ko && <p className="text-lg text-white/70">{step.ko}</p>}
            <p className="font-mono text-2xl tracking-[0.3em] text-white/60" aria-label={t('solo.lettersHint', { n: step.length })}>
              {hintFirst ? `${step.first}${'_'.repeat(Math.max(0, step.length - 1))}` : '_'.repeat(step.length)}
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

        {step.t === 'orderWrite' && (() => {
          // 주어진 낱말 칸을 눌러 아래 글칸에 이어 붙이거나 직접 써도 된다. 이미 쓴 낱말은 흐려진다.
          const left = new Map<string, number>();
          for (const w of looseNorm(text).split(' ').filter(Boolean)) left.set(w, (left.get(w) ?? 0) + 1);
          return (
            <>
              <p className="text-xl font-bold">{t('solo.writeQ')}</p>
              <p className="w-full rounded-2xl bg-white/10 px-4 py-4 text-center text-2xl font-bold leading-snug">{step.ko}</p>
              <p className="text-center text-base text-white/70">{t('solo.writeBank')}</p>
              <div className="flex w-full flex-wrap justify-center gap-2">
                {step.words.map((w, n) => {
                  const key = looseNorm(w);
                  const have = left.get(key) ?? 0;
                  // 같은 낱말이 여러 번 나와도 쓴 만큼만 흐려진다
                  const seenBefore = step.words.slice(0, n).filter((x) => looseNorm(x) === key).length;
                  const used = have > seenBefore;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={answered || busy}
                      onClick={() => setText((cur) => `${cur.trim() ? `${cur.trim()} ` : ''}${w}`)}
                      className={`min-h-12 rounded-xl px-3 text-2xl font-bold [touch-action:manipulation] ${used ? 'bg-white/20 text-white/40' : 'bg-white text-deep-navy shadow-[0_4px_0_#9aa3b5]'}`}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
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
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="sentences"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={t('solo.writePlaceholder')}
                    className="min-h-14 w-full rounded-2xl bg-white px-4 text-center text-2xl font-bold text-deep-navy outline-none focus:ring-4 focus:ring-warm-yellow"
                  />
                  <div className="flex w-full gap-3">
                    <button type="button" onClick={() => setText((cur) => cur.trim().split(/\s+/).slice(0, -1).join(' '))} disabled={!text.trim()} className={`${btn} flex-1 bg-white/15`}>
                      {t('solo.erase')}
                    </button>
                    <button type="submit" disabled={!text.trim() || busy} className={`${btn} flex-1 bg-warm-yellow text-deep-navy`}>
                      {t('solo.check')}
                    </button>
                  </div>
                </form>
              )}
            </>
          );
        })()}

        {step.t === 'condWrite' && (
          <>
            <p className="text-xl font-bold">{t('solo.condQ')}</p>
            <p className="w-full rounded-2xl bg-white/10 px-4 py-4 text-center text-2xl font-bold leading-snug">{step.ko}</p>
            <ul className="w-full space-y-1.5 rounded-2xl bg-white/5 px-4 py-3 text-left text-lg" aria-label={t('solo.condTitle')}>
              <li className="text-base font-bold text-white/70">{t('solo.condTitle')}</li>
              {step.conditions.map((c, i) => {
                const r = text.trim() ? checkCondition(c, text) : null;
                return (
                  <li key={i} className="flex items-start gap-2">
                    <span className={`material-symbols-outlined mt-0.5 shrink-0 text-[20px] ${r === true ? 'text-emerald-300' : r === false ? 'text-warm-yellow' : 'text-white/40'}`}>
                      {r === true ? 'check_circle' : r === false ? 'radio_button_unchecked' : 'circle'}
                    </span>
                    <span className={r === true ? 'text-white' : 'text-white/85'}>{c.text}</span>
                  </li>
                );
              })}
            </ul>
            {!answered && (
              <form
                className="flex w-full flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void checkText();
                }}
              >
                <textarea
                  value={text}
                  rows={2}
                  onChange={(e) => setText(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="sentences"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t('solo.writePlaceholder')}
                  className="w-full rounded-2xl bg-white px-4 py-3 text-center text-2xl font-bold text-deep-navy outline-none focus:ring-4 focus:ring-warm-yellow"
                />
                <button type="submit" disabled={!text.trim() || busy} className={`${btn} bg-warm-yellow text-deep-navy`}>
                  {t('solo.check')}
                </button>
              </form>
            )}
            {phase === 'right' && (
              <div className="w-full rounded-2xl bg-white/10 px-4 py-3 text-center">
                <p className="text-base text-white/70">{t('solo.condYours')}</p>
                <p className="text-xl font-bold">{text}</p>
                {modelNote && (
                  <>
                    <p className="mt-2 text-base text-white/70">{t('solo.condModel')}</p>
                    <p className="text-xl font-bold text-emerald-200">{modelNote}</p>
                  </>
                )}
                <p className="mt-2 text-sm text-white/60">{t('solo.condTeacher')}</p>
              </div>
            )}
          </>
        )}

        {step.t === 'fixError' && (() => {
          const tokens = fixTokens(step.wrong);
          const edited = Object.keys(fixEdits).length > 0;
          return (
            <>
              <p className="text-xl font-bold">{t('solo.fixQ')}</p>
              <p className="text-center text-base text-white/70">{t('solo.fixHow')}</p>
              <div className="flex w-full flex-wrap items-center justify-center gap-2 rounded-2xl bg-white/10 px-3 py-4" aria-live="polite">
                {tokens.map((w, i) => {
                  const changed = i in fixEdits;
                  if (fixOpen === i && !answered) {
                    return (
                      <input
                        key={i}
                        autoFocus
                        value={fixEdits[i] ?? w}
                        onChange={(e) => setFixEdits((cur) => ({ ...cur, [i]: e.target.value }))}
                        onBlur={() => {
                          setFixOpen(null);
                          setFixEdits((cur) => {
                            // 처음과 같으면 고친 것으로 치지 않는다
                            if (cur[i] !== undefined && cur[i].trim() === w) {
                              const { [i]: _drop, ...rest } = cur;
                              return rest;
                            }
                            return cur;
                          });
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        size={Math.max(4, (fixEdits[i] ?? w).length + 1)}
                        className="min-h-12 rounded-xl bg-white px-3 text-center text-2xl font-bold text-deep-navy outline-none ring-4 ring-warm-yellow"
                      />
                    );
                  }
                  const shown = changed ? fixEdits[i].trim() : w;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={answered || busy}
                      onClick={() => setFixOpen(i)}
                      className={`min-h-12 rounded-xl px-3 text-2xl font-bold [touch-action:manipulation] ${changed ? 'bg-warm-yellow text-deep-navy' : 'bg-white/90 text-deep-navy shadow-[0_4px_0_#9aa3b5]'}`}
                    >
                      {shown || '∅'}
                    </button>
                  );
                })}
              </div>
              {edited && !answered && <p className="text-center text-lg text-white/85">{t('solo.fixResult')} <span className="font-bold text-warm-yellow">{applyFixEdits(step.wrong, fixEdits) || '…'}</span></p>}
              {step.ko && <p className="text-lg text-white/70">{step.ko}</p>}
              {!answered && (
                <div className="flex w-full gap-3">
                  <button type="button" onClick={() => { setFixEdits({}); setFixOpen(null); }} disabled={!edited} className={`${btn} flex-1 bg-white/15`}>
                    {t('solo.fixReset')}
                  </button>
                  <button type="button" onClick={() => void checkFixError()} disabled={!edited || busy} className={`${btn} flex-1 bg-warm-yellow text-deep-navy`}>
                    {t('solo.check')}
                  </button>
                </div>
              )}
              {answered && step.why && <p className="text-center text-lg text-white/80">💡 {step.why}</p>}
            </>
          );
        })()}

        {step.t === 'lineOrder' && (
          <>
            <p className="text-xl font-bold">{t('solo.lineOrderQ')}</p>
            {step.clip && (
              <button type="button" disabled={clipPlaying} onClick={() => void playClip(step.clip!)} className="flex items-center gap-2 rounded-full bg-warm-yellow px-5 py-2 text-lg font-bold text-deep-navy disabled:opacity-60">
                <span className="material-symbols-outlined">{clipPlaying ? 'graphic_eq' : 'play_arrow'}</span>
                {t('solo.listenLine')}
              </button>
            )}
            <ol className="flex min-h-20 w-full flex-col gap-2 rounded-2xl border-2 border-dashed border-white/30 p-3" aria-live="polite">
              {typed.length === 0 && <li className="text-center text-base text-white/50">{t('solo.lineOrderEmpty')}</li>}
              {typed.map((n, k) => (
                <li key={k}>
                  <button type="button" disabled={answered} onClick={() => setTyped((a) => a.filter((_, j) => j !== k))} className="flex w-full items-center gap-2 rounded-xl bg-white px-3 py-2 text-left text-xl font-bold text-deep-navy">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-deep-navy text-base text-white">{k + 1}</span>
                    {step.pieces[n]}
                  </button>
                </li>
              ))}
            </ol>
            <div className="flex w-full flex-col gap-2">
              {step.pieces.map((p, n) => (
                <button
                  key={n}
                  type="button"
                  disabled={typed.includes(n) || answered || busy}
                  onClick={() => setTyped((a) => [...a, n])}
                  className="rounded-xl bg-white/90 px-4 py-3 text-left text-xl font-bold text-deep-navy shadow-[0_4px_0_#9aa3b5] [touch-action:manipulation] disabled:opacity-30"
                >
                  {p}
                </button>
              ))}
            </div>
            {!answered && (
              <div className="flex w-full gap-3">
                <button type="button" onClick={() => setTyped((a) => a.slice(0, -1))} disabled={typed.length === 0} className={`${btn} flex-1 bg-white/15`}>
                  {t('solo.erase')}
                </button>
                <button type="button" onClick={() => void checkLineOrder()} disabled={typed.length !== step.pieces.length || busy} className={`${btn} flex-1 bg-warm-yellow text-deep-navy`}>
                  {t('solo.check')}
                </button>
              </div>
            )}
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
        {isQuestion && (phase === 'shown' || (phase === 'wrong1' && wrong.length >= 2)) && (step as { tip?: string }).tip && (
          <div className="w-full rounded-2xl bg-white/10 px-4 py-3 text-center text-lg text-white/90">
            <span className="mr-2 font-bold text-warm-yellow">{t('solo.whyTip')}</span>
            {(step as { tip?: string }).tip}
          </div>
        )}
        {error && <p className="text-center text-lg text-warm-yellow" role="alert">{t('solo.error')}</p>}

        {isQuestion && answered && (
          <button type="button" disabled={busy} onClick={() => (phase === 'right' || !advanced ? void next() : goOn())} className={`${btn} w-full bg-warm-yellow text-deep-navy`}>
            {t('solo.next')}
          </button>
        )}

        {step.t !== 'intro' && step.t !== 'test' && step.t !== 'watch' && step.t !== 'lineSing' && step.t !== 'fadeRead' && step.t !== 'roleplay' && step.t !== 'rainbowSpeak' && step.t !== 'rainbowStructure' && !answered && (
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
  const anim = tone === 'ok' ? 'solo-pop' : tone === 'try' ? 'solo-shake' : '';
  return <div className={`w-full rounded-2xl px-4 py-3 text-center text-xl ${cls} ${anim}`}>{children}</div>;
}
