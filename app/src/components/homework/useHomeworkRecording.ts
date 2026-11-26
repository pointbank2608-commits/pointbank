import { useCallback, useEffect, useRef, useState } from 'react';
import { recordingCache, type SavedRecording } from '../../lib/homework/recordingCache';
import { listenLocally, type UtteranceCheck } from '../../lib/homework/localUtterance';
import type { RunnerApi } from './runnerTypes';

export function useHomeworkRecording(cache: string, expected: string, limit: number, onError: (message: string) => void) {
  const [take, setTake] = useState<SavedRecording>();
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<'idle' | 'permission' | 'recording' | 'stopping'>('idle');
  const current = useRef<SavedRecording | undefined>(undefined);
  const recorder = useRef<MediaRecorder | null>(null);
  const media = useRef<MediaStream | null>(null);
  const recognition = useRef<ReturnType<typeof listenLocally>>(null);
  const timer = useRef(0);
  const busy = useRef(false);
  const generation = useRef(0);
  const cacheQueue = useRef(Promise.resolve());
  const report = useRef(onError);
  report.current = onError;
  const releaseDevices = useCallback(() => {
    generation.current++;
    window.clearTimeout(timer.current);
    recognition.current?.abort();
    if (recorder.current?.state === 'recording') recorder.current.stop();
    media.current?.getTracks().forEach(track => track.stop());
  }, []);

  const persist = useCallback((value: SavedRecording | undefined) => {
    current.current = value;
    setTake(value);
    if (cache) cacheQueue.current = cacheQueue.current
      .then(() => recordingCache(cache, value ?? null)).then(() => {})
      .catch(() => report.current('기기에서 녹음을 복구할 수 없어요. 이 화면에서 제출해 주세요.'));
  }, [cache]);
  useEffect(() => {
    const startGeneration = generation.current;
    if (cache) void recordingCache(cache).then(value => {
      if (generation.current === startGeneration && value?.blob.size) {
        current.current = value;
        setTake(value);
      }
    }).catch(() => report.current('이 기기의 이전 녹음을 불러오지 못했어요.'));
    return releaseDevices;
  }, [cache, releaseDevices]);
  useEffect(() => {
    if (!take?.blob) { setUrl(''); return; }
    const next = URL.createObjectURL(take.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [take?.blob]);

  function stop() {
    if (recorder.current?.state !== 'recording') return;
    setPhase('stopping');
    recognition.current?.stop();
    recorder.current.stop();
  }

  async function start(onStarted?: () => void) {
    if (busy.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      report.current('이 브라우저에서 마이크 녹음을 사용할 수 없어요.');
      return;
    }
    busy.current = true;
    const attempt = ++generation.current;
    recognition.current?.abort();
    setPhase('permission');
    report.current('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation.current !== attempt) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      media.current = stream;
      const mimeType = ['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw Error('format');
      const instance = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 });
      recorder.current = instance;
      const chunks: Blob[] = [];
      const began = performance.now();
      const submission = crypto.randomUUID();
      let check: UtteranceCheck = 'unavailable';
      let captureFailed = false;
      instance.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      instance.onerror = () => {
        captureFailed = true;
        if (instance.state === 'recording') instance.stop();
        stream.getTracks().forEach(track => track.stop());
        if (attempt === generation.current) report.current('녹음이 중단됐어요. 마이크를 확인하고 다시 녹음해 주세요.');
      };
      instance.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        if (media.current === stream) media.current = null;
        if (recorder.current === instance) recorder.current = null;
        if (attempt !== generation.current) return;
        window.clearTimeout(timer.current);
        recognition.current?.stop();
        busy.current = false;
        setPhase('idle');
        if (captureFailed) return;
        const blob = new Blob(chunks, { type: mimeType });
        const duration = Math.min(limit, (performance.now() - began) / 1000);
        if (blob.size < 64 || blob.size > 8 * 1024 * 1024 || duration < 0.5) {
          report.current('녹음 파일이 너무 짧거나 커서 저장할 수 없어요. 다시 녹음해 주세요.');
          return;
        }
        persist({ blob, duration, submission, check });
      };
      instance.start();
      // Once a new take actually starts, an empty/disconnected capture must not
      // leave the previous answer silently eligible for submission.
      if (current.current) persist(undefined);
      recognition.current = listenLocally(expected, value => {
        if (attempt !== generation.current) return;
        check = value;
        if (current.current?.submission === submission) persist({ ...current.current, check });
      });
      setPhase('recording');
      timer.current = window.setTimeout(stop, limit * 1000);
      onStarted?.();
    } catch (err) {
      media.current?.getTracks().forEach(track => track.stop());
      if (attempt !== generation.current) return;
      busy.current = false;
      setPhase('idle');
      report.current((err as DOMException).name === 'NotAllowedError'
        ? '마이크 권한을 허용한 뒤 다시 눌러 주세요.'
        : '마이크나 녹음 형식을 사용할 수 없어요. 기기를 확인하고 다시 시도해 주세요.');
    }
  }

  async function upload(api: RunnerApi, itemId: string, preview: boolean) {
    const recording = current.current;
    if (!recording || busy.current) throw Error('recording_required');
    if (preview) return { ...recording, uploadedPath: null };
    if (recording.uploadedPath) return recording;
    if (!api.uploadRecording) throw Error('upload_unavailable');
    const uploadedPath = await api.uploadRecording(itemId, recording.blob, recording.duration);
    const saved = { ...recording, uploadedPath };
    persist(saved);
    return saved;
  }

  function clear() {
    generation.current++;
    recognition.current?.abort();
    persist(undefined);
  }
  return { take, phase, url, start, stop, upload, clear };
}
