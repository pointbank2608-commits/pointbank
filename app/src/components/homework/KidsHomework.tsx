import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { HwItem } from '../../lib/homework/types';
import { playSfx } from '../../lib/gameSfx';
import { speak } from '../../lib/speech';
import { useYoutubeSegment } from '../../lib/useYoutubeSegment';

/**
 * 유치원 친구용 숙제 화면(2026-10-12) — 글을 읽지 못해도 할 수 있게: 큰 버튼, 큰 글자, 목소리로 안내, 한 화면에 할 일 하나.
 * 영상 장면 또는 문장을 "듣고 → 따라 읽고 → 했어요!" 로 한 줄씩 하고, 끝나면 도장이 쾅 찍힌다(StampCelebration).
 * 틀렸다는 표시를 하지 않는다(채점이 없고, 녹음은 이 기기 안에서만 들어 본다).
 */
const FONT = "'Fredoka','Quicksand','Noto Sans KR',sans-serif";

/** 파스텔 바탕 + 둥둥 떠다니는 별 친구 */
export function KidsFrame({ children }: { children: ReactNode }) {
  return (
    <div className="kids-skin relative flex flex-1 flex-col overflow-hidden rounded-3xl text-deep-navy" style={{ fontFamily: FONT }}>
      <span className="kids-cloud left-[6%] top-[8%]" aria-hidden="true" />
      <span className="kids-cloud right-[4%] top-[22%] scale-75" aria-hidden="true" />
      <div className="relative z-[1] flex flex-1 flex-col">{children}</div>
    </div>
  );
}

/** 귀여운 별 친구(그림 파일 없이 SVG) — 위아래로 통통 */
export function StarFriend({ size = 96, cheer = false }: { size?: number; cheer?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={cheer ? 'hw-cheer' : 'hw-bob'} aria-hidden="true">
      <path
        d="M60 8 l14.4 29.2 32.2 4.7-23.3 22.7 5.5 32.1L60 81.5 31.2 96.7l5.5-32.1L13.4 41.9l32.2-4.7z"
        fill="#ffc83d"
        stroke="#f59f00"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <ellipse cx="46" cy="58" rx="4.5" ry="6" fill="#3b2f2f" />
      <ellipse cx="74" cy="58" rx="4.5" ry="6" fill="#3b2f2f" />
      <circle cx="39" cy="68" r="5.5" fill="#ff8fa3" opacity="0.8" />
      <circle cx="81" cy="68" r="5.5" fill="#ff8fa3" opacity="0.8" />
      <path d="M50 70 q10 10 20 0" fill="none" stroke="#3b2f2f" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function KidsIntro({
  title,
  studentName,
  count,
  resumed,
  onStart,
}: {
  title: string;
  studentName?: string;
  count: number;
  resumed: boolean;
  onStart: () => void;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    const id = window.setTimeout(() => speak(studentName ? `Hello, ${studentName}!` : 'Hello!'), 350);
    return () => window.clearTimeout(id);
  }, [studentName]);
  return (
    <KidsFrame>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
        <StarFriend size={140} />
        {studentName && <div className="text-3xl font-bold">{t('studentHw.kidsHello', { name: studentName })}</div>}
        <div className="rounded-3xl bg-white/90 px-6 py-4 text-2xl font-bold shadow-md">{title}</div>
        <div className="text-xl text-deep-navy/70">{t('studentHw.kidsCount', { count })}</div>
        {resumed && <div className="rounded-full bg-[#51cf66] px-5 py-1.5 text-lg font-bold text-white">{t('studentHw.resumeNote')}</div>}
        <button
          type="button"
          onClick={onStart}
          className="kids-btn min-h-20 w-full max-w-sm rounded-[2rem] bg-[#ff6b6b] text-3xl font-bold text-white"
        >
          {t('studentHw.kidsStart')}
        </button>
      </div>
    </KidsFrame>
  );
}

export default function KidsShadowing({
  item,
  startLine,
  onLineDone,
  onLinesFinished,
}: {
  item: HwItem;
  startLine: number;
  onLineDone: (line: number, listens: number, repeats: number) => void;
  onLinesFinished: () => void;
}) {
  const { t } = useTranslation();
  const lines = item.content.lines ?? [];
  const yt = useYoutubeSegment(item.content.videoId);
  const [idx, setIdx] = useState(Math.min(startLine, Math.max(0, lines.length - 1)));
  const [listens, setListens] = useState(0);
  const [repeats, setRepeats] = useState(0);
  const [recording, setRecording] = useState(false);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const line = lines[idx];
  const canRecord = typeof window !== 'undefined' && 'MediaRecorder' in window && typeof navigator.mediaDevices?.getUserMedia === 'function';

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

  async function play() {
    if (!line) return;
    setListens((n) => n + 1);
    if (item.content.videoId && yt.ready && !yt.failed) await yt.playSegment(line.s, line.e);
    else speak(line.en);
  }

  // 문장이 바뀌면 한 번 읽어 준다(영상이면 영상이 준비된 뒤)
  const playedFor = useRef(-1);
  useEffect(() => {
    if (!line || playedFor.current === idx) return;
    if (item.content.videoId && !yt.ready && !yt.failed) return;
    playedFor.current = idx;
    const id = window.setTimeout(() => void play(), 450);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, yt.ready, yt.failed]);

  async function toggleRecord() {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    try {
      if (!streamRef.current) streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(streamRef.current);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      setRecording(false);
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      setClipUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      setRepeats((n) => n + 1);
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
    window.setTimeout(() => rec.state === 'recording' && rec.stop(), 8000);
  }

  function practiced() {
    playSfx(4015);
    setBurst((n) => n + 1);
    onLineDone(idx, listens, repeats);
    setListens(0);
    setRepeats(0);
    setClipUrl(null);
    window.setTimeout(() => {
      if (idx + 1 < lines.length) setIdx(idx + 1);
      else onLinesFinished();
    }, 420);
  }

  if (!line) return null;
  const last = idx + 1 === lines.length;
  return (
    <KidsFrame>
      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* 진행: 별 한 줄 */}
        <div className="flex items-center justify-center gap-1.5" aria-label={t('studentHw.shadowLineN', { n: idx + 1, total: lines.length })}>
          {lines.map((_, i) => (
            <span
              key={i}
              className={`material-symbols-outlined text-[30px] transition-transform ${i < idx ? 'scale-110 text-[#ffc83d]' : i === idx ? 'hw-bob text-[#ff8fa3]' : 'text-deep-navy/20'}`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              star
            </span>
          ))}
        </div>

        {item.content.videoId && !yt.failed && (
          <div className="relative mx-auto aspect-video w-full max-w-xl overflow-hidden rounded-3xl border-4 border-white bg-black shadow-lg">
            <div id={yt.elementId} className="absolute inset-0 h-full w-full" />
          </div>
        )}

        <div key={idx} className="solo-pop relative rounded-[2rem] bg-white px-5 py-6 text-center shadow-lg">
          <div className="absolute -top-8 left-3">
            <StarFriend size={64} cheer={burst > 0} />
          </div>
          <div className="text-4xl font-bold leading-snug sm:text-5xl">{line.en}</div>
          {line.ko && <div className="mt-2 text-lg text-deep-navy/60">{line.ko}</div>}
        </div>

        <div className="mt-auto flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void play()}
            disabled={yt.playing}
            className="kids-btn flex min-h-20 items-center justify-center gap-3 rounded-[2rem] bg-[#4dabf7] text-3xl font-bold text-white disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[40px]">volume_up</span>
            {listens > 0 ? t('studentHw.kidsListenAgain') : t('studentHw.kidsListen')}
          </button>
          {canRecord && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void toggleRecord()}
                className={`kids-btn flex min-h-16 items-center justify-center gap-2 rounded-[2rem] text-2xl font-bold text-white ${recording ? 'bg-[#e03131]' : 'bg-[#b197fc]'}`}
              >
                <span className="material-symbols-outlined text-[32px]">{recording ? 'stop_circle' : 'mic'}</span>
                {recording ? t('studentHw.kidsStopRecord') : t('studentHw.kidsRecord')}
              </button>
              {clipUrl && <audio src={clipUrl} controls className="w-full" />}
            </div>
          )}
          <button
            type="button"
            onClick={practiced}
            className="kids-btn flex min-h-20 items-center justify-center gap-3 rounded-[2rem] bg-[#51cf66] text-3xl font-bold text-white"
          >
            <span className="material-symbols-outlined text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {last ? 'workspace_premium' : 'check_circle'}
            </span>
            {last ? t('studentHw.kidsDoneLast') : t('studentHw.kidsDone')}
          </button>
        </div>
      </div>
    </KidsFrame>
  );
}
