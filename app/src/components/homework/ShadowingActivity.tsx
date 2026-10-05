import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HwItem } from '../../lib/homework/types';
import { speak } from '../../lib/speech';
import { useYoutubeSegment } from '../../lib/useYoutubeSegment';

/**
 * 영상 쉐도잉 숙제(2026-10-05). 문장마다: 듣기 → 대사 보기 → 다시 듣기 → 따라 읽기 → (원하면) 내 목소리 녹음해 바로 듣기 → "연습했어요".
 * 발음 점수는 만들지 않는다(믿을 만한 채점기가 없어서). 기록은 들은 횟수·녹음 횟수·끝낸 문장만.
 * 녹음은 이 기기 안에서만 재생하고 서버로 보내지 않는다. 마이크가 없거나 거절해도 계속할 수 있다.
 * 영상을 못 틀면 읽어 주기(브라우저 음성)로 대신한다.
 */
export default function ShadowingActivity({
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
  const [showKo, setShowKo] = useState(false);
  const [showText, setShowText] = useState(false);
  const line = lines[idx];

  // 녹음
  const [micState, setMicState] = useState<'unknown' | 'asking' | 'ready' | 'denied' | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'MediaRecorder' in window && typeof navigator.mediaDevices?.getUserMedia === 'function' ? 'unknown' : 'unsupported',
  );
  const [recording, setRecording] = useState(false);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
  }, []);
  useEffect(() => () => {
    if (clipUrl) URL.revokeObjectURL(clipUrl);
  }, [clipUrl]);

  async function play() {
    if (!line) return;
    setListens((n) => n + 1);
    if (yt.ready && !yt.failed) await yt.playSegment(line.s, line.e);
    else speak(line.en);
    setShowText(true);
  }

  async function enableMic() {
    setMicState('asking');
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicState('ready');
    } catch {
      setMicState('denied');
    }
  }

  function toggleRecord() {
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
      setClipUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      setRepeats((n) => n + 1);
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
    // 너무 길게 켜 두지 않게(문장 길이 + 4초)
    window.setTimeout(() => rec.state === 'recording' && rec.stop(), Math.max(4000, ((line?.e ?? 0) - (line?.s ?? 0)) * 1000 + 4000));
  }

  function practiced() {
    onLineDone(idx, listens, repeats);
    setListens(0);
    setRepeats(0);
    setShowText(false);
    setShowKo(false);
    setClipUrl(null);
    if (idx + 1 < lines.length) setIdx(idx + 1);
    else onLinesFinished();
  }

  if (!line) return null;
  const big = 'flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-base font-bold';
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="text-center text-sm text-white/70">{t('studentHw.shadowLineN', { n: idx + 1, total: lines.length })}</div>
      {item.content.videoId && !yt.failed && (
        <div className="relative mx-auto aspect-video w-full max-w-xl overflow-hidden rounded-2xl bg-black">
          <div id={yt.elementId} className="absolute inset-0 h-full w-full" />
        </div>
      )}
      {yt.failed && <p className="rounded-xl bg-white/10 p-3 text-center text-sm text-white/80">{t('studentHw.videoFallback')}</p>}

      <div className="rounded-2xl bg-white/10 p-4 text-center">
        {showText ? (
          <>
            {line.speaker && <div className="mb-1 text-sm text-warm-yellow">{line.speaker}</div>}
            <div className="text-2xl font-bold leading-snug">{line.en}</div>
            {showKo && line.ko && <div className="mt-2 text-base text-white/75">{line.ko}</div>}
          </>
        ) : (
          <div className="text-lg text-white/70">{t('studentHw.shadowListenFirst')}</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void play()} disabled={yt.playing} className={`${big} col-span-2 bg-warm-yellow text-deep-navy disabled:opacity-60`}>
          <span className="material-symbols-outlined">{listens ? 'replay' : 'play_arrow'}</span>
          {listens ? t('studentHw.listenAgainN', { n: listens }) : t('studentHw.listen')}
        </button>
        {showText && line.ko && (
          <button type="button" onClick={() => setShowKo((k) => !k)} className={`${big} bg-white/15 text-white`}>
            <span className="material-symbols-outlined">translate</span>
            {showKo ? t('studentHw.hideKorean') : t('studentHw.showKorean')}
          </button>
        )}
        {showText && micState === 'ready' && (
          <button type="button" onClick={toggleRecord} className={`${big} ${recording ? 'bg-rose-600' : 'bg-white/15'} text-white`}>
            <span className="material-symbols-outlined">{recording ? 'stop_circle' : 'mic'}</span>
            {recording ? t('studentHw.stopRecording') : t('studentHw.recordMe')}
          </button>
        )}
      </div>

      {showText && micState === 'unknown' && (
        <div className="rounded-2xl bg-white/10 p-3 text-sm text-white/85">
          <p>{t('studentHw.micExplain')}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => void enableMic()} className={`${big} flex-1 bg-white text-deep-navy`}>
              {t('studentHw.micOn')}
            </button>
            <button type="button" onClick={() => setMicState('unsupported')} className={`${big} flex-1 bg-white/15 text-white`}>
              {t('studentHw.micSkip')}
            </button>
          </div>
        </div>
      )}
      {micState === 'denied' && <p className="text-center text-sm text-white/70">{t('studentHw.micDenied')}</p>}
      {clipUrl && (
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm text-white/70">{t('studentHw.myVoice')}</span>
          <audio src={clipUrl} controls className="w-full max-w-sm" />
        </div>
      )}

      <button type="button" disabled={!showText} onClick={practiced} className={`${big} mt-auto min-h-14 bg-emerald-500 text-lg text-white disabled:opacity-40`}>
        <span className="material-symbols-outlined">check_circle</span>
        {t('studentHw.practiced')}
      </button>
    </div>
  );
}
