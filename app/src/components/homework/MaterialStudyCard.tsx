import { useCallback, useEffect, useRef, useState } from 'react';
import PlainTeachingVideo, { type TeachingVideoControl } from '../PlainTeachingVideo';
import { speakVerified } from '../../lib/speech';
import type { HwItem } from '../../lib/homework/types';
import type { SensorAction } from '../../lib/learningSensors/core';
import type { RunnerApi } from './runnerTypes';
import { useHomeworkRecording } from './useHomeworkRecording';

const button = 'min-h-12 rounded-2xl border border-outline-variant bg-white px-5 py-2 text-lg font-bold text-deep-navy disabled:opacity-40';
const primary = 'min-h-12 rounded-2xl bg-primary px-6 py-2 text-lg font-bold text-white disabled:opacity-40';
type CardProgress = { meaningSeen?: boolean; hidden?: boolean; listened?: boolean; watched?: boolean; listens?: number; hints?: number };

export default function MaterialStudyCard({ item, api, preview, onSensor, onDone }: {
  item: HwItem; api: RunnerApi; preview: boolean;
  onSensor?: (action: SensorAction) => void;
  onDone: (meta: Record<string, unknown>) => Promise<void>;
}) {
  const block = item.config.block!;
  const method = block.method!.slice('material:'.length);
  const flip = method === 'learn' || method === 'sceneWords';
  const continuous = method === 'shadow' || method === 'dub';
  const video = continuous || method === 'watch' || method === 'echo';
  const requiresRecording = block.completion === 'recording';
  const cache = !preview && api.cacheScope ? api.cacheScope + ':' + item.id : '';
  const progressKey = 'classbank.hw.card.' + cache;
  const [progress, setProgress] = useState<CardProgress>(() => {
    try { return cache ? JSON.parse(localStorage.getItem(progressKey) || '{}') ?? {} : {}; } catch { return {}; }
  });
  const [back, setBack] = useState(false);
  const [hint, setHint] = useState(false);
  const [error, setError] = useState('');
  const [time, setTime] = useState(block.start);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const locked = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const recordedAudio = useRef<HTMLAudioElement | null>(null);
  const speech = useRef<AbortController | null>(null);
  const audioGeneration = useRef(0);
  const control = useRef<TeachingVideoControl | null>(null);
  const coverage = useRef({ last: block.start, end: block.start });
  const captureScene = useRef(false);
  const savedSubmission = useRef(false);
  const sensor = useRef(onSensor);
  sensor.current = onSensor;
  const lines = item.content.lines ?? [];
  const speakers = [...new Set(lines.flatMap(line => line.speaker ? [line.speaker] : []))];
  const line = lines.find(line => time >= line.s && time < line.e);
  const expected = method === 'dub' ? lines.filter(line => line.speaker === block.role).map(line => line.en).join(' ')
    : method === 'shadow' ? lines.map(line => line.en).join(' ') : block.text;
  const limit = continuous ? Math.min(1205, Math.max(120, Math.ceil(block.end - block.start) + 5)) : 120;
  const rec = useHomeworkRecording(cache, expected, limit, setError);
  const recordingBusy = rec.phase !== 'idle';
  useEffect(() => {
    if (rec.phase === 'idle' && captureScene.current) {
      captureScene.current = false;
      control.current?.pause();
      setError('장면이 끝나기 전에 녹음이 중단됐어요. 다시 녹음해 주세요.');
    }
  }, [rec.phase]);
  useEffect(() => {
    if (cache && !savedSubmission.current) {
      try { localStorage.setItem(progressKey, JSON.stringify(progress)); } catch { /* The card still works in memory. */ }
    }
  }, [cache, progressKey, progress]);
  const stopAudio = useCallback(() => {
    audioGeneration.current++;
    audio.current?.pause();
    audio.current = null;
    speech.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);
  const listen = useCallback(async () => {
    stopAudio();
    recordedAudio.current?.pause();
    const generation = audioGeneration.current;
    setError('');
    setPlaying(true);
    sensor.current?.('audio');
    let played: boolean;
    if (block.audioUrl) {
      const element = new Audio(block.audioUrl);
      audio.current = element;
      played = await new Promise<boolean>(resolve => {
        element.onended = () => resolve(true);
        element.onerror = element.onpause = () => resolve(element.ended);
        void element.play().catch(() => resolve(false));
      });
    } else {
      speech.current = new AbortController();
      played = await speakVerified(block.text, speech.current.signal);
    }
    if (generation !== audioGeneration.current) return;
    setPlaying(false);
    if (played) setProgress(p => ({ ...p, listened: true, listens: (p.listens ?? 0) + 1 }));
    else setError('소리를 재생하지 못했어요. 스피커를 눌러 다시 들어 보세요.');
  }, [block.text, block.audioUrl, stopAudio]);
  useEffect(() => {
    // A user gesture may be required on mobile. The speaker also invokes listen().
    const autoplay = flip || method === 'listen' || method === 'repeat';
    const start = autoplay ? window.setTimeout(() => { void listen(); }, 0) : undefined;
    return () => { window.clearTimeout(start); stopAudio(); };
  }, [flip, method, listen, stopAudio]);

  const visibleEnglish = method === 'hide' && progress.hidden && !hint
    ? block.text.split(/\s+/).map((word, i) => block.hiddenWords.includes(i)
      ? word.replace(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu, '_____') : word).join(' ') : block.text;
  const heard = Boolean(progress.listened);
  const watched = Boolean(progress.watched);
  const canRecord = method === 'repeat' ? heard : method === 'hide' ? !!progress.hidden && !hint
    : method === 'echo' ? watched : continuous ? ready : true;
  const canSubmit = !recordingBusy && !playing && (!flip || progress.meaningSeen)
    && (!requiresRecording || Boolean(rec.take))
    && (method !== 'listen' || heard)
    && (!video || watched);
  const beginRecording = () => {
    if (!canRecord || locked.current) return;
    setError('');
    stopAudio();
    recordedAudio.current?.pause();
    setPlaying(false);
    void rec.start(() => {
      if (continuous) {
        captureScene.current = true;
        coverage.current = { last: block.start, end: block.start };
        setProgress(p => ({ ...p, watched: false }));
        control.current?.playFrom(block.start);
      } else if (video) control.current?.pause();
    });
  };
  function observe(at: number, running: boolean, ended: boolean) {
    setTime(at);
    if (running && recordedAudio.current && !recordedAudio.current.paused) recordedAudio.current.pause();
    if (!running && !ended) return;
    if (continuous && !captureScene.current) return;
    const interval = coverage.current;
    const delta = at - interval.last;
    // Only advance through adjacent samples, never by seeking past unheard dialogue.
    if (at <= interval.end + 1.25 && delta >= 0 && delta <= 1.25) interval.end = Math.max(interval.end, at);
    interval.last = at;
    if (interval.end >= block.end || (ended && interval.end >= block.end - .15)) {
      if (!watched) setProgress(p => ({ ...p, watched: true }));
      if (captureScene.current) {
        captureScene.current = false;
        rec.stop();
      }
    }
  }
  function changeHint() {
    if (!hint) {
      sensor.current?.('hint');
      setProgress(p => ({ ...p, hints: (p.hints ?? 0) + 1 }));
    }
    setHint(!hint);
  }
  async function submit() {
    if (!canSubmit || locked.current) return;
    locked.current = true;
    setSubmitting(true);
    setError('');
    try {
      const uploaded = requiresRecording ? await rec.upload(api, item.id, preview) : null;
      sensor.current?.('submitted');
      await onDone({
        confirmed: block.completion === 'confirm', watched, meaningSeen: Boolean(progress.meaningSeen),
        recording: uploaded?.uploadedPath, duration: uploaded?.duration,
        recordingCheck: uploaded?.check ?? 'unavailable', submission: uploaded?.submission,
        hints: progress.hints ?? 0, listens: progress.listens ?? 0,
      });
      savedSubmission.current = true;
      if (cache) { try { localStorage.removeItem(progressKey); } catch { /* Successful on the server. */ } }
      rec.clear();
    } catch {
      setError('저장하지 못했어요. 이 카드에서 다시 제출해 주세요. 녹음한 파일은 그대로 있어요.');
    } finally {
      locked.current = false;
      setSubmitting(false);
    }
  }
  return <article className="mx-auto flex w-full min-w-0 max-w-3xl flex-1 flex-col gap-4 p-4 text-deep-navy [overflow-wrap:anywhere] sm:p-6">
    <h2 className="text-xl font-bold">{item.title}</h2>
    {preview && <p className="text-sm text-on-surface-variant">학생 화면 미리보기</p>}
    {video && <div className="min-w-0">
      <div inert={recordingBusy || undefined}>
        <PlainTeachingVideo videoUrl={block.videoUrl} start={block.start} end={block.end} title={item.title}
          simple controlRef={control} rememberKey={'hw:' + item.id} onReady={() => setReady(true)} onTime={observe} />
      </div>
      {method === 'dub' && <div className="mt-3 space-y-2"><strong>내 역할 · {block.role}</strong>
        <div className="flex flex-wrap gap-2">{speakers.map(speaker => <span key={speaker} className={'rounded-lg border px-3 py-2 font-bold ' + (line?.speaker === speaker ? 'border-sky-500 bg-sky-200' : 'bg-white')}>
          {line?.speaker === speaker ? '✓ ' : ''}{speaker}</span>)}</div></div>}
      {(continuous || (method === 'echo' && hint)) && <p className="mt-3 text-center text-2xl font-bold">{method === 'echo' ? block.text : line?.en}</p>}
      {method === 'echo' && <div className="mt-3 flex flex-wrap gap-2">
        <button className={button} disabled={!ready || recordingBusy || submitting} onClick={() => { recordedAudio.current?.pause(); sensor.current?.('audio'); control.current?.playFrom(block.start); }}>다시 듣기</button>
        <button className={button} aria-pressed={hint} onClick={changeHint}>{hint ? '대사 가리기' : '대사 보기'}</button>
      </div>}
    </div>}
    {flip && <>
      <button type="button" aria-label={back ? '영어 단어 보기' : '한글 뜻 보기'} aria-pressed={back} className="flex min-h-44 items-center justify-center rounded-3xl bg-white p-5 text-center text-4xl font-bold shadow-sm ring-1 ring-outline-variant sm:min-h-56" onClick={() => {
        if (!back) { sensor.current?.('revealed'); setProgress(p => ({ ...p, meaningSeen: true })); }
        setBack(!back);
      }}>{back ? block.translation : block.text}</button>
      <p className="text-center text-base">카드를 눌러 {back ? '영어 단어를' : '한글 뜻을'} 보세요.</p>
    </>}
    {!video && !flip && <section className="grid min-h-36 place-content-center gap-3 rounded-3xl bg-white p-5 text-center ring-1 ring-outline-variant">
      {method !== 'say' && <p className="break-words text-3xl font-bold">{visibleEnglish}</p>}
      <p className={method === 'say' ? 'text-3xl font-bold' : 'text-xl'}>{block.translation}</p>
    </section>}
    {(flip || method === 'listen' || method === 'repeat') && <button type="button" disabled={recordingBusy || submitting} className={button} onClick={() => void listen()}>
      <span aria-hidden>🔊 </span>{playing ? '재생 중' : '다시 듣기'}</button>}
    {method === 'hide' && <button className={button} disabled={recordingBusy || submitting}
      onClick={() => progress.hidden ? changeHint() : setProgress(p => ({ ...p, hidden: true }))}>
      {!progress.hidden ? '가리기' : hint ? '힌트 가리기' : '힌트 보기'}</button>}
    {requiresRecording && <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-outline-variant">
      <button className={button} disabled={submitting || rec.phase === 'permission' || rec.phase === 'stopping' || (!recordingBusy && !canRecord)}
        onClick={() => {
          if (rec.phase === 'recording') {
            if (continuous) {
              captureScene.current = false;
              control.current?.pause();
              setError('장면이 끝나기 전에 멈췄어요. 다시 녹음을 누르고 장면 끝까지 녹음해 주세요.');
            }
            rec.stop();
          } else beginRecording();
        }}>{rec.phase === 'permission' ? '마이크 연결 중…' : rec.phase === 'stopping' ? '녹음 확인 중…' : rec.phase === 'recording' ? '녹음 끝내기' : rec.take ? '다시 녹음' : '녹음하기'}</button>
      {rec.take && !recordingBusy && <><strong className={'ml-3 ' + (rec.take.check === 'matched' ? 'text-emerald-700' : 'text-red-700')} role="status">{rec.take.check === 'matched' ? 'Correct' : 'Incorrect'}</strong>
        {rec.url && <audio ref={recordedAudio} className="w-full" controls src={rec.url} aria-label="내 녹음 듣기" onPlay={() => {
          stopAudio();
          setPlaying(false);
          control.current?.pause();
        }} />}</>}
    </section>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-900">{error}</p>}
    <button type="button" className={primary} disabled={!canSubmit || submitting} onClick={() => void submit()}>
      {submitting ? '저장 중…' : requiresRecording ? '제출하기' : '다음'}</button>
  </article>;
}
